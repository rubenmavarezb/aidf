# TASK: Unit Tests for Conversation Summarization

## Goal
Write comprehensive unit tests for the summarization capability added to `ConversationWindow`, covering summary generation, message positioning, failure fallback, content filtering, rate limiting, and prompt format verification.

## Task Type
test

## Suggested Roles
- tester

## Auto-Mode Compatible
YES

## Scope
### Allowed
- packages/cli/src/core/providers/conversation-window.test.ts (append to existing test file from task 121, or create a separate summarization test section)
- packages/cli/src/core/providers/conversation-window.ts (read for implementation)
- packages/cli/src/types/index.ts (read for types)
- packages/cli/src/core/providers/types.ts (read for types)

### Forbidden
- packages/cli/src/core/providers/anthropic-api.ts (read-only)
- packages/cli/src/core/providers/openai-api.ts (read-only)

## Requirements

### Test Cases
1. **Summary replaces evicted messages**: When `summarize_on_trim` is true and a summarizer is provided, the evicted messages are replaced with a single synthetic "assistant" message containing the summary. Verify the evicted messages are no longer in the trimmed array.

2. **Summary message positioning**: The summary message is correctly positioned between the preserved head and preserved tail: `[preserved_head..., summary_message, preserved_tail...]`. Verify the order by checking message indices.

3. **Summary message format**: The synthetic summary message has `role: 'assistant'` and its content is prefixed with "[Conversation Summary]".

4. **Summarization failure fallback**: When the summarizer callback throws an error (API error, timeout), the method falls back to plain eviction (no summary message). The trimmed array contains only `[preserved_head..., kept_middle..., preserved_tail...]` as if summarization was not configured. A warning is logged.

5. **Skip when no meaningful text**: When evicted messages contain only tool results with no meaningful text content (e.g., only `{type: 'tool_result', content: []}` blocks), summarization is skipped and plain eviction is used.

6. **Rate limiting**: Summarization does not fire on every small trim. Verify that summarization fires at most once per 10 evicted messages. If fewer than 10 messages are evicted since the last summarization, plain eviction is used instead.

7. **Summarization prompt format**: Mock the provider `call()` function and verify that the summarization prompt includes the instruction: "Summarize the following conversation history concisely. Focus on: what files were read/written, what decisions were made, what problems were encountered, and what the current state of the task is. Be factual and brief." Also verify the evicted message content is included in the prompt.

8. **No summarizer provided**: When `summarize_on_trim` is true but no summarizer callback is provided to `trim()`, plain eviction is used without error.

9. **summarize_on_trim is false**: When `summarize_on_trim` is false, the summarizer callback is never invoked even if provided. Verify with a mock that `call()` is never called.

## Definition of Done
- [ ] All 9 test cases listed above are implemented
- [ ] Tests use Vitest framework (consistent with the rest of the project)
- [ ] Summarizer callback is mocked using `vi.fn()` to verify calls and arguments
- [ ] Failure scenarios use mock rejections (`vi.fn().mockRejectedValue(...)`)
- [ ] Console warning is verified in fallback scenarios using `vi.spyOn(console, 'warn')`
- [ ] All tests pass with `pnpm test`
- [ ] Tests cover the async nature of `trim()` when a summarizer is provided

## Notes
- Part of PLAN-v080-message-history-management.md
- Depends on task 118 (tests the summarization feature)
- Tests may be added to the same test file as task 121 or in a separate describe block
