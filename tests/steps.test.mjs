// État des étapes du parcours (audit UX du 11 novembre 2026, P0). Lancer : node --test tests/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { STEP_STATE, stepState, stepCanValidate, stepsCount, stepsLine, exportReady } from "../src/core/steps.mjs";

const st = o => stepState({ id: "tester", cur: "couleurs", seen: [], valid: [], issues: 0, ...o });

test("ouvrir une étape ne la valide pas : « Vue », jamais « Validée »", () => {
  assert.equal(st({ seen: ["tester"] }), "seen");
  assert.equal(STEP_STATE.seen, "Vue");
  assert.equal(st({}), "todo");
});

test("« Validée » seulement par validation explicite", () => {
  assert.equal(st({ seen: ["tester"], valid: ["tester"] }), "done");
  assert.equal(st({ valid: ["tester"], cur: "tester" }), "done");
  assert.equal(STEP_STATE.done, "Validée");
});

test("un problème passe avant la validation", () => {
  assert.equal(st({ valid: ["tester"], issues: 2 }), "warn");
  assert.equal(st({ cur: "tester", issues: 1 }), "warn");
});

test("palette d’exemple : Couleurs reste à commencer, sauf problème détecté", () => {
  assert.equal(st({ id: "couleurs", cur: "matrice", seen: ["couleurs"], example: true }), "todo");
  assert.equal(st({ id: "couleurs", cur: "matrice", valid: ["couleurs"], example: true }), "todo");
  assert.equal(st({ id: "couleurs", cur: "matrice", example: true, issues: 2 }), "warn");
});

test("non applicable avant tout", () => {
  assert.equal(st({ na: true, issues: 3 }), "na");
});

test("valider : refusé tant qu’un point reste, ou sur l’exemple, avec la raison", () => {
  assert.deepEqual(stepCanValidate({ id: "tester", issues: 0 }), { ok: true, why: "" });
  assert.match(stepCanValidate({ id: "styles", issues: 2 }).why, /2 points à régler/);
  assert.match(stepCanValidate({ id: "couleurs", issues: 0, example: true }).why, /vos propres couleurs/);
  assert.equal(stepCanValidate({ id: "matrice", na: true }).ok, false);
});

test("un seul compteur : étapes validées sur le total", () => {
  const c = stepsCount(["done", "seen", "warn", "todo", "done", "now", "na"]);
  assert.deepEqual(c, { done: 2, warn: 1, all: 7 });
  assert.equal(stepsLine(c), "2/7 étapes validées");
  assert.equal(stepsLine({ done: 1, all: 7 }), "1/7 étape validée");
  assert.equal(stepsLine({ done: 0, all: 7 }), "0/7 étape validée");
});

test("Exporter : le message reprend le résumé, jamais « Tout est prêt »", () => {
  const r = exportReady({ check: 2, untested: 19, level: "AA" });
  assert.equal(r.title, "Export possible");
  assert.match(r.text, /Reste : 2 points à vérifier, 19 critères à tester à la main\./);
  assert.match(r.text, /qu’une partie des critères/);
  assert.doesNotMatch(r.title + r.text, /Tout est prêt|sereinement/);
  assert.equal(exportReady({ check: 0, untested: 0, level: "AAA" }).title, "Export possible, rien à signaler");
});
