// P0-6 · Écran du plugin Figma : l'aperçu arrive avant l'import, les suppressions et renommages demandent une case cochée.
// ui.html tourne dans Chromium, dans un cadre comme dans Figma ; code.js tourne sous Node avec le faux figma.
//   node tests/e2e/figma-ui.mjs [--capture dossier]
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { makeFigma, loadPlugin, dsJson, ROOT } from "../figma-mock.mjs";

let chromium;
try { ({ chromium } = createRequire(import.meta.url)("playwright")); } catch (e) { console.log("IGNORÉ : Playwright introuvable."); process.exit(process.env.CI ? 1 : 0); }
const CAP = process.argv.includes("--capture") ? process.argv[process.argv.indexOf("--capture") + 1] : null;
const UI = readFileSync(join(ROOT, "figma-plugin", "ui.html"), "utf8");
const browser = await chromium.launch();
let fails = 0;
const report = (ok, label, detail = "") => { if (!ok) fails++; console.log(`${ok ? "ok   " : "ÉCHEC"} ${label}${detail ? " : " + detail : ""}`); };

async function open(prepare = () => {}) {
  const figma = makeFigma(); prepare(figma);
  const plugin = loadPlugin(figma);
  const page = await browser.newPage({ viewport: { width: 400, height: 900 }, deviceScaleFactor: CAP ? 2 : 1 }), errs = [];
  page.on("pageerror", e => errs.push(String(e)));
  // Le plugin répond par figma.ui.postMessage : on le renvoie au cadre, comme Figma.
  figma.ui.postMessage = m => { page.evaluate(m => document.querySelector("iframe").contentWindow.postMessage({ pluginMessage: m }, "*"), JSON.parse(JSON.stringify(m))).catch(() => {}); };
  await page.exposeFunction("toPlugin", m => figma.ui.onmessage(m));
  await page.setContent(`<!doctype html><body style="margin:0"><iframe style="border:0;width:400px;height:900px"></iframe>
    <script>addEventListener("message", e => { if (e.source !== window && e.data && e.data.pluginMessage) toPlugin(e.data.pluginMessage); });</script>`);
  await page.evaluate(html => { document.querySelector("iframe").srcdoc = html; }, UI);
  await page.waitForTimeout(300);
  const f = page.frames()[1];
  return { figma, plugin, page, f, errs };
}
const loadJson = async (f, name = "exemple") => { await f.setInputFiles("#file", { name: "lisio-design-system.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(dsJson(name))) }); await f.waitForFunction(() => !document.getElementById("plan").hidden, null, { timeout: 5000 }); };
const waitDone = f => f.waitForFunction(() => /Import terminé/.test(document.getElementById("sum").textContent), null, { timeout: 10000 });

// 1. Fichier vide : l'aperçu ne compte que des ajouts, aucune case d'accord, et rien n'est écrit avant la confirmation.
{ const { figma, f, errs, page } = await open();
  await f.uncheck("#comps");
  await loadJson(f);
  const r = await f.evaluate(() => ({ t: document.getElementById("plan").textContent, go: document.getElementById("go").textContent, dis: document.getElementById("go").disabled, del: !!document.getElementById("okDel"), ren: !!document.getElementById("okRen") }));
  report(/\d+ ajouts/.test(r.t) && !/modification/.test(r.t) && !r.del && !r.ren, "fichier vide : aperçu avec des ajouts seulement, sans case d'accord", r.t.slice(0, 160));
  report(!r.dis && r.go === "Confirmer l’import", "bouton « Confirmer l’import » actif après l'aperçu", r.go);
  report(figma.variables.vars.length === 0 && figma.currentPage.children.length === 0, "rien n'est écrit dans Figma avant la confirmation");
  if (CAP) await page.screenshot({ path: join(CAP, "figma-apercu-vide.png") });
  await f.click("#go"); await waitDone(f);
  report(figma.variables.vars.length > 200, "après confirmation, les variables sont créées", String(figma.variables.vars.length));
  await f.waitForFunction(() => /identiques/.test(document.getElementById("plan").textContent), null, { timeout: 5000 }).catch(() => {});
  const again = await f.evaluate(() => document.getElementById("plan").textContent);
  report(/^Ce que l’import fera dans ce fichier1 ajout/.test(again) && /planche Planche de présentation/.test(again) && !/modification/.test(again) && /suppressions proposées/.test(again),
    "après l'import, le nouvel aperçu : seule une nouvelle planche, les anciennes proposées à la suppression", again.slice(0, 160));
  await f.uncheck("#board"); await f.waitForFunction(() => /rien ne changera/.test(document.getElementById("plan").textContent), null, { timeout: 5000 }).catch(() => {});
  report(/rien ne changera/.test(await f.evaluate(() => document.getElementById("plan").textContent)), "sans planche, l'aperçu dit que rien ne changera");
  report(!errs.length, "aucune erreur JavaScript", errs.join(" | ")); }

// 2. Conflit de type, ancienne planche, base → main : listés, cases décochées, et rien de supprimé ni renommé sans accord.
for (const consent of [false, true]) {
  let strVar, baseVar, oldBoard;
  const { figma, f, errs, page } = await open(fg => {
    const c = fg.variables.createVariableCollection("Colors"); strVar = fg.variables.createVariable("ink/main", c, "STRING"); baseVar = fg.variables.createVariable("brand/base", c, "COLOR");
    oldBoard = fg.createFrame(); oldBoard.name = "Color palette"; oldBoard.width = 600;
  });
  await f.uncheck("#comps"); await loadJson(f);
  const r = await f.evaluate(() => ({ t: document.getElementById("plan").textContent, del: document.getElementById("okDel"), ren: document.getElementById("okRen") }));
  const boxes = await f.evaluate(() => [document.getElementById("okDel"), document.getElementById("okRen")].map(b => b ? b.checked : null));
  report(/suppressions proposées/.test(r.t) && /renommage proposé/.test(r.t) && boxes[0] === false && boxes[1] === false, "suppressions et renommage listés, cases décochées par défaut", JSON.stringify(boxes));
  if (CAP && !consent) { await f.evaluate(() => document.querySelectorAll("#plan details").forEach((d, i) => { d.open = i > 0; })); await f.locator("#plan").screenshot({ path: join(CAP, "figma-apercu-conflits.png") }); }
  if (consent) { await f.check("#okDel"); await f.check("#okRen"); }
  await f.click("#go"); await waitDone(f);
  const kept = !strVar.removed && !oldBoard.removed && baseVar.name === "brand/base";
  const done = await f.evaluate(() => document.getElementById("sum").textContent);
  if (!consent) report(kept && /non importée/.test(done), "sans accord : variable, planche et nom gardés, et le bilan le dit", done.slice(0, 200));
  else report(strVar.removed && oldBoard.removed && baseVar.name === "brand/main", "avec accord : remplacement, suppression et renommage faits");
  report(!errs.length, `aucune erreur JavaScript (${consent ? "avec" : "sans"} accord)`, errs.join(" | ")); }

await browser.close();
console.log(fails ? `\n${fails} contrôle(s) en échec` : "\nPlugin Figma : aperçu et accord, contrôles passés.");
process.exit(fails ? 1 : 0);
