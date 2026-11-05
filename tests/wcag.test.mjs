// Tests des seuils WCAG. Lancer : node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { floor2, grade, largeText, needRatio } from "../src/core/wcag.mjs";
import { ratio } from "../src/core/color.mjs";
import { rng, randHex } from "./ref.mjs";

test("grade : bornes 3, 4,5 et 7 incluses", () => {
  const g = r => grade(r)[0];
  assert.equal(g(2.999), "✕ Échec"); assert.equal(g(3), "AA grand");
  assert.equal(g(4.499), "AA grand"); assert.equal(g(4.5), "AA");
  assert.equal(g(6.999), "AA"); assert.equal(g(7), "AAA"); assert.equal(g(21), "AAA"); assert.equal(g(1), "✕ Échec");
});

test("needRatio : 1.4.3 (AA) et 1.4.6 (AAA)", () => {
  assert.equal(needRatio("AA"), 4.5); assert.equal(needRatio("AA", true), 3);
  assert.equal(needRatio("AAA"), 7); assert.equal(needRatio("AAA", true), 4.5);
  assert.equal(needRatio(undefined), 4.5);
});

test("largeText : 24 px, ou 18,66 px en gras (700 et plus)", () => {
  assert.equal(largeText(23.99, 400), false); assert.equal(largeText(24, 400), true);
  assert.equal(largeText(18.65, 700), false); assert.equal(largeText(18.66, 700), true);
  assert.equal(largeText(18.66, 600), false); assert.equal(largeText(20, 900), true);
  // 14 pt = 18,666… px : Lisio accepte dès 18,66, soit 0,007 px de tolérance. Écart connu et voulu.
  assert.equal(largeText(14 * 4 / 3, 700), true);
});

test("floor2 n'arrondit jamais vers le haut", () => {
  const r = rng(6);
  for (let i = 0; i < 20000; i++) { const x = 1 + r() * 20, f = floor2(x); assert.ok(f <= x && x - f < 0.0101, `${x} → ${f}`); }
  assert.equal(floor2(4.499), 4.49); assert.equal(floor2(2.999), 2.99); assert.equal(floor2(6.999), 6.99);
  for (const t of [3, 4.5, 7, 21]) assert.equal(floor2(t), t);
});

test("l'affichage ne dit jamais « passe » quand le calcul échoue (20 000 paires)", () => {
  const r = rng(7);
  for (let i = 0; i < 20000; i++) { const x = ratio(randHex(r), randHex(r));
    for (const t of [3, 4.5, 7]) assert.equal(floor2(x) >= t, x >= t); }
});
