// P0-5 · Résumé permanent du projet (blueprint v2, F02) : compact, sur chaque page, chiffres réels et à jour,
// non testé distinct des échecs, chaque ligne mène à l'élément, au clavier aussi.
//   node tests/e2e/resume.mjs
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
const COLORS = [{ name: "Encre", hex: "#0E1B4D" }, { name: "Corail", hex: "#FF5A4E" }, { name: "Sable", hex: "#F1E9DA" }, { name: "Blanc", hex: "#FFFFFF" }];
async function open(view, vp = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport: vp });
  await ctx.addInitScript(c => { try { if (!sessionStorage.getItem("t-init")) { sessionStorage.setItem("t-init", "1"); localStorage.clear(); localStorage.setItem("lisio-welcome", "1"); localStorage.setItem("lisio-home", "off"); localStorage.setItem("lisio-mode", "adv"); localStorage.setItem("lisio:colors", JSON.stringify(c)); } } catch (e) {} }, COLORS);
  await ctx.route(/^https?:/, r => r.abort());
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.goto(PAGE + "#" + view); await p.waitForTimeout(600); p.errs = errs; p.ctx = ctx; return p;
}
const go = async (p, v) => { await p.evaluate(v => { location.hash = v; }, v); await p.waitForTimeout(250); };
const sum = p => p.evaluate(() => { const d = document.getElementById("sumBar"); if (!d) return null;
  const rows = [...d.querySelectorAll("[data-sum]")].map(r => ({ id: r.dataset.sum, st: r.dataset.st, text: r.textContent.replace(/\s+/g, " ").trim(), href: (r.querySelector("a") || {}).getAttribute ? r.querySelector("a").getAttribute("href") : null }));
  const s = d.querySelector("summary"), b = s.getBoundingClientRect();
  return { line: s.textContent.replace(/\s+/g, " ").trim(), h: b.height, open: d.open, rows, vis: !!d.getClientRects().length }; });
const rowOf = (s, id) => (s.rows.find(r => r.id === id) || { text: "", st: "" });
const WORDS = { ok: "Conforme au test", fail: "Échec du test", check: "À vérifier manuellement", untested: "Non testé" };

// 1. Présent et compact sur chaque page.
{ const p = await open("couleurs"); const bad = [];
  for (const v of ["couleurs", "palette", "tester", "styles", "systeme", "matrice", "lisibilite", "sources", "exporter"]) { await go(p, v); const s = await sum(p); if (!s || !s.vis || s.h > 56 || s.open) bad.push(`${v} ${s ? Math.round(s.h) + " px" + (s.open ? " ouvert" : "") : "absent"}`); }
  report(!bad.length, "résumé présent sur les 9 pages, replié, 56 px de haut au plus", bad.join(" ; "));
  report(!p.errs.length, "aucune erreur JavaScript", p.errs.join(" | ")); await p.ctx.close(); }

// 2. Chiffres réels : couleurs, jetons de couleur de l'export, styles, cases manuelles.
{ const p = await open("styles");
  const real = await p.evaluate(() => { const s = document.getElementById("tsFmt"); s.value = "json"; s.dispatchEvent(new Event("change")); const o = JSON.parse(document.getElementById("tsOut").textContent);
    let n = 0; (function w(x) { for (const k in x) { const v = x[k]; if (!v || typeof v !== "object") continue; if (v.$type === "color") n++; else w(v); } })(o.color || {}); (function w(x) { for (const k in x) { const v = x[k]; if (!v || typeof v !== "object") continue; if (v.$type === "color") n++; else w(v); } })(o.semantic || {});
    return { tokens: n, styles: document.querySelectorAll("[id^=tsi-]").length }; });
  const s = await sum(p);
  report(new RegExp(`^Couleurs.*4 couleurs, ${real.tokens} jetons de couleur`).test(rowOf(s, "colors").text), "couleurs et jetons de couleur = ceux de l'export JSON", `${rowOf(s, "colors").text} ; export : ${real.tokens}`);
  report(new RegExp(`${real.styles} styles`).test(rowOf(s, "type").text), "nombre de styles = styles de la page", `${rowOf(s, "type").text} ; page : ${real.styles}`);
  await go(p, "exporter"); const m = await p.evaluate(() => ({ boxes: document.querySelectorAll("#mnList input[type=checkbox]").length }));
  report(new RegExp(`${m.boxes} sur ${m.boxes} pas encore vérifiés`).test(rowOf(s, "manual").text) && rowOf(s, "manual").st === "untested", "vérifications à la main : toutes « Non testé », pas « Échec »", rowOf(s, "manual").text);
  report(!/Échec/.test(rowOf(s, "manual").text) && /Non testé/.test(rowOf(s, "manual").text), "le mot dit l'état : « Non testé »", rowOf(s, "manual").text);
  // 3. À jour après modification.
  await p.evaluate(() => document.querySelector("#mnList input[type=checkbox]").click()); await p.waitForTimeout(250);
  const s2 = await sum(p);
  report(new RegExp(`${m.boxes - 1} sur ${m.boxes} pas encore`).test(rowOf(s2, "manual").text), "une case cochée : le résumé suit", rowOf(s2, "manual").text);
  await go(p, "systeme"); await p.evaluate(() => { const e = document.querySelector('select[data-role="focus/ring"]'); e.value = "#FFFFFF"; e.dispatchEvent(new Event("change", { bubbles: true })); }); await p.waitForTimeout(250);
  const s3 = await sum(p);
  report(rowOf(s3, "roles").st === "fail" && /Échec/.test(rowOf(s3, "roles").text) && /1 échec/.test(s3.line), "un rôle sous le seuil : « Échec » dans la ligne et dans le détail", `${s3.line} | ${rowOf(s3, "roles").text}`);
  report(/non testés/.test(s3.line) && /1 échec/.test(s3.line), "ligne repliée : échecs et non testés comptés à part", s3.line);
  await go(p, "couleurs"); await p.click("#addColor"); await p.waitForTimeout(300);
  const s4 = await sum(p);
  report(/^Couleurs.*5 couleurs/.test(rowOf(s4, "colors").text), "une couleur ajoutée : 5 couleurs", rowOf(s4, "colors").text);
  // 4. Chaque état a son mot (pas la couleur seule).
  const noWord = s4.rows.filter(r => r.st !== "info" && !r.text.includes(WORDS[r.st]));
  report(!noWord.length, "chaque ligne avec un état l'écrit en toutes lettres", JSON.stringify(noWord));
  report(/pas la conformité/.test(rowOf(s4, "progress").text) && !/\bconformes?\b(?! au test)|certifi|100\s?%/i.test(s4.rows.map(r => r.text).join(" ") + s4.line), "progression : configuration, pas conformité", rowOf(s4, "progress").text);
  report(!p.errs.length, "aucune erreur JavaScript", p.errs.join(" | ")); await p.ctx.close(); }

// 5. Clavier : Entrée ouvre le résumé, chaque lien mène à sa page et y place le focus.
{ const p = await open("matrice"); await p.focus("#sumBar summary"); await p.keyboard.press("Enter"); await p.waitForTimeout(150);
  const s = await sum(p); const bad = [];
  for (const r of s.rows) { await p.evaluate(() => { document.getElementById("sumBar").open = true; });
    // Le lien « Configuration » mène à la prochaine étape à compléter : on lit sa cible au moment du clic.
    const href = await p.evaluate(id => document.querySelector(`#sumBar [data-sum="${id}"] a`).getAttribute("href"), r.id);
    await p.focus(`#sumBar [data-sum="${r.id}"] a`); await p.keyboard.press("Enter"); await p.waitForTimeout(250);
    const at = await p.evaluate(h => ({ shown: !document.getElementById(h.slice(1)).hidden, focusIn: !!document.activeElement.closest(h), hash: location.hash }), href);
    if (!at.shown || !at.focusIn) bad.push(`${r.id} → ${JSON.stringify(at)}`); }
  report(s.open && s.rows.length >= 6 && !bad.length, "Entrée ouvre le résumé ; chaque lien ouvre sa page, focus dedans", `ouvert ${s.open}, ${s.rows.length} lignes ; ` + bad.join(" ; ")); await p.ctx.close(); }

// 6. Mobile : pas de débordement, résumé lisible.
for (const w of [320, 390]) { const p = await open("couleurs", { width: w, height: 800 }); const s = await sum(p), sw = await p.evaluate(() => document.documentElement.scrollWidth);
  report(s && s.vis && sw <= w, `mobile ${w} px : résumé présent, aucun débordement`, `largeur ${sw}, ${s && Math.round(s.h)} px`); await p.ctx.close(); }

await browser.close();
console.log(fails ? `\n${fails} contrôle(s) en échec` : "\nRésumé permanent : contrôles passés.");
process.exit(fails ? 1 : 0);
