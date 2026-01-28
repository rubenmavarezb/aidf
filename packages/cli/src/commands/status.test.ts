import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStatusCommand } from './status.js';
import type { StatusData } from '../types/index.js';

// Mock dependencies
vi.mock('../core/context-loader.js', () => ({
  ContextLoader: {
    findAiDir: vi.fn(() => '/test/project'),
  },
}));

vi.mock('fs/promises', () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
  stat: vi.fn(),
}));

const mockExistsSync = vi.fn();
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    existsSync: mockExistsSync,
  };
});

vi.mock('simple-git', () => ({
  simpleGit: vi.fn(),
}));

vi.mock('../utils/logger.js', () => ({
  Logger: vi.fn().mockImplementation(() => ({
    error: vi.fn(),
    box: vi.fn(),
  })),
}));

// Import mocked modules
import { ContextLoader } from '../core/context-loader.js';
import { readdir, readFile, stat } from 'fs/promises';
import { simpleGit } from 'simple-git';
describe('status command', () => {
  const mockProjectRoot = '/test/project';

  beforeEach(() => {
    vi.clearAllMocks();
    (ContextLoader.findAiDir as any).mockReturnValue(mockProjectRoot);
    mockExistsSync.mockReturnValue(false);
  });

  describe('collectTaskStats', () => {
    it('should count tasks by status correctly', async () => {
      const { collectTaskStats } = await import('./status.js');
      
      (readdir as any).mockResolvedValue([
        '001-pending-task.md',
        '002-completed-task.md',
        '003-blocked-task.md',
        '004-in-progress-task.md',
      ]);

      (readFile as any)
        .mockResolvedValueOnce('# TASK\n## Goal\nTest\n## Status: 🔵 Ready')
        .mockResolvedValueOnce('# TASK\n## Goal\nTest\n## Status: ✅ COMPLETED')
        .mockResolvedValueOnce('# TASK\n## Goal\nTest\n## Status: ⚠️ BLOCKED')
        .mockResolvedValueOnce('# TASK\n## Goal\nTest\n## Status: IN PROGRESS');

      const stats = await collectTaskStats(mockProjectRoot);
      
      expect(stats.total).toBe(4);
      expect(stats.pending).toBe(1);
      expect(stats.completed).toBe(1);
      expect(stats.blocked).toBe(1);
      expect(stats.inProgress).toBe(1);
    });

    it('should handle tasks without status section as pending', async () => {
      const { collectTaskStats } = await import('./status.js');
      
      (readdir as any).mockResolvedValue(['001-no-status.md']);
      (readFile as any).mockResolvedValue('# TASK\n## Goal\nTest task');

      const stats = await collectTaskStats(mockProjectRoot);
      
      expect(stats.total).toBe(1);
      expect(stats.pending).toBe(1);
    });

    it('should handle empty tasks directory', async () => {
      const { collectTaskStats } = await import('./status.js');
      
      (readdir as any).mockRejectedValue(new Error('ENOENT'));

      const stats = await collectTaskStats(mockProjectRoot);
      
      expect(stats.total).toBe(0);
      expect(stats.pending).toBe(0);
    });
  });

  describe('getProviderConfig', () => {
    it('should load config from yaml file', async () => {
      mockExistsSync.mockImplementation((p: string) => {
        return p.includes('config.yml') || p.includes('config.yaml');
      });
      
      (readFile as any).mockResolvedValue('provider:\n  type: anthropic-api\n  model: claude-3-opus');

      const { getProviderConfig } = await import('./status.js');
      const provider = await getProviderConfig(mockProjectRoot);

      expect(provider.type).toBe('anthropic-api');
    });

    it('should return default config when no config file exists', async () => {
      mockExistsSync.mockReturnValue(false);

      const { getProviderConfig } = await import('./status.js');
      const provider = await getProviderConfig(mockProjectRoot);

      expect(provider.type).toBe('claude-cli');
    });
  });

  describe('getLastExecution', () => {
    it('should parse git log for last execution', async () => {
      const mockGit = {
        raw: vi.fn().mockResolvedValue('abc123|2024-01-15T10:00:00Z|aidf: Test task'),
      };
      (simpleGit as any).mockReturnValue(mockGit);

      // Mock config loading - no config file
      mockExistsSync.mockReturnValue(false);

      // Mock tasks directory for fallback
      (readdir as any).mockResolvedValue([]);

      const { getLastExecution } = await import('./status.js');
      const execution = await getLastExecution(mockProjectRoot);

      expect(execution).not.toBeNull();
      expect(execution?.date).toBeInstanceOf(Date);
      expect(execution?.result).toBe('success');
    });

    it('should fallback to task files when no git commits found', async () => {
      const mockGit = {
        raw: vi.fn().mockResolvedValue(''),
      };
      (simpleGit as any).mockReturnValue(mockGit);

      (readdir as any).mockResolvedValue(['001-task.md']);
      (readFile as any).mockResolvedValue(`# TASK
## Goal
Test
## Status: ✅ COMPLETED

- **Started:** 2024-01-15T10:00:00Z
- **Duration:** 5m 30s`);
      (stat as any).mockResolvedValue({ mtime: new Date('2024-01-15T10:00:00Z') });

      const { getLastExecution } = await import('./status.js');
      const execution = await getLastExecution(mockProjectRoot);

      expect(execution).not.toBeNull();
      expect(execution?.date).toBeInstanceOf(Date);
      expect(execution?.duration).toBe('5m 30s');
    });
  });

  describe('getRecentFiles', () => {
    it('should get files from git log', async () => {
      const mockGit = {
        raw: vi.fn().mockResolvedValue('src/file1.ts\nsrc/file2.ts\n.ai/config.yml'),
        status: vi.fn().mockResolvedValue({
          files: [{ path: 'src/file3.ts' }],
        }),
      };
      (simpleGit as any).mockReturnValue(mockGit);

      const { getRecentFiles } = await import('./status.js');
      const files = await getRecentFiles(mockProjectRoot);

      expect(files.length).toBeGreaterThan(0);
      expect(files).not.toContain('.ai/config.yml');
      expect(files).toContain('src/file1.ts');
    });

    it('should handle git errors gracefully', async () => {
      const mockGit = {
        raw: vi.fn().mockRejectedValue(new Error('Not a git repo')),
        status: vi.fn().mockRejectedValue(new Error('Not a git repo')),
      };
      (simpleGit as any).mockReturnValue(mockGit);

      const { getRecentFiles } = await import('./status.js');
      const files = await getRecentFiles(mockProjectRoot);

      expect(files).toEqual([]);
    });
  });

  describe('printStatusJson', () => {
    it('should output valid JSON', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { printStatusJson } = await import('./status.js');
      const data: StatusData = {
        tasks: {
          pending: 2,
          inProgress: 1,
          completed: 5,
          blocked: 1,
          total: 9,
        },
        lastExecution: {
          date: new Date('2024-01-15T10:00:00Z'),
          duration: '5m 30s',
          result: 'success',
          task: '/test/task.md',
        },
        recentFiles: ['src/file1.ts', 'src/file2.ts'],
        provider: {
          type: 'claude-cli',
        },
      };

      printStatusJson(data);

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      
      expect(parsed.tasks.total).toBe(9);
      expect(parsed.lastExecution).not.toBeNull();
      expect(parsed.recentFiles).toHaveLength(2);

      consoleSpy.mockRestore();
    });
  });

  describe('createStatusCommand', () => {
    it('should create command with --json option', () => {
      const cmd = createStatusCommand();
      expect(cmd.name()).toBe('status');
      expect(cmd.description()).toContain('dashboard');
      
      const jsonOption = cmd.options.find(opt => opt.long === '--json');
      expect(jsonOption).toBeDefined();
    });

    it('should handle missing AIDF project', async () => {
      (ContextLoader.findAiDir as any).mockReturnValue(null);
      
      const cmd = createStatusCommand();

      // Mock process.exit to prevent actual exit
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      try {
        await cmd.parseAsync(['status'], { from: 'user' });
      } catch {
        expect(exitSpy).toHaveBeenCalledWith(1);
      }

      exitSpy.mockRestore();
    });
  });
});
