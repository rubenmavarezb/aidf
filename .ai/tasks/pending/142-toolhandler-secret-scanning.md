# TASK: Integrate secret scanning into `ToolHandler` for API providers

## Goal

Add secret scanning to the `ToolHandler` used by API providers (`anthropic-api`, `openai-api`). Scan content before `write_file` operations and scan `run_command` output before returning it to the AI.

## Task Type

feature

## Suggested Roles

- developer

## Auto-Mode Compatible

YES

## Scope

### Allowed

- `packages/cli/src/core/providers/tool-handler.ts`

### Forbidden

- `packages/cli/src/core/secret-scanner.ts` (read-only)
- `packages/cli/src/core/executor.ts` (read-only)
- `packages/cli/src/commands/` (read-only)

## Requirements

1. Update the `ToolHandler` constructor to accept `SecretsConfig`:

```typescript
constructor(
  cwd: string,
  commandPolicy?: CommandPolicy,
  scope?: TaskScope,
  scopeMode?: ScopeMode,
  secretsConfig?: SecretsConfig  // NEW
)
```

2. For `write_file` tool, scan content with `SecretScanner` before writing:
   - In `block` mode: return an error message to the AI explaining what was detected and asking it to use env vars instead. Do NOT write the file.
   - In `warn` mode: write the file but include a warning in the return message.
   - In `redact` mode: replace secrets in the content with `${REDACTED_SECRET}` placeholder before writing.

3. For `run_command` tool, scan command output for secrets before returning to the AI:
   - In `redact` mode: mask secrets in the returned string.
   - In `block` mode: return an error instead of the output.
   - In `warn` mode: return the output with a prepended warning.

4. `read_file` should never be blocked by secret scanning (read-only is safe).

## Definition of Done

- [ ] `ToolHandler` constructor accepts optional `SecretsConfig` parameter
- [ ] `write_file` scans content and handles all three modes correctly
- [ ] `run_command` output is scanned and handled per mode
- [ ] `read_file` is never blocked by secret scanning
- [ ] `block` mode returns informative error messages suggesting env var usage
- [ ] `redact` mode replaces secrets with `${REDACTED_SECRET}` in file content
- [ ] All existing ToolHandler tests pass without modification
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes

## Notes

- Part of PLAN-v080-secrets-hardening.md
- Depends on TASK-137 (core scanner) and TASK-139 (config types)
