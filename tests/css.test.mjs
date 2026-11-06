// F12 : catégories et variables du CSS exporté. Lancer : node --test tests/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { cssSections, cssTree, cssVars, cssVarsOnly, cssIdentOk, uniqueSlugs } from "../src/core/css.mjs";

const CSS = `/* Lisio: header. */

/* ===== 1. Primitives ===== */
:root {
  --bleu: #2F6BFF;
  --bleu-50: #F0F4FF;
}

/* ===== 2. Semantic roles (light mode) ===== */
:root {
  color-scheme: light;
  --text-default: var(--bleu-50); /* Primary text */
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --text-default: #FFFFFF;
  }
}

/* ===== 4. Typography ===== */
h1, .t-h1 {
  font-size: var(--font-size-h1);
}
`;

test("catégories dans l’ordre, libellés en français, en-tête gardé", () => {
  const s = cssSections(CSS);
  assert.deepEqual(s.map(x => x.label), ["Couleurs (primitives)", "Rôles", "Typographie"]);
  assert.match(s[0].text, /Lisio: header/);
  assert.equal(s.map(x => x.text).join(""), CSS);
});

test("variables avec leur contexte, commentaires ignorés", () => {
  const v = cssVars(CSS);
  assert.deepEqual(v.map(x => x.name), ["--bleu", "--bleu-50", "--text-default", "--text-default"]);
  assert.equal(v[2].value, "var(--bleu-50)");
  assert.deepEqual(v[3].ctx, ["@media (prefers-color-scheme: dark)", ':root:not([data-theme="light"])']);
});

test("variables seules : CSS relisible, sans règle de style, contexte gardé", () => {
  const o = cssVarsOnly(CSS);
  assert.doesNotMatch(o, /font-size|color-scheme: light|h1/);
  assert.match(o, /@media \(prefers-color-scheme: dark\) \{\n  :root:not\(\[data-theme="light"\]\) \{\n    --text-default: #FFFFFF;/);
  assert.equal(cssVars(o).length, 4);
});

test("accolades déséquilibrées : erreur explicite", () => {
  assert.throws(() => cssTree(":root { --a: 1;"), /non fermée/);
  assert.throws(() => cssTree("--a: 1; }"), /en trop/);
});

test("noms : identifiants valides, doublons numérotés de façon stable", () => {
  assert.ok(cssIdentOk("--bleu-500") && cssIdentOk("--text-default"));
  assert.ok(!cssIdentOk("--Bleu") && !cssIdentOk("--a b") && !cssIdentOk("--é") && !cssIdentOk("--a--b"));
  assert.deepEqual(uniqueSlugs(["bleu", "bleu", "rouge", "bleu"]), ["bleu", "bleu-2", "rouge", "bleu-3"]);
  assert.deepEqual(uniqueSlugs(["error", "bleu"], ["error"]), ["error-2", "bleu"]);
  assert.deepEqual(uniqueSlugs(["a", "a"]), uniqueSlugs(["a", "a"]));
});
