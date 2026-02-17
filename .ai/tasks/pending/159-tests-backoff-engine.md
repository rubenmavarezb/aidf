# TASK: Tests — Backoff Engine

## Goal
Write comprehensive unit tests for `packages/cli/src/core/providers/rate-limiter.ts` covering all backoff, jitter, retry, and callback behaviors.

## Task Type
test

## Suggested Roles
- tester

## Auto-Mode Compatible
YES

## Scope
### Allowed
- packages/cli/src/core/providers/rate-limiter.test.ts (new file)

### Forbidden
- packages/cli/src/core/providers/rate-limiter.ts (read-only)

## Requirements

Write Vitest unit tests covering:

- **Exponential backoff timing:** Verify delays increase across retries
- **Jitter variance:** Multiple runs with same inputs produce different delays (decorrelated jitter)
- **`maxDelayMs` cap:** Verify the maximum delay is never exceeded regardless of retry count
- **`Retry-After` override:** When `retryAfterMs` is provided in `RetryDecision`, backoff uses that value plus small jitter (0-10%)
- **Max retries exhausted:** After `maxRetries` attempts, the last error is thrown
- **Success on Nth retry:** Function succeeds after N-1 failures, returns the successful result
- **Non-retryable errors:** Errors where `isRetryable` returns `{ shouldRetry: false }` are thrown immediately without delay
- **`onRetry` callback:** Verify it receives correct attempt number and delay on each retry
- **First retry uses base delay:** On first retry, `previousSleep` equals `baseDelayMs`

**Testing approach:**
- Mock `setTimeout` / use `vi.useFakeTimers()` to avoid actual delays in tests
- Extract the sleep function as injectable if needed for deterministic testing
- Use `vi.fn()` for the `onRetry` callback to assert call counts and arguments

## Definition of Done
- [ ] `rate-limiter.test.ts` exists in `packages/cli/src/core/providers/`
- [ ] All test cases listed above are implemented
- [ ] Tests use fake timers to avoid real delays
- [ ] All tests pass with `pnpm test`
- [ ] No flaky tests due to timing
- [ ] `pnpm lint` passes

## Notes
- Part of PLAN-v080-rate-limiting.md
- Depends on task 151 (backoff engine implementation)
