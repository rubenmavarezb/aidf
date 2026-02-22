# TASK: Analyze Message Accumulation in API Providers

## Goal
Audit the current message accumulation pattern in both API providers (`anthropic-api.ts` and `openai-api.ts`). Document the following findings:

(a) In `anthropic-api.ts`, lines 88-101: every tool-use block appends the full `response.content` array and a `tool_result` message — if the model returns 5 tool calls in one response, 5 pairs of (assistant, tool_result) are appended.

(b) In `openai-api.ts`, lines 78-97: the assistant message is pushed once, then each tool call result is pushed individually — better, but still unbounded.

(c) The `conversationState` returned from `execute()` carries the entire array to the next executor iteration, where the new user prompt is appended on top.

(d) Neither provider tracks message count or estimated tokens in the conversation.

Produce a short analysis document with concrete numbers: how many messages per iteration for a typical task (5-10 tool calls), projected growth over 20 iterations.

## Task Type
feature

## Suggested Roles
- developer

## Auto-Mode Compatible
YES

## Scope
### Allowed
- packages/cli/src/core/providers/anthropic-api.ts
- packages/cli/src/core/providers/openai-api.ts
- packages/cli/src/core/providers/types.ts
- packages/cli/src/core/executor.ts
- .ai/

### Forbidden
- packages/cli/src/core/providers/claude-cli.ts (read-only)
- packages/cli/src/core/providers/cursor-cli.ts (read-only)

## Requirements
1. Read and trace the message accumulation flow in `anthropic-api.ts`, specifically the tool-call loop (lines 88-101) where `response.content` and `tool_result` messages are appended.
2. Read and trace the message accumulation flow in `openai-api.ts`, specifically the tool-call loop (lines 78-97) where the assistant message and individual tool call results are pushed.
3. Trace how `conversationState` is returned from `execute()` and passed back in subsequent executor iterations, with the new user prompt appended on top.
4. Confirm that neither provider currently tracks message count or estimated token usage.
5. Calculate concrete numbers: for a typical iteration with 5-10 tool calls, how many messages are added per iteration in each provider.
6. Project growth over 20 iterations (assuming an average of 7 tool calls per iteration).
7. Document all findings in a short analysis section within this task file or as a note in `.ai/`.

## Definition of Done
- [ ] Message accumulation pattern in `anthropic-api.ts` is documented with specific line references
- [ ] Message accumulation pattern in `openai-api.ts` is documented with specific line references
- [ ] `conversationState` flow between executor iterations is documented
- [ ] Concrete message count per iteration is calculated for both providers (5-10 tool calls scenario)
- [ ] Projected growth over 20 iterations is documented with specific numbers
- [ ] Analysis identifies that neither provider tracks message count or estimated tokens
- [ ] Findings are written to a document in `.ai/` or appended to this task file

## Notes
- Part of PLAN-v080-message-history-management.md
- This is an analysis task — no code changes required, only documentation of findings
- Can start immediately (no dependencies)
