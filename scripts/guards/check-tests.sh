#!/usr/bin/env bash
# check-tests.sh <ID>
# Enforces the Wave-0 freeze on tests/game/** and tests/fixtures/game/**.
#
# G0: free to write under tests/game/** and tests/fixtures/game/** (this is
# where the frozen fixtures and the skipped acceptance tests are born).
#
# Any other task <ID>: the only legal change to tests/game/** is flipping its
# own
#     describe.skip("[<ID>] ...
# into
#     describe("[<ID>] ...
# Any other `-`/`+` line in tests/game/** or tests/fixtures/game/** is a hard
# failure (file headers `+++ b/...` / `--- a/...` and hunk headers `@@` are
# ignored).

set -euo pipefail

ID="${1:-}"
if [[ -z "$ID" ]]; then
  echo "usage: check-tests.sh <ID>" >&2
  exit 2
fi

if [[ "$ID" == "G0" ]]; then
  echo "✅  tests check: ID=G0 is free to write under tests/game/** and tests/fixtures/game/**"
  exit 0
fi

BASE="$(git merge-base HEAD origin/main 2>/dev/null || true)"
if [[ -z "$BASE" ]]; then
  BASE="$(git merge-base HEAD main 2>/dev/null || true)"
fi
if [[ -z "$BASE" ]]; then
  echo "⚠️  could not find merge-base with origin/main or main — skipping"
  exit 0
fi

DIFF="$(git diff --no-color "$BASE" HEAD -- 'tests/game/**' 'tests/fixtures/game/**' || true)"
if [[ -z "$DIFF" ]]; then
  echo "✅  tests check: no changes under tests/game/** or tests/fixtures/game/**"
  exit 0
fi

ALLOWED_MINUS="^-[[:space:]]*describe\\.skip\\(\"\\[${ID}\\]"
ALLOWED_PLUS="^\\+[[:space:]]*describe\\(\"\\[${ID}\\]"

VIOLATIONS=()
current_file=""
line_no=0
while IFS= read -r line; do
  # File headers set the current file.
  if [[ "$line" =~ ^diff\ --git\ a/(.+)\ b/(.+)$ ]]; then
    current_file="${BASH_REMATCH[2]}"
    line_no=0
    continue
  fi
  # Skip file headers and hunk headers.
  case "$line" in
    "+++ "*|"--- "*) continue ;;
    "@@ "*)
      # Reset line pointer; we don't actually need line numbers here, but
      # track something to make the message useful.
      continue
      ;;
  esac

  # Only inspect fixture / test paths.
  case "$current_file" in
    tests/game/*|tests/fixtures/game/*) ;;
    *) continue ;;
  esac

  line_no=$((line_no + 1))

  # Ignore context lines and additions/removals that are not real content.
  case "$line" in
    "-"*)
      if [[ "$line" =~ $ALLOWED_MINUS ]]; then
        continue
      fi
      VIOLATIONS+=("$current_file: removed → $line")
      ;;
    "+"*)
      if [[ "$line" =~ $ALLOWED_PLUS ]]; then
        continue
      fi
      VIOLATIONS+=("$current_file: added   → $line")
      ;;
  esac
done <<< "$DIFF"

if [[ ${#VIOLATIONS[@]} -eq 0 ]]; then
  echo "✅  tests check: only the allowed describe.skip → describe flip for [$ID]"
  exit 0
fi

echo "❌  tests freeze violated for ID=$ID — the only allowed change under tests/game/** or tests/fixtures/game/** is:"
echo "      -   describe.skip(\"[$ID] …"
echo "      +   describe(\"[$ID] …"
echo ""
echo "Offending diff lines:"
for v in "${VIOLATIONS[@]}"; do
  echo "    $v"
done
exit 1
