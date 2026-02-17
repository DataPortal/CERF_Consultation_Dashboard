#!/usr/bin/env bash
set -euo pipefail

# Usage: ./rollback_reset.sh <sha_stable> [branch]
SHA="${1:-}"
BRANCH="${2:-main}"

if [[ -z "$SHA" ]]; then
  echo "Usage: $0 <sha_stable> [branch]"
  exit 1
fi

echo "[1/5] Fetch + checkout branch: $BRANCH"
git fetch origin
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH" || true

echo "[2/5] Reset hard to $SHA"
git reset --hard "$SHA"

echo "[3/5] Push force to origin/$BRANCH"
git push --force origin "$BRANCH"

echo "[4/5] Done. Current HEAD:"
git --no-pager log -1 --oneline
