// Une seule ligne d’aide repliable en haut de chaque étape (choix de Laurent, 7 novembre 2026, 11 h 07) :
// « Étape N sur 7 », l’état, et un bouton « Aide » qui déplie l’explication, les pastilles « ? » et,
// en Essentiel, l’invitation « Afficher les réglages avancés ». Fermé par défaut, ouvert ou fermé retenu.
//   node tests/e2e/aide-ligne.mjs
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PAGE = "file://" + (process.env.LISIO_PAGE || join(ROOT, "index.html"));
let chromium, devices;
try { ({ chromium, devices } = createRequire(import.meta.url)("playwright")); } catch (e) { console.log("IGNORÉ : Playwright introuvable."); process.exit(process.env.CI ? 1 : 0); }
const AXE = process.env.AXE_PATH;
const browser = await chromium.launch();
let fails = 0;
const check = (ok, label, detail = "") => { if (!ok) fails++; console.log(`${ok ? "ok   " : "ÉCHEC"} ${label}${detail ? " : " + detail : ""}`); };
async function open(opts, view = "palette", mode = "ess") {
  const ctx = await browser.newContext(opts); await ctx.route(/^https?:/, r => r.abort());
  await ctx.addInitScript(m => { try { if (!sessionStorage.getItem("s")) { sessionStorage.setItem("s", "1"); localStorage.clear(); localStorage.setItem("lisio-welcome", "1"); localStorage.setItem("lisio-home", "off"); localStorage.setItem("lisio-mode", m); } } catch (e) {} }, mode);
  const p = await ctx.newPage(); p.errs = []; p.on("pageerror", e => p.errs.push(String(e)));
  await p.goto(PAGE + "#" + view); await p.waitForTimeout(600); p.ctx = ctx; return p;
}
const shown = (p, sel) => p.evaluate(s => [...document.querySelectorAll(s)].filter(e => e.getClientRects().length && e.getBoundingClientRect().height > 1).length, sel);
const go = async (p, v) => { await p.evaluate(v => { location.hash = v; }, v); await p.waitForTimeout(250); };

{ const p = await open({ viewport: { width: 1440, height: 900 } });
  const line = await p.evaluate(() => { const b = document.getElementById("jNowBox"), r = b.getBoundingClientRect(), h = b.querySelector(".j-help-b"); return { h: Math.round(r.height), t: b.textContent.replace(/\s+/g, " ").trim(), btn: h && h.textContent.trim(), exp: h && h.getAttribute("aria-expanded") }; });
  check(/Étape 2 sur 7/.test(line.t) && /Aide/.test(line.btn || "") && line.exp === "false", "une ligne : « Étape 2 sur 7 », l’état et un bouton « Aide » fermé", JSON.stringify(line));
  check(line.h <= 56, "fermée, la ligne d’aide tient sur une ligne", line.h + " px");
  check(await shown(p, "#jNowBox .qchip") === 0 && await shown(p, "main .adv-hint") === 0, "fermée : ni pastilles « ? », ni bandeau Essentiel sur la page");
  await p.click("#jNowBox .j-help-b"); await p.waitForTimeout(200);
  const op = await p.evaluate(() => { const h = document.getElementById("jHelp"); return { exp: document.querySelector("#jNowBox .j-help-b").getAttribute("aria-expanded"), vis: !!h && !h.hidden && h.getBoundingClientRect().height > 1, t: h ? h.textContent : "" }; });
  check(op.exp === "true" && op.vis, "« Aide » déplie le panneau, état annoncé", JSON.stringify({ exp: op.exp, vis: op.vis }));
  check(/11 nuances/.test(op.t) && await shown(p, '#jHelp .qchip[data-q="etape"]') === 1, "dépliée : l’explication de l’étape et les pastilles « ? »");
  check(await shown(p, "#jHelp .adv-hint") === 1 && /Afficher les réglages avancés/.test(op.t), "dépliée, en Essentiel : l’invitation « Afficher les réglages avancés »");
  await p.click("#jHelp .adv-hint button"); await p.waitForTimeout(250);
  check(await p.evaluate(() => localStorage.getItem("lisio-mode")) === "adv" && await shown(p, "#jHelp .adv-hint") === 0, "le bouton passe en Avancé ; l’invitation disparaît");
  await go(p, "styles");
  check(await p.evaluate(() => document.querySelector("#jNowBox .j-help-b").getAttribute("aria-expanded")) === "true", "ouverte, l’aide le reste d’une étape à l’autre");
  await p.focus("#jNowBox .j-help-b"); await p.keyboard.press("Enter"); await p.waitForTimeout(150);
  check(await p.evaluate(() => document.getElementById("jHelp").hidden && document.querySelector("#jNowBox .j-help-b").getAttribute("aria-expanded") === "false"), "clavier : Entrée replie l’aide");
  await go(p, "tester");
  check(await p.evaluate(() => document.getElementById("jHelp").hidden), "fermée, elle le reste aussi");
  if (AXE) { await p.click("#jNowBox .j-help-b"); await p.addScriptTag({ content: readFileSync(AXE, "utf8") });
    const v = await p.evaluate(async () => (await axe.run(document.getElementById("jNowBox"), { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] })).violations.map(x => x.id + " " + x.nodes.length));
    check(!v.length, "axe-core : ligne d’aide ouverte", v.join(", ")); }
  check(!p.errs.length, "aucune erreur JavaScript", p.errs.join(" | ")); await p.ctx.close(); }

for (const [lab, o] of [["iPhone 390 px", { ...devices["iPhone 13"] }], ["320 px", { viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true }]]) {
  const p = await open(o, "systeme");
  const h = await p.evaluate(() => Math.round(document.getElementById("jNowBox").getBoundingClientRect().height));
  // Refonte du 11 novembre 2026 : sur mobile, l’étape et son état sont dans le bouton collé en haut ; le bandeau garde l’affichage, l’aide et la prochaine action.
  check(h <= 170 && await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${lab} : bandeau compact (affichage et aide, puis la prochaine action), sans débordement`, h + " px");
  await p.click("#jNowBox .j-help-b"); await p.waitForTimeout(200);
  check(await shown(p, "#jHelp .adv-hint") === 1 && await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${lab} : dépliée, invitation Essentiel visible, sans débordement`);
  await p.ctx.close(); }

await browser.close();
console.log(fails ? `\n${fails} contrôle(s) en échec` : "\nTous les scénarios passent.");
process.exit(fails ? 1 : 0);
