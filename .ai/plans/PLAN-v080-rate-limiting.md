# PLAN: v0.8.0 — Rate Limiting, Backoff & Token Budget

## Status: DRAFT

## Overview

API providers (`anthropic-api`, `openai-api`) currently have no resilience against rate limiting. When a provider returns HTTP 429 or a transient server error, the executor treats it as a generic failure and increments the consecutive failure counter, potentially aborting the entire task. This plan introduces exponential backoff with jitter, rate limit detection, request deduplication, token budget enforcement, and configurable cooldown between iterations — making AIDF robust for sustained multi-iteration runs against rate-limited APIs.

## Goals

- Automatically retry rate-limited requests (HTTP 429) with exponential backoff and jitter
- Parse `Retry-After` headers from both Anthropic and OpenAI error responses
- Prevent duplicate retries of identical prompts within a configurable time window
- Enforce a per-execution token budget so runaway tasks don't drain API credits
- Add configurable cooldown delays between iterations to stay under rate limits proactively
- Expose all tuning knobs via `config.yml` under a `rate_limit` section
- Ensure rate limit retries are transparent to the executor (don't count as consecutive failures)

## Non-Goals

- Implementing a global rate limiter shared across parallel executor workers (defer to a future plan)
- Adding rate limiting to CLI providers (`claude-cli`, `cursor-cli`) — they manage their own rate limits
- Building a token cost dashboard or historical tracking UI
- Changing the provider interface contract (the retry logic wraps existing `execute()` calls internally)

## Tasks

### Phase 1: Backoff Engine & Rate Limit Detection

- [ ] `151-backoff-engine.md` — Create `packages/cli/src/core/providers/rate-limiter.ts` implementing the `RateLimiter` class. Core algorithm:

  **Exponential backoff with decorrelated jitter** (preferred over full jitter for API rate limiting):
  ```
  sleep = min(max_delay, random_between(base_delay, previous_sleep * 3))
  ```
  On first retry, `previous_sleep = base_delay`. This produces less correlated retry storms than equal jitter while maintaining good spread.

  **Class API:**
  - `constructor(options: RateLimitOptions)` — accepts `maxRetries` (default 5), `baseDelayMs` (default 1000), `maxDelayMs` (default 60000)
  - `async executeWithRetry<T>(fn: () => Promise<T>, isRetryable: (error: unknown) => RetryDecision): Promise<T>` — wraps any async function with retry logic
  - `RetryDecision` type: `{ shouldRetry: boolean; retryAfterMs?: number }` — when `retryAfterMs` is set (from Retry-After header), it overrides the calculated backoff delay
  - Track retry count, total wait time, and last error for logging
  - Emit events via a callback `onRetry?: (attempt: number, delayMs: number, error: unknown) => void` so the executor's live status can display "Retrying in 4.2s (attempt 2/5)"

  **Jitter implementation detail:**
  ```typescript
  private calculateDelay(attempt: number, retryAfterMs?: number): number {
    if (retryAfterMs !== undefined && retryAfterMs > 0) {
      // Server told us exactly when to retry — respect it, add small jitter (0-10%)
      return retryAfterMs + Math.random() * retryAfterMs * 0.1;
    }
    // Decorrelated jitter: sleep = min(maxDelay, random(baseDelay, prevSleep * 3))
    const prevSleep = this.lastSleepMs || this.baseDelayMs;
    const sleep = Math.min(
      this.maxDelayMs,
      this.baseDelayMs + Math.random() * (prevSleep * 3 - this.baseDelayMs)
    );
    this.lastSleepMs = sleep;
    return sleep;
  }
  ```

  Scope: `packages/cli/src/core/providers/rate-limiter.ts` (new file)

- [ ] `152-rate-limit-detection.md` — Create `packages/cli/src/core/providers/error-classifier.ts` with functions to detect retryable errors from both Anthropic and OpenAI SDKs.

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

  **Error classifier function:**
  ```typescript
  export function classifyApiError(error: unknown, provider: 'anthropic' | 'openai'): RetryDecision {
    // Returns { shouldRetry: true/false, retryAfterMs?: number }
  }
  ```

  Non-retryable errors (should NOT retry): 400 (bad request), 401 (auth), 403 (forbidden), 404 (not found), 422 (validation). These indicate permanent failures.

  Scope: `packages/cli/src/core/providers/error-classifier.ts` (new file)

- [ ] `153-integrate-retry-into-providers.md` — Modify `anthropic-api.ts` and `openai-api.ts` to wrap the `this.client.messages.create()` and `this.client.chat.completions.create()` calls with `RateLimiter.executeWithRetry()`. Key changes:

  - Add `rateLimiter: RateLimiter` as a private field, initialized in constructor from config options
  - Wrap only the API call (not the entire tool-handling loop) so tool processing is not retried
  - Pass `classifyApiError` as the `isRetryable` callback
  - Wire `onRetry` callback to `options.onOutput` so the live status shows retry progress
  - When a retry succeeds, log the total retry wait time at info level
  - When all retries are exhausted, throw the last error (caught by existing catch block in `execute()`)

  Important: Rate limit retries happen inside `execute()`, so from the executor's perspective a single iteration either succeeds or fails. The executor's `consecutiveFailures` counter should only increment if all retries are exhausted.

  Scope: `packages/cli/src/core/providers/anthropic-api.ts`, `packages/cli/src/core/providers/openai-api.ts`

### Phase 2: Request Deduplication

- [ ] `154-request-deduplication.md` — Create `packages/cli/src/core/providers/dedup-cache.ts` implementing `DedupCache`. Purpose: prevent retrying an identical prompt within a time window when the previous attempt failed with a non-retryable error (e.g., context too long, invalid request).

  **How it works:**
  - Hash the prompt using a fast non-cryptographic hash (use Node.js built-in `crypto.createHash('sha256').update(prompt).digest('hex').slice(0, 16)` — 16 hex chars is sufficient for dedup)
  - Store `Map<string, { timestamp: number; error: string }>` of recently failed prompt hashes
  - Before executing, check if the same hash failed within `dedupWindowMs` (default 60000ms / 1 minute)
  - If found, skip execution and return the cached error immediately
  - Clear entries older than `dedupWindowMs` on each check (simple TTL eviction)
  - Only cache non-retryable failures (400, 401, 403, 422) — never cache rate limit failures (those are handled by backoff)
  - Expose `clear()` method for testing and for the executor to reset between tasks

  **Integration:** Used inside the API providers' `execute()` method, checked before calling the rate limiter.

  Scope: `packages/cli/src/core/providers/dedup-cache.ts` (new file), `packages/cli/src/core/providers/anthropic-api.ts`, `packages/cli/src/core/providers/openai-api.ts`

### Phase 3: Token Budget Enforcement

- [ ] `155-token-budget-tracker.md` — Create `packages/cli/src/core/providers/token-budget.ts` implementing `TokenBudget`. Tracks cumulative token usage across all iterations of an execution run and enforces a configurable maximum.

  **Class API:**
  - `constructor(maxTokens: number)` — `0` or `Infinity` means unlimited
  - `record(usage: TokenUsage): void` — adds input + output tokens to the running total
  - `isExceeded(): boolean` — returns true if cumulative tokens >= maxTokens
  - `remaining(): number` — returns tokens remaining before budget is hit
  - `consumed(): number` — returns total tokens consumed so far
  - `reset(): void` — resets the counter (for reuse across tasks)

  Scope: `packages/cli/src/core/providers/token-budget.ts` (new file)

- [ ] `156-token-budget-executor-integration.md` — Integrate `TokenBudget` into the executor loop. Changes to `executor.ts`:

  - Read `config.rate_limit.token_budget` (default: `0` meaning unlimited)
  - Instantiate `TokenBudget` at the start of `run()`
  - After each iteration, call `budget.record(result.tokenUsage)` then check `budget.isExceeded()`
  - If exceeded, set `state.status = 'blocked'` with reason `Token budget exceeded: used ${consumed} of ${max} tokens` and break the loop
  - Log remaining budget after each iteration: `Token budget: ${remaining} tokens remaining (${consumed}/${max})`
  - Include budget info in the final execution summary box

  Also add `token_budget` to `RateLimitConfig` type and `AidfConfig`.

  Scope: `packages/cli/src/core/executor.ts`, `packages/cli/src/types/index.ts`

### Phase 4: Iteration Cooldown

- [ ] `157-iteration-cooldown.md` — Add configurable delay between executor iterations to proactively avoid rate limits during long-running tasks.

  Changes to `executor.ts`:
  - Read `config.rate_limit.cooldown_ms` (default: `0` meaning no cooldown)
  - At the end of each iteration (after commit, before the next loop cycle), if `cooldown_ms > 0`, sleep for that duration
  - Add slight jitter to the cooldown (0-20% random variance) to prevent synchronized requests in parallel execution scenarios
  - Skip cooldown on the last iteration (when task is complete or blocked)
  - Log when cooldown is active: `Cooling down for ${actualDelay}ms before next iteration`
  - The live status should show phase "Cooling down" during the sleep

  **Implementation:**
  ```typescript
  private async cooldown(baseMs: number): Promise<void> {
    if (baseMs <= 0) return;
    const jitter = Math.random() * baseMs * 0.2;
    const delay = baseMs + jitter;
    this.emitPhase('Cooling down');
    this.logger.info(`Cooling down for ${Math.round(delay)}ms`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  ```

  Scope: `packages/cli/src/core/executor.ts`

### Phase 5: Configuration & Types

- [ ] `158-rate-limit-config.md` — Add `RateLimitConfig` interface and wire it into the config system.

  **New type in `types/index.ts`:**
  ```typescript
  export interface RateLimitConfig {
    /** Max retry attempts for rate-limited requests. Default: 5 */
    max_retries?: number;
    /** Base delay for exponential backoff in ms. Default: 1000 */
    base_delay_ms?: number;
    /** Maximum delay cap for backoff in ms. Default: 60000 */
    max_delay_ms?: number;
    /** Max total tokens (input + output) per execution run. 0 = unlimited. Default: 0 */
    token_budget?: number;
    /** Delay between iterations in ms. 0 = no delay. Default: 0 */
    cooldown_ms?: number;
    /** Dedup window for identical failed prompts in ms. Default: 60000 */
    dedup_window_ms?: number;
  }
  ```

  **Add to `AidfConfig`:**
  ```typescript
  export interface AidfConfig {
    // ... existing fields
    rate_limit?: RateLimitConfig;
  }
  ```

  **Config.yml example:**
  ```yaml
  rate_limit:
    max_retries: 5
    base_delay_ms: 1000
    max_delay_ms: 60000
    token_budget: 500000    # ~$2 per run at Sonnet pricing
    cooldown_ms: 2000       # 2s between iterations
  ```

  - Wire defaults through the provider factory (`createProvider`) and executor constructor
  - Update config validation/resolution in `utils/config.ts` to handle the new section
  - Add env var resolution support for `rate_limit` values (e.g., `$AIDF_TOKEN_BUDGET`)

  Scope: `packages/cli/src/types/index.ts`, `packages/cli/src/core/providers/index.ts`, `packages/cli/src/utils/config.ts`

### Phase 6: Tests

- [ ] `159-tests-backoff-engine.md` — Unit tests for `rate-limiter.ts`:
  - Verify exponential backoff timing: delays increase across retries
  - Verify jitter: multiple runs with same inputs produce different delays
  - Verify `maxDelayMs` cap is respected
  - Verify `Retry-After` override: when `retryAfterMs` is provided, backoff uses that value (plus small jitter)
  - Verify max retries: after `maxRetries` attempts, the error is thrown
  - Verify success on Nth retry: function succeeds after N-1 failures
  - Verify non-retryable errors are thrown immediately without delay
  - Verify `onRetry` callback receives correct attempt number and delay
  - Mock `setTimeout` / use fake timers to avoid actual delays in tests

  Scope: `packages/cli/src/core/providers/rate-limiter.test.ts`

- [ ] `160-tests-error-classifier.md` — Unit tests for `error-classifier.ts`:
  - Anthropic 429 with `retry-after: 30` header parses to `{ shouldRetry: true, retryAfterMs: 30000 }`
  - Anthropic 529 (overloaded) returns `{ shouldRetry: true }`
  - Anthropic 400 returns `{ shouldRetry: false }`
  - OpenAI 429 with `retry-after` header parses correctly
  - OpenAI 429 with `x-ratelimit-remaining-tokens: 0` header is detected
  - OpenAI 401 returns `{ shouldRetry: false }`
  - HTTP-date format `Retry-After` header is parsed to correct milliseconds
  - Non-API errors (network errors, timeouts) return `{ shouldRetry: true }` (transient)
  - Unknown error shapes return `{ shouldRetry: false }` (safe default)

  Scope: `packages/cli/src/core/providers/error-classifier.test.ts`

- [ ] `161-tests-dedup-and-budget.md` — Unit tests for `dedup-cache.ts` and `token-budget.ts`:

  **Dedup cache tests:**
  - Identical prompt hashes are detected within the time window
  - Entries expire after `dedupWindowMs`
  - Different prompts produce different hashes (no false positives)
  - `clear()` resets all entries
  - Only non-retryable errors are cached (429 errors are not cached)

  **Token budget tests:**
  - Budget tracks cumulative usage correctly across multiple `record()` calls
  - `isExceeded()` returns true when total >= max
  - `isExceeded()` returns false when budget is 0 (unlimited)
  - `remaining()` returns correct value
  - `reset()` clears the counter
  - Budget integrates with executor: executor stops when budget exceeded (mock provider returning token usage)

  Scope: `packages/cli/src/core/providers/dedup-cache.test.ts`, `packages/cli/src/core/providers/token-budget.test.ts`

- [ ] `162-tests-integration.md` — Integration tests for the full retry flow:
  - Mock Anthropic SDK to return 429 twice, then succeed — verify execution completes with correct output
  - Mock OpenAI SDK to return 429 with `Retry-After: 5` — verify the delay is ~5000ms (using fake timers)
  - Mock provider to consume tokens across 3 iterations — verify executor stops at budget limit
  - Verify cooldown delay is applied between iterations (using fake timers)
  - Verify rate limit retries do NOT increment the executor's `consecutiveFailures` counter
  - Verify dedup cache prevents re-execution of identical failed prompts

  Scope: `packages/cli/src/core/providers/rate-limiter.integration.test.ts`

## Dependencies

- 151 is independent (start immediately)
- 152 is independent (start immediately, in parallel with 151)
- 153 depends on 151 + 152 (needs both backoff engine and error classifier)
- 154 depends on 152 (needs error classification to decide what to cache)
- 155 is independent (start immediately)
- 156 depends on 155 + 158 (needs budget tracker and config types)
- 157 depends on 158 (needs config types for cooldown_ms)
- 158 depends on 151 (needs RateLimitOptions shape finalized)
- 159 depends on 151
- 160 depends on 152
- 161 depends on 154 + 155
- 162 depends on 153 + 154 + 156 + 157 (full integration)

**Critical path:** 151 → 158 → 156/157 → 162

**Parallelizable work:** 151 + 152 + 155 can all start simultaneously.

## Risks

- **Backoff timing in tests:** Using real timers makes tests slow; fake timers (vi.useFakeTimers) can be brittle with async/await. Mitigate by extracting the sleep function as an injectable dependency.
- **SDK error shape changes:** Anthropic and OpenAI SDK error classes may change across versions. Mitigate by pinning SDK versions and using defensive property access with fallbacks.
- **Token budget accuracy:** CLI providers (claude-cli, cursor-cli) don't report token usage, so budget enforcement only works with API providers. Document this limitation clearly.
- **Retry-After header parsing:** HTTP-date format varies by locale/timezone. Mitigate by using `Date.parse()` and falling back to treating the value as seconds if parsing fails.
- **Dedup false negatives:** Prompts that differ only in whitespace or iteration numbers would not be deduped. This is acceptable — dedup targets truly identical retries, not similar ones.

## Success Criteria

- Rate-limited API calls (429) are retried automatically up to `max_retries` times with exponential backoff
- `Retry-After` headers from both Anthropic and OpenAI are respected
- Identical failed prompts within the dedup window are not re-sent
- Token budget stops execution with a clear "budget exceeded" message when the limit is reached
- Cooldown between iterations is configurable and applied correctly
- All configuration is optional with sensible defaults (zero-config works as before)
- Rate limit retries are transparent to the executor (no impact on consecutive failure counting)
- New test files achieve >90% coverage of the new modules
- Existing 298+ tests remain green
- `pnpm lint` and `pnpm typecheck` pass cleanly
