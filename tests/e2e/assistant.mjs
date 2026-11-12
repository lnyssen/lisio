// Cahier « Next-Level » : assistant de création en 3 étapes (couleurs, police, validation).
//   node tests/e2e/assistant.mjs
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
const MINE = [{ name: "Rouge maison", hex: "#B3261E" }, { name: "Nuit", hex: "#101828" }, { name: "Blanc", hex: "#FFFFFF" }];
// Préparation : on écrit le stockage une seule fois, puis on recharge.
async function open(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts }); await ctx.route(/^https?:/, r => r.abort());
  const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(String(e)));
  await page.goto(PAGE + "#couleurs");
  await page.evaluate(cols => { localStorage.clear(); localStorage.setItem("lisio-home", "off"); localStorage.setItem("lisio:colors", JSON.stringify(cols)); localStorage.setItem("lisio:state", JSON.stringify({ projectName: "Mon site" })); }, MINE);
  await page.reload(); await page.waitForFunction(() => window.__lisioReady === true); await page.waitForTimeout(500); return { ctx, page, errors };
}
const axeDlg = async (page, lab) => { if (!AXE) return; if (!(await page.evaluate(() => typeof axe !== "undefined"))) await page.addScriptTag({ content: readFileSync(AXE, "utf8") });
  const v = await page.evaluate(async () => (await axe.run(document.querySelector("#wizDlg"), { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] })).violations.map(x => x.id + " " + x.nodes.length));
  check(!v.length, `axe-core : aucune violation, ${lab}`, v.join(", ")); };
const setHex = (page, sel, v) => page.evaluate(([s, v]) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event("input", { bubbles: true })); }, [sel, v]);
{
  const { ctx, page, errors } = await open();
  await page.click("#homeB"); await page.waitForTimeout(200);
  const hello = page.locator("#home [data-home=new]");
  check(/Créer mon projet|Nouveau projet/.test(await hello.textContent()), "accueil : « Créer mon projet » ou « Nouveau projet »");
  await hello.click(); await page.waitForTimeout(300);
  check(await page.locator("#wizDlg").evaluate(d => d.open), "l’assistant s’ouvre");
  check(await page.evaluate(() => document.activeElement && document.activeElement.id === "wizName"), "focus sur le nom du projet");
  check(/Étape 1 sur 3/.test(await page.textContent("#wizDlg")) && /Couleurs/.test(await page.textContent("#wizDlg")), "étape 1 sur 3 : Couleurs");
  await page.fill("#wizName", "Projet Nova");
  await setHex(page, "#wizP", "#38BDF8"); await page.waitForTimeout(200);
  check(/✕/.test(await page.textContent("#wizChk")), "principale trop claire : le contraste est signalé", await page.textContent("#wizChk"));
  const fx = page.locator("#wizDlg [data-wiz-fix]");
  check(await fx.count() === 1 && /Corriger/.test(await fx.textContent()), "un bouton « Corriger » garde la teinte", await fx.count() ? await fx.textContent() : "");
  await fx.click(); await page.waitForTimeout(200);
  const pv = await page.inputValue("#wizP");
  check(pv !== "#38BDF8" && !/✕/.test(await page.textContent("#wizChk")), "après correction, tous les contrastes de départ passent", pv + " " + await page.textContent("#wizChk"));
  check(await page.evaluate(() => document.activeElement && !!document.activeElement.closest("#wizDlg")), "le focus reste dans l’assistant");
  await axeDlg(page, "étape 1");
  await page.click("#wizNext"); await page.waitForTimeout(200);
  check(/Étape 2 sur 3/.test(await page.textContent("#wizDlg")) && /Police/.test(await page.textContent("#wizDlg")), "étape 2 sur 3 : Police");
  await page.selectOption("#wizFont", "Inter");
  await page.check('#wizDlg input[name="wizBase"][value="18"]'); await page.check('#wizDlg input[name="wizRatio"][value="1.333"]');
  await axeDlg(page, "étape 2");
  await page.click("#wizPrev"); await page.waitForTimeout(200);
  check(await page.inputValue("#wizP") === pv && await page.inputValue("#wizName") === "Projet Nova", "« Retour » garde ce qui est saisi");
  await page.click("#wizNext"); await page.waitForTimeout(200);
  check(await page.inputValue("#wizFont") === "Inter" && await page.isChecked('#wizDlg input[name="wizBase"][value="18"]'), "l’étape 2 garde aussi ses choix");
  await page.click("#wizNext"); await page.waitForTimeout(300);
  check(/Étape 3 sur 3/.test(await page.textContent("#wizDlg")) && /Validation/.test(await page.textContent("#wizDlg")), "étape 3 sur 3 : Validation");
  const nCol = await page.locator("#wizDlg .wiz-row").count(), nSw = await page.locator("#wizDlg .wiz-row .wiz-sw i").count();
  check(nCol >= 2 && nSw === nCol * 11, "11 nuances calculées pour chaque couleur", `${nCol} couleurs, ${nSw} nuances`);
  check(/Inter/.test(await page.textContent("#wizDlg")) && /18 px/.test(await page.textContent("#wizDlg")), "le récapitulatif reprend la police et la taille");
  check(!/100\s?%|accessible à|certifi|garanti/i.test(await page.textContent("#wizDlg")), "aucune promesse de conformité");
  await axeDlg(page, "étape 3");
  check(/Créer le projet/.test(await page.textContent("#wizNext")), "dernier bouton : « Créer le projet »");
  await Promise.all([page.waitForEvent("load"), page.click("#wizNext")]);
  await page.waitForFunction(() => window.__lisioReady === true); await page.waitForTimeout(600);
  check((await page.textContent("#prjBN")).trim() === "Projet Nova", "le nouveau projet est ouvert", await page.textContent("#prjBN"));
  check(await page.evaluate(() => location.hash) === "#matrice", "il s’ouvre sur la grille des contrastes", await page.evaluate(() => location.hash));
  check(/Projet Nova/.test(await page.textContent("#toast")) && /créé/.test(await page.textContent("#toast")), "un message confirme la création", await page.textContent("#toast"));
  const st = await page.evaluate(() => ({ s: JSON.parse(localStorage.getItem("lisio:state")), c: JSON.parse(localStorage.getItem("lisio:colors")), p: JSON.parse(localStorage.getItem("lisio:projects")) }));
  check(st.c.map(x => x.name).join() === "Principale,Encre,Fond" && st.c[0].hex === pv, "couleurs du projet : Principale (corrigée), Encre, Fond", JSON.stringify(st.c));
  check(st.s.font && st.s.font.family === "Inter" && st.s.ts && st.s.ts.fonts && st.s.ts.fonts.body.family === "Inter", "police enregistrée pour le texte et les styles", JSON.stringify(st.s.font));
  const mine = st.p.list.find(x => x.name === "Mon site");
  check(!!mine && JSON.stringify(mine.colors) === JSON.stringify(MINE), "le projet d’avant est intact dans la liste");
  check(!errors.length, "aucune erreur JavaScript", errors.join(" | "));
  await ctx.close();
}
{
  // Mobile : l’assistant tient dans l’écran.
  const { ctx, page } = await open({ ...devices["iPhone 13"] });
  await page.click("#moreB"); await page.waitForTimeout(300); await page.click("#moreSheet [data-prj-open]"); await page.waitForTimeout(400);
  await page.click("#prjWiz"); await page.waitForTimeout(400);
  check(await page.locator("#wizDlg").evaluate(d => d.open), "mobile : Projets › « Créer avec l’assistant » ouvre l’assistant");
  const ov = await page.locator("#wizDlg").evaluate(d => d.scrollWidth - d.clientWidth);
  check(ov <= 0, "mobile : pas de défilement horizontal dans l’assistant", String(ov));
  await ctx.close();
}
await browser.close();
console.log(fails ? `\n${fails} échec(s)` : "\nTous les scénarios passent.");
process.exit(fails ? 1 : 0);
