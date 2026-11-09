// Allègement visuel : hiérarchie des boutons, mode Essentiel par défaut, matrice allégée, volet d’aide, espacements.
//   node tests/e2e/allegement.mjs
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
const check = (cond, label, extra = "") => { if (cond) console.log("ok    " + label); else { fails++; console.log("ÉCHEC " + label + (extra ? " : " + extra : "")); } };
const MINE = [{ name: "Bleu", hex: "#2563EB" }, { name: "Nuit", hex: "#101828" }, { name: "Blanc", hex: "#FFFFFF" }, { name: "Ciel", hex: "#7DD3FC" }];
async function open(hash, ls = {}, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts }); await ctx.route(/^https?:/, r => r.abort());
  const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
  await page.goto(PAGE + hash);
  await page.evaluate(([cols, ls]) => { localStorage.clear(); localStorage.setItem("lisio-welcome", "1"); localStorage.setItem("lisio:colors", JSON.stringify(cols)); localStorage.setItem("lisio:state", JSON.stringify({ projectName: "Mon site" })); for (const k in ls) localStorage.setItem(k, ls[k]); }, [MINE, ls]);
  await page.reload(); await page.waitForFunction(() => window.__lisioReady === true); await page.waitForTimeout(400); return { ctx, page, errors };
}
const axeOn = async (page, sel, lab) => { if (!AXE) return; if (!(await page.evaluate(() => typeof axe !== "undefined"))) await page.addScriptTag({ content: readFileSync(AXE, "utf8") });
  const v = await page.evaluate(async s => (await axe.run(document.querySelector(s), { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] })).violations.map(x => x.id + " " + x.nodes.map(n => n.html.slice(0, 80)).join(" ; ")), sel);
  check(!v.length, `axe-core : aucune violation, ${lab}`, v.join(", ")); };
{
  // 1. Hiérarchie des boutons : un seul bouton plein, « Étape suivante » ; Exporter en secondaire.
  const { ctx, page, errors } = await open("#couleurs");
  const st = await page.evaluate(() => { const cs = s => getComputedStyle(document.querySelector(s)); const e = cs("#expAll"), t = cs("#helpB"), n = document.querySelector("#jNext .btn.primary"), nc = n && getComputedStyle(n), r = n && n.getBoundingClientRect();
    return { eBg: e.backgroundColor, tBg: t.backgroundColor, eBorder: e.borderTopWidth, nBg: nc && nc.backgroundColor, nH: r && r.height, nFs: nc && parseFloat(nc.fontSize), nTxt: n && n.textContent }; });
  check(st.eBg === st.tBg && parseFloat(st.eBorder) >= 1, "Exporter (barre du haut) : bouton secondaire, même fond que « Outils », avec un contour", JSON.stringify(st));
  check(/Étape suivante/.test(st.nTxt || "") && st.nBg !== st.tBg && st.nH >= 48 && st.nFs >= 16, "« Étape suivante » : bouton plein, 48 px de haut au moins, texte 16 px", JSON.stringify(st));
  check(!errors.length, "aucune erreur JavaScript", errors.join(" | "));
  await ctx.close();
}
{
  // 2. Essentiel par défaut, et la bascule Essentiel | Avancé en tête de chaque étape.
  const { ctx, page, errors } = await open("#styles", { "lisio-mode": "" });
  check(await page.evaluate(() => document.documentElement.classList.contains("mode-ess")), "sans choix enregistré : affichage Essentiel");
  const seg = page.locator("#jNowBox .mode-seg");
  check(await seg.count() === 1 && await seg.isVisible() && await seg.getAttribute("role") === "group" && /Affichage/.test(await page.evaluate(() => { const g = document.querySelector("#jNowBox .mode-seg"), l = g && document.getElementById(g.getAttribute("aria-labelledby")); return (l && l.textContent) || (g && g.getAttribute("aria-label")) || ""; })), "bascule « Essentiel | Avancé » en tête de l’étape, groupe nommé");
  check(await page.getAttribute('#jNowBox .j-mode [data-mode="ess"]', "aria-pressed") === "true", "Essentiel est l’état pressé");
  await page.click('#jNowBox .j-mode [data-mode="adv"]'); await page.waitForTimeout(300);
  check(await page.evaluate(() => !document.documentElement.classList.contains("mode-ess") && localStorage.getItem("lisio-mode") === "adv") && await page.getAttribute('#jNowBox .j-mode [data-mode="adv"]', "aria-pressed") === "true", "« Avancé » : tout s’affiche, choix retenu, état annoncé");
  check(await page.evaluate(() => document.activeElement && document.activeElement.dataset.mode === "adv"), "le focus reste sur le bouton après le changement");
  const ok = await page.evaluate(() => { const r = document.querySelector("#jNowBox .j-line").getBoundingClientRect(); return r.height <= 60; });
  check(ok, "la ligne « Étape N sur 7 » reste sur une ligne à 1440 px");
  await axeOn(page, "#jNowBox", "ligne d’étape avec la bascule");
  check(!errors.length, "aucune erreur JavaScript", errors.join(" | "));
  await ctx.close();
}
{
  const { ctx, page } = await open("#styles", { "lisio-mode": "" }, { ...devices["iPhone 13"] });
  const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const b = await page.locator('#jNowBox .j-mode [data-mode="adv"]').boundingBox();
  check(ov <= 0 && b && b.height >= 24 && b.width >= 24, "mobile : bascule visible, cible de 24 px au moins, sans défilement horizontal", JSON.stringify({ ov, b }));
  await ctx.close();
}
{
  // 3. Matrice des contrastes : le verdict seul ; le ratio au survol, au focus clavier et au toucher ; cases aérées.
  const { ctx, page, errors } = await open("#matrice", { "lisio-mode": "adv" });
  const c = page.locator('.mcell[data-i="0"][data-j="1"]');
  const vis = sel => page.evaluate(s => { const e = document.querySelector(s); if (!e) return false; const cs = getComputedStyle(e), r = e.getBoundingClientRect(); return cs.visibility !== "hidden" && cs.display !== "none" && +cs.opacity > 0 && r.width > 0; }, sel);
  const R = '.mcell[data-i="0"][data-j="1"] .r', VL = '.mcell[data-i="0"][data-j="1"] .vl';
  await page.mouse.move(0, 0);
  check(await vis(VL) && !(await vis(R)), "au repos : la case montre le verdict, pas le ratio");
  check(/pour 1/.test(await c.getAttribute("aria-label")), "le ratio reste dans le nom accessible de la case");
  const b0 = await c.boundingBox();
  await c.hover(); await page.waitForTimeout(250);
  check(await vis(R), "au survol : le ratio apparaît");
  const b1 = await c.boundingBox();
  check(Math.abs(b0.height - b1.height) < 1 && Math.abs(b0.width - b1.width) < 1, "le ratio apparaît sans changer la taille de la case", JSON.stringify([b0, b1]));
  await page.mouse.move(0, 0); await page.waitForTimeout(200);
  await page.focus('.mcell[data-i="1"][data-j="0"]'); await page.keyboard.press("Tab"); await page.keyboard.press("Shift+Tab"); await page.waitForTimeout(250);
  check(await vis('.mcell[data-i="1"][data-j="0"] .r'), "au focus clavier : le ratio apparaît");
  await c.click(); await page.mouse.move(0, 0); await page.waitForTimeout(300);
  check(await c.getAttribute("aria-pressed") === "true" && await vis(R) && await page.locator("#pairDetail").isVisible(), "au clic ou au toucher : la case reste ouverte, ratio et détail de la paire");
  const pad = await page.evaluate(() => { const e = document.querySelector(".mcell"), cs = getComputedStyle(e), g = getComputedStyle(document.querySelector("#mgrid")); return { l: parseFloat(cs.paddingLeft), t: parseFloat(cs.paddingTop), gap: parseFloat(g.rowGap) }; });
  check(pad.l >= 12 && pad.t >= 12 && pad.gap >= 12, "cases aérées : 12 px de marge intérieure et 12 px entre les cases", JSON.stringify(pad));
  check(!errors.length, "aucune erreur JavaScript", errors.join(" | "));
  await ctx.close();
}
{
  // 4. Volet d’aide à droite : la règle, les seuils, le lien W3C ; Échap le ferme et rend le focus ; défiler ne le ferme pas.
  const { ctx, page, errors } = await open("#matrice", { "lisio-mode": "ess", "lisio-help": "1" });
  const chip = page.locator('#jHelp .qchip[data-q="ratio"]');
  await chip.click(); await page.waitForTimeout(300);
  const d = await page.evaluate(() => { const q = document.getElementById("qPop"), r = q.getBoundingClientRect(); return { open: !q.hidden, role: q.getAttribute("role"), lab: !!document.getElementById(q.getAttribute("aria-labelledby")).textContent, right: innerWidth - r.right, top: r.top, h: r.height, w: r.width, vh: innerHeight, focus: document.activeElement.matches("#qPop [data-qclose]"), w3c: [...q.querySelectorAll("a")].map(a => a.href) }; });
  check(d.open && d.role === "dialog" && d.lab && d.focus, "« ? » ouvre un volet nommé, focus sur « Fermer »", JSON.stringify(d));
  check(d.right <= 1 && d.top <= 1 && d.h >= d.vh - 2 && d.w >= 320 && d.w <= 480, "le volet occupe le bord droit, toute la hauteur", JSON.stringify(d));
  check(d.w3c.some(u => u === "https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html"), "le volet donne la règle et le lien vers le W3C (1.4.3)", d.w3c.join(" "));
  await page.mouse.wheel(0, 400); await page.waitForTimeout(300);
  check(await page.locator("#qPop").isVisible(), "défiler la page ne ferme pas le volet");
  await page.keyboard.press("Escape"); await page.waitForTimeout(200);
  check(await page.locator("#qPop").isHidden() && await page.evaluate(() => document.activeElement.matches('.qchip[data-q="ratio"]')), "Échap ferme le volet et rend le focus au « ? »");
  // Les notes longues de la page passent dans le volet ; une phrase utile reste.
  const more = page.locator("#matrice .qchip[data-more]");
  check(await more.count() >= 1 && await more.first().isVisible(), "Contrastes : la note longue est remplacée par un lien « ? » vers le volet");
  check(!(await page.locator("#matrice").innerText()).includes("formule de luminance relative du W3C"), "le détail du calcul n’encombre plus la page");
  await more.first().click(); await page.waitForTimeout(300);
  check(/luminance relative/.test(await page.textContent("#qPop")), "le volet montre la note complète");
  await axeOn(page, "#qPop", "volet d’aide");
  await page.keyboard.press("Escape");
  check(!errors.length, "aucune erreur JavaScript", errors.join(" | "));
  await ctx.close();
}
{
  const { ctx, page } = await open("#systeme", { "lisio-mode": "ess" });
  const n = await page.locator("#systeme .qchip[data-more]").count();
  check(n >= 2, "Design system : les notes longues passent dans le volet", String(n));
  const s2 = await open("#styles", { "lisio-mode": "ess" });
  check(await s2.page.locator("#styles .qchip[data-more]").count() >= 1, "Styles de texte : la note sur le fichier de jetons passe dans le volet");
  await s2.ctx.close(); await ctx.close();
}
{
  const { ctx, page } = await open("#matrice", { "lisio-mode": "ess", "lisio-help": "1" }, { ...devices["iPhone 13"] });
  await page.locator('#jHelp .qchip[data-q="ratio"]').tap(); await page.waitForTimeout(400);
  const r = await page.evaluate(() => { const b = document.getElementById("qPop").getBoundingClientRect(); return { b: innerHeight - b.bottom, w: b.width, vw: innerWidth }; });
  check(r.b <= 1 && r.w >= r.vw - 1, "mobile : le volet est une feuille en bas, pleine largeur", JSON.stringify(r));
  await ctx.close();
}
{
  // 5. Respiration : bandeau de titre plus bas, 32 px au moins entre les grandes sections.
  const { ctx, page } = await open("#styles", { "lisio-mode": "ess" });
  for (const v of ["styles", "exporter", "matrice", "couleurs", "systeme"]) {
    await page.evaluate(v => { location.hash = v; }, v); await page.waitForTimeout(400);
    const r = await page.evaluate(v => { const s = document.getElementById(v), kids = [...s.children].filter(e => e.offsetParent && e.getBoundingClientRect().height > 0 && getComputedStyle(e).position !== "fixed"), g = [];
      for (let i = 1; i < kids.length; i++) g.push(Math.round(kids[i].getBoundingClientRect().top - kids[i - 1].getBoundingClientRect().bottom));
      return { hero: Math.round(s.querySelector(".mhead").getBoundingClientRect().height), first: g[0], cards: g.filter((x, i) => kids[i + 1].classList.contains("card-surface") && kids[i].classList.contains("card-surface")) }; }, v);
    check(r.hero <= 190 && r.first >= 32 && r.cards.every(x => x >= 32 || x < 0 /* cartes côte à côte */), `${v} : bandeau de titre de 190 px au plus, 32 px au moins entre les sections`, JSON.stringify(r));
  }
  await page.evaluate(() => { location.hash = "systeme"; }); await page.waitForTimeout(400);
  const ds = await page.evaluate(() => [...document.querySelectorAll("#systeme .ds-sec")].filter(e => e.offsetParent).map(e => { const cs = getComputedStyle(e); return { pad: parseFloat(cs.paddingTop), frame: cs.boxShadow !== "none" || cs.borderTopStyle !== "none" || cs.backgroundColor !== getComputedStyle(e.parentElement).backgroundColor }; }));
  check(ds.length >= 3 && ds.every(x => x.pad >= 16 && x.frame), "Design system : un groupe de réglages par carte, 16 px de marge intérieure au moins", JSON.stringify(ds));
  await ctx.close();
}
await browser.close();
console.log(fails ? `\n${fails} échec(s)` : "\nTous les scénarios passent.");
process.exit(fails ? 1 : 0);
