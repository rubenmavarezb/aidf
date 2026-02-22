# TASK: Categorize errors in claude-cli provider

## Goal

Update `packages/cli/src/core/providers/claude-cli.ts` to return categorized errors. Map the current error paths: (1) `proc.on('error')` to `ProviderError.crash('claude-cli', error.message)`, (2) timeout handler to `TimeoutError.iteration(timeout, ...)`, (3) non-zero exit code with stderr to `ProviderError.apiError('claude-cli', stderr, exitCode)`, (4) `isAvailable()` failure to `ProviderError.notAvailable('claude-cli')`. Populate `errorCategory` and `errorCode` in the returned `ExecutionResult`. The `detectChangedFiles` helper: wrap git spawn errors as `GitError.statusFailed(rawError)`.

## Task Type

refactor

## Suggested Roles

- developer

## Auto-Mode Compatible

YES

## Scope

### Allowed

- `packages/cli/src/core/providers/claude-cli.ts`

### Forbidden

- `packages/cli/src/core/providers/anthropic-api.ts` (read-only)
- `packages/cli/src/core/providers/openai-api.ts` (read-only)
- `packages/cli/src/core/executor.ts` (read-only)
- `packages/cli/src/core/errors.ts` (read-only)
- `packages/cli/src/core/providers/types.ts` (read-only)

## Requirements

1. Import error classes from `core/errors.ts`: `ProviderError`, `TimeoutError`, `GitError`.

2. Map existing error paths in the `execute()` method:
   - `proc.on('error')` event: Create `ProviderError.crash('claude-cli', error.message)`. Set `ExecutionResult.errorCategory = 'provider'`, `errorCode = 'PROVIDER_CRASH'`.
   - Timeout handler (when iteration exceeds time limit): Create `TimeoutError.iteration(timeout, currentIteration)`. Set `ExecutionResult.errorCategory = 'timeout'`, `errorCode = 'ITERATION_TIMEOUT'`.
   - Non-zero exit code with stderr: Create `ProviderError.apiError('claude-cli', stderr, exitCode)`. Set `ExecutionResult.errorCategory = 'provider'`, `errorCode = 'PROVIDER_API_ERROR'`.
   - Empty/invalid output: Create `ProviderError.crash('claude-cli', 'Empty output')`. Set `ExecutionResult.errorCategory = 'provider'`, `errorCode = 'PROVIDER_CRASH'`.

3. Update `isAvailable()`: When the claude binary is not found, the error should be `ProviderError.notAvailable('claude-cli')`.

4. Update `detectChangedFiles` helper: Wrap git spawn errors as `GitError.statusFailed(rawError)`.

5. Populate `errorCategory` and `errorCode` in every `ExecutionResult` that has `success: false`. The existing `error` string field remains populated for backward compatibility.

6. Preserve existing behavior for successful executions — no changes to the happy path.

## Definition of Done

- [ ] All error paths in `claude-cli.ts` return categorized errors with `errorCategory` and `errorCode`
- [ ] `proc.on('error')` maps to `ProviderError.crash`
- [ ] Timeout maps to `TimeoutError.iteration`
- [ ] Non-zero exit code maps to `ProviderError.apiError`
- [ ] `isAvailable()` failure maps to `ProviderError.notAvailable`
- [ ] `detectChangedFiles` git errors map to `GitError.statusFailed`
- [ ] Existing `error` string field still populated for backward compatibility
- [ ] All existing tests pass (`pnpm test`)
- [ ] TypeScript compiles without errors (`pnpm typecheck`)

## Notes

- Part of PLAN-v080-error-categorization.md
- Depends on tasks 098 (error classes) and 100 (updated ExecutionResult type)
