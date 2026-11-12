// « Vérifier une page en ligne » : le favori généré par Lisio, lancé sur une page d’essai aux défauts connus.
//   node tests/e2e/pagecheck.mjs
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
const SEED = join(tmpdir(), "lisio-seed-pc.html"); writeFileSync(SEED, "<!doctype html><title>seed</title>");
const SITE = join(tmpdir(), "lisio-site-pc.html");
writeFileSync(SITE, `<!doctype html><html lang="fr"><title>Site</title><body style="margin:0;font:16px sans-serif;background:#FFFFFF;color:#0E1B4D">
<h1 style="font-size:32px;color:#2447D1">Titre lisible</h1>
<p id="gris" style="color:#777777">Texte gris à 4,48:1, sous 4,5:1.</p>
<p id="grand" style="font-size:28px;color:#888888">Grand texte gris à 3,54:1 : passe en AA grand texte.</p>
<div style="background:#0E1B4D;padding:8px"><p style="color:rgba(255,255,255,.5)">Blanc à 50 % sur nuit : mélangé avant la mesure.</p></div>
<div style="background:linear-gradient(#000,#333);padding:8px"><p id="img" style="color:#FFFFFF">Texte sur un dégradé.</p></div>
<p style="color:oklch(0.55 0.2 29)">Texte en oklch.</p>
<p style="display:none">Caché, jamais mesuré.</p>
</body></html>`);
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); await ctx.route(/^https?:/, r => r.abort());
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
await page.goto("file://" + SEED);
await page.evaluate(() => { localStorage.clear(); localStorage.setItem("lisio-welcome", "1"); localStorage.setItem("lisio-home", "off"); localStorage.setItem("lisio-mode", "adv"); localStorage.setItem("lisio:colors", JSON.stringify([{ name: "Nuit", hex: "#0E1B4D" }, { name: "Marque", hex: "#2447D1" }, { name: "Blanc", hex: "#FFFFFF" }])); });
await page.goto(PAGE + "#exporter"); await page.waitForTimeout(600);
await page.evaluate(() => { const t = document.getElementById("exTabCheck"); t && t.click(); }); await page.waitForTimeout(200);
check(await page.locator("#pcCard").isVisible(), "carte « Vérifier une page en ligne » dans Exporter › Vérifier");
const href = await page.getAttribute("#pcLink", "href");
check(href.startsWith("javascript:") && href.length < 30000, "lien du favori généré", String(href.length));
check(/connaît \d+ couleurs/.test(await page.locator("#pcNote").textContent()), "le favori dit ce qu’il embarque");
// Essai sur Lisio lui-même
await page.click("#pcTry"); await page.waitForTimeout(300);
check(await page.evaluate(() => !!document.getElementById("lisio-pagecheck") && window.__lisioPageCheck.tested > 20), "« Essayer sur Lisio » ouvre le panneau");
await page.evaluate(() => document.getElementById("lisio-pagecheck").remove());
check(!errors.length, "aucune erreur JS dans Lisio", errors.join(" | "));
// Le vrai favori, sur un autre site
const site = await ctx.newPage(); const errs2 = []; site.on("pageerror", e => errs2.push(String(e)));
await site.goto("file://" + SITE);
await site.evaluate(code => { (0, eval)(code); }, decodeURIComponent(href.slice("javascript:".length)));
await site.waitForTimeout(300);
const r = await site.evaluate(() => window.__lisioPageCheck);
check(r && r.tested === 6, "6 textes visibles mesurés (le caché est ignoré)", JSON.stringify(r && r.tested));
const f = r.fails.map(x => x.fg + "/" + x.bg);
check(f.includes("#777777/#FFFFFF"), "gris 4,48:1 en échec", f.join());
check(!f.includes("#888888/#FFFFFF"), "grand texte à 3,54:1 accepté en AA");
check(r.offPalette.some(o => /^#8[67]8[CDE]A[56]/.test(o.hex)) && !f.some(x => x.startsWith("#FFFFFF/#0E1B4D")), "blanc à 50 % mélangé au fond (environ #878DA6) puis mesuré", JSON.stringify(r.offPalette.map(o => o.hex)));
check(r.check === 1, "texte sur dégradé : à vérifier à l’œil", String(r.check));
check(r.offPalette.some(o => o.hex === "#777777") && !r.offPalette.some(o => o.hex === "#2447D1"), "couleurs hors palette signalées, celles de la palette non", JSON.stringify(r.offPalette.map(o => o.hex)));
const panel = site.locator("#lisio-pagecheck");
check(await panel.count() === 1, "panneau affiché sur la page");
check(await site.evaluate(() => document.getElementById("lisio-pagecheck").shadowRoot.activeElement?.getAttribute("role") === "dialog"), "le focus va au panneau");
await site.evaluate(() => document.getElementById("lisio-pagecheck").shadowRoot.querySelector("[data-f]").click()); await site.waitForTimeout(400);
check(await site.evaluate(() => [...document.querySelectorAll("p")].some(p => p.style.outline.includes("3px"))), "« Montrer » entoure le texte en échec");
await site.keyboard.press("Escape"); await site.waitForTimeout(100);
check(await panel.count() === 0, "Échap referme le panneau");
check(!errs2.length, "aucune erreur JS sur le site", errs2.join(" | "));
await browser.close();
console.log(fails ? `${fails} échec(s)` : "Vérification de page : tout passe.");
process.exit(fails ? 1 : 0);
