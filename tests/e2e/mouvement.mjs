// Mouvement (12 novembre 2026) : étapes qui glissent dans le sens du parcours, couleur corrigée qui passe de l’ancienne
// à la nouvelle, ratio qui défile dans le message. Rien ne bouge si le système demande moins d’animations.
//   node tests/e2e/mouvement.mjs
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
const SEED = join(tmpdir(), "lisio-seed-mvt.html"); writeFileSync(SEED, "<!doctype html><title>seed</title>");
for (const reduce of [false, true]) {
  const tag = reduce ? "moins d’animations" : "mouvement";
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: reduce ? "reduce" : "no-preference" }); await ctx.route(/^https?:/, r => r.abort());
  const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
  await page.goto("file://" + SEED);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem("lisio-welcome", "1"); localStorage.setItem("lisio-home", "off"); localStorage.setItem("lisio-mode", "adv"); localStorage.setItem("lisio:colors", JSON.stringify([{ name: "Gris", hex: "#8A8A8A" }, { name: "Blanc", hex: "#FFFFFF" }, { name: "Nuit", hex: "#0E1B4D" }])); });
  await page.goto(PAGE + "#couleurs"); await page.waitForTimeout(500);
  // Sens des étapes
  await page.evaluate(() => { location.hash = "#styles"; }); await page.waitForTimeout(150);
  const fwd = await page.evaluate(() => document.getElementById("main").dataset.dir);
  await page.evaluate(() => { location.hash = "#palette"; }); await page.waitForTimeout(150);
  const back = await page.evaluate(() => document.getElementById("main").dataset.dir);
  check(fwd === "fwd" && back === "back", `${tag} : sens de l’étape noté (suivante, précédente)`, fwd + "/" + back);
  const anim = await page.evaluate(() => getComputedStyle(document.getElementById("palette")).animationName);
  check(reduce ? anim === "none" : anim === "lisioBack", `${tag} : animation de la page`, anim);
  // Correction depuis le détail d’une paire (Gris sur Blanc)
  await page.evaluate(() => { location.hash = "#matrice"; }); await page.waitForTimeout(300);
  await page.click('.mcell[data-i="0"][data-j="1"]'); await page.waitForTimeout(300);
  const clicked = await page.evaluate(() => { const x = [...document.querySelectorAll("#pairDetail button")].find(y => /^Gris →/.test(y.textContent.trim())); if (x) x.click(); return !!x; });
  check(clicked, `${tag} : correction proposée dans le détail de la paire`);
  await page.waitForTimeout(120);
  const t = await page.evaluate(() => { const t = document.getElementById("toast"); return { sr: t.querySelector(".sr-only")?.textContent || t.textContent, num: !!t.querySelector(".fx-num"), hid: t.querySelector("[aria-hidden]") != null }; });
  check(/Gris remplacé par #[0-9A-F]{6} : \d+,\d{2}:1/.test(t.sr), `${tag} : message complet pour les lecteurs d’écran`, t.sr);
  check(reduce ? !t.num : t.num && t.hid, `${tag} : le ratio ${reduce ? "ne défile pas" : "défile (chiffre visible seulement)"}`);
  await page.waitForTimeout(800);
  if (!reduce) check(await page.evaluate(() => { const t = document.getElementById("toast"); return t.querySelector(".fx-num").textContent === t.querySelector(".sr-only").textContent.match(/(\d+,\d{2}):1/)[1]; }), "le ratio s’arrête sur la bonne valeur");
  await page.evaluate(() => { location.hash = "#couleurs"; }); await page.waitForTimeout(200);
  check(!errors.length, `${tag} : aucune erreur JS`, errors.join(" | "));
  await ctx.close();
}
// La couleur corrigée glisse dans « Vos couleurs » (correction faite depuis la page Couleurs)
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); await ctx.route(/^https?:/, r => r.abort());
  const page = await ctx.newPage();
  await page.goto("file://" + SEED);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem("lisio-welcome", "1"); localStorage.setItem("lisio-home", "off"); localStorage.setItem("lisio:colors", JSON.stringify([{ name: "Gris", hex: "#8A8A8A" }, { name: "Blanc", hex: "#FFFFFF" }])); });
  await page.goto(PAGE + "#couleurs"); await page.waitForTimeout(500);
  await page.fill("#ph0", "#2447D1"); await page.press("#ph0", "Tab"); await page.waitForTimeout(100);
  await page.evaluate(() => document.getElementById("pasteToggle").click());
  await page.fill("#pasteText", "Gris #777777\nBlanc #FFFFFF"); await page.waitForTimeout(300);
  await page.click("#pasteApply"); await page.waitForTimeout(80);
  check(await page.evaluate(() => document.getElementById("pc0").closest(".chipedit").classList.contains("fx-fix")), "couleur remplacée : l’ancienne teinte glisse vers la nouvelle");
  await ctx.close();
}
await browser.close();
console.log(fails ? `${fails} échec(s)` : "Mouvement : tout passe.");
process.exit(fails ? 1 : 0);
