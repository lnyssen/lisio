// Lisio, rapport de validation (F11) : Markdown et JSON, à partir d'un modèle construit par la page.
// Fonctions pures. Testées par tests/report.test.mjs.
// Règles : jamais d'affirmation de conformité du produit ; ce qui n'est pas testé reste visible ;
// même modèle, même texte (rapport reproductible pour une version de Lisio et une empreinte de projet).
import { STATUS, statusTxt } from "./status.mjs";
export const REPORT_SCHEMA = "lisio-report";
export const REPORT_V = 1;
// Empreinte FNV-1a 32 bits : deux projets aux mêmes réglages ont la même empreinte.
export function fingerprint(text) {
  let h = 0x811c9dc5;
  for (const ch of String(text)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, "0");
}
const mdCell = v => String(v == null ? "" : v).replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ").trim();
const mdRow = a => "| " + a.map(mdCell).join(" | ") + " |";
const mdTable = (head, rows) => [mdRow(head), mdRow(head.map(() => "---")), ...rows.map(mdRow)].join("\n");
const mdList = a => a.map(x => "- " + mdCell(x)).join("\n");
export const STATUS_HELP = {
  pass: "le test a été fait et il passe.",
  fail: "le test a été fait et il ne passe pas.",
  manual: "Lisio ne peut pas trancher seul : une personne doit regarder.",
  untested: "le test n’a pas été fait. Ce n’est pas un échec.",
  na: "le critère ne s’applique pas ici."
};
export function reportMarkdown(m) {
  const out = [];
  out.push("# Rapport de validation : " + mdCell(m.project), "");
  out.push(mdList(["Projet : " + m.project, "Date : " + m.date, "Version de Lisio : " + m.lisio, "Empreinte du projet : " + m.fingerprint + " (mêmes réglages, même empreinte)", "Référence : WCAG " + m.wcag + ", niveau " + m.level]), "");
  out.push("## Périmètre", "", m.scope, "");
  out.push("## Statuts utilisés", "", mdList(Object.keys(STATUS).map(k => statusTxt(k) + " : " + STATUS_HELP[k])), "");
  out.push("## Synthèse", "", mdList(m.counts.map(([label, ok, total]) => `${ok} sur ${total} : ${label}`)), "");
  out.push("## Critères vérifiés et résultats", "", mdTable(["Critère", "Niveau", "Ce qui a été testé", "Statut", "Remarque"], m.criteria.map(c => [c.id || "–", c.level || "–", c.what, statusTxt(c.status), c.note || ""])), "");
  for (const [mode, rows] of m.roles) out.push("## Rôles, " + mode, "", mdTable(["Rôle", "Couleur", "Vérifié avec", "Ratio", "Seuil", "Statut"], rows.map(r => [r.role, r.color, r.pair || "–", r.ratio || "–", r.need || "–", statusTxt(r.status) + (r.note ? " (" + r.note + ")" : "")])), "");
  out.push("## Styles de texte", "", mdTable(["Style", "Taille (mobile → desktop)", "Ratio", "Seuil", "Statut"], m.styles.map(s => [s.name, s.size, s.ratio, s.need, statusTxt(s.status)])), "");
  out.push("## Contrôles manuels requis", "", "Cochés par l’équipe, écran par écran. « " + STATUS.untested.word + " » veut dire « pas encore vérifié », pas « en échec ».", "",
    mdTable(["Point", "Critère", ...m.manual.screens], m.manual.items.map(i => [i.title, i.crit, ...i.results.map(statusTxt)])), "");
  out.push("## Points non testés", "", mdList(m.untested), "");
  out.push("## Exceptions", "", mdList(m.exceptions.length ? m.exceptions : ["Aucune exception utilisée dans ce projet."]), "");
  out.push("## Méthodologie et version WCAG", "", mdList(m.method), "");
  out.push("## Limites du rapport", "", mdList(m.limits), "");
  return out.join("\n");
}
export function reportJson(m) {
  return { schema: REPORT_SCHEMA, v: REPORT_V, statuses: Object.fromEntries(Object.entries(STATUS).map(([k, s]) => [k, s.word])), ...JSON.parse(JSON.stringify(m)) };
}
