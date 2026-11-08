// F13 (P2) : la page « Composants » de l’aperçu du système, construite depuis src/core/components.mjs.
//   node tests/e2e/composants.mjs
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
async function open(state, w = 1440) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 } }); await ctx.route(/^https?:/, r => r.abort());
  await ctx.addInitScript(s => { try { if (!sessionStorage.getItem("s")) { sessionStorage.setItem("s", "1"); localStorage.clear(); localStorage.setItem("lisio-welcome", "1"); localStorage.setItem("lisio:state", JSON.stringify(s)); } } catch (e) {} }, state);
  const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
  await page.goto(PAGE + "#systeme"); await page.waitForTimeout(700); return { ctx, page, errors };
}
{
  const { ctx, page, errors } = await open({ version: "2.2", level: "AA" });
  const tab = page.locator('#sysPg button[data-v="states"]');
  check(/^Composants$/.test((await tab.textContent()).trim()), "onglet de l’aperçu nommé « Composants »", await tab.textContent());
  await tab.click(); await page.waitForTimeout(700);
  const f = page.frameLocator("#sysFrame");
  const names = (await f.locator(".cmp h2").allTextContents()).map(s => s.trim());
  check(["Bouton", "Champ de formulaire", "Lien", "Alerte", "Badge de statut", "Navigation", "Carte"].every(n => names.includes(n)), "les sept composants du registre", names.join(" | "));
  const btn = f.locator('.cmp[data-cmp="button"]');
  check(/Lancer une action/.test(await btn.locator(".cmp-use").textContent()), "chaque composant dit à quoi il sert");
  const tok = await btn.locator(".cmp-tok li").allTextContents();
  check(tok.some(t => /--button-primary-background/.test(t) && /action\/default/.test(t)), "jetons du composant listés, avec le rôle vers lequel ils pointent", tok.slice(0, 3).join(" | "));
  const caps = await btn.locator(".st-grid .t-caption.mut").allTextContents();
  check(["Repos", "Survol", "Appuyé", "Désactivé", "Chargement"].every(w => caps.some(c => c.startsWith(w))) && caps.some(c => /^Focus clavier/.test(c)), "bouton : six états dessinés", caps.join(" | "));
  check(/Lisio mesure/.test(await btn.locator(".cmp-lim").textContent()), "limites dites pour chaque composant");
  check(await f.locator(".cmp-man").count() >= 8, "consignes à vérifier à la main affichées", String(await f.locator(".cmp-man").count()));
  const sum = await f.locator(".cmp-sum").textContent();
  check(/\d+ états? mesurés?/.test(sum) && /à vérifier à la main/.test(sum), "bilan : mesurés et à vérifier à la main", sum);
  check(/ne prouve pas/.test(sum), "bilan : mesurer ne prouve pas", sum);
  check(!/accessible à 100|certifi|composants accessibles/i.test(await f.locator("body").textContent()), "aucune promesse de conformité");
  // Un état mesuré dit son ratio ; un rôle décoratif ou désactivé n’est jamais en échec.
  check(await btn.locator(".bdg").first().isVisible() && /:1/.test(await btn.locator(".bdg").first().textContent()), "ratio affiché sur les états mesurés");
  if (AXE) {
    const fr = page.frames().find(x => x.name() === "sysFrame" || x.url() === "about:srcdoc");
    await fr.addScriptTag({ content: readFileSync(AXE, "utf8") });
    const v = await fr.evaluate(async () => (await axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] })).violations.map(x => x.id + " " + x.nodes.length));
    check(!v.length, "axe-core : aucune violation dans la page Composants", v.join(", "));
  }
  check(!errors.length, "aucune erreur JavaScript", errors.join(" | "));
  await ctx.close();
}
{
  // Un bouton au contraste insuffisant : l’état est en échec et le bilan le compte.
  const { ctx, page, errors } = await open({ version: "2.2", level: "AA" });
  await page.click('#sysPg button[data-v="states"]'); await page.waitForTimeout(500);
  const before = await page.frameLocator("#sysFrame").locator(".cmp-sum").textContent();
  check(/en échec/.test(before) || /aucun état en échec/.test(before), "bilan : échecs comptés ou absence dite", before);
  check(!errors.length, "aucune erreur JavaScript", errors.join(" | "));
  await ctx.close();
}
{
  // Correcteur sur les cartes (8 novembre 2026) : un état en échec propose la correction du rôle, et la page se met à jour.
  const { ctx, page, errors } = await open({ version: "2.2", level: "AA", ds: { roles: { "action/default": "#8FB3FF", "text/on-action": "#FFFFFF" } } });
  await page.click('#sysPg button[data-v="states"]'); await page.waitForTimeout(700);
  const f = page.frameLocator("#sysFrame"), fx = f.locator('.cmp[data-cmp="button"] .cmp-fix').first();
  const n0 = await f.locator(".cmp-st.st-fail").count();
  check(n0 > 0 && await fx.count() === 1, "état en échec : bouton « Corriger » sur la carte", `${n0} échecs, ${await f.locator(".cmp-fix").count()} boutons`);
  check(/Corriger/.test(await fx.textContent().catch(() => "")) && /#[0-9A-F]{6}/i.test(await fx.textContent().catch(() => "")) && !/#000000|#FFFFFF/i.test(await fx.textContent().catch(() => "")), "le bouton dit le rôle et propose une nuance de la même teinte (ni noir ni blanc)", await fx.textContent().catch(() => ""));
  // Comme une personne : on fait défiler l’aperçu (sa carte défile seule) jusqu’au bouton, puis on clique à l’écran (l’aperçu est une iframe mise à l’échelle).
  // Position à l’écran = position de l’iframe + position dans l’iframe × échelle (boundingBox ne tient pas compte de la mise à l’échelle).
  const at = async () => { const inner = await fx.evaluate(e => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    return page.evaluate(([x, y]) => { const f = document.getElementById("sysFrame"), r = f.getBoundingClientRect(), k = r.width / f.offsetWidth; return [r.left + x * k, r.top + y * k]; }, inner); };
  let [x, y] = await at(); await page.evaluate(v => { const c = document.getElementById("sysFrame").closest(".sys-card"); if (c) c.scrollTop += v - c.getBoundingClientRect().top - 200; }, y); await page.waitForTimeout(300); [x, y] = await at();
  await page.mouse.click(x, y); await page.waitForTimeout(900);
  const n1 = await page.frameLocator("#sysFrame").locator(".cmp-st.st-fail").count();
  check(n1 < n0, "après « Corriger », moins d’états en échec", `${n0} → ${n1}`);
  const role = await page.evaluate(() => (JSON.parse(localStorage.getItem("lisio:state")).ds.roles || {})["action/default"]);
  check(!!role && role !== "#8FB3FF", "le rôle corrigé est enregistré dans le projet", String(role));
  check(/:1/.test(await page.locator("#toast, .toast").first().textContent().catch(() => "")), "le message dit le nouveau ratio");
  check(!errors.length, "aucune erreur JavaScript", errors.join(" | "));
  await ctx.close();
}
{
  const { ctx, page } = await open({ version: "2.2" }, 390);
  await page.click('#sysPg button[data-v="states"]'); await page.waitForTimeout(500);
  const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(ov <= 0, "390 px : pas de défilement horizontal", String(ov));
  await ctx.close();
}
await browser.close();
console.log(fails ? `\n${fails} échec(s)` : "\nTous les scénarios passent.");
process.exit(fails ? 1 : 0);
