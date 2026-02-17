# TASK: Backoff Engine — RateLimiter class

## Goal
Create `packages/cli/src/core/providers/rate-limiter.ts` implementing the `RateLimiter` class with exponential backoff and decorrelated jitter for retrying rate-limited API requests.

## Task Type
feature

## Suggested Roles
- developer

## Auto-Mode Compatible
YES

## Scope
### Allowed
- packages/cli/src/core/providers/rate-limiter.ts (new file)

### Forbidden
- packages/cli/src/core/providers/anthropic-api.ts (read-only)
- packages/cli/src/core/providers/openai-api.ts (read-only)

## Requirements

Implement the `RateLimiter` class with decorrelated jitter backoff algorithm.

**Core algorithm — Decorrelated jitter** (preferred over full jitter for API rate limiting):
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

**Types to export:**
```typescript
export interface RateLimitOptions {
  maxRetries?: number;    // default 5
  baseDelayMs?: number;   // default 1000
  maxDelayMs?: number;    // default 60000
  onRetry?: (attempt: number, delayMs: number, error: unknown) => void;
}

export interface RetryDecision {
  shouldRetry: boolean;
  retryAfterMs?: number;
}
```

- The sleep function should be injectable (as a constructor option or overridable method) to allow fake timers in tests.
- When all retries are exhausted, throw the last error.
- Log total wait time and retry count for observability.

## Definition of Done
- [ ] `rate-limiter.ts` exists in `packages/cli/src/core/providers/`
- [ ] `RateLimiter` class implements `executeWithRetry<T>()` with decorrelated jitter backoff
- [ ] `RateLimitOptions` and `RetryDecision` types are exported
- [ ] `Retry-After` override is respected when provided in `RetryDecision`
- [ ] `maxDelayMs` cap is enforced on all calculated delays
- [ ] `onRetry` callback is invoked with correct attempt number and delay
- [ ] Sleep function is injectable for testing
- [ ] `pnpm lint` passes
- [ ] `pnpm typecheck` passes

## Notes
- Part of PLAN-v080-rate-limiting.md
