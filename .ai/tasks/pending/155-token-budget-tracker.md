# TASK: Token Budget Tracker

## Goal
Create `packages/cli/src/core/providers/token-budget.ts` implementing `TokenBudget` that tracks cumulative token usage across all iterations of an execution run and enforces a configurable maximum.

## Task Type
feature

## Suggested Roles
- developer

## Auto-Mode Compatible
YES

## Scope
### Allowed
- packages/cli/src/core/providers/token-budget.ts (new file)

### Forbidden
- packages/cli/src/core/executor.ts (read-only)
- packages/cli/src/types/index.ts (read-only)

## Requirements

Implement the `TokenBudget` class for tracking and enforcing token limits.

**Class API:**
```typescript
export class TokenBudget {
  constructor(maxTokens: number);  // 0 or Infinity means unlimited
  record(usage: TokenUsage): void;  // adds input + output tokens to the running total
  isExceeded(): boolean;            // returns true if cumulative tokens >= maxTokens
  remaining(): number;              // returns tokens remaining before budget is hit
  consumed(): number;               // returns total tokens consumed so far
  reset(): void;                    // resets the counter (for reuse across tasks)
}
```

**`TokenUsage` type** (should already exist in the codebase or be compatible with the existing type):
```typescript
interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}
```

**Behavior details:**
- When `maxTokens` is `0` or `Infinity`, `isExceeded()` always returns `false` and `remaining()` returns `Infinity`
- `record()` adds both `inputTokens` and `outputTokens` to a single cumulative counter
- `remaining()` returns `Math.max(0, maxTokens - consumed)` to avoid negative values
- The class should be lightweight and have no side effects (no logging, no I/O)

## Definition of Done
- [ ] `token-budget.ts` exists in `packages/cli/src/core/providers/`
- [ ] `TokenBudget` class implements all 5 methods (`record`, `isExceeded`, `remaining`, `consumed`, `reset`)
- [ ] Unlimited mode works correctly when `maxTokens` is 0 or Infinity
- [ ] Cumulative tracking is correct across multiple `record()` calls
- [ ] `remaining()` never returns negative values
- [ ] `pnpm lint` passes
- [ ] `pnpm typecheck` passes

## Notes
- Part of PLAN-v080-rate-limiting.md
- Independent task, can start immediately
