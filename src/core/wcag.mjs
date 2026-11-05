// Lisio, cœur WCAG : seuils, grand texte, arrondi d'affichage, verdicts.
// Fonctions pures, sans DOM ni état. Testées par tests/wcag.test.mjs.
// Inliné tel quel dans la page par src/build.py (le mot export est retiré).
// Affichage tronqué, jamais arrondi au supérieur : 4,499 s'affiche 4,49 et échoue, comme le calcul.
export const floor2 = n => Math.floor(n * 100) / 100;
// Grand texte (WCAG 2.2, définition « large scale ») : 18 pt, ou 14 pt en gras ; 1 pt = 4/3 px.
// 18 pt = 24 px ; 14 pt = 18,666… px, arrondi par Lisio à 18,66 px (tolérance de 0,007 px, voulue).
export const largeText = (px, weight) => px >= 24 || (px >= 18.66 && weight >= 700);
// Contraste minimum du texte : 1.4.3 (AA) 4,5:1 ou 3:1 en grand texte ; 1.4.6 (AAA) 7:1 ou 4,5:1.
export const needRatio = (level, large = false) => level === "AAA" ? (large ? 4.5 : 7) : (large ? 3 : 4.5);
// Pastille d'une paire, indépendante du niveau choisi : elle dit le plus haut niveau atteint.
export const grade = r => r >= 7 ? ["AAA", "b-aaa"] : r >= 4.5 ? ["AA", "b-aa"] : r >= 3 ? ["AA grand", "b-lg"] : ["✕ Échec", "b-no"];
// Ratio affiché avec d décimales, tronqué comme floor2 (jamais arrondi au supérieur), virgule française.
// 9,95 s'affiche « 9,9 » avec 1 décimale (et non « 10,0 »), 4,48 s'affiche « 4,4 » (et non « 4,5 »).
// Avec d = 2, le résultat est identique à l'ancien fmt(floor2(r)).
export const ratioTxt = (r, d = 2) => { const k = 10 ** d; return (Math.floor(r * k) / k).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }); };
