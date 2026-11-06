// F13 (P2) : bibliothèque de composants. Un registre unique : ajouter un composant n'oblige pas à dupliquer la logique.
//   node --test tests/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { COMPONENTS, COMP_STATE_FR, COMP_LIMITS, compStatus, compCounts } from "../src/core/components.mjs";

const BLUEPRINT = ["default", "hover", "focus", "pressed", "disabled", "loading", "error", "success"];

test("les sept composants du blueprint, chacun documenté", () => {
  assert.deepEqual(COMPONENTS.map(c => c.id), ["button", "field", "link", "alert", "badge", "nav", "card"]);
  for (const c of COMPONENTS) {
    assert.ok(c.name && c.use && c.limits, c.id);
    assert.ok(c.tokens.length && c.tokens.every(k => /^[a-z-]+\/[a-z-]+$/.test(k)), c.id + " : tokens");
    assert.ok(c.states.length >= 2, c.id + " : états");
    for (const s of c.states) { assert.ok(COMP_STATE_FR[s.s], c.id + " : état inconnu " + s.s); assert.ok(s.html.trim()); for (const k of s.check || []) assert.ok(c.tokens.includes(k), `${c.id}/${s.s} : ${k} absent des tokens`); }
  }
});

test("les huit états du blueprint sont tous dessinés", () => {
  const all = new Set(COMPONENTS.flatMap(c => c.states.map(s => s.s)));
  for (const s of BLUEPRINT) assert.ok(all.has(s), s);
});

test("états simulés hors du clavier, vrais états au clavier, identifiants uniques, champs étiquetés", () => {
  const ids = [];
  for (const c of COMPONENTS) for (const s of c.states) {
    const h = s.html;
    if (/class="[^"]*\bis-(hover|focus|active)\b/.test(h)) assert.match(h, /tabindex="-1"/, `${c.id}/${s.s} : état simulé hors du parcours clavier`);
    if (s.s === "default" && /<(button|a|input)\b/.test(h)) assert.doesNotMatch(h, /tabindex="-1"/, `${c.id}/default : atteignable au clavier`);
    for (const m of h.matchAll(/\sid="([^"]+)"/g)) ids.push(m[1]);
    for (const m of h.matchAll(/<input[^>]*\sid="([^"]+)"/g)) assert.match(h, new RegExp(`for="${m[1]}"`), `${c.id}/${s.s} : étiquette de ${m[1]}`);
  }
  assert.equal(new Set(ids).size, ids.length, "identifiants uniques");
});

test("erreur, succès, alerte : dits en mots, pas seulement en couleur", () => {
  for (const c of COMPONENTS) for (const s of c.states) if (["error", "success", "warning", "info"].includes(s.s)) {
    const words = s.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    assert.ok(words.length >= 4, `${c.id}/${s.s} : « ${words} »`);
  }
});

test("statut d'un état : mesuré, en échec, ou à vérifier à la main", () => {
  const c = { states: [{ s: "default", check: ["a/b"] }, { s: "hover", check: ["c/d"] }, { s: "loading", manual: "Annoncé ?" }, { s: "focus", check: ["e/f"], manual: "Visible partout ?" }, { s: "disabled", check: ["g/h"] }] };
  const m = k => ({ "a/b": "pass", "c/d": "fail", "e/f": "pass", "g/h": "na" })[k];
  assert.deepEqual(compStatus(c, m).map(x => x.status), ["pass", "fail", "manual", "pass", "na"]);
  assert.deepEqual(compCounts(compStatus(c, m)), { pass: 2, fail: 1, manual: 2, na: 1 });
});

test("les limites sont dites : mesurer n'est pas prouver", () => {
  assert.match(COMP_LIMITS, /ne prouve pas/);
  assert.doesNotMatch(COMP_LIMITS + COMPONENTS.map(c => c.limits + c.use).join(" "), /accessible à 100|certifié|composants? accessibles?\b(?! sans)|conforme(?! au test)/i);
});
