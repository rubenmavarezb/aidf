# TASK: End-to-end integration tests for error categorization flow

## Goal

End-to-end tests that verify the full error flow: (1) Provider returns categorized error, executor handles it correctly, `ExecutorResult` has category, notification includes category. (2) Config error during `executor.run()` causes immediate failure with `ConfigError` category. (3) Scope violation produces `ScopeError` in result. (4) Validation failure produces `ValidationError` passed back to AI. (5) Git commit failure triggers retry and recovery. At least 10 integration-level test cases.

## Task Type

test

## Suggested Roles

- tester

## Auto-Mode Compatible

YES

## Scope

### Allowed

- `packages/cli/src/core/errors.integration.test.ts`

### Forbidden

- `packages/cli/src/core/errors.ts` (read-only)
- `packages/cli/src/core/executor.ts` (read-only)
- `packages/cli/src/core/providers/` (read-only)
- `packages/cli/src/core/safety.ts` (read-only)
- `packages/cli/src/core/validator.ts` (read-only)
- `packages/cli/src/utils/notifications.ts` (read-only)

## Requirements

1. Test full error flow — provider to executor to result:
   - Mock provider returns `ExecutionResult` with `errorCategory: 'provider'`, `errorCode: 'PROVIDER_CRASH'`
   - Executor processes the error, retries, eventually fails
   - `ExecutorResult` has `errorCategory: 'provider'`, `errorCode: 'PROVIDER_CRASH'`
   - Verify the error category is available for notification consumers

2. Test config error during `executor.run()`:
   - Simulate a `ConfigError` being thrown during context loading or config resolution
   - Executor should catch it and return `ExecutorResult` with `status: 'failed'`, `errorCategory: 'config'`
   - Verify immediate abort (no retry attempts)

3. Test scope violation flow:
   - Provider returns changes to forbidden files
   - ScopeGuard detects violation and returns `ScopeError`
   - Executor reverts files and retries
   - `ExecutorResult` includes scope error info if task ultimately fails

4. Test validation failure flow:
   - Provider returns changes
   - Validator detects lint/typecheck failure and returns `ValidationError`
   - Executor feeds error back to AI for next iteration
   - Verify `ValidationError` context includes command, exit code, and output

5. Test git commit failure and recovery:
   - Provider returns successful changes
   - Git commit fails with `GitError.commitFailed`
   - Executor retries commit once
   - If second attempt succeeds, execution continues normally
   - If second attempt fails, executor warns but continues without commit

6. Test rate limit handling end-to-end:
   - Provider returns `PROVIDER_RATE_LIMIT` error
   - Executor does NOT increment failure counter
   - After delay, executor retries
   - Provider succeeds on retry
   - Verify task completes successfully despite rate limit

7. Test permission error end-to-end:
   - Provider returns `PermissionError` (auth failure)
   - Executor immediately aborts
   - `ExecutorResult` has `status: 'failed'`, `errorCategory: 'permission'`
   - Verify no retry attempts

8. Test timeout error end-to-end:
   - Provider returns `TimeoutError`
   - Executor retries
   - Provider succeeds on retry
   - Verify task completes successfully

9. Test fatal git error end-to-end:
   - Git revert fails with `GIT_REVERT_FAILED`
   - Executor immediately aborts with `status: 'failed'`
   - `ExecutorResult` has `errorCategory: 'git'`, `errorCode: 'GIT_REVERT_FAILED'`

10. Test mixed error sequence end-to-end:
    - Iteration 1: Rate limit (no failure increment, delay)
    - Iteration 2: Timeout (failure increment, retry)
    - Iteration 3: Validation error (feed back to AI, failure increment)
    - Iteration 4: Success with task complete
    - Verify final `ExecutorResult` has `status: 'completed'`
    - Verify failure counter was correctly managed throughout

11. At least 10 integration-level test cases total.

12. Use mock providers and mock dependencies (git, fs, etc.) to simulate the full flow without real subprocess/API calls.

## Definition of Done

- [ ] `packages/cli/src/core/errors.integration.test.ts` exists with at least 10 test cases
- [ ] Full flow tested: provider error -> executor handling -> ExecutorResult
- [ ] Config error immediate abort tested
- [ ] Scope violation revert-and-retry tested
- [ ] Validation error feed-back-to-AI tested
- [ ] Git commit failure retry-and-recovery tested
- [ ] Rate limit no-failure-increment tested
- [ ] Permission error immediate abort tested
- [ ] Mixed error sequence tested
- [ ] All tests pass (`pnpm test`)

## Notes

- Part of PLAN-v080-error-categorization.md
- Depends on ALL previous tasks (098-111) since this is the final integration test
