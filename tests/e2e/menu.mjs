// Navigation « les étapes sont le menu » (choix de Laurent, 7 novembre 2026) : plus de rail d’icônes.
// Les 7 étapes, collées sous la barre du haut, servent de menu et restent visibles en faisant défiler.
// Rédaction, Guide, S’entraîner et Projets sont dans « Outils » (barre du haut) ; sur mobile, dans « Plus » (barre du bas, avec précédent et suivant).
// Essentiel / Avancé est visible dans la barre du haut. Un bouton « Retour en haut » apparaît quand on a défilé.
//   node tests/e2e/menu.mjs
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
const STEPS = ["Couleurs", "Nuances", "Polices", "Styles de texte", "Design system", "Contrastes", "Exporter"];
async function open(opts, view = "couleurs", mode = "ess") {
  const ctx = await browser.newContext(opts);
  await ctx.addInitScript(m => { try { localStorage.setItem("lisio-welcome", "1"); localStorage.setItem("lisio-mode", m); } catch (e) {} }, mode);
  await ctx.route(/^https?:/, r => r.abort());
  const p = await ctx.newPage(); p.errs = []; p.on("pageerror", e => p.errs.push(String(e)));
  await p.goto(PAGE + "#" + view); await p.waitForTimeout(700); p.ctx = ctx; return p;
}
const vis = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); return !!e.getClientRects().length && getComputedStyle(e).visibility !== "hidden" && r.width > 0 && r.bottom > 0 && r.top < innerHeight; }, sel);
const over = p => p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
const bottom = async p => { await p.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await p.waitForTimeout(400); };

// ---------- Ordinateur ----------
{ const p = await open({ viewport: { width: 1440, height: 900 } });
  check(!(await vis(p, "#sideNav")) && !(await vis(p, "#sideB")), "ordinateur : plus de rail d’icônes");
  const steps = await p.evaluate(() => [...document.querySelectorAll("#journey .j-steps a")].map(a => { const l = a.querySelector(".j-l"), r = l.getBoundingClientRect(); return { t: l.textContent, w: r.width }; }));
  check(steps.map(s => s.t).join("|") === STEPS.join("|"), "les 7 étapes dans l’ordre", steps.map(s => s.t).join(", "));
  check(steps.every(s => s.w > 20), "ordinateur : chaque étape montre son nom", JSON.stringify(steps.map(s => Math.round(s.w))));
  check(await p.evaluate(() => document.getElementById("journey").getAttribute("aria-label")) === "Étapes", "le menu des étapes est nommé « Étapes »");
  await bottom(p);
  const st = await p.evaluate(() => { const j = document.getElementById("journey").getBoundingClientRect(), a = document.querySelector(".appbar").getBoundingClientRect(); return { jt: Math.round(j.top), jb: Math.round(j.bottom), ab: Math.round(a.bottom) }; });
  check(st.jt >= st.ab - 2 && st.jt < 160 && await vis(p, "#journey .j-steps"), "en bas de page, les étapes restent visibles sous la barre du haut", JSON.stringify(st));
  check(await vis(p, "#toTop"), "après défilement, le bouton « Retour en haut » apparaît");
  check(/haut/i.test(await p.locator("#toTop").getAttribute("aria-label") || await p.locator("#toTop").textContent()), "le bouton dit ce qu’il fait");
  await p.click("#toTop"); await p.waitForTimeout(900);
  check(await p.evaluate(() => scrollY) < 5, "« Retour en haut » remonte en haut de la page", await p.evaluate(() => scrollY));
  check(await p.evaluate(() => { const a = document.activeElement; return !!a && (a.id === "main" || a.tagName === "H1" || !!a.closest("#main")); }), "le focus revient au début du contenu");
  check(!(await vis(p, "#toTop")), "en haut de page, le bouton disparaît");
  await p.click('#journey .j-steps a[href="#tester"]'); await p.waitForTimeout(400);
  check(!(await p.evaluate(() => document.getElementById("tester").hidden)) && await p.evaluate(() => document.querySelector('#journey a[aria-current="step"]').getAttribute("href")) === "#tester", "cliquer une étape ouvre sa page et la marque comme en cours");
  // Essentiel / Avancé dans la barre du haut
  check(await vis(p, "#modeSegTop"), "Essentiel / Avancé visible dans la barre du haut");
  check(/Affichage/.test(await p.evaluate(() => { const g = document.getElementById("modeSegTop"); return document.getElementById(g.getAttribute("aria-labelledby")).textContent; })), "le choix est nommé « Affichage »");
  await p.click('#modeSegTop [data-mode="adv"]'); await p.waitForTimeout(200);
  check(await p.evaluate(() => document.documentElement.classList.contains("mode-adv") || document.body.classList.contains("mode-adv") || localStorage.getItem("lisio-mode") === "adv") && await p.getAttribute('#modeSegTop [data-mode="adv"]', "aria-pressed") === "true", "cliquer « Avancé » change l’affichage, état annoncé");
  // Outils
  check(await vis(p, "#helpB") && /Outils/.test(await p.textContent("#helpB")), "bouton « Outils » dans la barre du haut");
  await p.click("#helpB"); await p.waitForTimeout(250);
  const tools = await p.evaluate(() => { const e = document.getElementById("helpPop"), r = e.getBoundingClientRect(); return { open: !e.hidden, t: e.textContent, inside: r.left >= 0 && r.right <= innerWidth && r.top >= 0 }; });
  check(tools.open && tools.inside, "« Outils » s’ouvre dans l’écran", JSON.stringify({ open: tools.open, inside: tools.inside }));
  check(["Rédaction", "Guide", "S’entraîner", "Projets"].every(w => tools.t.includes(w)), "Outils : Rédaction, Guide, S’entraîner, Projets");
  await p.click('#helpPop a[href="#lisibilite"]'); await p.waitForTimeout(300);
  check(!(await p.evaluate(() => document.getElementById("lisibilite").hidden)) && await vis(p, "#journey .j-steps"), "Rédaction s’ouvre, les étapes restent en haut");
  check(!(await p.evaluate(() => document.querySelector('#journey a[aria-current="step"]'))), "hors des étapes, aucune n’est marquée en cours");
  for (const w of [1440, 1024, 800]) { await p.setViewportSize({ width: w, height: 800 }); await p.waitForTimeout(200); check(await over(p) <= 0, `${w} px : pas de défilement horizontal`, await over(p)); }
  if (AXE) { await p.setViewportSize({ width: 1440, height: 900 }); await p.addScriptTag({ content: readFileSync(AXE, "utf8") });
    const v = await p.evaluate(async () => (await axe.run({ include: [[".appbar"], ["#journey"]] }, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] })).violations.map(x => x.id + " " + x.nodes.length));
    check(!v.length, "axe-core : barre du haut et étapes", v.join(", ")); }
  check(!p.errs.length, "ordinateur : aucune erreur JavaScript", p.errs.join(" | "));
  await p.ctx.close(); }

// ---------- Mobile ----------
for (const [lab, opts] of [["iPhone 390 px", { ...devices["iPhone 13"] }], ["320 px", { viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true }]]) {
  const p = await open(opts, "palette");
  check(await over(p) <= 0, `${lab} : pas de défilement horizontal`, await over(p));
  await bottom(p);
  check(await vis(p, "#journey .j-steps"), `${lab} : en bas de page, les étapes restent visibles en haut`);
  check(await p.evaluate(() => document.querySelectorAll("#journey .j-steps a").length) === 7, `${lab} : les 7 étapes`);
  const cur = await p.evaluate(() => { const l = document.querySelector('#journey a[aria-current="step"] .j-l'); return l ? [l.textContent, Math.round(l.getBoundingClientRect().width)] : null; });
  check(cur && cur[0] === "Nuances" && cur[1] > 20, `${lab} : l’étape en cours est écrite en toutes lettres`, JSON.stringify(cur));
  const bar = await p.evaluate(() => { const n = document.getElementById("stepNav"); if (!n) return null; const r = n.getBoundingClientRect(); return { b: Math.round(r.bottom), vh: innerHeight, links: [...n.querySelectorAll("a")].map(a => a.getAttribute("href") + " " + a.textContent.trim()), more: !!n.querySelector("#moreB") }; });
  check(bar && Math.abs(bar.b - bar.vh) < 4 && bar.more, `${lab} : barre du bas avec « Plus »`, JSON.stringify(bar));
  check(bar && bar.links.some(l => l.startsWith("#couleurs")) && bar.links.some(l => l.startsWith("#tester")), `${lab} : étape précédente et suivante en bas`, bar && bar.links.join(" | "));
  const tt = await p.evaluate(() => { const t = document.getElementById("toTop"), n = document.getElementById("stepNav"); if (!t || !n) return null; return { tb: Math.round(t.getBoundingClientRect().bottom), nt: Math.round(n.getBoundingClientRect().top) }; });
  check(tt && tt.tb <= tt.nt, `${lab} : « Retour en haut » au-dessus de la barre du bas`, JSON.stringify(tt));
  await p.click('#stepNav a[href="#tester"]'); await p.waitForTimeout(400);
  check(!(await p.evaluate(() => document.getElementById("tester").hidden)), `${lab} : « suivant » ouvre l’étape suivante`);
  await p.click("#moreB"); await p.waitForTimeout(300);
  const more = await p.evaluate(() => document.getElementById("moreSheet").textContent);
  check(["Rédaction", "Guide", "S’entraîner", "Projets", "Essentiel", "Avancé"].every(w => more.includes(w)), `${lab} : « Plus » contient les outils et l’affichage`);
  if (AXE && lab === "iPhone 390 px") { await p.keyboard.press("Escape"); await p.waitForTimeout(200); await p.addScriptTag({ content: readFileSync(AXE, "utf8") });
    const v = await p.evaluate(async () => (await axe.run({ include: [["#journey"], ["#stepNav"]] }, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] })).violations.map(x => x.id + " " + x.nodes.length));
    check(!v.length, `${lab} : axe-core, étapes et barre du bas`, v.join(", ")); }
  check(!p.errs.length, `${lab} : aucune erreur JavaScript`, p.errs.join(" | "));
  await p.ctx.close();
}
await browser.close();
console.log(fails ? `\n${fails} échec(s)` : "\nTous les scénarios passent.");
process.exit(fails ? 1 : 0);
