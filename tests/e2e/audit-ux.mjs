// Corrections de l’audit UX et UI du 11 novembre 2026 (P1 à P3), plus le retour de Laurent du même soir :
// sélecteurs à la largeur de leur contenu, et du mouvement (l’option choisie glisse).
//   node tests/e2e/audit-ux.mjs
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PAGE = "file://" + (process.env.LISIO_PAGE || join(ROOT, "index.html"));
let chromium;
try { ({ chromium } = createRequire(import.meta.url)("playwright")); } catch (e) { console.log("IGNORÉ : Playwright introuvable."); process.exit(process.env.CI ? 1 : 0); }
const browser = await chromium.launch();
let fails = 0;
const check = (ok, label, detail = "") => { if (!ok) fails++; console.log(`${ok ? "ok   " : "ÉCHEC"} ${label}${detail ? " : " + detail : ""}`); };
async function open(opts, view = "couleurs", init = {}) {
  const ctx = await browser.newContext(opts);
  await ctx.addInitScript(o => { try { if (!sessionStorage.getItem("t-init")) { sessionStorage.setItem("t-init", "1"); localStorage.setItem("lisio-welcome", "1"); for (const [k, v] of Object.entries(o)) localStorage.setItem(k, v); } } catch (e) {} }, init);
  await ctx.route(/^https?:/, r => r.abort());
  const p = await ctx.newPage(); p.errs = []; p.on("pageerror", e => p.errs.push(String(e)));
  await p.goto(PAGE + "#" + view); await p.waitForFunction(() => window.__lisioReady === true); await p.waitForTimeout(400); p.ctx = ctx; return p;
}
const go = async (p, v) => { await p.evaluate(v => { location.hash = v; }, v); await p.waitForTimeout(350); };
const h1Top = p => p.evaluate(() => { const h = [...document.querySelectorAll("#main h1")].find(e => e.getClientRects().length && e.getBoundingClientRect().width > 2); return h ? Math.round(h.getBoundingClientRect().top) : -1; });

// ---------- Lot 1 : en-tête plus court, barre de Polices au-dessus de l’aperçu ----------
{ const p = await open({ viewport: { width: 1440, height: 900 } });
  for (const v of ["couleurs", "tester", "matrice", "exporter"]) { await go(p, v); await p.evaluate(() => scrollTo(0, 0)); const t = await h1Top(p);
    check(t > 0 && t <= 260, `ordinateur, ${v} : le titre visible commence avant 260 px (371 avant l’audit)`, String(t)); }
  check(await p.evaluate(() => !!document.querySelector("#jNowBox .j-line #sumBar")), "le résumé du projet est dans la ligne de l’étape");
  await go(p, "tester");
  const d = await p.evaluate(() => { const s = document.querySelector("#tester .stage").getBoundingClientRect(), k = document.getElementById("dockIn").getBoundingClientRect(); return { kb: Math.round(k.bottom), st: Math.round(s.top) }; });
  check(d.kb <= d.st, "Polices : la barre de réglages est au-dessus de l’aperçu, sans le recouvrir", JSON.stringify(d));
  await p.ctx.close(); }
{ const p = await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const t = await h1Top(p); check(t > 0 && t <= 320, "mobile : le titre commence avant 320 px (401 avant l’audit)", String(t));
  await p.ctx.close(); }

// ---------- Lot 2 : Exporter en trois parties, doublons retirés ----------
{ const p = await open({ viewport: { width: 1440, height: 900 } }, "exporter");
  const tabs = await p.evaluate(() => [...document.querySelectorAll('#exporter [role="tab"]')].map(t => t.textContent.trim()));
  check(tabs.join("|") === "Livrer|Vérifier à la main|Historique", "Exporter : trois onglets", tabs.join("|"));
  check(await p.locator("#exPanDeliver").isVisible() && await p.locator("#exPanHist").isHidden(), "Livrer est ouvert d’abord, Historique fermé");
  await p.focus("#exTabDeliver"); await p.keyboard.press("ArrowRight"); await p.keyboard.press("ArrowRight"); await p.waitForTimeout(150);
  check(await p.evaluate(() => document.activeElement.id) === "exTabHist" && await p.locator("#verCard").isVisible(), "flèches du clavier : on passe d’un onglet à l’autre ; Historique montre les versions");
  await p.click("#helpB"); await p.waitForTimeout(200);
  check(!(await p.locator("#modeSeg").isVisible()), "Outils ne répète pas Essentiel / Avancé sur ordinateur");
  check(!(await p.evaluate(() => [...document.querySelectorAll("#helpPop a")].some(a => /\/slides$/.test(a.href)))), "Outils : plus de lien Slides en double du guide");
  await p.ctx.close(); }

// ---------- Lot 3 : textes, cibles, accueil, états ----------
{ const p = await open({ viewport: { width: 1440, height: 900 } }, "matrice");
  const small = await p.evaluate(() => { const out = []; for (const e of document.querySelectorAll("#main *, .appbar *, #journey *")) { if (!e.getClientRects().length || e.closest("svg,iframe,.sr-only,.sr")) continue; if (![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue; const r = e.getBoundingClientRect(); if (r.width <= 1 || r.height <= 1) continue; if (parseFloat(getComputedStyle(e).fontSize) < 12) out.push(e.className || e.tagName); } return out; });
  check(!small.length, "Contrastes : aucun texte sous 12 px", small.slice(0, 5).join(", "));
  const cell = await p.evaluate(() => { const c = document.querySelector(".mcell.b-no"); return c ? getComputedStyle(c).backgroundColor : ""; });
  check(cell === await p.evaluate(() => getComputedStyle(document.querySelector(".card-surface")).backgroundColor), "matrice : cases blanches, le verdict est dans la pastille", cell);
  await go(p, "exporter"); await p.click("#exTabCheck"); await p.waitForTimeout(200);
  const cb = await p.evaluate(() => [...document.querySelectorAll("#exManual input[type=checkbox]")].filter(e => e.getClientRects().length).map(e => Math.round(e.getBoundingClientRect().width)));
  check(cb.length > 0 && cb.every(w => w >= 24), "cases à cocher de 24 px au moins", [...new Set(cb)].join(", "));
  await p.ctx.close(); }
{ const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }); await ctx.route(/^https?:/, r => r.abort());
  const p = await ctx.newPage(); await p.goto(PAGE + "#couleurs"); await p.waitForFunction(() => window.__lisioReady === true); await p.waitForTimeout(300);
  const b = await p.evaluate(() => [...document.querySelectorAll("#hello [data-hello]")].map(x => x.textContent.trim()));
  check(b.join("|") === "Créer mon projet|Essayer avec un projet démo|Fermer", "accueil : deux choix et « Fermer »", b.join("|"));
  await ctx.close(); }
{ const p = await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, "styles");
  const cut = await p.evaluate(() => [...document.querySelectorAll("#stepNav .sn-t")].filter(e => e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1).map(e => e.textContent));
  check(!cut.length, "mobile : noms d’étapes entiers dans la barre du bas", cut.join(" | "));
  await go(p, "exporter"); check(/guide/i.test(await p.evaluate(() => document.getElementById("stepNav").textContent)), "mobile, dernière étape : « Lire le guide »");
  await p.ctx.close(); }

// ---------- Lot 4 : recherche par teinte, correction qui respecte la couleur ----------
{ const p = await open({ viewport: { width: 1440, height: 900 } }, "couleurs", { "lisio:colors": JSON.stringify([{ name: "Marine", hex: "#0E1B4D" }, { name: "Roi", hex: "#2447D1" }, { name: "Blanc", hex: "#FFFFFF" }]) });
  await p.click(".cmdk"); await p.keyboard.type("bleu"); await p.waitForTimeout(300);
  const found = await p.evaluate(() => document.querySelector("#cmdk") ? document.querySelector("#cmdk").textContent : document.body.textContent);
  check(/Marine/.test(found) && /Roi/.test(found), "recherche : « bleu » trouve les deux bleus de la palette");
  await p.keyboard.press("Escape"); await go(p, "matrice");
  await p.click('.mcell[data-i="0"][data-j="1"]'); await p.waitForTimeout(300);
  const why = await p.textContent("#pairDetail .pd-why");
  check(/Roi/.test(why) && /change le moins/.test(why), "correction : on éclaircit Roi plutôt que de passer Marine en bleu ciel", why.trim().slice(0, 90));
  await p.ctx.close(); }

// ---------- Retour de Laurent, 20 h 38 : largeur des sélecteurs, mouvement ----------
{ const p = await open({ viewport: { width: 1440, height: 900 } }, "palette", { "lisio-mode": "adv" });
  const w = await p.evaluate(() => { const s = document.getElementById("shMeth"); return { s: s.offsetWidth, row: s.parentElement.offsetWidth, sum: [...s.querySelectorAll("button")].reduce((n, b) => n + b.offsetWidth, 0) }; });
  check(w.s <= w.sum + 4 && w.s < w.row / 2, "« Par contraste / Perceptuelle » : le sélecteur a la largeur de ses boutons", JSON.stringify(w));
  await p.click('#shMeth [data-v="oklch"]'); await p.waitForTimeout(450);
  const ind = await p.evaluate(() => { const s = document.getElementById("shMeth"), i = s.querySelector(".seg-ind"), on = s.querySelector('[aria-pressed="true"]'); return i ? { t: i.style.transform, l: on.offsetLeft, w: parseFloat(i.style.width), bw: on.offsetWidth, tr: getComputedStyle(i).transitionDuration } : null; });
  check(!!ind && ind.t.includes(`${ind.l}px`) && Math.abs(ind.w - ind.bw) < 1, "l’option choisie : la pastille noire a glissé sous le bouton pressé", JSON.stringify(ind));
  check(!!ind && parseFloat(ind.tr) > 0, "elle glisse (transition)", ind && ind.tr);
  check(!p.errs.length, "aucune erreur JavaScript", p.errs.join(" | "));
  await p.ctx.close(); }
{ const p = await open({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" }, "palette", { "lisio-mode": "adv" });
  const r = await p.evaluate(() => ({ ind: getComputedStyle(document.querySelector("#shMeth .seg-ind")).transitionDuration, sec: getComputedStyle(document.getElementById("palette")).animationName }));
  check(parseFloat(r.ind) === 0 && r.sec === "none", "moins d’animations demandé : rien ne glisse ni n’apparaît en fondu (2.3.3)", JSON.stringify(r));
  await p.ctx.close(); }

await browser.close();
console.log(fails ? `\n${fails} échec(s).` : "\nTous les contrôles passent.");
process.exit(fails ? 1 : 0);
