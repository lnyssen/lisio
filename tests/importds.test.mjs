// Import d’un design system existant (src/core/importds.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseColor, detectFormat, analyzeImport } from "../src/core/importds.mjs";

test("parseColor lit hex, rgb, hsl, oklch et l’objet DTCG", () => {
  assert.equal(parseColor("#abc"), "#AABBCC");
  assert.equal(parseColor("#2447D1cc"), "#2447D1");
  assert.equal(parseColor("rgb(36, 71, 209)"), "#2447D1");
  assert.equal(parseColor("rgb(36 71 209 / 50%)"), "#2447D1");
  assert.equal(parseColor("hsl(0, 100%, 50%)"), "#FF0000");
  assert.equal(parseColor("oklch(1 0 0)"), "#FFFFFF");
  assert.equal(parseColor({ colorSpace: "srgb", components: [0, 0, 0] }), "#000000");
  assert.equal(parseColor("12px"), null);
  assert.equal(parseColor("var(--x)"), null);
});

test("détection du format", () => {
  assert.equal(detectFormat('{"color":{"a":{"$value":"#fff"}}}'), "json");
  assert.equal(detectFormat(":root{--brand:#2447D1;}"), "css");
  assert.equal(detectFormat("module.exports = { theme: { extend: { colors: { brand: '#2447D1' } } } }"), "tailwind");
  assert.equal(detectFormat("Marque #2447D1\nNuit #0E1B4D"), "liste");
});

test("variables CSS : une couleur par famille, alias comptés, valeurs non couleur ignorées", () => {
  const css = `:root{--color-brand-100:#DCE6FF;--color-brand-300:#7FA1FF;--color-brand-500:#2447D1;--color-brand-700:#162C85;
  --color-ink:#0E1B4D;--text:var(--color-ink);--space-2:8px;--surface: rgb(250 249 244);}`;
  const r = analyzeImport(css);
  assert.equal(r.format, "css");
  assert.equal(r.aliases, 1);
  assert.deepEqual(r.colors.map(c => [c.name, c.hex]), [["Brand", "#2447D1"], ["Ink", "#0E1B4D"], ["Surface", "#FAF9F4"]]);
  assert.equal(r.colors[0].family, 4);
  assert.equal(r.dropped.filter(d => d.why === "nuance").length, 3);
});

test("Tailwind 3 : clés imbriquées, DEFAULT, seulement sous colors", () => {
  const tw = `/** @type {import('tailwindcss').Config} */
module.exports = { theme: { extend: {
  boxShadow: { card: '0 1px 2px #00000033' },
  colors: { // marque
    brand: { 50: '#EEF4FF', 100: '#DCE6FF', 500: '#2447D1', 900: '#0E1B4D' },
    accent: { DEFAULT: '#F5B800' },
    'paper': "#FAF9F4",
  } } } }`;
  const r = analyzeImport(tw);
  assert.equal(r.format, "tailwind");
  assert.deepEqual(r.colors.map(c => [c.name, c.hex]), [["Brand", "#2447D1"], ["Accent", "#F5B800"], ["Paper", "#FAF9F4"]]);
});

test("Tailwind 4 (@theme) passe par les variables CSS", () => {
  const r = analyzeImport("@import 'tailwindcss';\n@theme { --color-mint-500: oklch(0.72 0.11 178); --color-night: #0E1B4D; }");
  assert.equal(r.format, "css");
  assert.deepEqual(r.colors.map(c => c.name), ["Mint 500", "Night"]);
});

test("jetons DTCG et Tokens Studio, avec alias", () => {
  const dtcg = { color: { $type: "color", blue: { 500: { $value: "#2447D1" } }, text: { $value: "{color.blue.500}" }, paper: { $value: { colorSpace: "srgb", components: [1, 1, 1], hex: "#ffffff" } } }, size: { s: { $value: "4px" } } };
  const r = analyzeImport(JSON.stringify(dtcg));
  assert.equal(r.format, "json");
  assert.equal(r.aliases, 1);
  assert.deepEqual(r.colors.map(c => [c.name, c.hex]), [["Blue 500", "#2447D1"], ["Paper", "#FFFFFF"]]);
  const ts = { global: { primary: { value: "#2447D1", type: "color" }, bg: { value: "#fff", type: "color" } } };
  assert.deepEqual(analyzeImport(JSON.stringify(ts)).colors.map(c => c.name), ["Primary", "Bg"]);
});

test("au plus 12 couleurs, doublons et couleurs presque identiques signalés", () => {
  const css = ":root{--twin:#101010;--near:#111111;" + Array.from({ length: 15 }, (_, i) => `--c${i}:#${(0x101010 * (i + 1)).toString(16).padStart(6, "0")};`).join("") + "}";
  const r = analyzeImport(css);
  assert.equal(r.colors.length, 12);
  assert.equal(r.duplicates, 1);
  assert.ok(r.dropped.some(d => d.why === "max"));
  assert.ok(r.close.length >= 1);
});

test("une liste simple garde le comportement d’avant", () => {
  const r = analyzeImport("Nuit #0E1B4D\nMarque #2447D1\n#F5B800");
  assert.deepEqual(r.colors.map(c => [c.name, c.hex]), [["Nuit", "#0E1B4D"], ["Marque", "#2447D1"], ["Couleur 3", "#F5B800"]]);
});
