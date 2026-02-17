# TASK: Tests — Integration (Full Retry Flow)

## Goal
Write integration tests for the full retry flow, verifying end-to-end behavior of rate limiting, backoff, dedup, budget enforcement, and cooldown working together.

## Task Type
test

## Suggested Roles
- tester

## Auto-Mode Compatible
YES

## Scope
### Allowed
- packages/cli/src/core/providers/rate-limiter.integration.test.ts (new file)

### Forbidden
- packages/cli/src/core/providers/rate-limiter.ts (read-only)
- packages/cli/src/core/providers/error-classifier.ts (read-only)
- packages/cli/src/core/providers/dedup-cache.ts (read-only)
- packages/cli/src/core/providers/token-budget.ts (read-only)
- packages/cli/src/core/executor.ts (read-only)

## Requirements

Write Vitest integration tests covering the full retry flow:

- **Anthropic 429 retry and recover:** Mock Anthropic SDK to return 429 twice, then succeed on the 3rd attempt. Verify execution completes with correct output and no error thrown.
- **OpenAI Retry-After header respected:** Mock OpenAI SDK to return 429 with `Retry-After: 5` header. Verify the delay is approximately 5000ms (use fake timers to verify the sleep duration).
- **Token budget stops execution:** Mock a provider to consume tokens across 3 iterations (e.g., 200k per iteration with a budget of 500k). Verify executor stops at the budget limit with a `blocked` status and the correct reason message.
- **Cooldown between iterations:** Configure `cooldown_ms: 2000`. Verify cooldown delay (with jitter in 2000-2400ms range) is applied between iterations using fake timers.
- **Rate limit retries do NOT increment consecutiveFailures:** Mock a provider that returns 429 once then succeeds. Verify the executor's consecutive failure counter remains at 0 after the iteration.
- **Dedup cache prevents re-execution:** Record a non-retryable failure (400) for a prompt, then attempt the same prompt again. Verify the second attempt returns the cached error without making an API call.
- **Full pipeline:** Combine rate limiter + error classifier + dedup + budget in a single test scenario to verify they compose correctly without interfering with each other.

**Testing approach:**
- Use `vi.useFakeTimers()` for all timing-related assertions
- Mock the SDK clients (Anthropic and OpenAI) to return controlled responses
- Mock the executor's provider with a custom implementation if needed
- Use `vi.fn()` to track function calls and verify retry counts

## Definition of Done
- [ ] `rate-limiter.integration.test.ts` exists in `packages/cli/src/core/providers/`
- [ ] Anthropic 429 retry-and-recover scenario passes
- [ ] OpenAI Retry-After header timing is verified
- [ ] Token budget executor stop is verified
- [ ] Cooldown timing is verified
- [ ] ConsecutiveFailures counter is not affected by rate limit retries
- [ ] Dedup cache prevents duplicate API calls
- [ ] All tests pass with `pnpm test`
- [ ] No flaky tests due to timing
- [ ] `pnpm lint` passes

## Notes
- Part of PLAN-v080-rate-limiting.md
- Depends on tasks 153, 154, 156, and 157 (full integration requires all components)
