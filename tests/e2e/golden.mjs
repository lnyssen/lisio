// Tests de référence (« golden ») des exports de Lisio.
// Charge index.html dans Chromium avec 3 projets types et compare, octet pour octet,
// les exports (design system JSON et CSS, palette CSS, JSON et Tailwind) et la matrice
// aux fichiers de tests/golden/.
//   node tests/e2e/golden.mjs           compare (code de sortie 1 si une différence)
//   node tests/e2e/golden.mjs --write   réécrit les références (à faire seulement si le changement est voulu)
// Optionnel : nécessite Playwright et Chromium. Sans eux, le test est ignoré (code 0) et le dit.
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const GOLD = join(ROOT, "tests", "golden");
const WRITE = process.argv.includes("--write");
const PAGE = process.env.LISIO_PAGE || join(ROOT, "index.html");

let chromium;
try { ({ chromium } = createRequire(import.meta.url)("playwright")); }
catch (e) { console.log("IGNORÉ : Playwright introuvable, tests de référence non exécutés."); process.exit(process.env.CI ? 1 : 0); }

export const PROJECTS = {
  exemple: { colors: null, state: {} },
  "media-animation": {
    colors: [
      { name: "Marine", hex: "#0D1D45" }, { name: "Bleu", hex: "#2F6BFF" }, { name: "Turquoise", hex: "#00B3B0" },
      { name: "Corail", hex: "#FF5A4E" }, { name: "Orange", hex: "#FF7A1A" }, { name: "Blanc", hex: "#FAF9F4" }
    ],
    state: { level: "AA" }
  },
  "echecs-aaa": {
    colors: [
      { name: "Gris", hex: "#777777" }, { name: "Jaune", hex: "#FFFF00" }, { name: "Vert", hex: "#00FF00" },
      { name: "Rose", hex: "#FF66CC" }, { name: "Noir", hex: "#000000" }, { name: "Blanc", hex: "#FFFFFF" }
    ],
    state: { level: "AAA" }
  }
};

async function capture(browser, proj) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "light" });
  await ctx.addInitScript(p => {
    try {
      localStorage.clear();
      if (p.colors) localStorage.setItem("lisio:colors", JSON.stringify(p.colors));
      localStorage.setItem("lisio:state", JSON.stringify(p.state));
      localStorage.setItem("lisio-welcome", "1"); localStorage.setItem("lisio-home", "off"); localStorage.setItem("lisio-mode", "adv");
    } catch (e) {}
  }, proj);
  // Les polices distantes n'influencent pas les exports : on coupe le réseau pour un test stable.
  await ctx.route(/^https?:/, r => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  await page.goto("file://" + PAGE + "#styles");
  await page.waitForTimeout(600);
  const out = await page.evaluate(() => {
    const $ = id => document.getElementById(id);
    const run = (sel, v, outId) => { sel.value = v; sel.dispatchEvent(new Event("change")); return $(outId).textContent; };
    const r = {};
    r["ds.json"] = run($("tsFmt"), "json", "tsOut");
    r["ds.css"] = run($("tsFmt"), "css", "tsOut");
    r["palette.css"] = run($("exportFmt"), "css", "exportOut");
    r["palette.json"] = run($("exportFmt"), "json", "exportOut");
    r["palette.tailwind.js"] = run($("exportFmt"), "tw", "exportOut");
    r["matrice.txt"] = [...document.querySelectorAll("[data-i][data-j]")]
      .map(c => `${c.dataset.i},${c.dataset.j} ${[...c.classList].filter(k => /^b-/.test(k)).join(" ")} ${c.textContent.replace(/\s+/g, " ").trim()}`).join("\n") + "\n";
    return r;
  });
  await ctx.close();
  return { out, errors };
}

const browser = await chromium.launch();
let fails = 0;
for (const [name, proj] of Object.entries(PROJECTS)) {
  const { out, errors } = await capture(browser, proj);
  if (errors.length) { fails++; console.log(`ÉCHEC ${name} : erreurs JavaScript`, errors); }
  const dir = join(GOLD, name); if (WRITE) mkdirSync(dir, { recursive: true });
  for (const [file, txt] of Object.entries(out)) {
    const f = join(dir, file);
    if (!txt || txt.length < 20) { fails++; console.log(`ÉCHEC ${name}/${file} : sortie vide`); continue; }
    if (WRITE) { writeFileSync(f, txt); console.log(`écrit ${name}/${file} (${txt.length} o)`); continue; }
    if (!existsSync(f)) { fails++; console.log(`ÉCHEC ${name}/${file} : référence absente (lancer --write)`); continue; }
    const ref = readFileSync(f, "utf8");
    if (ref === txt) console.log(`ok    ${name}/${file}`);
    else {
      fails++;
      const a = ref.split("\n"), b = txt.split("\n"); let i = 0; while (i < a.length && a[i] === b[i]) i++;
      console.log(`ÉCHEC ${name}/${file} : diffère à la ligne ${i + 1}\n  attendu : ${(a[i] || "").slice(0, 160)}\n  obtenu  : ${(b[i] || "").slice(0, 160)}`);
    }
  }
}
await browser.close();
console.log(fails ? `\n${fails} différence(s)` : "\nExports identiques aux références.");
process.exit(fails ? 1 : 0);
