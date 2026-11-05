// Tests du cœur couleur. Lancer : node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import * as C from "../src/core/color.mjs";
import { refRatio, rng, randHex } from "./ref.mjs";

test("normHex accepte #abc, abc123, espaces ; refuse le reste", () => {
  assert.equal(C.normHex("#abc"), "#AABBCC");
  assert.equal(C.normHex("abc123"), "#ABC123");
  assert.equal(C.normHex("  #fff "), "#FFFFFF");
  for (const bad of ["", "zzz", "#12345", "#1234567", "rgb(0,0,0)", null, undefined]) assert.equal(C.normHex(bad), null, String(bad));
});

test("hex → rgb → hex est stable", () => {
  const r = rng(1);
  for (let i = 0; i < 2000; i++) { const h = randHex(r); assert.equal(C.rgb2hex(C.hex2rgb(h)), h); }
});

test("ratio : bornes et symétrie", () => {
  assert.equal(C.ratio("#000000", "#FFFFFF"), 21);
  assert.equal(C.ratio("#FFFFFF", "#000000"), 21);
  assert.equal(C.ratio("#2F6BFF", "#2F6BFF"), 1);
  const r = rng(2);
  for (let i = 0; i < 2000; i++) { const a = randHex(r), b = randHex(r), x = C.ratio(a, b);
    assert.equal(x, C.ratio(b, a)); assert.ok(x >= 1 && x <= 21); }
});

test("ratio = implémentation indépendante, 20 000 paires, aucun verdict inversé", () => {
  const r = rng(3);
  for (let i = 0; i < 20000; i++) {
    const a = randHex(r), b = randHex(r), x = C.ratio(a, b), y = refRatio(a, b);
    assert.ok(Math.abs(x - y) < 1e-9, `${a} / ${b} : ${x} ≠ ${y}`);
    for (const t of [3, 4.5, 7]) assert.equal(x >= t, y >= t, `${a} / ${b} au seuil ${t}`);
  }
});

test("le gris le plus clair qui passe 4,5:1 sur blanc est #767676", () => {
  let last = null;
  for (let v = 0; v < 256; v++) { const h = C.rgb2hex([v / 255, v / 255, v / 255]); if (C.ratio(h, "#FFFFFF") >= 4.5) last = h; }
  assert.equal(last, "#767676");
  assert.ok(C.ratio("#777777", "#FFFFFF") < 4.5);
});

test("toLin : seuil 0,04045 sans saut (sRGB, IEC 61966-2-1)", () => {
  const a = C.toLin(0.04045), b = C.toLin(0.04045 + 1e-9);
  assert.ok(Math.abs(a - b) < 1e-6);
  assert.equal(C.toLin(0), 0); assert.equal(C.toLin(1), 1);
});

const HUES = ["#0D1D45", "#2F6BFF", "#00B3B0", "#FF5A4E", "#FF7A1A", "#FAF9F4", "#FFFF00", "#00FF00", "#FF0000", "#777777", "#000000", "#FFFFFF", "#7A4FD0", "#F5B800"];
const shades = h => C.TARGET.map(t => C.colorForY(C.hexToOklch(h), C.targetY(t)));

test("nuances : 11 pas, contraste sur blanc croissant", () => {
  assert.equal(C.STEPS.length, 11); assert.equal(C.TARGET.length, 11);
  for (const h of HUES) { const rs = shades(h).map(x => C.ratio(x, "#FFFFFF"));
    for (let i = 1; i < rs.length; i++) assert.ok(rs[i] > rs[i - 1], `${h} pas ${C.STEPS[i]}`); }
});

test("nuances : chaque pas à ±1 % de sa cible, et 500 passe 4,5:1 sur blanc pour toute teinte", () => {
  for (const h of HUES) shades(h).forEach((x, i) => {
    const r = C.ratio(x, "#FFFFFF");
    assert.ok(Math.abs(r / C.TARGET[i] - 1) < 0.01, `${h} ${C.STEPS[i]} : ${r} pour ${C.TARGET[i]}`);
    if (C.STEPS[i] === 500) assert.ok(r >= 4.5, `${h} 500 : ${r}`);
  });
});

test("nuances : même numéro, même contraste d'une couleur à l'autre (à 2 % près)", () => {
  const all = HUES.map(shades);
  for (let i = 0; i < 11; i++) { const rs = all.map(s => C.ratio(s[i], "#FFFFFF"));
    assert.ok(Math.max(...rs) / Math.min(...rs) < 1.02, `pas ${C.STEPS[i]}`); }
});

test("maxChroma reste dans le gamut sRGB", () => {
  const r = rng(4);
  for (let i = 0; i < 500; i++) { const L = r(), h = r() * 2 * Math.PI, c = C.maxChroma(L, h, 0.4);
    assert.ok(C.inGamut(C.oklchToLin(L, c, h))); }
});

test("suggestFix rend une couleur qui atteint la cible, ou null", () => {
  const r = rng(5);
  for (let i = 0; i < 200; i++) { const a = randHex(r), b = randHex(r);
    for (const t of [3, 4.5, 7]) { const f = C.suggestFix(a, b, t); if (f !== null) assert.ok(C.ratio(f, b) >= t, `${a} sur ${b} → ${f}`); } }
  assert.ok(C.suggestFix("#777777", "#FFFFFF", 4.5) !== null);
});

test("simulate : normal inchangé, achromatopsie en gris", () => {
  assert.equal(C.simulate("#2F6BFF", "normal"), "#2F6BFF");
  const g = C.simulate("#2F6BFF", "achro"); assert.ok(g.slice(1, 3) === g.slice(3, 5) && g.slice(3, 5) === g.slice(5, 7));
  for (const m of ["protan", "deutan", "tritan"]) assert.ok(C.normHex(C.simulate("#FF5A4E", m)));
});
