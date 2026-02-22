# TASK: Tests for provider error categorization

## Goal

Create or extend test files for all three providers. For each provider, test: (1) successful execution still works unchanged, (2) timeout returns `TimeoutError` category, (3) process/API crash returns `ProviderError` category, (4) rate limit returns correct category and `retryable: true`, (5) auth errors return `PermissionError` and `retryable: false`, (6) `errorCategory` and `errorCode` fields are correctly populated in `ExecutionResult`. Mock external dependencies (child_process, Anthropic SDK, OpenAI SDK). At least 20 new test cases.

## Task Type

test

## Suggested Roles

- tester

## Auto-Mode Compatible

YES

## Scope

### Allowed

- `packages/cli/src/core/providers/claude-cli.test.ts`
- `packages/cli/src/core/providers/anthropic-api.test.ts`
- `packages/cli/src/core/providers/openai-api.test.ts`

### Forbidden

- `packages/cli/src/core/providers/claude-cli.ts` (read-only)
- `packages/cli/src/core/providers/anthropic-api.ts` (read-only)
- `packages/cli/src/core/providers/openai-api.ts` (read-only)
- `packages/cli/src/core/errors.ts` (read-only)

## Requirements

1. For `claude-cli` provider tests:
   - Test that `proc.on('error')` results in `ExecutionResult` with `errorCategory: 'provider'`, `errorCode: 'PROVIDER_CRASH'`
   - Test that timeout results in `errorCategory: 'timeout'`, `errorCode: 'ITERATION_TIMEOUT'`
   - Test that non-zero exit code results in `errorCategory: 'provider'`, `errorCode: 'PROVIDER_API_ERROR'`
   - Test that successful execution still returns `success: true` with no error fields
   - Test that `detectChangedFiles` git errors produce `errorCategory: 'git'`
   - Mock `child_process.spawn` for all tests

2. For `anthropic-api` provider tests:
   - Test rate limit error (429) results in `errorCategory: 'provider'`, `errorCode: 'PROVIDER_RATE_LIMIT'`
   - Test auth error (401) results in `errorCategory: 'permission'`
   - Test auth error (403) results in `errorCategory: 'permission'`
   - Test server error (500) results in `errorCategory: 'provider'`, `errorCode: 'PROVIDER_API_ERROR'`
   - Test generic crash results in `errorCategory: 'provider'`, `errorCode: 'PROVIDER_CRASH'`
   - Test successful execution still works unchanged
   - Mock Anthropic SDK client

3. For `openai-api` provider tests:
   - Test rate limit error (429) results in `errorCategory: 'provider'`, `errorCode: 'PROVIDER_RATE_LIMIT'`
   - Test auth error (401) results in `errorCategory: 'permission'`
   - Test server error (500) results in `errorCategory: 'provider'`, `errorCode: 'PROVIDER_API_ERROR'`
   - Test JSON parse error for tool call arguments results in `errorCategory: 'provider'`, `errorCode: 'PROVIDER_CRASH'`
   - Test successful execution still works unchanged
   - Mock OpenAI SDK client

4. At least 20 new test cases total across all three provider test files.

5. Use existing mock patterns from the codebase (`vi.mock('child_process')`, mock SDK clients).

## Definition of Done

- [ ] At least 20 new test cases across all three provider test files
- [ ] claude-cli tests cover: crash, timeout, API error, success, git error
- [ ] anthropic-api tests cover: rate limit, auth error, server error, crash, success
- [ ] openai-api tests cover: rate limit, auth error, server error, JSON parse error, success
- [ ] All `errorCategory` and `errorCode` fields verified in `ExecutionResult`
- [ ] All tests pass (`pnpm test`)

## Notes

- Part of PLAN-v080-error-categorization.md
- Depends on tasks 101, 102, 103 (providers must be updated first)
