// P1 · F04 · Sélecteurs de couleur avec recherche (blueprint v2, F04).
// Recherche par nom, nuance ou code ; nom et valeur visibles ; clavier ; résultats annoncés ; saisie invalide gérée.
//   node tests/e2e/recherche.mjs
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PAGE = "file://" + (process.env.LISIO_PAGE || join(ROOT, "index.html"));
let chromium;
try { ({ chromium } = createRequire(import.meta.url)("playwright")); } catch (e) { console.log("IGNORÉ : Playwright introuvable."); process.exit(process.env.CI ? 1 : 0); }
const browser = await chromium.launch();
let fails = 0;
const report = (ok, label, detail = "") => { if (!ok) fails++; console.log(`${ok ? "ok   " : "ÉCHEC"} ${label}${detail ? " : " + detail : ""}`); };
async function open(view, vp = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport: vp });
  await ctx.addInitScript(() => { try { localStorage.setItem("lisio-welcome", "1"); localStorage.setItem("lisio-mode", "adv"); } catch (e) {} });
  await ctx.route(/^https?:/, r => r.abort());
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.goto(PAGE + "#" + view); await p.waitForTimeout(600); p.errs = errs; p.ctx = ctx; return p;
}
const state = p => p.evaluate(() => { const q = document.getElementById("cpQ"), L = document.getElementById("cpList");
  const opts = L ? [...L.querySelectorAll("[role=option]")] : [];
  return { open: !!q && !document.getElementById("cpPop").hidden, focus: document.activeElement && document.activeElement.id, role: q && q.getAttribute("role"), ctl: q && q.getAttribute("aria-controls"), exp: q && q.getAttribute("aria-expanded"),
    label: q && (q.labels[0] ? q.labels[0].textContent : q.getAttribute("aria-label")), ad: q && q.getAttribute("aria-activedescendant"), act: (L && L.querySelector(".is-act") || {}).id,
    n: opts.length, texts: opts.map(o => o.textContent.replace(/\s+/g, " ").trim()), live: (document.getElementById("cpN") || {}).textContent || "", liveRole: document.getElementById("cpN") && document.getElementById("cpN").getAttribute("role"),
    none: document.getElementById("cpNone") && !document.getElementById("cpNone").hidden ? document.getElementById("cpNone").textContent : "" }; });
const type = async (p, t) => { await p.fill("#cpQ", t); await p.waitForTimeout(120); };

// 1. Styles de texte : couleur du texte et du fond.
{ const p = await open("styles");
  const btn = '.cp-btn[data-cpfor="tsFg"]';
  await p.click(btn); await p.waitForTimeout(150);
  let s = await state(p);
  report(s.open && s.focus === "cpQ" && s.role === "combobox" && s.ctl === "cpList" && s.exp === "true" && /couleur/i.test(s.label || ""), "le champ de recherche s'ouvre avec la liste, focus dessus, nommé et relié à la liste", JSON.stringify({ open: s.open, focus: s.focus, role: s.role, ctl: s.ctl, exp: s.exp, label: s.label }));
  const all = s.n;
  report(all > 20 && /\d+ couleurs?/.test(s.live) && s.liveRole === "status", "le nombre de couleurs est annoncé", `${all} options, « ${s.live} »`);
  await type(p, "950"); s = await state(p);
  report(s.n > 0 && s.n < all && s.texts.every(t => /950/.test(t)) && s.live.startsWith(String(s.n)), "recherche par nuance (950) : seules les 950, et le nombre est annoncé", `${s.n} : ${s.texts.slice(0, 3).join(" | ")} ; « ${s.live} »`);
  await type(p, "50"); const s50 = await state(p);
  report(s50.n > 0 && s50.texts.every(x => /(^|\D)50(\D|$)/.test(x.replace(/#[0-9A-F]{6}.*/, ""))), "« 50 » trouve la nuance 50, pas 500 ni 950 ni un code qui contient 50", s50.texts.slice(0, 4).join(" | "));
  await type(p, "950"); s = await state(p);
  report(s.ad && s.ad === s.act && s.texts.every(t => /#[0-9A-F]{6}/.test(t)), "la première trouvée est active (aria-activedescendant) ; nom et code visibles", JSON.stringify({ ad: s.ad, act: s.act }));
  const hex = (s.texts[1] || s.texts[0]).match(/#[0-9A-F]{6}/)[0];
  await type(p, hex.slice(1).toLowerCase()); s = await state(p);
  report(s.n >= 1 && s.texts.every(t => t.includes(hex)), `recherche par code sans # et en minuscules (${hex.slice(1).toLowerCase()})`, s.texts.join(" | "));
  await type(p, "neutr"); s = await state(p);
  const nn = s.n; await type(p, "NÈUTR"); const s2 = await state(p);
  report(nn > 0 && s2.n === nn, "recherche sans tenir compte des majuscules ni des accents", `${nn} / ${s2.n}`);
  await type(p, "950"); await p.keyboard.press("ArrowDown"); s = await state(p);
  const target = s.texts[1], tHex = target.match(/#[0-9A-F]{6}/)[0];
  await p.keyboard.press("Enter"); await p.waitForTimeout(200);
  const after = await p.evaluate(() => ({ v: document.getElementById("tsFg").value.toUpperCase(), open: !document.getElementById("cpPop").hidden, focus: document.activeElement.className, lab: document.querySelector('.cp-btn[data-cpfor="tsFg"]').getAttribute("aria-label") }));
  report(after.v === tHex && !after.open && /cp-btn/.test(after.focus) && after.lab.includes(tHex), "flèche puis Entrée : la couleur est choisie, la liste se ferme, le bouton dit le choix", JSON.stringify(after));
  await p.click(btn); await p.waitForTimeout(150); s = await state(p);
  report(s.live && (await p.inputValue("#cpQ")) === "", "à la réouverture, la recherche repart vide");
  await type(p, "zzzz"); s = await state(p);
  report(s.n === 0 && /Aucune couleur/.test(s.none) && /^Aucune|0 couleur/.test(s.live), "aucun résultat : c'est dit, à l'écran et au lecteur d'écran", `« ${s.none} » / « ${s.live} »`);
  await p.keyboard.press("Enter"); await p.waitForTimeout(100);
  const v2 = await p.evaluate(() => document.getElementById("tsFg").value.toUpperCase());
  report(v2 === tHex, "Entrée sans résultat ne change rien", v2);
  await type(p, "#123456"); s = await state(p);
  report(s.n === 0 && /pas dans la palette/.test(s.none) && /Couleurs/.test(s.none), "un code absent de la palette : on dit où l'ajouter", s.none);
  await p.keyboard.press("Escape"); await p.waitForTimeout(100);
  const esc = await p.evaluate(() => ({ open: !document.getElementById("cpPop").hidden, focus: document.activeElement.dataset.cpfor }));
  report(!esc.open && esc.focus === "tsFg", "Échap ferme et rend le focus au bouton", JSON.stringify(esc));
  // « Seulement celles qui passent » se combine avec la recherche.
  await p.click('.cp-btn[data-cpfor="tsBg"]'); await p.waitForTimeout(150);
  const onlyVis = await p.evaluate(() => !document.getElementById("cpOnly").hidden);
  if (onlyVis) { await p.click("#cpOnly"); await type(p, "50"); s = await state(p);
    report(s.texts.every(t => /50/.test(t) && !/✕/.test(t)) && (await p.evaluate(() => document.activeElement.id)) === "cpQ", "le filtre « qui passent » et la recherche se combinent, le focus reste dans la recherche", s.texts.slice(0, 3).join(" | ")); }
  else report(true, "filtre « qui passent » absent ici (pas de seuil)");
  // axe sur la liste ouverte, si axe-core est fourni (AXE_PATH).
  if (process.env.AXE_PATH) { await p.click(btn); await p.addScriptTag({ path: process.env.AXE_PATH }); const v = [];
    for (const q of ["700", "zzzz"]) { await type(p, q); v.push(...await p.evaluate(async q => (await axe.run(document.getElementById("cpPop"))).violations.map(x => `${q} : ${x.id} (${x.nodes.length})`), q)); }
    report(!v.length, "axe : aucune violation dans la liste ouverte avec recherche", v.join(", ")); await p.keyboard.press("Escape"); }
  else console.log("IGNORÉ : axe (AXE_PATH absent)");
  report(!p.errs.length, "Styles de texte : aucune erreur JavaScript", p.errs.join(" | ")); await p.ctx.close(); }

// 2. Design system : les rôles ont la même recherche ; mobile : la feuille garde le champ.
for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 800 }]) {
  const p = await open("systeme", vp);
  const b = await p.$("#dsRoles .cp-btn");
  if (!b) { report(false, `design system ${vp.width} px : sélecteur de rôle introuvable`); await p.ctx.close(); continue; }
  await b.scrollIntoViewIfNeeded(); await b.click(); await p.waitForTimeout(200);
  await type(p, "50"); const s = await state(p);
  const box = await p.evaluate(() => { const r = document.getElementById("cpQ").getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), vis: r.top >= 0 && r.bottom <= innerHeight }; });
  report(s.open && s.focus === "cpQ" && s.n > 0 && box.vis && box.h >= 40, `design system ${vp.width} px : recherche dans le rôle, champ visible et assez haut`, JSON.stringify({ n: s.n, ...box }));
  report(!p.errs.length, `design system ${vp.width} px : aucune erreur JavaScript`, p.errs.join(" | ")); await p.ctx.close(); }

await browser.close();
console.log(fails ? `\n${fails} contrôle(s) en échec` : "\nRecherche dans les sélecteurs : contrôles passés.");
process.exit(fails ? 1 : 0);
