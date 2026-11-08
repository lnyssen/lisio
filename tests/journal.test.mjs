// P2 · Versions et décisions (blueprint § 8 et § 9.4) : versions du projet, comparaison, journal des décisions et exceptions.
//   node --test tests/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEC_KINDS, DEC_FIELDS, DEC_MAX, VER_MAX, decCheck, decDue, decLine, dateFr, verSnapshot, verDiff } from "../src/core/journal.mjs";

const EXC = { kind: "exception", problem: "Orange #D9480F illisible en texte courant", reason: "Couleur de marque imposée", context: "Pictogrammes seulement, jamais de texte", role: "Direction artistique", date: "2026-11-08", review: "2027-05-01" };

test("une exception contient ce que demande le blueprint : problème, raison, contexte, rôle, date, révision", () => {
  assert.deepEqual(Object.keys(DEC_KINDS), ["decision", "exception"]);
  assert.deepEqual(DEC_FIELDS.map(f => f[0]), ["problem", "reason", "context", "role", "date", "review"]);
  const r = decCheck(EXC);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.entry.review, "2027-05-01");
});

test("une exception incomplète est refusée, et les champs manquants sont nommés", () => {
  const r = decCheck({ kind: "exception", problem: "Ciel sur Blanc à 2,14:1", reason: "  ", date: "2026-11-08" });
  assert.equal(r.ok, false);
  assert.deepEqual(r.missing, ["reason", "context", "role"]);
  assert.ok(r.errors.every(e => typeof e === "string" && e.length > 5));
});

test("une décision n’exige pas de contexte, mais un problème, une raison, un rôle et une date", () => {
  assert.equal(decCheck({ kind: "decision", problem: "Niveau AA visé", reason: "Exigence du RGAA", role: "Cheffe de projet", date: "2026-11-08" }).ok, true);
  assert.deepEqual(decCheck({ kind: "decision", problem: "Niveau AA visé", date: "2026-11-08" }).missing, ["reason", "role"]);
});

test("dates : format AAAA-MM-JJ réel, et révision après la décision", () => {
  assert.deepEqual(decCheck({ ...EXC, date: "2026-02-30" }).missing, ["date"]);
  assert.deepEqual(decCheck({ ...EXC, date: "08/11/2026" }).missing, ["date"]);
  assert.deepEqual(decCheck({ ...EXC, review: "2026-01-01" }).missing, ["review"]);
  assert.equal(decCheck({ ...EXC, review: "" }).ok, true, "la révision est facultative");
  assert.equal(decCheck({ ...EXC, kind: "autre" }).ok, false);
});

test("textes nettoyés et bornés", () => {
  const r = decCheck({ ...EXC, problem: "  " + "x".repeat(900) + "  ", extra: "<b>" });
  assert.equal(r.entry.problem.length, 500);
  assert.equal("extra" in r.entry, false);
});

test("une entrée dont la date de révision est passée est « à revoir »", () => {
  assert.equal(decDue(EXC, "2027-04-30"), false);
  assert.equal(decDue(EXC, "2027-05-01"), true);
  assert.equal(decDue({ ...EXC, review: "" }, "2099-01-01"), false);
});

test("une ligne de rapport reprend tous les champs, dates en français", () => {
  assert.equal(dateFr("2026-11-08"), "8 novembre 2026");
  assert.equal(dateFr("2026-01-01"), "1er janvier 2026");
  const l = decLine(EXC, "2026-12-01");
  for (const s of ["Exception", EXC.problem, EXC.reason, EXC.context, EXC.role, "8 novembre 2026", "1er mai 2027"]) assert.ok(l.includes(s), s + " dans « " + l + " »");
  assert.ok(decLine(EXC, "2027-06-01").includes("à revoir"));
});

test("une version est une copie : sans les versions ni le journal, et indépendante du projet", () => {
  const state = { level: "AA", ts: { d: { base: 18 } }, versions: [{ id: "x" }], decisions: [EXC] };
  const colors = [{ name: "Bleu", hex: "#2563EB" }];
  const v = verSnapshot({ name: "  Validée  ", note: "Après la revue", colors, state, date: "2026-11-08T10:00:00.000Z", id: "v1" });
  assert.equal(v.name, "Validée");
  assert.equal("versions" in v.state, false);
  assert.equal("decisions" in v.state, false);
  colors[0].hex = "#000000"; state.ts.d.base = 20;
  assert.equal(v.colors[0].hex, "#2563EB"); assert.equal(v.state.ts.d.base, 18);
  assert.ok(VER_MAX >= 10 && DEC_MAX >= 20);
});

test("comparer : couleurs ajoutées, retirées, modifiées, et réglages nommés comme dans l’interface", () => {
  const a = { colors: [{ name: "Bleu", hex: "#2563EB" }, { name: "Gris", hex: "#64748B" }], state: { level: "AA", sheet: "fg", ts: { d: { base: 16 } }, decisions: [] } };
  const b = { colors: [{ name: "Bleu", hex: "#1D4ED8" }, { name: "Orange", hex: "#D9480F" }], state: { level: "AAA", sheet: "bg", ts: { d: { base: 18 } }, decisions: [EXC] } };
  const d = verDiff(a, b);
  assert.deepEqual(d.colors.changed, [["Bleu", "#2563EB", "#1D4ED8"]]);
  assert.deepEqual(d.colors.added, ["Orange"]);
  assert.deepEqual(d.colors.removed, ["Gris"]);
  assert.deepEqual(d.settings, ["Niveau WCAG", "Styles de texte, taille de base desktop"], "l’affichage (sheet) et le journal ne comptent pas");
  assert.equal(d.same, false);
  assert.equal(verDiff(a, JSON.parse(JSON.stringify(a))).same, true);
});
