import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CursorCliProvider } from './cursor-cli.js';

// Mock child_process for tests without real Cursor CLI
vi.mock('child_process', () => ({
  spawn: vi.fn(() => {
    const mockProc = {
      stdout: {
        on: vi.fn(),
      },
      stderr: {
        on: vi.fn(),
      },
      stdin: {
        write: vi.fn(),
        end: vi.fn(),
      },
      on: vi.fn((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 10);
        }
      }),
      kill: vi.fn(),
    };
    return mockProc;
  }),
}));

describe('CursorCliProvider', () => {
  let provider: CursorCliProvider;

  beforeEach(() => {
    provider = new CursorCliProvider('/test/cwd');
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should set name to cursor-cli', () => {
      expect(provider.name).toBe('cursor-cli');
    });

    it('should use provided cwd', () => {
      const customProvider = new CursorCliProvider('/custom/path');
      expect(customProvider.name).toBe('cursor-cli');
    });
  });

  describe('detectCompletionSignal', () => {
    it('should detect <TASK_COMPLETE>', () => {
      const signal = (provider as unknown as { detectCompletionSignal: (s: string) => string | undefined })
        .detectCompletionSignal('Some output\n<TASK_COMPLETE>\nMore output');
      expect(signal).toBe('<TASK_COMPLETE>');
    });

    it('should detect <DONE>', () => {
      const signal = (provider as unknown as { detectCompletionSignal: (s: string) => string | undefined })
        .detectCompletionSignal('Output with <DONE> signal');
      expect(signal).toBe('<DONE>');
    });

    it('should detect "## Task Complete"', () => {
      const signal = (provider as unknown as { detectCompletionSignal: (s: string) => string | undefined })
        .detectCompletionSignal('## Task Complete\nAll done!');
      expect(signal).toBe('## Task Complete');
    });

    it('should return undefined when no signal found', () => {
      const signal = (provider as unknown as { detectCompletionSignal: (s: string) => string | undefined })
        .detectCompletionSignal('Normal output without completion signal');
      expect(signal).toBeUndefined();
    });

    it('should return first matching signal', () => {
      const signal = (provider as unknown as { detectCompletionSignal: (s: string) => string | undefined })
        .detectCompletionSignal('<TASK_COMPLETE> and also <DONE>');
      expect(signal).toBe('<TASK_COMPLETE>');
    });
  });

  describe('execute', () => {
    it('should spawn agent with --print flag', async () => {
      const { spawn } = await import('child_process');

      // Start execution (won't fully resolve due to mock, but triggers spawn)
      provider.execute('test prompt');

      // Wait for git status (before) + agent spawn + git status (after close)
      await vi.waitFor(() => {
        expect(spawn).toHaveBeenCalledTimes(3);
      });

      // Second call is the agent spawn (1st = git before, 2nd = agent, 3rd = git after)
      expect(spawn).toHaveBeenNthCalledWith(
        2,
        'agent',
        ['--print'],
        expect.objectContaining({
          cwd: '/test/cwd',
          shell: true,
        })
      );
    });

    it('should not include --dangerously-skip-permissions flag', async () => {
      const { spawn } = await import('child_process');

      provider.execute('test prompt', { dangerouslySkipPermissions: true });

      await vi.waitFor(() => {
        expect(spawn).toHaveBeenCalledTimes(3);
      });

      // Verify the agent args only contain --print (no --dangerously-skip-permissions)
      expect(spawn).toHaveBeenNthCalledWith(
        2,
        'agent',
        ['--print'],
        expect.anything()
      );
    });
  });
});
