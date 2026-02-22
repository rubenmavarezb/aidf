# TASK: Implement Conversation Summarization

## Goal
Add summarization capability to `ConversationWindow`. When `summarize_on_trim` is true, evicted messages are condensed into a compact summary message before being discarded, preserving important context about what files were read/written, what decisions were made, and the current state of the task.

## Task Type
feature

## Suggested Roles
- developer

## Auto-Mode Compatible
YES

## Scope
### Allowed
- packages/cli/src/core/providers/conversation-window.ts

### Forbidden
- packages/cli/src/core/providers/anthropic-api.ts (read-only)
- packages/cli/src/core/providers/openai-api.ts (read-only)
- packages/cli/src/core/executor.ts (read-only)

## Requirements

### Summarization Flow
1. Before evicting middle-zone messages, extract their text content.
2. Build a summarization prompt: "Summarize the following conversation history concisely. Focus on: what files were read/written, what decisions were made, what problems were encountered, and what the current state of the task is. Be factual and brief."
3. Call the provider via an injected callback (the provider needs a lightweight `summarize(text: string): Promise<string>` method, or we use a standalone API call via the callback).
4. Replace the evicted messages with a single synthetic "assistant" message containing the summary, prefixed with "[Conversation Summary]".
5. The resulting message array is: `[preserved_head..., summary_message, preserved_tail...]`.

### Method Signature
Add a `summarize(messages: unknown[], provider: { call(prompt: string): Promise<string> }): Promise<string>` method to `ConversationWindow`. The provider callback is injected by the API provider during integration.

### Design Decisions
- Summarization uses the same model/API but with a smaller `max_tokens` (1024). This adds one API call per trim but dramatically improves context quality compared to raw eviction.
- The provider callback is injected rather than having the window depend on a specific provider, maintaining the provider-agnostic design.

### Edge Cases
1. **Summarization failure**: If the API call fails (API error, timeout), fall back to plain eviction (no summary message). Log a warning but do not fail the execution.
2. **No meaningful text**: If evicted messages contain only tool results with no meaningful text content, skip summarization and use plain eviction.
3. **Rate limiting**: At most once every 10 messages evicted (don't summarize on every trim). Track the number of messages evicted since the last summarization and only trigger if the threshold is met.

### Integration Points
- The `trim()` method should be updated to accept an optional provider callback for summarization: `trim(messages: Message[], summarizer?: { call(prompt: string): Promise<string> }): Promise<{ trimmed: Message[]; evicted: Message[]; metrics: ConversationMetrics }>`
- Note: making `trim()` async is a breaking change from task 115 — update the signature accordingly.
- When `summarize_on_trim` is false or no summarizer is provided, the method behaves exactly as before (synchronous eviction).

## Definition of Done
- [ ] `summarize()` method is added to `ConversationWindow` with the specified signature
- [ ] Summarization prompt is correctly constructed from evicted message content
- [ ] Summary is inserted as a synthetic "assistant" message prefixed with "[Conversation Summary]"
- [ ] Resulting message array is correctly ordered: `[preserved_head..., summary_message, preserved_tail...]`
- [ ] Summarization failure falls back to plain eviction with a warning log
- [ ] Summarization is skipped when evicted messages contain only tool results with no meaningful text
- [ ] Rate limiting is implemented: summarization fires at most once per 10 evicted messages
- [ ] Provider callback injection works correctly (provider-agnostic design maintained)
- [ ] `trim()` signature is updated to accept optional summarizer and returns a Promise
- [ ] When `summarize_on_trim` is false or no summarizer is provided, behavior is identical to plain windowing
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes

## Notes
- Part of PLAN-v080-message-history-management.md
- Depends on task 115 (extends `ConversationWindow` module)
- The summarization uses `max_tokens: 1024` for the summary call to keep summaries compact
- Tasks 116 and 117 (provider integrations) will provide the summarizer callback when connecting the window
