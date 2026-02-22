# TASK: Config Documentation for Conversation History

## Goal
Add the new conversation history config options to config.yml documentation and the example configs. Show both the shorthand form (`max_conversation_messages: 100`) and the full form with all options.

## Task Type
docs

## Suggested Roles
- documenter

## Auto-Mode Compatible
YES

## Scope
### Allowed
- docs/
- templates/.ai/
- examples/

### Forbidden
- packages/cli/src/ (read-only)

## Requirements
1. Document the new `execution.conversation` config block in the appropriate docs file(s) under `docs/`. Include:
   - The shorthand form:
     ```yaml
     execution:
       max_conversation_messages: 100
     ```
   - The full form:
     ```yaml
     execution:
       max_iterations: 50
       conversation:
         max_messages: 100
         summarize_on_trim: true
         preserve_first_n: 1
         preserve_last_n: 20
     ```
2. Document each field with its type, default value, and description:
   - `max_messages` (number, default: 100) — Maximum number of messages to keep in conversation history. Set to 0 to disable trimming entirely.
   - `summarize_on_trim` (boolean, default: false) — When true, evicted messages are summarized into a compact message before being discarded, preserving important context.
   - `preserve_first_n` (number, default: 1) — Number of initial messages to always preserve. These contain the system prompt and initial context (AGENTS.md, role, task, skills).
   - `preserve_last_n` (number, default: 20) — Number of most recent messages to always preserve for model continuity.
3. Explain the relationship between the shorthand and the full config: the shorthand `max_conversation_messages` only sets `max_messages`; all other fields use defaults. If both are specified, the full `conversation` block takes precedence.
4. Update example config.yml files in `templates/.ai/` and `examples/` to include the new options (at least one example showing the shorthand and one showing the full form).
5. Add a brief note about the token estimation approach (chars/4 approximation) and its limitations — it is used for logging and cap decisions, not for billing, and a 20% margin of error is acceptable.
6. Document that this feature only applies to API providers (`anthropic-api`, `openai-api`). CLI providers (`claude-cli`, `cursor-cli`) manage their own context and are not affected.

## Definition of Done
- [ ] Shorthand config form is documented with example YAML
- [ ] Full config form is documented with example YAML
- [ ] Each field is documented with type, default value, and description
- [ ] Relationship between shorthand and full form is explained
- [ ] At least one example config in `templates/.ai/` is updated
- [ ] At least one example config in `examples/` is updated
- [ ] Token estimation approach is documented with limitations note
- [ ] API-only applicability is documented (CLI providers not affected)

## Notes
- Part of PLAN-v080-message-history-management.md
- Depends on task 114 (needs config shape finalized)
- This is a documentation-only task — no code changes
