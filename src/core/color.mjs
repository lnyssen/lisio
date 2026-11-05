// Lisio, cœur couleur : conversions sRGB, luminance et contraste WCAG, OKLCH, nuances, simulation des daltonismes.
// Fonctions pures, sans DOM ni état. Testées par tests/color.test.mjs.
// Inliné tel quel dans la page par src/build.py (le mot export est retiré) : pas d'import ici.
export const clamp01 = v => Math.min(1, Math.max(0, v));
export const normHex = h => { h = String(h).trim().replace(/^#/, ""); if (/^[0-9a-f]{3}$/i.test(h)) h = h.split("").map(c => c + c).join(""); return /^[0-9a-f]{6}$/i.test(h) ? "#" + h.toUpperCase() : null; };
export const hex2rgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => v / 255); };
export const rgb2hex = rgb => "#" + rgb.map(v => Math.round(clamp01(v) * 255).toString(16).padStart(2, "0")).join("").toUpperCase();
export const toLin = c => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
export const toGam = c => c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
export const Yof = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
export const lum = hex => Yof(hex2rgb(hex).map(toLin));
export const ratio = (a, b) => { const la = lum(a), lb = lum(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };
export function linToOklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
}
export function oklchToLin(L, C, h) {
  const a = C * Math.cos(h), b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
}
export const hexToOklch = hex => { const [L, a, b] = linToOklab(hex2rgb(hex).map(toLin)); return { L, C: Math.hypot(a, b), h: Math.atan2(b, a) }; };
export const inGamut = c => c.every(v => v >= -1e-5 && v <= 1 + 1e-5);
export function maxChroma(L, h, want) { if (inGamut(oklchToLin(L, want, h))) return want; let lo = 0, hi = want; for (let i = 0; i < 22; i++) { const mid = (lo + hi) / 2; if (inGamut(oklchToLin(L, mid, h))) lo = mid; else hi = mid; } return lo; }
export const linToHex = lin => rgb2hex(lin.map(v => toGam(clamp01(v))));
export const chromaShape = (L, L0) => Math.max(0.08, L < L0 ? 1 - 0.45 * ((L0 - L) / Math.max(L0, 0.05)) ** 2 : 1 - 0.85 * ((L - L0) / Math.max(1 - L0, 0.05)) ** 2);
export function colorForY(base, targetY) {
  const { L: L0, C: C0, h } = base; let lo = 0, hi = 1, lin = [0, 0, 0];
  for (let i = 0; i < 32; i++) { const mid = (lo + hi) / 2; lin = oklchToLin(mid, maxChroma(mid, h, C0 * chromaShape(mid, L0)), h).map(clamp01); if (Yof(lin) < targetY) lo = mid; else hi = mid; }
  return linToHex(lin);
}
export const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
export const TARGET = [1.06, 1.15, 1.4, 1.9, 3.1, 4.65, 6.1, 8.1, 11, 14.6, 17.6];
export const targetY = r => 1.05 / r - 0.05;
export const CVD = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]]
};
export function simulate(hex, mode) { if (mode === "normal") return hex; const lin = hex2rgb(hex).map(toLin); if (mode === "achro") { const y = Yof(lin); return linToHex([y, y, y]); } return linToHex(CVD[mode].map(r => r[0] * lin[0] + r[1] * lin[1] + r[2] * lin[2])); }
export function suggestFix(moveHex, otherHex, target) {
  const { L: L0, C, h } = hexToOklch(moveHex); let best = null, bestD = Infinity;
  for (let k = 0; k <= 400; k++) { const L = k / 400, hex = linToHex(oklchToLin(L, maxChroma(L, h, C), h).map(clamp01)); if (ratio(hex, otherHex) >= target) { const d = Math.abs(L - L0); if (d < bestD) { bestD = d; best = hex; } } }
  return best;
}
