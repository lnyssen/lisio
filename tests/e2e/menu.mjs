// Navigation « les étapes sont le menu » (choix de Laurent, 7 novembre 2026) : plus de rail d’icônes.
// Puis ses retours du même jour : les 7 étapes dans une longue pilule flottante en bas, toujours visible, aux couleurs inversées
// (ou orange au choix), avec la progression ; barre du haut allégée ; menu « Outils » en trois groupes (Outils, Apprendre, Réglages),
// le même sur mobile, où un bouton « Outils » est dans la pilule.
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
  const st = await p.evaluate(() => { const j = document.getElementById("journey").getBoundingClientRect(); return { b: Math.round(innerHeight - j.bottom), mid: Math.round((j.left + j.right) / 2 - innerWidth / 2) }; });
  check(st.b >= 8 && st.b <= 40 && Math.abs(st.mid) <= 2 && await vis(p, "#journey .j-steps"), "en bas de page, la pilule des étapes reste visible, centrée en bas", JSON.stringify(st));
  const inv = await p.evaluate(() => { const j = getComputedStyle(document.getElementById("journey")), b = getComputedStyle(document.body); return [j.backgroundColor, b.backgroundColor]; });
  check(inv[0] !== inv[1], "la pilule se détache de la page (couleurs inversées)", inv.join(" / "));
  check(/\d\/7/.test(await p.textContent("#journey .j-prog")), "la pilule montre la progression", await p.textContent("#journey .j-prog"));
  check(await vis(p, "#toTop"), "après défilement, le bouton « Retour en haut » apparaît");
  check(/haut/i.test(await p.locator("#toTop").getAttribute("aria-label") || await p.locator("#toTop").textContent()), "le bouton dit ce qu’il fait");
  await p.click("#toTop"); await p.waitForTimeout(900);
  check(await p.evaluate(() => scrollY) < 5, "« Retour en haut » remonte en haut de la page", await p.evaluate(() => scrollY));
  check(await p.evaluate(() => { const a = document.activeElement; return !!a && (a.id === "main" || a.tagName === "H1" || !!a.closest("#main")); }), "le focus revient au début du contenu");
  check(!(await vis(p, "#toTop")), "en haut de page, le bouton disparaît");
  await p.click('#journey .j-steps a[href="#tester"]'); await p.waitForTimeout(400);
  check(!(await p.evaluate(() => document.getElementById("tester").hidden)) && await p.evaluate(() => document.querySelector('#journey a[aria-current="step"]').getAttribute("href")) === "#tester", "cliquer une étape ouvre sa page et la marque comme en cours");
  // Essentiel / Avancé : retiré de la barre du haut (Laurent, 7 novembre 2026, 11 h), reste dans Outils › Réglages.
  check(!(await p.evaluate(() => !!document.querySelector(".appbar [data-mode]"))), "Essentiel / Avancé n’est plus dans la barre du haut");
  await p.click("#helpB"); await p.waitForTimeout(200);
  check(/Affichage/.test(await p.evaluate(() => { const g = document.getElementById("modeSeg"); return document.getElementById(g.getAttribute("aria-labelledby")).textContent; })), "Outils › Réglages : le choix est nommé « Affichage »");
  await p.click('#modeSeg [data-mode="adv"]'); await p.waitForTimeout(200);
  check(await p.evaluate(() => localStorage.getItem("lisio-mode") === "adv") && await p.getAttribute('#modeSeg [data-mode="adv"]', "aria-pressed") === "true", "Outils › Réglages : « Avancé » change l’affichage, état annoncé");
  await p.keyboard.press("Escape"); await p.waitForTimeout(150);
  // Outils
  check(await vis(p, "#helpB") && /Outils/.test(await p.textContent("#helpB")), "bouton « Outils » dans la barre du haut");
  await p.click("#helpB"); await p.waitForTimeout(250);
  const tools = await p.evaluate(() => { const e = document.getElementById("helpPop"), r = e.getBoundingClientRect(); return { open: !e.hidden, t: e.textContent, inside: r.left >= 0 && r.right <= innerWidth && r.top >= 0 }; });
  check(tools.open && tools.inside, "« Outils » s’ouvre dans l’écran", JSON.stringify({ open: tools.open, inside: tools.inside }));
  check(["Rédaction", "Guide", "S’entraîner", "Projets"].every(w => tools.t.includes(w)), "Outils : Rédaction, Guide, S’entraîner, Projets");
  check(await p.evaluate(() => [...document.querySelectorAll("#helpPop .hp-h")].map(h => h.textContent).join("|")) === "Outils|Apprendre|Réglages", "Outils en trois groupes : Outils, Apprendre, Réglages");
  const segs = await p.evaluate(() => [...document.querySelectorAll("#helpPop .mode-row .seg")].map(g => { const r = g.getBoundingClientRect(); return Math.round(r.width) + "x" + Math.round(r.height); }));
  check(segs.length === 3 && new Set(segs).size === 1, "Réglages : thème, barre et affichage de même largeur et même hauteur", segs.join(", "));
  await p.click('#helpPop [data-bar-set="orange"]'); await p.waitForTimeout(150);
  check(await p.evaluate(() => document.documentElement.getAttribute("data-bar") === "orange" && localStorage.getItem("lisio-bar") === "orange"), "barre du bas orange au choix, mémorisée");
  await p.click('#helpPop [data-bar-set="ink"]'); await p.click('#helpPop [data-theme-set="dark"]'); await p.waitForTimeout(150);
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
  check(await vis(p, "#journey .j-steps"), `${lab} : en bas de page, les étapes restent visibles`);
  check(await p.evaluate(() => document.querySelectorAll("#journey .j-steps a").length) === 7, `${lab} : les 7 étapes`);
  const box = await p.evaluate(() => { const j = document.getElementById("journey").getBoundingClientRect(), m = document.getElementById("moreB").getBoundingClientRect(), t = document.getElementById("toTop").getBoundingClientRect();
    return { jl: Math.round(j.left), jr: Math.round(innerWidth - j.right), jb: Math.round(innerHeight - j.bottom), inPill: m.left >= j.left && m.right <= j.right && m.top >= j.top && m.bottom <= j.bottom, ttAbove: t.bottom <= j.top }; });
  check(box.jl === box.jr && box.jb >= 8 && box.inPill, `${lab} : une seule barre en bas, marges égales, bouton « Outils » dedans`, JSON.stringify(box));
  check(box.ttAbove, `${lab} : « Retour en haut » au-dessus de la barre`, JSON.stringify(box));
  const items = await p.evaluate(() => [...document.querySelectorAll("#journey .j-steps a")].map(a => a.getBoundingClientRect()).map(r => [Math.round(r.left), Math.round(r.right), Math.round(r.width), Math.round(r.height)]));
  check(items.every((r, k) => r[2] >= 24 && r[3] >= 24 && (!k || r[0] >= items[k - 1][1])), `${lab} : étapes sans chevauchement, cibles d’au moins 24 px`, JSON.stringify(items));
  check(/Outils/.test(await p.textContent("#moreB")), `${lab} : le bouton s’appelle « Outils » pour les lecteurs d’écran`);
  // Retouches du 8 novembre 2026 : icônes rondes, pas de libellé « Outils », aucun dégradé, séparateurs de même hauteur.
  const look = await p.evaluate(() => {
    const cs = (el, ps) => getComputedStyle(el, ps), r = el => el.getBoundingClientRect();
    const m = document.getElementById("moreB"), lab = m.querySelector("span"), lr = lab ? r(lab) : { width: 0 };
    const round = el => { const b = r(el), c = cs(el); return b.width > 0 && Math.abs(b.width - b.height) <= 1 && parseFloat(c.borderTopLeftRadius) >= b.width / 2 - 1; };
    const icons = [...document.querySelectorAll(".appbar button, .appbar .logo")].filter(el => { const b = r(el); return b.width > 0 && b.height > 0 && cs(el).display !== "none" && b.width <= b.height + 1; });
    const logo = document.querySelector(".appbar .logo"), mark = logo && logo.querySelector(".logo-mark");
    const fades = ["body::after", "body::before", "html::after", "html::before"].map(x => { const [sel, ps] = x.split("::"), c = cs(document.querySelector(sel), "::" + ps); return c.content !== "none" && c.backgroundImage !== "none" ? x : null; }).filter(Boolean);
    const sep1 = cs(document.querySelector("#journey .j-prog"), "::after"), sep2 = cs(document.getElementById("stepNav"), "::before");
    return { moreRound: round(m), labelHidden: lr.width <= 1, iconsRound: icons.filter(el => !round(el)).map(el => el.id || el.className), n: icons.length,
      logoRound: !!logo && round(logo) && (cs(mark).clipPath.includes("circle") || cs(logo).overflow === "hidden"), fades, seps: [sep1.height, sep2.height], sepBorder: cs(document.querySelector("#journey .j-prog")).borderRightWidth };
  });
  check(look.moreRound && look.labelHidden, `${lab} : « Outils » est une icône ronde, sans libellé visible`, JSON.stringify(look));
  check(look.n >= 3 && !look.iconsRound.length, `${lab} : toutes les icônes du haut sont rondes`, JSON.stringify(look.iconsRound));
  check(look.logoRound, `${lab} : logo rond, sans carré derrière`, JSON.stringify(look));
  check(!look.fades.length, `${lab} : aucun dégradé derrière les barres, ni en haut ni en bas`, look.fades.join(", "));
  check(look.sepBorder === "0px" && look.seps[0] === look.seps[1] && look.seps[0] !== "auto", `${lab} : séparateurs verticaux de même hauteur`, JSON.stringify(look.seps) + " " + look.sepBorder);
  // Distances recalculées (8 novembre 2026, 14 h) : ronds de même taille, même écart partout, séparateurs au milieu, marges intérieures égales.
  const sp = await p.evaluate(() => { const r = el => el.getBoundingClientRect(), J = r(document.getElementById("journey")), ring = r(document.querySelector("#journey .j-ring")), st = [...document.querySelectorAll("#journey .j-steps a")].map(r), m = r(document.getElementById("moreB")), sn = document.getElementById("stepNav");
    const s1 = r(document.querySelector("#journey .j-prog")).right, x2 = r(sn).left + parseFloat(getComputedStyle(sn, "::before").left), q = v => Math.round(v * 10) / 10;
    return { size: [ring.width, ...st.map(b => b.width), m.width].map(q), pads: [ring.left - J.left, ring.top - J.top, J.bottom - ring.bottom, J.right - m.right, m.top - J.top].map(q),
      gaps: st.slice(1).map((b, k) => b.left - st[k].right).map(q), seps: [s1 - 1 - ring.right, st[0].left - s1, x2 - st[6].right, m.left - x2 - 1].map(q) }; });
  const near = (xs, t) => Math.max(...xs) - Math.min(...xs) <= t;
  check(near(sp.size, 1), `${lab} : anneau, étapes et « Outils » ont la même taille`, JSON.stringify(sp.size));
  check(near(sp.pads, 1), `${lab} : même marge intérieure tout autour de la barre`, JSON.stringify(sp.pads));
  check(near([...sp.gaps, ...sp.seps], 1.5) && Math.min(...sp.gaps) >= 2, `${lab} : même écart entre les ronds et de chaque côté des séparateurs`, JSON.stringify(sp));
  await p.click('#journey a[href="#tester"]'); await p.waitForTimeout(400);
  check(!(await p.evaluate(() => document.getElementById("tester").hidden)), `${lab} : toucher une étape l’ouvre`);
  await p.click("#moreB"); await p.waitForTimeout(400);
  const more = await p.evaluate(() => ({ t: document.getElementById("moreSheet").textContent, h: [...document.querySelectorAll("#moreSheet .mh3")].map(h => h.textContent).join("|"), segs: [...document.querySelectorAll("#moreSheet .mmode .seg")].map(g => Math.round(g.getBoundingClientRect().width) + "x" + Math.round(g.getBoundingClientRect().height)) }));
  check(more.h === "Outils|Apprendre|Réglages" && ["Rédaction", "Guide", "S’entraîner", "Projets", "Thème", "Essentiel", "Avancé"].every(w => more.t.includes(w)), `${lab} : « Outils » contient les mêmes groupes que sur ordinateur`, more.h);
  check(more.segs.length === 3 && new Set(more.segs).size === 1, `${lab} : réglages de même largeur et même hauteur`, more.segs.join(", "));
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
