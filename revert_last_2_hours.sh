#!/usr/bin/env bash
set -euo pipefail

# Annule (revert) tous les commits des 2 dernières heures sur une branche donnée.
# Usage:
#   ./revert_last_2_hours.sh                # (branche par défaut: main)
#   ./revert_last_2_hours.sh gh-pages       # si GitHub Pages publie depuis gh-pages
#   ./revert_last_2_hours.sh main 120       # minutes (120 = 2h)

BRANCH="${1:-main}"
MINUTES="${2:-120}"

echo "=== Revert des commits des ${MINUTES} dernières minutes sur la branche '${BRANCH}' ==="

# Sécurité : vérifier qu'on est dans un repo git
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Erreur: ce dossier n'est pas un dépôt Git."
  exit 1
fi

echo "[1/7] Fetch + checkout '${BRANCH}'"
git fetch origin
git checkout "$BRANCH"

echo "[2/7] Pull (fast-forward only) origin/${BRANCH}"
git pull --ff-only origin "$BRANCH"

echo "[3/7] Détection des commits sur les ${MINUTES} dernières minutes..."
COMMITS="$(git rev-list --reverse --since="${MINUTES} minutes ago" HEAD)"

if [[ -z "${COMMITS}" ]]; then
  echo "Aucun commit à annuler sur les ${MINUTES} dernières minutes."
  exit 0
fi

echo "Commits à annuler (oldest -> newest):"
echo "${COMMITS}" | while read -r c; do
  echo " - $(git --no-pager log -1 --oneline "$c")"
done

echo "[4/7] Revert en série..."
for c in ${COMMITS}; do
  echo "Revert: $c"
  git revert --no-edit "$c" || {
    echo ""
    echo "⚠️ Conflit détecté pendant le revert du commit: $c"
    echo "Résolvez les conflits puis exécutez:"
    echo "  git revert --continue"
    echo "Ou pour abandonner:"
    echo "  git revert --abort"
    exit 1
  }
done

echo "[5/7] Push des commits de revert vers origin/${BRANCH}"
git push origin "$BRANCH"

echo "[6/7] Terminé. HEAD actuel:"
git --no-pager log -1 --oneline

echo "[7/7] OK ✅ Les changements des 2 dernières heures sont annulés (via revert)."
