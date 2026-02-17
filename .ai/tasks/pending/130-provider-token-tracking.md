# TASK: Improve Per-Provider Token Tracking

## Goal
Improve token tracking accuracy across all four providers, ensuring each provider extracts or estimates token usage and passes it through in `ExecutionResult.tokenUsage`.

Per-provider requirements:

- **anthropic-api**: Already returns `usage.input_tokens` and `usage.output_tokens` from the API response. Ensure these are passed through in `ExecutionResult.tokenUsage`. Add cache read/write token tracking if available.
- **openai-api**: Extract `usage.prompt_tokens` and `usage.completion_tokens` from the API response. Map to `inputTokens`/`outputTokens` in `ExecutionResult.tokenUsage`.
- **claude-cli**: Parse `claude --print` output for token usage hints. Claude CLI may output usage stats in stderr or structured output. If not available, estimate from prompt character count (1 token ~ 4 chars) and output character count. Mark estimates with `estimated: true` flag.
- **cursor-cli**: Similar to claude-cli -- parse output or estimate. Mark as estimated.

Add `estimated: boolean` field to the token usage in `ExecutionResult` so reports can distinguish actual vs estimated usage.

## Task Type
feature

## Suggested Roles
- developer

## Auto-Mode Compatible
YES

## Scope
### Allowed
- packages/cli/src/core/providers/anthropic-api.ts
- packages/cli/src/core/providers/openai-api.ts
- packages/cli/src/core/providers/claude-cli.ts
- packages/cli/src/core/providers/cursor-cli.ts
- packages/cli/src/core/providers/types.ts
- packages/cli/src/core/providers/*.test.ts

### Forbidden
- packages/cli/src/core/executor.ts (read-only)
- packages/cli/src/commands/** (read-only)

## Requirements
- Update `providers/types.ts` `ExecutionResult.tokenUsage` to include `estimated: boolean` field
- API providers (anthropic-api, openai-api) must report actual token counts with `estimated: false`
- CLI providers (claude-cli, cursor-cli) should attempt to parse token info from output, falling back to character-based estimation with `estimated: true`
- Character-based estimation: 1 token ~ 4 characters
- Token tracking must not throw errors that break execution -- always wrap in try/catch
- Existing provider behavior must not change beyond adding token tracking

## Definition of Done
- [ ] `estimated` field added to `ExecutionResult.tokenUsage` in `providers/types.ts`
- [ ] anthropic-api passes through actual token counts with `estimated: false`
- [ ] openai-api extracts and maps token counts with `estimated: false`
- [ ] claude-cli estimates tokens from character counts with `estimated: true`
- [ ] cursor-cli estimates tokens from character counts with `estimated: true`
- [ ] Unit tests for each provider's token extraction logic
- [ ] TypeScript compiles with no errors (`pnpm typecheck`)
- [ ] All tests pass (`pnpm test`)

## Notes
- Part of PLAN-v080-observability.md
- Independent of tasks 125-129 (modifies providers only)
- Depends on task 124 for types
