// Guide et slides de formation (src/docs) : à jour avec l'application (parcours en 7 étapes, cinq statuts,
// plugin qui montre avant d'écrire), sans formulation interdite par le blueprint. Lancer : node --test tests/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { STATUS } from "../src/core/status.mjs";

const read = p => readFileSync(new URL("../src/docs/" + p, import.meta.url), "utf8");
const txt = h => h.replace(/<[^>]+>/g, " ").replace(/&nbsp;| /g, " ").replace(/\s+/g, " ");
const guide = txt(read("guide.html")), order = JSON.parse(read("slides.json")).order, slides = txt(order.map(s => read(`slides/${s}.html`)).join(" "));
const STEPS = ["Couleurs", "Nuances", "Polices", "Styles de texte", "Design system", "Contrastes", "Exporter"];
const BAD = /Pas conforme|(?<!partiellement )non conformes?|✓ Conforme(?! au test)|recommandent 44|brouillon WCAG 3|accessible à 100|certifié WCAG|6 étapes|six étapes/i;
const inOrder = (t, words) => { let i = -1; for (const w of words) { const j = t.indexOf(w, i + 1); if (j < 0) return w; i = j; } return null; };

test("guide : parcours en 7 étapes, dans l'ordre du menu", () => {
  assert.match(guide, /Le parcours en 7 étapes/);
  const sec = guide.slice(guide.indexOf("Le parcours en 7 étapes"));
  assert.equal(inOrder(sec, STEPS.map((s, i) => `${i + 1}. ${s}`)), null);
  for (const w of ["À commencer", "En cours", "Vue", "Validée", "Valider l’étape", "Attention requise", "Non applicable"]) assert.ok(sec.includes(w), w);
  assert.doesNotMatch(sec, /Complété/);
});

test("slides : parcours en 7 étapes, dans l'ordre", () => {
  const p = txt(read("slides/parcours.html"));
  assert.match(p, /Le parcours en 7 étapes/); assert.equal(inOrder(p, STEPS), null);
});

test("guide et slides : les cinq statuts, et le plugin qui montre avant d'écrire", () => {
  for (const s of Object.values(STATUS)) { assert.ok(guide.includes(s.word), "guide : " + s.word); assert.ok(slides.includes(s.word), "slides : " + s.word); }
  for (const t of [guide, slides]) { assert.match(t, /Confirmer/); assert.match(t, /sans votre accord|sans accord/i); assert.doesNotMatch(t, /met à jour(, | l’existant,) sans doublons/); }
});

test("guide et slides : aucune formulation interdite", () => {
  for (const [n, t] of [["guide", guide], ["slides", slides]]) { const m = t.match(BAD); assert.equal(m, null, `${n} : « ${m && m[0]} »`); }
});

// P1 : les nouvelles fonctions figurent dans le guide et les slides, avec les mots de l'interface.
test("guide : fonctions de la P1, avec les mots de l'interface", () => {
  for (const w of ["Lisible ou pas ?", "Ne plus afficher au démarrage", "Essentiel", "Avancé", "Créer mon projet", "Essayer la démo", "Quitter la démo", "Afficher les réglages avancés",
    "Service public sobre", "Éditorial, longue lecture", "Lecture renforcée (AAA)", "Palette Média Animation",
    "Comment tester ?", "Focus, cibles et états", "Télécharger en Markdown (.md)", "Télécharger en JSON",
    "Copier les variables seules", "Télécharger lisio.css", "ne remplace pas une sauvegarde"])
    assert.ok(guide.includes(w), "guide : " + w);
  assert.match(guide, /Rechercher|recherche/);
});

test("slides : démarrer, export CSS et rapport de la P1", () => {
  assert.ok(order.includes("demarrer"), "slide demarrer dans l'ordre");
  const d = txt(read("slides/demarrer.html")), c = txt(read("slides/css.html")), e = txt(read("slides/equipe.html"));
  for (const w of ["Essentiel", "Avancé", "modèle"]) assert.ok(d.includes(w), "demarrer : " + w);
  for (const w of ["lisio.css", "catégorie", "variables seules"]) assert.ok(c.includes(w), "css : " + w);
  for (const w of ["Markdown", "JSON"]) assert.ok(e.includes(w), "equipe : " + w);
});
