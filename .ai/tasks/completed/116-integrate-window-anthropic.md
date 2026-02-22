# TASK: Integrate Conversation Window into Anthropic API Provider

## Goal
Integrate `ConversationWindow` into `AnthropicApiProvider.execute()` so that message history is trimmed according to the configured limits during execution, preventing unbounded message accumulation.

## Task Type
feature

## Suggested Roles
- developer

## Auto-Mode Compatible
YES

## Scope
### Allowed
- packages/cli/src/core/providers/anthropic-api.ts
- packages/cli/src/core/providers/conversation-window.ts (read for imports)
- packages/cli/src/core/providers/types.ts (read for types)
- packages/cli/src/types/index.ts (read for types)

### Forbidden
- packages/cli/src/core/providers/openai-api.ts (read-only)
- packages/cli/src/core/executor.ts (read-only)
- packages/cli/src/core/providers/claude-cli.ts (read-only)

## Requirements
1. Import `ConversationWindow` and `ConversationHistoryConfig` into `anthropic-api.ts`.
2. Accept `ConversationHistoryConfig` from the provider options (passed through from executor config). If not present, use defaults.
3. Instantiate a `ConversationWindow` instance in the `execute()` method (or at the class level if config is available at construction).
4. After appending messages in the tool-call loop (lines 88-101 where `response.content` array and `tool_result` messages are appended), call `window.trim(messages)` before the next API call.
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
8. Ensure that the Anthropic-specific message format (content blocks as arrays of `{type: 'text', text}`, `{type: 'tool_use', id, name, input}`, `{type: 'tool_result', tool_use_id, content}`) is handled correctly by the window — the `ConversationWindow` operates on `{ role: string; content: unknown }` which is compatible.

## Definition of Done
- [ ] `ConversationWindow` is imported and instantiated in `anthropic-api.ts`
- [ ] `ConversationHistoryConfig` is accepted from provider options with sensible defaults
- [ ] `window.trim(messages)` is called after each tool-call round-trip, before the next API call
- [ ] A hook/callback is in place for summarization integration (task 118)
- [ ] `conversationMetrics` is included in the returned `ExecutionResult`
- [ ] Debug log message is emitted when trimming occurs with evicted count, preserved count, and estimated tokens
- [ ] Anthropic message format (content blocks) works correctly with the trim operation
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] Existing tests remain green

## Notes
- Part of PLAN-v080-message-history-management.md
- Depends on task 115 (needs `ConversationWindow` module)
- Task 117 (OpenAI integration) can run in parallel with this task
- Summarization (task 118) will be connected later; for now, the hook should gracefully skip if summarization is not configured or not available
