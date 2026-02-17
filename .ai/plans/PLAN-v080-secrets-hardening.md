# PLAN: v0.8.0 — Secrets Detection & Hardening

## Status: DRAFT

## Overview

Implement comprehensive secret detection across the AIDF execution pipeline. Today, the only secret-related logic is `detectPlaintextSecrets()` in `utils/config.ts`, which performs a shallow check on config keys that look sensitive (password, token, etc.) and warns if they don't use `${ENV_VAR}` syntax. This plan introduces a full secret scanning subsystem that detects actual secret patterns in AI-generated file content, provider output, and staged git changes — with configurable modes (warn, block, redact), integration into ScopeGuard's forbidden files, and pre-commit scanning.

## Goals

- Detect secrets in AI-generated output and written files using pattern-based and entropy-based analysis
- Support three enforcement modes: `warn` (log and continue), `block` (fail the iteration), `redact` (mask secrets in output before logging)
- Extend ScopeGuard to treat common secret files (`.env`, `.key`, `credentials.json`, etc.) as implicitly forbidden
- Add pre-commit secret scanning that checks staged file diffs before auto-commit
- Provide user-configurable options: mode, custom patterns, allowed files (known false positives)
- Achieve high detection accuracy with minimal false positives through contextual analysis

## Non-Goals

- Replacing dedicated secret scanning tools (e.g., gitleaks, truffleHog) — AIDF's scanner is a lightweight guardrail, not a compliance tool
- Scanning the entire git history for past leaks
- Encrypting or vaulting secrets — that is out of scope
- Modifying the provider interface or adding new providers
- Cloud-based secret detection APIs

## Tasks

### Phase 1: Core Secret Detection Engine

#### TASK-137: Create `SecretScanner` class with regex-based detection

**File:** `packages/cli/src/core/secret-scanner.ts`

Implement the core detection engine as a `SecretScanner` class. This is the foundational module that all other tasks depend on.

**Regex patterns to implement (ordered by priority):**

1. **AWS Access Key ID** — `(?<![A-Za-z0-9/+=])(AKIA[0-9A-Z]{16})(?![A-Za-z0-9/+=])`
   - Always 20 chars starting with `AKIA`. Very low false positive rate.

2. **AWS Secret Access Key** — `(?<![A-Za-z0-9/+=])([A-Za-z0-9/+=]{40})(?![A-Za-z0-9/+=])`
   - Only trigger when preceded by a context marker: `aws_secret_access_key`, `AWS_SECRET_ACCESS_KEY`, `secret_access_key`, or within 3 lines of an `AKIA` match.
   - Without context, 40-char base64 strings are too common (SHA hashes, etc.).

3. **GitHub Personal Access Token** — `(ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9]{22}_[A-Za-z0-9]{59})`
   - `ghp_` prefix (classic) or `github_pat_` prefix (fine-grained). Very low false positive rate.

4. **GitHub OAuth / App tokens** — `(gho_[A-Za-z0-9]{36}|ghu_[A-Za-z0-9]{36}|ghs_[A-Za-z0-9]{36}|ghr_[A-Za-z0-9]{36})`

5. **GitLab tokens** — `(glpat-[A-Za-z0-9\-_]{20,})`

6. **Slack tokens** — `(xox[bpors]-[A-Za-z0-9\-]{10,250})`
   - Covers bot, user, app, and refresh tokens.

7. **Stripe keys** — `(sk_live_[A-Za-z0-9]{20,}|rk_live_[A-Za-z0-9]{20,})`
   - Only `_live_` keys. `_test_` keys are intentionally excluded to reduce noise during development.

8. **JWT (JSON Web Token)** — `(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})`
   - Three base64url-encoded segments separated by dots. Validate that the first segment decodes to valid JSON with `"alg"` field to reduce false positives.

9. **Private keys (PEM format)** — `-----BEGIN (RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----`
   - Multi-line match; detect the header line. The presence of this header in a file is always a secret.

10. **Database connection strings with passwords** — `(mongodb(\+srv)?|postgres(ql)?|mysql|mssql|redis|amqp):\/\/[^:]+:[^@\s]+@[^\s]+`
    - Matches `protocol://user:password@host` patterns. Exclude if password portion is a `${...}` env var reference.

11. **Generic API key assignments** — `(?:api[_-]?key|apikey|api[_-]?secret|auth[_-]?token|access[_-]?token|bearer)\s*[:=]\s*["']([A-Za-z0-9_\-\.]{20,})["']`
    - Context-dependent: only match when the key name suggests a secret AND the value is a quoted string of 20+ chars. Case-insensitive key matching.

12. **Anthropic API keys** — `(sk-ant-[A-Za-z0-9\-_]{80,})`

13. **OpenAI API keys** — `(sk-[A-Za-z0-9]{20,}T3BlbkFJ[A-Za-z0-9]{20,})`
    - Contains the `T3BlbkFJ` marker (base64 of "OpenAI").

14. **Google API keys** — `(AIza[A-Za-z0-9_\-]{35})`

15. **Twilio keys** — `(SK[a-f0-9]{32})`
    - Only when preceded by context keywords like `twilio`, `account_sid`, or `auth_token`.

16. **SendGrid API keys** — `(SG\.[A-Za-z0-9_\-]{22}\.[A-Za-z0-9_\-]{43})`

17. **npm tokens** — `(npm_[A-Za-z0-9]{36})`

18. **Heroku API keys** — `[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}`
    - Only when preceded by `HEROKU_API_KEY` or `heroku.*api.*key` context within 2 lines.

**Detection algorithm:**

```
scan(content: string, filePath?: string): SecretFinding[]
  1. Run each regex pattern against content
  2. For context-dependent patterns, check surrounding lines (±3 lines)
  3. For each match, compute a confidence score:
     - Prefix-based patterns (AKIA, ghp_, sk_live_): confidence = HIGH
     - Context-dependent patterns: confidence = MEDIUM if context present, skip if absent
     - Generic patterns: confidence = LOW
  4. Filter out matches inside code comments that are clearly examples
     (e.g., lines containing "example", "placeholder", "xxx", "your_", "replace_me")
  5. Filter out matches where the value is a known placeholder:
     - All same character: "AAAA...", "xxxx..."
     - Sequential: "1234567890", "abcdefgh"
     - Explicitly marked: contains "PLACEHOLDER", "CHANGE_ME", "TODO"
  6. Filter out matches where the value is a ${...} env var reference
  7. Return findings with: pattern name, matched value (first 8 chars + "***"),
     line number, confidence, file path
```

**False positive mitigation strategies:**

- Skip scanning files in `node_modules/`, `.git/`, `dist/`, `build/`, `coverage/`
- Skip binary files (detect via null byte in first 512 bytes)
- Ignore matches inside markdown code fences that contain `# example` or `// placeholder`
- Ignore test fixture files matching `*.fixture.*`, `*__fixtures__/*`, `*.mock.*`
- Allow users to suppress specific findings via `secrets.allowed_patterns` config
- Allow users to mark specific files as safe via `secrets.allowed_files` config

**Types to add to `types/index.ts`:**

```typescript
export type SecretSeverity = 'high' | 'medium' | 'low';
export type SecretsMode = 'warn' | 'block' | 'redact';

export interface SecretPattern {
  name: string;
  pattern: RegExp;
  severity: SecretSeverity;
  contextRequired?: RegExp;  // Must appear within ±3 lines
  contextLines?: number;     // How many lines to check for context (default: 3)
  validator?: (match: string) => boolean;  // Extra validation (e.g., JWT decode)
}

export interface SecretFinding {
  patternName: string;
  severity: SecretSeverity;
  filePath?: string;
  line: number;
  column: number;
  matchPreview: string;   // First 8 chars + "***" (never log full secret)
  confidence: 'high' | 'medium' | 'low';
}

export interface SecretScanResult {
  findings: SecretFinding[];
  filesScanned: number;
  duration: number;
}

export interface SecretsConfig {
  /** Enforcement mode: warn (log + continue), block (fail iteration), redact (mask in output) */
  mode: SecretsMode;
  /** Additional regex patterns (strings that will be compiled to RegExp) */
  patterns?: string[];
  /** Files that are allowed to contain secrets (e.g., test fixtures) */
  allowed_files?: string[];
  /** Patterns to ignore (e.g., known false positives) */
  allowed_patterns?: string[];
  /** Enable high-entropy string detection. Default: false (noisy) */
  entropy_detection?: boolean;
  /** Minimum Shannon entropy threshold for generic strings (default: 4.5) */
  entropy_threshold?: number;
}
```

#### TASK-138: Implement Shannon entropy detection for generic high-entropy strings

**File:** `packages/cli/src/core/secret-scanner.ts` (extend)

Add an optional entropy-based detector that catches secrets not covered by regex patterns. This is disabled by default (`secrets.entropy_detection: false`) because it produces more false positives.

**Algorithm:**

```
shannonEntropy(s: string): number
  1. Count frequency of each character in s
  2. For each character: p = frequency / length
  3. entropy = -sum(p * log2(p))
  Return entropy (bits per character)
```

**Integration with scanner:**

- Only analyze strings of length 20-200 that are assigned to variables (detected via `=`, `:`, or `=>` context)
- Skip strings that are:
  - English words (check against a small dictionary of 100 common words)
  - File paths (contain `/` or `\`)
  - URLs without credentials (no `user:pass@` pattern)
  - UUIDs (already have a well-known format)
  - Hex strings that are exactly 32 or 64 chars (likely MD5/SHA hashes, not secrets)
  - Base64-encoded content > 200 chars (likely file data, not a key)
- Default threshold: 4.5 bits/char (most English text is ~3.5-4.0; random secrets are ~5.0-6.0)
- Configurable via `secrets.entropy_threshold`

#### TASK-139: Add `SecretsConfig` to `AidfConfig` and wire up config loading

**File:** `packages/cli/src/types/index.ts`, `packages/cli/src/utils/config.ts`

- Add `secrets?: SecretsConfig` field to `AidfConfig` interface
- Add `secrets?: SecretsConfig` to `SecurityConfig` interface (keep both top-level and nested for flexibility; top-level takes precedence)
- Update `resolveConfig()` to resolve env vars in `secrets.patterns` and `secrets.allowed_files`
- Validate config: ensure `secrets.mode` is one of `warn | block | redact`, patterns are valid regexes
- Default config when `secrets` is not specified: `{ mode: 'warn' }`

**Config YAML example:**

```yaml
secrets:
  mode: block                        # warn | block | redact
  entropy_detection: false           # default: false
  entropy_threshold: 4.5             # bits per character
  patterns:                          # additional custom patterns
    - 'CUSTOM_[A-Z0-9]{32}'
  allowed_files:                     # files that may contain secrets
    - 'tests/fixtures/**'
    - '**/*.test.ts'
  allowed_patterns:                  # string patterns to ignore
    - 'sk_test_'                     # Stripe test keys are OK
```

### Phase 2: Integration with Executor and ScopeGuard

#### TASK-140: Integrate `SecretScanner` into the executor loop

**File:** `packages/cli/src/core/executor.ts`

Add secret scanning at two points in the execution loop:

1. **After provider execution, before scope check** — Scan `result.output` for secrets. This catches secrets in the AI's textual output (e.g., if the AI prints a key it found).
   - In `warn` mode: log each finding via `logger.warn()`, continue execution.
   - In `block` mode: log findings, increment `consecutiveFailures`, emit phase `'Secret detected'`, `continue` the loop.
   - In `redact` mode: replace matched secret values in `result.output` with `[REDACTED:pattern-name]` before the output is stored in `previousOutput` or passed to callbacks.

2. **After file changes are detected, before commit** — For each file in `result.filesChanged`, read the file content and scan it.
   - In `warn` mode: log warnings but allow commit.
   - In `block` mode: revert the files containing secrets (similar to scope violations), increment failures, continue.
   - In `redact` mode: NOT applicable for files (we can't silently modify AI-written files). Treat as `block` for file content and log a warning explaining that redact mode only applies to output.

**New phase events:** `'Scanning for secrets'` emitted before scanning starts.

**Integration sketch (pseudo-code in executor loop):**

```typescript
// After result = await provider.execute(...)
this.emitPhase('Scanning for secrets');

// Scan AI output
const outputFindings = secretScanner.scan(result.output);
if (outputFindings.findings.length > 0) {
  if (secretsMode === 'redact') {
    result.output = secretScanner.redact(result.output);
    previousOutput = result.output;
  } else if (secretsMode === 'block') {
    this.log(`Secrets detected in AI output: ${formatFindings(outputFindings)}`);
    consecutiveFailures++;
    continue;
  } else {
    this.logger.warn(`Secrets detected in AI output: ${formatFindings(outputFindings)}`);
  }
}

// Scan changed files (before scope check)
for (const file of result.filesChanged) {
  const content = await readFile(file, 'utf-8');
  const fileFindings = secretScanner.scan(content, file);
  if (fileFindings.findings.length > 0) {
    if (secretsMode === 'block') {
      await this.revertChanges([file]);
      // ... handle as failure
    } else {
      this.logger.warn(`Secrets in ${file}: ${formatFindings(fileFindings)}`);
    }
  }
}
```

#### TASK-141: Extend ScopeGuard with implicit secret file patterns

**File:** `packages/cli/src/core/safety.ts`

Add a set of implicit forbidden file patterns that are always active regardless of the task's `scope.forbidden` configuration. These represent files that should never be written by an AI agent:

**Implicit forbidden patterns:**

```typescript
const IMPLICIT_FORBIDDEN_FILES: string[] = [
  '.env',
  '.env.*',              // .env.local, .env.production, etc.
  '**/.env',
  '**/.env.*',
  '*.pem',
  '*.key',
  '*.p12',
  '*.pfx',
  '*.jks',               // Java keystore
  '**/*.pem',
  '**/*.key',
  '**/id_rsa',
  '**/id_ed25519',
  '**/id_ecdsa',
  'credentials.json',
  '**/credentials.json',
  '**/service-account*.json',
  '**/.gcloud/**',
  '**/.aws/credentials',
  '**/.aws/config',
  '**/.ssh/*',
  '**/.npmrc',            // Can contain auth tokens
  '**/.pypirc',           // Can contain auth tokens
  '**/.docker/config.json',
  '**/secrets.yml',
  '**/secrets.yaml',
  '**/vault.yml',
  '**/vault.yaml',
  '**/.htpasswd',
  '**/token.json',
];
```

**Implementation:**

- In `checkFileChange()`, before checking `scope.forbidden`, check against `IMPLICIT_FORBIDDEN_FILES`.
- Behavior in each mode:
  - `strict`: always block writes to these files.
  - `ask`: prompt user before writing to these files.
  - `permissive`: log a warning but allow (with prominent warning).
- Add an `allowImplicitForbidden?: string[]` field to `TaskScope` so tasks can explicitly opt in to writing specific secret files (e.g., a task that generates `.env.example`).
- Export `IMPLICIT_FORBIDDEN_FILES` for use in tests.

**Edge case:** `.env.example` files should NOT be blocked. Add exception for files ending in `.example`, `.sample`, `.template`.

#### TASK-142: Integrate secret scanning into `ToolHandler` for API providers

**File:** `packages/cli/src/core/providers/tool-handler.ts`

API providers (`anthropic-api`, `openai-api`) use `ToolHandler` for file operations. Add secret scanning to the `write_file` tool handler:

- Before writing a file, scan its content with `SecretScanner`.
- If secrets are found:
  - In `block` mode: return an error message to the AI explaining what was detected and asking it to use env vars instead. Do NOT write the file.
  - In `warn` mode: write the file but include a warning in the return message.
  - In `redact` mode: replace secrets in the content with `${REDACTED_SECRET}` placeholder before writing.

**Constructor changes:**

```typescript
constructor(
  cwd: string,
  commandPolicy?: CommandPolicy,
  scope?: TaskScope,
  scopeMode?: ScopeMode,
  secretsConfig?: SecretsConfig  // NEW
)
```

Also scan `run_command` output for secrets before returning it to the AI:
- If the command output contains secrets (e.g., `cat .env` or `echo $API_KEY`):
  - In `redact` mode: mask them in the returned string.
  - In `block` mode: return an error instead of the output.
  - In `warn` mode: return the output with a prepended warning.

### Phase 3: Pre-commit Secret Scanning

#### TASK-143: Add pre-commit secret scan to the executor's commit flow

**File:** `packages/cli/src/core/executor.ts` (extend `commitChanges` method)

Before `git.add()` and `git.commit()`, scan the staged diff for secrets:

1. For each file in the `files` array, read its content.
2. Run `SecretScanner.scan()` on each file's content.
3. If any HIGH or MEDIUM severity findings are detected:
   - In `block` mode: do NOT commit. Log the findings. Return without committing (the executor will count this as a failure).
   - In `warn` mode: log warnings, proceed with commit.
   - In `redact` mode: treat as `block` for commits (cannot redact committed content).

**Modified `commitChanges` signature:**

```typescript
private async commitChanges(
  files: string[],
  taskGoal: string,
  secretScanner?: SecretScanner
): Promise<{ committed: boolean; secretsFound: SecretFinding[] }>
```

The executor loop should handle the `committed: false` case by incrementing `consecutiveFailures` and feeding the secret findings back to the AI as an error message (similar to validation errors).

#### TASK-144: Add `aidf hooks secrets` CLI command for manual secret scanning

**File:** `packages/cli/src/commands/hooks.ts` (extend)

Add a subcommand `aidf hooks secrets [path]` that:

1. Accepts a file path, directory, or defaults to scanning staged git changes.
2. Runs `SecretScanner` against the targets.
3. Outputs a formatted report:
   ```
   Secret Scan Results
   ===================

   FOUND: 3 potential secrets in 2 files

     src/config.ts:14  [HIGH]  AWS Access Key ID  (AKIA****)
     src/config.ts:15  [HIGH]  AWS Secret Key     (wJal****)
     src/api.ts:42     [MED]   Generic API Key    (sk-p****)

   Run with --fix to see remediation suggestions.
   ```
4. Exit code: 0 if no findings, 1 if findings exist (useful in CI/CD).
5. `--json` flag for machine-readable output.
6. `--fix` flag shows remediation suggestions (e.g., "Replace with `${AWS_ACCESS_KEY_ID}` environment variable").

### Phase 4: Tests

#### TASK-145: Unit tests for `SecretScanner` with realistic patterns

**File:** `packages/cli/src/core/secret-scanner.test.ts`

**Test categories (aim for 80+ tests):**

1. **True positives — each pattern detects its target:**
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

2. **True negatives — common false positives that should NOT trigger:**
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
   - File paths that happen to be long (`/usr/local/share/very/long/path/name`)
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

#### TASK-146: Unit tests for entropy detection

**File:** `packages/cli/src/core/secret-scanner.test.ts` (extend)

- Verify high-entropy strings (random 32-char alphanum) are flagged when entropy detection is enabled
- Verify English text is not flagged
- Verify hash-length hex strings (32, 40, 64 chars) are excluded
- Verify threshold is configurable
- Verify entropy detection is disabled by default

#### TASK-147: Integration tests for executor + secret scanning

**File:** `packages/cli/src/core/executor.test.ts` (extend)

- Test `warn` mode: executor logs warning but continues and completes
- Test `block` mode: executor increments `consecutiveFailures` when secret found in output
- Test `block` mode: executor reverts file when secret found in file content
- Test `redact` mode: `result.output` has secrets replaced with `[REDACTED:*]`
- Test pre-commit scanning: `commitChanges` returns `committed: false` when secrets found in block mode
- Test that `SecretsConfig.allowed_files` suppresses findings for matching files
- Test that `SecretsConfig.allowed_patterns` suppresses findings for matching patterns

#### TASK-148: Integration tests for ScopeGuard implicit forbidden files

**File:** `packages/cli/src/core/safety.test.ts` (extend)

- Test `.env` is blocked in strict mode even when not in `scope.forbidden`
- Test `.env.local` is blocked
- Test `*.pem`, `*.key` files are blocked
- Test `credentials.json` is blocked
- Test `id_rsa`, `id_ed25519` are blocked
- Test `.env.example` is NOT blocked (exception for example/sample/template files)
- Test `allowImplicitForbidden` opt-in allows writing to specific secret files
- Test permissive mode logs warning but allows

#### TASK-149: Tests for `ToolHandler` secret scanning

**File:** `packages/cli/src/core/providers/tool-handler.test.ts` (extend)

- Test `write_file` with secret content in block mode returns error
- Test `write_file` with secret content in warn mode writes file with warning
- Test `write_file` with secret content in redact mode writes redacted content
- Test `run_command` output containing secrets is handled per mode
- Test that `read_file` is never blocked by secret scanning (read-only is safe)

#### TASK-150: Tests for `aidf hooks secrets` CLI command

**File:** `packages/cli/src/commands/hooks.test.ts` (extend)

- Test scanning a file with known secrets returns findings
- Test scanning a clean file returns no findings
- Test `--json` flag produces valid JSON output
- Test exit code is 1 when secrets are found, 0 when clean
- Test scanning staged git changes (mock git diff)

## Dependencies

```
TASK-137  (core scanner)
  ├── TASK-138  (entropy, extends 137)
  ├── TASK-139  (config types, parallel with 138)
  │     └── TASK-140  (executor integration, needs 137 + 139)
  │     └── TASK-142  (tool-handler integration, needs 137 + 139)
  ├── TASK-141  (ScopeGuard, needs 137 for IMPLICIT_FORBIDDEN_FILES concept)
  ├── TASK-143  (pre-commit, needs 137 + 140)
  └── TASK-144  (CLI command, needs 137 + 139)

Tests:
  TASK-145  depends on 137
  TASK-146  depends on 138
  TASK-147  depends on 140 + 143
  TASK-148  depends on 141
  TASK-149  depends on 142
  TASK-150  depends on 144
```

- TASK-137 must be completed first; everything else depends on it.
- TASK-138 and TASK-139 can run in parallel after 137.
- TASK-140, TASK-141, TASK-142 can run in parallel after 137 + 139.
- TASK-143 depends on 140 (extends executor commit flow).
- TASK-144 depends on 137 + 139 (uses scanner + config).
- Test tasks (145-150) should follow their corresponding implementation tasks.

## Risks

- **False positives in regex patterns:** The generic API key pattern and entropy detection are the most likely sources. Mitigation: conservative defaults (entropy off, generic patterns require assignment context), `allowed_patterns` and `allowed_files` escape hatches.
- **Performance impact on large files:** Scanning every changed file adds latency. Mitigation: skip binary files, cap file size at 1MB for scanning, run scans concurrently with `Promise.all`.
- **Redact mode data loss:** If redaction is too aggressive, it could corrupt valid output. Mitigation: only redact the matched secret value, not surrounding context. Log original line numbers so users can find what was redacted.
- **ScopeGuard implicit forbidden breaking existing tasks:** Tasks that legitimately write `.env.example` or test fixtures. Mitigation: exception for `.example`/`.sample`/`.template` suffixes, `allowImplicitForbidden` opt-in.
- **Custom regex patterns from config causing ReDoS:** User-supplied regexes could have catastrophic backtracking. Mitigation: wrap `new RegExp()` in try/catch, apply a 100ms timeout per pattern match using a simple character limit (reject patterns that match > 10,000 chars).

## Success Criteria

- `SecretScanner` detects all 18 built-in patterns with zero false negatives on the test suite
- False positive rate < 5% on a sample of 100 real open-source TypeScript files
- `secrets.mode: block` prevents any auto-commit containing a detected secret
- `secrets.mode: redact` masks secrets in AI output before it reaches logs or callbacks
- ScopeGuard blocks writes to `.env`, `.key`, `.pem`, `credentials.json` by default without explicit configuration
- `aidf hooks secrets` exits with code 1 when secrets are found (CI/CD compatible)
- All existing tests (532+) continue to pass
- New tests add 80+ test cases covering all patterns, modes, and integration points
- Config is backward-compatible: projects without `secrets:` in config.yml default to `{ mode: 'warn' }` with no behavior change to existing users
