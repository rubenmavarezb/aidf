# TASK: Integrate Retry Logic into API Providers

## Goal
Modify `anthropic-api.ts` and `openai-api.ts` to wrap their API calls with `RateLimiter.executeWithRetry()`, making rate limit retries transparent to the executor.

## Task Type
feature

## Suggested Roles
- developer

## Auto-Mode Compatible
YES

## Scope
### Allowed
- packages/cli/src/core/providers/anthropic-api.ts
- packages/cli/src/core/providers/openai-api.ts

### Forbidden
- packages/cli/src/core/executor.ts (read-only)
- packages/cli/src/core/providers/rate-limiter.ts (read-only)
- packages/cli/src/core/providers/error-classifier.ts (read-only)

## Requirements

Integrate the `RateLimiter` and `classifyApiError` into both API providers.

**Key changes to each provider:**
- Add `rateLimiter: RateLimiter` as a private field, initialized in constructor from config options
- Wrap **only** the API call (`this.client.messages.create()` for Anthropic, `this.client.chat.completions.create()` for OpenAI) with `rateLimiter.executeWithRetry()` — do NOT wrap the entire tool-handling loop so tool processing is not retried
- Pass `classifyApiError` as the `isRetryable` callback, binding the correct provider name (`'anthropic'` or `'openai'`)
- Wire `onRetry` callback to `options.onOutput` so the live status shows retry progress (e.g., "Retrying in 4.2s (attempt 2/5)")
- When a retry succeeds, log the total retry wait time at info level
- When all retries are exhausted, throw the last error (caught by existing catch block in `execute()`)

**Important:** Rate limit retries happen inside `execute()`, so from the executor's perspective a single iteration either succeeds or fails. The executor's `consecutiveFailures` counter should only increment if all retries are exhausted.

**Constructor changes:**
- Accept rate limit options from the provider config or a new options parameter
- Default to `{ maxRetries: 5, baseDelayMs: 1000, maxDelayMs: 60000 }` if not configured

## Definition of Done
- [ ] `anthropic-api.ts` wraps `this.client.messages.create()` with `RateLimiter.executeWithRetry()`
- [ ] `openai-api.ts` wraps `this.client.chat.completions.create()` with `RateLimiter.executeWithRetry()`
- [ ] Only the API call is wrapped (not the tool-handling loop)
- [ ] `classifyApiError` is used as the `isRetryable` callback
- [ ] `onRetry` callback outputs retry status to the live status display
- [ ] Rate limit retries are transparent to the executor
- [ ] `pnpm lint` passes
- [ ] `pnpm typecheck` passes
- [ ] Existing tests remain green

## Notes
- Part of PLAN-v080-rate-limiting.md
- Depends on tasks 151 (backoff engine) and 152 (error classifier)
