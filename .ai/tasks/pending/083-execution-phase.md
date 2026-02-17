# TASK: Extract iteration loop into ExecutionPhase class

## Goal

Extract the core iteration loop from `Executor.run()` into a dedicated `ExecutionPhase` class that implements `ExecutorPhase<PreFlightResult, ExecutionLoopResult>`. This is the most complex phase, encompassing prompt building, provider execution, scope checking, validation, auto-commit, completion/blocked signal detection, and the termination conditions (max iterations, max failures, dry run).

## Task Type

refactor

## Suggested Roles

- developer

## Auto-Mode Compatible

YES

## Scope

### Allowed

- `packages/cli/src/core/phases/execution.ts` (create)
- `packages/cli/src/core/phases/execution.test.ts` (create)
- `packages/cli/src/core/phases/index.ts` (update exports)

### Forbidden

- `packages/cli/src/core/executor.ts` (read-only — do not modify yet, that happens in task 085)
- `packages/cli/src/commands/` (do not touch)
- `packages/cli/src/core/parallel-executor.ts` (do not touch)

## Requirements

1. Create `packages/cli/src/core/phases/execution.ts` implementing `ExecutionPhase`:

   ```typescript
   export class ExecutionPhase implements ExecutorPhase<PreFlightResult, ExecutionLoopResult> {
     name = 'execution';
     async execute(ctx: PhaseContext, input: PreFlightResult): Promise<ExecutionLoopResult> { ... }
   }
   ```

2. Define an internal `IterationState` interface for mutable per-loop state:
   ```typescript
   interface IterationState {
     consecutiveFailures: number;
     lastValidationError?: string;
     previousOutput?: string;
     conversationState?: unknown;
     blockedStatus: BlockedStatus | null;
   }
   ```

3. Extract the following logic from `Executor.run()` (reference current executor.ts lines from the plan):
   - **While loop with termination conditions** (lines ~201-205): Loop while iteration < max, consecutive failures < max, and state is running.
   - **Prompt building** (lines ~218-242): Build the prompt with full context. On iteration 2+, use continuation prompt if `session_continuation` is enabled. Include validation errors from the previous iteration if any.
   - **Provider execution with timeout** (lines ~244-268): Call `provider.execute()` with timeout enforcement via `executeWithTimeout()`.
   - **Continuation fallback** (lines ~271-296): If continuation fails, fall back to building a full prompt and retrying.
   - **Token usage accumulation** (lines ~303-313): Accumulate token counts (input, output, estimated cost) across iterations.
   - **Provider failure handling** (lines ~317-335): Detect BLOCKED signals in provider output. Track consecutive failures.
   - **Scope violation checking** (lines ~342-384): Use ScopeGuard to check file changes. In strict mode, revert forbidden changes. In ask mode, prompt the user via `onAskUser` callback. Accept completion despite scope violation when completion signal is detected.
   - **Validation execution** (lines ~386-405): Run validator's `preCommit()`. On failure, store the validation error for the next iteration's prompt. On failure with completion signal, retry (do not complete).
   - **Auto-commit** (lines ~411-415): If `autoCommit` is enabled and files changed, commit via git.
   - **Completion signal detection** (lines ~424-444): Detect `<TASK_COMPLETE>`, `<DONE>`, etc. Clear blocked status on completion of resumed tasks.

4. Implement these key private methods:
   - `private executeIteration(ctx, preFlightResult, iterState): Promise<IterationOutcome>`
   - `private buildPrompt(ctx, preFlightResult, iterState): string`
   - `private handleProviderResult(ctx, result, iterState): ProviderResultAction`
   - `private checkScope(ctx, scopeGuard, filesChanged, hasCompletionSignal): ScopeCheckResult`
   - `private runValidation(ctx, validator, hasCompletionSignal): ValidationCheckResult`
   - `private commitIfNeeded(ctx, filesChanged, taskGoal): Promise<void>`

5. Also extract these utility methods from `Executor`:
   - `revertChanges()` — reverts git changes on scope violation
   - `commitChanges()` — performs git add + commit
   - `executeWithTimeout()` — wraps provider.execute with a timeout

6. The phase must return an `ExecutionLoopResult`:
   ```typescript
   {
     completedNormally: boolean,
     terminationReason?: 'completed' | 'blocked' | 'max_iterations' | 'max_failures' | 'dry_run',
     lastError?: string
   }
   ```

7. Update `packages/cli/src/core/phases/index.ts` to export `ExecutionPhase`.

8. Create `packages/cli/src/core/phases/execution.test.ts` with the following tests (all using injected mock dependencies via `PhaseContext.deps`, NOT `vi.mock()`):
   - Test: completes when provider returns completion signal (`<TASK_COMPLETE>`)
   - Test: stops after max iterations
   - Test: stops after max consecutive failures
   - Test: handles dry run mode (breaks immediately after first iteration)
   - Test: handles BLOCKED signal from provider
   - Test: blocks forbidden file changes in strict mode
   - Test: asks user for out-of-scope files in ask mode
   - Test: accepts user approval for out-of-scope files
   - Test: retries when completion signal + validation fails
   - Test: includes validation error in next prompt
   - Test: clears validation error after successful validation
   - Test: uses continuation prompt on iteration 2+
   - Test: falls back to full prompt when continuation fails
   - Test: passes conversationState between iterations
   - Test: disables continuation when session_continuation is false
   - Test: timeout enforcement on provider execution
   - Test: accumulates token usage across iterations
   - Test: commits changes when autoCommit is enabled
   - Test: reverts changes on scope violation

## Definition of Done

- [ ] `packages/cli/src/core/phases/execution.ts` exists with `ExecutionPhase` class
- [ ] All iteration loop logic from `Executor.run()` is replicated in the phase class
- [ ] `IterationState` interface is defined for per-loop mutable state
- [ ] Utility methods (`revertChanges`, `commitChanges`, `executeWithTimeout`) are extracted
- [ ] `ExecutionPhase.execute()` returns a complete `ExecutionLoopResult`
- [ ] `packages/cli/src/core/phases/index.ts` exports `ExecutionPhase`
- [ ] `packages/cli/src/core/phases/execution.test.ts` has 19+ tests covering all branches
- [ ] All tests use dependency injection (no `vi.mock()` for core deps)
- [ ] `pnpm test` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes

## Notes

- Part of PLAN-v080-executor-refactor.md (Phase 2)
- Depends on tasks 080 (ExecutorDependencies) and 081 (phase interfaces)
- Can be done in parallel with tasks 082 and 084
- This is the most complex phase — the iteration loop is ~250 lines of logic
- Do NOT modify `executor.ts` yet — that happens in task 085 (rewire)
- The logic should be extracted faithfully; preserve all edge cases and error handling
- Pay special attention to the `onPhase`, `onIteration`, and `onOutput` callbacks — they must continue to be called at the same points
- The `state` object in `PhaseContext` is mutated in-place (iteration count, filesModified, status, etc.)
