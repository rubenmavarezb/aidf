#!/usr/bin/env bash
set -euo pipefail

# entrypoint.sh - Core script for the AIDF GitHub Action
# Runs the aidf CLI, captures results, and sets GitHub Action outputs.

TASK="${INPUT_TASK:?'task' input is required}"
PROVIDER="${INPUT_PROVIDER:-anthropic-api}"
MAX_ITERATIONS="${INPUT_MAX_ITERATIONS:-50}"
AUTO_PR="${INPUT_AUTO_PR:-false}"
WORKING_DIR="${INPUT_WORKING_DIRECTORY:-.}"
LOG_FILE="${RUNNER_TEMP:-/tmp}/aidf-run.log"

cd "$WORKING_DIR"

# Capture initial state for diffing
INITIAL_SHA=$(git rev-parse HEAD)

# Build the aidf command
CMD=(aidf run "$TASK"
  --provider "$PROVIDER"
  --max-iterations "$MAX_ITERATIONS"
  --quiet
  --log-format json
  --log-file "$LOG_FILE"
)

if [[ "$AUTO_PR" == "true" ]]; then
  CMD+=(--auto-pr)
fi

echo "::group::AIDF Execution"
echo "Task:           $TASK"
echo "Provider:       $PROVIDER"
echo "Max iterations: $MAX_ITERATIONS"
echo "Auto PR:        $AUTO_PR"
echo "Log file:       $LOG_FILE"
echo ""

# Run the CLI, piping 'y' for the interactive confirmation prompt.
# The CLI asks "Start autonomous execution?" which defaults to true,
# but needs stdin input in non-TTY environments.
EXIT_CODE=0
echo y | "${CMD[@]}" || EXIT_CODE=$?

echo "::endgroup::"

# Determine status from exit code
case "$EXIT_CODE" in
  0) STATUS="completed" ;;
  2) STATUS="blocked" ;;
  *) STATUS="failed" ;;
esac

# Detect changed files by diffing against initial SHA
CURRENT_SHA=$(git rev-parse HEAD)
if [[ "$INITIAL_SHA" != "$CURRENT_SHA" ]]; then
  FILES_CHANGED=$(git diff --name-only "$INITIAL_SHA" HEAD | paste -sd ',' -)
else
  # Also check unstaged/staged changes in case no commit was made
  FILES_CHANGED=$(git diff --name-only HEAD | paste -sd ',' -)
fi

# Count iterations from log file (each line with "iteration" key)
ITERATIONS=0
if [[ -f "$LOG_FILE" ]]; then
  ITERATIONS=$(grep -c '"iteration"' "$LOG_FILE" 2>/dev/null || echo "0")
fi

# Detect PR URL from log file if auto-pr was enabled
PR_URL=""
if [[ "$AUTO_PR" == "true" && -f "$LOG_FILE" ]]; then
  PR_URL=$(grep -o 'https://github.com/[^"]*pull/[0-9]*' "$LOG_FILE" 2>/dev/null | tail -1 || echo "")
fi

# Set outputs for downstream steps
{
  echo "status=$STATUS"
  echo "files-changed=$FILES_CHANGED"
  echo "pr-url=$PR_URL"
  echo "iterations=$ITERATIONS"
  echo "log-file=$LOG_FILE"
} >> "$GITHUB_OUTPUT"

# Write step summary
STATUS_EMOJI="✅"
if [[ "$STATUS" == "blocked" ]]; then STATUS_EMOJI="⚠️"; fi
if [[ "$STATUS" == "failed" ]]; then STATUS_EMOJI="❌"; fi

cat >> "$GITHUB_STEP_SUMMARY" <<EOF
### ${STATUS_EMOJI} AIDF Task Result

| Field | Value |
|-------|-------|
| **Task** | \`$TASK\` |
| **Status** | $STATUS |
| **Iterations** | $ITERATIONS |
| **Files changed** | ${FILES_CHANGED:-_none_} |
| **PR** | ${PR_URL:-_n/a_} |
| **Log file** | \`$LOG_FILE\` |
EOF

# Exit with the original code so the step reflects the real result
exit "$EXIT_CODE"
