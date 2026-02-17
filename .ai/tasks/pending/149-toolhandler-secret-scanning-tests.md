# TASK: Tests for `ToolHandler` secret scanning

## Goal

Write tests verifying that `ToolHandler` correctly scans for secrets in `write_file` content and `run_command` output, handling all three enforcement modes (warn, block, redact).

## Task Type

test

## Suggested Roles

- tester

## Auto-Mode Compatible

YES

## Scope

### Allowed

- `packages/cli/src/core/providers/tool-handler.test.ts` (extend)

### Forbidden

- `packages/cli/src/core/providers/tool-handler.ts` (read-only)
- `packages/cli/src/core/secret-scanner.ts` (read-only)

## Requirements

1. Test `write_file` with secret content in `block` mode returns error message suggesting env var usage.

2. Test `write_file` with secret content in `warn` mode writes file with warning in return message.

3. Test `write_file` with secret content in `redact` mode writes file with secrets replaced by `${REDACTED_SECRET}`.

4. Test `run_command` output containing secrets is handled per mode:
   - `block`: returns error instead of output
   - `warn`: returns output with prepended warning
   - `redact`: masks secrets in returned string

5. Test that `read_file` is never blocked by secret scanning (read-only is safe).

6. Test that `ToolHandler` works normally when no `SecretsConfig` is provided (backward compatibility).

## Definition of Done

- [ ] `write_file` block mode: error returned, file not written
- [ ] `write_file` warn mode: file written with warning
- [ ] `write_file` redact mode: file written with redacted content
- [ ] `run_command` block mode: error returned
- [ ] `run_command` warn mode: output with warning
- [ ] `run_command` redact mode: output with masked secrets
- [ ] `read_file` never blocked
- [ ] Backward compatibility without config tested
- [ ] All existing ToolHandler tests still pass
- [ ] `pnpm test` passes

## Notes

- Part of PLAN-v080-secrets-hardening.md
- Depends on TASK-142 (ToolHandler secret scanning implementation)
