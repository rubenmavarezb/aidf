# TASK: Rewire Executor.run() to delegate to phase classes

## Goal

Replace the ~500-line `Executor.run()` method with a ~30-line method that delegates to the three phase classes (`PreFlightPhase`, `ExecutionPhase`, `PostFlightPhase`). Remove all private methods that were extracted to phase classes. Maintain full backward compatibility of the public API. All existing 50+ executor tests must pass without modification.

## Task Type

refactor

## Suggested Roles

- developer

## Auto-Mode Compatible

YES

## Scope

### Allowed

- `packages/cli/src/core/executor.ts`
- `packages/cli/src/core/phases/index.ts`

### Forbidden

- `packages/cli/src/core/executor.test.ts` (must NOT be modified — tests must pass as-is)
- `packages/cli/src/commands/` (do not touch)
- `packages/cli/src/core/parallel-executor.ts` (do not touch yet — task 087)

## Requirements

1. Rewrite `Executor.run()` to approximately:
   ```typescript
   async run(taskPath: string): Promise<ExecutorResult> {
     this.state.status = 'running';
     this.state.startedAt = new Date();
     this.state.iteration = 0;
     this.logger.setContext({ task: taskPath, iteration: 0 });

     const ctx: PhaseContext = {
       config: this.config,
       options: this.options,
       state: this.state,
       cwd: this.cwd,
       taskPath,
       deps: this.deps,
     };

     try {
       // Phase 1: PreFlight
       const preFlight = new PreFlightPhase();
       const preFlightResult = await preFlight.execute(ctx);

       // Phase 2: Execution Loop
       const executionPhase = new ExecutionPhase();
       const executionResult = await executionPhase.execute(ctx, preFlightResult);

       // Phase 3: PostFlight
       const postFlight = new PostFlightPhase();
       return await postFlight.execute(ctx, { preFlightResult, executionResult });
     } catch (error) {
       this.state.status = 'failed';
       this.state.lastError = error instanceof Error ? error.message : 'Unknown error';
       this.state.completedAt = new Date();

       const postFlight = new PostFlightPhase();
       return await postFlight.execute(ctx, {
         preFlightResult: null,
         executionResult: { completedNormally: false, terminationReason: 'failed', lastError: this.state.lastError },
       });
     }
   }
   ```

2. Remove all private methods that were extracted to phase classes:
   - `revertChanges()` -> now in `ExecutionPhase`
   - `commitChanges()` -> now in `ExecutionPhase`
   - `executeWithTimeout()` -> now in `ExecutionPhase`
   - `updateTaskWithBlockedStatus()` -> now in `PostFlightPhase`
   - `updateTaskStatus()` -> now in `PostFlightPhase`
   - `clearBlockedStatus()` -> now in `PostFlightPhase`
   - `recordResumeAttempt()` -> now in `PreFlightPhase` or `PostFlightPhase`
   - `updateResumeAttemptHistory()` -> now in `PostFlightPhase`
   - `stageTaskFileChanges()` -> now in `PostFlightPhase`
   - `buildTokenUsageSummary()` -> now in `PostFlightPhase`
   - `logExecutionSummary()` -> now in `PostFlightPhase`

3. Keep these methods on `Executor` (they are part of the public/semi-public API):
   - `pause()`, `resume()`, `getState()` — public API
   - `emitPhase()` — used by ExecutionPhase via `ctx.options.onPhase`
   - `log()` — used via `ctx.deps.logger`

4. Remove unused imports that are no longer needed after extracting the methods.

5. Add imports for the three phase classes from `./phases/index`.

6. Ensure `packages/cli/src/core/phases/index.ts` has clean barrel exports for all phase classes and types.

7. The resulting `executor.ts` file should be under 150 lines (down from ~987).

## Definition of Done

- [ ] `Executor.run()` is reduced to ~30 lines of phase delegation
- [ ] All extracted private methods are removed from `executor.ts`
- [ ] Public API methods (`pause`, `resume`, `getState`, `executeTask`) remain unchanged
- [ ] `executor.ts` is under 150 lines total
- [ ] `packages/cli/src/core/phases/index.ts` has clean barrel exports
- [ ] All 50+ existing tests in `executor.test.ts` pass WITHOUT any modification to the test file
- [ ] `pnpm test` passes (full suite, 298+ tests)
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm build` passes

## Notes

- Part of PLAN-v080-executor-refactor.md (Phase 3)
- Depends on tasks 082, 083, and 084 (all three phase classes must exist)
- This is the critical integration point — if any phase was extracted incorrectly, tests will fail here
- The key constraint is that `executor.test.ts` must NOT be modified — this validates that the refactor is behavior-preserving
- If tests fail, the issue is in the phase extraction (082-084), not in the test file
- The `PostFlightInput.preFlightResult` type may need to be `PreFlightResult | null` to handle the error catch branch
