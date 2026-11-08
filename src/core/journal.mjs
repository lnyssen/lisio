// Lisio, versions du projet et journal des décisions et exceptions (blueprint § 8 et § 9, P2.4). Données pures, testées par tests/journal.test.mjs.
// Une exception doit dire : problème, raison, contexte, décisionnaire ou rôle, date, et éventuellement une date de révision (blueprint § 8).
// Une version est une copie du projet (couleurs et réglages) : elle ne contient ni les autres versions ni le journal.
import { settingFr } from "./project.mjs";
export const DEC_KINDS = { decision: "Décision", exception: "Exception" };
export const DEC_FIELDS = [["problem", "Problème ou sujet"], ["reason", "Raison"], ["context", "Contexte"], ["role", "Décidé par (rôle)"], ["date", "Date de la décision"], ["review", "À revoir le"]];
const DEC_NEED = { decision: ["problem", "reason", "role", "date"], exception: ["problem", "reason", "context", "role", "date"] };
export const DEC_MAX = 50, VER_MAX = 20, DEC_TXT_MAX = 500, VER_NAME_MAX = 60, VER_NOTE_MAX = 300;
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
// AAAA-MM-JJ, et une vraie date du calendrier (pas de 30 février).
const isDay = s => { if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false; const [y, m, d] = s.split("-").map(Number), t = new Date(Date.UTC(y, m - 1, d)); return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d; };
export const dateFr = s => { if (!isDay(String(s))) return String(s || ""); const [y, m, d] = s.split("-").map(Number); return `${d === 1 ? "1er" : d} ${MONTHS[m - 1]} ${y}`; };
const txt = (v, max) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, max);
// Vérifie et nettoie une entrée. missing : les champs à corriger, dans l'ordre du formulaire.
export function decCheck(e) {
  const kind = e && e.kind, entry = { kind };
  if (!DEC_NEED[kind]) return { ok: false, missing: ["kind"], errors: ["Choisissez : décision ou exception."], entry };
  for (const [k] of DEC_FIELDS) entry[k] = txt(e[k], k === "date" || k === "review" ? 10 : DEC_TXT_MAX);
  if (e.id) entry.id = txt(e.id, 40);
  const missing = [], errors = [], lab = k => DEC_FIELDS.find(f => f[0] === k)[1];
  for (const [k] of DEC_FIELDS) {
    const v = entry[k];
    if (k === "date") { if (!isDay(v)) { missing.push(k); errors.push(`${lab(k)} : une date réelle est demandée.`); } continue; }
    if (k === "review") { if (v && (!isDay(v) || (isDay(entry.date) && v < entry.date))) { missing.push(k); errors.push(`${lab(k)} : une date réelle, après la date de la décision.`); } continue; }
    if (DEC_NEED[kind].includes(k) && !v) { missing.push(k); errors.push(`${lab(k)} : à remplir pour une ${DEC_KINDS[kind].toLowerCase()}.`); }
  }
  return { ok: !missing.length, missing, errors, entry };
}
export const decDue = (e, today) => !!(e && e.review && isDay(e.review) && e.review <= today);
// Une ligne lisible, pour le rapport et pour copier.
export function decLine(e, today) {
  const p = [`${DEC_KINDS[e.kind] || "Décision"} : ${e.problem}.`, `Raison : ${e.reason}.`];
  if (e.context) p.push(`Contexte : ${e.context}.`);
  p.push(`Décidé par : ${e.role}, le ${dateFr(e.date)}.`);
  if (e.review) p.push(`Révision prévue le ${dateFr(e.review)}${decDue(e, today) ? " : à revoir maintenant" : ""}.`);
  return p.join(" ");
}
const deepCopy = v => JSON.parse(JSON.stringify(v));
export function verSnapshot({ id, name, note, date, colors, state }) {
  const st = deepCopy(state || {}); delete st.versions; delete st.decisions;
  return { id: String(id), name: txt(name, VER_NAME_MAX), note: txt(note, VER_NOTE_MAX), date: String(date), colors: deepCopy(colors || []), state: st };
}
// Réglages d'affichage : ils ne changent pas le design system, la comparaison les ignore.
const VIEW_KEYS = new Set(["versions", "decisions", "projectName", "figma", "sheet", "showFail", "mView", "mSample", "mVision", "sysTheme", "sysVision", "sysSpacing", "sysPg", "sysGrid", "demo"]);
function flat(o, path, out) {
  for (const k of Object.keys(o || {})) {
    if (!path && VIEW_KEYS.has(k)) continue;
    const v = o[k], p = path ? path + "." + k : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flat(v, p, out); else out[p] = JSON.stringify(v);
  }
  return out;
}
// a : la version, b : maintenant. Couleurs par nom ; réglages nommés comme dans l'interface, sans doublon.
export function verDiff(a, b) {
  const A = new Map((a.colors || []).map(c => [c.name, c.hex])), B = new Map((b.colors || []).map(c => [c.name, c.hex]));
  const colors = { changed: [], added: [], removed: [] };
  for (const [n, h] of B) { if (!A.has(n)) colors.added.push(n); else if (A.get(n) !== h) colors.changed.push([n, A.get(n), h]); }
  for (const n of A.keys()) if (!B.has(n)) colors.removed.push(n);
  const fa = flat(a.state, "", {}), fb = flat(b.state, "", {}), settings = [];
  for (const p of [...new Set([...Object.keys(fa), ...Object.keys(fb)])]) if (fa[p] !== fb[p]) { const l = settingFr(p.replace(/\.\d+(?=\.|$)/g, "[]")); if (!settings.includes(l)) settings.push(l); }
  return { colors, settings, same: !colors.changed.length && !colors.added.length && !colors.removed.length && !settings.length };
}
