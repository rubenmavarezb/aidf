import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createWatchCommand } from './watch.js';

// Mock dependencies
vi.mock('../core/context-loader.js', () => ({
  ContextLoader: {
    findAiDir: vi.fn(() => '/test/project'),
  },
}));

vi.mock('../core/watcher.js', () => ({
  Watcher: vi.fn().mockImplementation(() => ({
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../utils/logger.js', () => ({
  Logger: vi.fn().mockImplementation(() => ({
    error: vi.fn(),
    info: vi.fn(),
    box: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  })),
}));

import { ContextLoader } from '../core/context-loader.js';

describe('watch command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (ContextLoader.findAiDir as any).mockReturnValue('/test/project');
  });

  describe('createWatchCommand', () => {
    it('should create command with correct name and description', () => {
      const cmd = createWatchCommand();
      expect(cmd.name()).toBe('watch');
      expect(cmd.description()).toContain('Watch');
    });

    it('should have --dry-run option', () => {
      const cmd = createWatchCommand();
      const opt = cmd.options.find(o => o.long === '--dry-run');
      expect(opt).toBeDefined();
    });

    it('should have --verbose option', () => {
      const cmd = createWatchCommand();
      const opt = cmd.options.find(o => o.long === '--verbose');
      expect(opt).toBeDefined();
    });

    it('should have --quiet option', () => {
      const cmd = createWatchCommand();
      const opt = cmd.options.find(o => o.long === '--quiet');
      expect(opt).toBeDefined();
    });

    it('should have --debounce option', () => {
      const cmd = createWatchCommand();
      const opt = cmd.options.find(o => o.long === '--debounce');
      expect(opt).toBeDefined();
    });

    it('should have --daemon option', () => {
      const cmd = createWatchCommand();
      const opt = cmd.options.find(o => o.long === '--daemon');
      expect(opt).toBeDefined();
    });

    it('should have --provider option', () => {
      const cmd = createWatchCommand();
      const opt = cmd.options.find(o => o.long === '--provider');
      expect(opt).toBeDefined();
    });

    it('should have --max-iterations option', () => {
      const cmd = createWatchCommand();
      const opt = cmd.options.find(o => o.long === '--max-iterations');
      expect(opt).toBeDefined();
    });

    it('should have --log-format option', () => {
      const cmd = createWatchCommand();
      const opt = cmd.options.find(o => o.long === '--log-format');
      expect(opt).toBeDefined();
    });

    it('should have --log-file option', () => {
      const cmd = createWatchCommand();
      const opt = cmd.options.find(o => o.long === '--log-file');
      expect(opt).toBeDefined();
    });

    it('should have --log-rotate option', () => {
      const cmd = createWatchCommand();
      const opt = cmd.options.find(o => o.long === '--log-rotate');
      expect(opt).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should exit with error when no AIDF project found', async () => {
      (ContextLoader.findAiDir as any).mockReturnValue(null);

      const cmd = createWatchCommand();

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      try {
        await cmd.parseAsync(['watch'], { from: 'user' });
      } catch {
        expect(exitSpy).toHaveBeenCalledWith(1);
      }

      exitSpy.mockRestore();
    });
  });
});
