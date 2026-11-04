// Lisio pour Figma : cœur de l'import (partagé entre le plugin et les tests)
const LISIO_W = { 100: ["Thin", "Hairline"], 200: ["ExtraLight", "Extra Light", "UltraLight", "Ultra Light"], 300: ["Light"], 400: ["Regular", "Normal", "Book", "Roman"], 500: ["Medium"], 600: ["SemiBold", "Semi Bold", "DemiBold", "Demi Bold"], 700: ["Bold"], 800: ["ExtraBold", "Extra Bold", "UltraBold", "Ultra Bold"], 900: ["Black", "Heavy"] };
const LISIO_COL = { color: "Lisio · Couleurs", semantic: "Lisio · Rôles", font: "Lisio · Typo", typography: "Lisio · Typo" };
const LISIO_SCOPES = { color: ["ALL_FILLS", "STROKE_COLOR", "EFFECT_COLOR"], semantic: ["ALL_FILLS", "STROKE_COLOR"], spacing: ["GAP", "WIDTH_HEIGHT"], radius: ["CORNER_RADIUS"], size: ["WIDTH_HEIGHT"], "border-width": ["STROKE_FLOAT"], font: ["FONT_FAMILY"] };
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
  if (!data || !data.color || !data.typography) throw new Error("Ce fichier ne vient pas de Lisio : il manque les couleurs ou les styles.");
  const report = { variables: 0, created: 0, updated: 0, styles: 0, warnings: [] };
  const fonts = await figma.listAvailableFontsAsync(), byFam = {};
  fonts.forEach(f => { (byFam[f.fontName.family] = byFam[f.fontName.family] || []).push(f.fontName.style); });
  const pickStyle = (family, weight) => {
    const styles = byFam[family]; if (!styles) return null;
    const order = [100, 200, 300, 400, 500, 600, 700, 800, 900].sort((a, b) => Math.abs(a - weight) - Math.abs(b - weight));
    for (const w of order) for (const n of LISIO_W[w] || []) if (styles.includes(n)) return n;
    return styles[0];
  };
  const cols = await figma.variables.getLocalVariableCollectionsAsync(), allVars = await figma.variables.getLocalVariablesAsync();
  const getCol = name => { let c = cols.find(c => c.name === name); if (!c) { c = figma.variables.createVariableCollection(name); cols.push(c); } return c; };
  const getVar = (col, name, type) => {
    let v = allVars.find(x => x.variableCollectionId === col.id && x.name === name);
    if (v && v.resolvedType !== type) { v.remove(); v = null; }
    if (v) report.updated++; else { v = figma.variables.createVariable(name, col, type); allVars.push(v); report.created++; }
    return v;
  };
  // 1. Toutes les variables (couleurs, rôles, dimensions, polices)
  const tokens = lisioWalk(data, [], []).filter(t => t.path[0] !== "typography"), map = {}, famName = {};
  for (const t of tokens) {
    const top = t.path[0], type = t.type === "color" ? "COLOR" : t.type === "fontFamily" ? "STRING" : (t.type === "dimension" || t.type === "number") ? "FLOAT" : null;
    if (!type) continue;
    const col = getCol(LISIO_COL[top] || "Lisio · Dimensions"), name = (LISIO_COL[top] ? t.path.slice(1) : t.path).join("/");
    const v = getVar(col, name, type); v.scopes = t.ext.scopes || LISIO_SCOPES[top] || ["ALL_SCOPES"];
    if (t.desc) v.description = t.desc;
    v.setVariableCodeSyntax("WEB", `var(--${t.path.join("-")})`);
    map[`{${t.path.join(".")}}`] = { v, t, col }; report.variables++;
  }
  // 2. Valeurs (les alias après création de tout)
  for (const { v, t, col } of Object.values(map)) {
    const mode = col.modes[0].modeId, val = t.value;
    if (typeof val === "string" && val.startsWith("{")) { const ref = map[val]; if (ref) { v.setValueForMode(mode, figma.variables.createVariableAlias(ref.v)); continue; } report.warnings.push(`Alias introuvable : ${val}`); continue; }
    if (v.resolvedType === "COLOR") v.setValueForMode(mode, lisioHex(val));
    else if (v.resolvedType === "FLOAT") v.setValueForMode(mode, typeof val === "object" ? val.value : val);
    else if (t.type === "fontFamily") {
      const list = Array.isArray(val) ? val : [val]; let fam = list.find(f => byFam[f]);
      if (!fam) { fam = "Inter"; report.warnings.push(`Police « ${list[0]} » absente de Figma : Inter utilisée. Installez-la puis relancez.`); }
      famName[`{${t.path.join(".")}}`] = fam; v.setValueForMode(mode, fam);
    }
  }
  // 3. Styles de texte, liés aux variables de police et de taille
  const cTypo = getCol("Lisio · Typo"), mT = cTypo.modes[0].modeId, styles = await figma.getLocalTextStylesAsync(), mine = [];
  for (const [id, tok] of Object.entries(data.typography)) {
    if (!tok || !tok.$value) continue;
    const t = tok.$value, ext = (tok.$extensions && tok.$extensions["app.lisio"]) || {};
    const fam = famName[t.fontFamily] || (byFam[t.fontFamily] ? t.fontFamily : "Inter"), fontName = { family: fam, style: pickStyle(fam, t.fontWeight) || "Regular" };
    await figma.loadFontAsync(fontName);
    const size = typeof t.fontSize === "object" ? t.fontSize.value : t.fontSize;
    const sizeVar = getVar(cTypo, `font-size/${id}`, "FLOAT"); sizeVar.scopes = ["FONT_SIZE"]; sizeVar.setValueForMode(mT, size); sizeVar.setVariableCodeSyntax("WEB", `var(--font-size-${id})`); report.variables++;
    const name = `${/^h[1-6]$/.test(id) ? "Titres" : "Texte"}/${ext.label || ext.name || id}`;
    let s = styles.find(x => x.name === name);
    if (!s) { s = figma.createTextStyle(); styles.push(s); }
    s.name = name; mine.push([id, s]); s.fontName = fontName; s.fontSize = size;
    s.lineHeight = { unit: "PERCENT", value: Math.round(t.lineHeight * 1000) / 10 };
    s.letterSpacing = typeof ext.letterSpacingPercent === "number" ? { unit: "PERCENT", value: ext.letterSpacingPercent } : { unit: "PIXELS", value: (t.letterSpacing && t.letterSpacing.value) || 0 };
    if (tok.$description) s.description = tok.$description;
    try { const fv = map[t.fontFamily]; if (fv) s.setBoundVariable("fontFamily", fv.v); s.setBoundVariable("fontSize", sizeVar); } catch (e) { report.warnings.push(`Liaison aux variables impossible pour ${name} : ${e.message}`); }
    report.styles++;
  }
  if (opts.board !== false) report.board = await lisioBoard(data, map, mine);
  return report;
}
function lisioAuto(dir, props) { const f = figma.createFrame(); f.layoutMode = dir; f.primaryAxisSizingMode = "AUTO"; f.counterAxisSizingMode = "AUTO"; Object.assign(f, props); return f; }
async function lisioBoard(data, map, styles) {
  await figma.loadFontAsync({ family: "Inter", style: "Regular" }); await figma.loadFontAsync({ family: "Inter", style: "Bold" });
  const old = figma.currentPage.children.find(n => n.type === "FRAME" && n.name === "Lisio · Planche"); let x = 0, y = 0;
  if (old) { x = old.x; y = old.y; old.remove(); } else { const r = figma.currentPage.children.reduce((m, n) => Math.max(m, n.x + n.width), -Infinity); x = isFinite(r) ? r + 200 : 0; }
  const paint = ref => { const m = map[ref]; return m ? figma.variables.setBoundVariableForPaint({ type: "SOLID", color: { r: 0, g: 0, b: 0 } }, "color", m.v) : null; };
  const board = lisioAuto("VERTICAL", { name: "Lisio · Planche", itemSpacing: 40, paddingTop: 64, paddingBottom: 64, paddingLeft: 64, paddingRight: 64 });
  board.x = x; board.y = y; board.cornerRadius = 24;
  board.fills = [paint("{semantic.background.default}") || { type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  const label = (txt, size, bold, parent, muted) => { const t = figma.createText(); t.fontName = { family: "Inter", style: bold ? "Bold" : "Regular" }; t.characters = txt; t.fontSize = size; const p = paint(muted ? "{semantic.text.muted}" : "{semantic.text.default}"); if (p) t.fills = [p]; if (parent) parent.appendChild(t); return t; };
  const hstack = (name, gap) => { const f = lisioAuto("HORIZONTAL", { name, itemSpacing: gap }); f.fills = []; return f; };
  const vstack = (name, gap) => { const f = lisioAuto("VERTICAL", { name, itemSpacing: gap }); f.fills = []; return f; };
  const swatch = (ref, step, parent) => { const cell = vstack(step, 6), sw = figma.createRectangle(); sw.resize(64, 48); sw.cornerRadius = 8; const p = paint(ref); if (!p) return; sw.fills = [p]; sw.strokes = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 }, opacity: .1 }]; cell.appendChild(sw); label(step, 12, false, cell, true); parent.appendChild(cell); };
  label("Couleurs et nuances", 28, true, board);
  for (const [group, steps] of Object.entries(data.color)) { const row = hstack(group, 8); const nm = label(group, 13, true, row); nm.resize(110, nm.height); nm.textAutoResize = "HEIGHT"; Object.keys(steps).filter(k => !k.startsWith("$")).forEach(st => swatch(`{color.${group}.${st}}`, st, row)); board.appendChild(row); }
  if (data.semantic) { label("Rôles", 28, true, board); for (const [group, items] of Object.entries(data.semantic)) { const row = hstack(group, 8); const nm = label(group, 13, true, row); nm.resize(110, nm.height); nm.textAutoResize = "HEIGHT"; Object.keys(items).filter(k => !k.startsWith("$")).forEach(st => swatch(`{semantic.${group}.${st}}`, st, row)); board.appendChild(row); } }
  label("Styles de texte", 28, true, board);
  for (const [id, s] of styles) {
    await figma.loadFontAsync(s.fontName);
    const row = vstack(s.name, 4), meta = label(`${s.name} · ${s.fontName.family} ${s.fontName.style} · ${s.fontSize} px`, 12, false, row, true);
    const t = figma.createText(); t.fontName = s.fontName; t.characters = id === "button" ? "Télécharger le PDF" : s.name.startsWith("Titres") ? "Votre attestation est prête" : "Elle reste consultable douze mois dans votre espace personnel.";
    await t.setTextStyleIdAsync(s.id); const p = paint("{semantic.text.default}"); if (p) t.fills = [p];
    row.appendChild(t); board.appendChild(row);
  }
  return board.id;
}
