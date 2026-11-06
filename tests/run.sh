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
step "Bandeau d'étapes (F01)" node tests/e2e/etapes.mjs
printf '\n%s\n' "$([ $fail -eq 0 ] && echo 'Tous les contrôles passent (contrôles partiels, pas un audit).' || echo "$fail étape(s) en échec.")"
exit $fail
