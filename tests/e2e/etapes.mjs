// F01 · Bandeau d'étapes (blueprint v2) : ordre du parcours, état de chaque étape écrit en toutes lettres,
// retour en arrière et accès direct, clavier, aucune perte de données, aucune promesse de conformité.
//   node tests/e2e/etapes.mjs
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PAGE = "file://" + (process.env.LISIO_PAGE || join(ROOT, "index.html"));
let chromium;
try { ({ chromium } = createRequire(import.meta.url)("playwright")); } catch (e) { console.log("IGNORÉ : Playwright introuvable."); process.exit(process.env.CI ? 1 : 0); }

// Ordre du blueprint (Couleurs, Typographie, Interaction, Vérification, Export) posé sur les pages de Lisio, dans l'ordre du menu (Nuances ajoutées par P0-4).
const ORDER = [["couleurs", "Couleurs"], ["palette", "Nuances"], ["tester", "Polices"], ["styles", "Styles de texte"], ["systeme", "Design system"], ["matrice", "Contrastes"], ["exporter", "Exporter"]];
const STATES = ["À commencer", "En cours", "Complété", "Attention requise", "Non applicable"];
const browser = await chromium.launch();
let fails = 0;
const report = (ok, label, detail = "") => { if (!ok) fails++; console.log(`${ok ? "ok   " : "ÉCHEC"} ${label}${detail ? " : " + detail : ""}`); };
async function open(viewport, view = "matrice", init = {}) {
  const ctx = await browser.newContext({ viewport });
  await ctx.addInitScript(o => { try { if (!sessionStorage.getItem("t-init")) { sessionStorage.setItem("t-init", "1"); localStorage.setItem("lisio-welcome", "1"); for (const [k, v] of Object.entries(o)) localStorage.setItem(k, v); } } catch (e) {} }, init);
  await ctx.route(/^https?:/, r => r.abort());
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.goto(PAGE + "#" + view); await p.waitForTimeout(600); p.errs = errs; p.ctx = ctx; return p;
}
const go = async (p, v) => { await p.evaluate(v => { location.hash = v; }, v); await p.waitForTimeout(150); };
// Le bandeau tel qu'on le lit : page visée, nom, état écrit, étape actuelle.
const steps = p => p.evaluate(() => [...document.querySelectorAll("#journey .j-steps a")].map(a => ({
  id: a.getAttribute("href").slice(1), label: (a.querySelector(".j-l") || {}).textContent, state: (a.querySelector(".j-s") || {}).textContent || "",
  cur: a.getAttribute("aria-current"), cls: a.className, name: a.textContent.replace(/\s+/g, " ").trim(),
  stateShown: (() => { const s = a.querySelector(".j-s"); if (!s) return false; const r = s.getBoundingClientRect(); return r.width > 1 && r.height > 1 && getComputedStyle(s).visibility !== "hidden"; })() })));
const stOf = (S, id) => (S.find(x => x.id === id) || {}).state;

// 1. Ordre, noms, état écrit pour chaque étape, une seule étape actuelle.
{ const p = await open({ width: 1440, height: 900 });
  const S = await steps(p);
  const got = S.map(s => s.id + ":" + s.label).join(" "), want = ORDER.map(([v, l]) => v + ":" + l).join(" ");
  report(got === want, "ordre du parcours : Couleurs, Nuances, Polices, Styles, Design system, Contrastes, Exporter", got === want ? "" : got);
  // Barre des étapes en pilule (choix de Laurent, 7 novembre 2026) : l'état de chaque étape est dans son nom accessible et se voit
  // par une marque propre (pastille pleine ✓, rouge, pointillés) ; l'état de l'étape actuelle est écrit en toutes lettres sous le titre.
  const KEY = { "À commencer": "todo", "En cours": "now", "Complété": "done", "Attention requise": "warn", "Non applicable": "na" };
  const bad = S.filter(s => !STATES.some(t => s.state.startsWith(t)) || !s.name.includes(s.state) || !s.cls.includes("st-" + KEY[STATES.find(t => s.state.startsWith(t))]));
  report(!bad.length, "chaque étape : état en toutes lettres dans son nom, et marque visible propre à l'état", JSON.stringify(bad.slice(0, 2)));
  const now = await p.evaluate(() => { const c = document.querySelector("#jNowBox .j-cst"); if (!c) return null; const r = c.getBoundingClientRect(); return r.width > 1 ? c.textContent : null; });
  report(now === "En cours", "l'état de l'étape actuelle est écrit, visible, sous le titre", String(now));
  const prog = await p.evaluate(() => { const e = document.querySelector("#journey .j-prog"); return e && e.textContent; });
  report(/^\d\/7/.test(prog || ""), "la barre montre la progression (étapes complétées sur 7)", String(prog));
  const cur = S.filter(s => s.cur === "step");
  report(cur.length === 1 && cur[0].id === "matrice" && stOf(S, "matrice") === "En cours", "une seule étape actuelle (aria-current=step), dite « En cours »", JSON.stringify(cur));
  // Mise en page : nom et état collés au numéro, pour chaque étape (une classe d'état ne doit pas hériter d'un autre bloc).
  const gap = await p.evaluate(() => [...document.querySelectorAll("#journey .j-steps a")].map(a => { const n = a.querySelector(".j-n").getBoundingClientRect(), t = a.querySelector(".j-t").getBoundingClientRect(); return Math.round(t.left - n.right); }));
  report(gap.every(g => g >= 0 && g <= 12), "nom et état à côté du numéro, sur chaque étape", gap.join(", "));
  // Projet neuf : couleurs d'exemple, rien d'ouvert.
  report(stOf(S, "couleurs") === "À commencer" && stOf(S, "tester") === "À commencer", "projet neuf : Couleurs et Polices « À commencer »", `${stOf(S, "couleurs")} / ${stOf(S, "tester")}`);
  const help = await p.evaluate(() => { const b = document.querySelector('#jNowBox [data-q="etape"]'); if (!b) return null; b.click(); return document.getElementById("qPop").textContent; });
  report(!!help && /pas (la|une) conformité/i.test(help) && STATES.every(t => help.includes(t)), "aide « ? » des états : les 5 états, et ce n'est pas la conformité", help ? "" : "pastille absente");
  report(!p.errs.length, "aucune erreur JavaScript", p.errs.join(" | ")); await p.ctx.close(); }

// 2. Les états suivent le travail réel, pas la position dans le parcours.
{ const p = await open({ width: 1440, height: 900 });
  await go(p, "tester"); await go(p, "couleurs"); let S = await steps(p);
  report(stOf(S, "tester") === "Complété" && stOf(S, "styles") === "À commencer", "étape ouverte puis quittée : « Complété » ; étape suivante jamais ouverte : « À commencer »", `${stOf(S, "tester")} / ${stOf(S, "styles")}`);
  await go(p, "matrice"); S = await steps(p);
  report(stOf(S, "couleurs") === "À commencer", "Couleurs reste « À commencer » tant que la palette est celle de l'exemple", stOf(S, "couleurs"));
  await p.ctx.close(); }

// 2 bis. Couleurs saisies, puis un défaut réel : contour de focus blanc sur fond de page clair.
{ const p = await open({ width: 1440, height: 900 }, "couleurs", { "lisio:colors": JSON.stringify([{ name: "Encre", hex: "#0E1B4D" }, { name: "Corail", hex: "#F4A261" }]) });
  await go(p, "matrice"); let S = await steps(p);
  report(stOf(S, "couleurs") === "Complété", "Couleurs « Complété » une fois ses propres couleurs saisies", stOf(S, "couleurs"));
  await go(p, "systeme");
  const sel = 'select[data-role="focus/ring"]';
  const ok = await p.locator(sel).count();
  // Le menu natif est caché derrière le sélecteur de nuances : on passe par son événement « change », comme lui.
  if (ok) { await p.evaluate(s => { const e = document.querySelector(s); e.value = "#FFFFFF"; e.dispatchEvent(new Event("change", { bubbles: true })); }, sel); await p.waitForTimeout(200); }
  await go(p, "exporter"); S = await steps(p);
  const n = await p.evaluate(() => document.querySelectorAll("#exFix li.bad").length), badge = await p.evaluate(() => { const b = document.querySelector('#journey a[href="#systeme"] .j-i'); return b ? parseInt(b.textContent) : 0; });
  report(ok && n > 0 && stOf(S, "systeme").startsWith("Attention requise") && stOf(S, "exporter").startsWith("Attention requise") && badge === n, "défaut détecté : Design system et Exporter « Attention requise », compteur égal à la liste « À corriger »", `${stOf(S, "systeme")} / ${stOf(S, "exporter")} / ${badge} sur ${n}`);
  report(!p.errs.length, "aucune erreur JavaScript", p.errs.join(" | ")); await p.ctx.close(); }

{ const p = await open({ width: 1440, height: 900 }); await go(p, "tester"); let S;
  // Retour en arrière puis saut direct.
  await go(p, "tester"); const back = await p.evaluate(() => [...document.querySelectorAll("#jNext .jn-row a")].map(a => a.getAttribute("href")));
  report(back.join() === "#palette,#styles", "page Polices : retour vers Nuances, suite vers Styles de texte", back.join());
  await p.click('#journey a[href="#exporter"]'); await p.waitForTimeout(200);
  report(await p.evaluate(() => !document.getElementById("exporter").hidden), "saut direct vers Exporter depuis le bandeau, rien ne bloque");
  // Après rechargement, les états restent (enregistrés pour ce projet).
  await p.reload(); await p.waitForTimeout(600); S = await steps(p);
  report(stOf(S, "tester") === "Complété", "après rechargement, les étapes ouvertes le restent", stOf(S, "tester"));
  report(!p.errs.length, "aucune erreur JavaScript", p.errs.join(" | ")); await p.ctx.close(); }

// 3. Non applicable : une seule couleur, aucune paire à vérifier.
{ const p = await open({ width: 1440, height: 900 }, "palette", { "lisio:colors": JSON.stringify([{ name: "Seule", hex: "#2A6F97" }]) });
  const S = await steps(p);
  report(stOf(S, "matrice") === "Non applicable", "une seule couleur : Contrastes « Non applicable »", stOf(S, "matrice"));
  await p.click('#journey a[href="#matrice"]'); await p.waitForTimeout(200);
  report(await p.evaluate(() => !document.getElementById("matrice").hidden), "une étape « Non applicable » reste ouvrable"); await p.ctx.close(); }

// 4. Parcourir les étapes ne touche pas aux données.
{ const p = await open({ width: 1440, height: 900 }, "palette", { "lisio:colors": JSON.stringify([{ name: "A", hex: "#0E1B4D" }, { name: "B", hex: "#F4A261" }]) });
  const snap = () => p.evaluate(() => JSON.stringify({ c: localStorage.getItem("lisio:colors"), s: JSON.parse(localStorage.getItem("lisio:state") || "{}") }));
  const a = await snap(); for (const [v] of ORDER) await go(p, v); for (const [v] of [...ORDER].reverse()) await go(p, v);
  const b = await snap();
  report(a === b, "aller-retour dans les 7 étapes : couleurs et réglages inchangés", a === b ? "" : "données modifiées"); await p.ctx.close(); }

// 5. Clavier : Tab parcourt les 7 étapes dans l'ordre, Entrée ouvre la page.
{ const p = await open({ width: 1440, height: 900 }, "styles");
  await p.focus('#journey a[href="#couleurs"]'); const seq = [];
  for (let i = 0; i < 7; i++) { seq.push(await p.evaluate(() => (document.activeElement.getAttribute("href") || "?").slice(1))); await p.keyboard.press("Tab"); }
  await p.focus('#journey a[href="#systeme"]'); await p.keyboard.press("Enter"); await p.waitForTimeout(200);
  const ok = await p.evaluate(() => !document.getElementById("systeme").hidden && document.querySelector('#journey a[aria-current="step"]').getAttribute("href") === "#systeme");
  report(seq.join() === ORDER.map(o => o[0]).join() && ok, "clavier : Tab dans l'ordre des étapes, Entrée ouvre l'étape", seq.join(" → ")); await p.ctx.close(); }

// 6. Aucune promesse de conformité dans le bandeau ni dans la barre du bas.
{ const p = await open({ width: 1440, height: 900 }); const bad = [];
  for (const [v] of ORDER) { await go(p, v); const t = await p.evaluate(() => document.getElementById("journey").textContent + " " + document.getElementById("jNext").textContent); if (/conforme|conformité totale|certifi|100\s?%/i.test(t)) bad.push(v); }
  report(!bad.length, "aucun « conforme », « certifié » ni « 100 % » dans le parcours", bad.join(", ")); await p.ctx.close(); }

// 7. Mobile : l'étape actuelle montre son nom et son état ; les autres gardent l'état dans leur nom ; pas de débordement.
for (const w of [320, 390]) { const p = await open({ width: w, height: 800 }, "styles");
  const S = await steps(p), c = S.find(s => s.cur === "step"), sw = await p.evaluate(() => document.documentElement.scrollWidth);
  const vis = await p.evaluate(() => { const e = document.querySelector("#jNowBox .j-cst"); return !!e && e.getBoundingClientRect().width > 1 && e.textContent; });
  report(c && vis === c.state && S.every(s => s.name.includes(s.state)) && sw <= w, `mobile ${w} px : état de l'étape actuelle visible, aucun débordement`, `${c && c.state} ; largeur ${sw}`); await p.ctx.close(); }

await browser.close();
console.log(fails ? `\n${fails} contrôle(s) en échec` : "\nLe bandeau suit le parcours et dit l'état de chaque étape.");
process.exit(fails ? 1 : 0);
