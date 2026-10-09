#!/usr/bin/env bash
# check-scope.sh <ID>
# Fails if the branch touches any file not covered by docs/game/scopes/<ID>.txt.
#
# The scope file is one POSIX glob per line. Lines starting with `#` or blank
# are ignored. Globs match via shell `case` semantics (so `foo/**` matches
# anything under `foo/`).
#
# If docs/game/scopes/<ID>.txt does not exist (e.g. on `main` before a task),
# the check exits 0 with a warning so it can run safely in CI from any branch.

set -euo pipefail

ID="${1:-}"
if [[ -z "$ID" ]]; then
  echo "usage: check-scope.sh <ID>" >&2
  exit 2
fi

SCOPE_FILE="docs/game/scopes/${ID}.txt"

if [[ ! -f "$SCOPE_FILE" ]]; then
  echo "⚠️  scope file $SCOPE_FILE not found — skipping scope check for ID=$ID"
  exit 0
fi

# Load globs (strip comments + blanks).
PATTERNS=()
while IFS= read -r line || [[ -n "$line" ]]; do
  trimmed="${line%%#*}"
  trimmed="${trimmed#"${trimmed%%[![:space:]]*}"}"
  trimmed="${trimmed%"${trimmed##*[![:space:]]}"}"
  [[ -z "$trimmed" ]] && continue
  PATTERNS+=("$trimmed")
done < "$SCOPE_FILE"

if [[ ${#PATTERNS[@]} -eq 0 ]]; then
  echo "⚠️  scope file $SCOPE_FILE is empty — skipping scope check"
  exit 0
fi

# Determine the merge base and the list of changed files.
BASE="$(git merge-base HEAD origin/main 2>/dev/null || true)"
if [[ -z "$BASE" ]]; then
  BASE="$(git merge-base HEAD main 2>/dev/null || true)"
fi
if [[ -z "$BASE" ]]; then
  echo "⚠️  could not find merge-base with origin/main or main — skipping"
  exit 0
fi

mapfile -t CHANGED < <(git diff --name-only "$BASE" HEAD)

if [[ ${#CHANGED[@]} -eq 0 ]]; then
  echo "✅  scope check: no files changed since $BASE"
  exit 0
fi

VIOLATIONS=()
for f in "${CHANGED[@]}"; do
  match=0
  for pat in "${PATTERNS[@]}"; do
    # shellcheck disable=SC2254
    case "$f" in
      $pat) match=1 ;;
    esac
    if [[ $match -eq 1 ]]; then break; fi
  done
  if [[ $match -eq 0 ]]; then
    VIOLATIONS+=("$f")
  fi
done

if [[ ${#VIOLATIONS[@]} -eq 0 ]]; then
  echo "✅  scope check: all ${#CHANGED[@]} changed files match docs/game/scopes/${ID}.txt"
  exit 0
fi

echo "❌  scope violation for ID=$ID — the following files are outside docs/game/scopes/${ID}.txt:"
for f in "${VIOLATIONS[@]}"; do
  echo "    $f"
done
echo ""
echo "Fix: either narrow your change back to the scope, or widen docs/game/scopes/${ID}.txt (only if the owner agrees)."
exit 1
