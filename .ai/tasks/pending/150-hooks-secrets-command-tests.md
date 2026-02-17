# TASK: Tests for `aidf hooks secrets` CLI command

## Goal

Write tests for the `aidf hooks secrets` CLI command verifying file scanning, output formatting, JSON output, exit codes, and staged git change scanning.

## Task Type

test

## Suggested Roles

- tester

## Auto-Mode Compatible

YES

## Scope

### Allowed

- `packages/cli/src/commands/hooks.test.ts` (extend)

### Forbidden

- `packages/cli/src/commands/hooks.ts` (read-only)
- `packages/cli/src/core/secret-scanner.ts` (read-only)

## Requirements

1. Test scanning a file with known secrets returns findings with correct format.

2. Test scanning a clean file returns no findings.

3. Test `--json` flag produces valid JSON output with all finding fields.

4. Test exit code is 1 when secrets are found, 0 when clean.

5. Test scanning staged git changes (mock git diff to provide file list).

6. Test `--fix` flag shows remediation suggestions.

7. Test scanning a directory recursively.

8. Test that project config (allowed_files, allowed_patterns) is applied when available.

## Definition of Done

- [ ] File with secrets: findings returned in correct format
- [ ] Clean file: no findings
- [ ] `--json` flag: valid JSON output
- [ ] Exit code 1 with secrets, 0 without
- [ ] Staged git changes scanning tested (mocked)
- [ ] `--fix` flag remediation suggestions tested
- [ ] Directory scanning tested
- [ ] Project config integration tested
- [ ] All existing hooks tests still pass
- [ ] `pnpm test` passes

## Notes

- Part of PLAN-v080-secrets-hardening.md
- Depends on TASK-144 (hooks secrets command implementation)
