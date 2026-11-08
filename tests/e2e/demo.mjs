// P2 · F06 : projet démo séparé et visite guidée.
//   node tests/e2e/demo.mjs
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PAGE = "file://" + (process.env.LISIO_PAGE || join(ROOT, "index.html"));
let chromium, devices;
try { ({ chromium, devices } = createRequire(import.meta.url)("playwright")); } catch (e) { console.log("IGNORÉ : Playwright introuvable."); process.exit(process.env.CI ? 1 : 0); }
const AXE = process.env.AXE_PATH;
const browser = await chromium.launch();
let fails = 0;
const check = (cond, label, extra = "") => { if (cond) console.log("ok    " + label); else { fails++; console.log("ÉCHEC " + label + (extra ? " : " + extra : "")); } };
const MINE = [{ name: "Rouge maison", hex: "#B3261E" }, { name: "Nuit", hex: "#101828" }, { name: "Blanc", hex: "#FFFFFF" }];
async function open(opts = {}, { welcomed = true, mine = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts }); await ctx.route(/^https?:/, r => r.abort());
  await ctx.addInitScript(([w, m, cols]) => { try { if (!sessionStorage.getItem("s")) { sessionStorage.setItem("s", "1"); localStorage.clear(); if (w) localStorage.setItem("lisio-welcome", "1"); if (m) { localStorage.setItem("lisio:colors", JSON.stringify(cols)); localStorage.setItem("lisio:state", JSON.stringify({ projectName: "Mon site" })); } } } catch (e) {} }, [welcomed, mine, MINE]);
  const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
  await page.goto(PAGE + "#couleurs"); await page.waitForTimeout(700); return { ctx, page, errors };
}
const projects = p => p.evaluate(() => JSON.parse(localStorage.getItem("lisio:projects") || "null"));
const nav = async (p, fn) => { await Promise.all([p.waitForEvent("load"), fn()]); await p.waitForTimeout(700); };
{
  // Première visite : le bandeau d’accueil propose la démo et la création.
  const { ctx, page } = await open({}, { welcomed: false, mine: false });
  const t = await page.locator("#hello").textContent();
  check(/Essayer avec un projet démo/.test(t), "accueil : « Essayer avec un projet démo »", t);
  check(/Créer mon projet/.test(t), "accueil : « Créer mon projet »", t);
  check(!/100\s?%|accessible à/i.test(t), "accueil : aucune promesse de conformité");
  await ctx.close();
}
{
  const { ctx, page, errors } = await open();
  // Outils › Apprendre propose la démo à tout moment.
  await page.click("#helpB"); await page.waitForTimeout(300);
  check(await page.locator('#helpPop [data-demo]').isVisible(), "Outils › Apprendre : « Projet démo »");
  await nav(page, () => page.click('#helpPop [data-demo]'));
  check((await page.textContent("#prjBN")).includes("Démo"), "le projet ouvert s’appelle « Démo… »", await page.textContent("#prjBN"));
  const bar = page.locator("#demoBar");
  check(await bar.isVisible() && /Projet démo/.test(await bar.textContent()) && /vos projets/i.test(await bar.textContent()), "bandeau « Projet démo » : vos projets ne sont pas touchés", await bar.textContent());
  check(/1 sur 7/.test(await bar.textContent()) && /Couleurs/.test(await bar.textContent()), "visite : étape 1 sur 7, Couleurs", await bar.textContent());
  let P = await projects(page), mine = P.list.find(x => x.name === "Mon site");
  check(!!mine && JSON.stringify(mine.colors) === JSON.stringify(MINE), "mon projet est intact dans la liste", JSON.stringify(mine && mine.colors));
  check(P.list.filter(x => x.state && x.state.demo).length === 1, "un seul projet démo");
  // Suivant : l’étape 2 s’ouvre.
  await page.click("#demoBar [data-demo-next]"); await page.waitForTimeout(500);
  check(await page.evaluate(() => location.hash) === "#palette" && /2 sur 7/.test(await bar.textContent()), "visite : « Suivant » ouvre l’étape 2", await page.evaluate(() => location.hash));
  if (AXE) { await page.addScriptTag({ content: readFileSync(AXE, "utf8") });
    const v = await page.evaluate(async () => (await axe.run(document.querySelector("#demoBar"), { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] })).violations.map(x => x.id + " " + x.nodes.length));
    check(!v.length, "axe-core : aucune violation dans le bandeau démo", v.join(", ")); }
  // Rouvrir la démo ne la duplique pas ; la quitter rend mon projet.
  await nav(page, () => page.click("#demoBar [data-demo-quit]"));
  check((await page.textContent("#prjBN")).trim() === "Mon site", "« Quitter la démo » rend mon projet", await page.textContent("#prjBN"));
  check(!(await page.locator("#demoBar").isVisible()), "hors démo : pas de bandeau");
  const cols = await page.evaluate(() => JSON.parse(localStorage.getItem("lisio:colors")));
  check(JSON.stringify(cols) === JSON.stringify(MINE), "mes couleurs sont revenues telles quelles");
  await page.click("#helpB"); await page.waitForTimeout(300); await nav(page, () => page.click('#helpPop [data-demo]'));
  P = await projects(page);
  check(P.list.filter(x => x.state && x.state.demo).length === 1, "rouvrir la démo ne crée pas de doublon", String(P.list.length));
  check(!errors.length, "aucune erreur JavaScript", errors.join(" | "));
  await ctx.close();
}
{
  // Mobile : le bandeau tient dans l’écran.
  const { ctx, page } = await open({ ...devices["iPhone 13"] });
  await page.click("#moreB"); await page.waitForTimeout(400);
  await nav(page, () => page.click('#moreSheet [data-demo]'));
  const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(await page.locator("#demoBar").isVisible() && ov <= 0, "mobile : bandeau visible, pas de défilement horizontal", String(ov));
  await ctx.close();
}
await browser.close();
console.log(fails ? `\n${fails} échec(s)` : "\nTous les scénarios passent.");
process.exit(fails ? 1 : 0);
