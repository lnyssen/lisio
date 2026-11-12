// Contrôles automatiques de l'interface de Lisio : axe-core, erreurs JavaScript, débordement à 320 px.
// C'est un contrôle PARTIEL : axe ne voit qu'une partie des critères WCAG, et rien ici ne vaut audit
// ni conformité. Il sert à ne pas régresser.
//   node tests/e2e/a11y.mjs
// Optionnel : nécessite Playwright (Chromium) et axe-core (chemin dans AXE_PATH, ou module axe-core).
// Sans eux, le contrôle est ignoré (code 0) et le dit.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PAGE = process.env.LISIO_PAGE || join(ROOT, "index.html");
const req = createRequire(import.meta.url);
let chromium, AXE;
try { ({ chromium } = req("playwright")); } catch (e) { console.log("IGNORÉ : Playwright introuvable."); process.exit(process.env.CI ? 1 : 0); }
try { AXE = readFileSync(process.env.AXE_PATH || req.resolve("axe-core/axe.min.js"), "utf8"); }
catch (e) { console.log("IGNORÉ : axe-core introuvable (définir AXE_PATH vers axe.min.js)."); process.exit(process.env.CI ? 1 : 0); }

const VIEWS = ["couleurs", "matrice", "palette", "tester", "styles", "systeme", "lisibilite", "sources", "exporter"];
const SETUPS = [["desktop clair", 1440, 900, "light"], ["desktop sombre", 1440, 900, "dark"], ["mobile clair", 390, 844, "light"]];
// Exceptions assumées, chacune avec sa raison. Toute autre violation fait échouer le contrôle.
const ALLOW = [
  { id: "color-contrast", sel: /^\.b-(no|lg)\b.*\.sample\[aria-hidden="true"\]/, why: "matrice : l'échantillon montre exprès une paire qui échoue ; il est masqué aux lecteurs d'écran et le verdict est écrit en toutes lettres" }
];

const browser = await chromium.launch();
let fails = 0; const allowed = new Map();
for (const [label, w, h, scheme] of SETUPS) for (const v of VIEWS) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, colorScheme: scheme }); await page.addInitScript(() => { try { localStorage.setItem("lisio-home", "off"); } catch (e) {} });
  if (scheme === "dark") await page.addInitScript(() => { try { localStorage.setItem("lisio-theme", "dark"); } catch (e) {} });
  await page.route(/^https?:/, r => r.abort());
  const errs = []; page.on("pageerror", e => errs.push(String(e)));
  await page.goto("file://" + PAGE + "#" + v); await page.waitForTimeout(900);
  await page.addScriptTag({ content: AXE });
  const vio = await page.evaluate(async () => (await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] }, resultTypes: ["violations"] }))
    .violations.map(x => ({ id: x.id, help: x.help, nodes: x.nodes.map(n => n.target.join(" ")) })));
  const left = [];
  for (const x of vio) { const keep = x.nodes.filter(n => { const a = ALLOW.find(r => r.id === x.id && r.sel.test(n)); if (a) allowed.set(a.why, (allowed.get(a.why) || 0) + 1); return !a; });
    if (keep.length) left.push(`${x.id} (${keep.length}) : ${x.help}\n      ${keep.slice(0, 3).join("\n      ")}`); }
  if (errs.length) left.push("erreurs JavaScript : " + errs.join(" | "));
  if (left.length) { fails++; console.log(`ÉCHEC ${label} #${v}\n    ${left.join("\n    ")}`); } else console.log(`ok    ${label} #${v}`);
  await page.close();
}
// Fenêtres ouvertes (police, couleur, réglages, norme, aide, recherche) : axe sur leur contenu, en clair et en sombre.
const OPEN = [["tester", "#dFont", "#popFont"], ["tester", "#dFg", "#popColor"], ["tester", "#dMore", "#popMore"], ["matrice", "#normChip", "#popNorm"], ["matrice", "#helpB", "#helpPop"], ["matrice", "CMDK", "#cmdk"]];
for (const scheme of ["light", "dark"]) for (const [v, trig, zone] of OPEN) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: scheme }); await page.addInitScript(() => { try { localStorage.setItem("lisio-home", "off"); } catch (e) {} });
  if (scheme === "dark") await page.addInitScript(() => { try { localStorage.setItem("lisio-theme", "dark"); } catch (e) {} });
  await page.route(/^https?:/, r => r.abort());
  const errs = []; page.on("pageerror", e => errs.push(String(e)));
  await page.goto("file://" + PAGE + "#" + v); await page.waitForTimeout(700);
  if (trig === "CMDK") { await page.keyboard.press("Control+k"); await page.keyboard.type("contraste"); } else { await page.focus(trig); await page.keyboard.press("Enter"); }
  await page.waitForTimeout(300); await page.addScriptTag({ content: AXE });
  const vio = await page.evaluate(async z => (await axe.run(document.querySelector(z), { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] }, resultTypes: ["violations"] }))
    .violations.map(x => `${x.id} (${x.nodes.length}) : ${x.help}\n      ${x.nodes.slice(0, 3).map(n => n.target.join(" ")).join("\n      ")}`), zone);
  if (errs.length) vio.push("erreurs JavaScript : " + errs.join(" | "));
  const lab = `fenêtre ${zone} ${scheme === "dark" ? "sombre" : "clair"}`;
  if (vio.length) { fails++; console.log(`ÉCHEC ${lab}\n    ${vio.join("\n    ")}`); } else console.log(`ok    ${lab}`);
  await page.close();
}
// 1.4.10 (redistribution) : pas de défilement horizontal, et la barre du haut ne chevauche pas le logo.
for (const w of [320, 360, 375, 390, 430]) for (const v of VIEWS) {
  if (w !== 320 && v !== "matrice") continue;
  const page = await browser.newPage({ viewport: { width: w, height: 640 } }); await page.addInitScript(() => { try { localStorage.setItem("lisio-home", "off"); } catch (e) {} });
  await page.route(/^https?:/, r => r.abort());
  await page.goto("file://" + PAGE + "#" + v); await page.waitForTimeout(600);
  const r = await page.evaluate(() => { const lg = document.querySelector(".appbar .logo"), ap = document.querySelector(".appbar .appr");
    return { sw: document.documentElement.scrollWidth, gap: lg && ap ? Math.round(ap.getBoundingClientRect().left - lg.getBoundingClientRect().right) : null }; });
  const bad = [r.sw > w ? `largeur ${r.sw} px` : "", r.gap !== null && r.gap < 4 ? `barre du haut sur le logo (écart ${r.gap} px)` : ""].filter(Boolean);
  if (bad.length) { fails++; console.log(`ÉCHEC ${w} px #${v} : ${bad.join(", ")}`); } else console.log(`ok    ${w} px #${v}`);
  await page.close();
}
await browser.close();
for (const [why, n] of allowed) console.log(`\nexception assumée (${n} élément(s)) : ${why}`);
console.log(fails ? `\n${fails} contrôle(s) en échec` : "\nAucune violation détectée par axe (contrôle partiel, pas un audit).");
process.exit(fails ? 1 : 0);
