# TASK: Implement Shannon entropy detection for generic high-entropy strings

## Goal

Extend the `SecretScanner` class with an optional entropy-based detector that catches secrets not covered by regex patterns. This uses Shannon entropy to identify high-randomness strings that are likely API keys or secrets. Disabled by default (`secrets.entropy_detection: false`) because it produces more false positives.

## Task Type

feature

## Suggested Roles

- developer

## Auto-Mode Compatible

YES

## Scope

### Allowed

- `packages/cli/src/core/secret-scanner.ts`

### Forbidden

- `packages/cli/src/core/executor.ts` (read-only)
- `packages/cli/src/commands/` (read-only)

## Requirements

1. Implement the `shannonEntropy(s: string): number` function:
   - Count frequency of each character in the string
   - For each character: `p = frequency / length`
   - `entropy = -sum(p * log2(p))`
   - Return entropy in bits per character

2. Integrate entropy detection into the scanner's `scan()` method:
   - Only analyze strings of length 20-200 that are assigned to variables (detected via `=`, `:`, or `=>` context)
   - Default threshold: 4.5 bits/char (most English text is ~3.5-4.0; random secrets are ~5.0-6.0)
   - Configurable via `secrets.entropy_threshold`
   - Only run when `secrets.entropy_detection` is `true`

3. Skip the following string types to reduce false positives:
   - English words (check against a small dictionary of ~100 common words)
   - File paths (contain `/` or `\`)
   - URLs without credentials (no `user:pass@` pattern)
   - UUIDs (well-known format `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)
   - Hex strings that are exactly 32 or 64 chars (likely MD5/SHA hashes)
   - Base64-encoded content > 200 chars (likely file data, not a key)

4. Entropy-detected findings should have:
   - `patternName: 'high-entropy-string'`
   - `severity: 'low'`
   - `confidence: 'low'`

## Definition of Done

- [ ] `shannonEntropy()` function implemented and returns correct values
- [ ] Entropy detection integrates with `scan()` method
- [ ] Disabled by default; enabled via `secrets.entropy_detection: true`
- [ ] Threshold configurable via `secrets.entropy_threshold` (default 4.5)
- [ ] All skip rules implemented (English words, file paths, URLs, UUIDs, hash-length hex, long base64)
- [ ] Entropy findings use correct severity and confidence levels
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes

## Notes

- Part of PLAN-v080-secrets-hardening.md
- Depends on TASK-137 (core scanner must exist first)
- Can run in parallel with TASK-139 (config types)
