// P2 · F06 : projet démo. Un projet à part, signalé, avec une visite guidée des 7 étapes.
//   node --test tests/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEMO, DEMO_NOTE, demoTour } from "../src/core/demo.mjs";
import { ratio } from "../src/core/color.mjs";

const STEPS = ["couleurs", "palette", "tester", "styles", "systeme", "matrice", "exporter"];

test("le projet démo est nommé comme tel et marqué", () => {
  assert.match(DEMO.name, /Démo/);
  assert.equal(DEMO.state.demo, true);
  assert.ok(DEMO.colors.length >= 5 && DEMO.colors.every(c => /^#[0-9A-F]{6}$/.test(c.hex) && c.name), "couleurs nommées, en #RRGGBB");
});

test("la visite suit les 7 étapes, dans l’ordre, avec un texte pour chacune", () => {
  assert.deepEqual(demoTour().map(t => t.step), STEPS);
  for (const t of demoTour()) { assert.ok(t.title && t.say.length > 40, t.step); assert.ok(t.look, `${t.step} : quoi regarder`); }
});

test("la démo montre au moins une paire à corriger : on voit Lisio corriger, pas seulement valider", () => {
  const c = DEMO.colors.map(x => x.hex), white = "#FFFFFF";
  assert.ok(c.some(h => h !== white && ratio(h, white) < 4.5 && ratio(h, white) >= 1.5), "une couleur trop claire sur blanc");
  assert.match(demoTour()[0].say + demoTour()[5].say, /corrig/i);
});

test("ni promesse de conformité, ni ton projet touché", () => {
  const all = DEMO_NOTE + demoTour().map(t => t.title + t.say + t.look).join(" ");
  assert.doesNotMatch(all, /100\s?%|accessible à|certifi|garanti|conforme(?! au test)/i);
  assert.match(DEMO_NOTE, /vos projets/i);
});
