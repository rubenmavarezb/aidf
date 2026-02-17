# TASK: Iteration Cooldown

## Goal
Add configurable delay between executor iterations to proactively avoid rate limits during long-running tasks, with slight jitter to prevent synchronized requests in parallel execution scenarios.

## Task Type
feature

## Suggested Roles
- developer

## Auto-Mode Compatible
YES

## Scope
### Allowed
- packages/cli/src/core/executor.ts

### Forbidden
- packages/cli/src/core/providers/ (read-only)
- packages/cli/src/types/index.ts (read-only, config types added by task 158)

## Requirements

**Changes to `executor.ts`:**
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

- The cooldown should be called after all post-iteration work (scope check, validation, commit) but before the next iteration starts
- The sleep function should be injectable or overridable for testing purposes

## Definition of Done
- [ ] Executor reads `config.rate_limit.cooldown_ms`
- [ ] Cooldown with jitter (0-20%) is applied between iterations when configured
- [ ] Cooldown is skipped on the last iteration
- [ ] Live status shows "Cooling down" phase during sleep
- [ ] Cooldown delay is logged
- [ ] Default behavior (no cooldown) works unchanged
- [ ] `pnpm lint` passes
- [ ] `pnpm typecheck` passes
- [ ] Existing tests remain green

## Notes
- Part of PLAN-v080-rate-limiting.md
- Depends on task 158 (rate limit config types)
