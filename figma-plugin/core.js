// Lisio for Figma: import core (shared by the plugin and tests)
const LISIO_W = { 100: ["Thin", "Hairline"], 200: ["ExtraLight", "Extra Light", "UltraLight", "Ultra Light"], 300: ["Light"], 400: ["Regular", "Normal", "Book", "Roman"], 500: ["Medium"], 600: ["SemiBold", "Semi Bold", "DemiBold", "Demi Bold"], 700: ["Bold"], 800: ["ExtraBold", "Extra Bold", "UltraBold", "Ultra Bold"], 900: ["Black", "Heavy"] };
const LISIO_COL = { color: "Colors", semantic: "Semantic", font: "Typography" };
const LISIO_SCOPES = { color: ["ALL_FILLS", "STROKE_COLOR", "EFFECT_COLOR"], semantic: ["ALL_FILLS", "STROKE_COLOR"], spacing: ["GAP", "WIDTH_HEIGHT"], radius: ["CORNER_RADIUS"], size: ["WIDTH_HEIGHT"], "border-width": ["STROKE_FLOAT"], font: ["FONT_FAMILY"] };
const LISIO_BP = [{ id: "mobile", name: "Mobile", width: 390 }, { id: "tablet", name: "Tablet", width: 768 }, { id: "desktop", name: "Desktop", width: 1024 }, { id: "xl", name: "Desktop XL", width: 1440 }];
function lisioHex(hex) { const h = hex.replace("#", ""); return { r: parseInt(h.slice(0, 2), 16) / 255, g: parseInt(h.slice(2, 4), 16) / 255, b: parseInt(h.slice(4, 6), 16) / 255 }; }
function lisioWalk(obj, path, out) {
  for (const [k, v] of Object.entries(obj || {})) {
    if (k.startsWith("$") || !v || typeof v !== "object") continue;
    if ("$value" in v) out.push({ path: path.concat(k), type: v.$type, value: v.$value, desc: v.$description, ext: (v.$extensions && v.$extensions["app.lisio"]) || {} });
    else lisioWalk(v, path.concat(k), out);
  }
  return out;
}
async function lisioImport(data, opts) {
  opts = opts || {};
  if (!data || !data.color || !data.typography) throw new Error("This file does not come from Lisio: colors or text styles are missing.");
  const report = { variables: 0, created: 0, updated: 0, styles: 0, warnings: [] };
  const fonts = await figma.listAvailableFontsAsync(), byFam = {};
  fonts.forEach(f => { (byFam[f.fontName.family] = byFam[f.fontName.family] || []).push(f.fontName.style); });
  const pickStyle = (family, weight, italic) => {
    const styles = byFam[family]; if (!styles) return null;
    const order = [100, 200, 300, 400, 500, 600, 700, 800, 900].sort((a, b) => Math.abs(a - weight) - Math.abs(b - weight));
    if (italic) for (const w of order) for (const n of (LISIO_W[w] || []).map(n => n + " Italic").concat(w === 400 ? ["Italic"] : [])) if (styles.includes(n)) return n;
    for (const w of order) for (const n of LISIO_W[w] || []) if (styles.includes(n)) return n;
    return styles[0];
  };
  const cols = await figma.variables.getLocalVariableCollectionsAsync(), allVars = await figma.variables.getLocalVariablesAsync();
  const getCol = name => { let c = cols.find(c => c.name === name); if (!c) { c = figma.variables.createVariableCollection(name); cols.push(c); if (name !== "Typography") c.renameMode(c.modes[0].modeId, "Default"); } return c; };
  const getVar = (col, name, type) => {
    let v = allVars.find(x => x.variableCollectionId === col.id && x.name === name);
    if (v && v.resolvedType !== type) { v.remove(); v = null; }
    if (v) report.updated++; else { v = figma.variables.createVariable(name, col, type); allVars.push(v); report.created++; }
    return v;
  };
  // Typography collection: one mode per breakpoint
  const cTypo = getCol("Typography"), modes = {};
  cTypo.renameMode(cTypo.modes[0].modeId, LISIO_BP[0].name);
  for (const bp of LISIO_BP) {
    let m = cTypo.modes.find(m => m.name === bp.name);
    if (!m) { try { cTypo.addMode(bp.name); m = cTypo.modes.find(m => m.name === bp.name); } catch (e) { report.warnings.push(`Mode "${bp.name}" could not be added (${e.message}). Breakpoint values stay in the text styles.`); } }
    if (m) modes[bp.id] = m.modeId;
  }
  const setAll = (v, col, val) => col.modes.forEach(m => v.setValueForMode(m.modeId, val));
  // 1. Variables: colors, semantic, dimensions, font families
  const tokens = lisioWalk(data, [], []).filter(t => t.path[0] !== "typography"), map = {}, famName = {};
  for (const t of tokens) {
    const top = t.path[0], type = t.type === "color" ? "COLOR" : t.type === "fontFamily" ? "STRING" : (t.type === "dimension" || t.type === "number") ? "FLOAT" : null;
    if (!type) continue;
    const col = getCol(LISIO_COL[top] || "Dimensions"), name = (LISIO_COL[top] ? t.path.slice(1) : t.path).join("/");
    const v = getVar(col, name, type); v.scopes = t.ext.scopes || LISIO_SCOPES[top] || ["ALL_SCOPES"];
    if (t.desc) v.description = t.desc;
    v.setVariableCodeSyntax("WEB", `var(--${t.path.join("-")})`);
    map[`{${t.path.join(".")}}`] = { v, t, col }; report.variables++;
  }
  for (const { v, t, col } of Object.values(map)) {
    const val = t.value;
    if (typeof val === "string" && val.startsWith("{")) { const ref = map[val]; if (ref) { setAll(v, col, figma.variables.createVariableAlias(ref.v)); continue; } report.warnings.push(`Missing alias: ${val}`); continue; }
    if (v.resolvedType === "COLOR") setAll(v, col, lisioHex(val));
    else if (v.resolvedType === "FLOAT") setAll(v, col, typeof val === "object" ? val.value : val);
    else if (t.type === "fontFamily") {
      const list = Array.isArray(val) ? val : [val]; let fam = list.find(f => byFam[f]);
      if (!fam) { fam = "Inter"; report.warnings.push(`Font "${list[0]}" is not available in Figma: Inter used instead. Install it and run the import again.`); }
      famName[`{${t.path.join(".")}}`] = fam; setAll(v, col, fam);
    }
  }
  // 2. Text styles: one per style and breakpoint ("H1/Mobile"), size and line height in px
  const styles = await figma.getLocalTextStylesAsync(), made = [];
  for (const [id, tok] of Object.entries(data.typography)) {
    if (!tok || !tok.$value) continue;
    const t = tok.$value, ext = (tok.$extensions && tok.$extensions["app.lisio"]) || {}, en = ext.name || id;
    const fam = famName[t.fontFamily] || (byFam[t.fontFamily] ? t.fontFamily : "Inter"), style = pickStyle(fam, t.fontWeight, ext.italic) || "Regular", fontName = { family: fam, style };
    if (ext.italic && !/Italic/.test(style)) report.warnings.push(`${en}: no italic style found for ${fam}.`);
    await figma.loadFontAsync(fontName);
    const fl = ext.fluid, bps = fl ? fl.breakpoints : [{ id: "xl", name: "Desktop XL", fontSize: t.fontSize.value || t.fontSize, lineHeight: Math.round((t.fontSize.value || t.fontSize) * t.lineHeight) }];
    const vSize = getVar(cTypo, `font-size/${id}`, "FLOAT"), vLh = getVar(cTypo, `line-height/${id}`, "FLOAT");
    vSize.scopes = ["FONT_SIZE"]; vLh.scopes = ["LINE_HEIGHT"]; report.variables += 2;
    vSize.setVariableCodeSyntax("WEB", `var(--font-size-${id})`); vLh.setVariableCodeSyntax("WEB", `var(--line-height-${id})`);
    if (fl) vSize.description = `${fl.clamp} (${fl.min} → ${fl.max} px, ${fl.viewportMin} → ${fl.viewportMax} px)`;
    for (const bp of bps) {
      const mid = modes[bp.id]; if (mid) { vSize.setValueForMode(mid, bp.fontSize); vLh.setValueForMode(mid, bp.lineHeight); }
      const name = `${en}/${bp.name}`;
      let s = styles.find(x => x.name === name);
      if (!s) { s = figma.createTextStyle(); styles.push(s); }
      s.name = name; s.fontName = fontName; s.fontSize = bp.fontSize; s.lineHeight = { unit: "PIXELS", value: bp.lineHeight };
      s.letterSpacing = { unit: "PERCENT", value: typeof ext.letterSpacingPercent === "number" ? ext.letterSpacingPercent : 0 };
      s.textCase = ext.textCase === "upper" ? "UPPER" : "ORIGINAL";
      s.description = `${tok.$description || en} ${bp.name} ${bp.width || ""} px: ${bp.fontSize}/${bp.lineHeight}.`;
      try { const fv = map[t.fontFamily]; if (fv) s.setBoundVariable("fontFamily", fv.v); } catch (e) { report.warnings.push(`Could not bind ${name} to its font variable: ${e.message}`); }
      made.push({ id, en, bp: bp.id, s, ext }); report.styles++;
    }
  }
  if (opts.board !== false) report.board = await lisioBoards(data, map, made, cTypo, modes, famName);
  return report;
}
function lisioAuto(dir, props) { const f = figma.createFrame(); f.layoutMode = dir; f.primaryAxisSizingMode = "AUTO"; f.counterAxisSizingMode = "AUTO"; f.fills = []; Object.assign(f, props); return f; }
async function lisioBoards(data, map, made, cTypo, modes, famName) {
  const UI = { family: "Inter", style: "Regular" }, UIB = { family: "Inter", style: "Bold" };
  await figma.loadFontAsync(UI); await figma.loadFontAsync(UIB);
  for (const m of made) await figma.loadFontAsync(m.s.fontName);
  const NAMES = ["Color palette", "Semantic colors", "Fluid typography", "Lisio · Planche"];
  let x = 0, y = 0; const old = figma.currentPage.children.filter(n => n.type === "FRAME" && NAMES.includes(n.name));
  if (old.length) { x = Math.min(...old.map(n => n.x)); y = Math.min(...old.map(n => n.y)); old.forEach(n => n.remove()); }
  else { const r = figma.currentPage.children.reduce((m, n) => Math.max(m, n.x + n.width), -Infinity); x = isFinite(r) ? r + 200 : 0; }
  const paint = (ref, fb) => { const m = map[ref]; return m ? figma.variables.setBoundVariableForPaint({ type: "SOLID", color: { r: 0, g: 0, b: 0 } }, "color", m.v) : { type: "SOLID", color: fb || { r: 0, g: 0, b: 0 } }; };
  const ink = () => paint("{semantic.text.default}"), muted = () => paint("{semantic.text.muted}", { r: .4, g: .4, b: .45 });
  const txt = (s, size, bold, parent, mute, width) => { const t = figma.createText(); t.fontName = bold ? UIB : UI; t.characters = String(s); t.fontSize = size; t.fills = [mute ? muted() : ink()]; if (parent) parent.appendChild(t); if (width) { t.resize(width, t.height); t.textAutoResize = "HEIGHT"; } return t; };
  const board = (name) => { const f = lisioAuto("VERTICAL", { name, itemSpacing: 28, paddingTop: 48, paddingBottom: 48, paddingLeft: 48, paddingRight: 48 }); f.fills = [paint("{color.neutral.white}", { r: 1, g: 1, b: 1 })]; f.x = x; f.y = cy; return f; };
  const ids = []; let cy = y;
  // Color palette
  const groups = Object.entries(data.color).filter(([g]) => g !== "neutral");
  const pal = board("Color palette"); ids.push(pal.id);
  txt("Color palette", 36, false, pal);
  txt(`Collection Colors · ${groups.length} colors × 11 steps (50 to 950) + source color · var(--color-name-step)`, 14, false, pal, true);
  const swatchCell = (parent, ref, top, bottom, w) => { const c = lisioAuto("VERTICAL", { name: top, itemSpacing: 6 }); const r = figma.createRectangle(); r.resize(w || 74, 60); r.fills = [paint(ref)]; r.strokes = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 }, opacity: .08 }]; c.appendChild(r); txt(top, 15, true, c, false, w || 74); txt(bottom, 11, false, c, true, w || 74); parent.appendChild(c); };
  for (const [g, steps] of Object.entries(data.color)) {
    const row = lisioAuto("HORIZONTAL", { name: g, itemSpacing: 6 }); txt(g.charAt(0).toUpperCase() + g.slice(1), 16, true, row, false, 112);
    const keys = Object.keys(steps).filter(k => !k.startsWith("$"));
    for (const k of keys.filter(k => k !== "base").concat(keys.includes("base") ? ["base"] : [])) swatchCell(row, `{color.${g}.${k}}`, k === "base" ? "Source" : k, steps[k].$value);
    pal.appendChild(row);
  }
  cy += pal.height + 120;
  // Semantic colors
  if (data.semantic) {
    const sem = board("Semantic colors"); ids.push(sem.id);
    txt("Semantic colors", 36, false, sem);
    txt("Collection Semantic · each role points to a palette step and states its WCAG contrast", 14, false, sem, true);
    for (const [g, items] of Object.entries(data.semantic)) {
      const row = lisioAuto("HORIZONTAL", { name: g, itemSpacing: 16 }); txt(g.charAt(0).toUpperCase() + g.slice(1), 16, true, row, false, 112);
      for (const [k, tok] of Object.entries(items)) { if (k.startsWith("$")) continue; const c = lisioAuto("VERTICAL", { name: k, itemSpacing: 6 }); const r = figma.createRectangle(); r.resize(180, 60); r.fills = [paint(`{semantic.${g}.${k}}`)]; r.strokes = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 }, opacity: .08 }]; c.appendChild(r); txt(k, 15, true, c, false, 180); txt(`${String(tok.$value).replace(/[{}]/g, "")}\n${tok.$description || ""}`, 11, false, c, true, 180); row.appendChild(c); }
      sem.appendChild(row);
    }
    cy += sem.height + 120;
  }
  // Fluid typography
  const ty = board("Fluid typography"); ids.push(ty.id);
  const head = famName["{font.family.heading}"] || "Inter", body = famName["{font.family.body}"] || "Inter";
  txt("Fluid typography", 36, false, ty);
  txt(`H1–H6 = document outline (one H1 per page) · Display = visual style · ${head} (headings) · ${body} (body) · clamp() 390 → 1440 px`, 14, false, ty, true);
  const cards = lisioAuto("HORIZONTAL", { name: "Breakpoints", itemSpacing: 32 }); cards.counterAxisAlignItems = "MIN"; ty.appendChild(cards);
  const SAMPLE = { head: "Accessible by design", body: "Good contrast and a calm rhythm help everyone read, on every screen.", label: "Design system", button: "Get started" };
  for (const bp of LISIO_BP) {
    const card = lisioAuto("VERTICAL", { name: `${bp.name} · ${bp.width}`, itemSpacing: 14, paddingTop: 32, paddingBottom: 32, paddingLeft: 32, paddingRight: 32 });
    card.counterAxisSizingMode = "FIXED"; card.resize(bp.width, 100); card.primaryAxisSizingMode = "AUTO";
    card.fills = [paint("{semantic.background.default}", { r: 1, g: 1, b: 1 })]; card.strokes = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 }, opacity: .1 }]; card.cornerRadius = 4;
    if (modes[bp.id]) { try { card.setExplicitVariableModeForCollection(cTypo, modes[bp.id]); } catch (e) {} }
    cards.appendChild(card);
    const h = txt(`${bp.name.toUpperCase()} · ${bp.width}`, 10, false, card, true); h.letterSpacing = { unit: "PERCENT", value: 6 };
    for (const m of made.filter(m => m.bp === bp.id)) {
      if (m.id === "button") {
        const b = lisioAuto("HORIZONTAL", { name: "Button", paddingTop: 10, paddingBottom: 10, paddingLeft: 20, paddingRight: 20 }); b.fills = [paint("{semantic.action.default}")]; b.cornerRadius = 4;
        const t = figma.createText(); t.fontName = m.s.fontName; t.characters = SAMPLE.button; await t.setTextStyleIdAsync(m.s.id); t.fills = [paint("{semantic.text.on-action}", { r: 1, g: 1, b: 1 })]; b.appendChild(t); card.appendChild(b); continue;
      }
      const t = figma.createText(); t.fontName = m.s.fontName;
      t.characters = m.id === "label" ? `${m.en} – ${SAMPLE.label}` : /^(display|h\d)$/.test(m.id) ? `${m.en} · ${SAMPLE.head}` : `${m.en} – ${SAMPLE.body}`;
      await t.setTextStyleIdAsync(m.s.id); t.fills = [ink()]; card.appendChild(t); t.layoutSizingHorizontal = "FILL"; t.textAutoResize = "HEIGHT";
    }
  }
  // clamp() table
  txt("clamp() values · 390 → 1440 px", 20, false, ty);
  const W = [140, 110, 110, 110, 120, 360, 100], tbl = lisioAuto("VERTICAL", { name: "clamp() table", itemSpacing: 0 }); ty.appendChild(tbl);
  const trow = (cells, bold) => { const r = lisioAuto("HORIZONTAL", { itemSpacing: 0, paddingTop: 8, paddingBottom: 8 }); r.strokes = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 }, opacity: .08 }]; r.strokeBottomWeight = 1; r.strokeTopWeight = 0; r.strokeLeftWeight = 0; r.strokeRightWeight = 0; cells.forEach((c, i) => txt(c, 13, bold, r, false, W[i])); tbl.appendChild(r); };
  trow(["Style"].concat(LISIO_BP.map(b => `${b.name} ${b.width}`), ["CSS font-size", "Line height"]), true);
  for (const [id, tok] of Object.entries(data.typography)) { const ext = (tok.$extensions && tok.$extensions["app.lisio"]) || {}, fl = ext.fluid; if (!fl) continue; trow([ext.name || id].concat(fl.breakpoints.map(b => `${b.fontSize}/${b.lineHeight}`), [fl.clamp, String(tok.$value.lineHeight)])); }
  return ids.join(",");
}
