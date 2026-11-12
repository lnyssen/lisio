// F07 : « Comment tester ? » sur chaque critère de la page Polices, et la liste complète dans le guide.
//   node tests/e2e/aide.mjs
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
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.route(/^https?:/, r => r.abort());
await ctx.addInitScript(() => { try { localStorage.setItem("lisio-welcome", "1"); localStorage.setItem("lisio-home", "off"); localStorage.setItem("lisio-mode", "adv"); localStorage.setItem("lisio:state", JSON.stringify({ level: "AAA", version: "2.2" })); } catch (e) {} });
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
await page.goto(PAGE + "#tester"); await page.waitForTimeout(500);

// 1. Un bouton « Comment tester ? » par critère distinct, relié à son panneau.
const ids = await page.$$eval("#checks .check .tag", t => t.map(x => x.textContent.split(" ")[0]));
const btns = page.locator("#checks button.howb");
check(await btns.count() === new Set(ids).size, "un bouton « Comment tester ? » par critère", `${await btns.count()} boutons, ${new Set(ids).size} critères`);
const b12 = page.locator('#checks button.howb[data-crit="1.4.12"]');
check(await b12.count() === 1 && (await b12.getAttribute("aria-expanded")) === "false" && !!(await b12.getAttribute("aria-controls")), "1.4.12 : bouton replié, relié à son panneau");
await b12.click(); await page.waitForTimeout(150);
const pid = await b12.getAttribute("aria-controls"), panel = page.locator("#" + pid);
const txt = await panel.textContent();
check((await b12.getAttribute("aria-expanded")) === "true" && await panel.isVisible(), "panneau ouvert au clic");
check(/1\.4\.12/.test(txt) && /Espacement du texte/.test(txt) && /AA/.test(txt), "le critère exact est nommé", txt.slice(0, 120));
check(/0,12/.test(txt) && /0,16/.test(txt) && /1,5/.test(txt), "les valeurs à appliquer sont données");
check(/Simulation/.test(txt) && /ne valide pas/.test(txt), "simulation distinguée d’un audit");
check(/WCAG 2\.2/.test(txt) && await panel.locator('a[href*="w3.org/WAI/WCAG22/Understanding/text-spacing"]').count() === 1, "référence versionnée et lien W3C");
// 2. La simulation s’applique depuis le panneau, et le panneau reste ouvert après le nouveau rendu.
await panel.locator("button[data-sim]").click(); await page.waitForTimeout(200);
check((await page.locator("#spacingTest").getAttribute("aria-pressed")) === "true", "« Appliquer sur l’aperçu » active la simulation 1.4.12");
check((await page.locator('#checks button.howb[data-crit="1.4.12"]').getAttribute("aria-expanded")) === "true", "le panneau reste ouvert après le rendu");
check(/À vérifier manuellement/.test(await page.locator("#checks").textContent()), "le statut reste « À vérifier manuellement »");
// 3. Contraste : test automatique sur les couleurs choisies, limites dites.
await page.locator('#checks button.howb[data-crit="1.4.3"]').click(); await page.waitForTimeout(150);
const t3 = await page.locator("#" + await page.locator('#checks button.howb[data-crit="1.4.3"]').getAttribute("aria-controls")).textContent();
check(/Test automatique/.test(t3) && /Limites/.test(t3), "1.4.3 : test automatique et limites", t3.slice(0, 160));
// 4. Échap referme et rend le focus au bouton.
await page.keyboard.press("Escape"); await page.waitForTimeout(100);
check((await page.locator('#checks button.howb[data-crit="1.4.3"]').getAttribute("aria-expanded")) === "false" && await page.evaluate(() => document.activeElement && document.activeElement.dataset.crit) === "1.4.3", "Échap referme, focus rendu au bouton");
// 5. Guide : tous les critères expliqués, avec niveau, version et méthode de test.
await page.goto(PAGE + "#sources"); await page.waitForTimeout(400);
const rows = page.locator("#critHow details");
check(await rows.count() >= 14, "guide : 14 critères expliqués", String(await rows.count()));
const r258 = await page.locator('#critHow details[data-crit="2.5.8"]').textContent();
check(/24 × 24/.test(r258) && /Exceptions/.test(r258) && /2\.2/.test(r258), "guide : 2.5.8 avec ses exceptions et sa version");
// 6. Nouveaux termes dans les « ? ».
await page.goto(PAGE + "#couleurs"); await page.waitForTimeout(300);
check(await page.locator('.qchip[data-q="luminance"]').count() === 1, "« ? » luminance sur la page Couleurs");
await page.goto(PAGE + "#styles"); await page.waitForTimeout(300);
check(await page.locator('.qchip[data-q="echelle"]').count() >= 1 && await page.locator('.qchip[data-q="fluid"]').count() >= 1, "« ? » échelle et typographie fluide sur la page Styles");
// Les « ? » de l’étape sont dans la ligne d’aide repliable (choix de Laurent, 7 novembre 2026) : on la déplie.
if (await page.getAttribute("#jNowBox .j-help-b", "aria-expanded") !== "true") { await page.click("#jNowBox .j-help-b"); await page.waitForTimeout(150); }
await page.locator('.qchip[data-q="echelle"]').first().click(); await page.waitForTimeout(150);
check(/1,333/.test(await page.locator("#qPop").textContent()) && /pas une règle WCAG/.test(await page.locator("#qPop").textContent()), "échelle 1,333 : expliquée comme un choix de design");
// 7. axe-core sur la page Polices panneau ouvert.
if (AXE) {
  await page.goto(PAGE + "#tester"); await page.waitForTimeout(400);
  await page.locator('#checks button.howb[data-crit="1.4.12"]').click(); await page.waitForTimeout(150);
  await page.addScriptTag({ content: readFileSync(AXE, "utf8") });
  const v = await page.evaluate(async () => (await axe.run(document.querySelector("#tester"), { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] })).violations.map(x => x.id + " " + x.nodes.length));
  check(!v.length, "axe-core : aucune violation, panneau ouvert", v.join(", "));
} else console.log("IGNORÉ axe-core (AXE_PATH absent)");
check(!errors.length, "aucune erreur JavaScript", errors.join(" | "));
await browser.close();
console.log(fails ? `\n${fails} échec(s)` : "\nTous les scénarios passent.");
process.exit(fails ? 1 : 0);
