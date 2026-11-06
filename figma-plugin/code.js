// Lisio for Figma: import core (shared by the plugin and tests)
// Same contrast code as the site: src/build.py inlines src/core/color.mjs and wcag.mjs at these markers (P0-6).
// Lisio, cœur couleur : conversions sRGB, luminance et contraste WCAG, OKLCH, nuances, simulation des daltonismes.
// Fonctions pures, sans DOM ni état. Testées par tests/color.test.mjs.
// Inliné tel quel dans la page par src/build.py (le mot export est retiré).
const clamp01 = v => Math.min(1, Math.max(0, v));
const normHex = h => { h = String(h).trim().replace(/^#/, ""); if (/^[0-9a-f]{3}$/i.test(h)) h = h.split("").map(c => c + c).join(""); return /^[0-9a-f]{6}$/i.test(h) ? "#" + h.toUpperCase() : null; };
const hex2rgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => v / 255); };
const rgb2hex = rgb => "#" + rgb.map(v => Math.round(clamp01(v) * 255).toString(16).padStart(2, "0")).join("").toUpperCase();
const toLin = c => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
const toGam = c => c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
const Yof = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const lum = hex => Yof(hex2rgb(hex).map(toLin));
// Ratio de deux luminances relatives : sert aussi au plugin Figma, qui reçoit des canaux de 0 à 1 et non un code hex.
const ratioLum = (la, lb) => (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
const ratio = (a, b) => ratioLum(lum(a), lum(b));
function linToOklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
}
function oklchToLin(L, C, h) {
  const a = C * Math.cos(h), b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
}
const hexToOklch = hex => { const [L, a, b] = linToOklab(hex2rgb(hex).map(toLin)); return { L, C: Math.hypot(a, b), h: Math.atan2(b, a) }; };
const inGamut = c => c.every(v => v >= -1e-5 && v <= 1 + 1e-5);
function maxChroma(L, h, want) { if (inGamut(oklchToLin(L, want, h))) return want; let lo = 0, hi = want; for (let i = 0; i < 22; i++) { const mid = (lo + hi) / 2; if (inGamut(oklchToLin(L, mid, h))) lo = mid; else hi = mid; } return lo; }
const linToHex = lin => rgb2hex(lin.map(v => toGam(clamp01(v))));
const chromaShape = (L, L0) => Math.max(0.08, L < L0 ? 1 - 0.45 * ((L0 - L) / Math.max(L0, 0.05)) ** 2 : 1 - 0.85 * ((L - L0) / Math.max(1 - L0, 0.05)) ** 2);
// sat : multiplie la chroma de départ (réglage « Saturation » des nuances, 1 = inchangé).
function colorForY(base, targetY, sat = 1) {
  const { L: L0, h } = base, C0 = base.C * sat; let lo = 0, hi = 1, lin = [0, 0, 0];
  for (let i = 0; i < 32; i++) { const mid = (lo + hi) / 2; lin = oklchToLin(mid, maxChroma(mid, h, C0 * chromaShape(mid, L0)), h).map(clamp01); if (Yof(lin) < targetY) lo = mid; else hi = mid; }
  return linToHex(lin);
}
const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const TARGET = [1.06, 1.15, 1.4, 1.9, 3.1, 4.65, 6.1, 8.1, 11, 14.6, 17.6];
// Cibles des 11 nuances quand on règle la plus claire (50) et la plus foncée (950) : le 500 reste à 4,65:1,
// chaque côté est interpolé en logarithme. Un côté laissé par défaut garde exactement les valeurs de TARGET.
function shadeTargets(light = TARGET[0], dark = TARGET[10]) {
  const M = Math.log(TARGET[5]), L0 = Math.log(TARGET[0]), D0 = Math.log(TARGET[10]), L = Math.log(light), D = Math.log(dark);
  return TARGET.map((t, i) => i < 5 ? (light === TARGET[0] ? t : Math.exp(M + (Math.log(t) - M) * (L - M) / (L0 - M))) : i > 5 ? (dark === TARGET[10] ? t : Math.exp(M + (Math.log(t) - M) * (D - M) / (D0 - M))) : t);
}
const targetY = r => 1.05 / r - 0.05;
const CVD = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]]
};
function simulate(hex, mode) { if (mode === "normal") return hex; const lin = hex2rgb(hex).map(toLin); if (mode === "achro") { const y = Yof(lin); return linToHex([y, y, y]); } return linToHex(CVD[mode].map(r => r[0] * lin[0] + r[1] * lin[1] + r[2] * lin[2])); }
function suggestFix(moveHex, otherHex, target) {
  const { L: L0, C, h } = hexToOklch(moveHex); let best = null, bestD = Infinity;
  for (let k = 0; k <= 400; k++) { const L = k / 400, hex = linToHex(oklchToLin(L, maxChroma(L, h, C), h).map(clamp01)); if (ratio(hex, otherHex) >= target) { const d = Math.abs(L - L0); if (d < bestD) { bestD = d; best = hex; } } }
  return best;
}
// Lisio, cœur WCAG : seuils, grand texte, arrondi d'affichage, verdicts.
// Fonctions pures, sans DOM ni état. Testées par tests/wcag.test.mjs.
// Inliné tel quel dans la page par src/build.py (le mot export est retiré).
// Affichage tronqué, jamais arrondi au supérieur : 4,499 s'affiche 4,49 et échoue, comme le calcul.
// Tronque à d décimales. Un nombre déjà exact à d décimales reste tel quel : 4,53 * 100 vaut 452,999… en virgule
// flottante, et Math.floor seul affichait 4,52 (P0-3). La tolérance (quelques ulp) ne fait jamais passer un seuil :
// un ratio calculé juste sous 4,5 reste sous 4,5.
const floorTo = (n, d) => { const k = 10 ** d, m = Math.round(n * k); return Math.abs(m / k - n) <= Number.EPSILON * Math.max(1, Math.abs(n)) * 4 ? m / k : Math.floor(n * k) / k; };
const floor2 = n => floorTo(n, 2);
// Grand texte (WCAG 2.2, définition « large scale ») : 18 pt, ou 14 pt en gras ; 1 pt = 4/3 px.
// 18 pt = 24 px ; 14 pt = 18,666… px, arrondi par Lisio à 18,66 px (tolérance de 0,007 px, voulue).
const largeText = (px, weight) => px >= 24 || (px >= 18.66 && weight >= 700);
// Contraste minimum du texte : 1.4.3 (AA) 4,5:1 ou 3:1 en grand texte ; 1.4.6 (AAA) 7:1 ou 4,5:1.
const needRatio = (level, large = false) => level === "AAA" ? (large ? 4.5 : 7) : (large ? 3 : 4.5);
// Pastille d'une paire, selon le niveau visé.
// Au niveau AA : le plus haut niveau atteint. Au niveau AAA (P0-3) : seuls 7:1 (tout texte) et 4,5:1 (grand texte)
// comptent, pour qu'une paire à 5:1 ne ressemble pas à une réussite du texte courant.
const grade = (r, level = "AA") => level === "AAA"
  ? (r >= 7 ? ["AAA", "b-aaa"] : r >= 4.5 ? ["AAA grand", "b-lg"] : ["✕ Échec", "b-no"])
  : (r >= 7 ? ["AAA", "b-aaa"] : r >= 4.5 ? ["AA", "b-aa"] : r >= 3 ? ["AA grand", "b-lg"] : ["✕ Échec", "b-no"]);
// Ratio affiché avec d décimales, tronqué comme floor2 (jamais arrondi au supérieur), virgule française.
// 9,95 s'affiche « 9,9 » avec 1 décimale (et non « 10,0 »), 4,48 s'affiche « 4,4 » (et non « 4,5 »).
// Avec d = 2, le résultat est identique à l'ancien fmt(floor2(r)).
const ratioTxt = (r, d = 2) => { return floorTo(r, d).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }); };
const LISIO_W = { 100: ["Thin", "Hairline"], 200: ["ExtraLight", "Extra Light", "UltraLight", "Ultra Light"], 300: ["Light"], 400: ["Regular", "Normal", "Book", "Roman"], 500: ["Medium"], 600: ["SemiBold", "Semi Bold", "DemiBold", "Demi Bold"], 700: ["Bold"], 800: ["ExtraBold", "Extra Bold", "UltraBold", "Ultra Bold"], 900: ["Black", "Heavy"] };
const LISIO_COL = { color: "Colors", semantic: "Semantic", font: "Typography", duration: "Motion", opacity: "Effects", blur: "Effects" };
const LISIO_SCOPES = { layout: ["GAP", "WIDTH_HEIGHT"], color: ["ALL_FILLS", "STROKE_COLOR", "EFFECT_COLOR"], semantic: ["ALL_FILLS", "STROKE_COLOR"], spacing: ["GAP", "WIDTH_HEIGHT"], radius: ["CORNER_RADIUS"], size: ["WIDTH_HEIGHT"], "border-width": ["STROKE_FLOAT"], icon: ["WIDTH_HEIGHT"], duration: [], font: ["FONT_FAMILY"], opacity: ["OPACITY"], blur: ["EFFECT_FLOAT"], ratio: [] };
const LISIO_BP = [{ id: "mobile", name: "Mobile", width: 390 }, { id: "tablet", name: "Tablet", width: 768 }, { id: "desktop", name: "Desktop", width: 1024 }, { id: "xl", name: "Desktop XL", width: 1440 }];
function lisioHex(hex) { const h = hex.replace("#", ""); return { r: parseInt(h.slice(0, 2), 16) / 255, g: parseInt(h.slice(2, 4), 16) / 255, b: parseInt(h.slice(4, 6), 16) / 255 }; }
function lisioRgba(hex) { const c = lisioHex(hex), h = hex.replace("#", ""); return { r: c.r, g: c.g, b: c.b, a: h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1 }; }
function lisioShadow(layers) { return (Array.isArray(layers) ? layers : [layers]).filter(l => l && l.color && lisioRgba(l.color).a > 0).map(l => ({ type: "DROP_SHADOW", color: lisioRgba(l.color), offset: { x: (l.offsetX && l.offsetX.value) || 0, y: (l.offsetY && l.offsetY.value) || 0 }, radius: (l.blur && l.blur.value) || 0, spread: (l.spread && l.spread.value) || 0, visible: true, blendMode: "NORMAL", showShadowBehindNode: false })); }
function lisioWalk(obj, path, out) {
  for (const [k, v] of Object.entries(obj || {})) {
    if (k.startsWith("$") || !v || typeof v !== "object") continue;
    if ("$value" in v) out.push({ path: path.concat(k), type: v.$type, value: v.$value, desc: v.$description, ext: (v.$extensions && v.$extensions["app.lisio"]) || {} });
    else lisioWalk(v, path.concat(k), out);
  }
  return out;
}
// Shared by lisioPlan (preview, writes nothing) and lisioImport, so both name things the same way.
function lisioCheck(data) { if (!data || !data.color || !data.typography) throw new Error("Ce fichier ne vient pas de Lisio : les couleurs ou les styles de texte manquent."); }
function lisioVarTarget(t) {
  const top = t.path[0], type = t.type === "color" ? "COLOR" : t.type === "fontFamily" ? "STRING" : (t.type === "dimension" || t.type === "number" || t.type === "duration") ? "FLOAT" : null;
  if (!type) return null;
  const perBp = !!(t.ext.breakpoints && typeof t.ext.breakpoints === "object");
  return { type, perBp, colName: perBp ? "Layout" : LISIO_COL[top] || "Dimensions", name: (perBp || (LISIO_COL[top] && LISIO_COL[top] !== "Effects") ? t.path.slice(1) : t.path).join("/") };
}
async function lisioFontKit() {
  const fonts = await figma.listAvailableFontsAsync(), byFam = {};
  fonts.forEach(f => { (byFam[f.fontName.family] = byFam[f.fontName.family] || []).push(f.fontName.style); });
  const pickStyle = (family, weight, italic) => {
    const styles = byFam[family]; if (!styles) return null;
    const order = [100, 200, 300, 400, 500, 600, 700, 800, 900].sort((a, b) => Math.abs(a - weight) - Math.abs(b - weight));
    if (italic) for (const w of order) for (const n of (LISIO_W[w] || []).map(n => n + " Italic").concat(w === 400 ? ["Italic"] : [])) if (styles.includes(n)) return n;
    for (const w of order) for (const n of LISIO_W[w] || []) if (styles.includes(n)) return n;
    return styles[0];
  };
  return { byFam, pickStyle };
}
const lisioFontMsg = f => `Police « ${f} » absente de Figma : Inter à la place. Installez-la, puis relancez l’import.`;
function lisioFamily(val, byFam) { const list = Array.isArray(val) ? val : [val], fam = list.find(f => byFam[f]); return { fam: fam || "Inter", missing: fam ? null : list[0] }; }
// Text styles: one per style and breakpoint ("H1/Mobile"), size and line height in px
function lisioTextSpecs(data, famName, kit) {
  const out = [];
  for (const [id, tok] of Object.entries(data.typography)) {
    if (!tok || !tok.$value) continue;
    const t = tok.$value, ext = (tok.$extensions && tok.$extensions["app.lisio"]) || {}, en = ext.name || id;
    const fam = famName[t.fontFamily] || (kit.byFam[t.fontFamily] ? t.fontFamily : "Inter"), style = kit.pickStyle(fam, t.fontWeight, ext.italic) || "Regular";
    const fl = ext.fluid, bps = fl ? fl.breakpoints : [{ id: "xl", name: "Desktop XL", fontSize: t.fontSize.value || t.fontSize, lineHeight: Math.round((t.fontSize.value || t.fontSize) * t.lineHeight) }];
    const props = bp => ({ fontName: { family: fam, style }, fontSize: bp.fontSize, lineHeight: { unit: "PIXELS", value: bp.lineHeight },
      letterSpacing: { unit: "PERCENT", value: typeof ext.letterSpacingPercent === "number" ? ext.letterSpacingPercent : 0 }, textCase: ext.textCase === "upper" ? "UPPER" : "ORIGINAL",
      description: `${tok.$description || en} ${bp.name} ${bp.width || ""} px: ${bp.fontSize}/${bp.lineHeight}.` });
    out.push({ id, tok, t, ext, en, fam, style, fl, bps, props });
  }
  return out;
}
// Layout grids: one grid style per breakpoint (columns, gutter, side margin)
function lisioGridSpecs(tokens) {
  const layT = tokens.filter(t => t.path[0] === "layout" && t.ext.breakpoints && typeof t.ext.breakpoints === "object"), out = [];
  if (!layT.length) return out;
  const lv = (k, id) => { const t = layT.find(x => x.path[1] === k), v = t && t.ext.breakpoints[id]; return typeof v === "number" ? v : null; };
  for (const bp of LISIO_BP) {
    const n = lv("columns", bp.id), g = lv("gutter", bp.id) || 0, m = lv("margin", bp.id) || 0; if (!n) continue;
    out.push({ name: `Grid/${bp.name} ${bp.width}`, layoutGrids: [{ pattern: "COLUMNS", alignment: "STRETCH", count: n, gutterSize: g, offset: m, visible: true, color: { r: 0.93, g: 0.27, b: 0.27, a: 0.1 } }],
      description: `${n} columns, ${g} px gutter, ${m} px side margin. Lisio layout tokens, ${bp.name} (${bp.width} px).` });
  }
  return out;
}
// Effect styles: elevation (light and dark) and background blur
function lisioEffectSpecs(tokens) {
  const shT = tokens.filter(t => t.path[0] === "shadow" && t.type === "shadow"), blT = tokens.find(t => t.path[0] === "blur" && t.path[1] === "glass"), out = [];
  for (const t of shT) {
    out.push({ name: `Elevation/Light/${t.path[1]}`, effects: lisioShadow(t.value), description: `${t.desc || ""}. Never replaces a 3:1 border (WCAG 1.4.11).` });
    if (t.ext.modes && t.ext.modes.dark) out.push({ name: `Elevation/Dark/${t.path[1]}`, effects: lisioShadow(t.ext.modes.dark), description: `${t.desc || ""}, dark mode. Elevation also shows through the lighter surface.` });
  }
  if (blT) out.push({ name: "Blur/Glass", effects: [{ type: "BACKGROUND_BLUR", blurType: "NORMAL", radius: (blT.value && blT.value.value) || 12, visible: true }], description: "Background blur behind translucent surfaces (opacity/glass). Check text contrast in the worst case." });
  return out;
}
const LISIO_BOARDS = ["Color palette", "Semantic colors", "Fluid typography", "Lisio · Planche"];
const lisioCap = s => s.charAt(0).toUpperCase() + s.slice(1);

// Preview: what the import would add, change, delete and rename in this file. Reads only, writes nothing.
async function lisioPlan(data, opts) {
  opts = opts || {}; lisioCheck(data);
  const plan = { add: [], update: [], same: 0, remove: [], rename: [], warnings: [] };
  const kit = await lisioFontKit(), cols = await figma.variables.getLocalVariableCollectionsAsync(), vars = await figma.variables.getLocalVariablesAsync();
  const colBy = n => cols.find(c => c.name === n), varIn = (c, n) => c ? vars.find(v => v.variableCollectionId === c.id && v.name === n) : null;
  const full = v => { const c = cols.find(c => c.id === v.variableCollectionId); return `${c ? c.name : "?"}/${v.name}`; };
  const fmt = x => x === undefined ? "vide" : x;
  const exVal = x => x && x.type === "VARIABLE_ALIAS" ? (v => "→ " + (v ? full(v) : "variable introuvable"))(vars.find(v => v.id === x.id)) : x && typeof x === "object" && "r" in x ? lisioToHex(x) : typeof x === "number" ? Math.round(x * 1e4) / 1e4 : x;
  const tokens = lisioWalk(data, [], []).filter(t => t.path[0] !== "typography"), specs = [], idx = {}, famName = {};
  for (const t of tokens) { const tg = lisioVarTarget(t); if (tg) { specs.push({ t, tg }); if (!tg.perBp) idx[`{${t.path.join(".")}}`] = `${tg.colName}/${tg.name}`; } }
  const newVal = (tg, val) => typeof val === "string" && val.startsWith("{") ? "→ " + (idx[val] || "variable introuvable") : tg.type === "COLOR" ? lisioToHex(lisioHex(val)) : tg.type === "FLOAT" ? Math.round((typeof val === "object" ? val.value : val) * 1e4) / 1e4 : val;
  for (const { t, tg } of specs) if (t.type === "fontFamily") { const f = lisioFamily(t.value, kit.byFam); famName[`{${t.path.join(".")}}`] = f.fam; if (f.missing && !plan.warnings.some(w => w.includes(f.missing))) plan.warnings.push(lisioFontMsg(f.missing)); }
  // Collections and modes
  const modesSeen = new Set(), addMode = (c, name) => { const k = `${c.name} : ${name}`; if (!modesSeen.has(k)) { modesSeen.add(k); plan.add.push({ kind: "mode", name: k }); } };
  const colsSeen = new Set(), useCol = name => { const c = colBy(name); if (!c && !colsSeen.has(name)) { colsSeen.add(name); plan.add.push({ kind: "collection", name }); } return c; };
  const bpMode = (c, bp) => c.modes.find(m => m.name === bp.name) || (bp === LISIO_BP[0] ? c.modes[0] : null);
  const bpCol = name => { const c = useCol(name); if (!c) return null;
    if (!c.modes.some(m => m.name === LISIO_BP[0].name)) plan.rename.push({ kind: "mode", from: `${c.name} : ${c.modes[0].name}`, to: `${c.name} : ${LISIO_BP[0].name}` });
    LISIO_BP.forEach(bp => { if (!bpMode(c, bp)) addMode(c, bp.name); }); return c; };
  const cTypo = bpCol("Typography"), cLay = specs.some(s => s.tg.perBp) ? bpCol("Layout") : null, darkRenamed = new Set();
  // A variable: added, renamed (base → main), type conflict (would be deleted), changed or unchanged
  const compare = (c, name, type, expect) => {
    let v = varIn(c, name);
    if (!v && c && /\/main$/.test(name)) { const b = varIn(c, name.replace(/main$/, "base")); if (b) { plan.rename.push({ kind: "variable", from: full(b), to: `${c.name}/${name}` }); return; } }
    if (!v) { plan.add.push({ kind: "variable", name: c ? `${c.name}/${name}` : name }); return; }
    if (v.resolvedType !== type) { plan.remove.push({ kind: "variable", name: full(v), why: `type ${v.resolvedType} dans Figma, ${type} dans Lisio` }); return; }
    const diffs = [];
    for (const m of c.modes) { const e = expect(m); if (e === undefined) continue; const x = exVal(v.valuesByMode[m.modeId]); if (x !== e) diffs.push({ m: m.name, from: fmt(x), to: e }); }
    if (!diffs.length) { plan.same++; return; }
    const one = diffs.length === 1 || c.modes.length === 1;
    plan.update.push({ kind: "variable", name: full(v), from: diffs.map(d => (one ? "" : d.m + " ") + d.from).join(", "), to: diffs.map(d => (one ? "" : d.m + " ") + d.to).join(", ") });
  };
  for (const { t, tg } of specs) {
    const c = tg.perBp ? cLay : useCol(tg.colName), key = `{${t.path.join(".")}}`;
    if (!c) { compare(null, `${tg.colName}/${tg.name}`, tg.type, () => undefined); continue; }
    if (tg.perBp) { compare(c, tg.name, tg.type, m => { const bp = LISIO_BP.find(bp => bpMode(c, bp) === m), val = bp && t.ext.breakpoints[bp.id]; return typeof val === "number" ? Math.round(val * 1e4) / 1e4 : undefined; }); continue; }
    const md = t.ext.modes && typeof t.ext.modes === "object" ? t.ext.modes : null, over = {};
    if (md) {
      if (c.modes[0].name === "Default" && !darkRenamed.has(c.name)) { darkRenamed.add(c.name); plan.rename.push({ kind: "mode", from: `${c.name} : Default`, to: `${c.name} : Light` }); }
      for (const [name, val] of Object.entries(md)) { const N = lisioCap(name); if (!c.modes.some(m => m.name === N)) addMode(c, N); if (typeof val === "string" && (val.startsWith("{") || tg.type === "COLOR")) over[N] = newVal(tg, val); }
    }
    const base = t.type === "fontFamily" ? famName[key] : newVal(tg, t.value);
    compare(c, tg.name, tg.type, m => m.name in over ? over[m.name] : base);
  }
  // Text styles and their size and line-height variables
  const textSt = await figma.getLocalTextStylesAsync(), lab = p => `${p.fontName.family} ${p.fontName.style}, ${p.fontSize}/${p.lineHeight.value} px, ${p.letterSpacing.value} %${p.textCase === "UPPER" ? ", capitales" : ""}`;
  for (const s of lisioTextSpecs(data, famName, kit)) {
    for (const [kind, k] of [["font-size", "fontSize"], ["line-height", "lineHeight"]]) {
      if (!cTypo) { compare(null, `Typography/${kind}/${s.id}`, "FLOAT", () => undefined); continue; }
      compare(cTypo, `${kind}/${s.id}`, "FLOAT", m => { const bp = s.bps.find(bp => { const def = LISIO_BP.find(x => x.id === bp.id); return def && bpMode(cTypo, def) === m; }); return bp ? bp[k] : undefined; });
    }
    for (const bp of s.bps) {
      const name = `${s.en}/${bp.name}`, ex = textSt.find(x => x.name === name), p = s.props(bp);
      if (!ex) { plan.add.push({ kind: "style de texte", name }); continue; }
      const cur = { fontName: ex.fontName || {}, fontSize: ex.fontSize, lineHeight: ex.lineHeight || {}, letterSpacing: ex.letterSpacing || {}, textCase: ex.textCase };
      if (lab(cur) !== lab(p)) plan.update.push({ kind: "style de texte", name, from: lab(cur), to: lab(p) });
      else if ((ex.description || "") !== p.description) plan.update.push({ kind: "style de texte", name, from: "description", to: "description de Lisio" });
      else plan.same++;
    }
  }
  // Grid and effect styles
  const gs = lisioGridSpecs(tokens), es = lisioEffectSpecs(tokens);
  if (gs.length) { const ex = await figma.getLocalGridStylesAsync(), lab = g => g ? `${g.count} colonnes, gouttière ${g.gutterSize} px, marge ${g.offset} px` : "vide";
    for (const g of gs) { const s = ex.find(x => x.name === g.name); if (!s) { plan.add.push({ kind: "style de grille", name: g.name }); continue; }
      const a = lab((s.layoutGrids || [])[0]), b = lab(g.layoutGrids[0]); if (a !== b) plan.update.push({ kind: "style de grille", name: g.name, from: a, to: b }); else plan.same++; } }
  if (es.length) { const ex = await figma.getLocalEffectStylesAsync(), sig = l => JSON.stringify((l || []).map(e => [e.type, e.color ? lisioToHex(e.color) + Math.round((e.color.a == null ? 1 : e.color.a) * 100) : "", e.offset ? [e.offset.x, e.offset.y] : "", e.radius, e.spread || 0]));
    const n = l => `${(l || []).length} effet${(l || []).length > 1 ? "s" : ""}`;
    for (const e of es) { const s = ex.find(x => x.name === e.name); if (!s) { plan.add.push({ kind: "style d’effet", name: e.name }); continue; }
      if (sig(s.effects) !== sig(e.effects)) plan.update.push({ kind: "style d’effet", name: e.name, from: n(s.effects), to: n(e.effects) + " de Lisio" }); else plan.same++; } }
  // Presentation board: a new one is always added; old ones are deleted only with consent
  if (opts.board !== false) {
    plan.add.push({ kind: "planche", name: "Planche de présentation (palette, rôles, typographie)" });
    figma.currentPage.children.filter(n => n.type === "FRAME" && LISIO_BOARDS.includes(n.name)).forEach(n => plan.remove.push({ kind: "planche", name: n.name, why: "ancienne planche Lisio de cette page" }));
  }
  if (opts.components) { const pg = figma.root.children.find(p => p.name === "Lisio components"); if (!(pg && pg.children.some(n => n.type === "COMPONENT_SET" && ["Button", "Field", "Alert"].includes(n.name)))) plan.add.push({ kind: "composants", name: "Bouton, Champ et Alerte, page « Lisio components »" }); }
  return plan;
}

async function lisioImport(data, opts) {
  opts = opts || {}; lisioCheck(data);
  const report = { variables: 0, created: 0, updated: 0, styles: 0, skipped: 0, warnings: [] };
  const kit = await lisioFontKit(), byFam = kit.byFam;
  const cols = await figma.variables.getLocalVariableCollectionsAsync(), allVars = await figma.variables.getLocalVariablesAsync(), fresh = new Set();
  const mayRename = col => fresh.has(col.id) || !!opts.allowRename;
  const getCol = name => { let c = cols.find(c => c.name === name); if (!c) { c = figma.variables.createVariableCollection(name); cols.push(c); fresh.add(c.id); if (name !== "Typography") c.renameMode(c.modes[0].modeId, "Default"); } return c; };
  const getVar = (col, name, type) => {
    let v = allVars.find(x => x.variableCollectionId === col.id && x.name === name);
    if (!v && /\/main$/.test(name)) { const b = allVars.find(x => x.variableCollectionId === col.id && x.name === name.replace(/main$/, "base"));
      if (b && opts.allowRename) { b.name = name; v = b; }
      else if (b) report.warnings.push(`${col.name}/${b.name} garde son nom : ${col.name}/${name} est créée à côté. Pour renommer, relancez l’import en acceptant les renommages.`); }
    if (v && v.resolvedType !== type) {
      if (!opts.allowDelete) { report.warnings.push(`${col.name}/${name} existe déjà avec un autre type (${v.resolvedType}) : laissée telle quelle, et non importée.`); report.skipped++; return null; }
      v.remove(); allVars.splice(allVars.indexOf(v), 1); v = null;
    }
    if (v) report.updated++; else { v = figma.variables.createVariable(name, col, type); allVars.push(v); report.created++; }
    return v;
  };
  // Typography collection: one mode per breakpoint. An existing first mode keeps its name unless renaming is allowed.
  const bpModes = (col, what) => {
    const out = {}, m0 = col.modes[0];
    if (!col.modes.some(m => m.name === LISIO_BP[0].name)) {
      if (mayRename(col)) col.renameMode(m0.modeId, LISIO_BP[0].name);
      else report.warnings.push(`${col.name} : le mode « ${m0.name} » garde son nom et reçoit les valeurs ${LISIO_BP[0].name}.`);
    }
    for (const bp of LISIO_BP) {
      let m = col.modes.find(m => m.name === bp.name) || (bp === LISIO_BP[0] ? col.modes[0] : null);
      if (!m) { try { col.addMode(bp.name); m = col.modes.find(m => m.name === bp.name); } catch (e) { report.warnings.push(`${col.name} : le mode « ${bp.name} » ne peut pas être ajouté (Figma : ${e.message}). ${what}`); } }
      if (m) out[bp.id] = m.modeId;
    }
    return out;
  };
  const cTypo = getCol("Typography"), modes = bpModes(cTypo, "Les valeurs par écran restent dans les styles de texte.");
  let cLay = null, layModes = {};
  const setAll = (v, col, val) => col.modes.forEach(m => v.setValueForMode(m.modeId, val));
  // 1. Variables: colors, semantic, dimensions, font families
  const tokens = lisioWalk(data, [], []).filter(t => t.path[0] !== "typography"), map = {}, famName = {};
  for (const t of tokens) {
    const tg = lisioVarTarget(t); if (!tg) continue;
    const perBp = tg.perBp;
    if (perBp && !cLay) { cLay = getCol("Layout"); layModes = bpModes(cLay, "Seule la valeur du premier écran est gardée."); }
    const col = perBp ? cLay : getCol(tg.colName), name = tg.name;
    const v = getVar(col, name, tg.type); if (!v) continue;
    v.scopes = t.ext.scopes || LISIO_SCOPES[t.path[0]] || ["ALL_SCOPES"];
    if (t.desc) v.description = t.desc;
    v.setVariableCodeSyntax("WEB", `var(--${t.path.join("-")})`);
    if (perBp) { v.scopes = t.path[1] === "columns" ? [] : ["GAP", "WIDTH_HEIGHT"]; LISIO_BP.forEach(bp => { const mid = layModes[bp.id], val = t.ext.breakpoints[bp.id]; if (mid && typeof val === "number") v.setValueForMode(mid, val); }); report.variables++; continue; }
    map[`{${t.path.join(".")}}`] = { v, t, col }; report.variables++;
  }
  for (const { v, t, col } of Object.values(map)) {
    const val = t.value;
    if (typeof val === "string" && val.startsWith("{")) { const ref = map[val]; if (ref) { setAll(v, col, figma.variables.createVariableAlias(ref.v)); continue; } report.warnings.push(`Alias introuvable : ${val}`); continue; }
    if (v.resolvedType === "COLOR") setAll(v, col, lisioHex(val));
    else if (v.resolvedType === "FLOAT") setAll(v, col, typeof val === "object" ? val.value : val);
    else if (t.type === "fontFamily") {
      const f = lisioFamily(val, byFam);
      if (f.missing && !report.warnings.includes(lisioFontMsg(f.missing))) report.warnings.push(lisioFontMsg(f.missing));
      famName[`{${t.path.join(".")}}`] = f.fam; setAll(v, col, f.fam);
    }
  }
  // 1c. Layout grids
  const gs = lisioGridSpecs(tokens);
  if (gs.length) {
    const ex = await figma.getLocalGridStylesAsync();
    for (const g of gs) { let st = ex.find(x => x.name === g.name); if (!st) { st = figma.createGridStyle(); st.name = g.name; } st.layoutGrids = g.layoutGrids; st.description = g.description; report.styles++; }
  }
  // 1d. Effect styles
  const efs = lisioEffectSpecs(tokens);
  if (efs.length) {
    const ex = await figma.getLocalEffectStylesAsync();
    for (const e of efs) { let st = ex.find(x => x.name === e.name); if (!st) { st = figma.createEffectStyle(); st.name = e.name; ex.push(st); } st.effects = e.effects; if (e.description) st.description = e.description; report.styles++; }
  }
  // 1b. Extra modes (semantic roles: Light and Dark). An existing "Default" mode keeps its name unless renaming is allowed.
  const modeId = (col, name) => {
    let m = col.modes.find(x => x.name === name);
    if (!m) { try { col.addMode(name); m = col.modes.find(x => x.name === name); } catch (e) { report.warnings.push(`${col.name} : le mode « ${name} » ne peut pas être ajouté (Figma : ${e.message}). Seules les valeurs claires (Light) sont importées.`); return null; } }
    return m.modeId;
  };
  const keptDefault = new Set();
  for (const { v, t, col } of Object.values(map)) {
    const md = t.ext.modes; if (!md || typeof md !== "object") continue;
    for (const [name, val] of Object.entries(md)) {
      if (col.modes[0].name === "Default") {
        if (mayRename(col)) col.renameMode(col.modes[0].modeId, "Light");
        else if (!keptDefault.has(col.id)) { keptDefault.add(col.id); report.warnings.push(`${col.name} : le mode « Default » garde son nom et porte les valeurs claires (Light).`); }
      }
      const id = modeId(col, lisioCap(name)); if (!id) continue;
      if (typeof val === "string" && val.startsWith("{")) { const ref = map[val]; if (ref) v.setValueForMode(id, figma.variables.createVariableAlias(ref.v)); else report.warnings.push(`Alias introuvable en mode ${name} : ${val}`); }
      else if (v.resolvedType === "COLOR" && typeof val === "string") v.setValueForMode(id, lisioHex(val));
    }
    if (t.ext.darkDescription) v.description = `${t.desc || ""}\nDark: ${t.ext.darkDescription}`;
  }
  // 2. Text styles: one per style and breakpoint ("H1/Mobile"), size and line height in px
  const styles = await figma.getLocalTextStylesAsync(), made = [];
  for (const sp of lisioTextSpecs(data, famName, kit)) {
    const { id, tok, t, ext, en, fl, bps } = sp, fontName = { family: sp.fam, style: sp.style };
    if (ext.italic && !/Italic/.test(sp.style)) report.warnings.push(`${en} : aucun style italique pour ${sp.fam}.`);
    await figma.loadFontAsync(fontName);
    const vSize = getVar(cTypo, `font-size/${id}`, "FLOAT"), vLh = getVar(cTypo, `line-height/${id}`, "FLOAT");
    if (vSize) { vSize.scopes = ["FONT_SIZE"]; report.variables++; } if (vLh) { vLh.scopes = ["LINE_HEIGHT"]; report.variables++; }
    if (vSize) vSize.setVariableCodeSyntax("WEB", `var(--font-size-${id})`); if (vLh) vLh.setVariableCodeSyntax("WEB", `var(--line-height-${id})`);
    if (fl && vSize) vSize.description = `${fl.clamp} (${fl.min} → ${fl.max} px, ${fl.viewportMin} → ${fl.viewportMax} px)`;
    for (const bp of bps) {
      const mid = modes[bp.id]; if (mid) { if (vSize) vSize.setValueForMode(mid, bp.fontSize); if (vLh) vLh.setValueForMode(mid, bp.lineHeight); }
      const name = `${en}/${bp.name}`, p = sp.props(bp);
      let s = styles.find(x => x.name === name);
      if (!s) { s = figma.createTextStyle(); styles.push(s); }
      s.name = name; s.fontName = fontName; s.fontSize = p.fontSize; s.lineHeight = p.lineHeight;
      s.letterSpacing = p.letterSpacing; s.textCase = p.textCase; s.description = p.description;
      try { const fv = map[t.fontFamily]; if (fv) s.setBoundVariable("fontFamily", fv.v); } catch (e) { report.warnings.push(`${name} : le style n’a pas pu être relié à sa variable de police (Figma : ${e.message}).`); }
      made.push({ id, en, bp: bp.id, s, ext }); report.styles++;
    }
  }
  if (opts.board !== false) report.board = await lisioBoards(data, map, made, cTypo, modes, famName, !!opts.allowDelete);
  return report;
}
function lisioAuto(dir, props) { const f = figma.createFrame(); f.layoutMode = dir; f.primaryAxisSizingMode = "AUTO"; f.counterAxisSizingMode = "AUTO"; f.fills = []; Object.assign(f, props); return f; }
async function lisioBoards(data, map, made, cTypo, modes, famName, allowDelete) {
  const UI = { family: "Inter", style: "Regular" }, UIB = { family: "Inter", style: "Bold" };
  await figma.loadFontAsync(UI); await figma.loadFontAsync(UIB);
  for (const m of made) await figma.loadFontAsync(m.s.fontName);
  // Old boards are deleted only with consent; otherwise the new board goes to the right of everything on the page.
  let x = 0, y = 0; const old = allowDelete ? figma.currentPage.children.filter(n => n.type === "FRAME" && LISIO_BOARDS.includes(n.name)) : [];
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
    txt("Couleurs par rôle", 36, false, sem);
    txt("Collection Semantic · chaque rôle pointe vers une nuance de la palette et donne son contraste WCAG", 14, false, sem, true);
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
  txt("Typographie fluide", 36, false, ty);
  txt(`H1 à H6 = plan du document (un seul H1 par page) · Display = style visuel · ${head} (titres) · ${body} (texte) · clamp() 390 → 1440 px`, 14, false, ty, true);
  const cards = lisioAuto("HORIZONTAL", { name: "Breakpoints", itemSpacing: 32 }); cards.counterAxisAlignItems = "MIN"; ty.appendChild(cards);
  const SAMPLE = { head: "Lisible sur chaque écran", body: "Un bon contraste et un rythme calme aident chacun à lire, sur tous les écrans.", label: "Design system", button: "Commencer" };
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
  txt("Valeurs clamp() · 390 → 1440 px", 20, false, ty);
  const W = [140, 110, 110, 110, 120, 360, 100], tbl = lisioAuto("VERTICAL", { name: "clamp() table", itemSpacing: 0 }); ty.appendChild(tbl);
  const trow = (cells, bold) => { const r = lisioAuto("HORIZONTAL", { itemSpacing: 0, paddingTop: 8, paddingBottom: 8 }); r.strokes = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 }, opacity: .08 }]; r.strokeBottomWeight = 1; r.strokeTopWeight = 0; r.strokeLeftWeight = 0; r.strokeRightWeight = 0; cells.forEach((c, i) => txt(c, 13, bold, r, false, W[i])); tbl.appendChild(r); };
  trow(["Style"].concat(LISIO_BP.map(b => `${b.name} ${b.width}`), ["CSS font-size", "Line height"]), true);
  for (const [id, tok] of Object.entries(data.typography)) { const ext = (tok.$extensions && tok.$extensions["app.lisio"]) || {}, fl = ext.fluid; if (!fl) continue; trow([ext.name || id].concat(fl.breakpoints.map(b => `${b.fontSize}/${b.lineHeight}`), [fl.clamp, String(tok.$value.lineHeight)])); }
  return ids.join(",");
}

// Audit: text contrast of an existing file (selection, or the whole current page)
// Luminance and ratio come from src/core/color.mjs (toLin, Yof, ratioLum): Figma gives channels from 0 to 1, not hex.
function lisioLum(c) { return Yof([c.r, c.g, c.b].map(toLin)); }
function lisioRatio(a, b) { return ratioLum(lisioLum(a), lisioLum(b)); }
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
      const large = largeText(s.fontSize, s.fontWeight), need = needRatio(aaa ? "AAA" : "AA", large), r = lisioRatio(c, bg.c);
      if (!worst || r / need < worst.r / worst.need) worst = { r, need, large, fg: lisioToHex(c), c, size: s.fontSize, fam: vid && varById[vid] ? varById[vid].name.split("/")[0] : null };
    }
    if (!worst) continue;
    const ok = worst.r >= worst.need;
    out.push({ id: t.id, name: t.name, text: t.characters.slice(0, 60), ratio: floor2(worst.r), need: worst.need, large: worst.large, size: worst.size, fg: worst.fg, bg: lisioToHex(bg.c), guess: bg.guess, ok, fix: ok ? null : lisioFix(worst.c, bg.c, worst.need, pal, worst.fam) });
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
figma.showUI(__html__, { width: 400, height: 600, themeColors: true, title: "Lisio : importer et vérifier" });
const lisioErr = e => figma.ui.postMessage({ type: "error", message: e && e.message ? e.message : String(e) });
let lisioLast = null;
async function lisioRunAudit(level) { lisioLast = await lisioAudit({ level }); figma.ui.postMessage({ type: "audit", result: lisioLast }); }
figma.ui.onmessage = async msg => {
  if (msg.type === "import") {
    try {
      const report = await lisioImport(msg.data, { board: msg.board, allowDelete: !!msg.allowDelete, allowRename: !!msg.allowRename });
      if (msg.components) { const c = await lisioComponents(); report.components = c.skipped ? "skipped" : c.components; }
      else if (report.board) { const n = await figma.getNodeByIdAsync(report.board); if (n) figma.viewport.scrollAndZoomIntoView([n]); }
      figma.notify(`Lisio : ${report.variables} variables et ${report.styles} styles de texte importés`);
      figma.ui.postMessage({ type: "done", report });
    } catch (e) { lisioErr(e); }
  }
  // Preview before any write: what the import would add, change, delete or rename (P0-6)
  if (msg.type === "plan") {
    try { figma.ui.postMessage({ type: "plan", plan: await lisioPlan(msg.data, { board: msg.board, components: msg.components }) }); } catch (e) { lisioErr(e); }
  }
  if (msg.type === "components") {
    try { const c = await lisioComponents(); figma.ui.postMessage({ type: "components", result: c }); } catch (e) { lisioErr(e); }
  }
  if (msg.type === "audit") { try { await lisioRunAudit(msg.level); } catch (e) { lisioErr(e); } }
  if (msg.type === "fix" || msg.type === "fixAll") {
    try {
      const items = (lisioLast ? lisioLast.items : []).filter(x => !x.ok && x.fix && (msg.type === "fixAll" || x.id === msg.id));
      let n = 0;
      for (const x of items) if (await lisioApplyFix(x.id, x.fix)) { n++; x.ok = true; x.fixed = x.fix.name; x.fg = x.fix.hex; x.ratio = floor2(lisioRatio(lisioHex(x.fix.hex), lisioHex(x.bg))); }
      lisioLast.fails = Math.max(0, lisioLast.fails - n); lisioLast.fixedNow = n;
      figma.notify(`Lisio : ${n} texte${n > 1 ? "s" : ""} corrigé${n > 1 ? "s" : ""}`);
      figma.ui.postMessage({ type: "audit", result: lisioLast });
    } catch (e) { lisioErr(e); }
  }
  if (msg.type === "select") {
    const n = await figma.getNodeByIdAsync(msg.id);
    if (n) { figma.currentPage.selection = [n]; figma.viewport.scrollAndZoomIntoView([n]); }
  }
};
