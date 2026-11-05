// Menu latéral organisé par intention (blueprint v2, § 3) : Projets, puis Créer, Vérifier, Apprendre, Livrer.
// Choix de Laurent du 5 novembre 2026. Vérifie l'ordre, les noms des groupes (visibles et lus),
// la page active, le menu replié, la barre mobile et le clavier.
//   node tests/e2e/menu.mjs
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PAGE = "file://" + (process.env.LISIO_PAGE || join(ROOT, "index.html"));
let chromium;
try { ({ chromium } = createRequire(import.meta.url)("playwright")); } catch (e) { console.log("IGNORÉ : Playwright introuvable."); process.exit(process.env.CI ? 1 : 0); }

const GROUPS = [["Créer", ["Couleurs", "Polices", "Styles de texte", "Design system"]], ["Vérifier", ["Contrastes", "Rédaction"]], ["Apprendre", ["Guide", "S’entraîner"]], ["Livrer", ["Exporter"]]];
const VIEW_OF = { "Couleurs": "palette", "Polices": "tester", "Styles de texte": "styles", "Design system": "systeme", "Contrastes": "matrice", "Rédaction": "lisibilite", "Guide": "sources", "S’entraîner": "formation", "Exporter": "exporter" };
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
  return { role: nav.getAttribute("role"), groups: [...nav.querySelectorAll("[role=group]")].map(g => ({ name: name(g), items: [...g.querySelectorAll("button")].filter(vis).map(label), shown: [...g.querySelectorAll(".tab-grp")].filter(vis).map(x => x.textContent.trim()) })) };
});

// 1. Ordinateur, menu déplié puis replié : groupes, ordre, noms visibles.
for (const [rail, lab] of [["o", "déplié"], ["c", "replié"]]) {
  const p = await open({ width: 1440, height: 900 }, rail);
  const m = await readMenu(p);
  const got = m.groups.map(g => g.name + " : " + g.items.join(", ")).join(" | "), want = GROUPS.map(([g, it]) => g + " : " + it.join(", ")).join(" | ");
  report(m.role !== "tablist" && got === want, `menu ${lab} : groupes et entrées dans l'ordre`, got === want ? "" : `reçu « ${got} »`);
  const shown = m.groups.map(g => g.shown.join("")).join(" | ");
  report(shown === GROUPS.map(g => g[0]).join(" | "), `menu ${lab} : nom de chaque groupe affiché`, shown);
  const fit = await p.evaluate(() => [...document.querySelectorAll("nav.tabs .tab-grp")].filter(e => e.getClientRects().length).map(e => { const cs = getComputedStyle(e), r = e.getBoundingClientRect(), n = document.querySelector("nav.tabs").getBoundingClientRect(); return { t: e.textContent, fs: parseFloat(cs.fontSize), inside: r.left >= n.left - 1 && r.right <= n.right + 1, cut: e.scrollWidth > e.clientWidth + 1 }; }).filter(x => x.fs < 10 || !x.inside || x.cut));
  report(!fit.length, `menu ${lab} : noms de groupe lisibles (10 px et plus) et entiers`, JSON.stringify(fit));
  // Projets en haut du menu, qui ouvre la liste des projets.
  const pr = await p.evaluate(() => { const b = document.getElementById("railPrj"); if (!b) return null; const r = b.getBoundingClientRect(), f = document.querySelector("nav.tabs button:not(#railPrj)").getBoundingClientRect(); return { above: r.bottom <= f.top + 1, vis: !!b.getClientRects().length, name: b.textContent.trim() || b.getAttribute("aria-label") }; });
  let opened = false; if (pr) { await p.click("#railPrj"); await p.waitForTimeout(200); opened = await p.evaluate(() => document.getElementById("prjDlg").open); }
  report(pr && pr.vis && pr.above && /Projets/.test(pr.name) && opened, `menu ${lab} : « Projets » en haut, ouvre la liste des projets`, JSON.stringify(pr));
  report(!p.errs.length, `menu ${lab} : aucune erreur JavaScript`, p.errs.join(" | "));
  await p.ctx.close();
}

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

// 3. Clavier : Tab parcourt le menu dans l'ordre (Projets puis les 9 entrées), Entrée ouvre la page.
{ const p = await open({ width: 1440, height: 900 }, "c"); await p.focus("#railPrj");
  const seq = [await p.evaluate(() => document.activeElement.id || "?")];
  for (let i = 0; i < 9; i++) { await p.keyboard.press("Tab"); seq.push(await p.evaluate(() => document.activeElement.dataset.view || document.activeElement.id)); }
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
  const missing = ["Styles", "Rédaction", "Guide", "S’entraîner", "Exporter", "Projets"].filter(t => !sheet.includes(t));
  report(bar.n === 5 && bar.sw <= w && !missing.length, `mobile ${w} px : barre du bas et feuille « Plus »`, `${bar.names.join(", ")} ; largeur ${bar.sw}${missing.length ? " ; manque " + missing.join(", ") : ""}`);
  await p.ctx.close(); }

await browser.close();
console.log(fails ? `\n${fails} contrôle(s) en échec` : "\nLe menu suit l'organisation par intention.");
process.exit(fails ? 1 : 0);
