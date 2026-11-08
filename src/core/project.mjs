// Lisio, cœur projet : vérification d'un projet reçu (fichier ou lien) avant de l'enregistrer.
// Fonctions pures, sans DOM ni état. Testées par tests/project.test.mjs.
// Règle : rien n'est accepté en silence. Un défaut grave refuse tout ; un réglage illisible
// reprend sa valeur par défaut et le dit (notes).
import { normHex } from "./color.mjs";
export const PRJ_VERSION = 1;
// Longueur maximale d'un lien de partage : RFC 9110, § 4.1, recommande de supporter au moins 8 000 octets.
export const LINK_MAX = 8000;
export const IMPORT_MAX = 2000000;
export const COLORS_MAX = 12;
const STR_MAX = 5000, DEPTH_MAX = 12, BAD_KEYS = new Set(["__proto__", "constructor", "prototype"]);
export const PRJ_REASONS = {
  "not-project": "Ce n’est pas un projet Lisio.",
  "figma-export": "C’est un export pour Figma, pas un projet Lisio.",
  "newer": "Ce projet vient d’une version plus récente de Lisio : rechargez la page (Ctrl ou ⌘ + Maj + R), puis réessayez.",
  "bad-version": "Numéro de version illisible : le projet a sans doute été modifié à la main. Rien n’a été importé.",
  "bad-color": "Une couleur au moins est illisible. Rien n’a été importé.",
  "too-many-colors": `Plus de ${COLORS_MAX} couleurs : Lisio en gère ${COLORS_MAX} au maximum. Rien n’a été importé.`,
  "bad-state": "Réglages illisibles. Rien n’a été importé.",
  "too-big": "Trop lourd pour un projet Lisio (plus de 2 Mo). Rien n’a été importé."
};
// Noms des réglages tels que l'interface les montre. Une note d'import ne cite jamais un nom technique (P0-3).
export const SETTING_FR = {
  font: "Police", "font.src": "Police", "font.family": "Police", size: "Taille du texte", weight: "Graisse", lh: "Interligne", ls: "Espacement des lettres",
  measure: "Longueur de ligne", align: "Alignement", fg: "Couleur du texte", bg: "Couleur du fond", version: "Version WCAG", level: "Niveau WCAG",
  sheet: "Affichage", showFail: "Affichage de la matrice", mView: "Affichage de la matrice", mSample: "Affichage de la matrice", mVision: "Affichage de la matrice",
  projectName: "Nom du projet", figma: "Lien Figma", ts: "Styles de texte", "ts.d.base": "Styles de texte, taille de base desktop", "ts.m.base": "Styles de texte, taille de base mobile",
  "ts.styles[].min": "Styles de texte, taille mobile", "ts.styles[].max": "Styles de texte, taille desktop", "ts.styles[].lh": "Styles de texte, interligne",
  "ts.styles[].ls": "Styles de texte, espacement des lettres", "ts.styles[].weight": "Styles de texte, graisse", ds: "Design system",
  sh: "Nuances", "sh.light": "Nuances, nuance 50", "sh.dark": "Nuances, nuance 950", "sh.sat": "Nuances, saturation", "sh.exact": "Nuances, couleur exacte", "sh.method": "Nuances, méthode",
  "ds.elevI": "Design system, intensité des ombres", "ds.elevB": "Design system, flou des ombres", "ds.elevY": "Design system, hauteur des ombres",
  "ds.glassBlur": "Design system, flou du verre", "ds.scrimPlus": "Design system, voile", "ds.scrimBlur": "Design system, flou sous le voile", decor: "Couleurs laissées pour le décor",
  manual: "Vérifications à la main", decisions: "Décisions et exceptions", versions: "Versions du projet"
};
// Nom d'un chemin : le plus précis connu, sinon le premier niveau, sinon « Un réglage ».
export const settingFr = path => { const parts = String(path || "").split("."); for (let i = parts.length; i > 0; i--) { const k = parts.slice(0, i).join("."); if (SETTING_FR[k]) return SETTING_FR[k]; } return "Un réglage"; };
// Bornes des réglages chiffrés, celles des curseurs et des champs de l'interface. Hors bornes : ramené à la borne, et dit.
export const LIMITS = {
  size: [10, 72, " px"], weight: [100, 1000, ""], lh: [1, 2.2, ""], ls: [-0.05, 0.2, " em"], measure: [30, 120, " caractères"],
  "ts.d.base": [10, 32, " px"], "ts.m.base": [8, 32, " px"], "ts.styles[].min": [8, 200, " px"], "ts.styles[].max": [8, 200, " px"],
  "ts.styles[].lh": [0.8, 3, ""], "ts.styles[].ls": [-10, 20, " %"], "ts.styles[].weight": [100, 1000, ""],
  "sh.light": [1.03, 1.12, ":1"], "sh.dark": [15, 19.5, ":1"], "sh.sat": [0.5, 1.4, ""],
  "ds.elevI": [0.5, 2.5, ""], "ds.elevB": [0.5, 2, ""], "ds.elevY": [0.5, 2, ""], "ds.glassBlur": [0, 24, " px"], "ds.scrimPlus": [0, 0.3, ""], "ds.scrimBlur": [0, 16, " px"]
};
const numFr = n => String(n).replace(".", ",");
function bound(state, notes) {
  for (const [path, [lo, hi, unit]] of Object.entries(LIMITS)) {
    const [head, tail] = path.split("[].");
    const get = (o, p) => p.split(".").reduce((a, k) => (a && typeof a === "object" ? a[k] : undefined), o);
    const holders = tail ? (Array.isArray(get(state, head)) ? get(state, head) : []).map(o => [o, tail]) : [[state, path]];
    for (const [o, p] of holders) {
      const ks = p.split("."), last = ks.pop(), box = ks.reduce((a, k) => (a && typeof a === "object" ? a[k] : undefined), o);
      if (!box || typeof box !== "object" || typeof box[last] !== "number") continue;
      const v = box[last], c = Math.min(hi, Math.max(lo, v));
      if (c !== v) { box[last] = c; notes.push(`${settingFr(path)} hors limites (${numFr(v)}${unit}) : valeur ramenée à ${numFr(c)}${unit}.`); }
    }
  }
}
const isObj = v => v !== null && typeof v === "object" && !Array.isArray(v);
const copyOf = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
export const figmaUrlOk = u => { try { const x = new URL(u); return x.protocol === "https:" && /(^|\.)figma\.com$/.test(x.hostname); } catch (e) { return false; } };
// Copie propre d'une valeur de forme inconnue : clés dangereuses retirées, textes coupés, profondeur bornée.
function clean(v, depth) {
  if (depth > DEPTH_MAX) return undefined;
  if (typeof v === "string") return v.length > STR_MAX ? v.slice(0, STR_MAX) : v;
  if (Array.isArray(v)) return v.map(x => clean(x, depth + 1)).filter(x => x !== undefined);
  if (isObj(v)) { const o = {}; for (const k of Object.keys(v)) { if (BAD_KEYS.has(k)) continue; const x = clean(v[k], depth + 1); if (x !== undefined) o[k] = x; } return o; }
  return typeof v === "number" || typeof v === "boolean" || v === null ? v : undefined;
}
// Rend value conforme au modèle tpl : même type à chaque clé connue, sinon valeur du modèle et une note.
// Les clés absentes du modèle sont gardées (nettoyées) : ce sont des réglages plus récents que le modèle.
export function conform(value, tpl, path, notes, depth = 0) {
  const bad = () => { notes.push(`${path ? settingFr(path.replace(/\[\]/g, "[]")) : "Réglages"} : valeur illisible, valeur par défaut reprise.`); return copyOf(tpl); };
  if (tpl === undefined || tpl === null) return clean(value, depth);
  if (Array.isArray(tpl)) {
    if (!Array.isArray(value)) return bad();
    if (!tpl.length) return clean(value, depth);
    const t0 = tpl[0], kind = x => Array.isArray(x) ? "array" : x === null ? "null" : typeof x;
    if (!value.every(x => kind(x) === kind(t0))) return bad();
    const sub = []; const out = value.map(x => conform(x, t0, path + "[]", sub, depth + 1));
    if (sub.length) return bad();
    return out;
  }
  if (isObj(tpl)) {
    if (!isObj(value)) return bad();
    const o = {};
    for (const k of Object.keys(value)) { if (BAD_KEYS.has(k)) continue; const x = conform(value[k], tpl[k], path ? path + "." + k : k, notes, depth + 1); if (x !== undefined) o[k] = x; }
    return o;
  }
  if (typeof value !== typeof tpl) return bad();
  return typeof value === "string" && value.length > STR_MAX ? value.slice(0, STR_MAX) : value;
}
// Évolution du format (F05) : quand PRJ_VERSION passera à 2, ajouter ici MIGRATIONS[1] = o => ({ ...o, v: 2, … }).
// Chaque étape fait passer d'une version à la suivante ; un lien ancien remonte ainsi jusqu'à la version courante.
// tests/golden/partage-v1.txt (un vrai lien v1) doit rester lisible : tests/project.test.mjs le vérifie.
export const MIGRATIONS = {};
export function migrateProject(o) {
  let x = JSON.parse(JSON.stringify(o));
  while (Number.isInteger(x.v) && x.v < PRJ_VERSION && MIGRATIONS[x.v]) x = MIGRATIONS[x.v](x);
  return x;
}
// o : objet lu (JSON). tpl : état par défaut de Lisio. enums : valeurs permises pour certaines clés.
export function checkProject(o, tpl, enums = {}) {
  const no = reason => ({ ok: false, reason, notes: [] }), notes = [];
  if (!isObj(o)) return no("not-project");
  if (o.lisio !== "project") return no(o.color && o.typography ? "figma-export" : "not-project");
  if (!("v" in o)) notes.push("Projet sans numéro de version : lu comme version 1.");
  else if (!Number.isInteger(o.v) || o.v < 1) return no("bad-version");
  else if (o.v > PRJ_VERSION) return no("newer");
  else if (o.v < PRJ_VERSION) { o = migrateProject(o); if (o.v !== PRJ_VERSION) return no("bad-version"); }
  if (!Array.isArray(o.colors)) return no("bad-color");
  if (o.colors.length > COLORS_MAX) return no("too-many-colors");
  if (!o.colors.every(c => isObj(c) && normHex(c.hex))) return no("bad-color");
  if (!isObj(o.state)) return no("bad-state");
  const colors = o.colors.map(c => ({ name: (c.name == null || c.name === "" ? "Couleur" : String(c.name)).slice(0, 40), hex: normHex(c.hex) }));
  const state = conform(o.state, tpl, "", notes);
  for (const [k, list] of Object.entries(enums)) if (k in state && !list.includes(state[k])) { notes.push(`${settingFr(k)} inconnu (${String(state[k]).slice(0, 20)}) : ${tpl[k]} repris.`); state[k] = tpl[k]; }
  bound(state, notes);
  if ("figma" in state && !(typeof state.figma === "string" && figmaUrlOk(state.figma))) { delete state.figma; notes.push("Lien Figma retiré : seuls les liens https vers figma.com sont gardés."); }
  const raw = typeof o.name === "string" && o.name.trim() ? o.name : typeof state.projectName === "string" ? state.projectName : "";
  return { ok: true, notes, project: { name: raw.trim().slice(0, 80), savedAt: typeof o.savedAt === "string" ? o.savedAt.slice(0, 40) : "", colors, state } };
}
