// P0-3 bis · Les cinq statuts du blueprint partout (F11, § 5.4) : Conforme au test, Échec du test,
// À vérifier manuellement, Non testé, Non applicable, avec le critère et le niveau.
//   node tests/e2e/statuts.mjs
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PAGE_FILE = process.env.LISIO_PAGE || join(ROOT, "index.html"), PAGE = "file://" + PAGE_FILE;
let chromium;
try { ({ chromium } = createRequire(import.meta.url)("playwright")); } catch (e) { console.log("IGNORÉ : Playwright introuvable."); process.exit(process.env.CI ? 1 : 0); }

const browser = await chromium.launch();
let fails = 0;
const report = (ok, label, detail = "") => { if (!ok) fails++; console.log(`${ok ? "ok   " : "ÉCHEC"} ${label}${detail ? " : " + detail : ""}`); };
const WORDS = ["Conforme au test", "Échec du test", "À vérifier manuellement", "Non testé", "Non applicable"];
// Formulations interdites par le blueprint (§ 5.4) ou à aligner (audit, § 4) ; « partiellement conforme » est une mention légale d'exemple, gardée.
const BAD = /Pas conforme|(?<!partiellement )non conforme|✓ Conforme(?! au test)|recommandent 44|brouillon WCAG 3|\bRéussi\b|accessible à 100|certifié WCAG/i;
async function open(view, init = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  await ctx.addInitScript(o => { try { if (!sessionStorage.getItem("t-init")) { sessionStorage.setItem("t-init", "1"); localStorage.clear(); localStorage.setItem("lisio-welcome", "1"); localStorage.setItem("lisio-home", "off"); localStorage.setItem("lisio-mode", "adv"); for (const [k, v] of Object.entries(o)) localStorage.setItem(k, v); } } catch (e) {} }, init);
  await ctx.route(/^https?:/, r => r.abort());
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(String(e)));
  await p.goto(PAGE + "#" + view); await p.waitForTimeout(600); p.errs = errs; p.ctx = ctx; return p;
}
const reportOf = async p => { const [dl] = await Promise.all([p.waitForEvent("download"), p.click("#repDl")]); return readFileSync(await dl.path(), "utf8"); };
const txt = h => h.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

// 1. Rapport : légende des cinq statuts, verdicts et critères avec leur niveau, rien d'affirmé au-delà des tests.
for (const level of ["AA", "AAA"]) {
  const p = await open("exporter", { "lisio:state": JSON.stringify({ level }) });
  const h = await reportOf(p), t = txt(h);
  report(WORDS.every(w => t.includes(w)), `rapport ${level} : les cinq statuts sont expliqués`, WORDS.filter(w => !t.includes(w)).join(", "));
  report(!/>\s*(Passe|Échec)\s*</.test(h) && !BAD.test(t), `rapport ${level} : plus de « Passe » ni d'« Échec » seul, aucune formulation interdite`, (t.match(BAD) || [""])[0]);
  const crit = level === "AA" ? "1.4.3" : "1.4.6";
  report(new RegExp(`critère ${crit.replace(/\./g, "\\.")}, niveau ${level}`).test(t) && /critère 1\.4\.11, niveau AA/.test(t), `rapport ${level} : chaque verdict de contraste dit son critère et son niveau (${crit}, 1.4.11)`);
  report(/conformes au test/.test(t) && !/Critères couverts par Lisio/.test(t), `rapport ${level} : compteurs « conformes au test », plus de « critères couverts »`);
  report(/Non applicable/.test(t) && /Non testé/.test(t), `rapport ${level} : rôles décoratifs « Non applicable », cases vides « Non testé »`);
  report(/n’affirme pas la conformité/.test(t) && /Périmètre/.test(t), `rapport ${level} : périmètre écrit, et pas d'affirmation de conformité globale`);
  report(!p.errs.length, `rapport ${level} : aucune erreur JavaScript`, p.errs.join(" | ")); await p.ctx.close(); }

// 2. Polices : verdict et contrôles en toutes lettres.
for (const [fg, ok] of [["#777777", false], ["#595959", true]]) {
  const p = await open("tester", { "lisio:state": JSON.stringify({ fg, bg: "#FFFFFF", size: 16, weight: 400 }) });
  const r = await p.evaluate(() => ({ badge: document.querySelector("#verdict .badge").textContent.trim(), pills: [...document.querySelectorAll("#checks .pill")].map(x => x.textContent.trim()) }));
  report(r.badge === (ok ? "✓ Conforme au test" : "✕ Échec du test"), `Polices, ${fg} sur blanc : « ${ok ? "Conforme au test" : "Échec du test"} »`, r.badge);
  report(r.pills.length > 0 && r.pills.every(x => /^(✓ Conforme au test|✕ Échec du test|! À vérifier manuellement)$/.test(x)), "Polices : chaque contrôle dit son statut en mots", r.pills.join(" | "));
  await p.ctx.close(); }

// 3. Aucune formulation interdite dans les pages, ni dans les aides « ? » du fichier.
{ const p = await open("couleurs"), bad = [];
  for (const v of ["couleurs", "palette", "tester", "styles", "systeme", "matrice", "exporter", "lisibilite", "sources", "formation"]) {
    await p.evaluate(v => { location.hash = v; }, v); await p.waitForTimeout(150);
    const m = await p.evaluate(re => { const s = document.getElementById(location.hash.slice(1)); const t = s ? s.innerText : ""; const x = t.match(new RegExp(re, "i")); return x ? x[0] : ""; }, BAD.source);
    if (m) bad.push(`${v} : « ${m} »`); }
  const file = readFileSync(PAGE_FILE, "utf8").match(/const QHELP = (\{.*?\});\n/s), q = file ? file[1] : "";
  const mq = q.match(BAD); if (mq) bad.push(`aides : « ${mq[0]} »`);
  report(q.length > 0 && !bad.length, "aucune formulation interdite dans les 10 pages et les aides", bad.join(" ; "));
  report(!p.errs.length, "pages : aucune erreur JavaScript", p.errs.join(" | ")); await p.ctx.close(); }

await browser.close();
console.log(fails ? `\n${fails} contrôle(s) en échec` : "\nCinq statuts : contrôles passés.");
process.exit(fails ? 1 : 0);
