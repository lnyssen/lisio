// P0-4 · Travail de la branche wip/parcours-nuances, intégré : page Couleurs (saisie et « À corriger »),
// réglage des nuances, blocs à inclure dans l'export, arrondi des images au choix, paire → rôles.
//   node tests/e2e/nuances.mjs
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PAGE = "file://" + (process.env.LISIO_PAGE || join(ROOT, "index.html"));
let chromium;
try { ({ chromium } = createRequire(import.meta.url)("playwright")); } catch (e) { console.log("IGNORÉ : Playwright introuvable."); process.exit(process.env.CI ? 1 : 0); }

const browser = await chromium.launch();
let fails = 0;
const report = (ok, label, detail = "") => { if (!ok) fails++; console.log(`${ok ? "ok   " : "ÉCHEC"} ${label}${detail ? " : " + detail : ""}`); };
const COLORS = [{ name: "Encre", hex: "#0E1B4D" }, { name: "Corail", hex: "#FF5A4E" }, { name: "Sable", hex: "#F1E9DA" }, { name: "Gris", hex: "#767676" }];
async function open(view, colors = COLORS) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(c => { try { if (!sessionStorage.getItem("t-init")) { sessionStorage.setItem("t-init", "1"); localStorage.clear(); localStorage.setItem("lisio-welcome", "1"); localStorage.setItem("lisio:colors", JSON.stringify(c)); } } catch (e) {} }, colors);
  await ctx.route(/^https?:/, r => r.abort());
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.goto(PAGE + "#" + view); await p.waitForTimeout(600); p.errs = errs; p.ctx = ctx; return p;
}
const go = async (p, v) => { await p.evaluate(v => { location.hash = v; }, v); await p.waitForTimeout(200); };
// Exports tels que la page Styles les produit (comme tests/e2e/golden.mjs).
const exportsOf = async p => { await go(p, "styles"); return p.evaluate(() => { const $ = id => document.getElementById(id), run = (s, v, o) => { s.value = v; s.dispatchEvent(new Event("change")); return $(o).textContent; };
  return { json: run($("tsFmt"), "json", "tsOut"), css: run($("tsFmt"), "css", "tsOut"), pal: run($("exportFmt"), "json", "exportOut") }; }); };
const nuances = p => p.evaluate(() => [...document.querySelectorAll("#palette code, #palette .hex")].map(e => e.textContent.trim()).filter(t => /^#[0-9A-F]{6}$/i.test(t)).join(" "));

// 1. Page Couleurs : la saisie y est, et une couleur qui ne se lit avec aucune autre est signalée avec sa correction.
{ const p = await open("couleurs");
  const r = await p.evaluate(() => ({ h1: document.querySelector("#couleurs h1").textContent, inputs: document.querySelectorAll("#couleurs input.hex").length, watch: document.getElementById("cWatch").textContent }));
  report(r.h1 === "Couleurs" && r.inputs === 4, "page Couleurs : titre et 4 champs de saisie", JSON.stringify({ h1: r.h1, n: r.inputs }));
  report(/Gris/.test(r.watch) && /Corriger/.test(r.watch), "Gris (#767676) ne se lit avec aucune autre : signalé, avec « Corriger »", r.watch.slice(0, 160));
  const before = await p.evaluate(() => localStorage.getItem("lisio:colors"));
  await p.evaluate(() => { const b = [...document.querySelectorAll("#cWatch button")].find(x => /Corriger/.test(x.textContent)); b.click(); }); await p.waitForTimeout(250);
  const after = await p.evaluate(() => ({ c: localStorage.getItem("lisio:colors"), w: document.getElementById("cWatch").textContent }));
  report(after.c !== before && !/Gris.*Corriger/.test(after.w), "« Corriger » change la couleur et la retire de la liste", after.w.slice(0, 120));
  report(!p.errs.length, "page Couleurs : aucune erreur JavaScript", p.errs.join(" | ")); await p.ctx.close(); }

// 2. Réglage des nuances : 950 « Douce » vise 15:1 sur blanc ; revenir à « Standard » rend exactement les nuances d'avant.
{ const p = await open("palette");
  const n0 = await nuances(p);
  await p.click('#shDark button[data-v="15"]'); await p.waitForTimeout(250);
  const d = await p.evaluate(() => { const c = [...document.querySelectorAll("#palette code, #palette .hex")].map(e => e.textContent.trim()).filter(t => /^#[0-9A-F]{6}$/i.test(t)); return c; });
  const n1 = await nuances(p);
  await p.click('#shDark button[data-v="17.6"]'); await p.waitForTimeout(250);
  const n2 = await nuances(p);
  report(n0.length > 0 && n1 !== n0 && n2 === n0, "nuance 950 réglable, et le réglage Standard rend les nuances d'origine", `${n0.split(" ").length} codes`);
  await p.fill("#shSat", "0.5"); await p.dispatchEvent("#shSat", "input"); await p.waitForTimeout(400);
  report(await nuances(p) !== n0, "saturation 50 % : les nuances changent");
  report(!p.errs.length, "Nuances : aucune erreur JavaScript", p.errs.join(" | ")); await p.ctx.close(); }

// 3. Blocs à inclure : décocher « Animations » le retire du JSON et du CSS, et le dit dans le JSON ; recocher rend l'export identique.
{ const p = await open("systeme");
  const e0 = await exportsOf(p);
  await go(p, "systeme"); await p.evaluate(() => { const c = document.querySelector('#dsIncG [data-inc="motion"]'); c.click(); }); await p.waitForTimeout(200);
  const e1 = await exportsOf(p);
  const j = JSON.parse(e1.json);
  report(!("motion" in j) && !/--duration-fast:/.test(e1.css) && /var\(--duration-fast, 120ms\)/.test(e1.css) && JSON.stringify((j.$extensions || {})["app.lisio"].excluded) === '["motion"]' && /--duration-/.test(e0.css), "bloc Animations décoché : jetons absents du JSON et du CSS, listé comme exclu, composants gardent une valeur de secours", Object.keys(j).join(","));
  await go(p, "systeme"); await p.evaluate(() => document.querySelector('#dsIncG [data-inc="motion"]').click()); await p.waitForTimeout(200);
  const e2 = await exportsOf(p);
  report(e2.json === e0.json && e2.css === e0.css, "bloc recoché : export identique à l'export de départ");
  report(!p.errs.length, "blocs : aucune erreur JavaScript", p.errs.join(" | ")); await p.ctx.close(); }

// 3 bis. Quel que soit le bloc décoché, le CSS n'appelle jamais une variable qu'il ne définit pas (sans valeur de secours).
{ const p = await open("systeme"); const bad = [];
  const css = () => p.evaluate(() => { const s = document.getElementById("tsFmt"); s.value = "css"; s.dispatchEvent(new Event("change")); return document.getElementById("tsOut").textContent; });
  const dangling = c => { const d = new Set([...c.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1])); return [...new Set([...c.matchAll(/var\((--[\w-]+)\)/g)].map(m => m[1]).filter(v => !d.has(v)))]; };
  const groups = await p.evaluate(() => [...document.querySelectorAll("#dsIncG [data-inc]")].map(c => c.dataset.inc));
  const base = dangling(await css()); if (base.length) bad.push("tous les blocs : " + base.join(" "));
  for (const g of groups) { await p.evaluate(g => document.querySelector(`#dsIncG [data-inc="${g}"]`).click(), g); await p.waitForTimeout(80);
    const d = dangling(await css()); if (d.length) bad.push(g + " : " + d.join(" "));
    await p.evaluate(g => document.querySelector(`#dsIncG [data-inc="${g}"]`).click(), g); await p.waitForTimeout(80); }
  report(groups.length >= 10 && !bad.length, `CSS sans variable orpheline, pour chacun des ${groups.length} blocs décochés`, bad.join(" ; ")); await p.ctx.close(); }

// 4. Arrondi des images : rien n'est exporté tant qu'on n'a pas choisi ; « Moyen » ajoute le jeton et la règle CSS.
{ const p = await open("systeme");
  const e0 = await exportsOf(p);
  await go(p, "systeme"); await p.click('#dsImgR button[data-v="md"]'); await p.waitForTimeout(200);
  const e1 = await exportsOf(p);
  report(!/radius-image/.test(e0.css) && /--radius-image: \d+px/.test(e1.css) && /border-radius: var\(--radius-image\)/.test(e1.css), "arrondi des images : absent par défaut, exporté une fois choisi");
  await p.ctx.close(); }

// 5. Contrastes : une paire qui passe peut devenir le texte et le fond du design system.
{ const p = await open("matrice");
  await p.evaluate(() => { const c = document.querySelector('.mcell[data-i="0"][data-j="2"]'); c.click(); }); await p.waitForTimeout(250);
  const b = await p.evaluate(() => { const x = [...document.querySelectorAll("#pairDetail button")].find(y => /Texte principal sur fond de page/.test(y.textContent)); if (x) x.click(); return !!x; }); await p.waitForTimeout(250);
  const roles = await p.evaluate(() => JSON.parse(localStorage.getItem("lisio:state") || "{}").ts || {});
  report(b && roles.fg === "#0E1B4D" && roles.bg === "#F1E9DA", "paire Encre sur Sable → texte et fond du design system", JSON.stringify({ b, fg: roles.fg, bg: roles.bg }));
  report(!p.errs.length, "Contrastes : aucune erreur JavaScript", p.errs.join(" | ")); await p.ctx.close(); }

await browser.close();
console.log(fails ? `\n${fails} contrôle(s) en échec` : "\nTravail sur les nuances intégré : contrôles passés.");
process.exit(fails ? 1 : 0);
