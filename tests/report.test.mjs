// F11 : rapport de validation Markdown et JSON. Lancer : node --test tests/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { reportMarkdown, reportJson, fingerprint, REPORT_SCHEMA } from "../src/core/report.mjs";

const M = { project: "Site | Média", date: "2026-11-06", lisio: "abc1234", fingerprint: fingerprint("x"), wcag: "2.2", level: "AA",
  scope: "Couleurs, rôles et styles de texte du projet.",
  counts: [["paires lisibles en texte courant", 10, 15], ["rôles conformes au test", 20, 22]],
  criteria: [{ id: "1.4.3", level: "AA", what: "Paires de texte", status: "fail", note: "2 sous le seuil" }, { id: "1.4.12", level: "AA", what: "Espacement", status: "manual" }, { id: "", level: "", what: "Autres critères", status: "untested", note: "Lisio ne les teste pas" }],
  roles: [["mode clair", [{ role: "Texte principal", color: "#111111", pair: "Fond de page", ratio: "18,1:1", need: "4,5:1", status: "pass" }, { role: "Texte désactivé", color: "#999999", status: "na", note: "exempté par 1.4.3" }]]],
  styles: [{ name: "Titre 1", size: "32 → 48 px", ratio: "18,1:1", need: "3:1", status: "pass" }],
  manual: { screens: ["Accueil", "Contact"], items: [{ title: "Tout se fait au clavier", crit: "2.1.1", results: ["pass", "untested"] }] },
  untested: ["Tous les autres critères WCAG 2.2"], exceptions: ["Composants inactifs : exemptés de contraste (1.4.3, 1.4.11)"],
  method: ["Ratio calculé avec la formule de luminance relative de WCAG 2.2"], limits: ["Ce rapport n’affirme pas la conformité du produit."] };

test("les onze rubriques du blueprint sont présentes", () => {
  const md = reportMarkdown(M).replace(/\u00a0/g, " ");
  for (const h of ["Projet :", "Version de Lisio", "Date :", "## Périmètre", "## Critères vérifiés et résultats", "## Contrôles manuels requis", "## Points non testés", "## Exceptions", "## Méthodologie et version WCAG", "## Limites du rapport", "WCAG 2.2, niveau AA"])
    assert.ok(md.includes(h), h);
});

test("les cinq statuts sont expliqués", () => {
  const md = reportMarkdown(M);
  for (const w of ["Conforme au test", "Échec du test", "À vérifier manuellement", "Non testé", "Non applicable"]) assert.ok(md.includes(w), w);
});

test("les contrôles non exécutés restent visibles", () => {
  const md = reportMarkdown(M);
  assert.match(md, /\| Tout se fait au clavier \| 2\.1\.1 \| ✓ Conforme au test \| – Non testé \|/);
  assert.match(md, /Autres critères \| – Non testé/);
});

test("tableaux Markdown valides : barres verticales échappées, une ligne par entrée", () => {
  const md = reportMarkdown(M);
  assert.match(md, /# Rapport de validation\s?: Site \\\| Média/);
  const lines = md.split("\n").filter(l => l.startsWith("| Critère"));
  assert.equal(lines.length, 1);
});

test("aucune affirmation de conformité du produit", () => {
  const md = reportMarkdown(M).replace(/Conforme au test/g, "");
  assert.doesNotMatch(md, /certifi|site conforme|accessible à 100|100 %|conforme WCAG/i);
});

test("reproductible : même modèle, même texte ; empreinte stable et sensible", () => {
  assert.equal(reportMarkdown(M), reportMarkdown(JSON.parse(JSON.stringify(M))));
  assert.equal(fingerprint("abc"), fingerprint("abc"));
  assert.notEqual(fingerprint("abc"), fingerprint("abd"));
  assert.match(fingerprint("é"), /^[0-9a-f]{8}$/);
});

test("JSON : schéma versionné, mêmes données que le Markdown", () => {
  const j = reportJson(M);
  assert.equal(j.schema, REPORT_SCHEMA); assert.equal(j.v, 1);
  assert.equal(j.statuses.manual, "À vérifier manuellement");
  assert.deepEqual(j.criteria, M.criteria); assert.equal(j.fingerprint, M.fingerprint);
});
