// Cahier « Next-Level » : assistant de création en 3 étapes (couleurs, police, validation).
//   node --test tests/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { wizPalette, WIZ_FONTS, WIZ_SCALES, WIZ_BASES, WIZ_STEPS } from "../src/core/wizard.mjs";
import { ratio, hexToOklch } from "../src/core/color.mjs";

test("trois étapes : couleurs, police, validation", () => {
  assert.deepEqual(WIZ_STEPS.map(s => s.id), ["couleurs", "police", "validation"]);
  for (const s of WIZ_STEPS) assert.ok(s.title && s.say.length > 30, s.id);
});

test("fond clair : une encre de la même teinte que la principale, à 7:1 au moins", () => {
  const w = wizPalette("#2563EB", "#FFFFFF");
  assert.deepEqual(w.colors.map(c => c.name), ["Principale", "Encre", "Fond"]);
  assert.ok(w.colors.every(c => /^#[0-9A-F]{6}$/.test(c.hex)));
  assert.ok(ratio(w.fg, w.bg) >= 7, `encre ${w.fg} : ${ratio(w.fg, w.bg)}`);
  assert.ok(Math.abs(hexToOklch(w.fg).h - hexToOklch("#2563EB").h) < 0.35, "même teinte");
});

test("fond sombre : l’encre est claire", () => {
  const w = wizPalette("#38BDF8", "#0F172A");
  assert.ok(ratio(w.fg, w.bg) >= 7 && hexToOklch(w.fg).L > 0.7, w.fg);
});

test("principale trop claire sur le fond : Lisio le dit et propose une correction qui passe", () => {
  const w = wizPalette("#38BDF8", "#FFFFFF");
  const txt = w.checks.find(c => c.id === "primary-text");
  assert.equal(txt.ok, false);
  assert.ok(w.fixPrimary && ratio(w.fixPrimary, "#FFFFFF") >= 4.5, String(w.fixPrimary));
  assert.equal(wizPalette("#1D4ED8", "#FFFFFF").fixPrimary, null);
});

test("principale déjà très foncée : pas de doublon, elle sert d’encre", () => {
  const w = wizPalette("#0B1F4D", "#FFFFFF");
  assert.deepEqual(w.colors.map(c => c.name), ["Principale", "Fond"]);
  assert.equal(w.fg, "#0B1F4D");
});

test("saisie invalide : null, jamais une palette fausse", () => {
  assert.equal(wizPalette("bleu", "#FFFFFF"), null);
  assert.equal(wizPalette("#2563EB", ""), null);
});

test("polices, échelles et tailles proposées : des valeurs que Lisio accepte", () => {
  assert.ok(WIZ_FONTS.length >= 4 && WIZ_FONTS.every(([f, d]) => f && d));
  assert.ok(WIZ_SCALES.every(([r]) => ["1.067", "1.125", "1.15", "1.2", "1.25", "1.333", "1.414", "1.5"].includes(r)));
  assert.ok(WIZ_BASES.every(b => b >= 10 && b <= 32));
});
