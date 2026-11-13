// Une police par style de texte (13 novembre 2026) : titres, texte et une police d’accent facultative,
// choisies dans Réglages ; chaque style prend l’une des trois, vérifiée et exportée (JSON pour Figma, CSS).
//   node tests/e2e/style-polices.mjs
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PAGE = "file://" + (process.env.LISIO_PAGE || join(ROOT, "index.html"));
let chromium;
try { ({ chromium } = createRequire(import.meta.url)("playwright")); } catch (e) { console.log("IGNORÉ : Playwright introuvable."); process.exit(process.env.CI ? 1 : 0); }
const browser = await chromium.launch();
let fails = 0;
const check = (cond, label, extra = "") => { if (cond) console.log("ok    " + label); else { fails++; console.log("ÉCHEC " + label + (extra ? " : " + extra : "")); } };
const SEED = join(tmpdir(), "lisio-seed-stfont.html"); writeFileSync(SEED, "<!doctype html><title>seed</title>");
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); await ctx.route(/^https?:/, r => r.abort());
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
await page.goto("file://" + SEED);
await page.evaluate(() => { localStorage.clear(); localStorage.setItem("lisio-welcome", "1"); localStorage.setItem("lisio-home", "off"); localStorage.setItem("lisio-mode", "ess"); localStorage.setItem("lisio:colors", JSON.stringify([{ name: "Bleu", hex: "#2F6BFF" }, { name: "Blanc", hex: "#FFFFFF" }])); });
await page.goto(PAGE + "#styles"); await page.waitForTimeout(700);
const row = id => page.locator(`#tsList .ts-row[data-id="${id}"]`);
const state = () => page.evaluate(() => JSON.parse(localStorage.getItem("lisio:state")));
const fam = id => row(id).locator(".ts-spec").evaluate(e => getComputedStyle(e).fontFamily);
const pickFont = async (btn, name) => { await page.locator(btn).click(); await page.fill("#fontSearch", name); await page.waitForTimeout(150); await page.locator(`#fontList button[data-family="${name}"]`).click(); await page.waitForTimeout(300); };

check(await row("h1").locator("select[data-k=font]").isVisible(), "chaque style a un choix de police, visible en Essentiel");
check((await row("h1").locator("select[data-k=font]").inputValue()) === "head" && (await row("body").locator("select[data-k=font]").inputValue()) === "body", "par défaut : titres pour H1, texte pour le corps");
check(await page.locator("#tsAccName").textContent() === "Ajouter" && await page.locator("#tsAccOff").isHidden(), "sans police d’accent : bouton « Ajouter », pas de « Retirer »");

// Titres et texte différents
await pickFont('button[data-target="head"]', "Playfair Display");
await pickFont('button[data-target="body"]', "Inter");
check(/Playfair Display/.test(await fam("h2")) && /Inter/.test(await fam("body")), "titres et texte : deux polices différentes", (await fam("h2")) + " / " + (await fam("body")));

// Police d'accent, attribuée à Display et au label
await pickFont("#tsAccBtn", "Space Mono");
check(await page.locator("#tsAccName").textContent() === "Space Mono" && await page.locator("#tsAccOff").isVisible(), "police d’accent ajoutée, « Retirer » apparaît");
const setF = async (id, k) => { await row(id).locator("select[data-k=font]").selectOption(k); await page.waitForTimeout(250); };
await setF("display", "accent"); await setF("label", "accent"); await setF("button", "head");
check(/Space Mono/.test(await fam("display")) && /Space Mono/.test(await fam("label")) && /Playfair Display/.test(await fam("button")), "chaque style prend la police choisie", [await fam("display"), await fam("label"), await fam("button")].join(" / "));
check(/Playfair Display/.test(await fam("h1")), "les autres styles gardent la leur");
const S1 = await state();
check(S1.ts.fonts.accent && S1.ts.fonts.accent.family === "Space Mono" && S1.ts.styles.find(s => s.id === "display").font === "accent" && !("font" in S1.ts.styles.find(s => s.id === "h1")), "choix enregistrés dans le projet (seulement les écarts)");
const ws = await row("display").locator("select[data-k=weight] option").evaluateAll(o => o.map(x => +x.value));
check(ws.includes(S1.ts.styles.find(s => s.id === "display").weight), "la graisse est ramenée à une graisse de la police d’accent", JSON.stringify(ws));
await setF("button", "body");
check(!("font" in (await state()).ts.styles.find(s => s.id === "button")), "revenir à la police d’origine efface l’écart");

// Exports (le panneau d’export de l’étape)
const out = fmt => page.evaluate(f => { const s = document.getElementById("tsFmt"); s.value = f; s.dispatchEvent(new Event("change")); return document.getElementById("tsOut").textContent; }, fmt);
const J = JSON.parse(await out("json"));
check(J.font.family.accent && J.font.family.accent.$value[0] === "Space Mono", "JSON : variable font.family.accent");
check(J.typography.display.$value.fontFamily === "{font.family.accent}" && J.typography.h1.$value.fontFamily === "{font.family.heading}" && J.typography.body.$value.fontFamily === "{font.family.body}", "JSON : chaque style pointe vers sa police");
const css = await out("css");
check(/--font-accent: "Space Mono"/.test(css), "CSS : variable --font-accent");
const blk = id => (css.match(new RegExp(`[^}]*\\.t-${id}\\b[^{]*\\{[^}]*\\}`)) || [""])[0];
check(/font-family: var\(--font-accent\)/.test(blk("label")) && /font-family: var\(--font-heading\)/.test(blk("h1")), "CSS : la classe .t- du style porte sa police", blk("label").slice(0, 160));

// Retirer l'accent : ses styles reprennent leur police
await page.locator("#tsAccOff").click(); await page.waitForTimeout(300);
const S2 = await state();
check(!S2.ts.fonts.accent && !S2.ts.styles.some(s => s.font === "accent"), "« Retirer » efface la police d’accent et ses attributions");
check(/Playfair Display/.test(await fam("display")) && /Inter/.test(await fam("label")), "Display et Label reprennent titres et texte");
check(!JSON.parse(await out("json")).font.family.accent && !/--font-accent/.test(await out("css")), "exports sans police d’accent");
check(await page.evaluate(() => document.activeElement && document.activeElement.id) === "tsAccBtn", "le focus revient sur le bouton Accent");

// Mobile : pas de débordement horizontal
await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(400);
check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "mobile 390 : pas de défilement horizontal");
check(errors.length === 0, "aucune erreur JavaScript", errors.join(" | "));
await browser.close();
console.log(fails ? `\n${fails} échec(s)` : "\nTout est bon.");
process.exit(fails ? 1 : 0);
