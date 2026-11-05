# Lisio

En ligne : https://lisio-psi.vercel.app

Outil d’accessibilité pour l’équipe : matrice de contraste WCAG 2.0, 2.1 et 2.2 de toutes les paires de couleurs, essai typographique (Google Fonts, Adobe Fonts, police importée), nuances, lisibilité du texte.

- `index.html` : le site, autonome, servi tel quel par Vercel (pas de build).
- `src/lisio.template.html` : source de travail ; `src/gf.txt` : catalogue Google Fonts (paquet npm google-font-metadata 6.0.8).

Polices de l’interface : Instrument Sans et Geist Mono (SIL Open Font License), chargées depuis Google Fonts.
Calculs : formule de luminance relative et seuils du W3C (WCAG 2.2, https://www.w3.org/TR/WCAG22/).
