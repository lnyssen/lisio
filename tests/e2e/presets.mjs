// F10 : démarrer depuis un modèle. Nouveau projet seulement après confirmation ; le projet en cours reste intact.
//   node tests/e2e/presets.mjs
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
const SEED = join(tmpdir(), "lisio-seed-presets.html"); writeFileSync(SEED, "<!doctype html><title>seed</title>");
const MINE = [{ name: "Mon rouge", hex: "#B42318" }, { name: "Mon fond", hex: "#FFFFFF" }];
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); await ctx.route(/^https?:/, r => r.abort());
const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
await page.goto("file://" + SEED);
await page.evaluate(m => { localStorage.clear(); localStorage.setItem("lisio-welcome", "1"); localStorage.setItem("lisio-home", "off"); localStorage.setItem("lisio-mode", "adv"); localStorage.setItem("lisio:colors", JSON.stringify(m)); localStorage.setItem("lisio:state", JSON.stringify({ projectName: "Mon site", level: "AAA" })); }, MINE);
await page.goto(PAGE + "#couleurs"); await page.waitForTimeout(500);
const ls = k => page.evaluate(k => JSON.parse(localStorage.getItem(k)), k);
const openDlg = async () => { await page.evaluate(() => document.getElementById("prjB").click()); await page.waitForTimeout(250); };
await openDlg();
const items = page.locator("#prjTpl > li");
check(await items.count() >= 3, "au moins trois modèles proposés", String(await items.count()));
const first = await items.first().textContent();
check(/Point de départ/.test(await page.locator("#prjTplNote").textContent()), "modèles présentés comme point de départ");
await items.first().locator("summary").click();
check(/1\.4\.1|2\.5\.8|Choix de Lisio/.test(await items.first().locator("details").textContent()), "règles et sources documentées", first.slice(0, 80));
// Annuler : rien ne change.
const before = JSON.stringify(await ls("lisio:projects"));
const go = page.locator('#prjTpl button[data-tpl="sobre"]');
await go.click(); await page.waitForTimeout(150);
const conf = page.locator('#prjTpl [data-tplc="sobre"]');
check(await conf.isVisible() && /nouveau projet/.test(await conf.textContent()) && /reste/.test(await conf.textContent()), "confirmation demandée, projet en cours préservé", await conf.textContent());
check(await page.evaluate(() => document.activeElement && document.activeElement.dataset.tplok === "sobre"), "focus sur « Créer le projet »");
await conf.locator("[data-tplno]").click(); await page.waitForTimeout(150);
check(await conf.isHidden() && JSON.stringify(await ls("lisio:projects")) === before, "« Annuler » : rien n’est écrit");
check(await page.evaluate(() => document.activeElement && document.activeElement.dataset.tpl === "sobre"), "focus rendu au bouton du modèle");
// Créer.
await go.click(); await page.waitForTimeout(150);
await Promise.all([page.waitForEvent("load"), conf.locator("[data-tplok]").click()]); await page.waitForTimeout(500);
const P = await ls("lisio:projects"), cur = P.list.find(x => x.id === P.cur), old = P.list.find(x => x.id !== P.cur);
check(P.list.length === 2 && cur.name === "Service public sobre", "nouveau projet créé avec le nom du modèle", JSON.stringify(P.list.map(x => x.name)));
check(old && old.name === "Mon site" && old.colors[0].hex === "#B42318" && old.state.level === "AAA", "projet d’origine intact");
const st = await ls("lisio:state");
check(st.level === "AA" && st.ds.btn === 48 && st.ds.link === "solid", "réglages du modèle appliqués", JSON.stringify({ l: st.level, ds: st.ds && st.ds.btn }));
check(st.ts && st.ts.d && st.ts.d.base === 18 && String(st.ts.d.ratio) === "1.2" && !("tsPreset" in st), "échelle du modèle appliquée", JSON.stringify(st.ts && st.ts.d));
check((await ls("lisio:colors"))[0].name === "Encre", "palette du modèle");
await openDlg();
check(/modèle «\s?Service public sobre\s?»/.test(await page.locator("#prjCurMeta").textContent()), "le projet dit de quel modèle il part", await page.locator("#prjCurMeta").textContent());
if (AXE) { await page.addScriptTag({ content: readFileSync(AXE, "utf8") });
  const v = await page.evaluate(async () => (await axe.run(document.querySelector("#prjDlg"), { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] })).violations.map(x => x.id + " " + x.nodes.length));
  check(!v.length, "axe-core : aucune violation dans la fenêtre Projets", v.join(", ")); }
check(!errors.length, "aucune erreur JavaScript", errors.join(" | "));
await browser.close();
console.log(fails ? `\n${fails} échec(s)` : "\nTous les scénarios passent.");
process.exit(fails ? 1 : 0);
