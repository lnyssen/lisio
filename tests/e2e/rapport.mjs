// F11 : rapport de validation en Markdown et JSON, cohérent avec le rapport HTML et avec le projet.
//   node tests/e2e/rapport.mjs
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PAGE = "file://" + (process.env.LISIO_PAGE || join(ROOT, "index.html"));
let chromium;
try { ({ chromium } = createRequire(import.meta.url)("playwright")); } catch (e) { console.log("IGNORÉ : Playwright introuvable."); process.exit(process.env.CI ? 1 : 0); }
const browser = await chromium.launch();
let fails = 0;
const check = (cond, label, extra = "") => { if (cond) console.log("ok    " + label); else { fails++; console.log("ÉCHEC " + label + (extra ? " : " + extra : "")); } };
const MEDIA = [{ name: "Marine", hex: "#0D1D45" }, { name: "Bleu", hex: "#2F6BFF" }, { name: "Turquoise", hex: "#00B3B0" }, { name: "Blanc", hex: "#FAF9F4" }];
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true }); await ctx.route(/^https?:/, r => r.abort());
await ctx.addInitScript(m => { try { if (!sessionStorage.getItem("s")) { sessionStorage.setItem("s", "1"); localStorage.clear(); localStorage.setItem("lisio-welcome", "1"); localStorage.setItem("lisio-mode", "adv"); localStorage.setItem("lisio:colors", JSON.stringify(m)); localStorage.setItem("lisio:state", JSON.stringify({ projectName: "Site Média", level: "AA", version: "2.2" })); } } catch (e) {} }, MEDIA);
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
await page.goto(PAGE + "#exporter"); await page.waitForTimeout(600);
const grab = async sel => { const [d] = await Promise.all([page.waitForEvent("download"), page.click(sel)]); return { name: d.suggestedFilename(), text: readFileSync(await d.path(), "utf8") }; };
const md = await grab("#repMd"), n = s => s.replace(/ /g, " ");
const M = n(md.text);
check(/\.md$/.test(md.name), "fichier .md", md.name);
check(/^# Rapport de validation : Site Média/m.test(M), "titre avec le nom du projet");
check(/Version de Lisio : [0-9a-f]{7}/.test(M) && /Empreinte du projet : [0-9a-f]{8}/.test(M), "version de Lisio et empreinte du projet");
check(/WCAG 2\.2, niveau AA/.test(M), "version et niveau WCAG");
for (const id of ["1.4.3", "1.4.11", "1.4.1", "1.4.12", "2.4.13", "2.5.8"]) check(new RegExp("\\| " + id.replace(/\./g, "\\.") + " \\|").test(M), "critère " + id + " dans le tableau");
check(/## Contrôles manuels requis/.test(M) && /– Non testé/.test(M), "contrôles manuels visibles, non testés dits");
check(/## Points non testés\n\n- /.test(M) && /## Exceptions\n\n- /.test(M) && /## Limites du rapport\n\n- /.test(M), "points non testés, exceptions, limites");
check(/Marine/.test(M) && /#0D1D45/.test(M), "les données correspondent au projet");
const md2 = await grab("#repMd");
check(md2.text === md.text, "reproductible : deux exports identiques");
const js = await grab("#repJson"), J = JSON.parse(js.text);
check(/\.json$/.test(js.name) && J.schema === "lisio-report" && J.v === 1, "JSON : schéma versionné", js.name);
check(M.includes("Empreinte du projet : " + J.fingerprint) && J.project === "Site Média" && J.criteria.length >= 6, "JSON et Markdown : mêmes données");
// Cohérence avec le rapport HTML.
const html = n((await grab("#repDl")).text);
const kpi = html.match(/<b>(\d+)\/(\d+)<\/b>paires lisibles/), mdk = M.match(/(\d+) sur (\d+) : paires lisibles/);
check(kpi && mdk && kpi[1] === mdk[1] && kpi[2] === mdk[2], "même décompte de paires que le rapport HTML", `${kpi && kpi.slice(1)} / ${mdk && mdk.slice(1)}`);
check(html.includes(J.fingerprint) && html.includes(J.lisio), "le rapport HTML porte la même version et la même empreinte");
check(!errors.length, "aucune erreur JavaScript", errors.join(" | "));
await browser.close();
console.log(fails ? `\n${fails} échec(s)` : "\nTous les scénarios passent.");
process.exit(fails ? 1 : 0);
