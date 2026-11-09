// F08 : la section « Focus, cibles et états » du design system.
//   node tests/e2e/interaction.mjs
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
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
const STAT = /Conforme au test|Échec du test|À vérifier manuellement|Non testé|Non applicable/;
async function open(state, w = 1440) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 } }); await ctx.route(/^https?:/, r => r.abort());
  await ctx.addInitScript(s => { try { if (!sessionStorage.getItem("s")) { sessionStorage.setItem("s", "1"); localStorage.clear(); localStorage.setItem("lisio-welcome", "1"); localStorage.setItem("lisio-mode", "adv"); localStorage.setItem("lisio:state", JSON.stringify(s)); } } catch (e) {} }, state);
  const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
  await page.goto(PAGE + "#systeme"); await page.waitForTimeout(700); return { ctx, page, errors };
}
{
  const { ctx, page, errors } = await open({ version: "2.2", level: "AA" });
  const sec = page.locator("#dsInter");
  check(await sec.count() === 1 && await sec.isVisible(), "section « Focus, cibles et états » visible");
  const req = sec.locator("[data-kind=req] li.ic"), reco = sec.locator("[data-kind=reco] li.ic");
  check(await req.count() >= 8 && await reco.count() === 4, "exigences et recommandations dans deux listes séparées", `${await req.count()} / ${await reco.count()}`);
  const rows = await req.allTextContents();
  check(rows.every(t => /\d\.\d\.\d+ (A|AA|AAA)\b/.test(t) && STAT.test(t)), "chaque exigence : critère, niveau, statut", rows.find(t => !STAT.test(t)) || "");
  const txt = await sec.textContent();
  check(/2\.4\.7 AA/.test(txt) && /2\.4\.11 AA/.test(txt) && /2\.4\.13 AAA/.test(txt), "focus : 2.4.7 AA, 2.4.11 AA, 2.4.13 AAA distingués");
  check(/2\.5\.8 AA/.test(txt) && /2\.5\.5 AAA/.test(txt), "cibles : 2.5.8 AA et 2.5.5 AAA distingués");
  check(/pas une exigence WCAG/.test(await sec.locator("[data-kind=reco]").textContent()), "recommandations annoncées comme non normatives");
  check(/Lisio ne voit pas/.test(txt), "tests impossibles dans Lisio signalés");
  check(await sec.locator('details.ic-x').count() >= 3, "exceptions indiquées");
  // Cible à 44, 48, 56 : 2.5.5 et la recommandation passent ; texte qui suit le réglage.
  await page.click('#dsBtn button[data-v="56"]'); await page.waitForTimeout(300);
  check(/56 px de haut/.test(await sec.textContent()), "le réglage de hauteur est repris dans le contrôle");
  // Les états du composant sont dessinés séparément dans l’aperçu « États ».
  await page.click('#sysPg button[data-v="states"]'); await page.waitForTimeout(600);
  const caps = await page.frameLocator("#sysFrame").locator(".st-grid .t-caption.mut").allTextContents();
  check(["Repos", "Survol", "Appuyé", "Désactivé"].every(w => caps.some(c => c.startsWith(w))) && caps.some(c => /^Focus clavier/.test(c)), "aperçu : repos, survol, appuyé, focus, désactivé dessinés", caps.slice(0, 6).join(" | "));
  if (AXE) { await page.addScriptTag({ content: readFileSync(AXE, "utf8") });
    const v = await page.evaluate(async () => (await axe.run(document.querySelector("#dsInter"), { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] })).violations.map(x => x.id + " " + x.nodes.length));
    check(!v.length, "axe-core : aucune violation dans la section", v.join(", ")); }
  check(!errors.length, "aucune erreur JavaScript", errors.join(" | "));
  await ctx.close();
}
{
  // WCAG 2.1 : les critères de 2.2 sont « Non applicable », jamais en échec.
  const { ctx, page } = await open({ version: "2.1", level: "AA" });
  const t = await page.locator("#dsInter [data-kind=req]").textContent();
  check(/2\.4\.11 AA[^]*Non applicable/.test(t) && /2\.5\.8 AA[^]*Non applicable/.test(t), "WCAG 2.1 : 2.4.11 et 2.5.8 non applicables");
  await ctx.close();
}
{
  // Mobile : pas de débordement horizontal.
  const { ctx, page } = await open({ version: "2.2" }, 390);
  const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(ov <= 0, "390 px : pas de défilement horizontal", String(ov));
  await ctx.close();
}
await browser.close();
console.log(fails ? `\n${fails} échec(s)` : "\nTous les scénarios passent.");
process.exit(fails ? 1 : 0);
