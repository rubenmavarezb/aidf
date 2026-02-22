# TASK: Refactor executor to handle errors by category

## Goal

Refactor the main loop in `packages/cli/src/core/executor.ts` to handle errors by category instead of treating all failures identically. Import error classes from `core/errors.ts`. Implement per-category behavior: retry, fail fast, warn, backoff, depending on the error category and code.

## Task Type

refactor

## Suggested Roles

- developer

## Auto-Mode Compatible

YES

## Scope

### Allowed

- `packages/cli/src/core/executor.ts`

### Forbidden

- `packages/cli/src/core/providers/claude-cli.ts` (read-only)
- `packages/cli/src/core/providers/anthropic-api.ts` (read-only)
- `packages/cli/src/core/providers/openai-api.ts` (read-only)
- `packages/cli/src/core/errors.ts` (read-only)
- `packages/cli/src/core/providers/types.ts` (read-only)
- `packages/cli/src/commands/` (read-only)

## Requirements

1. Import error classes from `core/errors.ts`: `AidfError`, `ProviderError`, `TimeoutError`, `ValidationError`, `ScopeError`, `ConfigError`, `GitError`, `PermissionError`.

2. When `ExecutionResult` has `errorCategory`, use it to decide behavior instead of the generic failure path:

3. `ConfigError` / `PermissionError` (non-retryable, fatal):
   - Set status to `'failed'`
   - Break loop immediately
   - Do NOT increment consecutive failure counter
   - Log the error category and code

4. `TimeoutError`:
   - Log warning with timeout details
   - Increment failure counter
   - Retry (existing behavior)

5. `ProviderError` with `PROVIDER_RATE_LIMIT`:
   - Log info "Rate limited, waiting..."
   - Do NOT increment failure counter
   - Add a 5-second delay before next iteration (`await new Promise(r => setTimeout(r, 5000))`)

6. `ProviderError` with `PROVIDER_NOT_AVAILABLE`:
   - Fail fast, break loop immediately
   - Set status to `'failed'`

7. `ProviderError` with `PROVIDER_CRASH` or `PROVIDER_API_ERROR` (retryable):
   - Increment failure counter
   - Retry (existing behavior)

8. `ValidationError`:
   - Feed validation output back to AI (existing behavior)
   - Increment failure counter

9. `ScopeError`:
   - Revert files (existing behavior)
   - Increment failure counter
   - Exception: `SCOPE_USER_DENIED` fails fast (break loop)

10. `GitError` with `GIT_REVERT_FAILED`:
    - Fail fast — state is potentially corrupted
    - Set status to `'failed'`
    - Break loop

11. `GitError` with `GIT_COMMIT_FAILED` / `GIT_PUSH_FAILED`:
    - Retry once
    - If retry also fails, warn and continue without commit (do not abort)

12. Update the outer `catch` block to detect `AidfError` instances and populate `ExecutorResult` with category info (`errorCategory`, `errorCode`, `errorDetails`).

13. Preserve all existing behavior for cases where `errorCategory` is not set (backward compatibility with older provider implementations).

## Definition of Done

- [ ] Executor handles at least 6 distinct error categories with different behaviors
- [ ] `ConfigError` and `PermissionError` cause immediate abort
- [ ] `TimeoutError` is retried with failure counter increment
- [ ] `PROVIDER_RATE_LIMIT` does not increment failure counter and adds delay
- [ ] `PROVIDER_NOT_AVAILABLE` causes immediate abort
- [ ] `ScopeError.SCOPE_USER_DENIED` causes immediate abort
- [ ] `GitError.GIT_REVERT_FAILED` causes immediate abort
- [ ] `GitError.GIT_COMMIT_FAILED` retries once then continues without commit
- [ ] `ExecutorResult` includes `errorCategory` and `errorCode` for all failure/blocked states
- [ ] Backward compatible with providers that don't set `errorCategory`
- [ ] All existing tests pass (`pnpm test`)
- [ ] TypeScript compiles without errors (`pnpm typecheck`)

## Notes

- Part of PLAN-v080-error-categorization.md
- Depends on tasks 098, 100, 101, 102, 103 (executor needs error classes, updated types, and all providers updated)
