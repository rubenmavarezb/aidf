# TASK: Token Budget Executor Integration

## Goal
Integrate `TokenBudget` into the executor loop so that execution stops gracefully when the configured token budget is exceeded, and add the `token_budget` field to `RateLimitConfig` and `AidfConfig`.

## Task Type
feature

## Suggested Roles
- developer

## Auto-Mode Compatible
YES

## Scope
### Allowed
- packages/cli/src/core/executor.ts
- packages/cli/src/types/index.ts

### Forbidden
- packages/cli/src/core/providers/token-budget.ts (read-only)
- packages/cli/src/core/providers/rate-limiter.ts (read-only)

## Requirements

**Changes to `executor.ts`:**
- Read `config.rate_limit.token_budget` (default: `0` meaning unlimited)
- Instantiate `TokenBudget` at the start of `run()`
- After each iteration, call `budget.record(result.tokenUsage)` then check `budget.isExceeded()`
- If exceeded, set `state.status = 'blocked'` with reason `Token budget exceeded: used ${consumed} of ${max} tokens` and break the loop
- Log remaining budget after each iteration: `Token budget: ${remaining} tokens remaining (${consumed}/${max})`
- Include budget info in the final execution summary box
- Only track budget when the provider returns token usage data (skip for CLI providers that don't report it)

**Changes to `types/index.ts`:**
- Add `token_budget` to the `RateLimitConfig` interface (if not already added by task 158)
- Ensure `AidfConfig` includes `rate_limit?: RateLimitConfig`

## Definition of Done
- [ ] Executor reads `config.rate_limit.token_budget` and instantiates `TokenBudget`
- [ ] Token usage is recorded after each iteration
- [ ] Execution stops with `blocked` status when budget is exceeded
- [ ] Budget remaining is logged after each iteration
- [ ] Budget info appears in the final execution summary
- [ ] Default behavior (no budget) works unchanged
- [ ] `pnpm lint` passes
- [ ] `pnpm typecheck` passes
- [ ] Existing tests remain green

## Notes
- Part of PLAN-v080-rate-limiting.md
- Depends on tasks 155 (token budget tracker) and 158 (rate limit config)
