// Garde-fou pour les développeurs (src/core/devcheck.mjs), avec le lisio.css de référence.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { lisioScan, devCheckScript, DEVCHECK_WORKFLOW } from "../src/core/devcheck.mjs";
const TOK = readFileSync(new URL("./golden/exemple/ds.css", import.meta.url), "utf8");

test("couleur hors palette : erreur dans une feuille de style, avertissement dans du JS", () => {
  const r = lisioScan([{ path: "a.css", text: ".x{border-color:#123456}" }, { path: "b.js", text: "const c = '#123456';" }], TOK, "AA");
  assert.equal(r.errors.length, 1); assert.equal(r.errors[0].rule, "hors-palette"); assert.match(r.errors[0].message, /la plus proche : var\(--/);
  assert.equal(r.warnings.filter(w => w.rule === "hors-palette").length, 1);
});
test("couleur du design system écrite en dur : avertissement avec la variable", () => {
  const r = lisioScan([{ path: "a.css", text: ".x{border-color:#0E1B4D}" }], TOK, "AA");
  assert.equal(r.errors.length, 0); assert.match(r.warnings[0].message, /var\(--nuit\)/);
});
test("paire color + background sous le seuil : erreur ; au-dessus : rien", () => {
  const bad = lisioScan([{ path: "a.css", text: ".x{color:var(--nuit-400);background:var(--nuit-100)}" }], TOK, "AA");
  assert.equal(bad.errors.length, 1); assert.equal(bad.errors[0].rule, "contraste"); assert.match(bad.errors[0].message, /il faut 4,5:1/);
  const ok = lisioScan([{ path: "a.css", text: ".x{color:var(--nuit-900);background-color:var(--nuit-50)}" }], TOK, "AA");
  assert.equal(ok.errors.length, 0);
  const aaa = lisioScan([{ path: "a.css", text: ".x{color:var(--nuit-600);background:var(--nuit-50)}" }], TOK, "AAA");
  assert.ok(aaa.errors.some(e => e.rule === "contraste"));
});
test("rôles (alias var()) résolus en mode clair", () => {
  const r = lisioScan([{ path: "a.css", text: ".x{color:var(--text-default);background:var(--background-default)}" }], TOK, "AA");
  assert.equal(r.errors.length, 0);
  assert.ok(r.tokens > 50);
});
test("classes Tailwind text-… et bg-… sur un même élément", () => {
  const r = lisioScan([{ path: "a.jsx", text: '<p className="p-4 text-nuit-300 bg-nuit-50 hover:text-nuit-900">x</p>' }], TOK, "AA");
  assert.equal(r.errors.length, 1); assert.match(r.errors[0].message, /text-nuit-300 sur bg-nuit-50/);
});
test("lisio-ignore et ancres #abc ignorées", () => {
  const r = lisioScan([{ path: "a.css", text: ".x{border-color:#123456} /* lisio-ignore */" }, { path: "b.html", text: '<a href="page#abc">x</a>' }], TOK, "AA");
  assert.equal(r.errors.length + r.warnings.length, 0);
});
test("le script généré tourne avec Node, sans dépendance, et rend le bon code de sortie", () => {
  const d = mkdtempSync(join(tmpdir(), "lisio-check-")); mkdirSync(join(d, "src"));
  writeFileSync(join(d, "lisio-check.mjs"), devCheckScript("AA", "test"));
  writeFileSync(join(d, "src", "lisio.css"), TOK);
  writeFileSync(join(d, "src", "ok.css"), ".x{color:var(--text-default);background:var(--background-default)}");
  assert.equal(spawnSync(process.execPath, ["lisio-check.mjs"], { cwd: d }).status, 0);
  writeFileSync(join(d, "src", "ko.css"), ".y{color:#999;background:#fff}");
  const run = spawnSync(process.execPath, ["lisio-check.mjs"], { cwd: d, encoding: "utf8" });
  assert.equal(run.status, 1); assert.match(run.stdout, /ko\.css:1/); assert.match(run.stdout, /erreur/);
  assert.equal(spawnSync(process.execPath, ["lisio-check.mjs", "--warn-only"], { cwd: d }).status, 0);
  const gh = spawnSync(process.execPath, ["lisio-check.mjs"], { cwd: d, encoding: "utf8", env: { ...process.env, GITHUB_ACTIONS: "true" } });
  assert.match(gh.stdout, /::error file=src\/ko\.css,line=1/);
  const js = JSON.parse(execFileSync(process.execPath, ["lisio-check.mjs", "--json", "--warn-only"], { cwd: d, encoding: "utf8" }));
  assert.ok(js.errors.length >= 1);
  assert.match(DEVCHECK_WORKFLOW, /node lisio-check\.mjs/);
});
