// Lisio, assistant de création en 3 étapes (cahier « Next-Level », 8 novembre 2026). Données pures, testées par tests/wizard.test.mjs.
// L'assistant crée un NOUVEAU projet : il ne remplace jamais le projet en cours.
import { ratio, suggestFix, normHex } from "./color.mjs";
export const WIZ_STEPS = [
  { id: "couleurs", title: "Couleurs", say: "Votre couleur principale et la couleur du fond. Lisio en tire une encre de la même teinte pour le texte, et vérifie tout de suite les contrastes." },
  { id: "police", title: "Police", say: "La police de vos textes, la taille du texte courant et l’écart entre les niveaux de titres. Tout reste réglable ensuite." },
  { id: "validation", title: "Validation", say: "Lisio calcule les 11 nuances de chaque couleur et les contrastes de départ. Vous créez le projet, il s’ouvre sur la grille des contrastes." }
];
export const WIZ_FONTS = [
  ["Figtree", "Sans empattements, ronde et chaleureuse"],
  ["Inter", "Sans empattements, dessinée pour les écrans"],
  ["Atkinson Hyperlegible", "Dessinée par le Braille Institute pour les lecteurs malvoyants"],
  ["Public Sans", "Sans empattements, celle du système de design de l’administration américaine"],
  ["Source Sans 3", "Sans empattements, sobre"],
  ["Lora", "Avec empattements, pour les longs textes"]
];
export const WIZ_SCALES = [["1.2", "1,2 : titres discrets, pour les pages denses"], ["1.25", "1,25 : polyvalent"], ["1.333", "1,333 : titres bien marqués"]];
export const WIZ_BASES = [16, 18, 20];
// Couleur principale + fond → palette de départ. L'encre (texte) garde la teinte de la principale et vise 7:1 (AAA) sur le fond.
export function wizPalette(primary, bg) {
  const p = normHex(primary), b = normHex(bg); if (!p || !b || p === b) return null;
  const ink = ratio(p, b) >= 7 ? p : suggestFix(p, b, 7) || suggestFix(p, b, 4.5) || (ratio("#000000", b) > ratio("#FFFFFF", b) ? "#000000" : "#FFFFFF");
  const colors = [{ name: "Principale", hex: p }, ...(ink !== p ? [{ name: "Encre", hex: ink }] : []), { name: "Fond", hex: b }];
  const rp = ratio(p, b), ri = ratio(ink, b);
  const checks = [
    { id: "ink-text", label: "Texte (encre) sur le fond", r: ri, need: 4.5, ok: ri >= 4.5 },
    { id: "primary-text", label: "Principale sur le fond, en texte", r: rp, need: 4.5, ok: rp >= 4.5 },
    { id: "primary-ui", label: "Principale sur le fond, en bouton ou icône", r: rp, need: 3, ok: rp >= 3 }
  ];
  return { colors, fg: ink, bg: b, checks, fixPrimary: rp < 4.5 ? suggestFix(p, b, 4.5) : null };
}
