// Navigation « les étapes sont le menu » (choix de Laurent, 7 novembre 2026) : plus de rail d’icônes.
// Refonte du 11 novembre 2026 (maquette Figma Make) : les 7 étapes sont en haut, dans 7 cases ; sur mobile, l’étape est un bouton
// collé en haut qui déplie la liste, et « Outils » est dans la barre du bas, entre « précédente » et « suivante ».
// Menu « Outils » en trois groupes (Espace de travail, Apprendre et aide, Réglages), le même sur mobile.
// Un bouton « Retour en haut » apparaît quand on a défilé.
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
  const st = await p.evaluate(() => { const j = document.getElementById("journey"), r = j.getBoundingClientRect(), a = document.querySelector(".appbar").getBoundingClientRect(); return { pos: getComputedStyle(j).position, top: Math.round(r.top), ab: Math.round(a.bottom) }; });
  check(st.pos !== "fixed" && st.top >= st.ab && st.top < 140 && await vis(p, "#journey .j-steps"), "les étapes sont en haut de la page, sous la barre", JSON.stringify(st));
  check(/\d\/7/.test(await p.textContent("#journey .j-prog")), "les étapes montrent la progression", await p.textContent("#journey .j-prog"));
  // Couleurs tient presque dans l’écran depuis l’en-tête plus court (audit UX, 11 novembre 2026) : on teste sur Nuances, plus longue.
  await p.evaluate(() => { location.hash = "palette"; }); await p.waitForTimeout(400);
  await bottom(p);
  check(await vis(p, "#toTop"), "après défilement, le bouton « Retour en haut » apparaît");
  check(/haut/i.test(await p.locator("#toTop").getAttribute("aria-label") || await p.locator("#toTop").textContent()), "le bouton dit ce qu’il fait");
  await p.click("#toTop"); await p.waitForTimeout(900);
  check(await p.evaluate(() => scrollY) < 5, "« Retour en haut » remonte en haut de la page", await p.evaluate(() => scrollY));
  check(await p.evaluate(() => { const a = document.activeElement; return !!a && (a.id === "main" || a.tagName === "H1" || !!a.closest("#main")); }), "le focus revient au début du contenu");
  check(!(await vis(p, "#toTop")), "en haut de page, le bouton disparaît");
  await p.click('#journey .j-steps a[href="#tester"]'); await p.waitForTimeout(400);
  check(!(await p.evaluate(() => document.getElementById("tester").hidden)) && await p.evaluate(() => document.querySelector('#journey a[aria-current="step"]').getAttribute("href")) === "#tester", "cliquer une étape ouvre sa page et la marque comme en cours");
  // Essentiel / Avancé : retiré de la barre du haut (Laurent, 7 novembre 2026, 11 h). Audit UX du 11 novembre 2026 : un seul endroit
  // sur ordinateur, la ligne de l’étape ; Outils › Réglages ne le répète plus (il y reste sur mobile).
  check(!(await p.evaluate(() => !!document.querySelector(".appbar [data-mode]"))), "Essentiel / Avancé n’est plus dans la barre du haut");
  await p.click("#helpB"); await p.waitForTimeout(200);
  check(!(await vis(p, "#modeSeg")), "Outils › Réglages ne répète pas Essentiel / Avancé sur ordinateur");
  await p.keyboard.press("Escape"); await p.waitForTimeout(150);
  await p.click('#jNowBox .j-mode [data-mode="adv"]'); await p.waitForTimeout(200);
  check(await p.evaluate(() => localStorage.getItem("lisio-mode") === "adv") && await p.getAttribute('#jNowBox .j-mode [data-mode="adv"]', "aria-pressed") === "true", "ligne de l’étape : « Avancé » change l’affichage, état annoncé");
  await p.click("#helpB"); await p.waitForTimeout(200);
  await p.keyboard.press("Escape"); await p.waitForTimeout(150);
  // Outils
  check(await vis(p, "#helpB") && /Outils/.test(await p.textContent("#helpB")), "bouton « Outils » dans la barre du haut");
  await p.click("#helpB"); await p.waitForTimeout(250);
  const tools = await p.evaluate(() => { const e = document.getElementById("helpPop"), r = e.getBoundingClientRect(); return { open: !e.hidden, t: e.textContent, inside: r.left >= 0 && r.right <= innerWidth && r.top >= 0 }; });
  check(tools.open && tools.inside, "« Outils » s’ouvre dans l’écran", JSON.stringify({ open: tools.open, inside: tools.inside }));
  check(["Rédaction", "Guide", "S’entraîner", "Projets"].every(w => tools.t.includes(w)), "Outils : Rédaction, Guide, S’entraîner, Projets");
  check(await p.evaluate(() => [...document.querySelectorAll("#helpPop .hp-h")].map(h => h.textContent).join("|")) === "Espace de travail|Apprendre et aide|Réglages", "Outils en trois groupes : Espace de travail, Apprendre et aide, Réglages");
  // Audit UX du 11 novembre 2026 : sur ordinateur, Réglages ne garde que le thème ; Essentiel / Avancé est dans la ligne de l’étape.
  const segs = await p.evaluate(() => [...document.querySelectorAll("#helpPop .mode-row .seg")].filter(g => g.getClientRects().length).map(g => { const r = g.getBoundingClientRect(); return Math.round(r.width) + "x" + Math.round(r.height); }));
  check(segs.length === 1 && /x44$/.test(segs[0]), "Réglages : le thème seul, 44 px de haut", segs.join(", "));
  await p.click('#helpPop [data-theme-set="dark"]'); await p.waitForTimeout(150);
  check(await p.evaluate(() => document.documentElement.getAttribute("data-theme") === "dark" && document.querySelector('#helpPop [data-theme-set="dark"]').getAttribute("aria-pressed") === "true"), "thème sombre depuis Réglages, état annoncé");
  await p.click('#helpPop [data-theme-set="light"]'); await p.waitForTimeout(150);
  await p.click('#helpPop a[href="#lisibilite"]'); await p.waitForTimeout(300);
  check(!(await p.evaluate(() => document.getElementById("lisibilite").hidden)) && await vis(p, "#journey .j-steps"), "Rédaction s’ouvre, les étapes restent visibles");
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
  check(await vis(p, "#hsMob") && await p.evaluate(() => Math.round(document.getElementById("hsMob").getBoundingClientRect().top)) <= 2, `${lab} : en bas de page, l’étape reste visible, collée en haut`);
  const box = await p.evaluate(() => { const n = document.getElementById("stepNav").getBoundingClientRect(), m = document.getElementById("moreB").getBoundingClientRect(), t = document.getElementById("toTop").getBoundingClientRect();
    return { nl: Math.round(n.left), nr: Math.round(innerWidth - n.right), nb: Math.round(innerHeight - n.bottom), inBar: m.left >= n.left && m.right <= n.right && m.top >= n.top && m.bottom <= n.bottom, ttAbove: t.bottom <= n.top, mw: Math.round(m.width), mh: Math.round(m.height) }; });
  check(box.nl === 0 && box.nr === 0 && box.nb === 0 && box.inBar && box.mw >= 44 && box.mh >= 44, `${lab} : une seule barre en bas, pleine largeur, bouton « Outils » dedans`, JSON.stringify(box));
  check(box.ttAbove, `${lab} : « Retour en haut » au-dessus de la barre`, JSON.stringify(box));
  check(/Outils/.test(await p.textContent("#moreB")), `${lab} : le bouton s’appelle « Outils »`);
  // Refonte du 11 novembre 2026 : angles droits partout, logo carré, aucun dégradé.
  const look = await p.evaluate(() => {
    const cs = (el, ps) => getComputedStyle(el, ps), r = el => el.getBoundingClientRect();
    const icons = [...document.querySelectorAll(".appbar button, .appbar .logo, #moreB")].filter(el => { const b = r(el); return b.width > 0 && b.height > 0 && cs(el).display !== "none"; });
    const logo = document.querySelector(".appbar .logo"), mark = logo && logo.querySelector(".logo-mark");
    const fades = ["body::after", "body::before", "html::after", "html::before"].map(x => { const [sel, ps] = x.split("::"), c = cs(document.querySelector(sel), "::" + ps); return c.content !== "none" && c.backgroundImage !== "none" ? x : null; }).filter(Boolean);
    return { rounded: icons.filter(el => parseFloat(cs(el).borderTopLeftRadius) > 0).map(el => el.id || el.className), n: icons.length, logoSquare: !!mark && cs(mark).clipPath === "none" && Math.abs(r(mark).width - r(mark).height) <= 1, fades };
  });
  check(look.n >= 4 && !look.rounded.length, `${lab} : boutons du haut et « Outils » à angles droits`, JSON.stringify(look.rounded));
  check(look.logoSquare, `${lab} : logo carré`, JSON.stringify(look));
  check(!look.fades.length, `${lab} : aucun dégradé derrière les barres, ni en haut ni en bas`, look.fades.join(", "));
  await p.evaluate(() => scrollTo(0, 0)); await p.click("#hsMob"); await p.waitForTimeout(250);
  check(await p.evaluate(() => [...document.querySelectorAll("#journey .j-steps a")].filter(a => a.getClientRects().length).length) === 7, `${lab} : le bouton d’étape déplie les 7 étapes`);
  const items = await p.evaluate(() => [...document.querySelectorAll("#journey .j-steps a")].map(a => a.getBoundingClientRect()).map(r => [Math.round(r.top), Math.round(r.bottom), Math.round(r.width), Math.round(r.height)]));
  check(items.every((r, k) => r[2] >= 44 && r[3] >= 44 && (!k || r[0] >= items[k - 1][1] - 1)), `${lab} : étapes sans chevauchement, cibles d’au moins 44 px`, JSON.stringify(items));
  await p.click('#journey a[href="#tester"]'); await p.waitForTimeout(400);
  check(!(await p.evaluate(() => document.getElementById("tester").hidden)), `${lab} : toucher une étape l’ouvre`);
  await p.click("#moreB"); await p.waitForTimeout(400);
  const more = await p.evaluate(() => ({ t: document.getElementById("moreSheet").textContent, h: [...document.querySelectorAll("#moreSheet .mh3")].map(h => h.textContent).join("|"), segs: [...document.querySelectorAll("#moreSheet .mmode .seg")].map(g => Math.round(g.getBoundingClientRect().width) + "x" + Math.round(g.getBoundingClientRect().height)) }));
  check(more.h === "Espace de travail|Apprendre et aide|Réglages" && ["Rédaction", "Guide", "S’entraîner", "Projets", "Thème", "Essentiel", "Avancé"].every(w => more.t.includes(w)), `${lab} : « Outils » contient les mêmes groupes que sur ordinateur`, more.h);
  check(more.segs.length === 2 && new Set(more.segs).size === 1, `${lab} : réglages de même largeur et même hauteur`, more.segs.join(", "));
  if (AXE && lab === "iPhone 390 px") { await p.keyboard.press("Escape"); await p.waitForTimeout(200); await p.addScriptTag({ content: readFileSync(AXE, "utf8") });
    const v = await p.evaluate(async () => (await axe.run({ include: [["#journey"], ["#stepNav"]] }, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] })).violations.map(x => x.id + " " + x.nodes.length));
    check(!v.length, `${lab} : axe-core, étapes et barre du bas`, v.join(", ")); }
  check(!p.errs.length, `${lab} : aucune erreur JavaScript`, p.errs.join(" | "));
  await p.ctx.close(); }

// Lien du projet en un clic (cahier « Next-Level », 8 novembre 2026) : dans Outils, sur ordinateur et sur mobile.
for (const [lab, opts, openSel, itemSel] of [["ordinateur", { viewport: { width: 1440, height: 900 } }, "#helpB", "#helpPop [data-share-link]"], ["mobile", { ...devices["iPhone 13"] }, "#moreB", "#moreSheet [data-share-link]"]]) {
  const p = await open({ ...opts, permissions: ["clipboard-read", "clipboard-write"] });
  await p.click(openSel); await p.waitForTimeout(300);
  check(await vis(p, itemSel) && /Copier le lien du projet/.test(await p.textContent(itemSel)), `${lab} : Outils propose « Copier le lien du projet »`);
  await p.click(itemSel); await p.waitForTimeout(600);
  const t = await p.textContent("#toast");
  check(/Lien copié/.test(t), `${lab} : le lien est copié, avec un message`, t);
  const clip = await p.evaluate(() => navigator.clipboard.readText().catch(() => ""));
  check(/\?p=/.test(clip) || clip === "", `${lab} : le lien contient tout le projet (?p=)`, clip.slice(0, 80));
  check(!p.errs.length, `${lab} : aucune erreur JavaScript`, p.errs.join(" | "));
  await p.ctx.close();
}

await browser.close();
console.log(fails ? `\n${fails} échec(s)` : "\nTous les scénarios passent.");
process.exit(fails ? 1 : 0);
