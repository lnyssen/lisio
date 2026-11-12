// Tests du résumé permanent du projet (F02, P0-5). Lancer : node --test tests/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { projectSummary, SUM_STATUS } from "../src/core/summary.mjs";
import { STATUS } from "../src/core/status.mjs";

const base = { level: "AA", colors: 4, colorTokens: 120, loneColors: 0, twins: 0, rolesChecked: 30, roleFails: 0, fonts: ["Figtree", "Figtree"], styles: 12, styleFails: 0, styleWarns: 0, blocksOn: 11, blocksAll: 11, manualDone: 0, manualAll: 24, screens: 1, stepsDone: 2, stepsAll: 7 };
const row = (s, id) => s.rows.find(r => r.id === id);

test("chiffres repris tels quels, chaque ligne mène à sa page", () => {
  const s = projectSummary(base);
  assert.match(row(s, "colors").value, /4 couleurs.*120 jetons/);
  assert.match(row(s, "type").value, /Figtree.*12 styles/);
  assert.match(row(s, "blocks").value, /11 blocs sur 11/);
  for (const r of s.rows) assert.match(r.href, /^#[a-z]+$/, r.id);
});

test("non testé n'est jamais compté comme un échec", () => {
  const s = projectSummary(base);
  assert.equal(row(s, "manual").status, "untested");
  assert.equal(s.counts.fail, 0); assert.equal(s.counts.untested, 24);
  assert.ok(!s.line.some(x => x.status === "fail"));
});

test("échecs, points à vérifier et non testés comptés à part, avec un mot pour chacun", () => {
  const s = projectSummary({ ...base, roleFails: 2, styleFails: 1, styleWarns: 3, loneColors: 1, manualDone: 4 });
  assert.equal(row(s, "roles").status, "fail"); assert.equal(row(s, "type").status, "fail");
  assert.equal(row(s, "comfort").status, "check"); assert.equal(row(s, "colors").status, "check");
  assert.deepEqual(s.counts, { fail: 3, check: 4, untested: 20 });
  for (const r of s.rows) assert.ok(r.status === "info" || SUM_STATUS[r.status], r.id);
  for (const k of ["ok", "fail", "check", "untested"]) assert.ok(SUM_STATUS[k].word && SUM_STATUS[k].icon, k);
});

test("tout coché, aucun défaut : réussi partout, sans promettre la conformité", () => {
  const s = projectSummary({ ...base, manualDone: 24, stepsDone: 7 });
  assert.deepEqual(s.counts, { fail: 0, check: 0, untested: 0 });
  assert.equal(row(s, "manual").status, "ok");
  const all = JSON.stringify(s);
  assert.doesNotMatch(all, /\bconforme\b(?! au test)|certifi|100\s?%/i);
  assert.match(row(s, "progress").value, /7 étapes sur 7/); assert.match(row(s, "progress").note, /pas (la|une) conformité/);
});

test("contrôles automatiques : réussis sur total, rôles et styles", () => {
  const s = projectSummary({ ...base, roleFails: 2, styleFails: 1 });
  assert.match(row(s, "auto").value, /^39 conformes au test sur 42/);
});

test("accord : 1 étape validée, 2 étapes validées", () => {
  assert.equal(row(projectSummary({ ...base, stepsDone: 1 }), "progress").value, "1 étape sur 7 validée");
  assert.equal(row(projectSummary({ ...base, stepsDone: 2 }), "progress").value, "2 étapes sur 7 validées");
});

test("le résumé parle avec les cinq statuts du blueprint (P0-3 bis)", () => {
  assert.equal(SUM_STATUS.ok.word, STATUS.pass.word); assert.equal(SUM_STATUS.fail.word, STATUS.fail.word);
  assert.equal(SUM_STATUS.check.word, STATUS.manual.word); assert.equal(SUM_STATUS.untested.word, STATUS.untested.word);
});
