// Couleurs décoratives : une couleur (ou une paire jumelle) signalée dans « À corriger » peut être laissée telle quelle.
// Elle sort de la liste et du résumé, reste visible dans « Laissées telles quelles », et l'on peut revenir en arrière.
//   node tests/e2e/decor.mjs
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PAGE = "file://" + (process.env.LISIO_PAGE || join(ROOT, "index.html"));
let chromium;
try { ({ chromium } = createRequire(import.meta.url)("playwright")); } catch (e) { console.log("IGNORÉ : Playwright introuvable."); process.exit(process.env.CI ? 1 : 0); }
const AXE = process.env.AXE_PATH;
const browser = await chromium.launch();
let fails = 0;
const check = (cond, label, extra = "") => { if (cond) console.log("ok    " + label); else { fails++; console.log("ÉCHEC " + label + (extra ? " : " + extra : "")); } };
const SEED = join(tmpdir(), "lisio-seed-decor.html"); writeFileSync(SEED, "<!doctype html><title>seed</title>");
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); await ctx.route(/^https?:/, r => r.abort());
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
await page.goto("file://" + SEED);
// Corail moyen (illisible en texte courant avec les autres) et deux bleus presque jumeaux.
await page.evaluate(() => { localStorage.clear(); localStorage.setItem("lisio-welcome", "1"); localStorage.setItem("lisio-home", "off"); localStorage.setItem("lisio-mode", "ess");
  localStorage.setItem("lisio:colors", JSON.stringify([{ name: "Nuit", hex: "#0E1B4D" }, { name: "Encre", hex: "#0D1535" }, { name: "Corail", hex: "#C8553D" }, { name: "Blanc", hex: "#FFFFFF" }])); });
await page.goto(PAGE + "#couleurs"); await page.waitForTimeout(700);
const W = page.locator("#cWatch");
const rows = async () => (await W.locator(".cw-list > li").allTextContents()).join(" | ");
const sumTxt = () => page.evaluate(() => (document.getElementById("sumLine") || document.body).textContent);
check(/Corail/.test(await rows()) && /Nuit et Encre/.test(await rows()), "au départ : Corail et la paire Nuit / Encre sont signalés", await rows());
const s0 = await sumTxt();
const leave = W.locator(".cw-list > li", { hasText: "Corail" }).locator("button[data-decor]");
check(await leave.count() === 1, "chaque couleur signalée a un bouton pour la laisser telle quelle");
check(/telle quelle/i.test(await leave.textContent()), "le bouton dit ce qu’il fait", await leave.textContent());
await leave.click(); await page.waitForTimeout(300);
check(!/Corail/.test(await rows()), "Corail sort de la liste « À corriger »", await rows());
check(await page.evaluate(() => (JSON.parse(localStorage.getItem("lisio:colors")).find(c => c.name === "Corail") || {}).hex) === "#C8553D", "la couleur elle-même ne change pas");
const kept = W.locator(".cw-decor");
check(await kept.count() === 1 && /Corail/.test(await kept.textContent()), "Corail apparaît dans « Laissées telles quelles »", await kept.count() ? await kept.textContent() : "absent");
check(await page.evaluate(() => (JSON.parse(localStorage.getItem("lisio:state")).decor || []).length) === 1, "le choix est enregistré dans le projet");
const s1 = await sumTxt();
const nv = t => +((t.match(/(\d+) à vérifier/) || [0, 0])[1]);
check(nv(s1) === nv(s0) - 1, "le résumé compte un point à vérifier de moins", s0 + " → " + s1);
// La paire jumelle aussi.
await W.locator(".cw-list > li", { hasText: "Nuit et Encre" }).locator("button[data-decor]").click(); await page.waitForTimeout(300);
check(!(await W.locator(".cw-list > li").count()), "plus rien à corriger une fois les deux laissés tels quels", await rows());
check(/telles quelles/i.test(await W.textContent()), "le message dit que des couleurs sont laissées telles quelles", (await W.textContent()).slice(0, 200));
// Rechargement : le choix tient.
await page.reload(); await page.waitForTimeout(700);
check(await W.locator(".cw-decor li").count() === 2, "après rechargement, les deux choix tiennent");
// Annuler.
await W.locator(".cw-decor summary").click();
await W.locator(".cw-decor li", { hasText: "Corail" }).locator("button").click(); await page.waitForTimeout(300);
check(/Corail/.test(await rows()), "« Annuler » remet Corail dans la liste", await rows());
// Une couleur modifiée redevient à vérifier : le choix porte sur la valeur exacte.
await page.evaluate(() => { const st = JSON.parse(localStorage.getItem("lisio:state")); st.decor = ["c:#C8553D"]; localStorage.setItem("lisio:state", JSON.stringify(st)); const c = JSON.parse(localStorage.getItem("lisio:colors")); c[2].hex = "#C95A40"; localStorage.setItem("lisio:colors", JSON.stringify(c)); });
await page.reload(); await page.waitForTimeout(700);
check(/Corail/.test(await rows()), "une couleur modifiée redevient à vérifier", await rows());
if (AXE) { await page.addScriptTag({ content: readFileSync(AXE, "utf8") });
  const v = await page.evaluate(async () => (await axe.run(document.querySelector("#cWatch"), { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] })).violations.map(x => x.id + " " + x.nodes.length));
  check(!v.length, "axe-core : aucune violation dans « À corriger »", v.join(", ")); }
check(!errors.length, "aucune erreur JavaScript", errors.join(" | "));
await browser.close();
console.log(fails ? `\n${fails} échec(s)` : "\nTous les scénarios passent.");
process.exit(fails ? 1 : 0);
