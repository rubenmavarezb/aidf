# TASK: Tests — Error Classifier

## Goal
Write comprehensive unit tests for `packages/cli/src/core/providers/error-classifier.ts` covering all error classification scenarios for both Anthropic and OpenAI providers.

## Task Type
test

## Suggested Roles
- tester

## Auto-Mode Compatible
YES

## Scope
### Allowed
- packages/cli/src/core/providers/error-classifier.test.ts (new file)

### Forbidden
- packages/cli/src/core/providers/error-classifier.ts (read-only)

## Requirements

Write Vitest unit tests covering:

**Anthropic error scenarios:**
- 429 with `retry-after: 30` header parses to `{ shouldRetry: true, retryAfterMs: 30000 }`
- 529 (API overloaded) returns `{ shouldRetry: true }`
- 500 (server error) returns `{ shouldRetry: true }`
- 503 (service unavailable) returns `{ shouldRetry: true }`
- 400 (bad request) returns `{ shouldRetry: false }`
- 401 (unauthorized) returns `{ shouldRetry: false }`
- 403 (forbidden) returns `{ shouldRetry: false }`
- 404 (not found) returns `{ shouldRetry: false }`
- 422 (validation) returns `{ shouldRetry: false }`

**OpenAI error scenarios:**
- 429 with `retry-after` header parses correctly
- 429 with `x-ratelimit-remaining-tokens: 0` header is detected
- `error.code === 'rate_limit_exceeded'` is detected as retryable
- 500 returns `{ shouldRetry: true }`
- 503 returns `{ shouldRetry: true }`
- 401 returns `{ shouldRetry: false }`

**Header parsing:**
- HTTP-date format `Retry-After` header (e.g., `Thu, 01 Dec 2025 16:00:00 GMT`) is parsed to correct milliseconds
- Numeric seconds format is converted to milliseconds
- Invalid header values are handled gracefully (no crash, `retryAfterMs` is undefined)

**Edge cases:**
- Non-API errors (network errors like ECONNREFUSED, ETIMEDOUT) return `{ shouldRetry: true }` (transient)
- Unknown error shapes (plain strings, null, undefined) return `{ shouldRetry: false }` (safe default)
- Error with missing `headers` property is handled gracefully

**Testing approach:**
- Create mock error objects matching the shape of Anthropic and OpenAI SDK errors
- No need for actual SDK imports in tests; just mock the error structure

## Definition of Done
- [ ] `error-classifier.test.ts` exists in `packages/cli/src/core/providers/`
- [ ] All Anthropic error scenarios are tested
- [ ] All OpenAI error scenarios are tested
- [ ] Retry-After header parsing is tested (both formats)
- [ ] Edge cases (network errors, unknown errors) are tested
- [ ] All tests pass with `pnpm test`
- [ ] `pnpm lint` passes

## Notes
- Part of PLAN-v080-rate-limiting.md
- Depends on task 152 (error classifier implementation)
