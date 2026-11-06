// Contrastes : toujours une grille texte (lignes) sur fond (colonnes), aussi sur mobile et avec 12 couleurs.
// La grille compacte défile dans son cadre, jamais la page ; la colonne des noms reste visible.
//   node tests/e2e/grille.mjs
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PAGE = "file://" + (process.env.LISIO_PAGE || join(ROOT, "index.html"));
let chromium, devices;
try { ({ chromium, devices } = createRequire(import.meta.url)("playwright")); } catch (e) { console.log("IGNORÉ : Playwright introuvable."); process.exit(process.env.CI ? 1 : 0); }
const AXE = process.env.AXE_PATH;
const browser = await chromium.launch();
let fails = 0;
const check = (cond, label, extra = "") => { if (cond) console.log("ok    " + label); else { fails++; console.log("ÉCHEC " + label + (extra ? " : " + extra : "")); } };
const SEED = join(tmpdir(), "lisio-seed-grille.html"); writeFileSync(SEED, "<!doctype html><title>seed</title>");
const TWELVE = ["#0E1B4D", "#2447D1", "#F5B800", "#0D1535", "#F1F4FB", "#FFFFFF", "#C8553D", "#1F7A5C", "#6B4BC8", "#E8EEF8", "#3A3F47", "#FF8FA3"].map((hex, i) => ({ name: "Couleur " + (i + 1), hex }));
async function open(opts, colors) {
  const ctx = await browser.newContext(opts); await ctx.route(/^https?:/, r => r.abort());
  const page = await ctx.newPage(); page.errors = []; page.on("pageerror", e => page.errors.push(String(e)));
  await page.goto("file://" + SEED); await page.evaluate(c => { localStorage.clear(); localStorage.setItem("lisio-welcome", "1"); localStorage.setItem("lisio-mode", "ess"); if (c) localStorage.setItem("lisio:colors", JSON.stringify(c)); }, colors || null);
  await page.goto(PAGE + "#matrice"); await page.waitForTimeout(800); return { ctx, page };
}
const shape = page => page.evaluate(() => { const g = document.getElementById("mgrid"), w = g.parentElement;
  return { cls: g.className, cells: g.querySelectorAll(".mcell").length, cols: g.querySelectorAll(".mcol").length, rows: g.querySelectorAll(".mrow").length, groups: g.querySelectorAll(".mgroup").length,
    pageOver: document.documentElement.scrollWidth - innerWidth, wrapOver: w.scrollWidth - w.clientWidth, sticky: g.querySelector(".mrow") ? getComputedStyle(g.querySelector(".mrow")).position : "",
    rowLeft: g.querySelector(".mrow") ? Math.round(g.querySelector(".mrow").getBoundingClientRect().left) : -1, wrapLeft: Math.round(w.getBoundingClientRect().left) }; });
for (const [lab, opts] of [["iPhone 390 px", { ...devices["iPhone 13"] }], ["320 px", { viewport: { width: 320, height: 700 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 }]]) {
  const { ctx, page } = await open(opts);
  const s = await shape(page);
  check(/\bmgrid\b/.test(s.cls) && !s.groups, `${lab}, 6 couleurs : une grille, pas une liste par fond`, JSON.stringify(s));
  check(s.cells === 30 && s.cols === 6 && s.rows === 6, `${lab} : 6 lignes de texte, 6 colonnes de fond, 30 paires`, JSON.stringify(s));
  check(s.pageOver <= 0, `${lab} : la page ne déborde pas`, s.pageOver);
  const cell = page.locator('.mcell[data-i="0"][data-j="1"]');
  check(/sur/.test(await cell.getAttribute("aria-label")), `${lab} : chaque case dit « texte sur fond » et son ratio`, await cell.getAttribute("aria-label"));
  const sz = await cell.boundingBox(); check(sz.width >= 44 && sz.height >= 44, `${lab} : cases d’au moins 44 × 44 px`, JSON.stringify(sz));
  await cell.click(); await page.waitForTimeout(400);
  check(await page.locator("#pairDetail").isVisible(), `${lab} : toucher une case ouvre le détail de la paire`);
  // Les échantillons « Aa » montrent exprès des paires qui échouent (masqués aux lecteurs d’écran, verdict écrit) : hors axe, comme dans a11y.mjs.
  if (AXE && lab === "iPhone 390 px") { await page.addScriptTag({ content: readFileSync(AXE, "utf8") });
    const v = await page.evaluate(async () => (await axe.run({ include: [[".mwrap"]], exclude: [[".mcell .sample"]] }, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] })).violations.map(x => x.id + " " + x.nodes.length));
    check(!v.length, `${lab} : axe-core, aucune violation dans la grille`, v.join(", ")); }
  check(!page.errors.length, `${lab} : aucune erreur JavaScript`, page.errors.join(" | "));
  await ctx.close();
}
{ const { ctx, page } = await open({ ...devices["iPhone 13"] }, TWELVE);
  const s = await shape(page);
  check(/\bmgrid\b/.test(s.cls) && s.cells === 132, "iPhone, 12 couleurs : toujours une grille complète (132 paires)", JSON.stringify(s));
  check(s.pageOver <= 0 && s.wrapOver > 0, "12 couleurs : la grille défile dans son cadre, pas la page", JSON.stringify(s));
  await page.evaluate(() => { document.getElementById("mgrid").parentElement.scrollLeft = 400; }); await page.waitForTimeout(200);
  const s2 = await shape(page);
  check(s2.sticky === "sticky" && Math.abs(s2.rowLeft - s2.wrapLeft) < 30, "en faisant défiler, la colonne des noms de texte reste visible", JSON.stringify(s2));
  check(!page.errors.length, "12 couleurs : aucune erreur JavaScript", page.errors.join(" | "));
  await ctx.close(); }
{ const { ctx, page } = await open({ viewport: { width: 900, height: 900 } }, TWELVE);
  const s = await shape(page);
  check(/\bmgrid\b/.test(s.cls) && !s.groups && s.pageOver <= 0, "ordinateur étroit, 12 couleurs : une grille aussi", JSON.stringify(s));
  await ctx.close(); }
{ const { ctx, page } = await open({ viewport: { width: 1280, height: 900 } });
  const s = await shape(page);
  check(s.cls === "mgrid" && s.cells === 30, "ordinateur, 6 couleurs : la grande grille d’avant, inchangée", JSON.stringify(s));
  await ctx.close(); }
await browser.close();
console.log(fails ? `\n${fails} échec(s)` : "\nTous les scénarios passent.");
process.exit(fails ? 1 : 0);
