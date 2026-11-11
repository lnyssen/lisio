// Refonte « suisse monochrome » d’après la maquette Figma Make de Laurent (10 novembre 2026).
// Style : noir sur blanc cassé, angles droits, aucun dégradé ni ombre sur les commandes.
// Navigation : les 7 étapes en haut, chacune avec son état et un résumé ; un bandeau « Prochaine action » ;
// « Étape précédente » et « Étape suivante » restent en bas. Sur mobile, l’étape en haut ouvre la liste.
//   node tests/e2e/refonte.mjs
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
const check = (ok, label, detail = "") => { if (!ok) fails++; console.log(`${ok ? "ok   " : "ÉCHEC"} ${label}${detail ? " : " + detail : ""}`); };
const ORDER = ["couleurs", "palette", "tester", "styles", "systeme", "matrice", "exporter"];
const COLORS = [{ name: "Encre", hex: "#0E1B4D" }, { name: "Corail", hex: "#F4A261" }, { name: "Sable", hex: "#F6F1E7" }, { name: "Pin", hex: "#1F6F5C" }, { name: "Brique", hex: "#B5452C" }];
async function open(opts, view = "couleurs", init = {}) {
  const ctx = await browser.newContext(opts);
  await ctx.addInitScript(o => { try { if (!sessionStorage.getItem("t-init")) { sessionStorage.setItem("t-init", "1"); localStorage.setItem("lisio-welcome", "1"); for (const [k, v] of Object.entries(o)) localStorage.setItem(k, v); } } catch (e) {} }, { "lisio:colors": JSON.stringify(COLORS), ...init });
  await ctx.route(/^https?:/, r => r.abort());
  const p = await ctx.newPage(); p.errs = []; p.on("pageerror", e => p.errs.push(String(e)));
  await p.goto(PAGE + "#" + view); await p.waitForFunction(() => window.__lisioReady === true); await p.waitForTimeout(300); p.ctx = ctx; return p;
}
const go = async (p, v) => { await p.evaluate(v => { location.hash = v; }, v); await p.waitForTimeout(250); };
const vis = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); return !!e.getClientRects().length && getComputedStyle(e).visibility !== "hidden" && r.width > 1 && r.height > 1 && r.bottom > 0 && r.top < innerHeight; }, sel);
const over = p => p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
const rgb = s => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
const axe = async (p, include, label) => { if (!AXE) return; await p.addScriptTag({ content: readFileSync(AXE, "utf8") });
  const v = await p.evaluate(async inc => (await axe.run({ include: inc.map(s => [s]) }, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] })).violations.map(x => x.id + " " + x.nodes.length + " " + (x.nodes[0].target || []).join(" ")), include);
  check(!v.length, label, v.join(", ")); };

// ---------- 1. Style ----------
{ const p = await open({ viewport: { width: 1440, height: 900 } });
  const st = await p.evaluate(() => { const b = getComputedStyle(document.body); return { bg: b.backgroundColor, ink: b.color, font: b.fontFamily }; });
  check(rgb(st.bg).join() === "244,244,240" && rgb(st.ink).join() === "5,5,5", "fond blanc cassé #F4F4F0, texte noir #050505", `${st.bg} / ${st.ink}`);
  check(/Instrument Sans/.test(st.font), "police Instrument Sans", st.font);
  // Angles droits : commandes et grandes surfaces, sur les 7 étapes. Seules les pastilles d’état et de verdict restent arrondies.
  const round = [];
  for (const v of ORDER) { await go(p, v);
    const r = await p.evaluate(() => { const out = [], pill = ".j-s,.j-cst,.vl,.sum-c,.pill,[data-round]";
      for (const e of document.querySelectorAll(".appbar *, main *")) { const b = e.getBoundingClientRect(); if (b.width < 2 || b.height < 2 || !e.getClientRects().length) continue;
        if (e.closest("svg,iframe,[data-user-shape]") || e.matches(pill) || e.closest(pill)) continue;
        if (e.style && /radius/.test(e.getAttribute("style") || "")) continue; // forme choisie par l’utilisateur, dessinée telle quelle
        const ctl = e.matches("button,a.btn,input:not([type=range]):not([type=color]):not([type=checkbox]):not([type=radio]),select,textarea"), big = b.width >= 300;
        if (!ctl && !big) continue; if (parseFloat(getComputedStyle(e).borderTopLeftRadius) > 0) out.push((e.id ? "#" + e.id : e.tagName.toLowerCase() + "." + String(e.className).split(" ")[0])); }
      return [...new Set(out)].slice(0, 6); });
    if (r.length) round.push(v + " : " + r.join(" ")); }
  check(!round.length, "angles droits sur les commandes et les grandes surfaces, sur les 7 étapes", round.join(" | "));
  await go(p, "couleurs");
  const flat = await p.evaluate(() => [...document.querySelectorAll(".appbar .prj-b,.appbar .cmdk,.appbar .hgrp,.appbar .normchip,.appbar .tools-b,.appbar .expbtn")].filter(e => e.getClientRects().length && getComputedStyle(e).boxShadow !== "none").map(e => e.id || e.className));
  check(!flat.length, "barre du haut : commandes à plat, sans ombre", flat.join(", "));
  const ab = await p.evaluate(() => { const a = document.querySelector(".appbar"), r = a.getBoundingClientRect(); return { h: Math.round(r.height), top: Math.round(r.top) }; });
  check(ab.h >= 60 && ab.h <= 72 && ab.top === 0, "barre du haut : collée en haut, 60 à 72 px", JSON.stringify(ab));
  const pri = await p.evaluate(() => { const b = document.querySelector("#jNext .btn.primary"), c = getComputedStyle(b); return { bg: c.backgroundColor, fg: c.color, h: Math.round(b.getBoundingClientRect().height) }; });
  check(rgb(pri.bg).join() === "5,5,5" && rgb(pri.fg).join() === "255,255,255" && pri.h >= 44, "bouton principal : noir, texte blanc, 44 px au moins", JSON.stringify(pri));
  await p.focus("#jNext .btn.primary"); await p.keyboard.press("Shift+Tab"); await p.keyboard.press("Tab");
  const fo = await p.evaluate(() => { const c = getComputedStyle(document.activeElement); return { w: c.outlineWidth, s: c.outlineStyle, o: c.outlineOffset }; });
  check(fo.w === "3px" && fo.s === "solid" && parseFloat(fo.o) >= 2, "focus clavier : contour plein de 3 px, détaché", JSON.stringify(fo));
  const hero = await p.evaluate(() => { const h = document.querySelector("#couleurs .mhead"), c = getComputedStyle(h), t = getComputedStyle(h.querySelector("h1")); return { bg: c.backgroundColor, bb: c.borderBottomWidth, ink: t.color, fs: parseFloat(t.fontSize) }; });
  check((hero.bg === "rgba(0, 0, 0, 0)" || rgb(hero.bg).join() === "244,244,240") && hero.bb === "1px" && rgb(hero.ink).join() === "5,5,5" && hero.fs >= 36, "titre de page : sans bandeau de couleur, grand titre noir, filet dessous", JSON.stringify(hero));
  check(!p.errs.length, "style : aucune erreur JavaScript", p.errs.join(" | "));
  await p.ctx.close(); }

// ---------- 2. Navigation, ordinateur ----------
{ const p = await open({ viewport: { width: 1440, height: 900 } }, "tester");
  const J = await p.evaluate(() => { const j = document.getElementById("journey"), r = j.getBoundingClientRect(), a = document.querySelector(".appbar").getBoundingClientRect();
    const cells = [...j.querySelectorAll(".j-steps a")].map(x => { const b = x.getBoundingClientRect(), s = x.querySelector(".j-s"), d = x.querySelector(".j-d"), l = x.querySelector(".j-l"); const w = e => e ? Math.round(e.getBoundingClientRect().width) : 0;
      return { w: Math.round(b.width), top: Math.round(b.top), l: w(l), s: w(s), d: w(d), dt: d ? d.textContent.trim() : "", cur: x.getAttribute("aria-current"), bg: getComputedStyle(x).backgroundColor, fg: getComputedStyle(x).color }; });
    return { pos: getComputedStyle(j).position, top: Math.round(r.top), abBottom: Math.round(a.bottom), cells }; });
  check(J.pos !== "fixed" && J.top >= J.abBottom && J.top < 140, "les étapes sont en haut, sous la barre, et non plus dans une pilule flottante", JSON.stringify({ pos: J.pos, top: J.top }));
  const ws = J.cells.map(c => c.w);
  check(J.cells.length === 7 && Math.max(...ws) - Math.min(...ws) <= 2 && new Set(J.cells.map(c => c.top)).size === 1, "7 cases de même largeur, sur une seule rangée", ws.join(", "));
  check(J.cells.every(c => c.l > 20 && c.s > 20 && c.d > 10 && c.dt.length > 2), "chaque case montre le nom, l’état et un résumé", JSON.stringify(J.cells.map(c => c.dt)));
  const cur = J.cells.filter(c => c.cur === "step");
  check(cur.length === 1 && rgb(cur[0].bg).join() === "5,5,5" && rgb(cur[0].fg).join() === "255,255,255", "l’étape en cours : case noire, texte blanc", JSON.stringify(cur));
  const small = await p.evaluate(() => { const out = []; for (const e of document.querySelectorAll("#journey *, #jNowBox *, #jNext *")) { if (!e.getClientRects().length || e.closest("svg")) continue; const own = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()); if (!own) continue; const r = e.getBoundingClientRect(); if (r.width <= 1 || r.height <= 1) continue; const f = parseFloat(getComputedStyle(e).fontSize); if (f < 12) out.push(e.className + " " + f); } return out; });
  check(!small.length, "navigation : aucun texte sous 12 px", small.slice(0, 5).join(", "));
  const D = await p.evaluate(() => { const b = document.getElementById("jNowBox"), a = b.querySelector(".j-todo"); return { pos: (b.querySelector(".j-pos") || {}).textContent || "", cst: (b.querySelector(".j-cst") || {}).textContent || "", lab: a ? (a.querySelector(".j-todo-l") || {}).textContent || "" : "", say: a ? (a.querySelector(".j-todo-t") || {}).textContent || "" : "", mode: !!b.querySelector('.j-mode [data-mode="ess"]'), help: !!b.querySelector(".j-help-b") }; });
  check(/Étape 3 sur 7/.test(D.pos) && D.cst === "En cours", "bandeau : « Étape 3 sur 7 » et son état", JSON.stringify(D));
  check(/Prochaine action/.test(D.lab) && D.say.trim().length > 15, "bandeau : « Prochaine action » suivie d’une phrase", D.say);
  check(D.mode && D.help, "bandeau : Essentiel | Avancé et Aide restent là");
  // Bas de page : précédente et suivante, toujours visibles.
  const B0 = await p.evaluate(() => { const r = document.querySelector("#jNext .jn-row"), c = getComputedStyle(r), b = r.getBoundingClientRect(); return { pos: c.position, gap: Math.round(innerHeight - b.bottom), h: Math.round(b.height), links: [...r.querySelectorAll("a")].map(a => a.textContent.replace(/\s+/g, " ").trim()), tall: document.documentElement.scrollHeight > innerHeight + 200 }; });
  check(B0.pos === "sticky" && B0.tall && Math.abs(B0.gap) <= 1 && B0.h >= 56, "bas de page : la barre « précédente / suivante » reste collée en bas de l’écran", JSON.stringify(B0));
  check(/Étape précédente/.test(B0.links[0] || "") && /Nuances/.test(B0.links[0] || "") && /^Étape suivante : Styles de texte/.test((B0.links[1] || "").replace(/ /g, " ")), "bas de page : « Étape précédente » puis « Étape suivante : Styles de texte »", B0.links.join(" | "));
  await p.evaluate(() => scrollTo(0, 400)); await p.waitForTimeout(200);
  check(await vis(p, "#jNext .jn-row .btn.primary"), "après défilement, « Étape suivante » est toujours à l’écran");
  await go(p, "couleurs"); check(await p.evaluate(() => document.querySelectorAll("#jNext .jn-row a").length) === 1, "première étape : pas de lien « Étape précédente »");
  await go(p, "exporter"); check(/guide/i.test(await p.textContent("#jNext .jn-row")), "dernière étape : la barre propose de lire le guide");
  // Défaut réel : contour de focus blanc sur fond clair.
  await p.evaluate(() => localStorage.setItem("lisio-mode", "adv")); await p.reload(); await p.waitForFunction(() => window.__lisioReady === true); await go(p, "systeme");
  const sel = 'select[data-role="focus/ring"]';
  if (await p.locator(sel).count()) { await p.evaluate(s => { const e = document.querySelector(s); e.value = "#FFFFFF"; e.dispatchEvent(new Event("change", { bubbles: true })); }, sel); await p.waitForTimeout(300); }
  const W = await p.evaluate(() => ({ d: (document.querySelector('#journey a[href="#systeme"] .j-d') || {}).textContent || "", cls: document.querySelector('#journey a[href="#systeme"]').className, say: (document.querySelector("#jNowBox .j-todo-t") || {}).textContent || "" }));
  check(/st-warn/.test(W.cls) && /\d+ à corriger/.test(W.d) && /rôle/.test(W.say), "un défaut : la case dit combien il y en a à corriger, le bandeau dit quoi corriger", JSON.stringify(W));
  const words = []; for (const v of ORDER) { await go(p, v); const t = await p.evaluate(() => ["journey", "jNowBox", "jNext"].map(i => document.getElementById(i).textContent).join(" ")); if (/conforme|certifi|100\s?%|prêt à exporter/i.test(t)) words.push(v); }
  check(!words.length, "navigation : ni « conforme », ni « certifié », ni « 100 % »", words.join(", "));
  await go(p, "lisibilite");
  check(await vis(p, "#journey .j-steps") && !(await p.evaluate(() => document.querySelector('#journey a[aria-current="step"]'))) && !(await vis(p, "#jNowBox")) && !(await vis(p, "#jNext .jn-row")), "hors parcours (Rédaction) : étapes visibles, aucune en cours, ni bandeau ni barre du bas");
  await go(p, "tester");
  for (const w of [1440, 1100, 1024]) { await p.setViewportSize({ width: w, height: 800 }); await p.waitForTimeout(200); const ov = await over(p), names = await p.evaluate(() => [...document.querySelectorAll("#journey .j-l")].every(l => l.getBoundingClientRect().width > 10 && l.scrollWidth <= l.clientWidth + 1) && [...document.querySelectorAll("#journey .j-steps a")].every(a => a.scrollWidth <= a.clientWidth + 1));
    check(ov <= 0 && names, `${w} px : pas de défilement horizontal, noms des étapes entiers`, `${ov} ${names}`); }
  // Sous 1 000 px, les 7 cases ne tiennent plus : un bouton dit l’étape et déplie la liste.
  await p.setViewportSize({ width: 800, height: 800 }); await p.waitForTimeout(250);
  check(await over(p) <= 0 && await vis(p, "#hsMob") && !(await vis(p, "#journey .j-steps a")), "800 px : pas de défilement horizontal, l’étape devient un bouton, liste repliée", String(await over(p)));
  await p.click("#hsMob"); await p.waitForTimeout(200);
  check(await p.evaluate(() => [...document.querySelectorAll("#journey .j-steps a")].filter(a => a.getClientRects().length).length) === 7 && await vis(p, "#jNext .jn-row .btn.primary"), "800 px : le bouton déplie les 7 étapes ; la barre du bas reste celle de l’ordinateur");
  await p.keyboard.press("Escape");
  await p.setViewportSize({ width: 1440, height: 900 }); await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(200);
  await axe(p, [".appbar", "#journey", "#jNowBox", "#jNext"], "axe-core, thème clair : barre du haut, étapes, bandeau, barre du bas");
  check(!p.errs.length, "ordinateur : aucune erreur JavaScript", p.errs.join(" | "));
  await p.ctx.close(); }

// ---------- 3. Thème sombre ----------
{ const p = await open({ viewport: { width: 1440, height: 900 } }, "tester", { "lisio-theme": "dark" });
  const d = await p.evaluate(() => { const b = getComputedStyle(document.body), c = getComputedStyle(document.querySelector('#journey a[aria-current="step"]')); return { bg: b.backgroundColor, ink: b.color, cbg: c.backgroundColor, cfg: c.color }; });
  check(Math.max(...rgb(d.bg)) < 30 && Math.min(...rgb(d.ink)) > 220 && Math.min(...rgb(d.cbg)) > 220 && Math.max(...rgb(d.cfg)) < 30, "thème sombre : fond noir, texte clair, étape en cours inversée", JSON.stringify(d));
  const tint = await p.evaluate(() => { const [r, g, b] = (getComputedStyle(document.body).backgroundColor.match(/\d+/g) || []).map(Number); return Math.max(r, g, b) - Math.min(r, g, b); });
  check(tint <= 6, "thème sombre : fond neutre, sans teinte", String(tint));
  await axe(p, [".appbar", "#journey", "#jNowBox", "#jNext"], "axe-core, thème sombre : barre du haut, étapes, bandeau, barre du bas");
  check(!p.errs.length, "thème sombre : aucune erreur JavaScript", p.errs.join(" | "));
  await p.ctx.close(); }

// ---------- 4. Mobile ----------
for (const [lab, vp] of [["390 px", { width: 390, height: 800 }], ["320 px", { width: 320, height: 640 }]]) {
  const p = await open({ viewport: vp, isMobile: true, hasTouch: true }, "tester");
  check(await over(p) <= 0, `${lab} : pas de défilement horizontal`, await over(p));
  const H = await p.evaluate(() => { const b = document.getElementById("hsMob"); if (!b) return null; const r = b.getBoundingClientRect(); return { t: b.textContent.replace(/\s+/g, " ").trim(), exp: b.getAttribute("aria-expanded"), ctl: b.getAttribute("aria-controls"), h: Math.round(r.height), w: Math.round(r.width) }; });
  check(!!H && /Polices/.test(H.t) && /3 sur 7/.test(H.t) && H.exp === "false" && H.h >= 44, `${lab} : en haut, un bouton dit l’étape (« Polices », « 3 sur 7 »)`, JSON.stringify(H));
  check(!(await vis(p, "#journey .j-steps a")), `${lab} : la liste des étapes est repliée`);
  await p.evaluate(() => scrollTo(0, 500)); await p.waitForTimeout(250);
  const stick = await p.evaluate(() => Math.round(document.getElementById("hsMob").getBoundingClientRect().top));
  check(stick >= 0 && stick <= 2, `${lab} : après défilement, l’étape reste en haut de l’écran`, String(stick));
  await p.click("#hsMob"); await p.waitForTimeout(250);
  const L = await p.evaluate(() => { const b = document.getElementById("hsMob"), as = [...document.querySelectorAll("#journey .j-steps a")].map(a => { const r = a.getBoundingClientRect(); return { h: Math.round(r.height), in: r.left >= 0 && r.right <= innerWidth + 0.5 && r.top >= 0 && r.bottom <= innerHeight, s: (a.querySelector(".j-s") || {}).textContent || "" }; }); return { exp: b.getAttribute("aria-expanded"), n: as.length, ok: as.every(a => a.h >= 44 && a.in && a.s.length > 3), cur: (document.querySelector('#journey a[aria-current="step"]') || { getAttribute() { return ""; } }).getAttribute("href") }; });
  check(L.exp === "true" && L.n === 7 && L.ok && L.cur === "#tester", `${lab} : toucher le bouton ouvre les 7 étapes, avec leur état, cibles de 44 px au moins`, JSON.stringify(L));
  await p.keyboard.press("Escape"); await p.waitForTimeout(200);
  check(await p.evaluate(() => document.getElementById("hsMob").getAttribute("aria-expanded") === "false" && document.activeElement.id === "hsMob"), `${lab} : Échap referme la liste et rend le focus au bouton`);
  await p.click("#hsMob"); await p.waitForTimeout(200); await p.click('#journey .j-steps a[href="#styles"]'); await p.waitForTimeout(350);
  check(await p.evaluate(() => !document.getElementById("styles").hidden && document.getElementById("hsMob").getAttribute("aria-expanded") === "false" && /Styles de texte/.test(document.getElementById("hsMob").textContent)), `${lab} : toucher une étape l’ouvre et referme la liste`);
  const N = await p.evaluate(() => { const n = document.getElementById("stepNav"), r = n.getBoundingClientRect(), box = s => { const e = n.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), h: Math.round(b.height), w: Math.round(b.width), t: e.textContent.replace(/\s+/g, " ").trim() }; };
    return { pos: getComputedStyle(n).position, gap: Math.round(innerHeight - r.bottom), full: Math.round(r.left) === 0 && Math.round(r.right) === innerWidth, pv: box("#snPrev a"), more: box("#moreB"), nx: box("#snNext a") }; });
  const seq = N.pv && N.more && N.nx ? N.pv.r <= N.more.l && N.more.r <= N.nx.l : false;
  check(N.pos === "fixed" && N.gap === 0 && N.full && seq && [N.pv, N.more, N.nx].every(b => b.h >= 44 && b.w >= 44), `${lab} : en bas, une barre pleine largeur : précédente, Outils, suivante, sans chevauchement`, JSON.stringify(N));
  check(N.pv && /Polices/.test(N.pv.t) && N.nx && /Design system|Système/.test(N.nx.t) && /Outils/.test(N.more.t), `${lab} : la barre nomme l’étape précédente et la suivante`, JSON.stringify([N.pv && N.pv.t, N.nx && N.nx.t]));
  check(!(await vis(p, "#jNext .jn-row")), `${lab} : pas de deuxième barre « précédente / suivante » dans la page`);
  const tt = await p.evaluate(() => { scrollTo(0, 900); return new Promise(r => setTimeout(() => { const t = document.getElementById("toTop").getBoundingClientRect(), n = document.getElementById("stepNav").getBoundingClientRect(); r({ above: t.bottom <= n.top, shown: t.width > 0 }); }, 300)); });
  check(tt.shown && tt.above, `${lab} : « Retour en haut » au-dessus de la barre du bas`, JSON.stringify(tt));
  await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(200);
  if (lab === "390 px") { await axe(p, ["#journey", "#jNowBox", "#stepNav"], `${lab} : axe-core, étapes, bandeau et barre du bas`);
    await p.click("#hsMob"); await p.waitForTimeout(200); await axe(p, ["#journey"], `${lab} : axe-core, liste des étapes ouverte`); }
  check(!p.errs.length, `${lab} : aucune erreur JavaScript`, p.errs.join(" | "));
  await p.ctx.close(); }

await browser.close();
console.log(fails ? `\n${fails} échec(s)` : "\nTous les scénarios passent.");
process.exit(fails ? 1 : 0);
