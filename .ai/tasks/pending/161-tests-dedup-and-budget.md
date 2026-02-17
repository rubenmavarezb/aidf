# TASK: Tests — Dedup Cache & Token Budget

## Goal
Write unit tests for `packages/cli/src/core/providers/dedup-cache.ts` and `packages/cli/src/core/providers/token-budget.ts` covering all caching, eviction, budget tracking, and edge case behaviors.

## Task Type
test

## Suggested Roles
- tester

## Auto-Mode Compatible
YES

## Scope
### Allowed
- packages/cli/src/core/providers/dedup-cache.test.ts (new file)
- packages/cli/src/core/providers/token-budget.test.ts (new file)

### Forbidden
- packages/cli/src/core/providers/dedup-cache.ts (read-only)
- packages/cli/src/core/providers/token-budget.ts (read-only)

## Requirements

### Dedup Cache Tests (`dedup-cache.test.ts`)

- **Hash detection:** Identical prompt strings produce a cache hit within the time window
- **TTL eviction:** Entries expire after `dedupWindowMs` (use fake timers to advance time)
- **No false positives:** Different prompts produce different hashes and no collisions
- **`clear()` resets:** All entries are removed after calling `clear()`
- **Only non-retryable errors cached:** 429 errors (rate limit) are NOT cached; 400/401/403/422 errors ARE cached
- **Cache miss on first call:** A prompt never seen before returns `{ cached: false }`
- **Record then check flow:** `record()` a failure, then `check()` returns `{ cached: true, error: "..." }`

### Token Budget Tests (`token-budget.test.ts`)

- **Cumulative tracking:** Budget tracks usage correctly across multiple `record()` calls with different `TokenUsage` values
- **`isExceeded()` returns true** when total tokens (input + output) >= maxTokens
- **`isExceeded()` returns false** when total tokens < maxTokens
- **Unlimited mode:** `isExceeded()` returns false when maxTokens is `0`
- **Unlimited mode (Infinity):** `isExceeded()` returns false when maxTokens is `Infinity`
- **`remaining()` returns correct value:** `maxTokens - consumed`
- **`remaining()` never negative:** Returns 0 when consumed exceeds max
- **`consumed()` returns total:** Returns sum of all recorded input + output tokens
- **`reset()` clears counter:** After reset, `consumed()` is 0 and `isExceeded()` is false
- **Budget integration with executor:** Mock a provider returning token usage across iterations, verify executor stops when budget is exceeded

## Definition of Done
- [ ] `dedup-cache.test.ts` exists in `packages/cli/src/core/providers/`
- [ ] `token-budget.test.ts` exists in `packages/cli/src/core/providers/`
- [ ] All dedup cache test cases are implemented
- [ ] All token budget test cases are implemented
- [ ] Tests use fake timers where needed for TTL testing
- [ ] All tests pass with `pnpm test`
- [ ] `pnpm lint` passes

## Notes
- Part of PLAN-v080-rate-limiting.md
- Depends on tasks 154 (dedup cache) and 155 (token budget)
