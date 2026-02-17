# TASK: Executor Conversation Metrics Integration

## Goal
Update `executor.ts` to read conversation history configuration, pass it through to provider options, consume `conversationMetrics` from `ExecutionResult`, and display conversation status in logs and live status.

## Task Type
feature

## Suggested Roles
- developer

## Auto-Mode Compatible
YES

## Scope
### Allowed
- packages/cli/src/core/executor.ts
- packages/cli/src/utils/live-status.ts
- packages/cli/src/types/index.ts (read for types)
- packages/cli/src/core/providers/types.ts (read for types)

### Forbidden
- packages/cli/src/core/providers/anthropic-api.ts (read-only)
- packages/cli/src/core/providers/openai-api.ts (read-only)
- packages/cli/src/core/providers/conversation-window.ts (read-only)

## Requirements
1. Read `config.execution.conversation` (the full `ConversationHistoryConfig`) from the loaded config. Also support the shorthand `config.execution.max_conversation_messages` — if only the shorthand is provided, construct a `ConversationHistoryConfig` with `max_messages` set to that value and all other fields at defaults.
2. Pass the resolved `ConversationHistoryConfig` through to provider options so that the API providers (`anthropic-api.ts`, `openai-api.ts`) can access it.
3. When `ExecutionResult.conversationMetrics` is present in the result from a provider execution, log it: "Conversation: {count} messages (~{tokens} tokens)".
4. Add conversation metrics to the execution summary box that is displayed at the end of execution.
5. Emit a warning when message count exceeds 80% of the cap: "Conversation approaching limit ({count}/{max} messages)".
6. Update `ExecutorState` to include `conversationMessageCount?: number` for live status display. The live status line (`live-status.ts`) should show the conversation message count when available.

## Definition of Done
- [ ] `config.execution.conversation` is read and resolved (including shorthand `max_conversation_messages`)
- [ ] Resolved `ConversationHistoryConfig` is passed through to provider options
- [ ] `conversationMetrics` from `ExecutionResult` is logged after each iteration when present
- [ ] Conversation metrics are included in the execution summary box
- [ ] Warning is emitted when message count exceeds 80% of the configured cap
- [ ] `ExecutorState` includes `conversationMessageCount` for live status
- [ ] Live status line displays conversation message count when available
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] Existing tests remain green

## Notes
- Part of PLAN-v080-message-history-management.md
- Depends on tasks 114 (needs types), 116, and 117 (needs provider integration done so metrics are available)
- The executor should not import or use `ConversationWindow` directly — it only consumes the metrics returned by the providers
