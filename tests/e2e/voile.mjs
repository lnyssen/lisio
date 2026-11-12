// Images et voile sur photo : plus d'options, chacune vérifiée et exportée seulement si on la choisit.
// Voile : couleur (encre, noir, bouton, clair avec texte foncé), forme (plein ou dégradé), +30 %, flou.
// Images : arrondi pilule, cadrage (centre, haut, bas), contour fin.   node tests/e2e/voile.mjs
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
const SEED = join(tmpdir(), "lisio-seed-voile.html"); writeFileSync(SEED, "<!doctype html><title>seed</title>");
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); await ctx.route(/^https?:/, r => r.abort());
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
await page.goto("file://" + SEED); await page.evaluate(() => { localStorage.clear(); localStorage.setItem("lisio-welcome", "1"); localStorage.setItem("lisio-home", "off"); localStorage.setItem("lisio-mode", "adv"); });
const css = async () => { await page.goto(PAGE + "#exporter"); await page.waitForTimeout(500); const t = await page.evaluate(() => document.getElementById("exCssOut").textContent); await page.goto(PAGE + "#systeme"); await page.waitForTimeout(500); return t; };
const rule = (t, sel) => (t.match(new RegExp(`(^|\\n)${sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\{[^}]*\\}`)) || [""])[0];
const pick = async (id, v) => { await page.locator(`#${id} button[data-v="${v}"]`).click(); await page.waitForTimeout(250); };
await page.goto(PAGE + "#systeme"); await page.waitForTimeout(800);
const segs = { dsScrimTone: ["ink", "black", "brand", "light"], dsScrimShape: ["solid", "bottom", "top"], dsScrimBlur: ["0", "4", "8", "16"], dsScrim: ["0", "0.1", "0.2", "0.3"], dsImgR: ["none", "sm", "md", "lg", "full"], dsImgPos: ["center", "top", "bottom"], dsImgBorder: ["0", "1"] };
for (const [id, vs] of Object.entries(segs)) { const got = await page.locator(`#${id} button[data-v]`).evaluateAll(b => b.map(x => x.dataset.v)).catch(() => []);
  check(vs.every(v => got.includes(v)), `réglage ${id} : ${vs.join(", ")}`, got.join(", ")); }
check(await page.locator("#dsScrimPrev").count() === 1, "un aperçu du voile sur une photo, dans le panneau");
const c0 = await css();
check(!/backdrop-filter/.test(rule(c0, ".scrim")) && !/gradient/.test(rule(c0, ".scrim")) && !/object-position/.test(c0), "par défaut : voile plein, sans flou, cadrage au centre (export inchangé)", rule(c0, ".scrim"));
const op0 = +((c0.match(/--opacity-scrim: ([\d.]+)/) || [0, 0])[1]);
// Voile clair, texte foncé : vérifié sur la zone la plus foncée de l'image.
await pick("dsScrimTone", "light");
const chk = await page.locator("#dsElevChk").textContent();
check(/Voile clair/.test(chk) && /texte foncé/.test(chk) && /plus foncée/.test(chk), "voile clair : le contrôle parle de texte foncé, sur la zone la plus foncée", chk.slice(0, 300));
const c1 = await css();
check(/--scrim-color: rgb\(255 255 255 \//.test(c1) && /color: var\(--text-default\)/.test(rule(c1, ".scrim")), "voile clair : couleur blanche et texte foncé dans le CSS", rule(c1, ".scrim"));
const okLight = await page.evaluate(() => { const li = [...document.querySelectorAll("#dsElevChk li")].find(l => /Voile/.test(l.textContent)); return li ? li.className + " " + li.textContent : ""; });
check(!/\bno\b|✕/.test(okLight), "voile clair : le seuil est tenu (opacité calculée pour)", okLight);
await pick("dsScrimTone", "black");
check(/--scrim-color: rgb\(0 0 0 \//.test(await css()), "voile noir : couleur noire dans le CSS");
// Forme, flou, opacité.
await pick("dsScrimShape", "bottom"); await pick("dsScrimBlur", "8"); await pick("dsScrim", "0.3");
const c2 = await css(), r2 = rule(c2, ".scrim");
check(/linear-gradient\(to top/.test(r2), "dégradé, texte en bas : dégradé vers le haut dans le CSS", r2);
check(/backdrop-filter: blur\(8px\)/.test(r2), "flou de 8 px sous le voile", r2);
const op2 = +((c2.match(/--opacity-scrim: ([\d.]+)/) || [0, 0])[1]);
check(op2 > op0, "+ 30 % : voile plus opaque", op0 + " → " + op2);
check(/Dégradé/.test(await page.locator("#dsElevChk").textContent()), "dégradé : le contrôle rappelle où garder le texte");
// Images.
await pick("dsImgR", "full"); await pick("dsImgPos", "top"); await pick("dsImgBorder", "1");
const c3 = await css();
check(/--radius-image: 999px/.test(c3), "arrondi pilule : radius-image à 999 px", (c3.match(/--radius-image[^;]*;/) || [""])[0]);
check(/object-position: top/.test(c3), "cadrage en haut : object-position dans le CSS");
check(/border: var\(--border-width-default\) solid var\(--border-subtle\)/.test(rule(c3, "img, video")), "contour fin sur les images", rule(c3, "img, video"));
const st = await page.evaluate(() => JSON.parse(localStorage.getItem("lisio:state")).ds);
check(st.scrimTone === "black" && st.scrimShape === "bottom" && st.scrimBlur === 8 && st.imgPos === "top" && st.imgBorder === 1, "réglages enregistrés dans le projet", JSON.stringify(st).slice(0, 300));
if (AXE) { await page.addScriptTag({ content: readFileSync(AXE, "utf8") });
  const v = await page.evaluate(async () => (await axe.run({ include: [["#dsElevPrev"], ["#dsScrimPrev"], ["#dsImH"]] }, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] })).violations.map(x => x.id + " " + x.nodes.length));
  check(!v.length, "axe-core : aucune violation dans les réglages", v.join(", "));
  const v2 = await page.evaluate(async () => (await axe.run(document.querySelector("#dsScrimPrev").closest("section"), { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] })).violations.map(x => x.id + " " + x.nodes.length));
  check(!v2.length, "axe-core : aucune violation dans la section Effets", v2.join(", ")); }
check(!errors.length, "aucune erreur JavaScript", errors.join(" | "));
await browser.close();
console.log(fails ? `\n${fails} échec(s)` : "\nTous les scénarios passent.");
process.exit(fails ? 1 : 0);
