# TASK: Rate Limit Configuration & Types

## Goal
Add the `RateLimitConfig` interface and wire it into the config system so all rate limiting features can be configured via `config.yml`.

## Task Type
feature

## Suggested Roles
- developer

## Auto-Mode Compatible
YES

## Scope
### Allowed
- packages/cli/src/types/index.ts
- packages/cli/src/core/providers/index.ts
- packages/cli/src/utils/config.ts

### Forbidden
- packages/cli/src/core/executor.ts (read-only)

## Requirements

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

**Config.yml example (for documentation):**
```yaml
rate_limit:
  max_retries: 5
  base_delay_ms: 1000
  max_delay_ms: 60000
  token_budget: 500000    # ~$2 per run at Sonnet pricing
  cooldown_ms: 2000       # 2s between iterations
```

**Integration work:**
- Wire defaults through the provider factory (`createProvider`) and executor constructor
- Update config validation/resolution in `utils/config.ts` to handle the new `rate_limit` section
- Add env var resolution support for `rate_limit` values (e.g., `$AIDF_TOKEN_BUDGET`)
- All fields are optional with sensible defaults so zero-config works as before

## Definition of Done
- [ ] `RateLimitConfig` interface is exported from `types/index.ts`
- [ ] `AidfConfig` includes `rate_limit?: RateLimitConfig`
- [ ] Config resolution in `utils/config.ts` handles the `rate_limit` section with defaults
- [ ] Provider factory passes rate limit config to providers
- [ ] All fields are optional with documented defaults
- [ ] `pnpm lint` passes
- [ ] `pnpm typecheck` passes
- [ ] Existing tests remain green

## Notes
- Part of PLAN-v080-rate-limiting.md
- Depends on task 151 (needs RateLimitOptions shape finalized)
