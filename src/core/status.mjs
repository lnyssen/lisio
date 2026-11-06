// Lisio, les cinq statuts du blueprint (F11, § 5.4) et le libellé d'un critère WCAG.
// Fonctions pures. Testées par tests/status.test.mjs. Inliné dans la page par src/build.py (le mot export est retiré).
// Un statut dit le résultat d'un test précis, jamais la conformité d'un produit. Chaque statut a un mot et un signe.
export const STATUS = {
  pass: { word: "Conforme au test", icon: "✓" },
  fail: { word: "Échec du test", icon: "✕" },
  manual: { word: "À vérifier manuellement", icon: "!" },
  untested: { word: "Non testé", icon: "–" },
  na: { word: "Non applicable", icon: "∅" }
};
export const statusTxt = k => `${STATUS[k].icon} ${STATUS[k].word}`;
// Numéro et niveau seulement : pas de nom de critère, pour ne rien traduire à la place du W3C.
export const critLabel = (id, level, version = "2.2") => `WCAG ${version}, critère ${id}, niveau ${level}`;
// Contraste du texte : 1.4.3 (AA, minimum) ou 1.4.6 (AAA, renforcé), selon le niveau visé.
export const textCrit = level => level === "AAA" ? ["1.4.6", "AAA"] : ["1.4.3", "AA"];
