# TASK: Request Deduplication — DedupCache

## Goal
Create `packages/cli/src/core/providers/dedup-cache.ts` implementing `DedupCache` to prevent retrying identical prompts within a time window when the previous attempt failed with a non-retryable error. Integrate it into both API providers.

## Task Type
feature

## Suggested Roles
- developer

## Auto-Mode Compatible
YES

## Scope
### Allowed
- packages/cli/src/core/providers/dedup-cache.ts (new file)
- packages/cli/src/core/providers/anthropic-api.ts
- packages/cli/src/core/providers/openai-api.ts

### Forbidden
- packages/cli/src/core/executor.ts (read-only)

## Requirements

Implement the `DedupCache` class that caches non-retryable failures to prevent re-sending identical prompts.

**How it works:**
- Hash the prompt using Node.js built-in: `crypto.createHash('sha256').update(prompt).digest('hex').slice(0, 16)` — 16 hex chars is sufficient for dedup
- Store `Map<string, { timestamp: number; error: string }>` of recently failed prompt hashes
- Before executing, check if the same hash failed within `dedupWindowMs` (default 60000ms / 1 minute)
- If found, skip execution and return the cached error immediately
- Clear entries older than `dedupWindowMs` on each check (simple TTL eviction)
- Only cache non-retryable failures (400, 401, 403, 422) — never cache rate limit failures (429, those are handled by backoff)
- Expose `clear()` method for testing and for the executor to reset between tasks

**Class API:**
```typescript
export class DedupCache {
  constructor(dedupWindowMs?: number);  // default 60000
  check(prompt: string): { cached: true; error: string } | { cached: false };
  record(prompt: string, error: string): void;
  clear(): void;
}
```

**Integration:** Used inside the API providers' `execute()` method, checked before calling the rate limiter. If the dedup cache returns a hit, skip the API call and return/throw the cached error immediately.

## Definition of Done
- [ ] `dedup-cache.ts` exists in `packages/cli/src/core/providers/`
- [ ] Prompt hashing uses SHA-256 truncated to 16 hex chars
- [ ] Cache entries expire after `dedupWindowMs`
- [ ] Only non-retryable errors are cached (not 429/rate limit errors)
- [ ] `clear()` method resets all entries
- [ ] Integrated into `anthropic-api.ts` and `openai-api.ts` `execute()` methods
- [ ] `pnpm lint` passes
- [ ] `pnpm typecheck` passes

## Notes
- Part of PLAN-v080-rate-limiting.md
- Depends on task 152 (error classifier, to decide what is non-retryable)
