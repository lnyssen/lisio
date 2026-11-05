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
  const bad = () => { notes.push(`Réglage « ${path || "état"} » illisible : valeur par défaut reprise.`); return copyOf(tpl); };
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
// o : objet lu (JSON). tpl : état par défaut de Lisio. enums : valeurs permises pour certaines clés.
export function checkProject(o, tpl, enums = {}) {
  const no = reason => ({ ok: false, reason, notes: [] }), notes = [];
  if (!isObj(o)) return no("not-project");
  if (o.lisio !== "project") return no(o.color && o.typography ? "figma-export" : "not-project");
  if (!("v" in o)) notes.push("Projet sans numéro de version : lu comme version 1.");
  else if (!Number.isInteger(o.v) || o.v < 1) return no("bad-version");
  else if (o.v > PRJ_VERSION) return no("newer");
  if (!Array.isArray(o.colors)) return no("bad-color");
  if (o.colors.length > COLORS_MAX) return no("too-many-colors");
  if (!o.colors.every(c => isObj(c) && normHex(c.hex))) return no("bad-color");
  if (!isObj(o.state)) return no("bad-state");
  const colors = o.colors.map(c => ({ name: (c.name == null || c.name === "" ? "Couleur" : String(c.name)).slice(0, 40), hex: normHex(c.hex) }));
  const state = conform(o.state, tpl, "", notes);
  for (const [k, list] of Object.entries(enums)) if (k in state && !list.includes(state[k])) { notes.push(`Réglage « ${k} » inconnu (${String(state[k]).slice(0, 20)}) : ${tpl[k]} repris.`); state[k] = tpl[k]; }
  if ("figma" in state && !(typeof state.figma === "string" && figmaUrlOk(state.figma))) { delete state.figma; notes.push("Lien Figma retiré : seuls les liens https vers figma.com sont gardés."); }
  const raw = typeof o.name === "string" && o.name.trim() ? o.name : typeof state.projectName === "string" ? state.projectName : "";
  return { ok: true, notes, project: { name: raw.trim().slice(0, 80), savedAt: typeof o.savedAt === "string" ? o.savedAt.slice(0, 40) : "", colors, state } };
}
