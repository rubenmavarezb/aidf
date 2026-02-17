# TASK: Add pre-commit secret scan to the executor's commit flow

## Goal

Extend the executor's `commitChanges` method to scan staged file content for secrets before committing. If secrets are found in `block` mode, prevent the commit and feed findings back to the AI as an error message.

## Task Type

feature

## Suggested Roles

- developer

## Auto-Mode Compatible

YES

## Scope

### Allowed

- `packages/cli/src/core/executor.ts`

### Forbidden

- `packages/cli/src/core/secret-scanner.ts` (read-only)
- `packages/cli/src/commands/` (read-only)

## Requirements

1. Modify the `commitChanges` method signature:

```typescript
private async commitChanges(
  files: string[],
  taskGoal: string,
  secretScanner?: SecretScanner
): Promise<{ committed: boolean; secretsFound: SecretFinding[] }>
```

2. Before `git.add()` and `git.commit()`, scan the staged files for secrets:
   - For each file in the `files` array, read its content.
   - Run `SecretScanner.scan()` on each file's content.
   - If any HIGH or MEDIUM severity findings are detected:
     - In `block` mode: do NOT commit. Log the findings. Return `{ committed: false, secretsFound }`.
     - In `warn` mode: log warnings, proceed with commit. Return `{ committed: true, secretsFound }`.
     - In `redact` mode: treat as `block` for commits (cannot redact committed content).

3. The executor loop should handle the `committed: false` case by:
   - Incrementing `consecutiveFailures`
   - Feeding the secret findings back to the AI as an error message (similar to validation errors)

## Definition of Done

- [ ] `commitChanges` signature updated with optional `SecretScanner` parameter
- [ ] Return type changed to `{ committed: boolean; secretsFound: SecretFinding[] }`
- [ ] Files scanned before `git.add()` and `git.commit()`
- [ ] `block` mode prevents commit when HIGH/MEDIUM findings exist
- [ ] `warn` mode logs warnings but allows commit
- [ ] `redact` mode treated as `block` for commits
- [ ] Executor loop handles `committed: false` by incrementing failures
- [ ] Secret findings fed back to AI as error messages
- [ ] All existing executor tests pass without modification
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes

## Notes

- Part of PLAN-v080-secrets-hardening.md
- Depends on TASK-137 (core scanner) and TASK-140 (executor integration)
