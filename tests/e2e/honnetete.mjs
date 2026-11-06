// P0-3 · Statuts et formulations honnêtes : notes d'import en français, valeurs absurdes ramenées et dites,
// pastilles de la matrice selon le niveau visé.
//   node tests/e2e/honnetete.mjs
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
async function open(view = "matrice", init = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(o => { try { if (!sessionStorage.getItem("t-init")) { sessionStorage.setItem("t-init", "1"); localStorage.setItem("lisio-welcome", "1"); for (const [k, v] of Object.entries(o)) localStorage.setItem(k, v); } } catch (e) {} }, init);
  await ctx.route(/^https?:/, r => r.abort());
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.goto(PAGE + "#" + view); await p.waitForTimeout(600); p.errs = errs; p.ctx = ctx; return p;
}

// 1. Import d'un projet aux réglages abîmés : notes lisibles, valeurs ramenées, rien en silence.
{ const p = await open("tester");
  const proj = { lisio: "project", v: 1, name: "Abîmé", colors: [{ name: "Encre", hex: "#0E1B4D" }, { name: "Sable", hex: "#F1E9DA" }], state: { size: 0, level: "AAAA", showFail: "oui" } };
  await p.setInputFiles("#prjFile", { name: "abime.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(proj)) }); await p.waitForTimeout(300);
  const t = await p.evaluate(() => document.getElementById("prjIn").textContent);
  report(!/«\s?(size|level|showFail|ts|ds|font)\b/.test(t) && !/Réglage « /.test(t), "notes d'import sans nom technique", t.slice(0, 300));
  report(/Taille du texte/.test(t) && /Niveau WCAG/.test(t) && /Affichage de la matrice/.test(t), "notes d'import : Taille du texte, Niveau WCAG, Affichage de la matrice", "");
  report(/Taille du texte hors limites \(0 px\)\s?: valeur ramenée à 10 px/.test(t), "taille 0 px : refusée et ramenée à 10 px, et c'est écrit", "");
  await p.click("[data-prj=ok]"); await p.waitForLoadState("load"); await p.waitForTimeout(600);
  const sz = await p.evaluate(() => document.getElementById("sSize").value);
  report(sz === "10", "après import, la taille appliquée est 10 px", sz);
  report(!p.errs.length, "aucune erreur JavaScript", p.errs.join(" | ")); await p.ctx.close(); }

// 2. Matrice au niveau AAA : une paire à 5,09:1 ne ressemble plus à une réussite du texte courant.
const two = JSON.stringify([{ name: "Gris", hex: "#6E6E6E" }, { name: "Blanc", hex: "#FFFFFF" }]);
for (const level of ["AA", "AAA"]) {
  const p = await open("matrice", { "lisio:colors": two, "lisio:state": JSON.stringify({ level }) });
  const r = await p.evaluate(() => {
    const c = document.querySelector('.mcell[data-i="0"][data-j="1"]') || document.querySelector(".mcell");
    return { cls: c ? [...c.classList].filter(x => x.startsWith("b-")).join() : "", lab: c ? c.querySelector(".vl").textContent : "", ratio: c ? c.querySelector(".r").textContent : "",
      counts: [...document.querySelectorAll("#counts .count span")].map(s => s.textContent), legend: [...document.querySelectorAll("#mLegend .bd, .maside .bd")].map(s => s.textContent) };
  });
  if (level === "AA") report(r.cls === "b-aa" && r.lab === "AA" && r.counts.includes("AA"), `niveau AA : ${r.ratio}:1 reste « AA »`, JSON.stringify(r));
  else report(r.cls === "b-lg" && r.lab === "AAA grand" && !r.counts.includes("AA") && !r.legend.includes("AA") && r.legend.includes("AAA grand"), `niveau AAA : ${r.ratio}:1 devient « AAA grand », compteurs et légende au niveau AAA`, JSON.stringify(r));
  report(!p.errs.length, `niveau ${level} : aucune erreur JavaScript`, p.errs.join(" | ")); await p.ctx.close(); }

await browser.close();
console.log(fails ? `\n${fails} contrôle(s) en échec` : "\nFormulations et statuts : contrôles passés.");
process.exit(fails ? 1 : 0);
