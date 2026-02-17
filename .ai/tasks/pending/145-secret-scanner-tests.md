# TASK: Unit tests for `SecretScanner` with realistic patterns

## Goal

Write comprehensive unit tests for the `SecretScanner` class covering all 18 regex patterns with true positives, true negatives, context-dependent patterns, multi-line scanning, and edge cases. Target 80+ test cases.

## Task Type

test

## Suggested Roles

- tester

## Auto-Mode Compatible

YES

## Scope

### Allowed

- `packages/cli/src/core/secret-scanner.test.ts` (new file)

### Forbidden

- `packages/cli/src/core/secret-scanner.ts` (read-only)
- `packages/cli/src/core/executor.ts` (read-only)

## Requirements

1. **True positives -- each pattern detects its target:**
   - AWS key: `AKIAIOSFODNN7EXAMPLE` (the AWS example key)
   - GitHub PAT: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` (36 random alphanum)
   - GitHub fine-grained: `github_pat_xxxxxxxxxxxxxxxxxxxx_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   - Slack token: `xoxb-FAKE-SLACK-TOKEN-EXAMPLE`
   - Stripe live key: `sk_live_FAKE_STRIPE_KEY_EXAMPLE`
   - JWT: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U`
   - PEM private key header: `-----BEGIN RSA PRIVATE KEY-----`
   - Database URL: `<protocol>://<user>:<password>@<host>:<port>/<db>` (matches postgres, mongo, mysql, redis, amqp)
   - MongoDB URL: `<mongo+srv>://<user>:<password>@<cluster>/<db>` (matches SRV connection strings)
   - Anthropic key: `sk-ant-api03-...` (80+ chars)
   - OpenAI key: `sk-...T3BlbkFJ...` pattern
   - Google API key: `AIzaSyA-valid-looking-key-of-35-chars`
   - SendGrid key: `SG.xxxxxxxxxxxxxxxxxxxx.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   - npm token: `npm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

2. **True negatives -- common false positives that should NOT trigger:**
   - SHA-256 hashes (64 hex chars)
   - SHA-1 hashes (40 hex chars)
   - MD5 hashes (32 hex chars)
   - UUIDs (`550e8400-e29b-41d4-a716-446655440000`)
   - Base64-encoded file content (long strings)
   - `${ENV_VAR}` references in database URLs
   - Stripe test keys (`sk_test_...`)
   - `AKIA` inside a variable name (`AKIATYPE = 'something'`)
   - JWT-like strings that don't decode to valid JSON
   - Strings marked as examples/placeholders (`your_api_key_here`, `REPLACE_ME`)
   - File paths that happen to be long
   - CSS color values, HTML entities, and other common long strings

3. **Context-dependent patterns:**
   - AWS Secret Key matched only when near `AKIA` or `aws_secret`
   - Heroku key matched only when near `HEROKU_API_KEY`
   - Twilio key matched only when near `twilio` context
   - Generic API key matched only in assignment context

4. **Multi-line scanning:**
   - PEM key spanning multiple lines
   - Secret on line 500 of a 1000-line file (verify line number accuracy)
   - Multiple secrets in the same file

5. **Edge cases:**
   - Empty string input
   - Binary content (null bytes)
   - Very long lines (>10,000 chars)
   - Unicode content
   - File path filtering (node_modules, .git)

6. **Redaction tests:**
   - Verify `redact()` replaces secrets with `[REDACTED:pattern-name]`
   - Verify surrounding content is preserved
   - Verify multiple secrets in same content are all redacted

## Definition of Done

- [ ] 80+ test cases written
- [ ] All 18 regex patterns have at least one true positive test
- [ ] True negative tests cover common false positive scenarios
- [ ] Context-dependent patterns tested with and without context
- [ ] Multi-line scanning tested with line number accuracy
- [ ] Edge cases covered (empty, binary, long lines, unicode)
- [ ] Redaction tests verify correct masking
- [ ] `pnpm test` passes
- [ ] All tests pass

## Notes

- Part of PLAN-v080-secrets-hardening.md
- Depends on TASK-137 (core scanner implementation)
