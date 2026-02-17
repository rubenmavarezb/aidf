# TASK: Implement Conversation Window Module

## Goal
Create a new module `core/providers/conversation-window.ts` that implements the sliding window algorithm for managing conversation history in API providers.

## Task Type
feature

## Suggested Roles
- developer

## Auto-Mode Compatible
YES

## Scope
### Allowed
- packages/cli/src/core/providers/conversation-window.ts (new file)
- packages/cli/src/types/index.ts (read for types)
- packages/cli/src/core/providers/types.ts (read for types)

### Forbidden
- packages/cli/src/core/providers/anthropic-api.ts (read-only)
- packages/cli/src/core/providers/openai-api.ts (read-only)
- packages/cli/src/core/executor.ts (read-only)

## Requirements

### Class: ConversationWindow

1. **Constructor**: `ConversationWindow(config: ConversationHistoryConfig)` — accepts the configuration and applies defaults for any omitted fields:
   - `max_messages` defaults to 100
   - `summarize_on_trim` defaults to false
   - `preserve_first_n` defaults to 1
   - `preserve_last_n` defaults to 20

2. **Core method**: `trim(messages: Message[]): { trimmed: Message[]; evicted: Message[]; metrics: ConversationMetrics }`

3. **Sliding window algorithm** (implemented in `trim()`):
   - Step 1: If `messages.length <= max_messages`, return messages unchanged with empty evicted array and computed metrics.
   - Step 2: Split messages into three zones:
     - **Preserved head**: the first `preserve_first_n` messages (always kept — these contain the system prompt / initial context with AGENTS.md, role, task, skills).
     - **Preserved tail**: the last `preserve_last_n` messages (always kept — recent context the model needs for continuity).
     - **Middle zone**: everything between head and tail — candidates for eviction.
   - Step 3: If `preserve_first_n + preserve_last_n >= max_messages`, only keep head + tail (warn via console that preserve settings exceed max).
   - Step 4: Calculate how many middle messages to keep: `keep_middle = max_messages - preserve_first_n - preserve_last_n`.
   - Step 5: Keep the **last** `keep_middle` messages from the middle zone (more recent = more relevant). Evict the rest.
   - Step 6: Return the trimmed array (`[...head, ...kept_middle, ...tail]`), the evicted messages, and metrics.

4. **Token estimation method**: `estimateTokens(messages: Message[]): number`
   - Iterate over each message's content.
   - If content is a string, count its characters.
   - If content is an object or array (Anthropic content blocks: array of `{type, text}` or `{type, tool_use_id}`), stringify it and count characters.
   - Divide total character count by 4 (1 token ~ 4 chars approximation).
   - Handle both Anthropic content blocks (array of text/tool_use/tool_result) and OpenAI string/tool messages.

5. **Metrics type** (use `ConversationMetrics` from `providers/types.ts`):
   ```typescript
   interface ConversationMetrics {
     totalMessages: number;
     preservedMessages: number;
     evictedMessages: number;
     estimatedTokens: number;
   }
   ```

6. **Provider-agnostic design**: The class must be provider-agnostic — it operates on a generic message type. Use a minimal `{ role: string; content: unknown }` shape so it works with both Anthropic and OpenAI message formats without coupling to either SDK.

7. **Export**: Export the `ConversationWindow` class and any helper types from the module.

## Definition of Done
- [ ] `conversation-window.ts` is created at `packages/cli/src/core/providers/conversation-window.ts`
- [ ] `ConversationWindow` class is implemented with constructor accepting `ConversationHistoryConfig`
- [ ] Default values are applied for omitted config fields (max_messages: 100, summarize_on_trim: false, preserve_first_n: 1, preserve_last_n: 20)
- [ ] `trim()` method implements the full sliding window algorithm as specified
- [ ] `trim()` correctly handles edge case: messages under the cap (returned unchanged)
- [ ] `trim()` correctly handles edge case: preserve_first_n + preserve_last_n >= max_messages
- [ ] `trim()` correctly handles edge case: empty message array
- [ ] `trim()` keeps the most recent middle messages and evicts the oldest
- [ ] `estimateTokens()` handles string content, object content, and array content blocks
- [ ] `estimateTokens()` uses chars/4 approximation
- [ ] The class is provider-agnostic (uses `{ role: string; content: unknown }` shape)
- [ ] Module is properly exported
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes

## Notes
- Part of PLAN-v080-message-history-management.md
- Depends on task 114 (needs the `ConversationHistoryConfig` and `ConversationMetrics` types)
- This module will be consumed by tasks 116 (Anthropic integration) and 117 (OpenAI integration)
- Summarization support will be added in task 118 — this task focuses only on the windowing and token estimation
