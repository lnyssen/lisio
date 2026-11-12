// Lisio, import d’un design system existant : variables CSS, configuration Tailwind, jetons JSON (DTCG, Tokens Studio,
// export de variables), ou simple liste « Nom #hex ». Fonctions pures, testées par tests/importds.test.mjs.
// Lisio garde au plus 12 couleurs : une par famille de nuances (la plus proche du 500), puis les couleurs seules.
import { normHex, rgb2hex, hexToOklch, oklchToLin, linToHex, clamp01 } from "./color.mjs";

const IMP_MAX = 12;
const impNum = s => { s = String(s).trim(); return s.endsWith("%") ? parseFloat(s) / 100 : parseFloat(s); };
function impHsl(h, s, l) {
  h = ((h % 360) + 360) % 360; const a = s * Math.min(l, 1 - l);
  const f = n => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return rgb2hex([f(0), f(8), f(4)]);
}
// Une valeur de couleur CSS ou JSON vers #RRGGBB (l’alpha est ignoré), ou null.
export function parseColor(v) {
  if (v && typeof v === "object") { // DTCG 2025 : { colorSpace, components, hex }
    if (typeof v.hex === "string") return parseColor(v.hex);
    if (v.colorSpace === "srgb" && Array.isArray(v.components)) return rgb2hex(v.components.map(Number));
    return null;
  }
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  let m = s.match(/^#([0-9a-f]{3,8})$/);
  if (m) { const h = m[1]; return h.length === 3 || h.length === 6 ? normHex(h) : h.length === 4 ? normHex(h.slice(0, 3)) : h.length === 8 ? normHex(h.slice(0, 6)) : null; }
  m = s.match(/^rgba?\(\s*([^)]*)\)$/);
  if (m) { const p = m[1].split(/[\s,\/]+/).filter(Boolean); if (p.length < 3) return null; return rgb2hex(p.slice(0, 3).map(x => x.endsWith("%") ? impNum(x) : impNum(x) / 255)); }
  m = s.match(/^hsla?\(\s*([^)]*)\)$/);
  if (m) { const p = m[1].split(/[\s,\/]+/).filter(Boolean); if (p.length < 3) return null; return impHsl(parseFloat(p[0]), impNum(p[1].endsWith("%") ? p[1] : p[1] + "%"), impNum(p[2].endsWith("%") ? p[2] : p[2] + "%")); }
  m = s.match(/^oklch\(\s*([^)]*)\)$/);
  if (m) { const p = m[1].split(/[\s,\/]+/).filter(Boolean); if (p.length < 3) return null; const L = impNum(p[0]), C = parseFloat(p[1]), h = parseFloat(p[2]) * Math.PI / 180; return linToHex(oklchToLin(L, C, h).map(clamp01)); }
  return null;
}

const IMP_STEP = /^(\d{2,3})$/;
// Chemin de jeton vers nom lisible et famille : ["color","brand","500"] → famille « brand », nuance 500.
function impShape(path) {
  const parts = path.map(String).flatMap(p => p.split(/[-_.\/]/)).filter(Boolean).filter(p => !/^(colou?rs?|palette|primitives?|base|global|default|value|\$value)$/i.test(p));
  if (!parts.length) return { name: path.join("-") || "Couleur", family: null, step: null };
  const last = parts[parts.length - 1];
  if (IMP_STEP.test(last) && parts.length > 1) { const fam = parts.slice(0, -1).join("-"); return { name: fam + " " + last, family: fam, step: +last }; }
  return { name: parts.join("-"), family: null, step: null };
}
const impCap = s => s.charAt(0).toUpperCase() + s.slice(1);

// Jetons JSON : DTCG ($value), Tokens Studio (value), ou objet simple { nom: "#hex" }.
function impJson(obj) {
  const flat = new Map(); // "a.b.c" → valeur brute
  const walk = (o, path) => {
    if (o === null || typeof o !== "object" || Array.isArray(o)) { if (path.length) flat.set(path.join("."), o); return; }
    if ("$value" in o || ("value" in o && (typeof o.value !== "object" || o.value === null || "hex" in o.value))) { flat.set(path.join("."), "$value" in o ? o.$value : o.value); return; }
    for (const k of Object.keys(o)) if (!k.startsWith("$")) walk(o[k], [...path, k]);
  };
  walk(obj, []);
  const resolve = (v, seen = 0) => { const m = typeof v === "string" && v.match(/^\{([^}]+)\}$/); if (!m || seen > 8) return v; return flat.has(m[1]) ? resolve(flat.get(m[1]), seen + 1) : null; };
  const out = []; let alias = 0, bad = 0;
  for (const [k, v] of flat) {
    if (typeof v === "string" && /^\{[^}]+\}$/.test(v)) { alias++; continue; } // un alias pointe vers une couleur déjà comptée
    const hex = parseColor(resolve(v)); if (hex) out.push({ path: k.split("."), hex }); else if (typeof v === "string" && /^(#|rgb|hsl|oklch)/i.test(v.trim())) bad++;
  }
  return { entries: out, alias, bad };
}
// Variables CSS, y compris le bloc @theme de Tailwind 4.
function impCss(text) {
  const vars = new Map(); const re = /--([\w-]+)\s*:\s*([^;}]+)[;}]/g; let m;
  while ((m = re.exec(text))) if (!vars.has(m[1])) vars.set(m[1], m[2].trim());
  const out = []; let alias = 0, bad = 0;
  for (const [k, v] of vars) {
    if (/^var\(/.test(v)) { alias++; continue; }
    const hex = parseColor(v); if (hex) out.push({ path: k.replace(/^colou?r-/, "").split("-"), hex }); else if (/^(#|rgb|hsl|oklch)/i.test(v)) bad++;
  }
  return { entries: out, alias, bad };
}
// Configuration Tailwind 3 (JS) : lecture tolérante des clés et des chaînes, sans exécuter le code.
function impTailwind(text) {
  const body = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const stack = [], out = []; let bad = 0;
  const re = /(?:(["']?)([\w-]+)\1\s*:\s*(\{|["'`]([^"'`]*)["'`]))|(\{)|(\})/g; let m;
  while ((m = re.exec(body))) {
    if (m[6]) { stack.pop(); continue; }
    if (m[5]) { stack.push(null); continue; }
    if (m[3] === "{") { stack.push(m[2]); continue; }
    const path = [...stack.filter(Boolean), m[2]]; const hex = parseColor(m[4]);
    if (hex) out.push({ path: m[2] === "DEFAULT" ? path.slice(0, -1) : path, hex }); else if (/^(#|rgb|hsl|oklch)/i.test(m[4].trim())) bad++;
  }
  // Seulement ce qui vit sous « colors » quand la clé existe (évite les couleurs d’ombres ou de plugins).
  const inColors = out.filter(e => e.path.includes("colors"));
  return { entries: (inColors.length ? inColors : out).map(e => ({ ...e, path: e.path.slice(e.path.lastIndexOf("colors") + 1) })), alias: 0, bad };
}
function impList(text) {
  const out = [];
  text.split(/\n|;/).forEach(line => {
    const m = line.match(/#?\b([0-9a-f]{6}|[0-9a-f]{3})\b/i); if (!m) return;
    const hex = normHex(m[1]); if (!hex) return;
    const name = line.replace(m[0], "").replace(/[:=,–-]+\s*$/, "").trim();
    out.push({ path: name ? [name] : [], hex, plain: true });
  });
  return { entries: out, alias: 0, bad: 0 };
}

export function detectFormat(text) {
  const t = String(text).trim();
  if (/^[\[{]/.test(t)) { try { JSON.parse(t); return "json"; } catch { /* pas du JSON */ } }
  if (/(module\.exports|export\s+default|theme\s*:|colors\s*:)/.test(t) && !/--[\w-]+\s*:/.test(t)) return "tailwind";
  if (/--[\w-]+\s*:/.test(t)) return "css";
  return "liste";
}
export const FORMAT_LABEL = { json: "jetons JSON", tailwind: "configuration Tailwind", css: "variables CSS", liste: "liste de couleurs" };

// Analyse complète : ce que Lisio a trouvé, ce qu’il garde et pourquoi.
export function analyzeImport(text) {
  const format = detectFormat(text);
  const raw = format === "json" ? impJson(JSON.parse(String(text).trim())) : format === "css" ? impCss(text) : format === "tailwind" ? impTailwind(text) : impList(text);
  const found = raw.entries.map((e, i) => { const s = e.plain ? { name: e.path[0] || "", family: null, step: null } : impShape(e.path); return { ...s, hex: e.hex, i }; });
  // Doublons exacts : on garde la première occurrence.
  const seen = new Set(), uniq = []; let dup = 0;
  for (const f of found) { if (seen.has(f.hex)) { dup++; continue; } seen.add(f.hex); uniq.push(f); }
  // Une couleur par famille : la nuance la plus proche de 500.
  const fams = new Map();
  for (const f of uniq) if (f.family) (fams.get(f.family) || fams.set(f.family, []).get(f.family)).push(f);
  const keep = [], dropped = [];
  const famKept = new Set();
  for (const f of uniq) {
    if (!f.family || fams.get(f.family).length < 3) { keep.push(f); continue; }
    if (famKept.has(f.family)) continue;
    famKept.add(f.family);
    const list = fams.get(f.family), best = list.reduce((a, b) => Math.abs(b.step - 500) < Math.abs(a.step - 500) ? b : a);
    keep.push({ ...best, name: best.family, fromFamily: list.length });
    list.forEach(x => { if (x !== best) dropped.push({ ...x, why: "nuance" }); });
  }
  const over = keep.slice(IMP_MAX); over.forEach(x => dropped.push({ ...x, why: "max" }));
  const used = new Set();
  const colors = keep.slice(0, IMP_MAX).map((f, k) => {
    let name = impCap((f.name || "Couleur " + (k + 1)).replace(/-/g, " ")).slice(0, 30), base = name, n = 2;
    while (used.has(name)) name = base + " " + n++;
    used.add(name); return { name, hex: f.hex, ...(f.fromFamily ? { family: f.fromFamily } : {}) };
  });
  // Couleurs presque identiques (écart OKLCH < 0,02) : à fusionner, une seule suffit souvent.
  const close = [];
  for (let a = 0; a < colors.length; a++) for (let b = a + 1; b < colors.length; b++) {
    const A = hexToOklch(colors[a].hex), B = hexToOklch(colors[b].hex);
    const d = Math.hypot(A.L - B.L, A.C * Math.cos(A.h) - B.C * Math.cos(B.h), A.C * Math.sin(A.h) - B.C * Math.sin(B.h));
    if (d < 0.02) close.push([colors[a].name, colors[b].name]);
  }
  return { format, found: found.length, duplicates: dup, aliases: raw.alias, unreadable: raw.bad, families: famKept.size, colors, dropped, close };
}
