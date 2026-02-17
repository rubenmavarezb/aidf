# TASK: Create mock API server and E2E tests for API providers

## Goal

Create a mock HTTP server that simulates Anthropic and OpenAI API responses, and write E2E tests that exercise the API providers against this mock server. Helper file: `packages/cli/src/__tests__/e2e/helpers/mock-api-server.ts`. Test file: `packages/cli/src/__tests__/e2e/api-providers.e2e.test.ts`.

## Task Type

test

## Suggested Roles

- tester

## Auto-Mode Compatible

YES

## Scope

### Allowed

- `packages/cli/src/__tests__/e2e/helpers/mock-api-server.ts`
- `packages/cli/src/__tests__/e2e/api-providers.e2e.test.ts`

### Forbidden

- `packages/cli/src/core/providers/anthropic-api.ts` (read-only)
- `packages/cli/src/core/providers/openai-api.ts` (read-only)
- `packages/cli/src/core/providers/tool-handler.ts` (read-only)
- `packages/cli/src/core/providers/types.ts` (read-only)
- `packages/cli/src/core/executor.ts` (read-only)
- `packages/cli/src/commands/**` (read-only)

## Requirements

1. **`MockApiServer` class** — Uses Node.js built-in `http.createServer()`. Exposes `start()` (returns `{ port, baseUrl }`), `stop()`, `reset()`, `getRequestLog()`. Configurable response sequences via `enqueueResponse(response)`.

2. **Anthropic Messages API endpoint** (`POST /v1/messages`) — Returns streaming or non-streaming responses matching the Anthropic API schema. Supports `content_block_delta` events for streaming. Configurable: model, stop_reason, usage (input/output tokens).

3. **OpenAI Chat Completions endpoint** (`POST /v1/chat/completions`) — Returns responses matching the OpenAI API schema. Supports streaming with SSE `data:` lines. Configurable: model, finish_reason, usage.

4. **Tool calling simulation** — Both endpoints support returning tool_use blocks (Anthropic) or tool_calls (OpenAI) that invoke `read_file`, `write_file`, `list_files`, `run_command`, `task_complete`, `task_blocked`.

5. **Test: Anthropic provider executes with mock server** — Configure `AnthropicApiProvider` with mock server URL as base URL. Send a prompt. Verify the provider parses the response correctly, extracts output text, detects completion signal, and reports token usage.

6. **Test: OpenAI provider executes with mock server** — Same as above but for `OpenAiApiProvider`.

7. **Test: Tool calling round-trip** — Mock server returns a `write_file` tool call. Verify the provider handles the tool, writes the file to disk, and sends the tool result back. Then mock server returns `task_complete`. Verify the full round-trip completes.

8. **Test: Error responses** — Mock server returns 429 (rate limit), 500 (server error), 401 (auth error). Verify each provider surfaces the error correctly with meaningful messages.

9. **Test: Token usage accumulation** — Mock server returns specific `usage` values across 3 responses. Verify the provider accumulates `inputTokens` and `outputTokens` correctly.

10. **Test: Streaming response handling** — Mock server sends a streaming response with 5 content deltas. Verify the `onOutput` callback receives each chunk and the final output is correctly concatenated.

## Definition of Done

- [ ] `MockApiServer` class is implemented using only Node.js built-in `http` module (no Express)
- [ ] Mock server handles both Anthropic (`POST /v1/messages`) and OpenAI (`POST /v1/chat/completions`) endpoints
- [ ] Mock server supports streaming and non-streaming responses for both APIs
- [ ] Mock server supports tool calling simulation for both API formats
- [ ] Mock server uses port 0 (random available port) to avoid port conflicts in CI
- [ ] `enqueueResponse()` allows configuring response sequences for multi-turn conversations
- [ ] `getRequestLog()` returns all received requests for assertion
- [ ] All 6 test cases (requirements 5-10) are implemented and passing
- [ ] Tests exercise actual provider classes against the mock server
- [ ] `pnpm test` — all existing tests continue to pass

## Notes

- Part of PLAN-v080-e2e-tests.md
- Depends on task 090 (E2E test infrastructure)
- Independent of tasks 091-093, 096-097
- Task 095 (full lifecycle) benefits from reusing this mock API server
- The mock API server must be lightweight — use Node.js built-in `http` module only, no Express dependency
- Use port 0 to get a random available port and avoid conflicts in CI
