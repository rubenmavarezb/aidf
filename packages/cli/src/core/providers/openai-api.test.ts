import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAiApiProvider, createOpenAiApiProvider } from './openai-api.js';
import type { Mock } from 'vitest';

// Mock the OpenAI SDK
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn(),
        },
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

/** Helper to inject a mock into the private OpenAI client */
function setMockCreate(provider: OpenAiApiProvider, mockCreate: Mock): void {
  // Access private client for test mock injection
  const providerWithClient = provider as unknown as {
    client: { chat: { completions: { create: Mock } } };
  };
  providerWithClient.client.chat.completions.create = mockCreate;
}

describe('OpenAiApiProvider', () => {
  let provider: OpenAiApiProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-key';
    provider = new OpenAiApiProvider('/test/cwd');
  });

  describe('constructor', () => {
    it('should set name to openai-api', () => {
      expect(provider.name).toBe('openai-api');
    });

    it('should use provided cwd', () => {
      const customProvider = new OpenAiApiProvider('/custom/path');
      expect(customProvider.name).toBe('openai-api');
    });

    it('should accept custom API key', () => {
      const customProvider = new OpenAiApiProvider('/test', 'custom-key');
      expect(customProvider.name).toBe('openai-api');
    });
  });

  describe('isAvailable', () => {
    it('should return true when OPENAI_API_KEY is set', async () => {
      process.env.OPENAI_API_KEY = 'test-key';
      const result = await provider.isAvailable();
      expect(result).toBe(true);
    });

    it('should return false when OPENAI_API_KEY is not set', async () => {
      delete process.env.OPENAI_API_KEY;
      const newProvider = new OpenAiApiProvider('/test');
      const result = await newProvider.isAvailable();
      expect(result).toBe(false);
    });
  });

  describe('execute', () => {
    it('should return success when task completes', async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        choices: [{
          message: {
            content: 'Working...',
            tool_calls: [{
              id: 'call-1',
              function: {
                name: 'task_complete',
                arguments: JSON.stringify({ summary: 'Task done' }),
              },
            }],
          },
        }],
      });

      setMockCreate(provider, mockCreate);

      const result = await provider.execute('Test prompt');

      expect(result.success).toBe(true);
      expect(result.iterationComplete).toBe(true);
      expect(result.completionSignal).toBe('<TASK_COMPLETE>');
    });

    it('should return blocked when task_blocked is called', async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        choices: [{
          message: {
            content: null,
            tool_calls: [{
              id: 'call-1',
              function: {
                name: 'task_blocked',
                arguments: JSON.stringify({ reason: 'Need clarification' }),
              },
            }],
          },
        }],
      });

      setMockCreate(provider, mockCreate);

      const result = await provider.execute('Test prompt');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Need clarification');
    });

    it('should handle API errors gracefully', async () => {
      const mockCreate = vi.fn().mockRejectedValue(new Error('API Error'));
      setMockCreate(provider, mockCreate);

      const result = await provider.execute('Test prompt');

      expect(result.success).toBe(false);
      expect(result.error).toContain('API Error');
      expect(result.errorCategory).toBe('provider');
      expect(result.errorCode).toBe('PROVIDER_CRASH');
      expect(result.iterationComplete).toBe(false);
    });

    it('should handle empty response gracefully', async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        choices: [],
      });

      setMockCreate(provider, mockCreate);

      const result = await provider.execute('Test prompt');

      expect(result.success).toBe(true);
      expect(result.iterationComplete).toBe(false);
    });

    it('should track files changed via write_file tool', async () => {
      const { writeFile } = await import('fs/promises');
      vi.mocked(writeFile).mockResolvedValue(undefined);

      const mockCreate = vi.fn()
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: 'Writing file...',
              tool_calls: [{
                id: 'call-1',
                function: {
                  name: 'write_file',
                  arguments: JSON.stringify({ path: 'src/new.ts', content: 'code' }),
                },
              }],
            },
          }],
        })
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: null,
              tool_calls: [{
                id: 'call-2',
                function: {
                  name: 'task_complete',
                  arguments: JSON.stringify({ summary: 'Done' }),
                },
              }],
            },
          }],
        });

      setMockCreate(provider, mockCreate);

      const result = await provider.execute('Test prompt');

      expect(result.filesChanged).toContain('src/new.ts');
    });

    it('should include text output in result', async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        choices: [{
          message: {
            content: 'Here is my response',
            tool_calls: null,
          },
        }],
      });

      setMockCreate(provider, mockCreate);

      const result = await provider.execute('Test prompt');

      expect(result.output).toContain('Here is my response');
    });

    it('should respect model option', async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        choices: [{
          message: { content: 'Done', tool_calls: null },
        }],
      });

      setMockCreate(provider, mockCreate);

      await provider.execute('Test prompt', { model: 'gpt-4-turbo' });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4-turbo',
        })
      );
    });

    it('should respect maxTokens option', async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        choices: [{
          message: { content: 'Done', tool_calls: null },
        }],
      });

      setMockCreate(provider, mockCreate);

      await provider.execute('Test prompt', { maxTokens: 2048 });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          max_tokens: 2048,
        })
      );
    });

    it('should handle multiple tool calls in single response', async () => {
      const { writeFile, readFile } = await import('fs/promises');
      vi.mocked(writeFile).mockResolvedValue(undefined);
      (readFile as unknown as ReturnType<typeof vi.fn>).mockResolvedValue('file content');

      const mockCreate = vi.fn()
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: 'Processing...',
              tool_calls: [
                {
                  id: 'call-1',
                  function: {
                    name: 'read_file',
                    arguments: JSON.stringify({ path: 'src/existing.ts' }),
                  },
                },
                {
                  id: 'call-2',
                  function: {
                    name: 'write_file',
                    arguments: JSON.stringify({ path: 'src/new.ts', content: 'new code' }),
                  },
                },
              ],
            },
          }],
        })
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: null,
              tool_calls: [{
                id: 'call-3',
                function: {
                  name: 'task_complete',
                  arguments: JSON.stringify({ summary: 'Done' }),
                },
              }],
            },
          }],
        });

      setMockCreate(provider, mockCreate);

      const result = await provider.execute('Test prompt');

      expect(result.success).toBe(true);
      expect(result.filesChanged).toContain('src/new.ts');
    });
  });

  describe('session continuation', () => {
    it('should return conversationState in result', async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        choices: [{
          message: { content: 'Done', tool_calls: null },
        }],
        usage: { prompt_tokens: 100, completion_tokens: 50 },
      });

      setMockCreate(provider, mockCreate);

      const result = await provider.execute('Test prompt');

      expect(result.conversationState).toBeDefined();
      expect(Array.isArray(result.conversationState)).toBe(true);
    });

    it('should start fresh when no conversationState provided', async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        choices: [{
          message: { content: 'Done', tool_calls: null },
        }],
      });

      setMockCreate(provider, mockCreate);

      await provider.execute('First prompt');

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages).toHaveLength(1);
      expect(callArgs.messages[0].role).toBe('user');
      expect(callArgs.messages[0].content).toBe('First prompt');
    });

    it('should continue from conversationState when provided', async () => {
      const existingState = [
        { role: 'user', content: 'Previous prompt' },
        { role: 'assistant', content: 'Previous response' },
      ];

      const mockCreate = vi.fn().mockResolvedValue({
        choices: [{
          message: { content: 'Continued', tool_calls: null },
        }],
      });

      setMockCreate(provider, mockCreate);

      await provider.execute('Continuation prompt', {
        conversationState: existingState,
      });

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages).toHaveLength(3);
      expect(callArgs.messages[0].content).toBe('Previous prompt');
      expect(callArgs.messages[1].content).toBe('Previous response');
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

describe('createOpenAiApiProvider', () => {
  it('should create an OpenAiApiProvider instance', () => {
    const provider = createOpenAiApiProvider('/test/cwd');
    expect(provider.name).toBe('openai-api');
  });

  it('should pass apiKey to provider', () => {
    const provider = createOpenAiApiProvider('/test/cwd', 'my-api-key');
    expect(provider.name).toBe('openai-api');
  });
});
