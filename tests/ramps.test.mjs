// F09 (P2) : rampes perceptuelles OKLCH. Outil de génération, jamais une validation WCAG.
//   node --test tests/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { hexToOklch, ratio, STEPS } from "../src/core/color.mjs";
import { oklchRamp, deltaEok, rampSteps, rampStats, OK_LIGHT, OK_DARK, okBounds, OKLCH_RULES } from "../src/core/ramps.mjs";

const HEX = /^#[0-9A-F]{6}$/;

test("11 nuances, clarté OKLCH régulière, du 50 au 950", () => {
  const r = oklchRamp("#2F6BFF");
  assert.equal(r.length, STEPS.length);
  for (const x of r) assert.match(x.hex, HEX);
  const Ls = r.map(x => x.L), d = Ls.slice(1).map((L, i) => Ls[i] - L);
  for (const s of d) assert.ok(Math.abs(s - d[0]) < 1e-9, "pas de clarté constant");
  assert.ok(d[0] > 0, "du plus clair au plus foncé");
  // La clarté mesurée sur la couleur arrondie reste proche de la clarté visée.
  r.forEach(x => assert.ok(Math.abs(hexToOklch(x.hex).L - x.L) < 0.006, x.hex));
});

test("la teinte de la couleur de départ est gardée", () => {
  const h0 = hexToOklch("#00B3B0").h;
  for (const x of oklchRamp("#00B3B0")) if (x.C > 0.03) { const dh = Math.abs(Math.atan2(Math.sin(hexToOklch(x.hex).h - h0), Math.cos(hexToOklch(x.hex).h - h0))); assert.ok(dh < 0.06, x.hex + " " + dh); }
});

test("hors gamut sRGB : chroma réduite et signalée, jamais silencieuse", () => {
  const r = oklchRamp("#00FF00", { sat: 1.4 });
  assert.ok(r.some(x => x.clipped), "au moins une nuance réduite");
  for (const x of r) { assert.ok(x.C <= x.want + 1e-9); assert.equal(x.clipped, x.want - x.C > 0.002); }
  // Un gris n'est jamais réduit.
  assert.ok(oklchRamp("#777777").every(x => !x.clipped && x.C < 0.01));
});

test("réglages : bornes de clarté du 50 et du 950, saturation", () => {
  assert.deepEqual(okBounds(1.06, 17.6), { top: OK_LIGHT[1.06], bottom: OK_DARK[17.6] });
  assert.deepEqual(okBounds(9, 9), { top: OK_LIGHT[1.06], bottom: OK_DARK[17.6] }, "valeur inconnue : réglage standard");
  const a = oklchRamp("#B42318", { top: 0.985, bottom: 0.18 });
  assert.ok(Math.abs(a[0].L - 0.985) < 1e-9 && Math.abs(a[10].L - 0.18) < 1e-9);
  const g = oklchRamp("#B42318", { sat: 0 }); assert.ok(g.every(x => x.C < 1e-9), "saturation 0 : gris");
});

test("écart perceptuel ΔE OK entre nuances voisines : indicateur, pas verdict", () => {
  assert.equal(deltaEok("#FFFFFF", "#FFFFFF"), 0);
  assert.ok(Math.abs(deltaEok("#FFFFFF", "#000000") - 100) < 0.1);
  const r = oklchRamp("#2F6BFF").map(x => x.hex), s = rampSteps(r);
  assert.equal(s.length, 10);
  const st = rampStats(r); assert.ok(st.min > 0 && st.max >= st.min && st.spread >= 1);
});

test("OKLCH ne garantit pas les contrastes : les paires restent à vérifier", () => {
  const r = oklchRamp("#FFD400").map(x => x.hex), y = oklchRamp("#0B3D91").map(x => x.hex);
  // Même numéro, même clarté OKLCH, mais contraste différent sur blanc : la règle des numéros n'est pas garantie.
  assert.notEqual(Math.round(ratio(r[5], "#FFFFFF") * 100), Math.round(ratio(y[5], "#FFFFFF") * 100));
  const txt = OKLCH_RULES.join(" ");
  assert.match(txt, /pas une validation WCAG/); assert.match(txt, /hors gamut/); assert.match(txt, /ΔE/);
  assert.doesNotMatch(txt, /uniforme pour toutes les personnes|accessible|conforme/i);
});
