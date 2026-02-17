# TASK: E2E tests for parallel executor conflict detection and serialization

## Goal

Test the parallel executor's conflict detection, dependency analysis, serialization of conflicting tasks, and retry logic with real files on disk. File: `packages/cli/src/__tests__/e2e/parallel-conflicts.e2e.test.ts`.

## Task Type

test

## Suggested Roles

- tester

## Auto-Mode Compatible

YES

## Scope

### Allowed

- `packages/cli/src/__tests__/e2e/parallel-conflicts.e2e.test.ts`

### Forbidden

- `packages/cli/src/core/parallel-executor.ts` (read-only)
- `packages/cli/src/core/executor.ts` (read-only)
- `packages/cli/src/core/safety.ts` (read-only)
- `packages/cli/src/commands/**` (read-only)
- `packages/cli/src/utils/**` (read-only)

## Requirements

1. **Two tasks with overlapping allowed scope are serialized** — Create task-A with `allowed: ['src/shared/**', 'src/a/**']` and task-B with `allowed: ['src/shared/**', 'src/b/**']`. Both share `src/shared/**`. Verify `detectDependencies()` identifies the overlap and creates a dependency.

2. **Two tasks with disjoint scopes run in parallel** — Create task-A with `allowed: ['src/a/**']` and task-B with `allowed: ['src/b/**']`. Verify no dependencies are detected and both are scheduled concurrently.

3. **Runtime conflict detection** — Create two tasks that both modify `src/shared/utils.ts`. Mock providers to both return `filesChanged: ['src/shared/utils.ts']`. Verify the parallel executor detects the conflict, queues the second task for retry, and the final result reports the conflict in `fileConflicts`.

4. **Conflict retry succeeds** — After a runtime conflict is detected, verify the conflicted task is retried after the first task completes. Mock the retry to succeed. Verify final `ParallelExecutionResult.success` is `true`.

5. **Three tasks: A and B conflict, C is independent** — Verify C runs in parallel with whichever of A/B runs first, and the conflicting task is serialized after the first completes.

6. **Concurrency limit respected** — Create 5 tasks with disjoint scopes. Set `concurrency: 2`. Verify at most 2 tasks are executing simultaneously (track via `onTaskStart`/`onTaskComplete` callbacks with timestamps).

7. **All tasks fail -> overall failure** — Mock all providers to return `success: false`. Verify `ParallelExecutionResult.success` is `false`, `failed` count equals total tasks, `completed` is 0.

8. **Mixed results** — 3 tasks: one completes, one blocks, one fails. Verify `completed: 1, blocked: 1, failed: 1` in the result.

9. **File conflict tracking in result** — Verify `ParallelExecutionResult.fileConflicts` contains the exact list of conflicting file paths.

10. **Total iterations and files modified aggregation** — Verify `totalIterations` sums all task iterations and `totalFilesModified` is the deduplicated union of all tasks' modified files.

## Definition of Done

- [ ] All 10 test cases are implemented and passing
- [ ] Tests use E2E helpers from task 090 (`createTempProject`, `createTaskFixture`)
- [ ] Dependency detection is tested with real task definitions and scope patterns
- [ ] Runtime conflict detection is tested with mock providers that simulate file modifications
- [ ] Concurrency limit test verifies timing/ordering constraints
- [ ] Mixed results test verifies all possible outcome combinations
- [ ] File conflict tracking includes exact file paths
- [ ] Aggregation test verifies correct summation and deduplication
- [ ] Each test creates its own temp directory and cleans up after itself
- [ ] `pnpm test` — all existing tests continue to pass

## Notes

- Part of PLAN-v080-e2e-tests.md
- Depends on task 090 (E2E test infrastructure)
- Benefits from task 091 (filesystem scope helpers can be reused)
- Concurrency timing tests may need some tolerance for CI environments
