# TASK: Rate Limit Detection — Error Classifier

## Goal
Create `packages/cli/src/core/providers/error-classifier.ts` with functions to detect retryable errors from both Anthropic and OpenAI SDKs, parse `Retry-After` headers, and return structured `RetryDecision` objects.

## Task Type
feature

## Suggested Roles
- developer

## Auto-Mode Compatible
YES

## Scope
### Allowed
- packages/cli/src/core/providers/error-classifier.ts (new file)

### Forbidden
- packages/cli/src/core/providers/anthropic-api.ts (read-only)
- packages/cli/src/core/providers/openai-api.ts (read-only)

## Requirements

Implement the error classifier that categorizes API errors as retryable or non-retryable.

**Main export:**
```typescript
export function classifyApiError(error: unknown, provider: 'anthropic' | 'openai'): RetryDecision {
  // Returns { shouldRetry: true/false, retryAfterMs?: number }
}
```

**Anthropic error detection:**
- The `@anthropic-ai/sdk` throws `APIError` with `status` and `headers` properties
- Check for `error.status === 429` (rate limited) and `error.status === 529` (API overloaded)
- Also retry on `error.status === 500` or `error.status === 503` (transient server errors)
- Parse `retry-after` header: can be seconds (`retry-after: 30`) or HTTP-date (`retry-after: Thu, 01 Dec 2025 16:00:00 GMT`). Convert both to milliseconds. Anthropic typically sends seconds.
- Access via `error.headers?.['retry-after']` or `error.headers?.get?.('retry-after')`

**OpenAI error detection:**
- The `openai` SDK throws `APIError` with `status` and `headers` properties
- Check for `error.status === 429` (rate limited), `error.status === 500`, `error.status === 503`
- Parse `retry-after` header same as Anthropic (OpenAI also sends seconds)
- Additionally check for `error.code === 'rate_limit_exceeded'` in the error body
- Parse `x-ratelimit-remaining-requests` and `x-ratelimit-remaining-tokens` headers for proactive throttling info (log warnings when approaching zero)

**Non-retryable errors (should NOT retry):**
- 400 (bad request)
- 401 (auth)
- 403 (forbidden)
- 404 (not found)
- 422 (validation)
These indicate permanent failures.

**Retry-After header parsing:**
- If value is numeric (e.g., `"30"`), treat as seconds and convert to ms: `parseInt(value) * 1000`
- If value is an HTTP-date string, use `Date.parse(value)` and compute `parsedDate - Date.now()` for ms
- If parsing fails, fall back to treating the value as seconds; if that also fails, return `undefined` for `retryAfterMs`

**Network/timeout errors:**
- Non-API errors (e.g., `ECONNREFUSED`, `ETIMEDOUT`, `ECONNRESET`) should return `{ shouldRetry: true }` as they are transient
- Unknown error shapes should return `{ shouldRetry: false }` as a safe default

Import `RetryDecision` from `./rate-limiter.ts`.

## Definition of Done
- [ ] `error-classifier.ts` exists in `packages/cli/src/core/providers/`
- [ ] `classifyApiError()` correctly identifies retryable Anthropic errors (429, 529, 500, 503)
- [ ] `classifyApiError()` correctly identifies retryable OpenAI errors (429, 500, 503)
- [ ] Non-retryable status codes (400, 401, 403, 404, 422) return `{ shouldRetry: false }`
- [ ] `Retry-After` header is parsed from both seconds and HTTP-date formats
- [ ] Network errors (ECONNREFUSED, ETIMEDOUT) are classified as retryable
- [ ] Unknown errors default to `{ shouldRetry: false }`
- [ ] `pnpm lint` passes
- [ ] `pnpm typecheck` passes

## Notes
- Part of PLAN-v080-rate-limiting.md
