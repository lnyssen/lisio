// Lisio, état d’une étape du parcours (audit UX du 11 novembre 2026, P0).
// Fonctions pures. Testées par tests/steps.test.mjs. Inliné dans la page par src/build.py (le mot export est retiré).
// Règle : ouvrir une page ne la valide pas. « Vue » = ouverte ; « Validée » = validée par l’équipe, sans problème détecté.
// Un problème détecté passe avant tout le reste, même sur une étape validée : la validation ne cache rien.
export const STEP_STATE = { todo: "À commencer", now: "En cours", seen: "Vue", done: "Validée", warn: "Attention requise", na: "Non applicable" };

// s : { id, cur, seen: [ids ouverts], valid: [ids validés], issues: nombre de points, na: étape sans objet, example: palette d’exemple }
export function stepState(s) {
  if (s.na) return "na";
  if (s.issues > 0) return "warn";
  if ((s.valid || []).includes(s.id) && !(s.example && s.id === "couleurs")) return "done";
  if (s.id === s.cur) return "now";
  if (s.example && s.id === "couleurs") return "todo";
  return (s.seen || []).includes(s.id) ? "seen" : "todo";
}

// Peut-on valider l’étape ? Non tant qu’un problème est détecté, ni sur la palette d’exemple.
export function stepCanValidate(s) {
  if (s.na) return { ok: false, why: "Étape sans objet pour ce projet." };
  if (s.issues > 0) return { ok: false, why: `${s.issues} point${s.issues > 1 ? "s" : ""} à régler avant de valider.` };
  if (s.example && s.id === "couleurs") return { ok: false, why: "Saisissez vos propres couleurs avant de valider." };
  return { ok: true, why: "" };
}

// Le seul compteur du parcours : étapes validées sur le total, et celles qui demandent de l’attention.
export function stepsCount(states) {
  return { done: states.filter(x => x === "done").length, warn: states.filter(x => x === "warn").length, all: states.length };
}
export const stepsLine = c => `${c.done}/${c.all} ${c.done > 1 ? "étapes validées" : "étape validée"}`;

// Message de la page Exporter quand rien ne bloque : il reprend le résumé, il ne promet rien de plus.
// c : { check, untested, level } (counts de projectSummary).
export function exportReady(c) {
  const pl = (n, one, many) => `${n} ${n > 1 ? many : one}`;
  const rest = [c.check ? pl(c.check, "point à vérifier", "points à vérifier") : "", c.untested ? `${pl(c.untested, "critère", "critères")} à tester à la main` : ""].filter(Boolean);
  return {
    title: rest.length ? "Export possible" : "Export possible, rien à signaler",
    text: `Tous les rôles et tous les styles de texte passent le test automatique ${c.level}.` + (rest.length ? ` Reste : ${rest.join(", ")}.` : "") + " Ce test ne couvre qu’une partie des critères WCAG."
  };
}
