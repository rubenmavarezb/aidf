# TASK: Add Conversation History Config Types

## Goal
Extend `ExecutionConfig` in `types/index.ts` with a new optional field `max_conversation_messages?: number` (default: 100). Add a new `ConversationHistoryConfig` interface for future extensibility:

```typescript
interface ConversationHistoryConfig {
  max_messages?: number;        // default: 100
  summarize_on_trim?: boolean;  // default: false
  preserve_first_n?: number;    // default: 1 (the initial context message)
  preserve_last_n?: number;     // default: 20
}
```

Add `conversation?: ConversationHistoryConfig` to `ExecutionConfig`. Add `conversationMetrics?: { messageCount: number; estimatedTokens: number }` to the provider-level `ExecutionResult` in `providers/types.ts`. Update `config.yml` schema documentation.

## Task Type
feature

## Suggested Roles
- developer

## Auto-Mode Compatible
YES

## Scope
### Allowed
- packages/cli/src/types/index.ts
- packages/cli/src/core/providers/types.ts

### Forbidden
- packages/cli/src/core/providers/anthropic-api.ts (read-only)
- packages/cli/src/core/providers/openai-api.ts (read-only)
- packages/cli/src/core/executor.ts (read-only)

## Requirements
1. Add the `ConversationHistoryConfig` interface to `types/index.ts` with the following fields:
   - `max_messages?: number` — maximum number of messages to keep in conversation history (default: 100)
   - `summarize_on_trim?: boolean` — whether to summarize evicted messages before discarding them (default: false)
   - `preserve_first_n?: number` — number of initial messages to always preserve, these contain the system prompt / initial context with AGENTS.md, role, task, skills (default: 1)
   - `preserve_last_n?: number` — number of most recent messages to always preserve for continuity (default: 20)
2. Add `max_conversation_messages?: number` as a shorthand field on `ExecutionConfig` (default: 100).
3. Add `conversation?: ConversationHistoryConfig` to `ExecutionConfig` for the full configuration form.
4. Add `ConversationMetrics` interface to `providers/types.ts`:
   ```typescript
   interface ConversationMetrics {
     totalMessages: number;
     preservedMessages: number;
     evictedMessages: number;
     estimatedTokens: number;
   }
   ```
5. Add `conversationMetrics?: ConversationMetrics` to the provider-level `ExecutionResult` in `providers/types.ts`.
6. Export all new types from their respective modules.
7. Ensure all new fields are optional to maintain backward compatibility with existing config files.

## Definition of Done
- [ ] `ConversationHistoryConfig` interface is defined in `types/index.ts` with all four optional fields and documented defaults
- [ ] `max_conversation_messages?: number` shorthand is added to `ExecutionConfig`
- [ ] `conversation?: ConversationHistoryConfig` is added to `ExecutionConfig`
- [ ] `ConversationMetrics` interface is defined in `providers/types.ts`
- [ ] `conversationMetrics?: ConversationMetrics` is added to provider `ExecutionResult`
- [ ] All new types are exported
- [ ] All new fields are optional (no breaking changes to existing configs)
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes

## Notes
- Part of PLAN-v080-message-history-management.md
- This task is independent and can start immediately
- The shorthand `max_conversation_messages` and the full `conversation` config should both be supported; the executor will resolve them (shorthand takes lower precedence if both are specified)
