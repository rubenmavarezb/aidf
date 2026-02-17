# TASK: Integration Tests for Provider Conversation Management

## Goal
Write integration tests verifying that both API providers correctly integrate the conversation window, that metrics flow through to `ExecutionResult`, and that the full pipeline from config through executor to provider works end-to-end.

## Task Type
test

## Suggested Roles
- tester

## Auto-Mode Compatible
YES

## Scope
### Allowed
- packages/cli/src/core/providers/anthropic-api.test.ts (append or create)
- packages/cli/src/core/providers/openai-api.test.ts (append or create)
- packages/cli/src/core/executor.test.ts (append integration tests)
- packages/cli/src/core/providers/anthropic-api.ts (read for implementation)
- packages/cli/src/core/providers/openai-api.ts (read for implementation)
- packages/cli/src/core/providers/conversation-window.ts (read for implementation)
- packages/cli/src/core/executor.ts (read for implementation)
- packages/cli/src/types/index.ts (read for types)
- packages/cli/src/core/providers/types.ts (read for types)

### Forbidden
- packages/cli/src/core/providers/claude-cli.ts (read-only)
- packages/cli/src/core/providers/cursor-cli.ts (read-only)

## Requirements

### Anthropic Provider Tests
1. **Trimming during tool-call loop**: Mock the Anthropic API to return multiple tool-use responses in sequence. Verify that after exceeding `max_messages`, the message array is trimmed before the next API call. The message count in the array passed to the API should never exceed `max_messages + 1` turn.

2. **conversationMetrics in result**: After an `execute()` call that triggers trimming, verify that `ExecutionResult.conversationMetrics` is present and contains accurate `totalMessages`, `preservedMessages`, `evictedMessages`, and `estimatedTokens`.

### OpenAI Provider Tests
3. **Trimming during tool-call loop**: Same as test 1 but for the OpenAI provider. Mock the OpenAI API to return multiple tool_calls responses. Verify trimming occurs and the message array stays within bounds.

4. **conversationMetrics in result**: Same as test 2 but for the OpenAI provider. Verify metrics are present and accurate in `ExecutionResult`.

### Config Flow Tests
5. **Config values flow correctly**: Simulate a full config with `execution.conversation` set. Verify the config flows from `AidfConfig` through the executor to the provider options. The provider should receive the correct `ConversationHistoryConfig`.

6. **Shorthand config works**: Simulate config with only `execution.max_conversation_messages: 50`. Verify the executor resolves it to a `ConversationHistoryConfig` with `max_messages: 50` and defaults for other fields, and passes it to the provider.

### Cross-Iteration Tests
7. **Conversation state between iterations**: Simulate two executor iterations. In the first iteration, the provider returns `conversationState` with many messages. In the second iteration, the state is passed back. Verify that the message array is properly trimmed between iterations.

### End-to-End Simulation
8. **50 tool calls within bounds**: Simulate 50 consecutive tool calls within a single `execute()` call (mock API responses). With `max_messages: 30`, verify that:
   - The message array never exceeds 30 messages (plus at most 1 turn of slack).
   - The first message (system/context) is always preserved.
   - The last 20 messages are always the most recent ones.
   - No API errors occur due to context overflow.
   - The final `conversationMetrics` accurately reflects the trimming that occurred.

## Definition of Done
- [ ] All 8 test cases listed above are implemented
- [ ] Tests use Vitest framework with `vi.mock()` for API client mocking
- [ ] Anthropic API responses are mocked with realistic content block structures
- [ ] OpenAI API responses are mocked with realistic tool_calls structures
- [ ] Config flow is tested from `AidfConfig` through executor to provider
- [ ] End-to-end simulation with 50 tool calls verifies bounds are respected
- [ ] All tests pass with `pnpm test`
- [ ] Existing 298+ tests remain green (no regressions)

## Notes
- Part of PLAN-v080-message-history-management.md
- Depends on tasks 116 (Anthropic integration), 117 (OpenAI integration), and 119 (executor integration)
- Mock the actual API clients (`@anthropic-ai/sdk`, `openai`) using `vi.mock()` to avoid real API calls
- Use `vi.mock('child_process')` patterns already established in existing provider tests as reference
