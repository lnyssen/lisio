// Importer un design system existant : variables CSS, Tailwind, JSON, fichier ; rapport avant remplacement.
//   node tests/e2e/import-ds.mjs
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PAGE = "file://" + (process.env.LISIO_PAGE || join(ROOT, "index.html"));
let chromium;
try { ({ chromium } = createRequire(import.meta.url)("playwright")); } catch (e) { console.log("IGNORÉ : Playwright introuvable."); process.exit(process.env.CI ? 1 : 0); }
const browser = await chromium.launch();
let fails = 0;
const check = (cond, label, extra = "") => { if (cond) console.log("ok    " + label); else { fails++; console.log("ÉCHEC " + label + (extra ? " : " + extra : "")); } };
const SEED = join(tmpdir(), "lisio-seed-import.html"); writeFileSync(SEED, "<!doctype html><title>seed</title>");
for (const vw of [1280, 390]) {
  const ctx = await browser.newContext({ viewport: { width: vw, height: 900 } }); await ctx.route(/^https?:/, r => r.abort());
  const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
  await page.goto("file://" + SEED);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem("lisio-welcome", "1"); localStorage.setItem("lisio-home", "off"); localStorage.setItem("lisio-mode", "adv"); });
  await page.goto(PAGE + "#couleurs"); await page.waitForTimeout(500);
  const tg = page.locator("#pasteToggle");
  check(/design system/.test(await tg.textContent()), `${vw} : bouton « Importer un design system »`);
  await tg.click();
  const css = ":root{--color-brand-100:#DCE6FF;--color-brand-300:#7FA1FF;--color-brand-500:#2447D1;--color-brand-700:#162C85;--color-ink:#0E1B4D;--text:var(--color-ink);--surface:#FAF9F4;}";
  await page.fill("#pasteText", css); await page.waitForTimeout(400);
  const rep = await page.locator("#dsReport").textContent();
  check(/variables CSS/.test(rep) && /3 gardées/.test(rep) && /1 alias/.test(rep), `${vw} : rapport avant remplacement`, rep.slice(0, 160));
  check(/par ces 3/.test(await page.locator("#pasteApply").textContent()), `${vw} : le bouton dit combien de couleurs`);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  check(over <= 0, `${vw} : pas de défilement horizontal`, String(over));
  await page.click("#pasteApply"); await page.waitForTimeout(300);
  const pal = await page.evaluate(() => JSON.parse(localStorage.getItem("lisio:colors")));
  check(pal && pal.map(c => c.hex).join() === "#2447D1,#0E1B4D,#FAF9F4" && pal[0].name === "Brand", `${vw} : palette remplacée`, JSON.stringify(pal));
  // Fichier JSON (DTCG)
  await tg.click();
  const f = join(tmpdir(), "tokens.json"); writeFileSync(f, JSON.stringify({ color: { $type: "color", night: { $value: "#0E1B4D" }, sun: { $value: "#F5B800" }, text: { $value: "{color.night}" } } }));
  await page.setInputFiles("#dsFile", f); await page.waitForTimeout(400);
  check(/jetons JSON/.test(await page.locator("#dsReport").textContent()), `${vw} : fichier JSON lu et reconnu`);
  // Rien de lisible
  await page.fill("#pasteText", "--space: 8px;"); await page.waitForTimeout(400);
  check(/Aucune couleur/.test(await page.locator("#dsReport").textContent()), `${vw} : texte sans couleur signalé`);
  check(!errors.length, `${vw} : aucune erreur JS`, errors.join(" | "));
  await ctx.close();
}
// Nom trompeur : « Bleu » #EEF4FF est presque blanc, ses nuances seront grises.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); await ctx.route(/^https?:/, r => r.abort());
  const page = await ctx.newPage();
  await page.goto("file://" + SEED);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem("lisio-welcome", "1"); localStorage.setItem("lisio-home", "off"); localStorage.setItem("lisio:colors", JSON.stringify([{ name: "Bleu", hex: "#EEF4FF" }, { name: "Nuit", hex: "#0E1B4D" }])); });
  await page.goto(PAGE + "#couleurs"); await page.waitForTimeout(500);
  const n0 = page.locator("#pnote0"), n1 = page.locator("#pnote1");
  check(await n0.isVisible() && /grises, pas bleues/.test(await n0.textContent()), "« Bleu » presque blanc : signalé sous la couleur");
  check(await page.getAttribute("#pn0", "aria-describedby") === "pnote0", "le message est relié au champ du nom");
  check(await n1.isHidden(), "« Nuit » : rien à signaler");
  await page.fill("#ph0", "#2447D1"); await page.press("#ph0", "Enter"); await page.waitForTimeout(200);
  check(await page.locator("#pnote0").isHidden(), "message retiré quand la couleur devient bleue");
  await ctx.close();
}
await browser.close();
console.log(fails ? `${fails} échec(s)` : "Import de design system : tout passe.");
process.exit(fails ? 1 : 0);
