# Lisio pour Figma

Plugin de développement, deux onglets.

**Importer** `lisio-design-system.json` (bouton Exporter de Lisio) :
variables Couleurs, Rôles (modes Light et Dark), Typo et Dimensions, styles de texte liés aux variables, styles de grille par écran (Grid/Mobile 390 à Grid/Desktop XL 1440), styles d’effet (Elevation/Light/1 à 4, Elevation/Dark/1 à 4, Blur/Glass) et collection Effects (opacités, flou), planche de présentation,
et en option les composants Bouton, Champ et Alerte (page « Lisio components »), dont les couleurs, hauteurs et arrondis sont reliés aux variables.

**Vérifier les contrastes** d’une maquette existante (sélection, ou page entière) :
chaque texte est mesuré contre le fond uni qui est derrière lui. Pour chaque échec, le plugin propose la couleur la plus proche
de la collection Colors qui passe (même famille de couleur si possible), à appliquer d’un clic ou toutes d’un coup (Ctrl ou Cmd + Z annule).
Il liste aussi les couleurs utilisées et signale celles qui sortent du design system.

Installation (application Figma pour ordinateur) : menu Figma › Plugins › Development › Import new plugin from manifest…, puis `manifest.json`.

`code.js` est généré par `python3 src/build.py` à partir de `core.js` et `main.js`.
