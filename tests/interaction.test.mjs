// F08 : contrôles d'interaction (focus, cibles, états). Lancer : node --test tests/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { interactionChecks } from "../src/core/interaction.mjs";

const base = { version: "2.2", btnH: 44, ringW: 2, offset: 2,
  roles: { light: { "focus/ring": "#1D4ED8", "background/default": "#FFFFFF", "background/subtle": "#F1F5F9", "border/default": "#64748B",
    "action/default": "#1D4ED8", "action/hover": "#1E40AF", "action/pressed": "#1E3A8A", "disabled/text": "#94A3B8", "disabled/surface": "#E2E8F0" } } };
const run = (over = {}) => interactionChecks({ ...base, ...over });
const find = (r, id) => r.req.find(c => c.id === id);
const STATUSES = ["pass", "fail", "manual", "untested", "na"];

test("chaque contrôle a un critère, un niveau, un statut parmi les cinq et un texte", () => {
  const r = run();
  for (const c of [...r.req, ...r.reco]) {
    assert.ok(STATUSES.includes(c.status), c.title);
    assert.ok(c.title && c.text, "textes");
    if (c.kind === "req") { assert.match(c.id, /^\d\.\d\.\d+$/); assert.ok(["A", "AA", "AAA"].includes(c.level)); }
  }
  assert.ok(r.req.every(c => c.kind === "req") && r.reco.every(c => c.kind === "reco"), "exigences et recommandations séparées");
});

test("focus : 2.4.7 et 2.4.11 AA à vérifier manuellement, 2.4.13 AAA testé sur les fonds", () => {
  const r = run();
  assert.equal(find(r, "2.4.7").level, "AA"); assert.equal(find(r, "2.4.7").status, "manual");
  assert.equal(find(r, "2.4.11").level, "AA"); assert.equal(find(r, "2.4.11").status, "manual");
  assert.equal(find(r, "2.4.13").level, "AAA"); assert.equal(find(r, "2.4.13").status, "pass");
  const bad = run({ roles: { light: { ...base.roles.light, "focus/ring": "#CBD5E1" } } });
  assert.equal(find(bad, "2.4.13").status, "fail");
  assert.match(find(bad, "2.4.13").text, /1,\d\d:1/);
});

test("WCAG 2.1 : 2.4.11, 2.4.13 et 2.5.8 n’existent pas, statut Non applicable", () => {
  const r = run({ version: "2.1" });
  for (const id of ["2.4.11", "2.4.13", "2.5.8"]) { assert.equal(find(r, id).status, "na", id); assert.match(find(r, id).text, /2\.2/); }
  assert.equal(find(r, "2.5.5").status, "pass", "2.5.5 existe depuis 2.1");
});

test("cibles : 24 px en AA, 44 px en AAA, jamais d’échec AA entre 24 et 44 px", () => {
  const a = run({ btnH: 32 });
  assert.equal(find(a, "2.5.8").status, "pass");
  assert.equal(find(a, "2.5.5").status, "fail");
  assert.ok(find(a, "2.5.8").exceptions.length >= 4);
  assert.equal(find(run({ btnH: 20 }), "2.5.8").status, "fail");
});

test("1.4.11 : bordure de champ et contour de focus, 3:1 sur chaque fond", () => {
  const r = run(), c = r.req.filter(x => x.id === "1.4.11");
  assert.ok(c.length >= 2);
  assert.ok(c.every(x => x.status === "pass"));
  const bad = run({ roles: { light: { ...base.roles.light, "border/default": "#E2E8F0" } } });
  assert.ok(bad.req.some(x => x.id === "1.4.11" && x.status === "fail"));
});

test("mode sombre : chaque mode est vérifié et nommé", () => {
  const r = run({ roles: { light: base.roles.light, dark: { ...base.roles.light, "focus/ring": "#0B1020", "background/default": "#0B1020", "background/subtle": "#111827" } } });
  const f = r.req.filter(x => x.id === "2.4.13");
  assert.equal(f.length, 2);
  assert.ok(f.some(x => /sombre/.test(x.title) && x.status === "fail"));
});

test("recommandations : focus 2 px décalé de 2 px, cible de 44 px, états distincts, désactivé exempté", () => {
  const r = run(), t = r.reco.map(x => x.title + " " + x.text).join(" | ");
  assert.match(t, /2 px/); assert.match(t, /44/); assert.match(t, /survol/i); assert.match(t, /désactivé/i);
  assert.ok(r.reco.every(x => /recommandation|choix de design/i.test(x.text + x.title)) || r.note, "dit que ce n’est pas une exigence");
  assert.match(r.note, /pas une exigence/);
  const same = run({ roles: { light: { ...base.roles.light, "action/hover": "#1D4ED8" } } });
  assert.equal(same.reco.find(x => x.key === "states").status, "fail");
});

test("tests impossibles dans Lisio signalés", () => {
  const r = run();
  assert.ok(r.req.filter(x => x.status === "manual").every(x => /Lisio ne/.test(x.text)));
  assert.doesNotMatch(JSON.stringify(r), /certifi|100 %|site conforme/i);
});
