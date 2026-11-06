# Lisio pour Figma

Plugin de développement, deux onglets.

**Importer** `lisio-design-system.json` (bouton Exporter de Lisio) :
variables Couleurs, Rôles (modes Light et Dark), Typo et Dimensions, styles de texte liés aux variables, styles de grille par écran (Grid/Mobile 390 à Grid/Desktop XL 1440), styles d’effet (Elevation/Light/1 à 4, Elevation/Dark/1 à 4, Blur/Glass) et collection Effects (opacités, flou), planche de présentation,
et en option les composants Bouton, Champ et Alerte (page « Lisio components »), dont les couleurs, hauteurs et arrondis sont reliés aux variables.

Avant d’écrire, le plugin compare le fichier et le design system, puis affiche les ajouts, les modifications (ancienne et nouvelle valeur), les éléments identiques, et les suppressions ou renommages proposés. L’import ne part qu’après « Confirmer ».
Rien n’est supprimé ni renommé sans case cochée : une variable de même nom mais d’un autre type reste telle quelle (non importée), `base` n’est pas renommée en `main` (la nouvelle est créée à côté), le premier mode d’une collection existante garde son nom, et l’ancienne planche reste (la nouvelle se place à droite).

**Vérifier les contrastes** d’une maquette existante (sélection, ou page entière) :
chaque texte est mesuré contre le fond uni qui est derrière lui. Pour chaque échec, le plugin propose la couleur la plus proche
de la collection Colors qui passe (même famille de couleur si possible), à appliquer d’un clic ou toutes d’un coup (Ctrl ou Cmd + Z annule).
Il liste aussi les couleurs utilisées et signale celles qui sortent du design system.

Installation (application Figma pour ordinateur) : menu Figma › Plugins › Development › Import new plugin from manifest…, puis `manifest.json`.

`code.js` est généré par `python3 src/build.py` à partir de `core.js` et `main.js`, avec le cœur de Lisio (`src/core/color.mjs` et `wcag.mjs`) inliné aux marqueurs `/*@core:…*/` : le plugin mesure les contrastes avec le même code que le site.
Tests : `node --test tests/figma-plugin.test.mjs` (faux Figma, `tests/figma-mock.mjs`) et `node tests/e2e/figma-ui.mjs` (écran du plugin dans Chromium).
