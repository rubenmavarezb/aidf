// packages/cli/src/__tests__/e2e/api-providers.e2e.test.ts

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockApiServer } from './helpers/mock-api-server.js';

describe('API Providers E2E - MockApiServer', () => {
  let server: MockApiServer;
  let baseUrl: string;

  beforeEach(async () => {
    server = new MockApiServer();
    const info = await server.start();
    baseUrl = info.baseUrl;
  });

  afterEach(async () => {
    await server.stop();
  });

  it('should start and stop the server', async () => {
    const server2 = new MockApiServer();
    const info = await server2.start();

    expect(info.port).toBeGreaterThan(0);
    expect(info.baseUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);

    await server2.stop();

    // Verify server is stopped by attempting a request
    await expect(
      fetch(`${info.baseUrl}/v1/messages`, { method: 'POST' })
    ).rejects.toThrow();
  });

  it('should handle Anthropic-format requests', async () => {
    server.enqueueResponse({
      body: {
        id: 'msg_test_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello from mock Anthropic' }],
        model: 'claude-sonnet-4-20250514',
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 25,
          output_tokens: 10,
        },
      },
    });

    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'Hello' }],
      }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/json');

    const data = await response.json();
    expect(data.content[0].text).toBe('Hello from mock Anthropic');
    expect(data.usage.input_tokens).toBe(25);
    expect(data.usage.output_tokens).toBe(10);
    expect(data.stop_reason).toBe('end_turn');
  });

  it('should handle OpenAI-format requests', async () => {
    server.enqueueResponse({
      body: {
        id: 'chatcmpl-test-456',
        object: 'chat.completion',
        model: 'gpt-4o',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello from mock OpenAI',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 20,
          completion_tokens: 8,
          total_tokens: 28,
        },
      },
    });

    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }],
      }),
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.choices[0].message.content).toBe('Hello from mock OpenAI');
    expect(data.usage.prompt_tokens).toBe(20);
    expect(data.usage.completion_tokens).toBe(8);
  });

  it('should handle Anthropic tool calling response', async () => {
    server.enqueueResponse({
      body: {
        id: 'msg_tool_123',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'tool_1',
            name: 'write_file',
            input: {
              path: 'test.ts',
              content: 'export const x = 1;',
            },
          },
        ],
        model: 'claude-sonnet-4-20250514',
        stop_reason: 'tool_use',
        usage: {
          input_tokens: 50,
          output_tokens: 30,
        },
      },
    });

    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'Create a file' }],
        tools: [{ name: 'write_file', description: 'Write a file', input_schema: {} }],
      }),
    });

    const data = await response.json();
    expect(data.content).toHaveLength(1);
    expect(data.content[0].type).toBe('tool_use');
    expect(data.content[0].id).toBe('tool_1');
    expect(data.content[0].name).toBe('write_file');
    expect(data.content[0].input.path).toBe('test.ts');
    expect(data.content[0].input.content).toBe('export const x = 1;');
    expect(data.stop_reason).toBe('tool_use');
  });

  it('should handle OpenAI tool calling response', async () => {
    server.enqueueResponse({
      body: {
        id: 'chatcmpl-tool-789',
        object: 'chat.completion',
        model: 'gpt-4o',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_1',
                  type: 'function',
                  function: {
                    name: 'write_file',
                    arguments: '{"path":"test.ts","content":"export const y = 2;"}',
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
        usage: {
          prompt_tokens: 40,
          completion_tokens: 25,
          total_tokens: 65,
        },
      },
    });

    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Create a file' }],
        tools: [{ type: 'function', function: { name: 'write_file', parameters: {} } }],
      }),
    });

    const data = await response.json();
    const toolCalls = data.choices[0].message.tool_calls;
    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0].id).toBe('call_1');
    expect(toolCalls[0].type).toBe('function');
    expect(toolCalls[0].function.name).toBe('write_file');

    const args = JSON.parse(toolCalls[0].function.arguments);
    expect(args.path).toBe('test.ts');
    expect(args.content).toBe('export const y = 2;');
  });

  it('should handle error responses', async () => {
    server.enqueueResponse({
      status: 429,
      body: { error: { message: 'Rate limit exceeded', type: 'rate_limit_error' } },
    });
    server.enqueueResponse({
      status: 500,
      body: { error: { message: 'Internal server error', type: 'server_error' } },
    });
    server.enqueueResponse({
      status: 401,
      body: { error: { message: 'Invalid API key', type: 'authentication_error' } },
    });

    const res429 = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'test', messages: [] }),
    });
    expect(res429.status).toBe(429);

    const res500 = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'test', messages: [] }),
    });
    expect(res500.status).toBe(500);

    const res401 = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'test', messages: [] }),
    });
    expect(res401.status).toBe(401);
  });

  it('should log all requests', async () => {
    server.enqueueResponse({ body: { ok: true } });
    server.enqueueResponse({ body: { ok: true } });
    server.enqueueResponse({ body: { ok: true } });

    await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude', prompt: 'first' }),
    });

    await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o', prompt: 'second' }),
    });

    await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude', prompt: 'third' }),
    });

    const log = server.getRequestLog();
    expect(log).toHaveLength(3);

    expect(log[0].method).toBe('POST');
    expect(log[0].path).toBe('/v1/messages');
    expect((log[0].body as Record<string, unknown>).prompt).toBe('first');

    expect(log[1].method).toBe('POST');
    expect(log[1].path).toBe('/v1/chat/completions');
    expect((log[1].body as Record<string, unknown>).prompt).toBe('second');

    expect(log[2].method).toBe('POST');
    expect(log[2].path).toBe('/v1/messages');
    expect((log[2].body as Record<string, unknown>).prompt).toBe('third');
  });

  it('should return responses in queue order', async () => {
    server.enqueueResponse({ body: { order: 1, content: 'first' } });
    server.enqueueResponse({ body: { order: 2, content: 'second' } });
    server.enqueueResponse({ body: { order: 3, content: 'third' } });

    const res1 = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data1 = await res1.json();
    expect(data1.order).toBe(1);
    expect(data1.content).toBe('first');

    const res2 = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data2 = await res2.json();
    expect(data2.order).toBe(2);
    expect(data2.content).toBe('second');

    const res3 = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data3 = await res3.json();
    expect(data3.order).toBe(3);
    expect(data3.content).toBe('third');
  });

  it('should preserve exact token usage values in responses', async () => {
    server.enqueueResponse({
      body: {
        id: 'msg_usage_test',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Token test' }],
        model: 'claude-sonnet-4-20250514',
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 100,
          output_tokens: 50,
        },
      },
    });

    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'Test tokens' }],
      }),
    });

    const data = await response.json();
    expect(data.usage.input_tokens).toBe(100);
    expect(data.usage.output_tokens).toBe(50);
  });

  it('should clear state on reset', async () => {
    // Enqueue responses and send requests
    server.enqueueResponse({ body: { msg: 'a' } });
    server.enqueueResponse({ body: { msg: 'b' } });

    await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: true }),
    });

    expect(server.getRequestLog()).toHaveLength(1);

    // Reset the server state
    server.reset();

    // Verify request log is cleared
    expect(server.getRequestLog()).toHaveLength(0);

    // Verify response queue is cleared (next request should get 500)
    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ after: 'reset' }),
    });

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('No mock responses queued');
  });
});
