# TASK: Tests for executor error category handling

## Goal

Extend `packages/cli/src/core/executor.test.ts` with tests for the new error category handling. Test all per-category behaviors: immediate abort, retry, backoff, feed-back-to-AI, and mixed error sequences. At least 15 new test cases.

## Task Type

test

## Suggested Roles

- tester

## Auto-Mode Compatible

YES

## Scope

### Allowed

- `packages/cli/src/core/executor.test.ts`

### Forbidden

- `packages/cli/src/core/executor.ts` (read-only)
- `packages/cli/src/core/errors.ts` (read-only)
- `packages/cli/src/core/providers/` (read-only)

## Requirements

1. Test `ConfigError` causes immediate abort:
   - Provider returns `ExecutionResult` with `errorCategory: 'config'`, `errorCode: 'CONFIG_MISSING'`
   - Executor should set status to `'failed'` and stop immediately
   - `ExecutorResult` should have `errorCategory: 'config'`
   - Consecutive failure counter should NOT be incremented

2. Test `PermissionError` causes immediate abort:
   - Provider returns `errorCategory: 'permission'`
   - Executor should set status to `'failed'` and stop immediately

3. Test `TimeoutError` is retried up to `maxConsecutiveFailures`:
   - Provider returns `errorCategory: 'timeout'` multiple times
   - Executor retries each time, incrementing failure counter
   - After `maxConsecutiveFailures`, executor stops

4. Test `PROVIDER_RATE_LIMIT` does not increment failure counter:
   - Provider returns `errorCategory: 'provider'`, `errorCode: 'PROVIDER_RATE_LIMIT'`
   - Failure counter should NOT be incremented
   - Executor should continue to next iteration

5. Test `PROVIDER_NOT_AVAILABLE` causes immediate abort:
   - Provider returns `errorCategory: 'provider'`, `errorCode: 'PROVIDER_NOT_AVAILABLE'`
   - Executor should set status to `'failed'` and stop immediately

6. Test `ValidationError` feeds error back to AI prompt:
   - Provider returns `errorCategory: 'validation'`
   - Executor should retry and include validation output in next prompt
   - Failure counter should be incremented

7. Test `ScopeError.SCOPE_USER_DENIED` causes immediate abort:
   - Provider returns `errorCategory: 'scope'`, `errorCode: 'SCOPE_USER_DENIED'`
   - Executor should stop immediately

8. Test `ScopeError.SCOPE_FORBIDDEN` is retried:
   - Provider returns `errorCategory: 'scope'`, `errorCode: 'SCOPE_FORBIDDEN'`
   - Executor should revert files and retry
   - Failure counter should be incremented

9. Test `GitError.GIT_REVERT_FAILED` causes immediate abort:
   - Provider returns `errorCategory: 'git'`, `errorCode: 'GIT_REVERT_FAILED'`
   - Executor should set status to `'failed'` and stop

10. Test `GitError.GIT_COMMIT_FAILED` retries once then continues without commit:
    - Provider returns `errorCategory: 'git'`, `errorCode: 'GIT_COMMIT_FAILED'`
    - Executor retries the commit once
    - If second attempt fails, executor warns but does not abort

11. Test mixed error sequence:
    - Iteration 1: `TimeoutError` (retry)
    - Iteration 2: Success
    - Iteration 3: `ScopeError.SCOPE_FORBIDDEN` (revert and retry)
    - Iteration 4: Success
    - Iteration 5: Task complete
    - Verify executor handles the mixed sequence correctly

12. Test backward compatibility:
    - Provider returns `success: false` without `errorCategory` (old-style error)
    - Executor should handle it with the existing generic failure path

13. Test `ExecutorResult` includes error category info:
    - When executor fails with a categorized error, `ExecutorResult` should have `errorCategory`, `errorCode`, and `errorDetails` populated

14. At least 15 new test cases total.

## Definition of Done

- [ ] At least 15 new test cases in `executor.test.ts`
- [ ] All error category behaviors tested: abort, retry, backoff, feed-back
- [ ] Mixed error sequences tested
- [ ] Backward compatibility with old-style errors tested
- [ ] `ExecutorResult` error category fields verified
- [ ] All tests pass (`pnpm test`)

## Notes

- Part of PLAN-v080-error-categorization.md
- Depends on task 105 (executor must be updated first)
