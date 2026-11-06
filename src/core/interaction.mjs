// Lisio, cœur interaction (F08) : focus, cibles et états des composants du design system.
// Fonctions pures. Testées par tests/interaction.test.mjs.
// Règle : une exigence WCAG (critère et niveau) n'est jamais mélangée à une recommandation de design.
// Ce que Lisio ne peut pas voir (vos écrans) reste « À vérifier manuellement ».
import { ratio } from "./color.mjs";
import { ratioTxt } from "./wcag.mjs";
import { criterion } from "./criteria.mjs";
const IX_MODE = { light: "mode clair", dark: "mode sombre" };
const IX_V = { "2.0": 20, "2.1": 21, "2.2": 22 };
const IX_BGS = ["background/default", "background/subtle"];
export const RECO_NOTE = "Les recommandations sont des choix de design proposés par Lisio, pas une exigence WCAG : un écart n’est pas un échec.";
// o : { version, btnH, ringW, offset, roles: { light: {rôle: hex}, dark?: {…} } }
export function interactionChecks(o) {
  const v = IX_V[o.version] || 22, modes = Object.keys(o.roles), req = [], reco = [];
  const tag = m => (modes.length > 1 ? " (" + IX_MODE[m] + ")" : "");
  const minOn = (R, k) => Math.min(...IX_BGS.filter(b => R[b]).map(b => ratio(R[k], R[b])));
  const R1 = (id, level, status, title, text, exceptions = []) => req.push({ kind: "req", id, level, status, title, text, exceptions });
  const na = (id, level, title, since) => R1(id, level, "na", title, "Critère ajouté dans WCAG " + since + " : non applicable avec WCAG " + o.version + ".");
  // Focus
  R1("2.4.7", "AA", "manual", "Focus visible au clavier", "Lisio fournit le style de focus (rôle focus/ring), mais Lisio ne voit pas s’il est appliqué à chaque élément de vos écrans. Testez avec la touche Tab.");
  if (v < 22) na("2.4.11", "AA", "Focus non masqué", "2.2");
  else R1("2.4.11", "AA", "manual", "Focus non masqué", "Lisio ne voit pas vos bandeaux fixes ni vos fenêtres : vérifiez que l’élément qui a le focus n’est jamais entièrement caché.", criterion("2.4.11").exceptions);
  if (v < 22) na("2.4.13", "AAA", "Apparence du focus", "2.2");
  else for (const m of modes) { const r = minOn(o.roles[m], "focus/ring"), ok = r >= 3 && o.ringW >= 2;
    R1("2.4.13", "AAA", ok ? "pass" : "fail", "Apparence du focus" + tag(m), "Contour de " + o.ringW + " px, " + ratioTxt(r) + ":1 au plus faible sur vos fonds. Il faut une surface d’au moins un contour de 2 px et 3:1 entre l’état avec et sans focus.", criterion("2.4.13").exceptions); }
  // Contraste des composants
  for (const [k, name] of [["focus/ring", "Contour de focus"], ["border/default", "Bordure des champs"]]) {
    if (v < 21) { na("1.4.11", "AA", name, "2.1"); continue; }
    for (const m of modes) { const r = minOn(o.roles[m], k);
      R1("1.4.11", "AA", r >= 3 ? "pass" : "fail", name + tag(m), name + " : " + ratioTxt(r) + ":1 au plus faible sur vos fonds (minimum 3:1).", criterion("1.4.11").exceptions); }
  }
  // Cibles
  if (v < 22) na("2.5.8", "AA", "Taille des cibles (minimum)", "2.2");
  else R1("2.5.8", "AA", o.btnH >= 24 ? "pass" : "fail", "Taille des cibles (minimum)", "Boutons et champs exportés : " + o.btnH + " px de haut, minimum 24 × 24 px. Lisio ne mesure pas les autres cibles de vos écrans (icônes seules, liens isolés).", criterion("2.5.8").exceptions);
  if (v < 21) na("2.5.5", "AAA", "Taille des cibles (améliorée)", "2.1");
  else R1("2.5.5", "AAA", o.btnH >= 44 ? "pass" : "fail", "Taille des cibles (améliorée)", "Boutons et champs exportés : " + o.btnH + " px de haut, minimum 44 × 44 px au niveau AAA.", criterion("2.5.5").exceptions);
  // États et messages
  R1("1.4.1", "A", "manual", "États qui ne reposent pas que sur la couleur", "Les modèles de Lisio doublent chaque couleur d’état d’une icône et d’un texte, mais Lisio ne voit pas vos écrans : vérifiez chaque statut, erreur et lien.");
  R1("3.3.1", "A", "manual", "Erreurs décrites en mots", "Lisio ne voit pas vos formulaires : chaque erreur doit être signalée et décrite en texte, pas seulement par une bordure rouge.");
  // Recommandations de design
  const worstRing = Math.min(...modes.map(m => minOn(o.roles[m], "focus/ring")));
  reco.push({ kind: "reco", key: "focus", status: worstRing >= 3 && o.ringW >= 2 && o.offset >= 2 ? "pass" : "fail", title: "Contour de focus de 2 px, décalé de 2 px, à 3:1 sur tous les fonds",
    text: "Recommandation de Lisio, inspirée de 2.4.13 (AAA). Au niveau AA, la règle est seulement que le focus soit visible (2.4.7) et jamais entièrement caché (2.4.11)." });
  reco.push({ kind: "reco", key: "target", status: o.btnH >= 44 ? "pass" : "fail", title: "Boutons et champs d’au moins 44 px",
    text: "Recommandation de confort, pour le doigt et la main qui tremble. Une cible entre 24 et 44 px n’est pas un échec au niveau AA." });
  const diffs = modes.map(m => { const R = o.roles[m]; return [m, ratio(R["action/default"], R["action/hover"]), ratio(R["action/default"], R["action/pressed"])]; });
  reco.push({ kind: "reco", key: "states", status: diffs.every(([, h, p]) => h >= 1.1 && p >= 1.1) ? "pass" : "fail", title: "Survol et appui distincts du repos",
    text: diffs.map(([m, h, p], i) => (i ? "survol à " : "Survol à ") + ratioTxt(h) + ":1 du repos, appui à " + ratioTxt(p) + ":1" + tag(m)).join(" ; ") + ". Aucune règle WCAG ne fixe cet écart : 1,1:1 est un repère de Lisio pour que le changement se voie." });
  reco.push({ kind: "reco", key: "disabled", status: "manual", title: "État désactivé reconnaissable et expliqué",
    text: "Un composant désactivé est exempté de contraste (1.4.3, 1.4.11). Choix de design recommandé : dire pourquoi en mots à côté, ou laisser le bouton actif et expliquer l’erreur au clic." });
  return { req, reco, note: RECO_NOTE };
}
