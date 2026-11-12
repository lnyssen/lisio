// P1 · Accueil et mode Essentiel / Avancé : un choix au premier lancement, des réglages fins masqués
// en Essentiel, jamais bloquant pour un expert (un clic pour tout afficher, toutes les pages accessibles).
//   node tests/e2e/modes.mjs
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
async function open(init, view = "couleurs") {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }); await ctx.route(/^https?:/, r => r.abort());
  await ctx.addInitScript(o => { try { if (!sessionStorage.getItem("s")) { sessionStorage.setItem("s", "1"); localStorage.clear(); for (const [k, v] of Object.entries(o)) localStorage.setItem(k, v); } } catch (e) {} }, init);
  const page = await ctx.newPage(); page.errs = []; page.on("pageerror", e => page.errs.push(String(e)));
  await page.goto(PAGE + "#" + view); await page.waitForTimeout(500); return { ctx, page };
}
const go = async (page, v) => { await page.goto(PAGE.split("#")[0] + "#" + v); await page.waitForTimeout(350); };
const ls = (page, k) => page.evaluate(k => localStorage.getItem(k), k);
// 1. Écran d’accueil (12 novembre 2026) : à chaque ouverture, jeu « Lisible ou pas ? », schéma des 7 étapes, rien de bloquant.
{
  const { ctx, page } = await open({});
  const h = page.locator("#home");
  check(await page.evaluate(() => document.getElementById("home").open), "accueil ouvert au lancement");
  check(await h.locator("[data-home=new]").count() === 1 && await h.locator("[data-home=demo]").count() === 1 && await h.locator("[data-home=skip]").count() === 1, "choix : créer mon projet, la démo, aller à l’outil");
  check(await h.locator(".hm-steps a").count() === 7, "schéma : les 7 étapes, chacune un lien");
  // 12 novembre 2026 (retours de Laurent) : le dégradé de Nuances reste au survol ; même logo et mêmes marges que l’outil.
  await h.locator(".hm-steps a").nth(1).hover(); await page.waitForTimeout(400);
  check(await page.evaluate(() => /gradient/.test(getComputedStyle(document.querySelector(".hm-rp")).backgroundImage)), "survol : l’icône Nuances garde son dégradé");
  check(await page.evaluate(() => { const a = document.querySelector(".hm-brand svg"), b = document.querySelector("#homeB svg"); const k = e => [...e.children].map(x => x.tagName + (x.getAttribute("d") || x.getAttribute("r") || x.getAttribute("rx") || "")).join(); return k(a) === k(b); }), "accueil : même logo que l’outil");
  check(await page.evaluate(() => { const r = document.querySelector(".hm-top").getBoundingClientRect(), m = document.querySelector("main").getBoundingClientRect(); return Math.abs(r.left - m.left) <= 1 && Math.abs(r.right - m.right) <= 1; }), "accueil : mêmes marges que l’outil, à gauche et à droite");
  check(await page.evaluate(() => document.activeElement && document.activeElement.closest("#home") !== null), "le focus est dans l’accueil");
  if (AXE) { await page.addScriptTag({ content: readFileSync(AXE, "utf8") });
    const v = await page.evaluate(async () => (await axe.run(document.querySelector("#home"), { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] })).violations.map(x => x.id)); check(!v.length, "axe-core : accueil sans violation", v.join(", ")); }
  // Le jeu : on répond, Lisio donne le ratio et le score, puis une autre paire.
  await h.locator('[data-guess="1"]').click(); await page.waitForTimeout(150);
  const res = await page.textContent("#hmRes");
  check(/(Bien vu|Raté)/.test(res) && /:1/.test(res) && /1 sur 1|0 sur 1/.test(await page.textContent("#hmScore")), "jeu : verdict, ratio et score", res.trim().slice(0, 80));
  const p1 = await page.textContent("#hmPair"); await h.locator('[data-guess="next"]').click(); await page.waitForTimeout(150);
  check(await h.locator('[data-guess="1"]').count() === 1 && await page.textContent("#hmPair") !== "" , "paire suivante", p1);
  check(await page.evaluate(() => document.documentElement.classList.contains("mode-ess")), "nouveau venu : Essentiel par défaut");
  // Une étape du schéma ouvre l’outil à cet endroit.
  await h.locator('.hm-steps a[data-home-go="styles"]').click(); await page.waitForTimeout(350);
  check(!(await page.evaluate(() => document.getElementById("home").open)) && await page.locator("#tsList").isVisible(), "une étape du schéma ferme l’accueil et ouvre l’étape");
  // Le logo le rouvre ; Échap le ferme.
  await page.click("#homeB"); await page.waitForTimeout(200);
  check(await page.evaluate(() => document.getElementById("home").open), "le logo rouvre l’accueil");
  await page.keyboard.press("Escape"); await page.waitForTimeout(150);
  check(!(await page.evaluate(() => document.getElementById("home").open)) && await page.evaluate(() => !!document.activeElement && document.activeElement !== document.body), "Échap ferme l’accueil, le focus reste dans la page");
  // À chaque ouverture, sauf si l’on coche « Ne plus afficher ».
  await page.reload(); await page.waitForTimeout(500);
  check(await page.evaluate(() => document.getElementById("home").open), "rechargé : l’accueil revient (à chaque ouverture)");
  await page.check("#homeOff"); await h.locator("[data-home=skip]").click(); await page.waitForFunction(() => localStorage.getItem("lisio-home") === "off"); await page.reload(); await page.waitForLoadState("load"); await page.waitForTimeout(800);
  check(!(await page.evaluate(() => document.getElementById("home").open)) && await ls(page, "lisio-home") === "off", "« Ne plus afficher au démarrage » est respecté");
  await go(page, "couleurs");
  // 2. Essentiel : réglages fins masqués, une invitation à tout afficher sur chaque page concernée.
  const hidden = [["palette", "#shSet"], ["styles", "#tsFluCard"], ["systeme", 'section[aria-labelledby="dsElH"]'], ["exporter", "#exCssAdv"]];
  for (const [v, sel] of hidden) { await go(page, v);
    // L’invitation est dans la ligne d’aide repliable (choix de Laurent, 7 novembre 2026).
    if (await page.getAttribute("#jNowBox .j-help-b", "aria-expanded") !== "true") { await page.click("#jNowBox .j-help-b"); await page.waitForTimeout(150); }
    check(await page.locator(sel).isHidden() && await page.locator("#jHelp .adv-hint").first().isVisible(), `Essentiel, ${v} : réglages fins masqués, invitation dans l’aide de la page`); }
  await go(page, "tester");
  check(await page.locator("#checks").isVisible(), "Essentiel : les vérifications restent visibles");
  const navEss = await page.locator("nav.tabs a, nav.tabs button").count();
  // 3. Un clic pour tout afficher.
  await go(page, "palette");
  await page.locator("#jHelp .adv-hint button").click(); await page.waitForTimeout(200);
  check(await page.locator("#shSet").isVisible() && await ls(page, "lisio-mode") === "adv", "« Afficher les réglages avancés » : tout réapparaît");
  check(await page.locator("nav.tabs a, nav.tabs button").count() === navEss, "même menu dans les deux modes");
  // 4. Bascule dans la ligne de l’étape (audit UX du 11 novembre 2026 : un seul endroit sur ordinateur).
  const ess = page.locator('#jNowBox .j-mode button[data-mode="ess"]');
  check(await ess.isVisible() && (await page.locator('#jNowBox .j-mode button[data-mode="adv"]').getAttribute("aria-pressed")) === "true", "ligne de l’étape : choix de l’affichage, état annoncé");
  await ess.click(); await page.waitForTimeout(200);
  check(await ls(page, "lisio-mode") === "ess" && (await ess.getAttribute("aria-pressed")) === "true", "retour en Essentiel depuis le menu");
  check(!page.errs.length, "aucune erreur JavaScript", page.errs.join(" | "));
  await ctx.close();
}
// 5. Essentiel par défaut pour tout le monde (brief « Allègement », 9 novembre 2026) ; un choix déjà fait est respecté.
{
  const { ctx, page } = await open({ "lisio-welcome": "1" }, "palette");
  check(await page.locator("#hello").count() === 0 && await page.evaluate(() => document.documentElement.classList.contains("mode-ess")) && !(await page.locator("#shSet").isVisible()), "utilisateur existant sans choix : Essentiel, sans accueil");
  await ctx.close();
}
{
  const { ctx, page } = await open({ "lisio-welcome": "1", "lisio-mode": "adv" }, "palette");
  check(await page.locator("#shSet").isVisible(), "utilisateur qui a choisi Avancé : son choix est gardé");
  await ctx.close();
}
// 6. « Créer mon projet » ouvre l’assistant ; « Ou partir d’un modèle » y mène aux modèles.
{
  const { ctx, page } = await open({});
  await page.locator("#home [data-home=new]").click(); await page.waitForTimeout(300);
  check(await page.locator("#wizDlg").evaluate(d => d.open), "« Créer mon projet » : l’assistant s’ouvre");
  await page.click("#wizTpl"); await page.waitForTimeout(300);
  check(await page.locator("#prjDlg").evaluate(d => d.open) && await page.evaluate(() => document.activeElement && !!document.activeElement.dataset.tpl), "« Ou partir d’un modèle » : fenêtre Projets, focus sur le premier modèle");
  await ctx.close();
}
await browser.close();
console.log(fails ? `\n${fails} échec(s)` : "\nTous les scénarios passent.");
process.exit(fails ? 1 : 0);
