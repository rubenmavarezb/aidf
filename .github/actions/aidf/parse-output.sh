#!/usr/bin/env bash
set -euo pipefail

# parse-output.sh - Posts a formatted comment on a GitHub issue with AIDF task results.
# Requires: gh CLI authenticated, GITHUB_REPOSITORY set.

ISSUE_NUMBER="${1:?Usage: parse-output.sh <issue-number> <status> <task> <iterations> <files-changed> [pr-url]}"
STATUS="${2:?status is required}"
TASK="${3:?task is required}"
ITERATIONS="${4:-0}"
FILES_CHANGED="${5:-}"
PR_URL="${6:-}"

# Status emoji
case "$STATUS" in
  completed) EMOJI="✅" ;;
  blocked)   EMOJI="⚠️" ;;
  *)         EMOJI="❌" ;;
esac

# Build file list (convert comma-separated to markdown list)
FILE_LIST="_none_"
if [[ -n "$FILES_CHANGED" ]]; then
  FILE_LIST=$(echo "$FILES_CHANGED" | tr ',' '\n' | sed 's/^/- `/' | sed 's/$/`/')
fi

# Build PR section
PR_SECTION=""
if [[ -n "$PR_URL" ]]; then
  PR_SECTION="| **Pull Request** | $PR_URL |"
fi

BODY=$(cat <<EOF
## ${EMOJI} AIDF Task Result

| Field | Value |
|-------|-------|
| **Task** | \`$TASK\` |
| **Status** | $STATUS |
| **Iterations** | $ITERATIONS |
${PR_SECTION}

### Files Changed
${FILE_LIST}

---
*Posted by [AIDF GitHub Action](https://github.com/rubenmavarezb/aidf)*
EOF
)

gh issue comment "$ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "$BODY"
echo "Comment posted on issue #$ISSUE_NUMBER"
