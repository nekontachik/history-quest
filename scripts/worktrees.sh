#!/usr/bin/env bash
# worktrees.sh <IDs…>
# For each <ID>, create ../hq-<ID> on branch game/<ID> tracking origin/main
# unless the worktree already exists. Idempotent; one line of status per ID.

set -euo pipefail

if [[ $# -eq 0 ]]; then
  echo "usage: worktrees.sh <ID> [<ID>…]" >&2
  exit 2
fi

ROOT="$(git rev-parse --show-toplevel)"
PARENT="$(cd "$ROOT/.." && pwd)"

for ID in "$@"; do
  TARGET="$PARENT/hq-$ID"
  BRANCH="game/$ID"
  if [[ -d "$TARGET" ]]; then
    echo "✅  $ID: worktree already exists at $TARGET"
    continue
  fi
  git -C "$ROOT" worktree add "$TARGET" -b "$BRANCH" origin/main >/dev/null
  echo "✅  $ID: created worktree at $TARGET on branch $BRANCH"
done
