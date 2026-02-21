# TASK: Update ParallelExecutor to forward dependencies

## Goal

Update `ParallelExecutor` to optionally accept and forward `ExecutorDependencies` to the `Executor` instances it creates. This is a minimal change: the parallel executor should accept an optional `deps` in its own options and pass it through when creating child Executor instances. If not provided, Executor uses its own defaults (no behavior change).

## Task Type

refactor

## Suggested Roles

- developer

## Auto-Mode Compatible

YES

## Scope

### Allowed

- `packages/cli/src/core/parallel-executor.ts`
- `packages/cli/src/core/parallel-executor.test.ts`

### Forbidden

- `packages/cli/src/core/executor.ts` (read-only)
- `packages/cli/src/core/phases/` (read-only)
- `packages/cli/src/commands/` (do not touch)

## Requirements

1. Update the `ParallelExecutorOptions` type (or the parallel executor constructor) to accept an optional `deps?: ExecutorDependencies` parameter.

2. Update the code where `ParallelExecutor` creates child `Executor` instances to forward the `deps` parameter:
   ```typescript
   // Before:
   const executor = new Executor(config, options, cwd);
   // After:
   const executor = new Executor(config, options, cwd, this.deps);
   ```

3. If `deps` is not provided, the `Executor` will create its own defaults (no behavior change — backward compatible).

4. All existing parallel executor tests must pass without modification.

5. Add one new test: verify that when `deps` is provided in `ParallelExecutorOptions`, it is forwarded to child Executor instances. This can be verified by:
   - Creating a mock deps object
   - Creating a ParallelExecutor with those deps
   - Running a task
   - Verifying that the mock provider from deps was used (e.g., `deps.createProvider` was called)

## Definition of Done

- [ ] `ParallelExecutor` accepts optional `deps` parameter
- [ ] `deps` is forwarded to child `Executor` instances
- [ ] Backward compatible: omitting `deps` preserves current behavior
- [ ] All existing parallel executor tests pass without modification
- [ ] New test verifies deps forwarding
- [ ] `pnpm test` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes

## Notes

- Part of PLAN-v080-executor-refactor.md (Phase 3)
- Depends on task 080 (needs the `ExecutorDependencies` interface)
- Can be done in parallel with tasks 082-086 (only needs the interface, not the phase classes)
- This is a minimal, low-risk change
