// Mobile : menu et fenêtres en volets à glisser vers le bas pour fermer, menu sans défilement avec le choix
// Essentiel / Avancé, barre de la page Polices qui ne cache plus l'aperçu.   node tests/e2e/mobile.mjs
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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
const SEED = join(tmpdir(), "lisio-seed-mobile.html"); writeFileSync(SEED, "<!doctype html><title>seed</title>");
async function open(opts, mode = "adv", hash = "tester") {
  const ctx = await browser.newContext(opts); await ctx.route(/^https?:/, r => r.abort());
  const page = await ctx.newPage(); page.errors = []; page.on("pageerror", e => page.errors.push(String(e)));
  await page.goto("file://" + SEED); await page.evaluate(m => { localStorage.clear(); localStorage.setItem("lisio-welcome", "1"); localStorage.setItem("lisio-mode", m); }, mode);
  await page.goto(PAGE + "#" + hash); await page.waitForTimeout(700); return { ctx, page };
}
const swipe = async (page, sel, dist, steps = 10) => { const b = await page.locator(sel).boundingBox(); const x = b.x + b.width / 2, y = b.y + Math.min(20, b.height / 2);
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x, y + dist, { steps }); await page.mouse.up(); await page.waitForTimeout(350); };
const phone = { ...devices["iPhone 13"] };
{
  const { ctx, page } = await open(phone, "ess");
  // Menu : choix de l'affichage, aucun défilement, poignée.
  await page.click("#moreB"); await page.waitForTimeout(300);
  const seg = page.locator("#moreSheet .mode-seg");
  check(await seg.isVisible(), "menu mobile : choix Essentiel / Avancé visible");
  check(await seg.locator('[data-mode="ess"]').getAttribute("aria-pressed") === "true", "le choix en cours est indiqué");
  const box = await page.evaluate(() => { const e = document.getElementById("moreSheet"), r = e.getBoundingClientRect(); return { sh: e.scrollHeight, ch: e.clientHeight, top: r.top, bottom: r.bottom, vh: innerHeight }; });
  check(box.sh <= box.ch + 1 && box.top >= 0 && box.bottom <= box.vh + 1, "menu mobile : tout tient sans défilement", JSON.stringify(box));
  check(await page.locator("#moreSheet .sheet-grab").isVisible(), "menu mobile : poignée visible");
  await seg.locator('[data-mode="adv"]').click(); await page.waitForTimeout(200);
  check(await page.evaluate(() => !document.documentElement.classList.contains("mode-ess") && localStorage.getItem("lisio-mode") === "adv"), "« Avancé » depuis le menu mobile");
  check(await seg.locator('[data-mode="adv"]').getAttribute("aria-pressed") === "true" && await page.locator("#moreSheet").evaluate(e => e.open), "état mis à jour, menu toujours ouvert");
  // Glisser : un petit geste ne ferme pas, un geste franc ferme.
  await swipe(page, "#moreSheet .mh", 25);
  check(await page.locator("#moreSheet").evaluate(e => e.open), "glisser de 25 px : le menu reste ouvert");
  await swipe(page, "#moreSheet .mh", 180);
  check(!(await page.locator("#moreSheet").evaluate(e => e.open)), "glisser vers le bas : le menu se ferme");
  check(await page.evaluate(() => document.activeElement && document.activeElement.id === "moreB"), "focus rendu au bouton du menu");
  // Glisser depuis une tuile ferme aussi, sans ouvrir la page de la tuile.
  await page.click("#moreB"); await page.waitForTimeout(300);
  const before = await page.evaluate(() => location.hash);
  await swipe(page, '#moreSheet [data-go="lisibilite"]', 180);
  check(!(await page.locator("#moreSheet").evaluate(e => e.open)) && await page.evaluate(() => location.hash) === before, "glisser depuis une tuile : fermeture, sans changer de page");
  // Un simple toucher sur une tuile ouvre toujours la page.
  await page.click("#moreB"); await page.waitForTimeout(300); await page.click('#moreSheet [data-go="lisibilite"]'); await page.waitForTimeout(300);
  check(await page.evaluate(() => location.hash) === "#lisibilite", "toucher une tuile ouvre la page");
  await page.goto(PAGE + "#tester"); await page.waitForTimeout(600);
  // Bug corrigé : la pastille « Texte » ne change plus l'affichage.
  await page.evaluate(() => localStorage.setItem("lisio-mode", "ess")); await page.reload(); await page.waitForTimeout(600);
  await page.locator("#dFg").scrollIntoViewIfNeeded(); await page.click("#dFg"); await page.waitForTimeout(300);
  check(await page.evaluate(() => localStorage.getItem("lisio-mode") === "ess" && document.documentElement.classList.contains("mode-ess")), "toucher la couleur du texte ne change pas l’affichage");
  // Fenêtre de couleur : volet en bas, poignée, glisser pour fermer.
  const pc = await page.evaluate(() => { const r = document.getElementById("popColor").getBoundingClientRect(); return { bottom: Math.round(r.bottom), vh: innerHeight, w: Math.round(r.width), vw: innerWidth }; });
  check(Math.abs(pc.bottom - pc.vh) <= 2 && pc.w >= pc.vw - 2, "couleur : volet ancré en bas, pleine largeur", JSON.stringify(pc));
  check(await page.locator("#popColor .sheet-grab").isVisible(), "couleur : poignée visible");
  await swipe(page, "#popColor h3", 180);
  check(await page.locator("#popColor").isHidden(), "couleur : glisser vers le bas ferme");
  // Aperçu de la page Polices : la barre est au-dessus (audit UX du 11 novembre 2026) et ne le recouvre pas ; elle tient sur une ligne.
  await page.evaluate(() => document.getElementById("dockIn").scrollIntoView({ block: "start" })); await page.waitForTimeout(200);
  const dk = await page.evaluate(() => { const c = document.querySelector("#tester .stage").getBoundingClientRect(), d = document.getElementById("dockIn").getBoundingClientRect(); return { ct: Math.round(c.top), db: Math.round(d.bottom), dh: Math.round(d.height), dr: Math.round(d.right), vw: innerWidth }; });
  check(dk.db <= dk.ct, "Polices : la barre d’outils ne recouvre pas l’aperçu", JSON.stringify(dk));
  check(dk.dh <= 64 && dk.dr <= dk.vw, "Polices : barre d’outils sur une ligne, sans débordement", JSON.stringify(dk));
  check(/Texte/.test(await page.locator("#dFg").evaluate(e => e.textContent)), "pastille « Texte » toujours nommée pour le lecteur d’écran");
  // Aide « ? » : volet, glisser pour fermer.
  check(await page.evaluate(() => [...document.querySelectorAll("input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]),select,textarea")].every(e => parseFloat(getComputedStyle(e).fontSize) >= 16)), "champs en 16 px au moins : pas de zoom sur iPhone (recherche comprise)");
  await page.goto(PAGE + "#couleurs"); await page.waitForTimeout(500);
  const q = page.locator("[data-q]:visible").first();
  if (await q.count()) { await q.scrollIntoViewIfNeeded(); await q.click(); await page.waitForTimeout(300);
    check(await page.locator("#qPop .sheet-grab").isVisible(), "aide « ? » : poignée visible");
    await swipe(page, "#qPop .qpop-h", 180); check(await page.locator("#qPop").isHidden(), "aide « ? » : glisser vers le bas ferme"); }
  // Projets : volet, glisser depuis l'en-tête pour fermer.
  await page.click("#moreB"); await page.waitForTimeout(250); await page.click("#moreSheet [data-prj-open]"); await page.waitForTimeout(400);
  const pd = await page.evaluate(() => { const r = document.getElementById("prjDlg").getBoundingClientRect(); return { bottom: Math.round(r.bottom), vh: innerHeight }; });
  check(Math.abs(pd.bottom - pd.vh) <= 2, "Projets : volet ancré en bas", JSON.stringify(pd));
  await swipe(page, "#prjDlg .pd-h", 200);
  check(!(await page.locator("#prjDlg").evaluate(e => e.open)), "Projets : glisser vers le bas ferme");
  if (AXE) { await page.click("#moreB"); await page.waitForTimeout(300); await page.addScriptTag({ content: readFileSync(AXE, "utf8") });
    const v = await page.evaluate(async () => (await axe.run(document.querySelector("#moreSheet"), { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] })).violations.map(x => x.id + " " + x.nodes.length));
    check(!v.length, "axe-core : aucune violation dans le menu mobile", v.join(", ")); }
  check(!page.errors.length, "mobile : aucune erreur JavaScript", page.errors.join(" | "));
  await ctx.close();
}
{
  // Ordinateur : fenêtres inchangées (centrées, sans poignée).
  const { ctx, page } = await open({ viewport: { width: 1280, height: 900 } });
  await page.click("#dFg"); await page.waitForTimeout(300);
  const pc = await page.evaluate(() => { const r = document.getElementById("popColor").getBoundingClientRect(); return { bottom: Math.round(r.bottom), vh: innerHeight, w: Math.round(r.width) }; });
  check(pc.bottom < pc.vh - 40 && pc.w <= 440, "ordinateur : fenêtre de couleur centrée comme avant", JSON.stringify(pc));
  check(await page.locator("#popColor .sheet-grab").isHidden(), "ordinateur : pas de poignée");
  check(!page.errors.length, "ordinateur : aucune erreur JavaScript", page.errors.join(" | "));
  await ctx.close();
}
await browser.close();
console.log(fails ? `\n${fails} échec(s)` : "\nTous les scénarios passent.");
process.exit(fails ? 1 : 0);
