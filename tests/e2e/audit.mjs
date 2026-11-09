// Contrôles tirés de l'audit WCAG 2.2 AA du 5 novembre 2026 (défauts D1 à D6, F1, R1 à R4).
// Chaque défaut corrigé a ici un contrôle qui échoue s'il revient. C'est un contrôle PARTIEL :
// il ne remplace ni l'audit ni un essai avec un vrai lecteur d'écran.
//   node tests/e2e/audit.mjs
// Nécessite Playwright (Chromium). Sans lui, le contrôle est ignoré (code 0) et le dit.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PAGE = "file://" + (process.env.LISIO_PAGE || join(ROOT, "index.html"));
const req = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = req("playwright")); } catch (e) { console.log("IGNORÉ : Playwright introuvable."); process.exit(process.env.CI ? 1 : 0); }

const VIEWS = ["couleurs", "matrice", "palette", "tester", "styles", "systeme", "lisibilite", "sources", "exporter"];
const TITLES = { couleurs: "Couleurs", matrice: "Contrastes", palette: "Nuances", tester: "Polices", styles: "Styles de texte", systeme: "Design system", lisibilite: "Rédaction", sources: "Guide", exporter: "Exporter", formation: "S’entraîner" };
const DESK = { width: 1440, height: 900 }, MOB = { width: 390, height: 844 };
const browser = await chromium.launch();
let fails = 0;
const report = (ok, label, detail = "") => { if (!ok) fails++; console.log(`${ok ? "ok   " : "ÉCHEC"} ${label}${detail ? " : " + detail : ""}`); };
async function open(view, viewport = DESK, opts = {}) {
  const ctx = await browser.newContext({ viewport, ...opts });
  await ctx.addInitScript(() => { try { localStorage.setItem("lisio-welcome", "1"); localStorage.setItem("lisio-mode", "adv"); } catch (e) {} });
  await ctx.route(/^https?:/, r => r.abort());
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.goto(PAGE + "#" + view); await p.waitForTimeout(600); p.errs = errs; p.ctx = ctx; return p;
}
const focusDesc = p => p.evaluate(() => { const e = document.activeElement; return !e || e === document.body ? "body" : (e.id ? "#" + e.id : e.tagName.toLowerCase() + "." + String(e.className).split(" ")[0]); });

// ---------- D1 · 2.4.11 Focus non masqué : aucun arrêt clavier entièrement caché par une barre fixe ----------
for (const [dev, vp] of [["ordinateur", DESK], ["mobile", MOB], ["tablette", { width: 800, height: 1000 }]].filter(x => !process.env.D1_DEV || x[0] === process.env.D1_DEV)) for (const v of VIEWS.filter(x => !process.env.D1_VIEW || x === process.env.D1_VIEW)) {
  const p = await open(v, vp); await p.evaluate(() => { document.activeElement && document.activeElement.blur(); scrollTo(0, 0); });
  const hidden = [], seen = new Set(); let stops = 0;
  for (let i = 0; i < 260; i++) {
    await p.keyboard.press("Tab"); await p.waitForTimeout(8);
    const r = await p.evaluate(() => {
      const e = document.activeElement; if (!e || e === document.body) return null;
      const rc = e.getBoundingClientRect(); if (rc.width <= 1 || rc.height <= 1) return { skip: true, key: e.id || e.outerHTML.slice(0, 60) };
      // Barres qui restent à l'écran (fixes ou collantes), hors de l'élément lui-même et hors de ses parents.
      const bars = [...document.querySelectorAll("body *")].filter(b => { const cs = getComputedStyle(b); return (cs.position === "fixed" || cs.position === "sticky") && b.offsetParent !== undefined && cs.visibility !== "hidden" && cs.display !== "none" && !b.contains(e) && !e.contains(b) && b.getClientRects().length; });
      let vis = 0, tot = 0, by = ""; const L = Math.max(rc.left, 0), R = Math.min(rc.right, innerWidth), T = Math.max(rc.top, 0), B = Math.min(rc.bottom, innerHeight); // partie dans l'écran
      for (let a = 1; a < 5; a++) for (let c = 1; c < 5; c++) {
        const x = L + (R - L) * a / 5, y = T + (B - T) * c / 5; tot++;
        if (R <= L || B <= T) continue; // entièrement hors de l'écran
        const t = document.elementFromPoint(x, y); if (!t) continue;
        let cover = t; while (cover && !bars.includes(cover)) cover = cover.parentElement; if (!cover) { vis++; continue; } // la barre la plus proche du point
        const br = cover.getBoundingClientRect(); if (x < br.left || x > br.right || y < br.top || y > br.bottom) vis++; else by = cover.id || cover.className; // remplissage décoratif hors de la boîte
      }
      const name = (e.getAttribute("aria-label") || e.innerText || e.placeholder || e.id || "").trim().replace(/\s+/g, " ").slice(0, 40);
      return { key: (e.id || "") + "|" + name + "|" + Math.round(rc.top + scrollY) + "|" + Math.round(rc.left), name, vis, top: Math.round(rc.top), by };
    });
    if (!r) continue; if (seen.has(r.key)) break; seen.add(r.key); if (r.skip) continue;
    stops++; if (r.vis === 0 && !/^Aller au contenu/.test(r.name)) hidden.push(r.name + (r.by ? " (sous " + r.by + ")" : ""));
  }
  report(!hidden.length, `D1 focus visible ${dev} #${v} (${stops} arrêts)`, hidden.length ? `${hidden.length} masqué(s) : ${hidden.slice(0, 4).join(" ; ")}` : "");
  await p.ctx.close();
}

if (process.env.D1_ONLY) { await browser.close(); process.exit(fails ? 1 : 0); }

// ---------- D2 · 2.4.3 Ordre du focus : fenêtres, recherche, aide ----------
const POPS = [["matrice", DESK, "#normChip", "#popNorm"], ["tester", DESK, "#dFont", "#popFont"], ["tester", DESK, "#dFg", "#popColor"], ["tester", DESK, "#dMore", "#popMore"],
  ["styles", DESK, "[data-pop=popFont][data-target=head]", "#popFont"], ["matrice", MOB, "#normChip", "#popNorm"], ["tester", MOB, "#dFont", "#popFont"]];
for (const [v, vp, trig, pop] of POPS) {
  const p = await open(v, vp), lab = `D2 ${trig} ${vp === MOB ? "mobile" : "ordinateur"}`;
  await p.focus(trig); await p.keyboard.press("Enter"); await p.waitForTimeout(150);
  const inside = () => p.evaluate(s => !!document.activeElement.closest(s), pop);
  const bad = [];
  if (!await inside()) bad.push("à l'ouverture, le focus reste hors de la fenêtre (" + await focusDesc(p) + ")");
  for (let i = 0; i < 30; i++) { await p.keyboard.press("Tab"); if (!await inside()) { bad.push("Tab sort de la fenêtre vers " + await focusDesc(p)); break; } }
  for (let i = 0; i < 3; i++) { await p.keyboard.press("Shift+Tab"); if (!await inside()) { bad.push("Maj+Tab sort de la fenêtre"); break; } }
  await p.keyboard.press("Escape"); await p.waitForTimeout(100);
  if (!await p.evaluate(([t, s]) => document.activeElement === document.querySelector(t) && document.querySelector(s).hidden, [trig, pop])) bad.push("Échap ne rend pas le focus au bouton (" + await focusDesc(p) + ")");
  await p.focus(trig); await p.keyboard.press("Enter"); await p.waitForTimeout(100);
  await p.evaluate(s => document.querySelector(s + " [data-close]").focus(), pop); await p.keyboard.press("Enter"); await p.waitForTimeout(100);
  if (!await p.evaluate(t => document.activeElement === document.querySelector(t), trig)) bad.push("le bouton Fermer ne rend pas le focus (" + await focusDesc(p) + ")");
  report(!bad.length, lab, bad.join(" ; ")); await p.ctx.close();
}
{ // ⌘K puis Échap : le focus revient d'où il venait.
  const p = await open("matrice"); await p.focus("#normChip"); await p.keyboard.press("Control+k"); await p.waitForTimeout(100);
  const inQ = await p.evaluate(() => document.activeElement.id === "cmdQ");
  await p.keyboard.press("Escape"); await p.waitForTimeout(150);
  report(inQ && await focusDesc(p) === "#normChip", "D2 recherche ⌘K puis Échap rend le focus", inQ ? await focusDesc(p) : "le champ n'a pas reçu le focus"); await p.ctx.close();
  const m = await open("matrice", MOB); await m.focus("#cmdMB"); await m.keyboard.press("Enter"); await m.waitForTimeout(150);
  const inM = await m.evaluate(() => document.activeElement.id === "cmdQ"); await m.keyboard.press("Escape"); await m.waitForTimeout(150);
  report(inM && await focusDesc(m) === "#cmdMB", "D2 recherche mobile puis Échap rend le focus", inM ? await focusDesc(m) : "le champ n'a pas reçu le focus"); await m.ctx.close();
}
{ // R4 : l'aide se ferme quand le focus la quitte au clavier.
  const p = await open("matrice"); await p.focus("#helpB"); await p.keyboard.press("Enter"); await p.waitForTimeout(150);
  const n = await p.evaluate(() => document.querySelectorAll("#helpPop a[href], #helpPop button").length);
  await p.keyboard.press("Tab"); const entered = await p.evaluate(() => !!document.activeElement.closest("#helpPop"));
  for (let i = 0; i < n + 1; i++) await p.keyboard.press("Tab");
  const st = await p.evaluate(() => ({ open: !document.getElementById("helpPop").hidden, body: document.activeElement === document.body }));
  report(entered && !st.open && !st.body, "R4 aide : Tab y entre, puis la ferme en sortant", `entrée ${entered}, encore ouverte ${st.open}, focus perdu ${st.body}`); await p.ctx.close();
}

// ---------- D3 · 1.3.1 et 4.1.2 : liste des polices sans rôles ARIA incohérents ----------
{ const p = await open("tester"); await p.focus("#dFont"); await p.keyboard.press("Enter"); await p.waitForTimeout(200);
  const r = await p.evaluate(() => { const L = document.getElementById("fontList"), bad = [];
    if (L.getAttribute("role") === "listbox") { if ([...L.children].some(c => !["option", "group", "none", "presentation"].includes(c.getAttribute("role")))) bad.push("listbox avec des enfants qui ne sont pas des options"); }
    if (L.querySelector("[role=option]") && L.getAttribute("role") !== "listbox" && !L.querySelector("[role=listbox]")) bad.push("options hors d'une listbox");
    const sel = L.querySelectorAll("[aria-selected=true],[aria-current=true]").length; return { bad, sel, n: L.querySelectorAll("button").length }; });
  report(!r.bad.length && r.sel === 1 && r.n > 10, "D3 liste des polices", r.bad.join(" ; ") || `${r.n} polices, ${r.sel} marquée(s) comme choisie`); await p.ctx.close(); }

// ---------- D4 · 2.5.3 Étiquette dans le nom ----------
for (const v of VIEWS) {
  const p = await open(v);
  const bad = await p.evaluate(() => {
    const norm = s => s.toLowerCase().normalize("NFC").replace(/[^\p{L}\p{N}]+/gu, "");
    const visText = el => { let t = ""; const walk = n => { if (n.nodeType === 3) { t += n.textContent + " "; return; } if (n.nodeType !== 1 || n.getAttribute("aria-hidden") === "true") return; const cs = getComputedStyle(n); if (cs.display === "none" || cs.visibility === "hidden" || (n.matches(".sr,.sr-only"))) return; n.childNodes.forEach(walk); }; walk(el); return t; };
    return [...document.querySelectorAll("button[aria-label], a[aria-label], [role=tab][aria-label], [role=button][aria-label], input[type=button][aria-label]")]
      .filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== "hidden" && !e.closest("[hidden],[aria-hidden=true],iframe"))
      .map(e => [e, norm(visText(e))]).filter(([e, vt]) => vt && !norm(e.getAttribute("aria-label")).includes(vt))
      .map(([e, vt]) => `${e.id ? "#" + e.id : e.className.split(" ")[0]} « ${visText(e).trim().replace(/\s+/g, " ").slice(0, 24)} » / « ${e.getAttribute("aria-label").slice(0, 40)} »`);
  });
  report(!bad.length, `D4 étiquette dans le nom #${v}`, bad.length ? `${bad.length} : ${[...new Set(bad)].slice(0, 3).join(" ; ")}` : ""); await p.ctx.close();
}

// ---------- D5 · 1.4.11 et D6 · 1.4.3 : bord des champs et textes indicatifs, clair et sombre ----------
for (const scheme of ["light", "dark"]) {
  const lowPh = [], lowBd = [];
  for (const v of VIEWS) {
    const p = await open(v, DESK, { colorScheme: scheme });
    const r = await p.evaluate(() => {
      const parse = c => (c.match(/[\d.]+/g) || [0, 0, 0, 0]).map(Number);
      const L = c => { const f = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
      const cr = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
      const bgOf = e => { while (e && e !== document.documentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c.length < 4 || c[3] > 0.9) return c; e = e.parentElement; } return parse(getComputedStyle(document.body).backgroundColor); };
      const mix = (c, bg) => { const a = c[3] === undefined ? 1 : c[3]; return [0, 1, 2].map(i => c[i] * a + bg[i] * (1 - a)); };
      const ph = [...document.querySelectorAll("input[placeholder], textarea[placeholder]")].filter(e => e.offsetParent && e.placeholder)
        .map(e => { const bg = bgOf(e); return [e.id || e.className, cr(mix(parse(getComputedStyle(e, "::placeholder").color), bg), bg)]; }).filter(x => x[1] < 4.5);
      // Bord d'un champ de saisie : le bord, ou à défaut le fond, se détache à 3:1 de ce qui l'entoure (1.4.11).
      const fields = [...document.querySelectorAll(".cmdk, input[type=text]:not(.cmdk input), input[type=search], input:not([type]), textarea, select")].filter(e => e.offsetParent && e.getBoundingClientRect().width > 40);
      const bd = fields.map(e => { const cs = getComputedStyle(e), out = bgOf(e.parentElement), w = parseFloat(cs.borderTopWidth) || 0;
        const edge = w >= 1 && cs.borderTopStyle !== "none" ? cr(mix(parse(cs.borderTopColor), out), out) : 0; const fill = cr(bgOf(e), out); return [e.id || e.className, Math.max(edge, fill)]; }).filter(x => x[1] < 3);
      return { ph, bd };
    });
    r.ph.forEach(x => lowPh.push(`${v} ${x[0]} ${x[1].toFixed(2)}`)); r.bd.forEach(x => lowBd.push(`${v} ${x[0]} ${x[1].toFixed(2)}`)); await p.ctx.close();
  }
  report(!lowPh.length, `D6 texte indicatif à 4,5:1 (${scheme === "dark" ? "sombre" : "clair"})`, [...new Set(lowPh)].slice(0, 4).join(" ; "));
  report(!lowBd.length, `D5 bord des champs à 3:1 (${scheme === "dark" ? "sombre" : "clair"})`, [...new Set(lowBd)].slice(0, 4).join(" ; "));
}

// ---------- F1 : un ratio affiché ne dépasse jamais le calcul, et le nom accessible dit la même valeur ----------
{ const p = await open("tester");
  const r = await p.evaluate(() => [...document.querySelectorAll("#sheet .tile")].slice(0, 400).map(t => [t.querySelector(".pill").textContent.trim(), t.getAttribute("aria-label")]));
  const bad = r.filter(([pill, lab]) => !lab.includes(pill + " pour 1")).map(x => x.join(" / "));
  report(r.length > 5 && !bad.length, `F1 pastilles des combinaisons (${r.length})`, bad.slice(0, 3).join(" ; ")); await p.ctx.close(); }
{ const p = await open("palette");
  const bad = await p.evaluate(() => [...document.querySelectorAll("#scales .swt")].filter(b => { const m = b.title.match(/([\d,]+):1 sur blanc · ([\d,]+):1 sur noir/), a = b.getAttribute("aria-label").match(/([\d,]+) pour 1 sur blanc, ([\d,]+) pour 1 sur noir/);
    if (!m || !a) return true; const n = s => Number(s.replace(",", ".")); return n(m[1]) > n(a[1]) || n(m[2]) > n(a[2]); }).map(b => b.title));
  report(!bad.length, "F1 info-bulles des nuances tronquées", bad.slice(0, 3).join(" ; ")); await p.ctx.close(); }

// ---------- R1 : erreur de saisie liée au champ, messages lisibles au moins 5 s ----------
{ const p = await open("couleurs"); // P0-4 : la saisie des couleurs a sa page, Couleurs.
  await p.fill("#ph0", "#12"); await p.press("#ph0", "Tab"); await p.waitForTimeout(150);
  const e1 = await p.evaluate(() => { const f = document.getElementById("ph0"), d = document.getElementById(f.getAttribute("aria-describedby") || "-");
    return { inv: f.getAttribute("aria-invalid"), msg: d && d.offsetParent ? d.textContent.trim() : "", val: f.value }; });
  await p.fill("#ph0", "#123456"); await p.press("#ph0", "Tab"); await p.waitForTimeout(150);
  const e2 = await p.evaluate(() => { const f = document.getElementById("ph0"); return { inv: f.getAttribute("aria-invalid"), d: f.getAttribute("aria-describedby") }; });
  report(e1.inv === "true" && /hexad/i.test(e1.msg) && e1.val === "#12" && e2.inv !== "true" && !e2.d, "R1 code couleur invalide signalé sur le champ", JSON.stringify([e1, e2]));
  await p.evaluate(() => document.activeElement.blur()); await p.keyboard.press("Control+z"); await p.waitForTimeout(4500); // « Rien à annuler » ou « Modification annulée »
  report(await p.evaluate(() => document.getElementById("toast").classList.contains("show")), "R1 message encore visible après 4,5 s"); await p.ctx.close(); }

// ---------- R2 · 2.4.2 Titre de page, R3 · titres : un h1 par vue, en premier ----------
for (const v of [...VIEWS, "formation"]) {
  const p = await open(v);
  const r = await p.evaluate(() => { const hs = [...document.querySelectorAll("main h1, main h2, main h3, main [role=heading]")].filter(h => h.getClientRects().length && !h.closest("[hidden]") && (h.offsetParent || h.matches(".sr,.sr-only")));
    return { title: document.title, first: hs[0] ? hs[0].tagName + " " + hs[0].textContent.trim() : "", h1: hs.filter(h => h.tagName === "H1").map(h => h.textContent.trim()) }; });
  const bad = [];
  if (r.title !== TITLES[v] + " · Lisio") bad.push(`titre « ${r.title} »`);
  if (r.h1.length !== 1 || !r.first.startsWith("H1")) bad.push(`titres : premier ${r.first.slice(0, 30)}, h1 ${JSON.stringify(r.h1)}`);
  report(!bad.length, `R2 R3 #${v}`, bad.join(" ; ")); await p.ctx.close();
}

// ---------- R4 : en contraste forcé (Windows), les échantillons gardent leur couleur ----------
for (const v of ["couleurs", "matrice", "palette", "tester", "systeme"]) {
  const p = await open(v, DESK, { forcedColors: "active" });
  const bad = await p.evaluate(() => [...document.querySelectorAll("main [style*='background:#'], main [style*='background: #'], main .swc, main .disc, main .sw, #palChips i")]
    .filter(e => e.getClientRects().length && !e.closest("iframe"))
    .filter(e => { let x = e; while (x) { if (getComputedStyle(x).forcedColorAdjust === "none") return false; x = x.parentElement; } return true; })
    .map(e => e.className.split(" ")[0] || e.tagName.toLowerCase()));
  report(!bad.length, `R4 couleurs forcées #${v}`, bad.length ? `${bad.length} échantillon(s) effacé(s) : ${[...new Set(bad)].slice(0, 5).join(", ")}` : ""); await p.ctx.close();
}

await browser.close();
console.log(fails ? `\n${fails} contrôle(s) en échec` : "\nTous les contrôles de l'audit passent (contrôle partiel, pas un audit).");
process.exit(fails ? 1 : 0);
