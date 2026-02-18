# TASK: Extract PostFlight logic into PostFlightPhase class

## Goal

Extract all post-execution logic from `Executor.run()` into a dedicated `PostFlightPhase` class that implements `ExecutorPhase<PostFlightInput, ExecutorResult>`. This includes task status file updates, task file movement to completed/blocked/failed folders, git staging, auto-push, token usage summary, execution summary logging, and notification dispatch.

## Task Type

refactor

## Suggested Roles

- developer

## Auto-Mode Compatible

YES

## Scope

### Allowed

- `packages/cli/src/core/phases/postflight.ts` (create)
- `packages/cli/src/core/phases/postflight.test.ts` (create)
- `packages/cli/src/core/phases/index.ts` (update exports)

### Forbidden

- `packages/cli/src/core/executor.ts` (read-only — do not modify yet, that happens in task 085)
- `packages/cli/src/commands/` (do not touch)
- `packages/cli/src/core/parallel-executor.ts` (do not touch)

## Requirements

1. Create `packages/cli/src/core/phases/postflight.ts` implementing `PostFlightPhase`:

   ```typescript
   export class PostFlightPhase implements ExecutorPhase<PostFlightInput, ExecutorResult> {
     name = 'postflight';
     async execute(ctx: PhaseContext, input: PostFlightInput): Promise<ExecutorResult> { ... }
   }
   ```

2. Extract the following logic from `Executor.run()` (reference current executor.ts lines from the plan):
   - **Max iterations reached check** (lines ~452-473): Detect if termination was due to max iterations, update task status to FAILED with appropriate message.
   - **Max consecutive failures check** (lines ~476-497): Detect if termination was due to max failures, update task status to FAILED.
   - **Task status file writing** (lines ~507-536): Write COMPLETED, FAILED, or BLOCKED status sections to the task markdown file.
   - **Task file movement** (lines ~514-552): Move the task file to the appropriate folder (`completed/`, `blocked/`, or `failed/`) based on outcome.
   - **Git staging of task file changes** (lines ~521-535, ~541-552): Stage the moved task file and remove the old path from git index.
   - **Auto-push** (lines ~555-558): If `autoPush` is enabled, push to remote.
   - **Token usage summary** (line ~561): Build the token usage summary string.
   - **ExecutorResult construction** (lines ~563-572): Assemble the final `ExecutorResult` object.
   - **Execution summary logging** (lines ~575-579): Log a summary box with iteration count, files modified, duration, and token usage.
   - **Notification dispatch** (lines ~581-585): Send notifications via `deps.notificationService`.

3. Also extract these private methods from `Executor` into the phase class:
   - `updateTaskWithBlockedStatus(taskPath, blockedStatus)` (lines ~768-807): Write blocked status section to the task file.
   - `updateTaskStatus(taskPath, status, details)` (lines ~881-932): Write a `## Status: <STATUS>` section to the task file with execution log.
   - `clearBlockedStatus(taskPath)` (lines ~937-974): Remove the blocked status section from a task file.
   - `recordResumeAttempt(taskPath, blockedStatus)` (lines ~812-841): Record that a resume was attempted in the task file.
   - `updateResumeAttemptHistory(taskPath, blockedStatus)` (lines ~846-876): Update the resume attempt history section.
   - `stageTaskFileChanges(taskPath)` (lines ~740-752): Git add the task file.
   - `buildTokenUsageSummary(tokenUsage)` (lines ~620-646): Format token usage into a human-readable string.
   - `logExecutionSummary(result)` (lines ~651-676): Log a bordered summary box.

4. The phase must handle the case where `preFlightResult` is null (when an error occurred before PreFlight completed) — it should still write a FAILED status and return an error result.

5. Update `packages/cli/src/core/phases/index.ts` to export `PostFlightPhase`.

6. Create `packages/cli/src/core/phases/postflight.test.ts` with the following tests (all using injected mock dependencies, especially `deps.fs` and `deps.git`, NOT `vi.mock()`):
   - Test: writes COMPLETED status to task file
   - Test: writes FAILED status to task file
   - Test: writes BLOCKED status to task file
   - Test: moves task file to completed/ folder on success
   - Test: moves task file to blocked/ folder on block
   - Test: stages task file changes in git
   - Test: stages moved task file and removes old path
   - Test: handles moveTaskFile throwing (graceful fallback, logs warning)
   - Test: handles stageTaskFileChanges throwing (graceful fallback, logs warning)
   - Test: pushes to remote when autoPush is enabled
   - Test: builds token usage summary correctly (input, output, total tokens)
   - Test: builds token usage summary with estimated cost
   - Test: logs execution summary box with correct title
   - Test: dispatches notification on completion
   - Test: dispatches notification on failure
   - Test: records resume attempt in task file
   - Test: updates resume attempt history
   - Test: clears blocked status on resumed task completion

## Definition of Done

- [ ] `packages/cli/src/core/phases/postflight.ts` exists with `PostFlightPhase` class
- [ ] All post-execution logic from `Executor.run()` is replicated in the phase class
- [ ] All 8 private helper methods are extracted into the class
- [ ] Handles null `preFlightResult` gracefully (error case)
- [ ] `PostFlightPhase.execute()` returns a complete `ExecutorResult`
- [ ] `packages/cli/src/core/phases/index.ts` exports `PostFlightPhase`
- [ ] `packages/cli/src/core/phases/postflight.test.ts` has 18+ tests covering all branches
- [ ] All tests use dependency injection (no `vi.mock()` for core deps)
- [ ] `pnpm test` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes

## Notes

- Part of PLAN-v080-executor-refactor.md (Phase 2)
- Depends on tasks 080 (ExecutorDependencies) and 081 (phase interfaces)
- Can be done in parallel with tasks 082 and 083
- Do NOT modify `executor.ts` yet — that happens in task 085 (rewire)
- File operations (`deps.fs.readFile`, `deps.fs.writeFile`) are heavily used in this phase — mock them carefully in tests
- Git operations (`deps.git.add`, `deps.git.commit`, `deps.git.push`) are also used — mock them in tests
- All file movement and status update operations must be wrapped in try/catch with graceful fallback (log warning, don't crash)
