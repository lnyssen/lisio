// F07 : la table des critères expliqués. Lancer : node --test tests/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { CRITERIA, WCAG_REF, LISIO_KIND, criterion } from "../src/core/criteria.mjs";

const IDS = ["1.4.1", "1.4.3", "1.4.4", "1.4.6", "1.4.8", "1.4.10", "1.4.11", "1.4.12", "2.4.7", "2.4.11", "2.4.13", "2.5.5", "2.5.8", "3.1.5"];

test("référence versionnée : WCAG 2.2, W3C, lien officiel", () => {
  assert.equal(WCAG_REF.version, "2.2");
  assert.match(WCAG_REF.url, /^https:\/\/www\.w3\.org\/TR\/WCAG22\/$/);
  assert.match(WCAG_REF.date, /2023/);
});

test("chaque critère attendu est décrit en entier", () => {
  for (const id of IDS) {
    const c = criterion(id);
    assert.ok(c, id);
    assert.ok(["A", "AA", "AAA"].includes(c.level), id + " niveau");
    assert.ok(["2.0", "2.1", "2.2"].includes(c.since), id + " version");
    assert.ok(c.name && c.need && c.how.length >= 2 && c.limits, id + " textes");
    assert.ok(Object.keys(LISIO_KIND).includes(c.lisio.kind) && c.lisio.text, id + " ce que fait Lisio");
    assert.match(c.url, /^https:\/\/www\.w3\.org\/WAI\/WCAG22\/Understanding\/[a-z-]+\.html$/, id + " lien");
  }
  assert.equal(new Set(CRITERIA.map(c => c.id)).size, CRITERIA.length, "pas de doublon");
});

test("niveaux et versions exacts (WCAG 2.2)", () => {
  const L = Object.fromEntries(CRITERIA.map(c => [c.id, c.level + " " + c.since]));
  assert.equal(L["1.4.3"], "AA 2.0"); assert.equal(L["1.4.6"], "AAA 2.0"); assert.equal(L["1.4.11"], "AA 2.1");
  assert.equal(L["1.4.12"], "AA 2.1"); assert.equal(L["2.4.7"], "AA 2.0"); assert.equal(L["2.4.11"], "AA 2.2");
  assert.equal(L["2.4.13"], "AAA 2.2"); assert.equal(L["2.5.8"], "AA 2.2"); assert.equal(L["2.5.5"], "AAA 2.1");
  assert.equal(L["1.4.1"], "A 2.0"); assert.equal(L["3.1.5"], "AAA 2.0"); assert.equal(L["1.4.10"], "AA 2.1");
});

test("1.4.12 : les quatre valeurs du critère, une simulation qui ne valide pas un site", () => {
  const c = criterion("1.4.12"), v = c.values.join(" ");
  for (const x of ["1,5", "2 fois", "0,12", "0,16"]) assert.ok(v.includes(x), x);
  assert.equal(c.lisio.kind, "simulation");
  assert.match(c.lisio.text, /ne valide pas/);
  assert.match(c.code, /letter-spacing:\s*\.12em/);
});

test("cibles : 24 px en AA avec exceptions, 44 px en AAA, sans confondre", () => {
  const a = criterion("2.5.8"), b = criterion("2.5.5");
  assert.match(a.need, /24 × 24/); assert.ok(a.exceptions.length >= 4);
  assert.match(b.need, /44 × 44/);
  assert.doesNotMatch(a.need, /44/);
});

test("aucun texte ne promet une conformité", () => {
  const all = JSON.stringify([CRITERIA, LISIO_KIND]);
  assert.doesNotMatch(all, /certifi|100 %|site conforme|accessible à 100/i);
});
