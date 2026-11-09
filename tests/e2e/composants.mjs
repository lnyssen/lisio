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
  // Côte à côte (cahier « Next-Level », 8 novembre 2026) : chaque état dessiné en clair et en sombre, mesuré dans les deux modes.
  const { ctx, page, errors } = await open({ version: "2.2", level: "AA" });
  const split = page.locator('#sysTheme [data-v="split"]');
  check(!(await split.isVisible()), "page Système : pas de bouton « Côte à côte » (il ne sert qu’aux composants)");
  await page.click('#sysPg button[data-v="states"]'); await page.waitForTimeout(500);
  check(await split.isVisible() && /Côte à côte/.test(await split.textContent()), "page Composants : bouton « Côte à côte »");
  await split.click(); await page.waitForTimeout(900);
  check(await split.getAttribute("aria-pressed") === "true", "« Côte à côte » est marqué comme choisi");
  const f = page.frameLocator("#sysFrame"), cells = await f.locator(".cmp-st").count(), duos = await f.locator(".cmp-st .cmp-duo").count();
  check(cells > 20 && duos === cells, "chaque état est dessiné deux fois, clair et sombre", `${duos} sur ${cells}`);
  const bgs = await f.locator(".cmp-duo").first().evaluate(d => [...d.children].map(x => getComputedStyle(x).backgroundColor));
  const dark = c => { const [r, g, b] = c.match(/\d+/g).map(Number); return r + g + b < 200; };
  check(bgs.length === 2 && !dark(bgs[0]) && dark(bgs[1]), "moitié gauche claire, moitié droite sombre", bgs.join(" | "));
  const btnBg = await f.locator('.cmp[data-cmp="button"] .cmp-duo').first().evaluate(d => [...d.querySelectorAll(".btn-primary")].map(b => getComputedStyle(b).backgroundColor));
  check(btnBg.length === 2 && btnBg[0] !== btnBg[1], "le bouton prend ses couleurs du mode de sa moitié (jetons de composants)", btnBg.join(" | "));
  check(/clair et sombre/i.test(await f.locator(".cmp-sum").textContent()), "le bilan compte les deux modes", await f.locator(".cmp-sum").textContent());
  const dup = await page.frames().find(x => x.url() === "about:srcdoc").evaluate(() => { const ids = [...document.querySelectorAll("[id]")].map(e => e.id); return ids.filter((x, i) => ids.indexOf(x) !== i); });
  check(!dup.length, "aucun identifiant en double dans la vue côte à côte", dup.slice(0, 5).join(", "));
  if (AXE) { const fr = page.frames().find(x => x.url() === "about:srcdoc"); await fr.addScriptTag({ content: readFileSync(AXE, "utf8") });
    const v = await fr.evaluate(async () => (await axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] })).violations.map(x => x.id + " " + x.nodes.length));
    check(!v.length, "axe-core : aucune violation en côte à côte", v.join(", ")); }
  await page.click('#sysPg button[data-v="ds"]'); await page.waitForTimeout(500);
  check(await page.evaluate(() => document.querySelector('#sysTheme [aria-pressed="true"]') && document.querySelector('#sysTheme [aria-pressed="true"]').dataset.v) === "light", "ailleurs, l’aperçu revient en clair");
  check(!errors.length, "aucune erreur JavaScript", errors.join(" | "));
  await ctx.close();
}
{
  // Couche 1 · Primitives : la couleur de base vient en tête de chaque gamme, avant les 11 nuances.
  const cols = [{ name: "Bleu", hex: "#2563EB" }, { name: "Orange", hex: "#D9480F" }];
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }); await ctx.route(/^https?:/, r => r.abort());
  const page = await ctx.newPage(); await page.goto(PAGE + "#systeme");
  await page.evaluate(c => { localStorage.clear(); localStorage.setItem("lisio-welcome", "1"); localStorage.setItem("lisio:colors", JSON.stringify(c)); localStorage.setItem("lisio:state", JSON.stringify({ version: "2.2" })); }, cols);
  await page.reload(); await page.waitForFunction(() => window.__lisioReady === true); await page.waitForTimeout(700);
  const f = page.frameLocator("#sysFrame"), sc = f.locator(".scale").first();
  const first = sc.locator(".sw > div").first();
  check(await first.evaluate(d => d.classList.contains("sw-base")) && /Base/.test(await first.textContent()) && /#2563EB/.test(await first.textContent()), "primitives : la couleur de base en premier, avec son code", await first.textContent());
  check(await sc.locator(".sw > div").count() === 12, "puis les 11 nuances", String(await sc.locator(".sw > div").count()));
  check(await first.evaluate(d => getComputedStyle(d).backgroundColor) === "rgb(37, 99, 235)", "la case de base a la couleur saisie");
  { const nb = await f.locator(".scale .sw-base").count(), ns = await f.locator(".scale:has(.sw)").count(); check(nb === ns && nb === 6, "chaque gamme, couleurs d’état comprises, commence par sa base", `${nb} bases, ${ns} gammes`); }
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
