// Nom et apparence d’une couleur (src/core/naming.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { nameMismatch } from "../src/core/naming.mjs";

test("« Bleu » presque blanc : signalé comme neutre", () => {
  const r = nameMismatch("Bleu", "#EEF4FF");
  assert.equal(r.kind, "neutre");
  assert.match(r.message, /grises, pas bleues/);
});
test("noms cohérents : rien à dire", () => {
  for (const [n, h] of [["Bleu", "#2447D1"], ["Marine", "#0D1D45"], ["Orange", "#FF7A1A"], ["Corail", "#FF5A4E"], ["Turquoise", "#00B3B0"], ["Ambre", "#F5A00B"], ["Violet", "#8A3FFC"], ["Magenta", "#D627C9"], ["Vert", "#1E8E3E"], ["Rouge", "#B42318"]]) assert.equal(nameMismatch(n, h), null, n);
});
test("nom sans teinte (Nuit, Toile, Marque) : rien à dire", () => {
  for (const n of ["Nuit", "Toile", "Marque", "Surface", "Encre"]) assert.equal(nameMismatch(n, "#EEF4FF"), null, n);
});
test("teinte contraire : signalée", () => {
  assert.equal(nameMismatch("Vert", "#2447D1").kind, "teinte");
  assert.match(nameMismatch("Rouge", "#1E8E3E").message, /ne ressemble pas à du rouge/);
});
