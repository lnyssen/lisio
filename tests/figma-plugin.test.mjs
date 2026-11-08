// P0-6 · Plugin Figma : il compare avant d'écrire, ne supprime et ne renomme rien sans accord,
// et mesure les contrastes avec le cœur de Lisio (src/core), pas avec sa propre copie.
// Exécute figma-plugin/code.js (produit par python3 src/build.py) avec un faux figma (tests/figma-mock.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { makeFigma, loadPlugin, dsJson, snapshot, ROOT } from "./figma-mock.mjs";
import { ratio, hex2rgb } from "../src/core/color.mjs";
import { floor2, largeText, needRatio } from "../src/core/wcag.mjs";
import { rng, randHex } from "./ref.mjs";

const CODE = join(ROOT, "figma-plugin", "code.js");
const setup = opts => { const figma = makeFigma(opts), p = loadPlugin(figma); return { figma, p, plan: (d, o) => p.get("lisioPlan")(d, o), imp: (d, o) => p.get("lisioImport")(d, o) }; };
const rgb = h => { const [r, g, b] = hex2rgb(h); return { r, g, b }; };
const col = (figma, name) => figma.variables.cols.find(c => c.name === name);
const vr = (figma, c, name) => figma.variables.vars.find(v => v.variableCollectionId === col(figma, c).id && v.name === name);
const names = l => l.map(x => x.name);

test("fichier vide : tout est un ajout, et l'aperçu n'écrit rien", async () => {
  const { figma, plan } = setup(), before = JSON.stringify(snapshot(figma));
  const pl = await plan(dsJson(), { board: true });
  assert.ok(pl.add.length > 200, `ajouts : ${pl.add.length}`);
  assert.deepEqual([pl.update.length, pl.remove.length, pl.rename.length, pl.same], [0, 0, 0, 0]);
  assert.equal(JSON.stringify(snapshot(figma)), before, "l'aperçu a modifié le fichier");
});

test("import sur fichier vide : identique à la référence (aucune régression)", async () => {
  const gold = JSON.parse(readFileSync(join(ROOT, "tests", "golden", "figma-import.json"), "utf8"));
  for (const [key, ref] of Object.entries(gold)) {
    const [name, board, fam] = key.split("/"), { figma, imp } = setup(fam ? { families: ["Inter", fam] } : {});
    const r = await imp(dsJson(name), { board: board === "planche" });
    const got = { report: { variables: r.variables, created: r.created, updated: r.updated, styles: r.styles, warnings: r.warnings }, ...snapshot(figma), nodes: figma.nodes.size };
    assert.deepEqual(JSON.parse(JSON.stringify(got)), ref, key);
  }
});

test("deuxième import identique : l'aperçu ne signale aucun changement", async () => {
  const { figma, plan, imp } = setup(), d = dsJson();
  await imp(d, { board: false });
  const pl = await plan(d, { board: false });
  assert.deepEqual([pl.add.length, pl.update.length, pl.remove.length, pl.rename.length], [0, 0, 0, 0], JSON.stringify({ add: pl.add.slice(0, 5), update: pl.update.slice(0, 5) }));
  assert.ok(pl.same > 200, `inchangés : ${pl.same}`);
  const s0 = JSON.stringify(snapshot(figma)); await imp(d, { board: false });
  assert.equal(JSON.stringify(snapshot(figma)), s0, "réimporter le même fichier a changé quelque chose");
});

test("une valeur changée dans Figma est listée dans les modifications, avec l'ancienne et la nouvelle", async () => {
  const { figma, plan, imp } = setup(), d = dsJson();
  await imp(d, { board: false });
  const v = vr(figma, "Colors", "ink/main"), m = col(figma, "Colors").modes[0].modeId; v.setValueForMode(m, rgb("#FF0000"));
  const s = figma.styles.text.find(x => x.name === "Body/Mobile"); s.fontSize = 99;
  const mine = figma.variables.createVariable("mon-rouge", col(figma, "Colors"), "COLOR"); mine.setValueForMode(m, rgb("#FF0000"));
  const pl = await plan(d, { board: false });
  const u = pl.update.find(x => x.name === "Colors/ink/main");
  assert.ok(u && /#FF0000/.test(u.from) && u.to === d.color.ink.main.$value, JSON.stringify(pl.update));
  assert.ok(names(pl.update).includes("Body/Mobile"), "style de texte modifié non listé");
  assert.ok(!names(pl.remove).some(n => /mon-rouge/.test(n)), "une variable de l'équipe est proposée à la suppression");
  await imp(d, { board: false });
  assert.ok(vr(figma, "Colors", "mon-rouge"), "la variable de l'équipe a disparu");
});

test("type différent : rien n'est supprimé sans accord, et c'est dit", async () => {
  for (const allowDelete of [false, true]) {
    const { figma, plan, imp } = setup(), d = dsJson();
    const c = figma.variables.createVariableCollection("Colors"), v = figma.variables.createVariable("ink/main", c, "STRING");
    const pl = await plan(d, { board: false });
    assert.ok(pl.remove.some(x => x.name === "Colors/ink/main"), "conflit de type absent de l'aperçu");
    const r = await imp(d, { board: false, allowDelete });
    if (!allowDelete) {
      assert.ok(!v.removed && vr(figma, "Colors", "ink/main").resolvedType === "STRING", "variable supprimée sans accord");
      assert.ok(r.warnings.some(w => /ink\/main/.test(w)), "aucun avertissement");
    } else assert.ok(v.removed && vr(figma, "Colors", "ink/main").resolvedType === "COLOR", "accord donné : la variable devait être remplacée");
  }
});

test("base → main : rien n'est renommé sans accord", async () => {
  for (const allowRename of [false, true]) {
    const { figma, plan, imp } = setup(), d = dsJson();
    const c = figma.variables.createVariableCollection("Colors"), v = figma.variables.createVariable("ink/base", c, "COLOR");
    const pl = await plan(d, { board: false });
    assert.ok(pl.rename.some(x => x.from === "Colors/ink/base" && x.to === "Colors/ink/main"), JSON.stringify(pl.rename));
    await imp(d, { board: false, allowRename });
    if (!allowRename) { assert.equal(v.name, "ink/base"); assert.ok(vr(figma, "Colors", "ink/main"), "ink/main doit être créée à côté"); }
    else { assert.equal(v.name, "ink/main"); assert.equal(figma.variables.vars.filter(x => x.name === "ink/main").length, 1); }
  }
});

test("modes d'une collection existante : pas renommés sans accord", async () => {
  for (const allowRename of [false, true]) {
    const { figma, plan, imp } = setup(), d = dsJson();
    const t = figma.variables.createVariableCollection("Typography"), s = figma.variables.createVariableCollection("Semantic");
    s.renameMode(s.modes[0].modeId, "Default");
    const pl = await plan(d, { board: false });
    assert.ok(pl.rename.some(x => x.from === "Typography\u00a0: Mode 1" && x.to === "Typography\u00a0: Mobile"), JSON.stringify(pl.rename));
    assert.ok(pl.rename.some(x => x.from === "Semantic\u00a0: Default" && x.to === "Semantic\u00a0: Light"), JSON.stringify(pl.rename));
    const r = await imp(d, { board: false, allowRename });
    assert.equal(t.modes[0].name, allowRename ? "Mobile" : "Mode 1"); assert.equal(s.modes[0].name, allowRename ? "Light" : "Default");
    if (!allowRename) assert.ok(r.warnings.some(w => /Mode 1/.test(w)) && r.warnings.some(w => /Default/.test(w)), r.warnings.join(" | "));
  }
});

test("planche : l'ancienne n'est supprimée qu'avec accord", async () => {
  for (const allowDelete of [false, true]) {
    const { figma, plan, imp } = setup(), d = dsJson();
    const old = figma.createFrame(); old.name = "Color palette"; old.x = 50; old.width = 500;
    const pl = await plan(d, { board: true });
    assert.ok(pl.remove.some(x => x.kind === "planche" && x.name === "Color palette"), JSON.stringify(pl.remove));
    assert.equal((await plan(d, { board: false })).remove.length, 0, "sans planche, rien à supprimer");
    await imp(d, { board: true, allowDelete });
    assert.equal(!!old.removed, allowDelete);
    if (!allowDelete) assert.ok(figma.currentPage.children.filter(n => n.name === "Color palette").every(n => n === old || n.x >= old.x + old.width), "nouvelle planche posée sur l'ancienne");
  }
});

test("contraste : un seul calcul, celui du cœur de Lisio", () => {
  assert.ok(existsSync(CODE), "code.js absent : lancer python3 src/build.py");
  const code = readFileSync(CODE, "utf8");
  assert.ok(/const toLin = /.test(code) && /const largeText = /.test(code) && /const floor2 = /.test(code), "le cœur (src/core/color.mjs et wcag.mjs) n'est pas inliné dans code.js");
  assert.equal((code.match(/0\.2126/g) || []).length, 1, "le plugin garde sa propre formule de luminance");
  assert.ok(!/Math\.floor\([^)]*\* ?100\) ?\/ ?100/.test(code), "le plugin tronque les ratios à sa façon au lieu de floor2");
  const { p } = setup(), lr = p.get("lisioRatio"), r = rng(11);
  for (let i = 0; i < 5000; i++) { const a = randHex(r), b = randHex(r); assert.equal(lr(rgb(a), rgb(b)), ratio(a, b), `${a} ${b}`); }
});

test("audit : grand texte, seuil et ratio affiché comme dans Lisio", async () => {
  for (const [size, weight, level] of [[18.66, 700, "AA"], [18.65, 700, "AA"], [24, 400, "AAA"], [23.99, 400, "AAA"]]) {
    const { figma, p } = setup(), page = figma.currentPage;
    const fr = figma.createFrame(); fr.fills = [{ type: "SOLID", color: rgb("#F1E9DA") }]; fr.absoluteBoundingBox = { x: 0, y: 0, width: 400, height: 200 };
    const t = figma.node("TEXT", { characters: "Bonjour", fills: [{ type: "SOLID", color: rgb("#767676") }], absoluteBoundingBox: { x: 10, y: 10, width: 100, height: 20 } });
    t.getStyledTextSegments = () => [{ fills: t.fills, fontSize: size, fontWeight: weight, characters: t.characters }]; fr.appendChild(t);
    const res = await p.get("lisioAudit")({ level }), it = res.items[0], large = largeText(size, weight), raw = ratio("#767676", "#F1E9DA");
    assert.equal(it.large, large, `${size}px ${weight}`); assert.equal(it.need, needRatio(level, large)); assert.equal(it.ratio, floor2(raw)); assert.equal(it.ok, raw >= needRatio(level, large));
    assert.ok(page.children.includes(fr));
  }
});

// Messages du plugin : en français, typographie française (espace insécable), une fois par cause.
const OLD_EN = /could not be added|Missing alias|is not available|no italic style|Could not bind|Inter used instead|Accessible by design|Good contrast and a calm|document outline|each role points|clamp\(\) values|Get started/;
const frOk = w => !/ [:;!?»]|« |\b(could|not|available|missing|found|bind|used|instead|only|the|and|values)\b/i.test(w);
test("messages : en français, sans doublon, avec la typographie française", async () => {
  assert.ok(!OLD_EN.test(readFileSync(CODE, "utf8")), `texte anglais restant : ${(readFileSync(CODE, "utf8").match(OLD_EN) || [])[0]}`);
  { const { plan, imp } = setup(), d = dsJson();
    const pl = await plan(d, { board: true }), r = await imp(d, { board: true });
    assert.equal(r.warnings.length, 1, r.warnings.join(" | "));
    assert.match(r.warnings[0], /^Police «\u00a0Figtree\u00a0» absente de Figma\u00a0: Inter à la place/); assert.equal(r.warnings[0], pl.warnings[0], "l'aperçu et le bilan disent la même chose");
    for (const w of [...r.warnings, ...pl.warnings]) assert.ok(frOk(w), w); }
  { const { imp } = setup({ maxModes: 1 }), r = await imp(dsJson(), { board: false });
    const modes = r.warnings.filter(w => /mode/.test(w));
    assert.ok(modes.length >= 2 && modes.every(w => /ne peut pas être ajouté/.test(w)), r.warnings.join(" | "));
    for (const w of r.warnings) assert.ok(frOk(w), w); }
  { const { imp } = setup(), d = dsJson(); let hit = null;
    const walk = o => { for (const [k, v] of Object.entries(o)) { if (hit) return; if (v && typeof v === "object") { if (typeof v.$value === "string" && v.$value.startsWith("{") && !k.startsWith("$")) { v.$value = "{color.inexistante.main}"; hit = k; return; } walk(v); } } };
    walk(d.semantic); assert.ok(hit, "aucun alias trouvé dans l'exemple");
    const r = await imp(d, { board: false }), w = r.warnings.find(x => /inexistante/.test(x));
    assert.ok(w && /^Alias introuvable/.test(w) && frOk(w), r.warnings.join(" | ")); }
});

test("jetons de composants : une collection Components, chaque variable en alias vers Semantic, nom CSS identique", async () => {
  const { figma, imp } = setup();
  await imp(dsJson(), { board: false });
  const c = col(figma, "Components"); assert.ok(c, "collection Components");
  const v = vr(figma, "Components", "button/primary-background"), sem = vr(figma, "Semantic", "action/default");
  const val = v.valuesByMode[c.modes[0].modeId];
  assert.equal(val.type, "VARIABLE_ALIAS"); assert.equal(val.id, sem.id, "alias vers Semantic/action/default");
  assert.equal(v.codeSyntax.WEB, "var(--button-primary-background)");
  assert.equal(sem.codeSyntax.WEB, "var(--action-default)", "le rôle porte le même nom que dans le CSS");
});

test("correcteur du plugin : sans couleur de la palette qui passe, il garde la teinte avant de proposer noir ou blanc", () => {
  const { p } = setup(), fix = p.get("lisioFix"), bg = rgb("#FFFFFF");
  // Palette sans aucune nuance qui passe sur blanc : l'ancien correcteur proposait du noir.
  const pal = [{ id: "v1", name: "Ciel/300", c: rgb("#7DD3FC") }];
  const f = fix(rgb("#38BDF8"), bg, 4.5, pal, "Ciel");
  assert.ok(f && f.hex !== "#000000" && f.hex !== "#FFFFFF", `proposé : ${f && f.hex}`);
  assert.ok(ratio(f.hex, "#FFFFFF") >= 4.5, `ratio ${ratio(f.hex, "#FFFFFF")}`);
  assert.match(f.name, /même teinte/);
  // Une nuance de la palette qui passe reste préférée : elle garde le lien avec la variable.
  const g = fix(rgb("#38BDF8"), bg, 4.5, [...pal, { id: "v2", name: "Ciel/700", c: rgb("#0369A1") }], "Ciel");
  assert.equal(g.varId, "v2");
});
