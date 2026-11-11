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
// 1. Premier lancement : accueil avec trois choix, rien de bloquant.
{
  const { ctx, page } = await open({});
  const h = page.locator("#hello");
  check(await h.isVisible(), "accueil affiché au premier lancement");
  check(await h.locator("[data-hello=ess]").count() === 1 && await h.locator("[data-hello=adv]").count() === 1 && await h.locator("[data-hello=new]").count() === 1, "choix : Essentiel, Avancé, créer mon projet (plus la démo)");
  check(await page.evaluate(() => document.documentElement.classList.contains("mode-ess")), "nouveau venu : Essentiel par défaut");
  await go(page, "styles");
  check(await page.locator("#tsList").isVisible(), "on navigue sans répondre à l’accueil");
  if (AXE) { await go(page, "couleurs"); await page.addScriptTag({ content: readFileSync(AXE, "utf8") });
    const v = await page.evaluate(async () => (await axe.run(document.querySelector("#hello"), { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] })).violations.map(x => x.id)); check(!v.length, "axe-core : accueil sans violation", v.join(", ")); }
  else await go(page, "couleurs");
  await h.locator("[data-hello=ess]").click(); await page.waitForTimeout(200);
  check(await h.count() === 0 && await ls(page, "lisio-welcome") === "1" && await ls(page, "lisio-mode") === "ess", "« Je débute » : accueil fermé, Essentiel retenu");
  check(await page.evaluate(() => !!document.activeElement && document.activeElement !== document.body), "le focus reste dans la page");
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
  await page.locator("#hello [data-hello=new]").click(); await page.waitForTimeout(300);
  check(await page.locator("#wizDlg").evaluate(d => d.open), "« Créer mon projet » : l’assistant s’ouvre");
  await page.click("#wizTpl"); await page.waitForTimeout(300);
  check(await page.locator("#prjDlg").evaluate(d => d.open) && await page.evaluate(() => document.activeElement && !!document.activeElement.dataset.tpl), "« Ou partir d’un modèle » : fenêtre Projets, focus sur le premier modèle");
  await ctx.close();
}
await browser.close();
console.log(fails ? `\n${fails} échec(s)` : "\nTous les scénarios passent.");
process.exit(fails ? 1 : 0);
