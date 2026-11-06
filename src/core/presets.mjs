// Lisio, modèles de départ (F10). Données pures, testées par tests/presets.test.mjs.
// Un modèle crée un NOUVEAU projet : il ne remplace jamais le projet en cours. Tout reste modifiable ensuite.
// Chaque règle d'un modèle dit d'où elle vient : un critère WCAG, ou un choix de Lisio.
export const PRESET_LIMITS = "Point de départ, pas un système validé : les couleurs, tailles et réglages se modifient comme dans tout projet, et vos écrans restent à vérifier.";
export const PRESETS = [
  { id: "sobre", name: "Service public sobre", use: "Information, démarches, administration : la lecture avant tout.",
    colors: [{ name: "Encre", hex: "#16213E" }, { name: "Bleu", hex: "#1F4FBF" }, { name: "Gris", hex: "#5B6475" }, { name: "Fond", hex: "#F6F7F9" }, { name: "Blanc", hex: "#FFFFFF" }, { name: "Rouge", hex: "#B42318" }, { name: "Vert", hex: "#12715B" }],
    state: { fg: "#16213E", bg: "#FFFFFF", level: "AA", version: "2.2", ds: { shape: "soft", btn: 48, link: "solid", space: 8 }, tsPreset: { base: 18, ratio: "1.2" } },
    rules: [["Niveau AA visé", "WCAG 2.2"], ["Liens soulignés d’un trait plein : un lien se reconnaît sans sa couleur", "1.4.1"], ["Boutons et champs de 48 px : au-dessus du minimum AA de 24 px", "2.5.8"], ["Texte courant de 18 px, échelle 1,2 : titres modérés pour les pages longues", "Choix de Lisio"]] },
  { id: "editorial", name: "Éditorial, longue lecture", use: "Médias, articles, rapports : un texte confortable et des titres qui se détachent.",
    colors: [{ name: "Encre", hex: "#1A1A1A" }, { name: "Papier", hex: "#FBF8F3" }, { name: "Brique", hex: "#B3401B" }, { name: "Nuit", hex: "#1E3A5F" }, { name: "Gris", hex: "#5F5F5F" }],
    state: { fg: "#1A1A1A", bg: "#FBF8F3", level: "AA", version: "2.2", ds: { shape: "square", btn: 44, link: "solid", space: 4 }, tsPreset: { base: 20, ratio: "1.333" } },
    rules: [["Niveau AA visé", "WCAG 2.2"], ["Liens soulignés d’un trait plein", "1.4.1"], ["Texte courant de 20 px, échelle 1,333 (la quarte) : contraste fort entre titres et texte", "Choix de Lisio"], ["Fond papier légèrement chaud, texte presque noir", "Choix de Lisio"]] },
  { id: "renforce", name: "Lecture renforcée (AAA)", use: "Santé, publics âgés ou malvoyants : les seuils les plus exigeants de WCAG.",
    colors: [{ name: "Noir", hex: "#111111" }, { name: "Blanc", hex: "#FFFFFF" }, { name: "Bleu", hex: "#0B3D91" }, { name: "Jaune", hex: "#FFD400" }, { name: "Gris", hex: "#4A4A4A" }],
    state: { fg: "#111111", bg: "#FFFFFF", level: "AAA", version: "2.2", ds: { shape: "round", btn: 56, link: "solid", space: 8 }, tsPreset: { base: 20, ratio: "1.2" } },
    rules: [["Niveau AAA : 7:1 pour le texte courant", "1.4.6"], ["Boutons et champs de 56 px : au-dessus de la cible AAA de 44 px", "2.5.5"], ["Texte courant de 20 px, échelle 1,2", "Choix de Lisio"], ["Liens soulignés d’un trait plein", "1.4.1"]] },
  { id: "media-animation", name: "Palette Média Animation", use: "La palette de Média Animation saisie dans Lisio par l’équipe, avec les réglages de base.",
    colors: [{ name: "Marine", hex: "#0D1D45" }, { name: "Bleu", hex: "#2F6BFF" }, { name: "Turquoise", hex: "#00B3B0" }, { name: "Corail", hex: "#FF5A4E" }, { name: "Orange", hex: "#FF7A1A" }, { name: "Ambre", hex: "#F5A00B" }, { name: "Violet", hex: "#8A3FFC" }, { name: "Magenta", hex: "#D627C9" }, { name: "Blanc", hex: "#FAF9F4" }, { name: "Écru", hex: "#F0EDE7" }],
    state: { fg: "#0D1D45", bg: "#FAF9F4", level: "AA", version: "2.2", ds: { btn: 48 }, tsPreset: { base: 18, ratio: "1.25" } },
    rules: [["Niveau AA visé", "WCAG 2.2"], ["Texte Marine sur fond Blanc", "Choix de l’équipe"], ["Boutons et champs de 48 px", "2.5.8"], ["Les couleurs vives (Corail, Orange, Ambre, Turquoise) servent au décor ou aux grands textes : Lisio dit lesquelles passent", "1.4.3"]] }
];
export const preset = id => PRESETS.find(p => p.id === id) || null;
