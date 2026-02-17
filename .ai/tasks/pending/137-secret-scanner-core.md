# TASK: Create `SecretScanner` class with regex-based detection

## Goal

Implement the core `SecretScanner` class in `packages/cli/src/core/secret-scanner.ts` with 18 regex-based secret detection patterns. This is the foundational module that all other secrets-hardening tasks depend on. Also add the required types (`SecretSeverity`, `SecretsMode`, `SecretPattern`, `SecretFinding`, `SecretScanResult`, `SecretsConfig`) to `packages/cli/src/types/index.ts`.

## Task Type

feature

## Suggested Roles

- developer

## Auto-Mode Compatible

YES

## Scope

### Allowed

- `packages/cli/src/core/secret-scanner.ts` (new file)
- `packages/cli/src/types/index.ts`

### Forbidden

- `packages/cli/src/core/executor.ts` (read-only)
- `packages/cli/src/core/safety.ts` (read-only)
- `packages/cli/src/commands/` (read-only)

## Requirements

1. Add the following types to `packages/cli/src/types/index.ts`:

```typescript
export type SecretSeverity = 'high' | 'medium' | 'low';
export type SecretsMode = 'warn' | 'block' | 'redact';

export interface SecretPattern {
  name: string;
  pattern: RegExp;
  severity: SecretSeverity;
  contextRequired?: RegExp;
  contextLines?: number;
  validator?: (match: string) => boolean;
}

export interface SecretFinding {
  patternName: string;
  severity: SecretSeverity;
  filePath?: string;
  line: number;
  column: number;
  matchPreview: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface SecretScanResult {
  findings: SecretFinding[];
  filesScanned: number;
  duration: number;
}

export interface SecretsConfig {
  mode: SecretsMode;
  patterns?: string[];
  allowed_files?: string[];
  allowed_patterns?: string[];
  entropy_detection?: boolean;
  entropy_threshold?: number;
}
```

2. Create `SecretScanner` class with the following 18 regex patterns (ordered by priority):

   1. **AWS Access Key ID** — `(?<![A-Za-z0-9/+=])(AKIA[0-9A-Z]{16})(?![A-Za-z0-9/+=])`
   2. **AWS Secret Access Key** — `(?<![A-Za-z0-9/+=])([A-Za-z0-9/+=]{40})(?![A-Za-z0-9/+=])` (context-dependent: requires `aws_secret_access_key`, `AWS_SECRET_ACCESS_KEY`, `secret_access_key`, or within 3 lines of an `AKIA` match)
   3. **GitHub Personal Access Token** — `(ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9]{22}_[A-Za-z0-9]{59})`
   4. **GitHub OAuth / App tokens** — `(gho_[A-Za-z0-9]{36}|ghu_[A-Za-z0-9]{36}|ghs_[A-Za-z0-9]{36}|ghr_[A-Za-z0-9]{36})`
   5. **GitLab tokens** — `(glpat-[A-Za-z0-9\-_]{20,})`
   6. **Slack tokens** — `(xox[bpors]-[A-Za-z0-9\-]{10,250})`
   7. **Stripe keys** — `(sk_live_[A-Za-z0-9]{20,}|rk_live_[A-Za-z0-9]{20,})` (only `_live_` keys; `_test_` excluded)
   8. **JWT** — `(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})` (validate first segment decodes to JSON with `"alg"` field)
   9. **Private keys (PEM)** — `-----BEGIN (RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----`
   10. **Database connection strings** — `(mongodb(\+srv)?|postgres(ql)?|mysql|mssql|redis|amqp):\/\/[^:]+:[^@\s]+@[^\s]+` (exclude if password is `${...}`)
   11. **Generic API key assignments** — `(?:api[_-]?key|apikey|api[_-]?secret|auth[_-]?token|access[_-]?token|bearer)\s*[:=]\s*["']([A-Za-z0-9_\-\.]{20,})["']` (case-insensitive key matching)
   12. **Anthropic API keys** — `(sk-ant-[A-Za-z0-9\-_]{80,})`
   13. **OpenAI API keys** — `(sk-[A-Za-z0-9]{20,}T3BlbkFJ[A-Za-z0-9]{20,})` (contains `T3BlbkFJ` marker)
   14. **Google API keys** — `(AIza[A-Za-z0-9_\-]{35})`
   15. **Twilio keys** — `(SK[a-f0-9]{32})` (context-dependent: requires `twilio`, `account_sid`, or `auth_token` within 2 lines)
   16. **SendGrid API keys** — `(SG\.[A-Za-z0-9_\-]{22}\.[A-Za-z0-9_\-]{43})`
   17. **npm tokens** — `(npm_[A-Za-z0-9]{36})`
   18. **Heroku API keys** — `[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}` (context-dependent: requires `HEROKU_API_KEY` or `heroku.*api.*key` within 2 lines)

3. Implement the detection algorithm:
   - `scan(content: string, filePath?: string): SecretScanResult`
   - Run each regex pattern against content
   - For context-dependent patterns, check surrounding lines (configurable via `contextLines`, default +-3)
   - Assign confidence scores: prefix-based (AKIA, ghp_, sk_live_) = HIGH; context-dependent = MEDIUM; generic = LOW
   - Filter out matches inside code comments containing "example", "placeholder", "xxx", "your_", "replace_me"
   - Filter out known placeholder values: all-same-char, sequential, contains "PLACEHOLDER", "CHANGE_ME", "TODO"
   - Filter out `${...}` env var references
   - Return findings with: pattern name, matched value (first 8 chars + "***"), line number, confidence, file path

4. Implement `redact(content: string): string` method that replaces detected secrets with `[REDACTED:pattern-name]`.

5. Implement false positive mitigation:
   - Skip files in `node_modules/`, `.git/`, `dist/`, `build/`, `coverage/`
   - Skip binary files (detect via null byte in first 512 bytes)
   - Ignore matches inside markdown code fences containing `# example` or `// placeholder`
   - Ignore test fixture files matching `*.fixture.*`, `*__fixtures__/*`, `*.mock.*`
   - Support `allowed_patterns` and `allowed_files` from config

6. Support custom patterns from config (`SecretsConfig.patterns` array of regex strings).

## Definition of Done

- [ ] All 6 types added to `packages/cli/src/types/index.ts`
- [ ] `SecretScanner` class created in `packages/cli/src/core/secret-scanner.ts`
- [ ] All 18 regex patterns implemented with correct severity levels
- [ ] Context-dependent patterns check surrounding lines
- [ ] Confidence scoring works (high/medium/low)
- [ ] False positive filtering works (placeholders, env vars, examples)
- [ ] `scan()` method returns correct `SecretScanResult`
- [ ] `redact()` method replaces secrets with `[REDACTED:pattern-name]`
- [ ] File path filtering skips node_modules, .git, dist, build, coverage
- [ ] Binary file detection works
- [ ] Custom patterns from config are supported
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes

## Notes

- Part of PLAN-v080-secrets-hardening.md
- This is the foundational task; all other secrets tasks (138-150) depend on it
- matchPreview must NEVER log the full secret value -- only first 8 chars + "***"
