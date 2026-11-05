# Lisio

En ligne : https://lisio-psi.vercel.app

Outil d’accessibilité pour l’équipe : matrice de contraste WCAG 2.0, 2.1 et 2.2 de toutes les paires de couleurs, essai typographique (Google Fonts, Adobe Fonts, police importée), nuances, lisibilité du texte.

- `index.html` : le site, autonome, servi tel quel par Vercel, généré par `src/build.py`.
- `src/lisio.template.html` : source de travail ; `src/gf.txt` : catalogue Google Fonts (paquet npm google-font-metadata 6.0.8).

Polices de l’interface : Instrument Sans et Geist Mono (SIL Open Font License), chargées depuis Google Fonts.
Calculs : formule de luminance relative et seuils du W3C (WCAG 2.2, https://www.w3.org/TR/WCAG22/).

## Construire

`python3 src/build.py` régénère `index.html`, `dist/artifact.html`, le plugin Figma et les pages guide et slides. Ne jamais modifier `index.html` à la main.

Les calculs purs vivent dans `src/core/` (`color.mjs` : couleur, contraste, nuances ; `wcag.mjs` : seuils, grand texte, verdicts). Le build les insère dans la page à la place des marqueurs `/*@core:…*/`, en retirant seulement le mot `export`. Ils n’importent que des modules voisins de `src/core/`, insérés plus haut dans la même page.

## Tester

Aucune dépendance à installer pour les tests unitaires (Node 20 ou plus) :

```sh
node --test tests/*.test.mjs        # calculs et import de projet : 30 tests, dont 20 000 paires contre une implémentation indépendante
python3 src/build.py                # puis, si Playwright est installé :
node tests/e2e/golden.mjs           # exports identiques, octet pour octet, aux références de tests/golden/
node tests/e2e/projects.mjs         # partage par lien, import, écriture refusée, démarrage sur un projet abîmé
AXE_PATH=…/axe.min.js node tests/e2e/a11y.mjs   # axe-core, erreurs JS, débordement de 320 à 430 px
```

`golden.mjs --write` réécrit les références : seulement quand un changement d’export est voulu, et en le disant dans le commit. Les contrôles Playwright sont ignorés (code 0, message « IGNORÉ ») si Playwright ou axe-core manquent.

Ces contrôles sont partiels : axe ne couvre qu’une partie des critères WCAG. Ils évitent les régressions, ils ne valent ni audit ni conformité.
