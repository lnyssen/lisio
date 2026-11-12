// Lisio, nom et apparence d’une couleur : signale un nom qui promet une teinte que la couleur n’a pas
// (ex. « Bleu » #EEF4FF, presque blanc : ses 11 nuances sortent grises). Fonctions pures, testées par tests/naming.test.mjs.
import { hexToOklch } from "./color.mjs";

// Mots de teinte (français et anglais) et plage de teinte OKLCH en degrés.
const HUE_WORDS = [
  [/\b(rouge|red|carmin|cerise|framboise)\b/i, "rouge", [[0, 40], [350, 360]]],
  [/\b(orange|corail|coral|abricot|rouille|rust)\b/i, "orange", [[20, 80]]],
  [/\b(jaune|yellow|ambre|amber|soleil|sun|or|gold|moutarde)\b/i, "jaune", [[60, 115]]],
  [/\b(vert|green|menthe|mint|olive|sauge|sage|lime)\b/i, "vert", [[100, 175]]],
  [/\b(turquoise|teal|cyan|aqua|lagon)\b/i, "turquoise", [[160, 230]]],
  [/\b(bleu|blue|azur|ciel|sky|marine|navy|indigo|cobalt)\b/i, "bleu", [[210, 290]]],
  [/\b(violet|purple|lilas|lavande|lavender|mauve|prune|plum)\b/i, "violet", [[270, 330]]],
  [/\b(rose|pink|magenta|fuchsia|framboise)\b/i, "rose", [[310, 360], [0, 20]]]
];
const NEUTRAL_C = 0.045;
const NAMING_PL = { rouge: "rouges", orange: "orange", jaune: "jaunes", vert: "vertes", turquoise: "turquoise", bleu: "bleues", violet: "violettes", rose: "roses" };
// Renvoie null si le nom et la couleur s’accordent, sinon { kind: "neutre" | "teinte", word, message }.
export function nameMismatch(name, hex) {
  const hit = HUE_WORDS.find(([re]) => re.test(String(name || "")));
  if (!hit) return null;
  const { C, h } = hexToOklch(hex), deg = ((h * 180 / Math.PI) + 360) % 360;
  if (C < NEUTRAL_C) return { kind: "neutre", word: hit[1], message: `Presque neutre : les 11 nuances de « ${name} » seront grises, pas ${NAMING_PL[hit[1]]}` };
  const near = hit[2].some(([a, b]) => deg >= a - 12 && deg <= b + 12);
  return near ? null : { kind: "teinte", word: hit[1], message: `« ${name} » ne ressemble pas à du ${hit[1]} : vérifiez le code ou renommez la couleur` };
}
