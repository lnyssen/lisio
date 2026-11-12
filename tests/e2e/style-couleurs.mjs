// Une couleur par style de texte : choisie parmi la palette, vérifiée style par style, exportée dans la classe .t-.
//   node tests/e2e/style-couleurs.mjs
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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
const SEED = join(tmpdir(), "lisio-seed-stcol.html"); writeFileSync(SEED, "<!doctype html><title>seed</title>");
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); await ctx.route(/^https?:/, r => r.abort());
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
await page.goto("file://" + SEED);
await page.evaluate(() => { localStorage.clear(); localStorage.setItem("lisio-welcome", "1"); localStorage.setItem("lisio-home", "off"); localStorage.setItem("lisio-mode", "ess"); localStorage.setItem("lisio:colors", JSON.stringify([{ name: "Bleu", hex: "#2F6BFF" }, { name: "Gris", hex: "#8A8F98" }, { name: "Blanc", hex: "#FFFFFF" }])); });
await page.goto(PAGE + "#styles"); await page.waitForTimeout(700);
const row = id => page.locator(`#tsList .ts-row[data-id="${id}"]`);
const ids = await page.evaluate(() => [...document.querySelectorAll("#tsList .ts-row")].map(r => r.dataset.id));
const id = ids.includes("caption") ? "caption" : ids[ids.length - 1], head = ids[0];
check(await row(id).locator("select[data-k=color]").count() === 1, "chaque style a un choix de couleur");
check(await row(id).locator(".cp-btn").isVisible(), "le choix de couleur est visible en affichage Essentiel");
const st0 = await page.evaluate(() => JSON.parse(localStorage.getItem("lisio:state")) || {});
check(!(st0.ts && st0.ts.styles && st0.ts.styles.some(s => s.color)), "par défaut, aucun style n’a de couleur propre (texte principal)");
const css0 = await page.evaluate(() => document.getElementById("tsOut") ? document.getElementById("tsOut").textContent : "");
// Choisir une couleur claire pour un style : le verdict de ce style seulement change.
const pick = async (sid, hex) => { await page.evaluate(([sid, hex]) => { const s = document.querySelector(`#tsList .ts-row[data-id="${sid}"] select[data-k=color]`); s.value = hex; s.dispatchEvent(new Event("change", { bubbles: true })); }, [sid, hex]); await page.waitForTimeout(300); };
const light = await page.evaluate(() => [...document.querySelectorAll('#tsList select[data-k=color] option')].map(o => o.value).find(v => /^#/.test(v) && v !== "#FFFFFF" && v !== "#000000" && (() => { const n = parseInt(v.slice(1), 16); return ((n >> 16) & 255) > 200 && ((n >> 8) & 255) > 200; })()));
await pick(id, light);
check(/✕/.test(await row(id).locator(".ts-meta").textContent()), "couleur trop claire : le style passe en échec, avec son ratio", await row(id).locator(".ts-meta").textContent());
check(!/✕/.test(await row(head).locator(".ts-meta").textContent()), "les autres styles ne changent pas");
const spec = await row(id).locator(".ts-spec").evaluate(e => getComputedStyle(e).color);
check(/rgb/.test(spec) && spec !== "rgb(0, 0, 0)", "l’aperçu du style prend sa couleur", spec);
// Correcteur (8 novembre 2026) : le style en échec propose la nuance la plus proche qui passe, en un clic.
const fixB = row(id).locator(".ts-fix");
check(await fixB.count() === 1 && /Corriger/.test(await fixB.textContent()), "style en échec : bouton « Corriger » dans sa ligne", await row(id).locator(".ts-meta").textContent());
await fixB.click(); await page.waitForTimeout(400);
check(/✓/.test(await row(id).locator(".ts-meta").textContent()), "après « Corriger », le style passe le test", await row(id).locator(".ts-meta").textContent());
const fixed = await page.evaluate(i => JSON.parse(localStorage.getItem("lisio:state")).ts.styles.find(s => s.id === i).color, id);
check(!!fixed && fixed !== light, "la couleur corrigée est enregistrée dans le projet", String(fixed));
check(/:1/.test(await page.locator("#toast, .toast").first().textContent().catch(() => "")), "le message dit le nouveau ratio", await page.locator("#toast, .toast").first().textContent().catch(() => ""));
check(await page.evaluate(() => document.activeElement && document.activeElement.closest && !!document.activeElement.closest("#tsList")), "le focus reste dans la liste des styles");
await pick(id, light);
const st1 = await page.evaluate(() => JSON.parse(localStorage.getItem("lisio:state")));
check(st1.ts.styles.find(s => s.id === id).color === light, "couleur enregistrée dans le projet");
// Choisir une couleur foncée : conforme au test.
// La nuance la plus foncée d’une gamme (ni noir ni texte principal), pour tester une vraie couleur de palette.
const dark = await page.evaluate(() => { const fg = JSON.parse(localStorage.getItem("lisio:state")).ts.fg, lum = v => { const n = parseInt(v.slice(1), 16); return ((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255); };
  return [...document.querySelectorAll('#tsList select[data-k=color] option')].map(o => o.value).filter(v => /^#[0-9A-F]{6}$/i.test(v) && v !== "#000000" && v !== fg).sort((a, b) => lum(a) - lum(b))[0]; });
await pick(id, dark);
check(/✓/.test(await row(id).locator(".ts-meta").textContent()), "couleur foncée : conforme au test", dark + " " + await row(id).locator(".ts-meta").textContent());
// Export CSS : la classe du style porte sa couleur, par sa variable.
await page.goto(PAGE + "#exporter"); await page.waitForTimeout(500);
const css = await page.evaluate(() => { const b = [...document.querySelectorAll("pre, code, textarea")].map(e => e.textContent).find(t => /\.t-/.test(t) && /--font-size-/.test(t)); return b || ""; });
const block = (css.match(new RegExp(`[^}]*\\.t-${id}\\b[^{]*\\{[^}]*\\}`)) || [""])[0];
check(/color: var\(--[a-z0-9-]+\);/.test(block), "CSS : la classe .t- du style porte sa couleur (variable)", block.slice(0, 200));
check(!/color: /.test((css.match(new RegExp(`[^}]*\\.t-${head}\\b[^{]*\\{[^}]*\\}`)) || [""])[0]), "CSS : les styles sans couleur propre restent inchangés");
// Revenir au texte principal.
await page.goto(PAGE + "#styles"); await page.waitForTimeout(500);
await pick(id, await page.evaluate(() => JSON.parse(localStorage.getItem("lisio:state")).ts.fg));
check(!(await page.evaluate(i => JSON.parse(localStorage.getItem("lisio:state")).ts.styles.find(s => s.id === i).color, id)), "choisir le texte principal efface la couleur propre");
// Les aperçus (.ts-spec) montrent les couleurs choisies, même mauvaises : Lisio les signale lui-même (✕). axe vérifie le reste.
if (AXE) { await page.addScriptTag({ content: readFileSync(AXE, "utf8") });
  const v = await page.evaluate(async () => (await axe.run({ include: [["#tsList"]], exclude: [[".ts-spec"]] }, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] })).violations.map(x => x.id + " " + x.nodes.length + " " + x.nodes.slice(0, 3).map(n => n.target.join(" ") + " " + (n.any[0] && n.any[0].message)).join(" / ")));
  check(!v.length, "axe-core : aucune violation dans la liste des styles (hors aperçus)", v.join(", ")); }
check(!errors.length, "aucune erreur JavaScript", errors.join(" | "));
await browser.close();
console.log(fails ? `\n${fails} échec(s)` : "\nTous les scénarios passent.");
process.exit(fails ? 1 : 0);
