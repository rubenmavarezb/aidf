import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToolHandler } from './tool-handler.js';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn(),
}));

// Mock glob
vi.mock('glob', () => ({
  glob: vi.fn(),
}));

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn(() => {
    const mockProc = {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 10);
        }
      }),
    };
    return mockProc;
  }),
}));

describe('ToolHandler', () => {
  let handler: ToolHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = new ToolHandler('/test/cwd');
  });

  describe('reset', () => {
    it('should clear tracked files', async () => {
      const { writeFile } = await import('fs/promises');
      (writeFile as any).mockResolvedValue(undefined);
      const { existsSync } = await import('fs');
      (existsSync as any).mockReturnValue(true);

      await handler.handle('write_file', { path: 'test.ts', content: 'code' });
      expect(handler.getChangedFiles()).toHaveLength(1);

      handler.reset();
      expect(handler.getChangedFiles()).toHaveLength(0);
    });
  });

  describe('getChangedFiles', () => {
    it('should return empty array initially', () => {
      expect(handler.getChangedFiles()).toEqual([]);
    });

    it('should track files written', async () => {
      const { writeFile } = await import('fs/promises');
      (writeFile as any).mockResolvedValue(undefined);
      const { existsSync } = await import('fs');
      (existsSync as any).mockReturnValue(true);

      await handler.handle('write_file', { path: 'file1.ts', content: 'a' });
      await handler.handle('write_file', { path: 'file2.ts', content: 'b' });

      const changed = handler.getChangedFiles();
      expect(changed).toContain('file1.ts');
      expect(changed).toContain('file2.ts');
    });
  });

  describe('handle', () => {
    describe('read_file', () => {
      it('should read file content', async () => {
        const { readFile } = await import('fs/promises');
        (readFile as any).mockResolvedValue('file content here');

        const result = await handler.handle('read_file', { path: 'src/test.ts' });

        expect(result).toBe('file content here');
        expect(readFile).toHaveBeenCalledWith('/test/cwd/src/test.ts', 'utf-8');
      });

      it('should return error on read failure', async () => {
        const { readFile } = await import('fs/promises');
        (readFile as any).mockRejectedValue(new Error('File not found'));

        const result = await handler.handle('read_file', { path: 'missing.ts' });

        expect(result).toContain('Error:');
        expect(result).toContain('File not found');
      });
    });

    describe('write_file', () => {
      it('should write file content', async () => {
        const { writeFile } = await import('fs/promises');
        const { existsSync } = await import('fs');
        (writeFile as any).mockResolvedValue(undefined);
        (existsSync as any).mockReturnValue(true);

        const result = await handler.handle('write_file', {
          path: 'src/new.ts',
          content: 'const x = 1;',
        });

        expect(result).toContain('File written');
        expect(writeFile).toHaveBeenCalled();
      });

      it('should create directory if it does not exist', async () => {
        const { writeFile, mkdir } = await import('fs/promises');
        const { existsSync } = await import('fs');
        (writeFile as any).mockResolvedValue(undefined);
        (mkdir as any).mockResolvedValue(undefined);
        (existsSync as any).mockReturnValue(false);

        await handler.handle('write_file', {
          path: 'new/dir/file.ts',
          content: 'code',
        });

        expect(mkdir).toHaveBeenCalledWith(
          expect.stringContaining('new/dir'),
          { recursive: true }
        );
      });

      it('should track written files', async () => {
        const { writeFile } = await import('fs/promises');
        const { existsSync } = await import('fs');
        (writeFile as any).mockResolvedValue(undefined);
        (existsSync as any).mockReturnValue(true);

        await handler.handle('write_file', { path: 'tracked.ts', content: 'x' });

        expect(handler.getChangedFiles()).toContain('tracked.ts');
      });
    });

    describe('list_files', () => {
      it('should list files with default pattern', async () => {
        const { glob } = await import('glob');
        (glob as any).mockResolvedValue(['a.ts', 'b.ts', 'c.ts']);

        const result = await handler.handle('list_files', { path: 'src' });

        expect(result).toBe('a.ts\nb.ts\nc.ts');
      });

      it('should use provided pattern', async () => {
        const { glob } = await import('glob');
        (glob as any).mockResolvedValue(['test.spec.ts']);

        const result = await handler.handle('list_files', {
          path: 'src',
          pattern: '**/*.spec.ts',
        });

        expect(glob).toHaveBeenCalledWith('**/*.spec.ts', expect.any(Object));
        expect(result).toBe('test.spec.ts');
      });
    });

    describe('run_command', () => {
      it('should run command and return output', async () => {
        const { spawn } = await import('child_process');
        const mockProc = {
          stdout: {
            on: vi.fn((event, cb) => {
              if (event === 'data') cb(Buffer.from('command output'));
            }),
          },
          stderr: {
            on: vi.fn(),
          },
          on: vi.fn((event, cb) => {
            if (event === 'close') setTimeout(() => cb(0), 10);
          }),
        };
        (spawn as any).mockReturnValue(mockProc);

        const result = await handler.handle('run_command', { command: 'echo hello' });

        expect(result).toContain('Exit code: 0');
      });
    });

    describe('task_complete', () => {
      it('should return completion message', async () => {
        const result = await handler.handle('task_complete', {
          summary: 'All tests passing',
        });

        expect(result).toBe('Task completed: All tests passing');
      });
    });

    describe('task_blocked', () => {
      it('should return blocked message', async () => {
        const result = await handler.handle('task_blocked', {
          reason: 'Missing API key',
        });

        expect(result).toBe('Task blocked: Missing API key');
      });
    });

    describe('unknown tool', () => {
      it('should return unknown tool message', async () => {
        const result = await handler.handle('unknown_tool', {});

        expect(result).toBe('Unknown tool: unknown_tool');
      });
    });
  });
});
