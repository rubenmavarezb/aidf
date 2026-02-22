# TASK: Unit Tests for Conversation Window

## Goal
Write comprehensive unit tests for the `ConversationWindow` class in `core/providers/conversation-window.ts`, covering the sliding window algorithm, token estimation, metrics computation, edge cases, and config defaults.

## Task Type
test

## Suggested Roles
- tester

## Auto-Mode Compatible
YES

## Scope
### Allowed
- packages/cli/src/core/providers/conversation-window.test.ts (new file)
- packages/cli/src/core/providers/conversation-window.ts (read for implementation)
- packages/cli/src/types/index.ts (read for types)
- packages/cli/src/core/providers/types.ts (read for types)

### Forbidden
- packages/cli/src/core/providers/anthropic-api.ts (read-only)
- packages/cli/src/core/providers/openai-api.ts (read-only)

## Requirements

### Test Cases for `trim()`
1. **Under cap**: `trim()` returns messages unchanged when the message count is below `max_messages`. Evicted array is empty. Metrics show 0 evicted.
2. **Preserves first N**: With `preserve_first_n: 2` and messages exceeding the cap, verify the first 2 messages are always in the result.
3. **Preserves last N**: With `preserve_last_n: 5` and messages exceeding the cap, verify the last 5 messages are always in the result.
4. **Evicts oldest middle messages**: When trimming, the oldest messages in the middle zone are evicted first. The most recent middle messages are kept.
5. **Edge case — fewer messages than preserve_first_n + preserve_last_n**: When total messages are fewer than `preserve_first_n + preserve_last_n`, all messages are returned. No crash.
6. **Edge case — exactly at cap**: When message count equals `max_messages`, no trimming occurs.
7. **Edge case — empty array**: `trim([])` returns an empty array, empty evicted, and zeroed metrics.
8. **Edge case — preserve settings exceed max**: When `preserve_first_n + preserve_last_n >= max_messages`, only head and tail are kept, a warning is logged.
9. **Metrics accuracy**: After trimming, verify `metrics.totalMessages` equals original count, `metrics.preservedMessages` equals trimmed count, `metrics.evictedMessages` equals evicted count, and `metrics.estimatedTokens` is computed.

### Test Cases for `estimateTokens()`
10. **String content**: Messages with string content produce a reasonable token estimate (chars / 4).
11. **Object content**: Messages with object content (Anthropic content blocks) are stringified and estimated.
12. **Mixed arrays**: Messages with mixed content types (some string, some object arrays) produce correct aggregate estimates.
13. **Empty content**: Messages with empty string or null content produce 0 tokens for those messages.

### Test Cases for Config Defaults
14. **Omitted fields**: When `ConversationHistoryConfig` has omitted fields, defaults are applied (max_messages: 100, summarize_on_trim: false, preserve_first_n: 1, preserve_last_n: 20).
15. **Partial config**: When only some fields are provided, the rest use defaults.

## Definition of Done
- [ ] Test file is created at `packages/cli/src/core/providers/conversation-window.test.ts`
- [ ] All 15 test cases listed above are implemented
- [ ] Tests use Vitest framework (consistent with the rest of the project)
- [ ] Tests use mock messages in `{ role: string; content: unknown }` shape
- [ ] All tests pass with `pnpm test`
- [ ] Tests cover both Anthropic-style (array content blocks) and OpenAI-style (string content) message formats

## Notes
- Part of PLAN-v080-message-history-management.md
- Depends on task 115 (tests the conversation window module)
- Use `vi.spyOn(console, 'warn')` or similar to verify warning messages in edge cases
