// F09 (P2) : rampes OKLCH. Méthode au choix, comparaison avant d'appliquer, hors gamut signalé, jamais présenté comme une validation WCAG.
//   node tests/e2e/oklch.mjs
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
const SEED = join(tmpdir(), "lisio-seed-oklch.html"); writeFileSync(SEED, "<!doctype html><title>seed</title>");
const COLORS = [{ name: "Bleu", hex: "#2F6BFF" }, { name: "Vert vif", hex: "#00FF00" }, { name: "Blanc", hex: "#FFFFFF" }];
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); await ctx.route(/^https?:/, r => r.abort());
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
await page.goto("file://" + SEED);
await page.evaluate(c => { localStorage.clear(); localStorage.setItem("lisio-welcome", "1"); localStorage.setItem("lisio-home", "off"); localStorage.setItem("lisio-mode", "adv"); localStorage.setItem("lisio:colors", JSON.stringify(c)); localStorage.setItem("lisio:state", JSON.stringify({ projectName: "Essai OKLCH" })); }, COLORS);
await page.goto(PAGE + "#palette"); await page.waitForTimeout(600);
const sw = () => page.evaluate(() => [...document.querySelectorAll("#scales .swt:not(.main)")].map(b => b.dataset.hex));
const st = () => page.evaluate(() => JSON.parse(localStorage.getItem("lisio:state")));
const pressed = v => page.locator(`#shMeth button[data-v="${v}"]`).getAttribute("aria-pressed");

// 1. Par défaut : méthode par contraste, rien ne change pour les projets existants.
check(await pressed("contrast") === "true" && await pressed("oklch") === "false", "méthode par contraste par défaut");
check(await page.locator("#shOkBadge").isHidden(), "aucune mention OKLCH par défaut");
const before = await sw();
check(before.length === 33, "11 nuances par couleur", String(before.length));

// 2. Comparer avant d'appliquer.
await page.locator("#shCmp > summary").click(); await page.waitForTimeout(150);
const rows = page.locator("#shCmpBody tbody tr");
check(await rows.count() === 2, "comparaison : deux rampes côte à côte", String(await rows.count()));
check(await page.locator("#shCmpBody tbody tr").first().locator(".cmp-sw").count() === 11 && await page.locator("#shCmpBody tbody tr").nth(1).locator(".cmp-sw").count() === 11, "11 nuances dans chaque rampe");
const cmpTxt = await page.locator("#shCmpBody").textContent();
check(/ΔE OK/.test(cmpTxt) && /sur blanc/.test(cmpTxt), "écart perceptuel et contraste affichés", cmpTxt.slice(0, 160));
check(JSON.stringify(await sw()) === JSON.stringify(before) && !(await st()).sh, "comparer ne change rien");
await page.selectOption("#shCmpC", { label: "Vert vif" }); await page.waitForTimeout(150);
check(/aucune nuance hors gamut/.test(await page.locator("#shCmpBody tbody tr").nth(1).textContent()), "saturation 100 % : OKLCH reste dans sRGB, et le dit");

// 3. Appliquer OKLCH.
await page.locator('#shCmpBody button[data-use="oklch"]').click(); await page.waitForTimeout(300);
check(await pressed("oklch") === "true" && (await st()).sh.method === "oklch", "« Utiliser cette méthode » : OKLCH retenue et enregistrée");
const after = await sw();
check(after.length === 33 && JSON.stringify(after) !== JSON.stringify(before), "les nuances sont recalculées");
const note = await page.locator("#shOkNote").textContent();
check(await page.locator("#shOkNote").isVisible() && /pas une validation WCAG/.test(note) && /hors gamut/.test(note), "règles OKLCH affichées", note.slice(0, 120));
check(/500 sur blanc/.test(note), "contraste du 500 rappelé", note);
check(await page.locator("#shOkBadge").isVisible() && /OKLCH/.test(await page.locator("#shOkBadge").textContent()), "mention visible en tête de page");
check(!/il passe pour toutes/.test(await page.locator("#nuStep2").textContent()), "plus de promesse « il passe pour toutes » en OKLCH", await page.locator("#nuStep2").textContent());
check(await page.locator("#scales .swt.clip").count() === 0, "saturation 100 % : aucune nuance hors gamut");
await page.locator("#shSat").fill("1.4"); await page.waitForTimeout(400);
check(await page.locator("#scales .swt.clip").count() > 0, "saturation 140 % : nuances hors gamut marquées dans la gamme");
check(/chroma réduite\s?: .*Vert vif/.test(await page.locator("#shOkNote").textContent()), "hors gamut listé couleur par couleur", await page.locator("#shOkNote").textContent());
check(/chroma réduite/.test(await page.locator("#scales .swt.clip").first().getAttribute("aria-label")), "hors gamut annoncé au lecteur d’écran");
check(/crans d’écart|nuances/.test(await page.locator("#rules").textContent()), "règles des numéros recalculées sur les nuances OKLCH");
await page.locator("#shSat").fill("1"); await page.waitForTimeout(400);

// 4. Annuler revient à la méthode par contraste, à l'identique.
// Les modifications faites à moins de 500 ms d'écart sont regroupées dans l'historique : selon la vitesse de la machine,
// méthode et saturation font une, deux ou trois étapes. On annule donc pas à pas (trois au plus), sans dépendre du chrono.
let undos = 0;
while (undos < 3 && await pressed("contrast") !== "true") { await page.locator("#undoB").click(); undos++; await page.waitForTimeout(250); }
check(await pressed("contrast") === "true" && JSON.stringify(await sw()) === JSON.stringify(before), "Annuler : retour exact à la méthode par contraste", `${undos} annulation(s)`);
for (let i = 0; i < undos; i++) { await page.locator("#redoB").click(); await page.waitForTimeout(250); }
check(await pressed("oklch") === "true" && JSON.stringify(await sw()) === JSON.stringify(after), "Rétablir : OKLCH de nouveau, nuances identiques");

// 5. Réglages communs : la nuance 50 la plus claire change la clarté du haut.
await page.locator('#shLight button[data-v="1.03"]').click(); await page.waitForTimeout(250);
const L50 = await page.evaluate(() => { const h = document.querySelector("#scales .swt:not(.main)").dataset.hex; return h; });
check(L50 !== after[0], "réglage du 50 appliqué en OKLCH", L50);

// 6. Rechargement : la méthode suit le projet.
await page.reload(); await page.waitForTimeout(600);
check(await pressed("oklch") === "true" && await page.locator("#shOkBadge").isVisible(), "méthode gardée après rechargement");

// 7. Affichage Essentiel : le réglage est masqué, la mention reste.
await page.evaluate(() => localStorage.setItem("lisio-mode", "ess")); await page.reload(); await page.waitForTimeout(600);
check(await page.locator("#shSet").isHidden() && await page.locator("#shOkBadge").isVisible(), "Essentiel : réglage masqué, mention OKLCH visible");
await page.evaluate(() => localStorage.setItem("lisio-mode", "adv")); await page.reload(); await page.waitForTimeout(600);

if (AXE) { await page.locator("#shCmp > summary").click(); await page.addScriptTag({ content: readFileSync(AXE, "utf8") });
  const v = await page.evaluate(async () => (await axe.run(document.querySelector("#palette"), { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] })).violations.map(x => x.id + " " + x.nodes.length));
  check(!v.length, "axe-core : aucune violation sur la page Nuances", v.join(", ")); }
check(!errors.length, "aucune erreur JavaScript", errors.join(" | "));
await browser.close();
console.log(fails ? `\n${fails} échec(s)` : "\nTous les scénarios passent.");
process.exit(fails ? 1 : 0);
