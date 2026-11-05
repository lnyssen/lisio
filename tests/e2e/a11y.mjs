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
try { ({ chromium } = req("playwright")); } catch (e) { console.log("IGNORÉ : Playwright introuvable."); process.exit(0); }
try { AXE = readFileSync(process.env.AXE_PATH || req.resolve("axe-core/axe.min.js"), "utf8"); }
catch (e) { console.log("IGNORÉ : axe-core introuvable (définir AXE_PATH vers axe.min.js)."); process.exit(0); }

const VIEWS = ["matrice", "palette", "tester", "styles", "systeme", "lisibilite", "sources", "exporter"];
const SETUPS = [["desktop clair", 1440, 900, "light"], ["desktop sombre", 1440, 900, "dark"], ["mobile clair", 390, 844, "light"]];
// Exceptions assumées, chacune avec sa raison. Toute autre violation fait échouer le contrôle.
const ALLOW = [
  { id: "color-contrast", sel: /^\.b-(no|lg)\b.*\.sample\[aria-hidden="true"\]/, why: "matrice : l'échantillon montre exprès une paire qui échoue ; il est masqué aux lecteurs d'écran et le verdict est écrit en toutes lettres" }
];
// Défauts connus, pas encore corrigés : signalés à chaque passage mais tolérés jusqu'à la borne indiquée.
// Au-delà de la borne, c'est une régression et le contrôle échoue. Retirer l'entrée une fois corrigé.
const KNOWN_320 = { maxWidth: 350, why: "barre du haut : les boutons de droite débordent de 30 px à 320 px de large (1.4.10), relevé le 2026-11-05, à corriger dans un chantier P0 suivant" };

const browser = await chromium.launch();
let fails = 0, known = 0; const allowed = new Map();
for (const [label, w, h, scheme] of SETUPS) for (const v of VIEWS) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, colorScheme: scheme });
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
// 1.4.10 (redistribution) : pas de défilement horizontal à 320 px de large.
for (const v of VIEWS) {
  const page = await browser.newPage({ viewport: { width: 320, height: 640 } });
  await page.route(/^https?:/, r => r.abort());
  await page.goto("file://" + PAGE + "#" + v); await page.waitForTimeout(700);
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  if (sw <= 320) console.log(`ok    320 px #${v}`);
  else if (sw <= KNOWN_320.maxWidth) { known++; console.log(`CONNU 320 px #${v} : largeur ${sw} px`); }
  else { fails++; console.log(`ÉCHEC 320 px #${v} : largeur ${sw} px (au-delà du défaut connu)`); }
  await page.close();
}
await browser.close();
if (known) console.log(`\ndéfaut connu, non corrigé (${known} vue(s)) : ${KNOWN_320.why}`);
for (const [why, n] of allowed) console.log(`\nexception assumée (${n} élément(s)) : ${why}`);
console.log(fails ? `\n${fails} contrôle(s) en échec` : "\nAucune violation détectée par axe (contrôle partiel, pas un audit).");
process.exit(fails ? 1 : 0);
