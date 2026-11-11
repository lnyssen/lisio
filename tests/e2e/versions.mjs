// P2 · Versions et décisions : enregistrer une version, comparer, revenir en arrière ; journal des décisions et exceptions.
//   node tests/e2e/versions.mjs
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
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
const MINE = [{ name: "Bleu", hex: "#2563EB" }, { name: "Nuit", hex: "#101828" }, { name: "Blanc", hex: "#FFFFFF" }];
async function open(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, ...opts }); await ctx.route(/^https?:/, r => r.abort());
  const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
  await page.goto(PAGE + "#exporter");
  await page.evaluate(cols => { localStorage.clear(); localStorage.setItem("lisio-welcome", "1"); localStorage.setItem("lisio-mode", "adv"); localStorage.setItem("lisio:colors", JSON.stringify(cols)); localStorage.setItem("lisio:state", JSON.stringify({ projectName: "Mon site" })); }, MINE);
  await page.reload(); await page.waitForFunction(() => window.__lisioReady === true); await page.waitForTimeout(500);
  // Audit UX du 11 novembre 2026 : versions et décisions sont dans la partie « Historique » de la page Exporter.
  await page.click("#exTabHist"); await page.waitForTimeout(150); return { ctx, page, errors };
}
const ready = async page => { await page.waitForFunction(() => window.__lisioReady === true); await page.waitForTimeout(500); };
const axeOn = async (page, sel, lab) => { if (!AXE) return; if (!(await page.evaluate(() => typeof axe !== "undefined"))) await page.addScriptTag({ content: readFileSync(AXE, "utf8") });
  await page.evaluate(s => { const x = document.querySelector(s); (x.querySelector("input,button") || x).scrollIntoView({ block: "center" }); }, sel); await page.waitForTimeout(150);
  const v = await page.evaluate(async s => (await axe.run(document.querySelector(s), { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] })).violations.map(x => x.id + " " + x.nodes.map(n => n.html.slice(0, 80) + " " + n.failureSummary.replace(/\s+/g, " ").slice(0, 300)).join(" ; ")), sel);
  check(!v.length, `axe-core : aucune violation, ${lab}`, v.join(", ")); };
const stored = page => page.evaluate(() => ({ s: JSON.parse(localStorage.getItem("lisio:state")), c: JSON.parse(localStorage.getItem("lisio:colors")), p: JSON.parse(localStorage.getItem("lisio:projects")) }));
{
  const { ctx, page, errors } = await open();
  // 1. Versions
  check(await page.locator("#verCard").isVisible(), "page Exporter : carte « Versions du projet »");
  check(/aucune version/i.test(await page.textContent("#verList")), "liste vide expliquée");
  await page.click("#verSave"); await page.waitForTimeout(200);
  check(await page.locator("#verName").getAttribute("aria-invalid") === "true" && await page.evaluate(() => document.activeElement.id) === "verName", "nom vide : erreur sur le champ, focus dessus");
  await page.fill("#verName", "Validée par la marque"); await page.fill("#verNote", "Après la revue du 8 novembre");
  await page.click("#verSave"); await page.waitForTimeout(300);
  check(await page.locator("#verList li[data-ver]").count() === 1 && /Validée par la marque/.test(await page.textContent("#verList")), "la version apparaît dans la liste");
  check(/version/i.test(await page.textContent("#toast")), "un message confirme l’enregistrement", await page.textContent("#toast"));
  let st = await stored(page);
  check(Array.isArray(st.s.versions) && st.s.versions.length === 1 && st.s.versions[0].colors[0].hex === "#2563EB" && !("versions" in st.s.versions[0].state), "version enregistrée avec le projet, sans versions imbriquées");
  // On change une couleur.
  await page.goto(PAGE + "#couleurs"); await ready(page);
  await page.fill("#ph0", "#1D4ED8"); await page.press("#ph0", "Tab"); await page.waitForTimeout(300);
  await page.goto(PAGE + "#exporter"); await ready(page); await page.click("#exTabHist"); await page.waitForTimeout(150);
  await page.click("#verList [data-ver-cmp]"); await page.waitForTimeout(300);
  const cmp = await page.textContent("#verOut");
  check(/Bleu/.test(cmp) && /#2563EB/.test(cmp) && /#1D4ED8/.test(cmp), "comparer : la couleur modifiée, avant et après", cmp);
  await axeOn(page, "#verCard", "versions");
  // Revenir à la version : confirmation, puis rechargement.
  await page.click("#verList [data-ver-back]"); await page.waitForTimeout(200);
  check(await page.locator("#verList [data-ver-ok]").isVisible() && await page.evaluate(() => !!document.activeElement.closest("[data-ver-conf]")), "revenir demande une confirmation, focus dedans");
  await Promise.all([page.waitForEvent("load"), page.click("#verList [data-ver-ok]")]); await ready(page);
  st = await stored(page);
  check(st.c[0].hex === "#2563EB", "la couleur de la version est revenue", JSON.stringify(st.c[0]));
  check(st.s.versions.length === 2 && st.s.versions.some(v => /Avant le retour/.test(v.name) && v.colors[0].hex === "#1D4ED8"), "l’état d’avant est gardé en version : rien n’est perdu", JSON.stringify(st.s.versions.map(v => v.name)));
  const cur = st.p.list.find(x => x.id === st.p.cur);
  check(cur && cur.colors[0].hex === "#2563EB" && cur.name === "Mon site", "le projet en cours garde son nom et prend les couleurs de la version");
  check(/Validée par la marque/.test(await page.textContent("#toast")), "un message dit à quelle version on est revenu", await page.textContent("#toast"));
  // 2. Décisions et exceptions
  check(await page.locator("#decCard").isVisible(), "carte « Décisions et exceptions »");
  await page.check('#decCard input[name="decKind"][value="exception"]');
  await page.fill("#decProblem", "Orange illisible en texte courant");
  await page.click("#decAdd"); await page.waitForTimeout(200);
  const inv = await page.locator("#decCard [aria-invalid=true]").evaluateAll(n => n.map(x => x.id));
  check(inv.join() === "decReason,decContext,decRole" && await page.evaluate(() => document.activeElement.id) === "decReason", "exception incomplète : champs manquants signalés, focus sur le premier", inv.join());
  await page.fill("#decReason", "Couleur de marque imposée"); await page.fill("#decContext", "Pictogrammes seulement");
  await page.fill("#decRole", "Direction artistique"); await page.fill("#decReview", "2026-01-15");
  await page.click("#decAdd"); await page.waitForTimeout(200);
  check(await page.locator("#decReview").getAttribute("aria-invalid") === "true", "révision avant la date de décision : refusée");
  await page.fill("#decDate", "2025-06-01"); await page.click("#decAdd"); await page.waitForTimeout(300);
  check(await page.locator("#decList li[data-dec]").count() === 1, "l’exception entre dans le journal");
  const dl = await page.textContent("#decList");
  check(/Exception/.test(dl) && /Direction artistique/.test(dl) && /1er juin 2025/.test(dl) && /À revoir/i.test(dl), "le journal montre le type, le rôle, la date, et « À revoir » quand la révision est passée", dl);
  check(await page.inputValue("#decProblem") === "", "le formulaire est vidé après l’ajout");
  await page.check('#decCard input[name="decKind"][value="decision"]');
  await page.fill("#decProblem", "Niveau AA visé"); await page.fill("#decReason", "Exigence du RGAA"); await page.fill("#decRole", "Cheffe de projet");
  await page.click("#decAdd"); await page.waitForTimeout(300);
  check(await page.locator("#decList li[data-dec]").count() === 2, "une décision, sans contexte, entre aussi");
  await page.click('#decList li[data-dec] [data-dec-edit]'); await page.waitForTimeout(200);
  check(await page.inputValue("#decProblem") !== "" && /Enregistrer/.test(await page.textContent("#decAdd")) && await page.evaluate(() => document.activeElement.id) === "decProblem", "Modifier remplit le formulaire");
  await page.fill("#decRole", "Comité accessibilité"); await page.click("#decAdd"); await page.waitForTimeout(300);
  check(await page.locator("#decList li[data-dec]").count() === 2 && /Comité accessibilité/.test(await page.textContent("#decList")), "la modification remplace l’entrée, sans doublon");
  await axeOn(page, "#decCard", "décisions");
  // Le journal part avec le projet et dans le rapport ; les versions restent hors du lien.
  const [d] = await Promise.all([page.waitForEvent("download"), (async () => { await page.click("#exTabDeliver"); await page.click("#repMd"); })()]);
  const md = readFileSync(await d.path(), "utf8");
  check(/## Exceptions[\s\S]*Orange illisible en texte courant[\s\S]*Direction artistique/.test(md), "rapport Markdown : l’exception, avec son rôle", md.slice(md.indexOf("## Exceptions"), md.indexOf("## Exceptions") + 400));
  check(/## Décisions[\s\S]*Niveau AA visé/.test(md), "rapport Markdown : la section Décisions");
  await page.click("#prjB"); await page.waitForTimeout(200);
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.click("#prjShare"); await page.waitForTimeout(600);
  const link = await page.evaluate(() => navigator.clipboard.readText().catch(() => ""));
  if (link) {
    const o = await page.evaluate(async u => { const t = new URL(u).searchParams.get("p"), b = Uint8Array.from(atob(t.slice(1).replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
      const s = t[0] === "z" ? new TextDecoder().decode(await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer()) : new TextDecoder().decode(b); return JSON.parse(s); }, link);
    check(!("versions" in o.state) && Array.isArray(o.state.decisions) && o.state.decisions.length === 2, "lien de partage : le journal y est, les versions non (trop lourdes)");
  } else check(false, "lien de partage lisible dans le presse-papiers");
  check(!errors.length, "aucune erreur JavaScript", errors.join(" | "));
  await ctx.close();
}
{
  const { ctx, page } = await open({ ...devices["iPhone 13"] });
  const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(ov <= 0 && await page.locator("#decCard").isVisible(), "mobile : cartes visibles, sans défilement horizontal", String(ov));
  await ctx.close();
}
await browser.close();
console.log(fails ? `\n${fails} échec(s)` : "\nTous les scénarios passent.");
process.exit(fails ? 1 : 0);
