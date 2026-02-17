# TASK: Add `aidf hooks secrets` CLI command for manual secret scanning

## Goal

Add a subcommand `aidf hooks secrets [path]` that allows users to manually scan files or staged git changes for secrets, producing a formatted report with exit codes suitable for CI/CD.

## Task Type

feature

## Suggested Roles

- developer

## Auto-Mode Compatible

YES

## Scope

### Allowed

- `packages/cli/src/commands/hooks.ts`

### Forbidden

- `packages/cli/src/core/secret-scanner.ts` (read-only)
- `packages/cli/src/core/executor.ts` (read-only)

## Requirements

1. Add a subcommand `aidf hooks secrets [path]` that:
   - Accepts a file path, directory, or defaults to scanning staged git changes.
   - Runs `SecretScanner` against the targets.

2. Output a formatted report:

```
Secret Scan Results
===================

FOUND: 3 potential secrets in 2 files

  src/config.ts:14  [HIGH]  AWS Access Key ID  (AKIA****)
  src/config.ts:15  [HIGH]  AWS Secret Key     (wJal****)
  src/api.ts:42     [MED]   Generic API Key    (sk-p****)

Run with --fix to see remediation suggestions.
```

3. Exit code: 0 if no findings, 1 if findings exist (useful in CI/CD).

4. `--json` flag for machine-readable output (valid JSON).

5. `--fix` flag shows remediation suggestions (e.g., "Replace with `${AWS_ACCESS_KEY_ID}` environment variable").

6. Load `SecretsConfig` from project's `.ai/config.yml` if available to apply allowed_files, allowed_patterns, and custom patterns.

## Definition of Done

- [ ] `aidf hooks secrets` subcommand implemented
- [ ] Accepts file path, directory path, or defaults to staged git changes
- [ ] Formatted report output with file, line, severity, pattern name, and preview
- [ ] Exit code 0 when clean, 1 when findings exist
- [ ] `--json` flag produces valid JSON output
- [ ] `--fix` flag shows remediation suggestions
- [ ] Loads project config for allowed_files/allowed_patterns
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes

## Notes

- Part of PLAN-v080-secrets-hardening.md
- Depends on TASK-137 (core scanner) and TASK-139 (config types)
