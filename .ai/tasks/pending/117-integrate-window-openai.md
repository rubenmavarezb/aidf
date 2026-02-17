# TASK: Integrate Conversation Window into OpenAI API Provider

## Goal
Integrate `ConversationWindow` into `OpenAiApiProvider.execute()` so that message history is trimmed according to the configured limits during execution, preventing unbounded message accumulation. This mirrors the Anthropic integration (task 116) but handles the OpenAI-specific message format differences.

## Task Type
feature

## Suggested Roles
- developer

## Auto-Mode Compatible
YES

## Scope
### Allowed
- packages/cli/src/core/providers/openai-api.ts
- packages/cli/src/core/providers/conversation-window.ts (read for imports)
- packages/cli/src/core/providers/types.ts (read for types)
- packages/cli/src/types/index.ts (read for types)

### Forbidden
- packages/cli/src/core/providers/anthropic-api.ts (read-only)
- packages/cli/src/core/executor.ts (read-only)
- packages/cli/src/core/providers/claude-cli.ts (read-only)

## Requirements
1. Import `ConversationWindow` and `ConversationHistoryConfig` into `openai-api.ts`.
2. Accept `ConversationHistoryConfig` from the provider options (passed through from executor config). If not present, use defaults.
3. Instantiate a `ConversationWindow` instance in the `execute()` method (or at the class level if config is available at construction).
4. After appending messages in the tool-call loop (lines 78-97 where the assistant message is pushed once, then each tool call result is pushed individually), call `window.trim(messages)` before the next API call.
5. If `summarize_on_trim` is true and there are evicted messages, call the summarization function (from task 118) before trimming. If summarization is not yet available, leave a hook/callback for it.
6. Include `conversationMetrics` in the returned `ExecutionResult`:
   ```typescript
   conversationMetrics: {
     totalMessages: number;
     preservedMessages: number;
     evictedMessages: number;
     estimatedTokens: number;
   }
   ```
7. Log a debug message when trimming occurs: "Trimmed conversation: {evicted} messages removed, {preserved} kept (~{tokens} tokens)".
8. Handle the OpenAI-specific message format differences:
   - Tool messages use `tool_call_id` (not `tool_use_id` as in Anthropic).
   - Assistant messages have a `tool_calls` array (not content blocks with `type: 'tool_use'`).
   - Tool result messages have `role: 'tool'` with a `tool_call_id` field.
   - The `ConversationWindow` operates on `{ role: string; content: unknown }` which is compatible, but ensure the `tool_call_id` fields are preserved during trimming.

## Definition of Done
- [ ] `ConversationWindow` is imported and instantiated in `openai-api.ts`
- [ ] `ConversationHistoryConfig` is accepted from provider options with sensible defaults
- [ ] `window.trim(messages)` is called after each tool-call round-trip, before the next API call
- [ ] A hook/callback is in place for summarization integration (task 118)
- [ ] `conversationMetrics` is included in the returned `ExecutionResult`
- [ ] Debug log message is emitted when trimming occurs with evicted count, preserved count, and estimated tokens
- [ ] OpenAI message format (tool_calls array, tool_call_id, role: 'tool') works correctly with the trim operation
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] Existing tests remain green

## Notes
- Part of PLAN-v080-message-history-management.md
- Depends on task 115 (needs `ConversationWindow` module)
- Can run in parallel with task 116 (Anthropic integration)
- Summarization (task 118) will be connected later; for now, the hook should gracefully skip if summarization is not configured or not available
