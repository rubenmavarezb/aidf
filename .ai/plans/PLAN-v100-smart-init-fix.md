# PLAN: v1.0.x — Fix `aidf init --smart` failure and silent errors

## Status: PENDING

## Overview

`aidf init --smart` shows "AI generation complete" immediately followed by "AI generation failed" without any explanation of what went wrong. Investigation reveals multiple bugs:

1. **Timeout value is 120ms instead of 120s** — `provider.execute(prompt, { timeout: 120 })` passes 120 to `setTimeout()` which expects milliseconds. This gives Claude CLI 0.12 seconds to respond, which is impossible. If the process happens to return before the timeout fires (race condition), the output likely gets truncated.
2. **Misleading spinner** — `logger.stopSpinner(true, 'AI generation complete')` runs before checking `result.success`, so it always says "complete" even when the result failed.
3. **Silent error swallowing** — When the result fails, neither `result.error` nor `result.output` are shown to the user (only logged at debug level for one code path, not at all for others).
4. **Fragile output parsing** — The regex expects `` ```agents.md `` and `` ```config.yml `` code fences. If Claude wraps them differently (`` ```markdown ``, `` ```yaml ``, or no language tag), parsing fails silently.

## Goals

- Fix the timeout value (120ms → 120_000ms)
- Show meaningful error information when AI generation fails
- Fix the spinner to reflect actual success/failure
- Make output parsing more robust
- Add `--verbose` debug output for the full AI response on failure

## Non-Goals

- Changing the smart-init prompt template
- Adding new providers for smart init
- Redesigning the init flow

## Tasks

- [ ] `092-fix-smart-init.md` — Fix all `--smart` init bugs in a single focused change (wave: 1)

  **File: `packages/cli/src/commands/init.ts`**

  **Bug 1 — Timeout (line 333):**
  ```typescript
  // BEFORE (120ms — Claude can't even start)
  const result = await provider.execute(prompt, { timeout: 120 });

  // AFTER (120 seconds)
  const result = await provider.execute(prompt, { timeout: 120_000 });
  ```

  **Bug 2 — Misleading spinner (lines 334-338):**
  ```typescript
  // BEFORE — always says "complete" then separately says "failed"
  logger.stopSpinner(true, 'AI generation complete');
  if (!result.success || !result.output) {
    logger.warn('AI generation failed. You can customize .ai/AGENTS.md manually.');
    return;
  }

  // AFTER — spinner reflects actual result
  if (!result.success || !result.output) {
    logger.stopSpinner(false, 'AI generation failed');
    if (result.error) {
      logger.warn(`Reason: ${result.error.slice(0, 200)}`);
    }
    if (!result.output) {
      logger.warn('No output received from AI provider.');
    } else {
      logger.debug('AI output (no parseable blocks found):');
      logger.debug(result.output.slice(0, 500));
    }
    logger.info('You can customize .ai/AGENTS.md manually.');
    return;
  }
  logger.stopSpinner(true, 'AI generation complete');
  ```

  **Bug 3 — Silent parse failure (lines 342-349):**
  ```typescript
  // BEFORE — just says "could not parse", throws away AI output
  if (!agentsMatch && !configMatch) {
    logger.warn('Could not parse AI output. You can customize .ai/AGENTS.md manually.');
    logger.debug('AI output:');
    logger.debug(result.output);
    return;
  }

  // AFTER — show what was received and save raw output for user
  if (!agentsMatch && !configMatch) {
    logger.warn('Could not extract AGENTS.md or config.yml blocks from AI output.');
    logger.warn('Expected code fences: ```agents.md or ```config.yml');
    // Save the raw output so the user can manually extract useful parts
    const rawOutputPath = join(aiDir, 'smart-init-output.md');
    writeFileSync(rawOutputPath, `# Raw AI Output (smart init)\n\n${result.output}`);
    logger.info(`Raw AI output saved to ${rawOutputPath}`);
    logger.info('You can extract useful sections and paste them into .ai/AGENTS.md manually.');
    return;
  }
  ```

  **Bug 4 — Fragile regex (line 342-343):**
  ```typescript
  // BEFORE — only matches ```agents.md exactly
  const agentsMatch = result.output.match(/```agents\.md\n([\s\S]*?)```/);
  const configMatch = result.output.match(/```config\.yml\n([\s\S]*?)```/);

  // AFTER — match common variations
  const agentsMatch = result.output.match(/```(?:agents\.md|markdown|md)?\n(# [\s\S]*?)```/)
    || result.output.match(/```agents\.md\n([\s\S]*?)```/);
  const configMatch = result.output.match(/```(?:config\.yml|ya?ml)\n([\s\S]*?)```/)
    || result.output.match(/```config\.yml\n([\s\S]*?)```/);
  ```
  Note: The first regex for agents looks for content starting with `# ` (markdown heading) inside any markdown/md fence. This avoids false positives from other code blocks. The original exact-match regex is kept as fallback.

  **Scope:**
  - Allowed: `packages/cli/src/commands/init.ts`
  - Forbidden: `packages/cli/src/core/**`

  **Definition of Done:**
  - [ ] Timeout is 120_000 (120 seconds), not 120
  - [ ] Spinner shows failure state when AI generation fails
  - [ ] Error reason is displayed to user on failure
  - [ ] Raw AI output is saved to file when parsing fails
  - [ ] Code fence parsing handles `markdown`, `md`, `yaml`, `yml` variations
  - [ ] `pnpm lint` and `pnpm typecheck` pass
  - [ ] Manual test: `aidf init --smart` in a test project with Claude CLI available

- [ ] `093-smart-init-tests.md` — Add test coverage for `runSmartInit` (wave: 2, depends: 092)

  **File: `packages/cli/src/commands/init.test.ts`**

  Add test cases for the smart init flow:
  - Test: timeout value passed to provider is 120_000
  - Test: spinner shows failure when `result.success` is false
  - Test: error message is displayed when `result.error` is present
  - Test: raw output saved to `smart-init-output.md` when parsing fails
  - Test: parses `` ```agents.md `` code fence correctly
  - Test: parses `` ```markdown `` code fence as agents content
  - Test: parses `` ```yaml `` code fence as config content
  - Test: handles empty AI output gracefully
  - Test: handles AI output with no code fences gracefully
  - Test: skips when provider is not available
  - Test: skips when user declines confirmation

  **Scope:**
  - Allowed: `packages/cli/src/commands/init.test.ts`
  - Forbidden: `packages/cli/src/commands/init.ts` (no source changes)

  **Definition of Done:**
  - [ ] 11+ new tests for smart init
  - [ ] All tests pass (`pnpm test`)
  - [ ] Mocks provider correctly (no real Claude CLI calls)

## Dependencies

```
092 ──> 093
```

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Broader regex matches wrong code blocks | Medium | Low | First agents regex requires `# ` heading start; config regex requires YAML-like content; original exact-match kept as fallback |
| 120s timeout still too short for large projects | Low | Low | 120s is generous for `--print` mode; user can retry |
| Saving raw output to disk may confuse users | Low | Low | File is clearly named `smart-init-output.md` with explanation header |

## Success Criteria

- [ ] `aidf init --smart` with working Claude CLI completes and generates AGENTS.md
- [ ] `aidf init --smart` with failing Claude CLI shows clear error message (not "complete" then "failed")
- [ ] When AI output doesn't contain expected fences, raw output is saved for manual extraction
- [ ] All tests pass

## Notes

- The 120ms timeout bug is likely the root cause of the user's screenshot. Claude CLI process gets SIGTERM'd almost immediately, returns exit code != 0, and the output is empty or truncated.
- Even after fixing the timeout, the other bugs (spinner, error swallowing, fragile parsing) should be fixed to prevent future confusion.
- This is a quick fix — 2 tasks, focused scope, high user impact.
