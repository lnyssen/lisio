// Menu latéral organisé par intention (blueprint v2, § 3) : Projets, puis Créer, Vérifier, Livrer.
// Apprendre (Guide, S’entraîner) est dans « Aide et formation », en bas du menu (demande de Laurent, 6 novembre 2026) ; il reste dans « Plus » sur mobile.
// Replié, le menu est une pilule : des ronds de même taille, sans défilement, les groupes séparés par un trait.
// Choix de Laurent du 5 novembre 2026. Nuances ajoutées avec la page Couleurs (P0-4, 6 novembre 2026). Vérifie l'ordre, les noms des groupes (visibles et lus),
// la page active, le menu replié, la barre mobile et le clavier.
//   node tests/e2e/menu.mjs
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PAGE = "file://" + (process.env.LISIO_PAGE || join(ROOT, "index.html"));
let chromium;
try { ({ chromium } = createRequire(import.meta.url)("playwright")); } catch (e) { console.log("IGNORÉ : Playwright introuvable."); process.exit(process.env.CI ? 1 : 0); }

const GROUPS = [["Créer", ["Couleurs", "Nuances", "Polices", "Styles de texte", "Design system"]], ["Vérifier", ["Contrastes", "Rédaction"]], ["Livrer", ["Exporter"]]];
const VIEW_OF = { "Couleurs": "couleurs", "Nuances": "palette", "Polices": "tester", "Styles de texte": "styles", "Design system": "systeme", "Contrastes": "matrice", "Rédaction": "lisibilite", "Guide": "sources", "S’entraîner": "formation", "Exporter": "exporter" };
const browser = await chromium.launch();
let fails = 0;
const report = (ok, label, detail = "") => { if (!ok) fails++; console.log(`${ok ? "ok   " : "ÉCHEC"} ${label}${detail ? " : " + detail : ""}`); };
async function open(viewport, rail, view = "matrice") {
  const ctx = await browser.newContext({ viewport });
  await ctx.addInitScript(r => { try { localStorage.setItem("lisio-welcome", "1"); if (r) localStorage.setItem("lisio-rail", r); } catch (e) {} }, rail);
  await ctx.route(/^https?:/, r => r.abort());
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.goto(PAGE + "#" + view); await p.waitForTimeout(700); p.errs = errs; p.ctx = ctx; return p;
}
// Lecture du menu tel qu'un lecteur d'écran le reçoit : groupes nommés et leurs entrées.
const readMenu = p => p.evaluate(() => {
  const nav = document.querySelector("nav.tabs"), vis = e => e.getClientRects().length && getComputedStyle(e).visibility !== "hidden";
  const name = el => { const ids = (el.getAttribute("aria-labelledby") || "").split(" ").filter(Boolean); return ids.length ? ids.map(i => document.getElementById(i).textContent.trim()).join(" ") : (el.getAttribute("aria-label") || ""); };
  const label = b => { const s = b.querySelector(":scope > span"); return (s ? [...s.childNodes].filter(n => n.nodeType === 3 || getComputedStyle(n).display !== "none").map(n => n.textContent).join("") : b.textContent).trim(); };
  return { role: nav.getAttribute("role"), groups: [...nav.querySelectorAll("[role=group]")].filter(g => [...g.querySelectorAll("button")].some(vis)).map(g => ({ name: name(g), items: [...g.querySelectorAll("button")].filter(vis).map(label), shown: [...g.querySelectorAll(".tab-grp")].filter(vis).filter(x => parseFloat(getComputedStyle(x).fontSize) > 0).map(x => x.textContent.trim()) })) };
});

// 1. Ordinateur, menu déplié puis replié : groupes, ordre, noms visibles.
for (const [rail, lab] of [["o", "déplié"], ["c", "replié"]]) {
  const p = await open({ width: 1440, height: 900 }, rail);
  const m = await readMenu(p);
  const got = m.groups.map(g => g.name + " : " + g.items.join(", ")).join(" | "), want = GROUPS.map(([g, it]) => g + " : " + it.join(", ")).join(" | ");
  report(m.role !== "tablist" && got === want, `menu ${lab} : groupes et entrées dans l'ordre`, got === want ? "" : `reçu « ${got} »`);
  const shown = m.groups.map(g => g.shown.join("")).join(" | ");
  if (rail === "o") report(shown === GROUPS.map(g => g[0]).join(" | "), `menu ${lab} : nom de chaque groupe affiché`, shown);
  else report(shown.replace(/[ |]/g, "") === "", `menu ${lab} : groupes marqués par un trait, sans nom tronqué`, shown);
  const fit = await p.evaluate(() => [...document.querySelectorAll("nav.tabs .tab-grp")].filter(e => e.getClientRects().length).map(e => { const cs = getComputedStyle(e), r = e.getBoundingClientRect(), n = document.querySelector("nav.tabs").getBoundingClientRect(); return { t: e.textContent, fs: parseFloat(cs.fontSize), inside: r.left >= n.left - 1 && r.right <= n.right + 1, cut: e.scrollWidth > e.clientWidth + 1 }; }).filter(x => x.fs < 10 || !x.inside || x.cut));
  if (rail === "o") report(!fit.length, `menu ${lab} : noms de groupe lisibles (10 px et plus) et entiers`, JSON.stringify(fit));
  // Aucun nom de groupe ne passe sous un bouton du menu (défaut vu le 6 novembre 2026 avec les ronds de la branche de travail).
  const over = await p.evaluate(() => { const bs = [...document.querySelectorAll("nav.tabs button, #railPrj")].filter(b => b.getClientRects().length).map(b => b.getBoundingClientRect());
    return [...document.querySelectorAll("nav.tabs .tab-grp")].filter(e => e.getClientRects().length).filter(e => { const r = e.getBoundingClientRect(), g = document.createRange(); g.selectNodeContents(e); const t = g.getBoundingClientRect();
      return t.top < r.top - 1 || t.bottom > r.bottom + 1 || bs.some(b => t.left < b.right - 1 && t.right > b.left + 1 && t.top < b.bottom - 1 && t.bottom > b.top + 1); }).map(e => e.textContent); });
  report(!over.length, `menu ${lab} : chaque nom de groupe entier en hauteur, et sous aucun bouton`, over.join(", "));
  // Projets en haut du menu, qui ouvre la liste des projets.
  const pr = await p.evaluate(() => { const b = document.getElementById("railPrj"); if (!b) return null; const r = b.getBoundingClientRect(), f = document.querySelector("nav.tabs button:not(#railPrj)").getBoundingClientRect(); return { above: r.bottom <= f.top + 1, vis: !!b.getClientRects().length, name: b.textContent.trim() || b.getAttribute("aria-label") }; });
  let opened = false; if (pr) { await p.click("#railPrj"); await p.waitForTimeout(200); opened = await p.evaluate(() => document.getElementById("prjDlg").open); }
  report(pr && pr.vis && pr.above && /Projets/.test(pr.name) && opened, `menu ${lab} : « Projets » en haut, ouvre la liste des projets`, JSON.stringify(pr));
  report(!p.errs.length, `menu ${lab} : aucune erreur JavaScript`, p.errs.join(" | "));
  await p.ctx.close();
}

// 1 bis. Replié : une pilule, des ronds de même taille (logo, replier, Projets, pages, aide), rond orange pour la page active, aucun défilement.
for (const h of [600, 680, 760, 900, 1080]) {
  const p = await open({ width: 1280, height: h }, "c", "couleurs");
  const r = await p.evaluate(() => { const n = document.querySelector("nav.tabs"), nr = n.getBoundingClientRect(), R = e => e.getBoundingClientRect();
    const els = [document.querySelector(".side-top .logo-mark"), document.getElementById("sideB"), ...[...n.querySelectorAll("button")].filter(b => b.getClientRects().length), document.getElementById("helpB")];
    const sz = els.map(e => { const b = R(e), cs = getComputedStyle(e), rad = parseFloat(cs.borderTopLeftRadius) || 0, clip = /circle/.test(cs.clipPath); return { id: e.id || e.className.baseVal || e.className, w: Math.round(b.width), h: Math.round(b.height), round: clip || rad >= b.width / 2 - 0.5 }; });
    const ink = document.querySelector(".tab-ink"), ir = R(ink), icr = parseFloat(getComputedStyle(ink).borderTopLeftRadius);
    const logo = R(els[0]), help = R(els[els.length - 1]), ov = [document.querySelector(".side-top"), n, document.querySelector(".side-foot")].map(x => getComputedStyle(x).overflowY);
    return { sz, scroll: n.scrollHeight - n.clientHeight, pill: parseFloat(getComputedStyle(n).borderTopLeftRadius) >= nr.width / 2 - 0.5, w: Math.round(nr.width),
      ink: [Math.round(ir.width), Math.round(ir.height), icr >= ir.width / 2 - 0.5], top: Math.round(logo.top - nr.top), bottom: Math.round(nr.bottom - help.bottom), sw: document.documentElement.scrollWidth }; });
  const d = r.sz[0].w, same = r.sz.every(x => x.w === d && x.h === d), round = r.sz.every(x => x.round);
  report(same && round, `replié ${h} px : ${r.sz.length} ronds de ${d} px (logo, replier, Projets, pages, aide)`, same && round ? "" : JSON.stringify(r.sz.filter(x => !(x.w === d && x.h === d && x.round))));
  report(r.ink[0] === d && r.ink[1] === d && r.ink[2], `replié ${h} px : page active dans un rond de même taille`, JSON.stringify(r.ink));
  report(r.scroll <= 0, `replié ${h} px : aucun défilement dans le menu`, `${r.scroll} px de trop`);
  report(r.pill && r.w === d + 16, `replié ${h} px : pilule (arrondi entier, ${r.w} px de large)`, JSON.stringify({ pill: r.pill, w: r.w }));
  report(r.top <= 8 && r.bottom <= 8 && r.top >= 4 && r.bottom >= 4, `replié ${h} px : logo et aide à 4 à 8 px des bords`, `haut ${r.top}, bas ${r.bottom}`);
  report(!p.errs.length, `replié ${h} px : aucune erreur JavaScript`, p.errs.join(" | ")); await p.ctx.close();
}

// 1 ter. Guide et S’entraîner : dans « Aide et formation », en bas ; la page s'ouvre sans marquer une page du menu.
for (const rail of ["o", "c"]) { const p = await open({ width: 1440, height: 900 }, rail);
  await p.click("#helpB"); await p.waitForTimeout(150);
  const links = await p.evaluate(() => [...document.querySelectorAll("#helpPop a[href^='#']")].map(a => a.getAttribute("href")));
  await p.click("#helpPop a[href='#sources']"); await p.waitForTimeout(300);
  const r = await p.evaluate(() => ({ shown: !document.getElementById("sources").hidden, cur: [...document.querySelectorAll('nav.tabs [aria-current="page"]')].filter(b => b.getClientRects().length).length, ink: getComputedStyle(document.querySelector(".tab-ink")).opacity }));
  report(links.includes("#sources") && links.includes("#formation") && r.shown && r.cur === 0 && r.ink === "0", `menu ${rail === "o" ? "déplié" : "replié"} : Guide et S’entraîner dans l’aide, sans faux repère dans le menu`, JSON.stringify({ links, ...r }));
  await p.ctx.close(); }

// 2. Chaque entrée ouvre sa page, marquée comme page actuelle, une seule à la fois.
{ const p = await open({ width: 1440, height: 900 }, "o"); const bad = [];
  for (const [, items] of GROUPS) for (const it of items) {
    const v = VIEW_OF[it];
    const found = await p.evaluate(t => { const b = [...document.querySelectorAll("nav.tabs button")].find(x => x.textContent.replace(/\s+/g, " ").includes(t)); if (b) b.click(); return !!b; }, it); await p.waitForTimeout(150);
    if (!found) { bad.push(`${it} absent du menu`); continue; }
    const r = await p.evaluate(v => ({ shown: !document.getElementById(v).hidden, cur: [...document.querySelectorAll('nav.tabs [aria-current="page"]')].map(b => b.dataset.view), hash: location.hash }), v);
    if (!r.shown || r.cur.join() !== v || r.hash !== "#" + v) bad.push(`${it} → ${JSON.stringify(r)}`);
  }
  report(!bad.length, "chaque entrée ouvre sa page et devient la page actuelle", bad.slice(0, 3).join(" ; ")); await p.ctx.close(); }

// 3. Clavier : Tab parcourt le menu dans l'ordre (Projets puis les 8 entrées), Entrée ouvre la page.
{ const p = await open({ width: 1440, height: 900 }, "c"); await p.focus("#railPrj");
  const seq = [await p.evaluate(() => document.activeElement.id || "?")];
  for (let i = 0; i < 8; i++) { await p.keyboard.press("Tab"); seq.push(await p.evaluate(() => document.activeElement.dataset.view || document.activeElement.id)); }
  const want = ["railPrj", ...GROUPS.flatMap(g => g[1]).map(t => VIEW_OF[t])];
  await p.evaluate(() => { const l = document.querySelector('nav.tabs [data-view="lisibilite"]'); l.tabIndex = 0; l.focus(); }); await p.keyboard.press("Enter"); await p.waitForTimeout(150);
  const ent = await p.evaluate(() => !document.getElementById("lisibilite").hidden);
  report(seq.join() === want.join() && ent, "clavier : ordre de Tab dans le menu, Entrée ouvre la page", seq.join() === want.join() ? "" : seq.join(" → ")); await p.ctx.close(); }

// 4. Mobile : 4 onglets et « Plus » en bas, sans débordement ; le reste dans la feuille « Plus ».
for (const w of [320, 390]) { const p = await open({ width: w, height: 800 });
  const bar = await p.evaluate(() => { const n = document.querySelector("nav.tabs"), vis = [...document.querySelectorAll("nav.tabs button, #moreB")].filter(b => b.getClientRects().length && b.getBoundingClientRect().top >= n.getBoundingClientRect().top - 1);
    return { n: vis.length, names: vis.map(b => b.textContent.trim().replace(/\s+/g, " ")), sw: document.documentElement.scrollWidth }; });
  await p.click("#moreB"); await p.waitForTimeout(250);
  const sheet = await p.evaluate(() => document.getElementById("moreG").textContent);
  const missing = ["Nuances", "Styles", "Rédaction", "Guide", "S’entraîner", "Exporter", "Projets"].filter(t => !sheet.includes(t));
  report(bar.n === 5 && bar.sw <= w && !missing.length, `mobile ${w} px : barre du bas et feuille « Plus »`, `${bar.names.join(", ")} ; largeur ${bar.sw}${missing.length ? " ; manque " + missing.join(", ") : ""}`);
  await p.ctx.close(); }

await browser.close();
console.log(fails ? `\n${fails} contrôle(s) en échec` : "\nLe menu suit l'organisation par intention.");
process.exit(fails ? 1 : 0);
