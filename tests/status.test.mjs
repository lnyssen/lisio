// Les cinq statuts du blueprint (F11, § 5.4) et le libellé des critères. Lancer : node --test tests/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { STATUS, critLabel, textCrit } from "../src/core/status.mjs";

test("cinq statuts, dans les mots du blueprint, chacun avec un signe", () => {
  assert.deepEqual(Object.values(STATUS).map(s => s.word), ["Conforme au test", "Échec du test", "À vérifier manuellement", "Non testé", "Non applicable"]);
  const icons = Object.values(STATUS).map(s => s.icon);
  assert.equal(new Set(icons).size, 5); for (const i of icons) assert.ok(i && i.length <= 2, i);
});

test("critère : numéro, niveau et version, sans nom inventé", () => {
  assert.equal(critLabel("1.4.3", "AA"), "WCAG 2.2, critère 1.4.3, niveau AA");
  assert.equal(critLabel("2.5.5", "AAA", "2.1"), "WCAG 2.1, critère 2.5.5, niveau AAA");
});

test("contraste du texte : 1.4.3 au niveau AA, 1.4.6 au niveau AAA", () => {
  assert.deepEqual(textCrit("AA"), ["1.4.3", "AA"]); assert.deepEqual(textCrit("AAA"), ["1.4.6", "AAA"]); assert.deepEqual(textCrit(undefined), ["1.4.3", "AA"]);
});
