// Lisio for Figma: import core (shared by the plugin and tests)
const LISIO_W = { 100: ["Thin", "Hairline"], 200: ["ExtraLight", "Extra Light", "UltraLight", "Ultra Light"], 300: ["Light"], 400: ["Regular", "Normal", "Book", "Roman"], 500: ["Medium"], 600: ["SemiBold", "Semi Bold", "DemiBold", "Demi Bold"], 700: ["Bold"], 800: ["ExtraBold", "Extra Bold", "UltraBold", "Ultra Bold"], 900: ["Black", "Heavy"] };
const LISIO_COL = { color: "Colors", semantic: "Semantic", font: "Typography", duration: "Motion" };
const LISIO_SCOPES = { layout: ["GAP", "WIDTH_HEIGHT"], color: ["ALL_FILLS", "STROKE_COLOR", "EFFECT_COLOR"], semantic: ["ALL_FILLS", "STROKE_COLOR"], spacing: ["GAP", "WIDTH_HEIGHT"], radius: ["CORNER_RADIUS"], size: ["WIDTH_HEIGHT"], "border-width": ["STROKE_FLOAT"], icon: ["WIDTH_HEIGHT"], duration: [], font: ["FONT_FAMILY"] };
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
    if (!v && /\/main$/.test(name)) { v = allVars.find(x => x.variableCollectionId === col.id && x.name === name.replace(/main$/, "base")); if (v) v.name = name; }
    if (v && v.resolvedType !== type) { v.remove(); v = null; }
    if (v) report.updated++; else { v = figma.variables.createVariable(name, col, type); allVars.push(v); report.created++; }
    return v;
  };
  // Typography collection: one mode per breakpoint
  const bpModes = (col, what) => {
    const out = {}; col.renameMode(col.modes[0].modeId, LISIO_BP[0].name);
    for (const bp of LISIO_BP) {
      let m = col.modes.find(m => m.name === bp.name);
      if (!m) { try { col.addMode(bp.name); m = col.modes.find(m => m.name === bp.name); } catch (e) { report.warnings.push(`${col.name}: mode "${bp.name}" could not be added (${e.message}). ${what}`); } }
      if (m) out[bp.id] = m.modeId;
    }
    return out;
  };
  const cTypo = getCol("Typography"), modes = bpModes(cTypo, "Breakpoint values stay in the text styles.");
  let cLay = null, layModes = {};
  const setAll = (v, col, val) => col.modes.forEach(m => v.setValueForMode(m.modeId, val));
  // 1. Variables: colors, semantic, dimensions, font families
  const tokens = lisioWalk(data, [], []).filter(t => t.path[0] !== "typography"), map = {}, famName = {};
  for (const t of tokens) {
    const top = t.path[0], type = t.type === "color" ? "COLOR" : t.type === "fontFamily" ? "STRING" : (t.type === "dimension" || t.type === "number" || t.type === "duration") ? "FLOAT" : null;
    if (!type) continue;
    const perBp = t.ext.breakpoints && typeof t.ext.breakpoints === "object";
    if (perBp && !cLay) { cLay = getCol("Layout"); layModes = bpModes(cLay, "Only the first breakpoint value is kept."); }
    const col = perBp ? cLay : getCol(LISIO_COL[top] || "Dimensions"), name = (perBp || LISIO_COL[top] ? t.path.slice(1) : t.path).join("/");
    const v = getVar(col, name, type); v.scopes = t.ext.scopes || LISIO_SCOPES[top] || ["ALL_SCOPES"];
    if (t.desc) v.description = t.desc;
    v.setVariableCodeSyntax("WEB", `var(--${t.path.join("-")})`);
    if (perBp) { v.scopes = t.path[1] === "columns" ? [] : ["GAP", "WIDTH_HEIGHT"]; LISIO_BP.forEach(bp => { const mid = layModes[bp.id], val = t.ext.breakpoints[bp.id]; if (mid && typeof val === "number") v.setValueForMode(mid, val); }); report.variables++; continue; }
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
  // 1b. Extra modes (semantic roles: Light and Dark)
  const modeId = (col, name) => {
    let m = col.modes.find(x => x.name === name);
    if (!m) { try { col.addMode(name); m = col.modes.find(x => x.name === name); } catch (e) { report.warnings.push(`${col.name}: mode "${name}" could not be added (${e.message}). Only the light values were imported.`); return null; } }
    return m.modeId;
  };
  for (const { v, t, col } of Object.values(map)) {
    const md = t.ext.modes; if (!md || typeof md !== "object") continue;
    for (const [name, val] of Object.entries(md)) {
      if (col.modes[0].name === "Default") col.renameMode(col.modes[0].modeId, "Light");
      const id = modeId(col, name.charAt(0).toUpperCase() + name.slice(1)); if (!id) continue;
      if (typeof val === "string" && val.startsWith("{")) { const ref = map[val]; if (ref) v.setValueForMode(id, figma.variables.createVariableAlias(ref.v)); else report.warnings.push(`Missing alias in ${name} mode: ${val}`); }
      else if (v.resolvedType === "COLOR" && typeof val === "string") v.setValueForMode(id, lisioHex(val));
    }
    if (t.ext.darkDescription) v.description = `${t.desc || ""}\nDark: ${t.ext.darkDescription}`;
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
  txt("Palette de couleurs", 36, false, pal);
  txt(`Collection Colors · ${groups.length} couleurs × 11 nuances (50 à 950) + Main, votre couleur telle que saisie · même numéro = même clarté · var(--nom-nuance)`, 14, false, pal, true);
  const swatchCell = (parent, ref, top, bottom, w) => { const c = lisioAuto("VERTICAL", { name: top, itemSpacing: 6 }); const r = figma.createRectangle(); r.resize(w || 74, 60); r.fills = [paint(ref)]; r.strokes = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 }, opacity: .08 }]; c.appendChild(r); txt(top, 15, true, c, false, w || 74); txt(bottom, 11, false, c, true, w || 74); parent.appendChild(c); };
  for (const [g, steps] of Object.entries(data.color)) {
    const row = lisioAuto("HORIZONTAL", { name: g, itemSpacing: 6 }); txt(g === "neutral" ? "Neutres" : typeof steps.$description === "string" ? steps.$description : g.charAt(0).toUpperCase() + g.slice(1), 16, true, row, false, 112);
    const keys = Object.keys(steps).filter(k => !k.startsWith("$")), MAIN = ["main", "base"], NEU = { white: "Blanc", black: "Noir" };
    for (const k of keys.filter(k => MAIN.includes(k)).concat(keys.filter(k => !MAIN.includes(k)))) swatchCell(row, `{color.${g}.${k}}`, MAIN.includes(k) ? "Main" : NEU[k] || k, steps[k].$value);
    pal.appendChild(row);
  }
  cy += pal.height + 120;
  // Semantic colors
  if (data.semantic) {
    const sem = board("Semantic colors"); ids.push(sem.id);
    txt("Semantic colors", 36, false, sem);
    txt("Collection Semantic · each role points to a palette step and states its WCAG contrast", 14, false, sem, true);
    for (const [g, items] of Object.entries(data.semantic)) {
      if (g.startsWith("$") || !items || typeof items !== "object") continue;
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

// Audit: text contrast of an existing file (selection, or the whole current page)
function lisioLin(c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function lisioLum(c) { return 0.2126 * lisioLin(c.r) + 0.7152 * lisioLin(c.g) + 0.0722 * lisioLin(c.b); }
function lisioRatio(a, b) { const x = lisioLum(a), y = lisioLum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
function lisioToHex(c) { return "#" + [c.r, c.g, c.b].map(v => Math.round(v * 255).toString(16).padStart(2, "0")).join("").toUpperCase(); }
function lisioSolid(fills) {
  if (!Array.isArray(fills)) return null;
  for (let i = fills.length - 1; i >= 0; i--) { const f = fills[i]; if (f.visible === false) continue; if (f.type === "SOLID") return { c: f.color, a: f.opacity == null ? 1 : f.opacity }; return { c: null, a: 1, other: f.type }; }
  return null;
}
function lisioInside(a, b) { return a && b && b.x <= a.x + 0.5 && b.y <= a.y + 0.5 && b.x + b.width >= a.x + a.width - 0.5 && b.y + b.height >= a.y + a.height - 0.5; }
function lisioBackdrop(node) {
  const box = node.absoluteBoundingBox; let child = node, p = node.parent, guess = false;
  while (p && p.type !== "PAGE" && p.type !== "DOCUMENT") {
    const kids = "children" in p ? p.children : [], idx = kids.indexOf(child);
    for (let i = idx - 1; i >= 0; i--) { const k = kids[i]; if (k.visible === false || !("fills" in k)) continue; if (!lisioInside(box, k.absoluteBoundingBox)) continue; const f = lisioSolid(k.fills); if (!f) continue; if (!f.c) { guess = true; continue; } if (f.a >= 0.99 && (k.opacity == null || k.opacity >= 0.99)) return { c: f.c, guess }; guess = true; }
    if ("fills" in p) { const f = lisioSolid(p.fills); if (f && f.c && f.a >= 0.99) return { c: f.c, guess }; if (f && (!f.c || f.a < 0.99)) guess = true; }
    child = p; p = p.parent;
  }
  const pg = figma.currentPage.backgrounds && lisioSolid(figma.currentPage.backgrounds);
  return { c: pg && pg.c ? pg.c : { r: 1, g: 1, b: 1 }, guess: true };
}
async function lisioPalette() {
  const cols = await figma.variables.getLocalVariableCollectionsAsync(), col = cols.find(c => c.name === "Colors"); if (!col) return [];
  const vars = await figma.variables.getLocalVariablesAsync("COLOR"), m = col.modes[0].modeId;
  return vars.filter(v => v.variableCollectionId === col.id).map(v => ({ id: v.id, name: v.name, c: v.valuesByMode[m] })).filter(x => x.c && typeof x.c.r === "number");
}
function lisioFix(fg, bg, need, pal, fam) {
  // No bound variable: take the family of the closest palette colour, so a grey stays grey and an orange stays orange
  if (!fam && pal.length) { const d = x => (x.c.r - fg.r) ** 2 + (x.c.g - fg.g) ** 2 + (x.c.b - fg.b) ** 2; fam = pal.slice().sort((a, b) => d(a) - d(b))[0].name.split("/")[0]; }
  const L = lisioLum(fg), pass = pal.filter(x => lisioRatio(x.c, bg) >= need), near = l => l.sort((a, b) => Math.abs(lisioLum(a.c) - L) - Math.abs(lisioLum(b.c) - L))[0];
  const best = (fam && near(pass.filter(x => x.name.split("/")[0] === fam))) || near(pass.slice());
  if (best) return { varId: best.id, name: best.name, hex: lisioToHex(best.c) };
  const bw = [{ r: 0, g: 0, b: 0 }, { r: 1, g: 1, b: 1 }].filter(c => lisioRatio(c, bg) >= need).sort((a, b) => Math.abs(lisioLum(a) - L) - Math.abs(lisioLum(b) - L))[0];
  return bw ? { hex: lisioToHex(bw), name: lisioToHex(bw) === "#000000" ? "noir" : "blanc" } : null;
}
async function lisioAudit(opts) {
  opts = opts || {}; const aaa = opts.level === "AAA", out = [], sel = figma.currentPage.selection;
  const roots = sel.length ? sel : [figma.currentPage], pal = await lisioPalette(), palHex = new Set(pal.map(x => lisioToHex(x.c))), varById = {};
  pal.forEach(x => { varById[x.id] = x; });
  let texts = [], all = []; for (const r of roots) { if (r.type === "TEXT") texts.push(r); if ("findAll" in r) { texts = texts.concat(r.findAll(n => n.type === "TEXT")); all = all.concat(r.findAll(n => "fills" in n)); } else if ("fills" in r) all.push(r); }
  const visible = n => { for (let x = n; x && x.type !== "PAGE"; x = x.parent) if (x.visible === false) return false; return true; };
  texts = texts.filter(visible); const total = texts.length; texts = texts.slice(0, 800);
  const used = {};
  for (const n of all.slice(0, 4000)) { if (!visible(n) || n.fills === figma.mixed) continue; const f = lisioSolid(n.fills); if (!f || !f.c) continue; const h = lisioToHex(f.c), bound = n.fills.some(p => p.boundVariables && p.boundVariables.color); const u = used[h] = used[h] || { hex: h, n: 0, bound: 0 }; u.n++; if (bound) u.bound++; }
  for (const t of texts) {
    if (!t.characters.trim()) continue;
    const bg = lisioBackdrop(t);
    let segs = []; try { segs = t.getStyledTextSegments(["fills", "fontSize", "fontWeight"]); } catch (e) { segs = [{ fills: t.fills, fontSize: t.fontSize, fontWeight: 400, characters: t.characters }]; }
    let worst = null;
    for (const s of segs) {
      const f = lisioSolid(s.fills); if (!f || !f.c) continue;
      const h0 = lisioToHex(f.c), u = used[h0] = used[h0] || { hex: h0, n: 0, bound: 0 }; u.n++;
      const bv = s.fills.find(p => p.boundVariables && p.boundVariables.color), vid = bv && bv.boundVariables.color.id; if (vid) u.bound++;
      const a = f.a * (t.opacity == null ? 1 : t.opacity), c = { r: f.c.r * a + bg.c.r * (1 - a), g: f.c.g * a + bg.c.g * (1 - a), b: f.c.b * a + bg.c.b * (1 - a) };
      const large = s.fontSize >= 24 || (s.fontSize >= 18.66 && s.fontWeight >= 700), need = aaa ? (large ? 4.5 : 7) : (large ? 3 : 4.5), r = lisioRatio(c, bg.c);
      if (!worst || r / need < worst.r / worst.need) worst = { r, need, large, fg: lisioToHex(c), c, size: s.fontSize, fam: vid && varById[vid] ? varById[vid].name.split("/")[0] : null };
    }
    if (!worst) continue;
    const ok = worst.r >= worst.need;
    out.push({ id: t.id, name: t.name, text: t.characters.slice(0, 60), ratio: Math.floor(worst.r * 100) / 100, need: worst.need, large: worst.large, size: worst.size, fg: worst.fg, bg: lisioToHex(bg.c), guess: bg.guess, ok, fix: ok ? null : lisioFix(worst.c, bg.c, worst.need, pal, worst.fam) });
  }
  out.sort((a, b) => (a.ok - b.ok) || (a.ratio / a.need - b.ratio / b.need));
  const colors = Object.values(used).map(u => ({ hex: u.hex, n: u.n, inSystem: pal.length ? palHex.has(u.hex) || u.bound === u.n : null, bound: u.bound })).sort((a, b) => b.n - a.n);
  return { total, checked: out.length, fails: out.filter(x => !x.ok).length, items: out.slice(0, 200), scope: sel.length ? "selection" : "page", colors: colors.slice(0, 40), nColors: colors.length, offSystem: pal.length ? colors.filter(c => !c.inSystem).length : null, hasPalette: pal.length > 0 };
}
async function lisioApplyFix(id, fix) {
  const n = await figma.getNodeByIdAsync(id); if (!n || n.type !== "TEXT" || !fix) return false;
  const fonts = n.characters.length ? n.getRangeAllFontNames(0, n.characters.length) : [n.fontName]; for (const f of fonts) if (f && f !== figma.mixed) await figma.loadFontAsync(f);
  let paint = { type: "SOLID", color: lisioHex(fix.hex) };
  if (fix.varId) { const v = await figma.variables.getVariableByIdAsync(fix.varId); if (v) paint = figma.variables.setBoundVariableForPaint(paint, "color", v); }
  n.fills = [paint]; return true;
}

// ---------- Components bound to the Semantic variables ----------
async function lisioComponents() {
  const cols = await figma.variables.getLocalVariableCollectionsAsync(), vars = await figma.variables.getLocalVariablesAsync();
  const sem = cols.find(c => c.name === "Semantic"), dim = cols.find(c => c.name === "Dimensions");
  if (!sem) throw new Error("Importez d’abord le design system : la collection Semantic est introuvable.");
  const V = (col, name) => col ? vars.find(v => v.variableCollectionId === col.id && v.name === name) : null;
  const resolve = v => { let x = v, g = 0; while (x && g++ < 6) { const col = cols.find(c => c.id === x.variableCollectionId), val = x.valuesByMode[col.modes[0].modeId]; if (val && val.type === "VARIABLE_ALIAS") { x = vars.find(y => y.id === val.id); continue; } return val; } return null; };
  const paint = name => { const v = V(sem, name); if (!v) return []; const c = resolve(v) || { r: 0, g: 0, b: 0 }; return [figma.variables.setBoundVariableForPaint({ type: "SOLID", color: { r: c.r, g: c.g, b: c.b } }, "color", v)]; };
  const bindNum = (node, field, name, fallback) => { const v = V(dim, name), val = v ? resolve(v) : null; node[field] = typeof val === "number" ? val : fallback; if (v) try { node.setBoundVariable(field, v); } catch (e) {} };
  const radius = node => ["topLeftRadius", "topRightRadius", "bottomLeftRadius", "bottomRightRadius"].forEach(f => bindNum(node, f, "radius/control", 8));
  const styles = await figma.getLocalTextStylesAsync(), st = base => styles.find(s => s.name === base + "/Desktop") || styles.find(s => s.name.startsWith(base + "/"));
  const loaded = {};
  const text = async (chars, styleBase, color, fb) => {
    const t = figma.createText(), s = st(styleBase);
    if (s) { const k = JSON.stringify(s.fontName); if (!loaded[k]) { await figma.loadFontAsync(s.fontName); loaded[k] = 1; } await t.setTextStyleIdAsync(s.id); }
    else { const f = { family: "Inter", style: fb || "Regular" }; await figma.loadFontAsync(f); t.fontName = f; t.fontSize = 16; }
    t.characters = chars; t.fills = paint(color); return t;
  };
  let page = figma.root.children.find(p => p.name === "Lisio components");
  if (page && page.children.some(n => n.type === "COMPONENT_SET" && ["Button", "Field", "Alert"].includes(n.name))) return { skipped: true, page: page.id };
  if (!page) { page = figma.createPage(); page.name = "Lisio components"; }
  await figma.setCurrentPageAsync(page);
  const auto = (dir, props) => { const f = figma.createComponent(); f.layoutMode = dir; f.primaryAxisSizingMode = "AUTO"; f.counterAxisSizingMode = "AUTO"; f.fills = []; Object.assign(f, props || {}); return f; };
  const sets = [];
  // Button
  const btns = [];
  for (const type of ["Primary", "Secondary"]) for (const state of ["Default", "Hover", "Pressed", "Disabled"]) {
    const c = auto("HORIZONTAL", { name: `Type=${type}, State=${state}`, primaryAxisAlignItems: "CENTER", counterAxisAlignItems: "CENTER", paddingLeft: 20, paddingRight: 20, paddingTop: 10, paddingBottom: 10 });
    bindNum(c, "minHeight", "size/target-comfort", 44); radius(c);
    const off = state === "Disabled", key = state === "Default" ? "action/default" : state === "Hover" ? "action/hover" : "action/pressed";
    if (type === "Primary") { c.fills = paint(off ? "disabled/surface" : key); c.appendChild(await text("Envoyer", "Button", off ? "disabled/text" : "text/on-action", "Semi Bold")); }
    else { c.fills = paint(off ? "disabled/surface" : state === "Default" ? "background/default" : "background/subtle"); if (!off) { c.strokes = paint(key); c.strokeWeight = 1.5; } c.appendChild(await text("Annuler", "Button", off ? "disabled/text" : key, "Semi Bold")); }
    btns.push(c);
  }
  // Field
  const fields = [];
  for (const state of ["Default", "Focus", "Error", "Disabled"]) {
    const c = auto("VERTICAL", { name: `State=${state}`, itemSpacing: 6 }), off = state === "Disabled";
    c.appendChild(await text("Adresse e-mail", "Label", "text/default", "Semi Bold"));
    const box = figma.createFrame(); box.name = "Input"; box.layoutMode = "HORIZONTAL"; box.counterAxisAlignItems = "CENTER"; box.resize(320, 44); box.primaryAxisSizingMode = "FIXED"; box.counterAxisSizingMode = "AUTO"; box.paddingLeft = box.paddingRight = 12; box.paddingTop = box.paddingBottom = 10;
    bindNum(box, "minHeight", "size/target-comfort", 44); radius(box);
    box.fills = paint(off ? "disabled/surface" : "background/default");
    box.strokes = paint(state === "Focus" ? "focus/ring" : state === "Error" ? "error/border" : off ? "border/subtle" : "border/default"); box.strokeWeight = state === "Focus" || state === "Error" ? 2 : 1;
    box.appendChild(await text(state === "Default" ? "nom@exemple.fr" : state === "Error" ? "nom@exemple" : "camille@exemple.fr", "Body", off ? "disabled/text" : "text/default"));
    c.appendChild(box);
    c.appendChild(await text(state === "Error" ? "Erreur : indiquez une adresse complète, par exemple nom@exemple.fr." : off ? "Modifiable après validation de votre compte." : "Nous l’utilisons seulement pour vous répondre.", "Small", state === "Error" ? "error/text" : "text/muted"));
    fields.push(c);
  }
  // Alert
  const alerts = [];
  for (const [k, title, body] of [["error", "Erreur", "Le paiement n’a pas abouti. Vérifiez la date d’expiration de la carte."], ["success", "Succès", "Votre demande est envoyée. Vous recevrez une réponse sous 48 heures."], ["warning", "Attention", "Votre session expire dans 5 minutes. Enregistrez votre travail."], ["info", "Information", "Le service sera interrompu dimanche de 2 h à 4 h."]]) {
    const c = auto("HORIZONTAL", { name: `Status=${k[0].toUpperCase() + k.slice(1)}`, itemSpacing: 12, paddingLeft: 16, paddingRight: 16, paddingTop: 14, paddingBottom: 14 });
    c.resize(440, c.height); c.primaryAxisSizingMode = "FIXED"; c.counterAxisSizingMode = "AUTO"; radius(c); c.fills = paint(k + "/surface"); c.strokes = paint(k + "/border"); c.strokeWeight = 1;
    const bar = figma.createRectangle(); bar.name = "Accent"; bar.resize(4, 20); bar.fills = paint(k + "/border"); bar.cornerRadius = 2; c.appendChild(bar); bar.layoutAlign = "STRETCH";
    const col = figma.createFrame(); col.name = "Content"; col.layoutMode = "VERTICAL"; col.itemSpacing = 4; col.fills = []; col.primaryAxisSizingMode = "AUTO"; c.appendChild(col); col.layoutGrow = 1;
    col.appendChild(await text(title, "Label", k + "/text", "Semi Bold"));
    const b = await text(body, "Body", "text/default"); col.appendChild(b); b.layoutAlign = "STRETCH"; b.textAutoResize = "HEIGHT";
    alerts.push(c);
  }
  let y = 80;
  for (const [name, list, desc] of [["Button", btns, "Lisio button. Colours bound to Semantic variables, minimum height 44 px (WCAG 2.5.8 needs 24 px). Disabled state is exempt from contrast (SC 1.4.3): explain why it is disabled."], ["Field", fields, "Lisio text field. Visible label, help text, 3:1 border (SC 1.4.11), 2 px focus ring, error stated in words (SC 3.3.1), not only in red (SC 1.4.1)."], ["Alert", alerts, "Lisio alert. The title word carries the meaning, the colour only reinforces it (SC 1.4.1). Text checked on its surface in Light and Dark."]]) {
    const set = figma.combineAsVariants(list, page); set.name = name; set.description = desc;
    set.layoutMode = "HORIZONTAL"; set.layoutWrap = "WRAP"; set.itemSpacing = 24; set.counterAxisSpacing = 24; set.paddingLeft = set.paddingRight = set.paddingTop = set.paddingBottom = 32;
    set.resize(name === "Button" ? 560 : 1100, set.height); set.primaryAxisSizingMode = "FIXED"; set.counterAxisSizingMode = "AUTO"; set.fills = paint("background/default");
    set.x = 80; set.y = y; y += set.height + 80; sets.push(set);
  }
  figma.viewport.scrollAndZoomIntoView(sets);
  return { skipped: false, page: page.id, components: btns.length + fields.length + alerts.length };
}
