# TASK: Categorize errors in anthropic-api provider

## Goal

Update `packages/cli/src/core/providers/anthropic-api.ts` to categorize errors from the Anthropic SDK. In the `catch` block: (1) check for `Anthropic.RateLimitError` or status 429 to create `ProviderError.rateLimit('anthropic-api', ...)`, (2) status 401/403 to create `PermissionError.apiAuth('anthropic-api')`, (3) status 5xx or network errors to create `ProviderError.apiError('anthropic-api', message, statusCode)`, (4) other errors to create `ProviderError.crash('anthropic-api', message)`. Populate `errorCategory` and `errorCode` in returned `ExecutionResult`.

## Task Type

refactor

## Suggested Roles

- developer

## Auto-Mode Compatible

YES

## Scope

### Allowed

- `packages/cli/src/core/providers/anthropic-api.ts`

### Forbidden

- `packages/cli/src/core/providers/claude-cli.ts` (read-only)
- `packages/cli/src/core/providers/openai-api.ts` (read-only)
- `packages/cli/src/core/executor.ts` (read-only)
- `packages/cli/src/core/errors.ts` (read-only)
- `packages/cli/src/core/providers/types.ts` (read-only)

## Requirements

1. Import error classes from `core/errors.ts`: `ProviderError`, `PermissionError`.

2. In the `catch` block of the `execute()` method, categorize errors:
   - Check for `Anthropic.RateLimitError` or HTTP status 429: Create `ProviderError.rateLimit('anthropic-api', error.message)`. Set `errorCategory = 'provider'`, `errorCode = 'PROVIDER_RATE_LIMIT'`.
   - Check for HTTP status 401 or 403 (authentication/authorization errors): Create `PermissionError.apiAuth('anthropic-api')`. Set `errorCategory = 'permission'`, `errorCode = 'PERMISSION_SKIP_DENIED'` (or appropriate code).
   - Check for HTTP status 5xx or network errors: Create `ProviderError.apiError('anthropic-api', error.message, statusCode)`. Set `errorCategory = 'provider'`, `errorCode = 'PROVIDER_API_ERROR'`.
   - All other errors: Create `ProviderError.crash('anthropic-api', error.message)`. Set `errorCategory = 'provider'`, `errorCode = 'PROVIDER_CRASH'`.

3. Populate `errorCategory` and `errorCode` in every `ExecutionResult` that has `success: false`.

4. Preserve existing `error` string field for backward compatibility.

5. Preserve existing behavior for successful executions.

## Definition of Done

- [ ] All error paths in `anthropic-api.ts` return categorized errors with `errorCategory` and `errorCode`
- [ ] Rate limit (429) maps to `ProviderError.rateLimit`
- [ ] Auth errors (401/403) map to `PermissionError`
- [ ] Server errors (5xx) map to `ProviderError.apiError`
- [ ] Other errors map to `ProviderError.crash`
- [ ] Existing `error` string field still populated for backward compatibility
- [ ] All existing tests pass (`pnpm test`)
- [ ] TypeScript compiles without errors (`pnpm typecheck`)

## Notes

- Part of PLAN-v080-error-categorization.md
- Depends on tasks 098 (error classes) and 100 (updated ExecutionResult type)
