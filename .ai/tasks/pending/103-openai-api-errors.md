# TASK: Categorize errors in openai-api provider

## Goal

Update `packages/cli/src/core/providers/openai-api.ts` to categorize errors from the OpenAI SDK. Same mapping pattern as task 102: (1) rate limit (429) to create `ProviderError.rateLimit('openai-api', ...)`, (2) auth errors (401/403) to create `PermissionError.apiAuth('openai-api')`, (3) server errors (5xx) to create `ProviderError.apiError('openai-api', ...)`, (4) JSON parse errors for tool call arguments to create `ProviderError.crash('openai-api', 'Invalid tool call arguments')`. Populate `errorCategory` and `errorCode` in returned `ExecutionResult`.

## Task Type

refactor

## Suggested Roles

- developer

## Auto-Mode Compatible

YES

## Scope

### Allowed

- `packages/cli/src/core/providers/openai-api.ts`

### Forbidden

- `packages/cli/src/core/providers/claude-cli.ts` (read-only)
- `packages/cli/src/core/providers/anthropic-api.ts` (read-only)
- `packages/cli/src/core/executor.ts` (read-only)
- `packages/cli/src/core/errors.ts` (read-only)
- `packages/cli/src/core/providers/types.ts` (read-only)

## Requirements

1. Import error classes from `core/errors.ts`: `ProviderError`, `PermissionError`.

2. In the `catch` block of the `execute()` method, categorize errors:
   - Rate limit (HTTP status 429): Create `ProviderError.rateLimit('openai-api', error.message)`. Set `errorCategory = 'provider'`, `errorCode = 'PROVIDER_RATE_LIMIT'`.
   - Auth errors (HTTP status 401/403): Create `PermissionError.apiAuth('openai-api')`. Set `errorCategory = 'permission'`, `errorCode = 'PERMISSION_SKIP_DENIED'` (or appropriate code).
   - Server errors (HTTP status 5xx): Create `ProviderError.apiError('openai-api', error.message, statusCode)`. Set `errorCategory = 'provider'`, `errorCode = 'PROVIDER_API_ERROR'`.
   - JSON parse errors for tool call arguments: Create `ProviderError.crash('openai-api', 'Invalid tool call arguments')`. Set `errorCategory = 'provider'`, `errorCode = 'PROVIDER_CRASH'`.
   - All other errors: Create `ProviderError.crash('openai-api', error.message)`. Set `errorCategory = 'provider'`, `errorCode = 'PROVIDER_CRASH'`.

3. Populate `errorCategory` and `errorCode` in every `ExecutionResult` that has `success: false`.

4. Preserve existing `error` string field for backward compatibility.

5. Preserve existing behavior for successful executions.

## Definition of Done

- [ ] All error paths in `openai-api.ts` return categorized errors with `errorCategory` and `errorCode`
- [ ] Rate limit (429) maps to `ProviderError.rateLimit`
- [ ] Auth errors (401/403) map to `PermissionError`
- [ ] Server errors (5xx) map to `ProviderError.apiError`
- [ ] JSON parse errors map to `ProviderError.crash`
- [ ] Existing `error` string field still populated for backward compatibility
- [ ] All existing tests pass (`pnpm test`)
- [ ] TypeScript compiles without errors (`pnpm typecheck`)

## Notes

- Part of PLAN-v080-error-categorization.md
- Depends on tasks 098 (error classes) and 100 (updated ExecutionResult type)
