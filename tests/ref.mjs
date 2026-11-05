// Implémentation de référence, écrite à part du code de Lisio, directement depuis la définition WCAG 2.2
// (« relative luminance » et « contrast ratio », https://www.w3.org/TR/WCAG22/#dfn-relative-luminance).
// WCAG 2.2 écrit le seuil 0,04045 (2.0 écrivait 0,03928 ; aucun octet sRGB ne tombe entre les deux).
export function refLum(hex) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
export const refRatio = (a, b) => { const x = refLum(a), y = refLum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
// Hasard reproductible (mulberry32) : un échec se rejoue à l'identique.
export function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export const randHex = r => "#" + Math.floor(r() * 0x1000000).toString(16).padStart(6, "0").toUpperCase();
