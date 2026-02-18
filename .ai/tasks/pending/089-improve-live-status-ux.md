# TASK: Improve live status display during task execution

## Goal

Improve the live status line shown during `aidf run` and `aidf watch` to display useful context instead of the current minimal "Iteration 1/10 · Executing AI · 0 files · ⏱ 1:57" which provides almost no feedback during long AI calls.

## Task Type

refactor

## Suggested Roles

- developer

## Scope

### Allowed
- packages/cli/src/utils/live-status.ts
- packages/cli/src/core/executor.ts

### Forbidden
- packages/cli/src/core/providers/

## Requirements

1. **Show task name in status line.** Extract the task ID and title from the filename (e.g., `080-executor-dependencies-interface.md` → "Task 080: Extract executor dependencies"). Pass it to the live status display.

2. **Fix "0 files" during execution.** The file count only updates after the AI responds. During "Executing AI" phase, either hide the file count or show the count from the previous iteration.

3. **Show phase transitions clearly.** Each phase should be visually distinct:
   - `⠏ Task 080 · Iter 1/10 · Waiting for AI... · ⏱ 1:57`
   - `▸ Task 080 · Iter 1/10 · 2 files modified · Checking scope...`
   - `▸ Task 080 · Iter 1/10 · 2 files modified · Validating (pnpm lint)...`
   - `✓ Task 080 · Iter 1/10 · 2 files · Lint OK · Typecheck OK`

4. **Reduce repetitive output.** The current implementation prints a new line every 3 seconds with the same content. The spinner should update in-place (single line rewrite) instead of producing new lines.

5. **Show completion/continuation signal.** After each iteration, briefly show what happened:
   - `✓ Iter 1 complete · 2 files · Continuing...`
   - `✓ Iter 3 complete · TASK_COMPLETE signal detected`
   - `✗ Iter 2 · Validation failed (typecheck)`

## Definition of Done

- [ ] Task name/ID visible in the status line during execution
- [ ] File count is 0 only on first iteration before AI responds, not perpetually
- [ ] Phase names (Executing AI, Checking scope, Validating) are clear and distinct
- [ ] Status line updates in-place instead of printing new lines every 3 seconds
- [ ] Brief summary shown after each iteration completes
- [ ] Existing tests pass, no regressions

## Notes

This is a UX improvement only — no changes to execution logic, providers, or validation. The `PhaseEvent` type and `onPhase` callback in the executor already provide the data; this task is about displaying it better in `live-status.ts`.
