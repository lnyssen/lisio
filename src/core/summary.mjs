// Lisio, cœur du résumé permanent du projet (blueprint v2, F02).
// Fonction pure : reçoit des chiffres déjà mesurés dans la page, rend des lignes et des compteurs.
// Testée par tests/summary.test.mjs. Inliné dans la page par src/build.py (le mot export est retiré).
// Règles : la progression dit la configuration, pas la conformité ; « non testé » n'est jamais un échec ;
// chaque état a un mot et un signe, jamais la seule couleur.
import { STATUS } from "./status.mjs";
// Les mots des cinq statuts du blueprint (src/core/status.mjs) : ok = conforme au test, check = à vérifier manuellement.
export const SUM_STATUS = { ok: STATUS.pass, fail: STATUS.fail, check: STATUS.manual, untested: STATUS.untested };
const pl = (n, one, many) => `${n} ${n > 1 ? many : one}`;

// d : { level, colors, colorTokens, loneColors, twins, rolesChecked, roleFails, fonts: [titres, texte], styles, styleFails,
//       styleWarns, blocksOn, blocksAll, manualDone, manualAll, screens, stepsDone, stepsAll }
export function projectSummary(d) {
  const rows = [];
  const add = (id, label, value, status, href, note = "") => rows.push({ id, label, value, status, href, note });
  const colorIssues = d.loneColors + d.twins;
  add("colors", "Couleurs", `${pl(d.colors, "couleur", "couleurs")}, ${pl(d.colorTokens, "jeton de couleur", "jetons de couleur")}`,
    colorIssues ? "check" : "info", "#couleurs",
    colorIssues ? [d.loneColors ? `${pl(d.loneColors, "couleur lisible avec aucune autre", "couleurs lisibles avec aucune autre")}` : "", d.twins ? `${pl(d.twins, "paire presque jumelle", "paires presque jumelles")}` : ""].filter(Boolean).join(", ") : "");
  add("roles", "Contrastes des rôles", d.roleFails ? `${d.roleFails} sur ${d.rolesChecked} sous le seuil ${d.level}` : `${d.rolesChecked} paires de rôles au seuil ${d.level} ou au-dessus`,
    d.roleFails ? "fail" : "ok", "#systeme", "Modes clair et sombre.");
  const fonts = [...new Set(d.fonts.filter(Boolean))].join(" et ");
  add("type", "Typographie", `${fonts ? fonts + ", " : ""}${pl(d.styles, "style", "styles")}${d.styleFails ? `, ${d.styleFails} sous le seuil ${d.level}` : ""}`,
    d.styleFails ? "fail" : "ok", "#styles");
  if (d.styleWarns) add("comfort", "Confort de lecture", pl(d.styleWarns, "conseil sur les styles de texte", "conseils sur les styles de texte"), "check", "#styles", "Des conseils, pas des erreurs.");
  add("blocks", "Design system", `${d.blocksOn} blocs sur ${d.blocksAll} inclus dans l’export`, "info", "#systeme");
  const autoAll = d.rolesChecked + d.styles, autoOk = autoAll - d.roleFails - d.styleFails;
  add("auto", "Contrôles automatiques", `${autoOk} conformes au test sur ${autoAll}`, autoOk === autoAll ? "ok" : "fail", "#exporter", "Contrastes des rôles et des styles : une partie des critères WCAG seulement.");
  const left = d.manualAll - d.manualDone;
  add("manual", "Vérifications à la main", left ? `${left} sur ${d.manualAll} pas encore vérifiés` : `${d.manualAll} points cochés par l’équipe`,
    left ? "untested" : "ok", "#exporter", `${pl(d.screens, "écran", "écrans")}. Une case vide veut dire « pas encore vérifié », pas « en échec ».`);
  // Audit UX du 11 novembre 2026, P0 : un seul compteur, les étapes validées par l’équipe (src/core/steps.mjs), plus « Configuration ».
  add("progress", "Étapes validées", `${d.stepsDone} ${d.stepsDone > 1 ? "étapes" : "étape"} sur ${d.stepsAll} ${d.stepsDone > 1 ? "validées" : "validée"}`, "info", "#couleurs",
    "Validées par vous, une à une. C’est l’avancement, pas la conformité.");
  const counts = { fail: d.roleFails + d.styleFails, check: (d.styleWarns || 0) + colorIssues, untested: left };
  const line = [{ status: "info", text: `${d.stepsDone}/${d.stepsAll} ${d.stepsDone > 1 ? "validées" : "validée"}` }];
  if (counts.fail) line.push({ status: "fail", text: pl(counts.fail, "échec", "échecs") });
  if (counts.check) line.push({ status: "check", text: `${counts.check} à vérifier` });
  if (counts.untested) line.push({ status: "untested", text: pl(counts.untested, "non testé", "non testés") });
  if (!counts.fail && !counts.check && !counts.untested) line.push({ status: "ok", text: "rien à signaler" });
  return { rows, counts, line };
}
