// F09 (P2) : rampes perceptuelles OKLCH, une autre façon de décliner une couleur en 11 nuances.
// La clarté OKLCH (L) descend à pas réguliers du 50 au 950 ; la teinte reste celle de la couleur de départ ;
// la chroma garde la part du gamut sRGB qu'occupe la couleur de départ ; au-delà de sRGB, elle est réduite et signalée (clipped).
// Ce n'est pas une validation WCAG : chaque paire reste mesurée par ratio(), comme dans l'autre méthode.
import { hexToOklch, oklchToLin, maxChroma, linToHex, clamp01, linToOklab, hex2rgb, toLin, STEPS } from "./color.mjs";

// Clarté OKLCH du 50 et du 950 pour chaque choix de l'interface (mêmes boutons que la méthode par contraste).
export const OK_LIGHT = { 1.03: 0.985, 1.06: 0.97, 1.12: 0.94 };
export const OK_DARK = { 15: 0.3, 17.6: 0.25, 19.5: 0.19 };
export const okBounds = (light, dark) => ({ top: OK_LIGHT[light] ?? OK_LIGHT[1.06], bottom: OK_DARK[dark] ?? OK_DARK[17.6] });

// Chroma relative au gamut : la couleur de départ occupe une part de la chroma maximale sRGB à sa clarté ;
// chaque nuance garde cette part (× saturation). À saturation 100 % rien ne sort de sRGB ; au-delà, la chroma
// est ramenée à la limite et la nuance est signalée (clipped).
const gamutC = (L, h) => maxChroma(L, h, 0.5);
export function oklchRamp(hex, { top = OK_LIGHT[1.06], bottom = OK_DARK[17.6], sat = 1, n = STEPS.length } = {}) {
  const b = hexToOklch(hex), g0 = gamutC(b.L, b.h), rel = b.C < 1e-4 || g0 < 1e-4 ? 0 : Math.min(1, b.C / g0) * sat;
  return Array.from({ length: n }, (_, i) => {
    const L = top + (bottom - top) * i / (n - 1), g = gamutC(L, b.h), want = rel * g, C = Math.min(want, g);
    return { hex: linToHex(oklchToLin(L, C, b.h).map(clamp01)), L, C, want, clipped: want - C > 0.002 };
  });
}
// Distance euclidienne dans OKLab, ×100 (0 = identiques, 100 = blanc et noir). Indicateur exploratoire seulement.
const okLabOf = hex => linToOklab(hex2rgb(hex).map(toLin));
export const deltaEok = (a, b) => { const p = okLabOf(a), q = okLabOf(b); return 100 * Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
export const rampSteps = hexes => hexes.slice(1).map((h, i) => deltaEok(hexes[i], h));
// spread : écart le plus grand divisé par le plus petit (1 = pas parfaitement réguliers pour cette mesure).
export function rampStats(hexes) { const s = rampSteps(hexes), min = Math.min(...s), max = Math.max(...s); return { steps: s, min, max, spread: min > 0 ? max / min : Infinity }; }

export const OKLCH_RULES = [
  "OKLCH règle la clarté perçue à pas réguliers : c’est un outil de génération et de cohérence, pas une validation WCAG.",
  "Des pas réguliers de clarté ne donnent pas des contrastes suffisants : Lisio mesure toujours chaque paire, et le 500 n’est plus forcément lisible en texte courant.",
  "Une nuance hors gamut sRGB (trop vive pour un écran standard, par exemple avec une saturation au-delà de 100 %) voit sa chroma réduite ; Lisio le signale.",
  "L’écart ΔE OK entre deux nuances voisines est un indicateur exploratoire, pas un verdict d’accessibilité. La régularité perçue varie d’une personne à l’autre."
];
