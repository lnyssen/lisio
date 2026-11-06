// Tests de l'import de projet (fichier ou lien). Lancer : node --test tests/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkProject, conform, PRJ_VERSION, LINK_MAX, COLORS_MAX, LIMITS } from "../src/core/project.mjs";

const TPL = { font: { src: "google", family: "Figtree" }, size: 18, level: "AA", version: "2.2", showFail: false,
  ts: { v: 2, fonts: { head: { family: "Figtree" } }, styles: [{ id: "h1", min: 32, max: 48 }] }, ds: { roles: {}, shape: "soft", layout: null } };
const ENUMS = { level: ["AA", "AAA"], version: ["2.0", "2.1", "2.2"] };
const ok = (over = {}) => ({ lisio: "project", v: 1, name: "Site 2027", savedAt: "2026-11-05T10:00:00Z",
  colors: [{ name: "Marine", hex: "#0D1D45" }, { name: "Blanc", hex: "#faf9f4" }], state: { level: "AAA", size: 20 }, ...over });
const run = o => checkProject(o, TPL, ENUMS);

test("un projet valide passe, couleurs normalisées, sans remarque", () => {
  const r = run(ok());
  assert.equal(r.ok, true); assert.deepEqual(r.notes, []);
  assert.equal(r.project.name, "Site 2027");
  assert.deepEqual(r.project.colors, [{ name: "Marine", hex: "#0D1D45" }, { name: "Blanc", hex: "#FAF9F4" }]);
  assert.equal(r.project.state.level, "AAA"); assert.equal(r.project.state.size, 20);
});

test("refus explicites : pas un projet, export Figma, version plus récente, version illisible", () => {
  assert.equal(run(null).reason, "not-project");
  assert.equal(run("x").reason, "not-project");
  assert.equal(run({ color: {}, typography: {} }).reason, "figma-export");
  assert.equal(run(ok({ v: PRJ_VERSION + 1 })).reason, "newer");
  assert.equal(run(ok({ v: "1" })).reason, "bad-version");
  assert.equal(run(ok({ v: 0 })).reason, "bad-version");
});

test("sans numéro de version : accepté, avec une remarque", () => {
  const o = ok(); delete o.v; const r = run(o);
  assert.equal(r.ok, true); assert.ok(r.notes.some(n => /version/i.test(n)));
});

test("couleurs : une seule invalide refuse tout, plus de 12 refuse", () => {
  assert.equal(run(ok({ colors: [{ hex: "#12" }] })).reason, "bad-color");
  assert.equal(run(ok({ colors: "rouge" })).reason, "bad-color");
  assert.equal(run(ok({ colors: Array.from({ length: COLORS_MAX + 1 }, () => ({ hex: "#000" })) })).reason, "too-many-colors");
});

test("noms : texte forcé, 40 caractères au plus ; nom de projet 80", () => {
  const r = run(ok({ name: "N".repeat(200), colors: [{ name: 42, hex: "#000" }, { hex: "#fff" }] }));
  assert.equal(r.project.name.length, 80);
  assert.deepEqual(r.project.colors.map(c => c.name), ["42", "Couleur"]);
});

test("état : mauvais type → valeur par défaut, et c'est dit", () => {
  const r = run(ok({ state: { size: "grand", font: "Arial", showFail: 1, ts: [] } }));
  assert.equal(r.ok, true);
  assert.equal(r.project.state.size, 18); assert.deepEqual(r.project.state.font, TPL.font);
  assert.equal(r.project.state.showFail, false); assert.deepEqual(r.project.state.ts, TPL.ts);
  assert.equal(r.notes.length, 4);
});

test("état : niveau et version WCAG hors liste → défaut, et c'est dit", () => {
  const r = run(ok({ state: { level: "AAAA", version: "3.0" } }));
  assert.equal(r.project.state.level, "AA"); assert.equal(r.project.state.version, "2.2");
  assert.equal(r.notes.length, 2);
});

test("état : clés inconnues gardées (réglages récents), clés dangereuses retirées", () => {
  const st = JSON.parse('{"sysTheme":"dark","__proto__":{"pwn":1},"ds":{"constructor":{"x":1},"shape":"round"}}');
  const r = run(ok({ state: st }));
  assert.equal(r.project.state.sysTheme, "dark"); assert.equal(r.project.state.ds.shape, "round");
  assert.equal(Object.prototype.hasOwnProperty.call(r.project.state, "__proto__"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(r.project.state.ds, "constructor"), false);
  assert.equal({}.pwn, undefined);
});

test("état : null autorisé là où le modèle vaut null ; tableau d'objets vérifié élément par élément", () => {
  const r = run(ok({ state: { ds: { layout: { xl: 1 } }, ts: { v: 2, styles: [{ id: "h1" }, 7] } } }));
  assert.deepEqual(r.project.state.ds.layout, { xl: 1 });
  assert.deepEqual(r.project.state.ts.styles, TPL.ts.styles);
});

test("lien Figma : seulement https sur figma.com", () => {
  assert.equal(run(ok({ state: { figma: "https://www.figma.com/design/abc" } })).project.state.figma, "https://www.figma.com/design/abc");
  for (const bad of ["javascript:alert(1)", "http://figma.com/x", "https://figma.com.evil.io/x"]) {
    const r = run(ok({ state: { figma: bad } })); assert.equal(r.project.state.figma, undefined, bad); assert.equal(r.notes.length, 1); }
});

test("textes trop longs coupés, profondeur bornée", () => {
  let deep = {}; const root = deep; for (let i = 0; i < 30; i++) { deep.a = {}; deep = deep.a; }
  const r = run(ok({ state: { note: "x".repeat(50000), deep: root } }));
  assert.ok(r.project.state.note.length <= 5000);
  assert.ok(JSON.stringify(r.project.state.deep).length < 200);
});

test("conform ne modifie jamais l'objet reçu", () => {
  const o = ok({ state: { size: "x" } }), copy = JSON.parse(JSON.stringify(o)); run(o);
  assert.deepEqual(o, copy);
  const notes = []; const v = conform({ a: 1 }, { a: "t" }, "", notes); assert.deepEqual(v, { a: "t" }); assert.equal(notes.length, 1);
});

test("LINK_MAX suit la recommandation de 8 000 octets (RFC 9110, § 4.1)", () => assert.equal(LINK_MAX, 8000));

// P0-3 · Notes d'import dans les mots de l'interface, jamais les noms techniques des réglages.
test("notes d'import en français, sans nom technique", () => {
  const r = run(ok({ state: { size: "grand", level: "AAAA", showFail: 1, ts: { styles: [{ id: "h1", min: "x", max: 48 }] } } }));
  assert.equal(r.ok, true);
  for (const n of r.notes) assert.doesNotMatch(n, /«\s?(size|level|version|ts|ds|font|showFail|min|max|lh|ls)[\s.»[]/, n);
  assert.ok(r.notes.some(n => n.includes("Taille du texte")), r.notes.join(" | "));
  assert.ok(r.notes.some(n => n.includes("Niveau WCAG")), r.notes.join(" | "));
  assert.ok(r.notes.some(n => n.includes("Styles de texte")), r.notes.join(" | "));
});

// P0-3 · Valeurs absurdes : ramenées dans les bornes de l'interface, et c'est dit.
test("valeurs hors bornes ramenées aux limites de l'interface, avec une note", () => {
  const r = run(ok({ state: { size: 0, lh: 9, ts: { styles: [{ id: "h1", min: 0, max: 48 }] } } }));
  assert.equal(r.ok, true);
  assert.equal(r.project.state.size, LIMITS.size[0]); assert.equal(r.project.state.lh, LIMITS.lh[1]);
  assert.equal(r.project.state.ts.styles[0].min, LIMITS["ts.styles[].min"][0]); assert.equal(r.project.state.ts.styles[0].max, 48);
  assert.equal(r.notes.length, 3, r.notes.join(" | "));
  assert.ok(r.notes.some(n => /Taille du texte.*0.*10/.test(n)), r.notes.join(" | "));
  // Une valeur dans les bornes ne bouge pas et ne produit pas de note.
  const s = run(ok({ state: { size: 72, lh: 1 } })); assert.deepEqual(s.notes, []); assert.equal(s.project.state.size, 72);
});

// P0-4 · Réglages des nuances et du design system venus de la branche de travail : bornés aussi.
test("nuances et ombres hors bornes ramenées, avec une note en français", () => {
  const r = checkProject(ok({ state: { sh: { light: 1, dark: 40, sat: 3, exact: false }, ds: { elevI: 9, glassBlur: -4 } } }), { ...TPL, sh: { light: 1.06, dark: 17.6, sat: 1, exact: false }, ds: { ...TPL.ds, elevI: 1, glassBlur: 12 } }, ENUMS);
  assert.deepEqual([r.project.state.sh.light, r.project.state.sh.dark, r.project.state.sh.sat], [1.03, 19.5, 1.4]);
  assert.deepEqual([r.project.state.ds.elevI, r.project.state.ds.glassBlur], [2.5, 0]);
  assert.equal(r.notes.length, 5, r.notes.join(" | "));
  assert.ok(r.notes.every(n => /^(Nuances|Design system)/.test(n)), r.notes.join(" | "));
});
