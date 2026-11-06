// F10 : modèles de départ. Lancer : node --test tests/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { PRESETS, PRESET_LIMITS, preset } from "../src/core/presets.mjs";
import { ratio, normHex } from "../src/core/color.mjs";
import { needRatio } from "../src/core/wcag.mjs";
import { criterion } from "../src/core/criteria.mjs";
import { COLORS_MAX } from "../src/core/project.mjs";

test("au moins trois modèles nommés, identifiants uniques", () => {
  assert.ok(PRESETS.length >= 3);
  assert.equal(new Set(PRESETS.map(p => p.id)).size, PRESETS.length);
  for (const p of PRESETS) assert.ok(p.name && p.use, p.id);
  assert.equal(preset("sobre").name, "Service public sobre");
});

test("couleurs valides, 12 au plus, texte et fond pris dans la palette", () => {
  for (const p of PRESETS) {
    assert.ok(p.colors.length >= 3 && p.colors.length <= COLORS_MAX, p.id);
    assert.ok(p.colors.every(c => normHex(c.hex) === c.hex), p.id + " hex");
    const hexes = p.colors.map(c => c.hex);
    assert.ok(hexes.includes(p.state.fg) && hexes.includes(p.state.bg), p.id + " fg/bg dans la palette");
  }
});

test("le texte de départ passe le niveau choisi par le modèle", () => {
  for (const p of PRESETS) assert.ok(ratio(p.state.fg, p.state.bg) >= needRatio(p.state.level), p.id);
});

test("réglages dans les bornes de l’interface", () => {
  for (const p of PRESETS) {
    const s = p.state;
    assert.ok(["AA", "AAA"].includes(s.level) && ["2.0", "2.1", "2.2"].includes(s.version), p.id);
    assert.ok([44, 48, 56].includes(s.ds.btn), p.id + " btn");
    if (s.ds.shape) assert.ok(["square", "soft", "round", "pill"].includes(s.ds.shape));
    if (s.ds.link) assert.ok(["dotted", "solid"].includes(s.ds.link));
    if (s.ds.space) assert.ok([4, 8].includes(s.ds.space));
    assert.ok(s.tsPreset.base >= 10 && s.tsPreset.base <= 32);
    assert.ok(["1.067", "1.125", "1.15", "1.2", "1.25", "1.333", "1.414", "1.5"].includes(s.tsPreset.ratio));
  }
});

test("chaque règle cite sa source : un critère WCAG réel, ou un choix assumé", () => {
  for (const p of PRESETS) for (const [rule, src] of p.rules) {
    assert.ok(rule.length > 10, rule);
    assert.ok(/^\d\.\d\.\d+$/.test(src) ? !!criterion(src) : /^(WCAG 2\.2|Choix de Lisio|Choix de l’équipe)$/.test(src), p.id + " : " + src);
  }
});

test("présentés comme un point de départ, jamais comme un système validé", () => {
  assert.match(PRESET_LIMITS, /Point de départ/);
  assert.doesNotMatch(JSON.stringify(PRESETS), /certifi|conforme|100 %/i);
});
