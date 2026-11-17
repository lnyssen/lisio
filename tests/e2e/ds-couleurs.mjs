// Design system, 17 novembre 2026 : couleurs de graphiques au choix, alertes visibles et mesurées,
// voile sur photo (sans voile, dégradé dans 4 directions, longueur, ma couleur, mesure sur une photo),
// icônes Lucide dans les boutons. Chaque choix affiche son contraste.   node tests/e2e/ds-couleurs.mjs
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
const SEED = join(tmpdir(), "lisio-seed-dscol.html"); writeFileSync(SEED, "<!doctype html><title>seed</title>");
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); await ctx.route(/^https?:/, r => r.abort());
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
await page.goto("file://" + SEED); await page.evaluate(() => { localStorage.clear(); localStorage.setItem("lisio-welcome", "1"); localStorage.setItem("lisio-home", "off"); localStorage.setItem("lisio-mode", "ess"); });
const grab = () => page.evaluate(() => { const $ = id => document.getElementById(id), run = v => { $("tsFmt").value = v; $("tsFmt").dispatchEvent(new Event("change")); return $("tsOut").textContent; }; return { json: run("json"), css: run("css") }; });
const exportCss = async () => { await page.goto(PAGE + "#styles"); await page.waitForTimeout(500); const t = await grab(); await page.goto(PAGE + "#systeme"); await page.waitForTimeout(600); return { css: t.css, json: JSON.parse(t.json) }; };
const st = () => page.evaluate(() => JSON.parse(localStorage.getItem("lisio:state")).ds);
const raw = async () => { await page.goto(PAGE + "#styles"); await page.waitForTimeout(500); const t = await grab(); await page.goto(PAGE + "#systeme"); await page.waitForTimeout(600); return t; };
await page.goto(PAGE + "#systeme"); await page.waitForTimeout(900);
const base = await raw();
// Affichage Essentiel : les trois nouvelles sections sont visibles.
for (const id of ["dsChH", "dsAlH", "dsScH", "dsIcH"]) check(await page.locator(`section[aria-labelledby=${id}]`).isVisible(), `section visible en Essentiel : ${id}`);
// Graphiques : passer en « Mes couleurs », changer une série, la voir mesurée, corriger.
await page.locator('[data-chmode="custom"]').click(); await page.waitForTimeout(300);
check(await page.locator("#dsChart [data-chx]").count() >= 2, "Mes couleurs : une ligne par série, avec code et mesure");
await page.locator('#dsChart [data-chx="0"]').fill("#F2F2F2"); await page.locator('#dsChart [data-chx="0"]').press("Enter"); await page.waitForTimeout(400);
const r0 = await page.locator("#dsChart .ch-r").first().textContent();
check(/✕/.test(r0) && /il faut 3:1/.test(r0), "série trop pâle : ratio affiché et seuil 3:1 rappelé", r0);
check(await page.locator('#dsChart [data-chfix="0"]').count() === 1, "série trop pâle : une nuance proche qui passe est proposée");
await page.locator('#dsChart [data-chfix="0"]').click(); await page.waitForTimeout(400);
check(/✓/.test(await page.locator("#dsChart .ch-r").first().textContent()), "après correction : la série passe 3:1");
const n0 = await page.locator("#dsChart [data-chx]").count();
await page.locator("#dsChart [data-chadd]").click(); await page.waitForTimeout(300);
check(await page.locator("#dsChart [data-chx]").count() === n0 + 1, "Ajouter une série");
await page.locator('#dsChart [data-chx="0"]').fill("#123ABC"); await page.locator('#dsChart [data-chx="0"]').press("Enter"); await page.waitForTimeout(400);
let ex = await exportCss();
check(ex.json.semantic.chart["1"].$value !== undefined && Object.keys(ex.json.semantic.chart).length === n0 + 1, "export : chart/1 à chart/n suivent mes couleurs", Object.keys(ex.json.semantic.chart).join());
check(((await st()).chartC || {}).light && (await st()).chartC.light[0] === "#123ABC", "palette enregistrée : série 1 = #123ABC");
await page.locator('[data-chmode="auto"]').click(); await page.waitForTimeout(300);
check(!(await st()).chartC, "Automatique : la palette calculée revient");
// Alertes : aperçu mesuré, réglages dépliables, teinte libre.
check(await page.locator("#dsAlerts .al").count() === 4, "quatre alertes en aperçu");
check((await page.locator("#dsAlerts .al-m").first().textContent()).match(/titre .*:1, texte .*:1, bordure .*:1/) != null, "chaque alerte : contraste du titre, du texte et de la bordure");
check(await page.locator('#dsAlerts input[type=color][data-st="error"]').count() === 1, "teinte d’erreur réglable");
await page.locator('#dsAlerts details[data-al="error"] > summary').click(); await page.waitForTimeout(200);
check(await page.locator('#dsAlerts select[data-role="error/surface"]').isVisible(), "fond d’erreur au choix, une fois déplié");
const surf = await page.locator('#dsAlerts select[data-role="error/surface"] option').nth(3).getAttribute("value");
await page.locator('#dsAlerts select[data-role="error/surface"]').selectOption(surf); await page.waitForTimeout(400);
check((await st()).roles["error/surface"] === surf, "fond d’erreur choisi, enregistré", surf);
check(await page.evaluate(() => !document.querySelector("#dsMore") || !document.querySelector('#dsMore [data-role^="error/"]')), "les états ne sont plus cachés sous « Désactivé »");
// Voile : sans voile, dégradé à gauche, longueur 75 %, ma couleur.
await page.locator('#dsScrimForm [data-v="none"]').click(); await page.waitForTimeout(300);
check(await page.locator("#dsScrimChk li.warn").count() === 1, "sans voile : contrôle « à vérifier », pas de faux vert");
check(await page.locator("#dsScrimToneF").isHidden(), "sans voile : couleur et intensité masquées");
ex = await exportCss();
check(/\.scrim \{ background: none;/.test(ex.css) && /"none"/.test(JSON.stringify(ex.json.opacity.scrim.$extensions)), "sans voile : export .scrim sans fond, forme none dans le JSON");
await page.locator('#dsScrimForm [data-v="grad"]').click(); await page.locator('#dsScrimShape [data-v="left"]').click(); await page.locator('#dsScrimStop [data-v="0.75"]').click(); await page.waitForTimeout(300);
ex = await exportCss();
check(/linear-gradient\(to right, var\(--scrim-color\) 75%, transparent\)/.test(ex.css), "dégradé, texte à gauche, partie pleine 75 % dans le CSS");
check(/75 %/.test(await page.locator("#dsScrimChk").textContent()), "le contrôle rappelle la partie pleine de 75 %");
await page.locator('#dsScrimTone [data-v="custom"]').click(); await page.waitForTimeout(300);
check(await page.locator("#dsScrimCF").isVisible() && /:1 au pire/.test(await page.locator("#dsScrimCN").textContent()), "ma couleur : sélecteur et contraste au pire affichés");
// Mesure sur une photo (PNG produit ici : moitié blanche, moitié noire).
const png = await page.evaluate(() => { const c = document.createElement("canvas"); c.width = 400; c.height = 200; const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, 400, 200); x.fillStyle = "#000"; x.fillRect(200, 0, 200, 200); return c.toDataURL("image/png").split(",")[1]; });
const PNG = join(tmpdir(), "lisio-photo.png"); writeFileSync(PNG, Buffer.from(png, "base64"));
await page.locator('#dsScrimForm [data-v="none"]').click(); await page.waitForTimeout(200);
await page.setInputFiles("#dsScrimFile", PNG); await page.waitForTimeout(700);
const mNone = await page.locator("#dsScrimMeasure").textContent();
check(/au pire/.test(mNone) && /Ajoutez un voile/.test(mNone), "photo blanche, sans voile : mesure en échec et conseil", mNone);
await page.locator('#dsScrimForm [data-v="solid"]').click(); await page.waitForTimeout(500);
check(/Lisible sur cette photo/.test(await page.locator("#dsScrimMeasure").textContent()), "voile plein : la même photo devient lisible", await page.locator("#dsScrimMeasure").textContent());
check(!(await page.evaluate(() => localStorage.getItem("lisio:state"))).includes("blob:"), "la photo n’est pas enregistrée dans le projet");
await page.locator("#dsScrimNoPhoto").click(); await page.waitForTimeout(200);
// Icônes Lucide dans les boutons.
await page.locator('#dsIcGrid [data-ic="arrow-right"]').click(); await page.locator('#dsIcPos [data-v="end"]').click(); await page.waitForTimeout(300);
check(/Bouton principal, icône « Flèche droite »/.test(await page.locator("#dsIcChk").textContent()), "icône du bouton : contraste mesuré au repos, survol, appui");
await page.fill("#dsIcQ", "panier"); await page.waitForTimeout(300);
check(await page.locator("#dsIcGrid [data-ic]:not([data-ic=''])").count() === 1, "recherche en français : « panier »");
await page.fill("#dsIcQ", ""); await page.waitForTimeout(300);
await page.locator('#dsIcTarget [data-v="secondary"]').click(); await page.locator('#dsIcGrid [data-ic="x"]').click(); await page.locator('#dsIcPos [data-v="only"]').click(); await page.waitForTimeout(300);
check(/aria-label/.test(await page.locator("#dsIcChk").textContent()), "icône seule : nom accessible rappelé");
ex = await exportCss();
check(/Lucide 1\.66\.0/.test(ex.css) && /ISC/.test(ex.css) && /\.icon-arrow-right \{ -webkit-mask-image/.test(ex.css) && /\.icon-x \{/.test(ex.css), "CSS : mention de licence et classes .icon-x");
check(ex.json.$extensions["app.lisio"].icons.buttons.primary.icon === "arrow-right" && ex.json.$extensions["app.lisio"].icons.buttons.secondary.position === "only", "JSON : icônes des boutons");
const frame = await page.evaluate(() => document.getElementById("sysFrame").srcdoc);
check(/icon icon-arrow-right/.test(frame) && /aria-label="[^"]+"><span class="icon icon-x"/.test(frame), "aperçu : boutons avec icône, icône seule nommée");
if (AXE) { await page.addScriptTag({ content: readFileSync(AXE, "utf8") });
  const v = await page.evaluate(async () => (await axe.run({ include: [["section[aria-labelledby=dsChH]"], ["section[aria-labelledby=dsAlH]"], ["section[aria-labelledby=dsScH]"], ["section[aria-labelledby=dsIcH]"]] }, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] })).violations.map(x => x.id + " " + x.nodes.length));
  check(!v.length, "axe-core : aucune violation dans les quatre sections", v.join(", ")); }
// Retour au système de base : exports identiques à ceux du départ.
await page.locator("#dsReset").click(); await page.waitForTimeout(400);
const back = await raw();
check(back.css === base.css && back.json === base.json, "Revenir au système de base : exports identiques au départ");
check(!errors.length, "aucune erreur JavaScript", errors.join(" | "));
await browser.close();
console.log(fails ? `\n${fails} échec(s)` : "\nTous les scénarios passent.");
process.exit(fails ? 1 : 0);
