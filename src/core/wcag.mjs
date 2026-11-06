// Lisio, cœur WCAG : seuils, grand texte, arrondi d'affichage, verdicts.
// Fonctions pures, sans DOM ni état. Testées par tests/wcag.test.mjs.
// Inliné tel quel dans la page par src/build.py (le mot export est retiré).
// Affichage tronqué, jamais arrondi au supérieur : 4,499 s'affiche 4,49 et échoue, comme le calcul.
// Tronque à d décimales. Un nombre déjà exact à d décimales reste tel quel : 4,53 * 100 vaut 452,999… en virgule
// flottante, et Math.floor seul affichait 4,52 (P0-3). La tolérance (quelques ulp) ne fait jamais passer un seuil :
// un ratio calculé juste sous 4,5 reste sous 4,5.
const floorTo = (n, d) => { const k = 10 ** d, m = Math.round(n * k); return Math.abs(m / k - n) <= Number.EPSILON * Math.max(1, Math.abs(n)) * 4 ? m / k : Math.floor(n * k) / k; };
export const floor2 = n => floorTo(n, 2);
// Grand texte (WCAG 2.2, définition « large scale ») : 18 pt, ou 14 pt en gras ; 1 pt = 4/3 px.
// 18 pt = 24 px ; 14 pt = 18,666… px, arrondi par Lisio à 18,66 px (tolérance de 0,007 px, voulue).
export const largeText = (px, weight) => px >= 24 || (px >= 18.66 && weight >= 700);
// Contraste minimum du texte : 1.4.3 (AA) 4,5:1 ou 3:1 en grand texte ; 1.4.6 (AAA) 7:1 ou 4,5:1.
export const needRatio = (level, large = false) => level === "AAA" ? (large ? 4.5 : 7) : (large ? 3 : 4.5);
// Pastille d'une paire, selon le niveau visé.
// Au niveau AA : le plus haut niveau atteint. Au niveau AAA (P0-3) : seuls 7:1 (tout texte) et 4,5:1 (grand texte)
// comptent, pour qu'une paire à 5:1 ne ressemble pas à une réussite du texte courant.
export const grade = (r, level = "AA") => level === "AAA"
  ? (r >= 7 ? ["AAA", "b-aaa"] : r >= 4.5 ? ["AAA grand", "b-lg"] : ["✕ Échec", "b-no"])
  : (r >= 7 ? ["AAA", "b-aaa"] : r >= 4.5 ? ["AA", "b-aa"] : r >= 3 ? ["AA grand", "b-lg"] : ["✕ Échec", "b-no"]);
// Ratio affiché avec d décimales, tronqué comme floor2 (jamais arrondi au supérieur), virgule française.
// 9,95 s'affiche « 9,9 » avec 1 décimale (et non « 10,0 »), 4,48 s'affiche « 4,4 » (et non « 4,5 »).
// Avec d = 2, le résultat est identique à l'ancien fmt(floor2(r)).
export const ratioTxt = (r, d = 2) => { return floorTo(r, d).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }); };
