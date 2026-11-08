// Lisio, projet démo et visite guidée (F06). Données pures, testées par tests/demo.test.mjs.
// La démo est un projet à part, marqué state.demo : elle ne remplace jamais un projet de l'utilisateur.
// La palette contient exprès deux défauts, pour voir Lisio corriger et pas seulement valider :
//   Orange #D9480F ne passe le texte courant avec aucune autre couleur (au mieux 4,30:1 avec Blanc) ;
//   Ciel #38BDF8 sur Blanc reste à 2,14:1.
export const DEMO_NOTE = "Vos projets ne sont pas touchés : tout ce que vous changez ici reste dans la démo.";
export const DEMO = {
  name: "Démo Lisio",
  colors: [{ name: "Nuit", hex: "#0F172A" }, { name: "Bleu", hex: "#2563EB" }, { name: "Ciel", hex: "#38BDF8" }, { name: "Gris", hex: "#64748B" }, { name: "Orange", hex: "#D9480F" }, { name: "Blanc", hex: "#FFFFFF" }],
  state: { demo: true, fg: "#0F172A", bg: "#FFFFFF", level: "AA", version: "2.2", tsPreset: { base: 16, ratio: "1.25" } }
};
const TOUR = [
  ["couleurs", "Couleurs", "Six couleurs d’une marque inventée. L’Orange ne se lit en texte courant avec aucune autre : Lisio le signale sous « À corriger avant d’aller plus loin » et propose de le corriger en gardant sa teinte.", "Le bouton « Corriger : Orange → … », ou « Décorative : laisser telle quelle » si l’Orange ne sert qu’au décor."],
  ["palette", "Nuances", "Chaque couleur devient une gamme de 11 nuances, de 50 à 950. Les nuances de même numéro ont la même clarté d’une couleur à l’autre : si Gris 700 sur Gris 50 passe, Bleu 700 sur Bleu 50 passe aussi.", "Les gammes, et les numéros de 50 à 950."],
  ["tester", "Polices", "Choisissez une police et voyez-la sur un vrai texte, avec les couleurs de la démo. Sous 12 px, Lisio vous prévient.", "L’aperçu du texte et le choix de la police."],
  ["styles", "Styles de texte", "La démo part d’un texte de 16 px et d’une échelle de 1,25. Vous réglez le desktop, Lisio calcule le mobile et vérifie chaque style, y compris le zoom à 200 %.", "Les tailles de chaque style et leur verdict."],
  ["systeme", "Design system", "Les rôles donnent un métier aux nuances : texte, fond, action. Lisio en déduit le mode sombre et revérifie chaque paire. La page Composants montre les boutons, champs et alertes état par état.", "Les rôles, le mode sombre, puis la page Composants."],
  ["matrice", "Contrastes", "La matrice croise chaque texte avec chaque fond. Ciel sur Blanc reste à 2,14:1, sous le seuil de 4,5:1 : ouvrez la case, Lisio montre l’avant et l’après et propose une couleur corrigée.", "La case Ciel sur Blanc, puis le détail de la paire."],
  ["exporter", "Exporter", "Un fichier CSS, un fichier JSON et un plugin pour Figma. Lisio vérifie une partie des critères WCAG, pas tous : vos écrans restent à tester, au clavier et avec un lecteur d’écran.", "Les formats d’export et ce que chacun contient."]
];
export const demoTour = () => TOUR.map(([step, title, say, look]) => ({ step, title, say, look }));
