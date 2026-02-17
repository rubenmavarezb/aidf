# TASK: Integration tests for executor + secret scanning

## Goal

Write integration tests verifying that the executor correctly handles secret detection in all three modes (warn, block, redact) for both AI output and file content, including pre-commit scanning behavior.

## Task Type

test

## Suggested Roles

- tester

## Auto-Mode Compatible

YES

## Scope

### Allowed

- `packages/cli/src/core/executor.test.ts` (extend)

### Forbidden

- `packages/cli/src/core/executor.ts` (read-only)
- `packages/cli/src/core/secret-scanner.ts` (read-only)

## Requirements

1. Test `warn` mode: executor logs warning but continues and completes.

2. Test `block` mode: executor increments `consecutiveFailures` when secret found in output.

3. Test `block` mode: executor reverts file when secret found in file content.

4. Test `redact` mode: `result.output` has secrets replaced with `[REDACTED:*]`.

5. Test pre-commit scanning: `commitChanges` returns `committed: false` when secrets found in block mode.

6. Test that `SecretsConfig.allowed_files` suppresses findings for matching files.

7. Test that `SecretsConfig.allowed_patterns` suppresses findings for matching patterns.

8. Test that when `secrets` config is not specified, default behavior is `warn` mode with no disruption.

## Definition of Done

- [ ] `warn` mode test: logs warning, execution continues
- [ ] `block` mode test: consecutiveFailures incremented on output secrets
- [ ] `block` mode test: files with secrets are reverted
- [ ] `redact` mode test: secrets masked in output
- [ ] Pre-commit scanning test: commit blocked when secrets found
- [ ] `allowed_files` suppression tested
- [ ] `allowed_patterns` suppression tested
- [ ] Default behavior (no config) tested
- [ ] All existing executor tests still pass
- [ ] `pnpm test` passes

## Notes

- Part of PLAN-v080-secrets-hardening.md
- Depends on TASK-140 (executor integration) and TASK-143 (pre-commit scanning)
