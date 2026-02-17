# TASK: Integrate `SecretScanner` into the executor loop

## Goal

Add secret scanning at two points in the executor's main loop: (1) after provider execution to scan AI output, and (2) after file changes are detected to scan written files. Support all three enforcement modes (warn, block, redact).

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

- `packages/cli/src/core/secret-scanner.ts` (read-only, already implemented)
- `packages/cli/src/types/index.ts` (read-only)
- `packages/cli/src/commands/` (read-only)

## Requirements

1. **After provider execution, before scope check** -- scan `result.output` for secrets:
   - In `warn` mode: log each finding via `logger.warn()`, continue execution.
   - In `block` mode: log findings, increment `consecutiveFailures`, emit phase `'Secret detected'`, `continue` the loop.
   - In `redact` mode: replace matched secret values in `result.output` with `[REDACTED:pattern-name]` before the output is stored in `previousOutput` or passed to callbacks.

2. **After file changes are detected, before commit** -- for each file in `result.filesChanged`, read the file content and scan it:
   - In `warn` mode: log warnings but allow commit.
   - In `block` mode: revert the files containing secrets (similar to scope violations), increment failures, continue.
   - In `redact` mode: NOT applicable for files (cannot silently modify AI-written files). Treat as `block` for file content and log a warning explaining that redact mode only applies to output.

3. Emit new phase event: `'Scanning for secrets'` before scanning starts.

4. Integration sketch (pseudo-code in executor loop):

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

5. Instantiate `SecretScanner` at the beginning of the execution loop using the resolved `SecretsConfig` from the config.

## Definition of Done

- [ ] `SecretScanner` instantiated in executor using `SecretsConfig`
- [ ] AI output scanned for secrets after provider execution
- [ ] Changed files scanned for secrets before commit
- [ ] `warn` mode logs warnings and continues
- [ ] `block` mode increments failures and reverts files with secrets
- [ ] `redact` mode masks secrets in AI output with `[REDACTED:pattern-name]`
- [ ] `redact` mode treats file content as `block` (cannot silently modify files)
- [ ] Phase event `'Scanning for secrets'` emitted
- [ ] All existing executor tests pass without modification
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes

## Notes

- Part of PLAN-v080-secrets-hardening.md
- Depends on TASK-137 (core scanner) and TASK-139 (config wiring)
