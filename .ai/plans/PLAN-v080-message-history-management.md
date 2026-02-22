# PLAN: v0.8.0 — Message History Management for API Providers

## Status: COMPLETED

## Overview

Both API providers (`anthropic-api.ts` and `openai-api.ts`) accumulate messages indefinitely within a single `execute()` call. Each tool-call round-trip appends assistant and tool-result messages to the `messages` array, and the full array is returned as `conversationState` for reuse across executor iterations. Over long-running tasks (many iterations, many tool calls per iteration), the message array grows without bound, causing:

1. **Context window overflow** — hitting the model's max context length, producing API errors.
2. **Escalating input token costs** — every accumulated message is re-sent on every API call.
3. **Degraded model performance** — very long conversations reduce response quality as important instructions get pushed further from the attention window edges.

This plan introduces a **sliding window** strategy with optional **summarization** to keep conversation history within configurable bounds while preserving critical context.

## Goals

- Cap message history growth in both API providers with a configurable maximum.
- Implement a sliding window algorithm that always preserves the system message (or initial user prompt with full context) and the most recent N messages.
- Add an optional summarization pass that condenses evicted messages into a compact summary message before discarding them.
- Expose message history metrics (message count, estimated token count) in `ExecutionResult` so the executor can log them.
- Add `max_conversation_messages` to `ExecutionConfig` in `config.yml`.
- Comprehensive test coverage for windowing, summarization, and token estimation.

## Non-Goals

- Changing the CLI provider behavior (`claude-cli`, `cursor-cli`) — they spawn subprocesses and manage their own context.
- Implementing true token counting via tiktoken or the Anthropic tokenizer — we use character-based estimation (1 token ~ 4 chars) which is sufficient for cap decisions.
- Adding streaming support — that is a separate concern.
- Modifying the executor loop itself beyond consuming new metrics from `ExecutionResult`.

## Tasks

### Phase 1: Analysis and Types

- [ ] `113-analyze-message-accumulation.md` — Audit the current message accumulation pattern in both providers. Document: (a) In `anthropic-api.ts`, lines 88-101: every tool-use block appends the full `response.content` array and a `tool_result` message — if the model returns 5 tool calls in one response, 5 pairs of (assistant, tool_result) are appended. (b) In `openai-api.ts`, lines 78-97: the assistant message is pushed once, then each tool call result is pushed individually — better, but still unbounded. (c) The `conversationState` returned from `execute()` carries the entire array to the next executor iteration, where the new user prompt is appended on top. (d) Neither provider tracks message count or estimated tokens in the conversation. Produce a short analysis document with concrete numbers: how many messages per iteration for a typical task (5-10 tool calls), projected growth over 20 iterations.

- [ ] `114-add-conversation-config-types.md` — Extend `ExecutionConfig` in `types/index.ts` with a new optional field `max_conversation_messages?: number` (default: 100). Add a new `ConversationHistoryConfig` interface for future extensibility:
  ```typescript
  interface ConversationHistoryConfig {
    max_messages?: number;        // default: 100
    summarize_on_trim?: boolean;  // default: false
    preserve_first_n?: number;    // default: 1 (the initial context message)
    preserve_last_n?: number;     // default: 20
  }
  ```
  Add `conversation?: ConversationHistoryConfig` to `ExecutionConfig`. Add `conversationMetrics?: { messageCount: number; estimatedTokens: number }` to the provider-level `ExecutionResult` in `providers/types.ts`. Update `config.yml` schema documentation.

### Phase 2: Sliding Window Core

- [ ] `115-implement-conversation-window.md` — Create a new module `core/providers/conversation-window.ts` that implements the sliding window algorithm. The module exports a class `ConversationWindow` with:

  **Constructor**: `ConversationWindow(config: ConversationHistoryConfig)`

  **Core method**: `trim(messages: Message[]): { trimmed: Message[]; evicted: Message[]; metrics: ConversationMetrics }`

  **Algorithm**:
  1. If `messages.length <= max_messages`, return messages unchanged.
  2. Split messages into three zones:
     - **Preserved head**: the first `preserve_first_n` messages (always kept — these contain the system prompt / initial context with AGENTS.md, role, task, skills).
     - **Preserved tail**: the last `preserve_last_n` messages (always kept — recent context the model needs for continuity).
     - **Middle zone**: everything between head and tail — candidates for eviction.
  3. If head + tail >= max_messages, only keep head + tail (warn that preserve settings exceed max).
  4. Calculate how many middle messages to keep: `keep_middle = max_messages - preserve_first_n - preserve_last_n`.
  5. Keep the **last** `keep_middle` messages from the middle zone (more recent = more relevant). Evict the rest.
  6. Return the trimmed array, the evicted messages, and metrics.

  **Token estimation method**: `estimateTokens(messages: Message[]): number` — iterate message content, stringify if object, count characters, divide by 4. Handle Anthropic content blocks (array of text/tool_use/tool_result) and OpenAI string/tool messages.

  **Metrics type**:
  ```typescript
  interface ConversationMetrics {
    totalMessages: number;
    preservedMessages: number;
    evictedMessages: number;
    estimatedTokens: number;
  }
  ```

  The class must be provider-agnostic — it operates on a generic message type. Use a type parameter or a minimal `{ role: string; content: unknown }` shape.

- [ ] `116-integrate-window-anthropic.md` — Integrate `ConversationWindow` into `AnthropicApiProvider.execute()`. Changes:
  1. Accept `ConversationHistoryConfig` from options (fall through from executor config).
  2. After appending messages in the tool-call loop (lines 88-101), call `window.trim(messages)` before the next API call.
  3. If `summarize_on_trim` is true and there are evicted messages, call the summarization function (task 118) before trimming.
  4. Include `conversationMetrics` in the returned `ExecutionResult`.
  5. Log a debug message when trimming occurs: "Trimmed conversation: {evicted} messages removed, {preserved} kept (~{tokens} tokens)".

- [ ] `117-integrate-window-openai.md` — Same integration for `OpenAiApiProvider.execute()`. Mirror the Anthropic integration but handle the OpenAI message format differences (tool messages use `tool_call_id`, assistant messages have `tool_calls` array instead of content blocks).

### Phase 3: Summarization

- [ ] `118-implement-summarization.md` — Add summarization capability to `ConversationWindow`. When `summarize_on_trim` is true:

  **Flow**:
  1. Before evicting middle-zone messages, extract their text content.
  2. Build a summarization prompt: "Summarize the following conversation history concisely. Focus on: what files were read/written, what decisions were made, what problems were encountered, and what the current state of the task is. Be factual and brief."
  3. Call the provider itself with this prompt (the provider needs a lightweight `summarize(text: string): Promise<string>` method, or we use a standalone API call).
  4. Replace the evicted messages with a single synthetic "assistant" message containing the summary, prefixed with "[Conversation Summary]".
  5. The resulting message array is: `[preserved_head..., summary_message, preserved_tail...]`.

  **Design decision**: summarization uses the same model/API but with a smaller `max_tokens` (1024). This adds one API call per trim but dramatically improves context quality compared to raw eviction.

  **Edge cases**:
  - If summarization fails (API error, timeout), fall back to plain eviction (no summary message).
  - If evicted messages contain only tool results with no meaningful text, skip summarization.
  - Rate limit the summarization: at most once every 10 messages evicted (don't summarize on every trim).

  Add a `summarize(messages: unknown[], provider: { call(prompt: string): Promise<string> }): Promise<string>` method to `ConversationWindow`. The provider callback is injected by the API provider during integration.

### Phase 4: Executor Integration and Metrics

- [ ] `119-executor-conversation-metrics.md` — Update `executor.ts` to:
  1. Read `config.execution.conversation` (or `config.execution.max_conversation_messages` as shorthand) and pass it through to provider options.
  2. When `ExecutionResult.conversationMetrics` is present, log it: "Conversation: {count} messages (~{tokens} tokens)".
  3. Add conversation metrics to the execution summary box.
  4. Emit a warning when message count exceeds 80% of the cap: "Conversation approaching limit ({count}/{max} messages)".
  5. Update `ExecutorState` to include `conversationMessageCount?: number` for live status display.

- [ ] `120-config-documentation.md` — Add the new config options to config.yml documentation and the example configs. Show both the shorthand (`max_conversation_messages: 100`) and the full form:
  ```yaml
  execution:
    max_iterations: 50
    conversation:
      max_messages: 100
      summarize_on_trim: true
      preserve_first_n: 1
      preserve_last_n: 20
  ```

### Phase 5: Tests

- [ ] `121-test-conversation-window.md` — Unit tests for `ConversationWindow`:
  - `trim()` returns messages unchanged when under the cap.
  - `trim()` preserves first N and last N messages correctly.
  - `trim()` evicts oldest middle messages first.
  - `trim()` handles edge case: total messages fewer than `preserve_first_n + preserve_last_n`.
  - `trim()` handles edge case: exactly at the cap (no trimming needed).
  - `trim()` handles edge case: empty message array.
  - `estimateTokens()` returns reasonable estimates for string content, object content, and mixed arrays.
  - Metrics are correctly computed after trimming.
  - Config defaults are applied when fields are omitted.

- [ ] `122-test-summarization.md` — Unit tests for summarization:
  - Summary replaces evicted messages with a single synthetic message.
  - Summary message is correctly positioned between head and tail.
  - Summarization failure falls back to plain eviction.
  - Summarization is skipped when evicted messages have no text content.
  - Rate limiting: summarization doesn't fire on every small trim.
  - Mock the provider call to verify the summarization prompt format.

- [ ] `123-test-provider-integration.md` — Integration tests for both providers:
  - Anthropic provider trims messages when exceeding cap during tool-call loop.
  - OpenAI provider trims messages when exceeding cap during tool-call loop.
  - `conversationMetrics` is present in `ExecutionResult` when using API providers.
  - Conversation state passed between executor iterations is properly trimmed.
  - Config values flow correctly from `AidfConfig` through executor to provider.
  - End-to-end: simulate 50 tool calls, verify message array stays within bounds.

## Dependencies

- 114 is independent (types only, can start immediately).
- 113 is independent (analysis, can start immediately).
- 115 depends on 114 (needs the types).
- 116 depends on 115 (needs ConversationWindow).
- 117 depends on 115 (needs ConversationWindow). Can run in parallel with 116.
- 118 depends on 115 (extends ConversationWindow).
- 119 depends on 114, 116, 117 (needs types and provider integration done).
- 120 depends on 114 (needs config shape finalized).
- 121 depends on 115 (tests the window module).
- 122 depends on 118 (tests summarization).
- 123 depends on 116, 117, 119 (tests full integration).

## Risks

- **Summarization quality**: The summary may lose important context (e.g., which file was written with what content). Mitigation: preserve tool-result messages that contain file write confirmations in the tail window, and make summarization opt-in (default off).
- **Summarization cost**: Each summarization call adds latency and token cost. Mitigation: rate-limit to at most one summarization per trim cycle, use small `max_tokens`, and make it configurable.
- **Breaking existing behavior**: Adding trimming could cause regressions if the model needs older context. Mitigation: default `max_messages: 100` is generous (most tasks complete in < 50 tool calls), and `preserve_last_n: 20` keeps ample recent context. Users can set `max_messages: 0` to disable trimming entirely.
- **Provider-specific message formats**: Anthropic uses content blocks (array of `{type, text}` or `{type, tool_use_id}`), OpenAI uses string content or `{role: 'tool', tool_call_id}`. The window module must handle both without coupling to either SDK. Mitigation: operate on `{ role: string; content: unknown }` and let token estimation stringify unknown content.
- **Token estimation accuracy**: Character-based estimation (chars/4) is rough. Mitigation: this is used for logging and cap decisions, not billing — a 20% margin of error is acceptable. Document the limitation.

## Success Criteria

- Both API providers respect `max_conversation_messages` and never exceed it by more than one turn.
- A task with 50+ tool calls completes successfully with `max_messages: 30` without context errors.
- Summarization (when enabled) produces a coherent summary that the model can use to continue the task.
- `conversationMetrics` appears in execution logs showing message count and estimated tokens.
- All new code has tests. Existing 298+ tests remain green.
- No breaking changes to existing config files — new fields are optional with sensible defaults.
