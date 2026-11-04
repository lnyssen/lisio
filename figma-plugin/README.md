# Lisio pour Figma

Plugin de développement qui importe `lisio-design-system.json` (bouton Exporter de Lisio) :
variables Couleurs, Rôles, Typo et Dimensions, styles de texte liés aux variables, planche de présentation.

Installation (application Figma pour ordinateur) : menu Figma › Plugins › Development › Import new plugin from manifest…, puis `manifest.json`.

`code.js` est généré par `python3 src/build.py` à partir de `core.js` et `main.js`.
