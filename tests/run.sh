#!/usr/bin/env sh
# Lance tous les contrôles de Lisio, dans l'ordre, et donne un bilan.
#   sh tests/run.sh
# Les contrôles de navigateur demandent Playwright (Chromium) ; a11y.mjs demande aussi axe-core (AXE_PATH).
# Sans eux, ils sont ignorés et le disent, sauf si la variable CI est définie : ils échouent alors.
cd "$(dirname "$0")/.." || exit 1
fail=0
step() { printf '\n== %s\n' "$1"; shift; "$@" || { fail=$((fail + 1)); printf 'ÉCHEC : %s\n' "$*"; }; }
step "Construction" python3 src/build.py
git checkout -q -- lisio-figma-plugin.zip 2>/dev/null # l'archive change à chaque construction (dates du zip)
step "Tests unitaires" node --test tests/*.test.mjs
step "Exports de référence" node tests/e2e/golden.mjs
step "Projets : lien, import, enregistrement" node tests/e2e/projects.mjs
step "Interface : axe, débordement, fenêtres" node tests/e2e/a11y.mjs
step "Défauts de l'audit du 5 novembre 2026" node tests/e2e/audit.mjs
step "Menu par intention" node tests/e2e/menu.mjs
step "Ligne d’aide repliable" node tests/e2e/aide-ligne.mjs
step "Bandeau d'étapes (F01)" node tests/e2e/etapes.mjs
step "Formulations et statuts (P0-3)" node tests/e2e/honnetete.mjs
step "Page Couleurs, nuances, blocs à inclure (P0-4)" node tests/e2e/nuances.mjs
step "Résumé permanent (P0-5)" node tests/e2e/resume.mjs
step "Cinq statuts du blueprint (P0-3 bis)" node tests/e2e/statuts.mjs
step "Plugin Figma : aperçu et accord (P0-6)" node tests/e2e/figma-ui.mjs
step "Recherche dans les sélecteurs (P1, F04)" node tests/e2e/recherche.mjs
step "Comment tester ? (P1, F07)" node tests/e2e/aide.mjs
step "Focus, cibles et états (P1, F08)" node tests/e2e/interaction.mjs
step "Modèles de départ (P1, F10)" node tests/e2e/presets.mjs
step "Rapport Markdown et JSON (P1, F11)" node tests/e2e/rapport.mjs
step "Export CSS et copie par ligne (P1, F12)" node tests/e2e/export.mjs
step "Accueil et affichage Essentiel / Avancé (P1)" node tests/e2e/modes.mjs
step "Mobile : volets, menu, barre de la page Polices" node tests/e2e/mobile.mjs
step "Une couleur par style de texte" node tests/e2e/style-couleurs.mjs
step "Couleurs laissées telles quelles, pour le décor" node tests/e2e/decor.mjs
step "Contrastes : toujours une grille texte sur fond" node tests/e2e/grille.mjs
step "Images et voile sur photo : options" node tests/e2e/voile.mjs
step "Rampes OKLCH (P2, F09)" node tests/e2e/oklch.mjs
step "Composants état par état (P2, F13)" node tests/e2e/composants.mjs
step "Projet démo et visite guidée (P2, F06)" node tests/e2e/demo.mjs
step "Assistant de création en 3 étapes (Next-Level)" node tests/e2e/assistant.mjs
step "Versions et décisions (P2)" node tests/e2e/versions.mjs
printf '\n%s\n' "$([ $fail -eq 0 ] && echo 'Tous les contrôles passent (contrôles partiels, pas un audit).' || echo "$fail étape(s) en échec.")"
exit $fail
