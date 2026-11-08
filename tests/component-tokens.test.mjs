// P2 · Jetons de composants (couche 3) : chaque jeton pointe vers un rôle (couche 2), et les composants
// exportés n'utilisent plus que ces jetons pour leurs couleurs. Vérifié sur les exports de référence
// (tests/golden), eux-mêmes comparés à la page par tests/e2e/golden.mjs.
//   node --test tests/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { COMPONENTS, COMP_TOKENS, compTokenVar } from "../src/core/components.mjs";

const GOLD = join(dirname(fileURLToPath(import.meta.url)), "golden");
const css = n => readFileSync(join(GOLD, n, "ds.css"), "utf8"), json = n => JSON.parse(readFileSync(join(GOLD, n, "ds.json"), "utf8"));

test("registre : noms uniques, en kebab-case, chacun vers un rôle", () => {
  const names = COMP_TOKENS.map(t => `${t.comp}-${t.name}`);
  assert.equal(new Set(names).size, names.length, "noms uniques");
  for (const t of COMP_TOKENS) {
    assert.match(`${t.comp}-${t.name}`, /^[a-z]+(-[a-z]+)*$/, t.name);
    assert.match(t.role, /^[a-z-]+\/[a-z-]+$/, t.name);
    assert.ok(t.en && t.fr, `${t.name} : descriptions`);
  }
  assert.equal(compTokenVar({ comp: "button", name: "primary-background" }), "--button-primary-background");
});

test("chaque composant du registre a ses jetons, et ils couvrent les rôles mesurés", () => {
  for (const c of COMPONENTS) {
    const mine = COMP_TOKENS.filter(t => t.comp === c.id);
    assert.ok(mine.length >= 2, `${c.id} : ${mine.length} jeton(s)`);
    for (const st of c.states) for (const k of st.check || []) if (k !== "focus/ring") assert.ok(mine.some(t => t.role === k), `${c.id}/${st.s} : aucun jeton pour ${k}`);
  }
  assert.ok(COMP_TOKENS.some(t => t.comp === "focus" && t.role === "focus/ring"), "jeton de focus partagé");
});

test("CSS exporté : une couche 3 qui pointe vers la couche 2", () => {
  for (const n of ["exemple", "media-animation"]) {
    const c = css(n), block = c.split("/* ===== Component tokens")[1].split("\n}\n")[0];
    for (const t of COMP_TOKENS) assert.ok(block.includes(`  ${compTokenVar(t)}: var(--${t.role.replace("/", "-")});`), `${n} : ${compTokenVar(t)}`);
    assert.doesNotMatch(block, /#[0-9a-f]{3,8}\b/i, "aucune valeur brute dans la couche 3");
  }
});

test("CSS exporté : les composants n'utilisent plus les rôles directement pour leurs couleurs", () => {
  const c = css("exemple"), comp = c.split("/* ===== 6. Components and their states ===== */")[1].split("@media (forced-colors")[0];
  for (const sel of [".btn-primary", ".btn-secondary", ".alert-error", ".field input"]) assert.ok(comp.includes(sel), sel);
  const bad = [...comp.matchAll(/(?:^|[;{\s])(?:background|color|border-color|border)\s*:[^;]*var\(--(action|text|background|border(?!-width)|link|disabled|error|success|warning|info)-[a-z-]+\)/gm)].map(m => m[0].trim());
  assert.deepEqual(bad, [], "couleurs de composants prises dans la couche 2");
  assert.match(comp, /\.btn-primary \{ background: var\(--button-primary-background\); color: var\(--button-primary-text\); \}/);
});

test("JSON exporté : groupe component, en alias vers semantic", () => {
  const j = json("exemple");
  assert.ok(j.component && j.component.$description, "groupe component");
  for (const t of COMP_TOKENS) {
    const tok = j.component[t.comp] && j.component[t.comp][t.name];
    assert.ok(tok, `${t.comp}.${t.name}`);
    assert.equal(tok.$type, "color");
    assert.equal(tok.$value, `{semantic.${t.role.replace("/", ".")}}`, t.name);
    const [g, k] = t.role.split("/"); assert.ok(j.semantic[g] && j.semantic[g][k], `rôle ${t.role} présent dans semantic`);
  }
});

test("aucun jeton de composant ne porte le nom d'un rôle (sinon la variable CSS se référence elle-même)", () => {
  for (const t of COMP_TOKENS) assert.notEqual(compTokenVar(t), `--${t.role.replace("/", "-")}`, compTokenVar(t));
  const roles = new Set(Object.keys(json("exemple").semantic).filter(g => g[0] !== "$").flatMap(g => Object.keys(json("exemple").semantic[g]).filter(k => k[0] !== "$").map(k => `--${g}-${k}`)));
  for (const t of COMP_TOKENS) assert.ok(!roles.has(compTokenVar(t)), `${compTokenVar(t)} existe déjà comme rôle`);
});
