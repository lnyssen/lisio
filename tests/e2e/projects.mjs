// Scénarios de bout en bout : partage par lien, import de fichier, écriture refusée, démarrage sur un projet abîmé.
//   node tests/e2e/projects.mjs
// Optionnel : nécessite Playwright (Chromium). Sans lui, ignoré (code 0) et dit.
import { createRequire } from "node:module";
import { deflateRawSync } from "node:zlib";
import { randomBytes } from "node:crypto";
import { writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PAGE = "file://" + (process.env.LISIO_PAGE || join(ROOT, "index.html"));
let chromium;
try { ({ chromium } = createRequire(import.meta.url)("playwright")); } catch (e) { console.log("IGNORÉ : Playwright introuvable."); process.exit(process.env.CI ? 1 : 0); }

const MEDIA = [{ name: "Marine", hex: "#0D1D45" }, { name: "Bleu", hex: "#2F6BFF" }, { name: "Turquoise", hex: "#00B3B0" }];
const MINE = [{ name: "Mon rouge", hex: "#B42318" }, { name: "Mon fond", hex: "#FFFFFF" }];
const b64u = buf => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const browser = await chromium.launch();
let fails = 0;
const check = (cond, label, extra = "") => { if (cond) console.log("ok    " + label); else { fails++; console.log("ÉCHEC " + label + (extra ? " : " + extra : "")); } };

// Graine : une page vide du même dossier (même origine file://) écrit le localStorage, puis on ouvre Lisio.
const SEED = join(tmpdir(), "lisio-seed.html"); writeFileSync(SEED, "<!doctype html><title>seed</title>");
async function open(local, hash = "#matrice", query = "") {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route(/^https?:/, r => r.abort());
  await ctx.addInitScript(() => { try { navigator.clipboard.writeText = t => { window.__copied = t; return Promise.resolve(); }; } catch (e) {} });
  const page = await ctx.newPage(); const errors = [];
  await page.goto("file://" + SEED);
  await page.evaluate(l => { localStorage.clear(); localStorage.setItem("lisio-welcome", "1"); localStorage.setItem("lisio-mode", "adv"); for (const [k, v] of Object.entries(l)) localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v)); }, local);
  page.on("pageerror", e => errors.push(String(e)));
  await page.goto(PAGE + query + hash); await page.waitForTimeout(500);
  return { ctx, page, errors };
}
const ls = (page, k) => page.evaluate(k => JSON.parse(localStorage.getItem(k)), k);
const toastText = page => page.locator("#toast").textContent();
async function importFile(page, obj, name = "p.json") {
  await page.setInputFiles("#prjFile", { name, mimeType: "application/json", buffer: Buffer.from(typeof obj === "string" ? obj : JSON.stringify(obj)) });
  await page.waitForTimeout(300);
}
const proj = over => ({ lisio: "project", v: 1, name: "Reçu", savedAt: "2026-11-05T10:00:00Z", colors: MEDIA, state: { level: "AA" }, ...over });

// 1. Lien de partage : création, avertissement, ouverture comme NOUVEAU projet, projet courant intact.
{
  const A = await open({ "lisio:colors": MEDIA, "lisio:state": { projectName: "Site Média" } }, "#exporter");
  await A.page.click("#prjLink"); await A.page.waitForTimeout(300);
  const url = await A.page.evaluate(() => window.__copied), note = await A.page.locator("#prjNote").textContent();
  check(url && url.includes("?p="), "lien créé");
  check(/Toute personne qui a ce lien/.test(note), "avertissement : le lien peut circuler", note);
  await A.ctx.close();
  const q = "?" + url.split("?")[1].split("#")[0];
  const B = await open({ "lisio:colors": MINE, "lisio:state": { projectName: "Mon site" } }, "#matrice", q);
  const offer = await B.page.locator("#prjIn").textContent();
  check(/nouveau projet/.test(offer) && /reste tel quel/.test(offer), "message exact : ajouté comme nouveau projet", offer.slice(0, 120));
  check(!/remplacera/.test(offer), "plus de « remplacera vos réglages »");
  await Promise.all([B.page.waitForEvent("load"), B.page.click("[data-prj=ok]")]); await B.page.waitForTimeout(300);
  const P = await ls(B.page, "lisio:projects"), cur = P.list.find(x => x.id === P.cur), old = P.list.find(x => x.id !== P.cur);
  check(P.list.length === 2, "deux projets après ouverture", String(P.list.length));
  check(cur && cur.name === "Site Média" && cur.colors[0].hex === "#0D1D45", "projet ouvert = projet partagé");
  check(old && old.name === "Mon site" && old.colors[0].hex === "#B42318", "projet d’origine intact");
  check(!B.page.url().includes("?p="), "paramètre retiré de l’adresse");
  check(!B.errors.length, "aucune erreur JavaScript", B.errors.join(" | "));
  await B.ctx.close();
}
// 2. Imports refusés, chacun avec sa raison ; rien n'est écrit.
{
  const C = await open({ "lisio:colors": MINE, "lisio:state": { projectName: "Mon site" } });
  const before = await C.page.evaluate(() => localStorage.getItem("lisio:projects"));
  for (const [obj, re, label] of [
    [proj({ v: 99 }), /version plus récente/, "version plus récente refusée"],
    [proj({ v: "1" }), /version illisible/, "version illisible refusée"],
    [proj({ colors: [{ hex: "#12" }] }), /couleur au moins est illisible/, "couleur invalide refusée"],
    [proj({ colors: Array.from({ length: 13 }, () => ({ hex: "#000" })) }), /12 couleurs/, "plus de 12 couleurs refusé"],
    [{ color: {}, typography: {} }, /export pour Figma/, "export Figma reconnu"],
    ["pas du json", /pas un projet Lisio/, "fichier quelconque refusé"]]) {
    await importFile(C.page, obj); const t = await toastText(C.page);
    check(re.test(t) && await C.page.locator("#prjIn").isHidden(), label, t);
  }
  check(before === await C.page.evaluate(() => localStorage.getItem("lisio:projects")), "aucune écriture après refus");
  // Lien piégé : 3 Mo une fois décompressé.
  const bomb = "z" + b64u(deflateRawSync(Buffer.from('{"a":"' + " ".repeat(3000000) + '"}')));
  await C.page.goto(PAGE + "?p=" + bomb + "#matrice"); await C.page.waitForTimeout(600);
  check(/trop lourd/i.test(await toastText(C.page)), "lien qui gonfle au-delà de 2 Mo refusé", await toastText(C.page));
  await C.ctx.close();
}
// 3. Réglages abîmés : remis d'aplomb, et c'est dit avant d'ouvrir.
{
  const D = await open({ "lisio:colors": MINE, "lisio:state": { projectName: "Mon site" } });
  await importFile(D.page, proj({ state: { level: "ZZZ", size: "grand", font: null, figma: "javascript:alert(1)" } }));
  const offer = await D.page.locator("#prjIn").textContent();
  check(/4 réglages corrigés/.test(offer), "4 réglages corrigés annoncés", offer.slice(0, 200));
  await Promise.all([D.page.waitForEvent("load"), D.page.click("[data-prj=ok]")]); await D.page.waitForTimeout(300);
  const st = await ls(D.page, "lisio:state");
  check(st.level === "AA" && st.size === 18 && st.font && st.font.family && !("figma" in st), "valeurs par défaut appliquées", JSON.stringify(st).slice(0, 120));
  check(!D.errors.length, "aucune erreur JavaScript", D.errors.join(" | "));
  await D.ctx.close();
}
// 4. Le navigateur refuse d'écrire : alerte visible, qui disparaît quand l'écriture revient.
{
  const E = await open({ "lisio:colors": MINE }, "#exporter");
  await E.page.evaluate(() => { const o = Storage.prototype.setItem; window.__setItem = o; Storage.prototype.setItem = function (k, v) { if (String(k).startsWith("lisio:")) throw new DOMException("plein", "QuotaExceededError"); return o.call(this, k, v); }; });
  await E.page.fill("#prjName", "Essai 1"); await E.page.waitForTimeout(300);
  const al = E.page.locator("#saveErr");
  check(await al.isVisible() && (await al.getAttribute("role")) === "alert", "alerte visible si l’écriture échoue");
  await E.page.evaluate(() => { Storage.prototype.setItem = window.__setItem; });
  await E.page.fill("#prjName", "Essai 2"); await E.page.waitForTimeout(300);
  check(await al.isHidden(), "alerte retirée quand l’écriture revient");
  await E.ctx.close();
}
// 5. Démarrage sur un projet abîmé : pas de page morte, retour possible au projet précédent.
{
  const good = { id: "a", name: "Projet sain", colors: MINE, state: { projectName: "Projet sain" } };
  const bad = { id: "b", name: "Projet abîmé", colors: MEDIA, state: { font: null } };
  const F = await open({ "lisio:projects": { cur: "b", list: [good, bad] }, "lisio:colors": MEDIA, "lisio:state": { font: null, projectName: "Projet abîmé" }, "lisio-boot-prev": "a" });
  const box = F.page.locator("#bootErr");
  check(await box.isVisible(), "écran de secours affiché");
  check(/Projet sain/.test(await box.textContent()), "propose de revenir au projet précédent");
  await Promise.all([F.page.waitForEvent("load"), F.page.click("[data-be=back]")]); await F.page.waitForTimeout(300);
  check(await F.page.locator("#bootErr").count() === 0, "projet précédent rouvert sans erreur");
  check((await ls(F.page, "lisio:projects")).list.length === 2, "le projet abîmé n’est pas effacé");
  await F.ctx.close();
}
// 6. Partage par lien (P1, F05) : URL valide, limites dites, erreurs claires, anciens liens lisibles.
{
  const G = await open({ "lisio:colors": MEDIA, "lisio:state": { projectName: "Site Média", figma: "https://www.figma.com/design/abc/Site" } }, "#exporter");
  await G.page.click("#prjLink"); await G.page.waitForTimeout(300);
  const url = await G.page.evaluate(() => window.__copied), note = await G.page.locator("#prjNote").textContent();
  let okUrl = false; try { const u = new URL(url); okUrl = u.protocol === "https:" && !!u.searchParams.get("p") && url.length <= 8000; } catch (e) {}
  check(okUrl, "le lien copié est une URL https valide, sous 8 000 caractères", String(url).slice(0, 80));
  check(/ne remplace pas une sauvegarde/i.test(note), "rappel : le lien ne remplace pas une sauvegarde", note);
  check(/lien Figma/i.test(note), "le lien Figma du projet est signalé comme inclus", note);
  await G.ctx.close();
  // Projet trop lourd pour un lien : aucun lien copié, raison et solution dites.
  const rnd = randomBytes(9000).toString("base64");
  const H = await open({ "lisio:colors": MEDIA, "lisio:state": { projectName: "Lourd", notes: rnd } }, "#exporter");
  await H.page.click("#prjLink"); await H.page.waitForTimeout(400);
  const hn = await H.page.locator("#prjNote").textContent();
  check(!(await H.page.evaluate(() => window.__copied)) && /trop lourd pour un lien/.test(hn) && /Enregistrer le projet/.test(hn), "projet trop lourd : pas de lien, solution proposée", hn);
  await H.ctx.close();
  // Liens reçus abîmés ou d’une version future : refus clair, rien d’écrit.
  const I = await open({ "lisio:colors": MINE, "lisio:state": { projectName: "Mon site" } });
  const names = () => I.page.evaluate(() => (JSON.parse(localStorage.getItem("lisio:projects") || "{}").list || []).map(x => x.name).join("|") + "/" + localStorage.getItem("lisio:colors"));
  const before = await names();
  const jlink = o => "j" + b64u(Buffer.from(JSON.stringify(o)));
  for (const [t, re, label] of [
    ["z%%%pas-un-lien", /Lien illisible/, "lien tronqué ou abîmé : message clair"],
    [jlink(proj({ v: 99 })), /version plus récente/, "lien d’une version future refusé"],
    [jlink(proj({ colors: [{ hex: "rouge" }] })), /couleur au moins est illisible/, "lien avec couleur invalide refusé"],
    [jlink({ hello: "world" }), /pas un projet Lisio/, "lien sans projet refusé"]]) {
    await I.page.goto(PAGE + "?p=" + t + "#matrice"); await I.page.waitForTimeout(500);
    const tt = await toastText(I.page);
    check(re.test(tt) && await I.page.locator("#prjIn").isHidden(), label, tt);
  }
  const after = await names();
  check(before === after, "aucun projet ajouté ni couleur changée après un lien refusé", before + " → " + after);
  // Anciens liens : le lien v1 de référence et le format non compressé (navigateurs sans CompressionStream) s’ouvrent.
  const V1 = readFileSync(join(ROOT, "tests", "golden", "partage-v1.txt"), "utf8").trim();
  for (const [t, label] of [[V1, "lien v1 de référence (2026-11-06) toujours ouvert"], [jlink(proj({ name: "Non compressé" })), "lien non compressé ouvert"]]) {
    await I.page.goto(PAGE + "?p=" + t + "#matrice"); await I.page.waitForTimeout(500);
    const offer = await I.page.locator("#prjIn").textContent();
    check(await I.page.locator("#prjIn").isVisible() && /nouveau projet/.test(offer), label, offer.slice(0, 100));
  }
  check(!I.errors.length, "aucune erreur JavaScript", I.errors.join(" | "));
  await I.ctx.close();
}
await browser.close();
console.log(fails ? `\n${fails} échec(s)` : "\nTous les scénarios passent.");
process.exit(fails ? 1 : 0);
