import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { AnthropicApiProvider, createAnthropicApiProvider } from './anthropic-api.js';

// Mock the Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn(),
      },
    })),
  };
});

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn(() => true),
}));

// Mock glob
vi.mock('glob', () => ({
  glob: vi.fn(() => Promise.resolve(['file1.ts', 'file2.ts'])),
}));

/** Helper to inject a mock into the private Anthropic client */
function setMockCreate(provider: AnthropicApiProvider, mockCreate: Mock): void {
  const providerWithClient = provider as unknown as {
    client: { messages: { create: Mock } };
  };
  providerWithClient.client.messages.create = mockCreate;
}

describe('AnthropicApiProvider', () => {
  let provider: AnthropicApiProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-key';
    provider = new AnthropicApiProvider('/test/cwd');
  });

  describe('constructor', () => {
    it('should set name to anthropic-api', () => {
      expect(provider.name).toBe('anthropic-api');
    });

    it('should use provided cwd', () => {
      const customProvider = new AnthropicApiProvider('/custom/path');
      expect(customProvider.name).toBe('anthropic-api');
    });

    it('should accept custom API key', () => {
      const customProvider = new AnthropicApiProvider('/test', 'custom-key');
      expect(customProvider.name).toBe('anthropic-api');
    });
  });

  describe('isAvailable', () => {
    it('should return true when ANTHROPIC_API_KEY is set', async () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      const result = await provider.isAvailable();
      expect(result).toBe(true);
    });

    it('should return false when ANTHROPIC_API_KEY is not set', async () => {
      delete process.env.ANTHROPIC_API_KEY;
      const newProvider = new AnthropicApiProvider('/test');
      const result = await newProvider.isAvailable();
      expect(result).toBe(false);
    });
  });

  describe('execute', () => {
    it('should return success when task completes', async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        content: [
          { type: 'text', text: 'Working on task...' },
          {
            type: 'tool_use',
            id: 'tool-1',
            name: 'task_complete',
            input: { summary: 'Task done' },
          },
        ],
        stop_reason: 'tool_use',
      });

      setMockCreate(provider, mockCreate);

      const result = await provider.execute('Test prompt');

      expect(result.success).toBe(true);
      expect(result.iterationComplete).toBe(true);
      expect(result.completionSignal).toBe('<TASK_COMPLETE>');
    });

    it('should return blocked when task_blocked is called', async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        content: [
          {
            type: 'tool_use',
            id: 'tool-1',
            name: 'task_blocked',
            input: { reason: 'Need more info' },
          },
        ],
        stop_reason: 'tool_use',
      });

      setMockCreate(provider, mockCreate);

      const result = await provider.execute('Test prompt');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Need more info');
    });

    it('should handle API errors gracefully', async () => {
      const mockCreate = vi.fn().mockRejectedValue(new Error('API Error'));
      setMockCreate(provider, mockCreate);

      const result = await provider.execute('Test prompt');

      expect(result.success).toBe(false);
      expect(result.error).toBe('API Error');
      expect(result.iterationComplete).toBe(false);
    });

    it('should track files changed via write_file tool', async () => {
      const { writeFile } = await import('fs/promises');
      vi.mocked(writeFile).mockResolvedValue(undefined);

      const mockCreate = vi.fn()
        .mockResolvedValueOnce({
          content: [
            {
              type: 'tool_use',
              id: 'tool-1',
              name: 'write_file',
              input: { path: 'src/test.ts', content: 'test content' },
            },
          ],
          stop_reason: 'tool_use',
        })
        .mockResolvedValueOnce({
          content: [
            {
              type: 'tool_use',
              id: 'tool-2',
              name: 'task_complete',
              input: { summary: 'Done' },
            },
          ],
          stop_reason: 'tool_use',
        });

      setMockCreate(provider, mockCreate);

      const result = await provider.execute('Test prompt');

      expect(result.filesChanged).toContain('src/test.ts');
    });

    it('should include text output in result', async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        content: [
          { type: 'text', text: 'First message' },
          { type: 'text', text: 'Second message' },
        ],
        stop_reason: 'end_turn',
      });

      setMockCreate(provider, mockCreate);

      const result = await provider.execute('Test prompt');

      expect(result.output).toContain('First message');
      expect(result.output).toContain('Second message');
    });

    it('should respect model option', async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Done' }],
        stop_reason: 'end_turn',
      });

      setMockCreate(provider, mockCreate);

      await provider.execute('Test prompt', { model: 'claude-opus-4-20250514' });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-opus-4-20250514',
        })
      );
    });

    it('should respect maxTokens option', async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Done' }],
        stop_reason: 'end_turn',
      });

      setMockCreate(provider, mockCreate);

      await provider.execute('Test prompt', { maxTokens: 4096 });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          max_tokens: 4096,
        })
      );
    });
  });

  describe('session continuation', () => {
    it('should return conversationState in result', async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Done' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      setMockCreate(provider, mockCreate);

      const result = await provider.execute('Test prompt');

      expect(result.conversationState).toBeDefined();
      expect(Array.isArray(result.conversationState)).toBe(true);
    });

    it('should start fresh when no conversationState provided', async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Done' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      setMockCreate(provider, mockCreate);

      await provider.execute('First prompt');

      // Messages should start with just the user prompt
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages).toHaveLength(1);
      expect(callArgs.messages[0].role).toBe('user');
      expect(callArgs.messages[0].content).toBe('First prompt');
    });

    it('should continue from conversationState when provided', async () => {
      const existingState = [
        { role: 'user', content: 'Previous prompt' },
        { role: 'assistant', content: [{ type: 'text', text: 'Previous response' }] },
      ];

      const mockCreate = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Continued' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      setMockCreate(provider, mockCreate);

      await provider.execute('Continuation prompt', {
        conversationState: existingState,
      });

      // Messages should include previous state + new prompt
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages).toHaveLength(3);
      expect(callArgs.messages[0].content).toBe('Previous prompt');
      expect(callArgs.messages[1].content).toEqual([{ type: 'text', text: 'Previous response' }]);
      expect(callArgs.messages[2].content).toBe('Continuation prompt');
    });

    it('should return conversationState even on error', async () => {
      const mockCreate = vi.fn().mockRejectedValue(new Error('API Error'));
      setMockCreate(provider, mockCreate);

      const result = await provider.execute('Test prompt');

      expect(result.conversationState).toBeDefined();
      expect(Array.isArray(result.conversationState)).toBe(true);
    });
  });
});

describe('createAnthropicApiProvider', () => {
  it('should create an AnthropicApiProvider instance', () => {
    const provider = createAnthropicApiProvider('/test/cwd');
    expect(provider.name).toBe('anthropic-api');
  });

  it('should pass apiKey to provider', () => {
    const provider = createAnthropicApiProvider('/test/cwd', 'my-api-key');
    expect(provider.name).toBe('anthropic-api');
  });
});
