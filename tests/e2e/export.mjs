// F12 : copie par ligne, export CSS regroupé par catégorie, variables seules, noms valides et stables.
//   node tests/e2e/export.mjs
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
const check = (cond, label, extra = "") => { if (cond) console.log("ok    " + label); else { fails++; console.log("ÉCHEC " + label + (extra ? " : " + extra : "")); } };
// Palette piège : deux « Bleu », un nom accentué avec barre oblique, une couleur nommée comme un état.
const PAL = [{ name: "Bleu", hex: "#2F6BFF" }, { name: "bleu", hex: "#1E40AF" }, { name: "Été / 2026", hex: "#F5A00B" }, { name: "Error", hex: "#B42318" }, { name: "Encre", hex: "#0D1D45" }, { name: "Blanc", hex: "#FFFFFF" }];
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true }); await ctx.route(/^https?:/, r => r.abort());
await ctx.addInitScript(p => { try { navigator.clipboard.writeText = t => { window.__copied = t; return Promise.resolve(); }; if (!sessionStorage.getItem("s")) { sessionStorage.setItem("s", "1"); localStorage.clear(); localStorage.setItem("lisio-welcome", "1"); localStorage.setItem("lisio-mode", "adv"); localStorage.setItem("lisio:colors", JSON.stringify(p)); } } catch (e) {} }, PAL);
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
await page.goto(PAGE + "#exporter"); await page.waitForTimeout(600);
const copied = () => page.evaluate(() => window.__copied || "");
// 1. Catégories.
const cats = await page.locator("#exCat button").allTextContents();
check(cats.length >= 5 && ["Couleurs (primitives)", "Rôles", "Typographie"].every(c => cats.some(x => x.startsWith(c))), "catégories du CSS proposées", cats.join(" | "));
await page.locator("#exCat button", { hasText: /^Rôles/ }).click(); await page.waitForTimeout(150);
check((await page.locator("#exCat button", { hasText: /^Rôles/ }).getAttribute("aria-pressed")) === "true", "catégorie choisie annoncée (aria-pressed)");
const row = page.locator('#exVars tr[data-var="--text-default"]').first();
check(await row.count() === 1, "variable --text-default listée dans Rôles");
const val = (await row.locator("td.v").textContent()).trim();
// 2. Copie d'une ligne, puis d'une valeur.
await row.locator("button[data-cpy=line]").click(); await page.waitForTimeout(150);
check(await copied() === `--text-default: ${val};`, "copie de la ligne exacte", await copied());
check(/copiée/i.test(await page.locator("#toast").textContent()) && (await page.locator("#toast").getAttribute("role")) === "status", "retour visible et annoncé (role=status)", await page.locator("#toast").textContent());
check(/Copié/.test(await row.locator("button[data-cpy=line]").textContent()), "le bouton confirme la copie");
await row.locator("button[data-cpy=var]").click(); await page.waitForTimeout(150);
check(await copied() === "var(--text-default)", "copie de la référence var()", await copied());
// 3. Copie d'une catégorie.
await page.click("#exCatCopy"); await page.waitForTimeout(150);
const sec = await copied();
check(/--text-default/.test(sec) && !/--font-size-/.test(sec) && /Semantic roles/.test(sec), "copie de la catégorie Rôles seule");
// 4. CSS complet : valide pour le navigateur, noms valides et uniques, stable.
await page.click("#exCss"); await page.waitForTimeout(150);
const full = await copied();
await page.click("#exCss"); await page.waitForTimeout(150);
check(await copied() === full, "export stable : deux copies identiques");
const p2 = await ctx.newPage(); await p2.setContent("<!doctype html><html><head></head><body></body></html>");
const res = await p2.evaluate(css => { const s = document.createElement("style"); s.textContent = css; document.head.appendChild(s);
  const rules = s.sheet.cssRules.length, root = [...s.sheet.cssRules].filter(r => r.selectorText === ":root"), names = root.flatMap(r => [...r.style].filter(p => p.startsWith("--")));
  const cs = getComputedStyle(document.documentElement), empty = names.filter(n => !cs.getPropertyValue(n).trim());
  return { rules, names, empty }; }, full);
check(res.rules > 20, "le navigateur lit le CSS (règles reconnues)", String(res.rules));
check(!res.empty.length, "chaque variable de :root a une valeur calculée", res.empty.slice(0, 5).join(", "));
const decl = [...full.replace(/\/\*[^]*?\*\//g, "").matchAll(/(--[^:\s]+)\s*:/g)].map(m => m[1]);
check(decl.every(n => /^--[a-z0-9]+(-[a-z0-9]+)*$/.test(n)), "tous les noms sont des identifiants CSS valides", decl.filter(n => !/^--[a-z0-9]+(-[a-z0-9]+)*$/.test(n)).slice(0, 5).join(", "));
check(["--bleu", "--bleu-2", "--ete-2026", "--error-2", "--error"].every(n => res.names.includes(n)), "doublons de noms séparés : --bleu, --bleu-2, --ete-2026, --error-2");
const prim = full.split("/* ===== 2.")[0], primNames = [...prim.matchAll(/^\s*(--[a-z0-9-]+):/gm)].map(m => m[1]);
check(primNames.length === new Set(primNames).size, "aucune primitive définie deux fois", String(primNames.length));
// 5. Variables seules.
await page.click("#exCssVars"); await page.waitForTimeout(150);
const vo = await copied();
check(/@media/.test(vo) && !/font-family:/.test(vo) && /--text-default:/.test(vo), "copie des variables seules, contexte gardé");
// 6. Téléchargement.
const [d] = await Promise.all([page.waitForEvent("download"), page.click("#exCssDl")]);
check(d.suggestedFilename() === "lisio.css" && readFileSync(await d.path(), "utf8") === full, "téléchargement de lisio.css identique au CSS copié");
if (AXE) { await page.addScriptTag({ content: readFileSync(AXE, "utf8") });
  const v = await page.evaluate(async () => (await axe.run(document.querySelector("#exCssCard"), { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] })).violations.map(x => x.id + " " + x.nodes.length));
  check(!v.length, "axe-core : aucune violation", v.join(", ")); }
check(!errors.length, "aucune erreur JavaScript", errors.join(" | "));
await browser.close();
console.log(fails ? `\n${fails} échec(s)` : "\nTous les scénarios passent.");
process.exit(fails ? 1 : 0);
