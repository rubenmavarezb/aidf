# TASK: Unit tests for entropy detection

## Goal

Write unit tests for the Shannon entropy detection feature in `SecretScanner`, verifying correct entropy calculation, threshold behavior, and false positive exclusion rules.

## Task Type

test

## Suggested Roles

- tester

## Auto-Mode Compatible

YES

## Scope

### Allowed

- `packages/cli/src/core/secret-scanner.test.ts` (extend)

### Forbidden

- `packages/cli/src/core/secret-scanner.ts` (read-only)

## Requirements

1. Verify high-entropy strings (random 32-char alphanum) are flagged when entropy detection is enabled.

2. Verify English text is not flagged (entropy < threshold).

3. Verify hash-length hex strings (32, 40, 64 chars) are excluded even with high entropy.

4. Verify threshold is configurable:
   - Lower threshold (e.g., 3.0) catches more strings
   - Higher threshold (e.g., 5.5) catches fewer strings

5. Verify entropy detection is disabled by default (no entropy findings when `entropy_detection` is not set or is `false`).

6. Verify skip rules:
   - File paths with `/` or `\` are not flagged
   - URLs without credentials are not flagged
   - UUIDs are not flagged
   - Known English words are not flagged

7. Verify entropy findings have correct metadata:
   - `patternName: 'high-entropy-string'`
   - `severity: 'low'`
   - `confidence: 'low'`

## Definition of Done

- [ ] High-entropy strings detected when feature is enabled
- [ ] English text not falsely flagged
- [ ] Hash-length hex strings excluded
- [ ] Threshold configurability tested
- [ ] Feature disabled by default verified
- [ ] Skip rules tested (file paths, URLs, UUIDs, English words)
- [ ] Finding metadata verified
- [ ] `pnpm test` passes

## Notes

- Part of PLAN-v080-secrets-hardening.md
- Depends on TASK-138 (entropy detection implementation)
