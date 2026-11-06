// Tests des seuils WCAG. Lancer : node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { floor2, grade, largeText, needRatio, ratioTxt } from "../src/core/wcag.mjs";
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

test("ratioTxt : tronque à l'affichage, jamais vers le haut (audit F1)", () => {
  assert.equal(ratioTxt(9.95, 1), "9,9"); assert.equal(ratioTxt(4.48, 1), "4,4"); assert.equal(ratioTxt(2.999, 1), "2,9");
  assert.equal(ratioTxt(10.96, 1), "10,9"); assert.equal(ratioTxt(4.499), "4,49"); assert.equal(ratioTxt(21), "21,00"); assert.equal(ratioTxt(7, 1), "7,0");
  const r = rng(11), back = t => Number(t.replace(",", "."));
  for (let i = 0; i < 20000; i++) {
    const x = ratio(randHex(r), randHex(r));
    for (const d of [1, 2]) { const t = ratioTxt(x, d); assert.ok(back(t) <= x, `${x} affiché ${t}`); assert.ok(x - back(t) < 10 ** -d + 1e-9); }
    assert.equal(ratioTxt(x), floor2(x).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    // Aux seuils, l'affichage ne dit jamais « atteint » quand le calcul échoue.
    for (const s of [3, 4.5, 7]) if (x < s) assert.ok(back(ratioTxt(x, 1)) < s && back(ratioTxt(x)) < s);
  }
});

// P0-3 · floor2 et ratioTxt ne retirent plus 0,01 aux centièmes exacts (4,53 * 100 = 452,999… en virgule flottante).
test("floor2 et ratioTxt : un centième exact s'affiche tel quel (P0-3)", () => {
  const bad = [];
  for (let k = 100; k <= 2100; k++) { const x = k / 100; if (floor2(x) !== x) bad.push(`${x} → ${floor2(x)}`); if (ratioTxt(x) !== x.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })) bad.push(`ratioTxt ${x} → ${ratioTxt(x)}`); }
  for (let k = 10; k <= 210; k++) { const x = k / 10; if (ratioTxt(x, 1) !== x.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })) bad.push(`ratioTxt1 ${x} → ${ratioTxt(x, 1)}`); }
  assert.deepEqual(bad, []);
  // Juste sous un seuil, on reste dessous : la correction ne vaut que pour un centième exact.
  for (const t of [3, 4.5, 7]) { const x = t - 1e-12; assert.ok(floor2(x) < t, `${x}`); assert.ok(Number(ratioTxt(x).replace(",", ".")) < t); }
});

// P0-3 · La pastille suit le niveau visé : au niveau AAA, 5:1 ne doit pas ressembler à une réussite du texte courant.
test("grade suit le niveau : AA inchangé, AAA exige 7:1 (ou 4,5:1 en grand texte)", () => {
  const g = (r, l) => grade(r, l)[0];
  assert.equal(g(5), "AA"); assert.equal(g(5, "AA"), "AA"); assert.equal(g(3.2, "AA"), "AA grand");
  assert.equal(g(7, "AAA"), "AAA"); assert.equal(g(6.99, "AAA"), "AAA grand"); assert.equal(g(4.5, "AAA"), "AAA grand");
  assert.equal(g(4.49, "AAA"), "✕ Échec"); assert.equal(g(3.5, "AAA"), "✕ Échec");
  assert.equal(grade(5, "AAA")[1], "b-lg"); assert.equal(grade(4, "AAA")[1], "b-no");
});
