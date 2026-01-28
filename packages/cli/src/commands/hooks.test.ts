import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHooksCommand, detectHusky, generateHookScript } from './hooks.js';

vi.mock('../core/context-loader.js', () => ({
  ContextLoader: {
    findAiDir: vi.fn(() => '/test/project'),
  },
}));

vi.mock('../utils/logger.js', () => ({
  Logger: vi.fn().mockImplementation(() => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    debug: vi.fn(),
    box: vi.fn(),
    setContext: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: vi.fn(() => false),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(() => '{}'),
    unlinkSync: vi.fn(),
    chmodSync: vi.fn(),
  };
});

import { ContextLoader } from '../core/context-loader.js';
import { existsSync, readFileSync } from 'fs';

describe('hooks command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (ContextLoader.findAiDir as any).mockReturnValue('/test/project');
  });

  describe('createHooksCommand', () => {
    it('should create command with correct name and description', () => {
      const cmd = createHooksCommand();
      expect(cmd.name()).toBe('hooks');
      expect(cmd.description()).toContain('hook');
    });

    it('should have install subcommand', () => {
      const cmd = createHooksCommand();
      const sub = cmd.commands.find(c => c.name() === 'install');
      expect(sub).toBeDefined();
    });

    it('should have uninstall subcommand', () => {
      const cmd = createHooksCommand();
      const sub = cmd.commands.find(c => c.name() === 'uninstall');
      expect(sub).toBeDefined();
    });

    it('install should have --husky option', () => {
      const cmd = createHooksCommand();
      const sub = cmd.commands.find(c => c.name() === 'install');
      const opt = sub?.options.find(o => o.long === '--husky');
      expect(opt).toBeDefined();
    });

    it('install should have --pre-commit option', () => {
      const cmd = createHooksCommand();
      const sub = cmd.commands.find(c => c.name() === 'install');
      const opt = sub?.options.find(o => o.long === '--pre-commit');
      expect(opt).toBeDefined();
    });

    it('install should have --force option', () => {
      const cmd = createHooksCommand();
      const sub = cmd.commands.find(c => c.name() === 'install');
      const opt = sub?.options.find(o => o.long === '--force');
      expect(opt).toBeDefined();
    });

    it('install should have --verbose option', () => {
      const cmd = createHooksCommand();
      const sub = cmd.commands.find(c => c.name() === 'install');
      const opt = sub?.options.find(o => o.long === '--verbose');
      expect(opt).toBeDefined();
    });
  });

  describe('detectHusky', () => {
    it('should return true when .husky directory exists', () => {
      (existsSync as any).mockImplementation((path: string) =>
        path.includes('.husky')
      );
      expect(detectHusky('/test/project')).toBe(true);
    });

    it('should return true when husky is in devDependencies', () => {
      (existsSync as any).mockImplementation((path: string) =>
        path.includes('package.json')
      );
      (readFileSync as any).mockReturnValue(
        JSON.stringify({ devDependencies: { husky: '^9.0.0' } })
      );
      expect(detectHusky('/test/project')).toBe(true);
    });

    it('should return true when prepare script includes husky', () => {
      (existsSync as any).mockImplementation((path: string) =>
        path.includes('package.json')
      );
      (readFileSync as any).mockReturnValue(
        JSON.stringify({ scripts: { prepare: 'husky install' } })
      );
      expect(detectHusky('/test/project')).toBe(true);
    });

    it('should return false when no husky detected', () => {
      (existsSync as any).mockReturnValue(false);
      expect(detectHusky('/test/project')).toBe(false);
    });
  });

  describe('generateHookScript', () => {
    it('should generate pre-commit script with AIDF header', () => {
      const script = generateHookScript('pre-commit');
      expect(script).toContain('#!/bin/sh');
      expect(script).toContain('# AIDF');
      expect(script).toContain('pre-commit');
      expect(script).toContain('STAGED_FILES');
    });

    it('should generate commit-msg script with format validation', () => {
      const script = generateHookScript('commit-msg');
      expect(script).toContain('#!/bin/sh');
      expect(script).toContain('# AIDF');
      expect(script).toContain('COMMIT_MSG');
      expect(script).toContain('feat|fix|docs');
    });

    it('should generate pre-push script with validation commands', () => {
      const script = generateHookScript('pre-push');
      expect(script).toContain('#!/bin/sh');
      expect(script).toContain('# AIDF');
      expect(script).toContain('Pre-push Validation');
    });
  });

  describe('error handling', () => {
    it('should exit with error when no AIDF project found', async () => {
      (ContextLoader.findAiDir as any).mockReturnValue(null);

      const cmd = createHooksCommand();
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      try {
        await cmd.parseAsync(['hooks', 'install'], { from: 'user' });
      } catch {
        expect(exitSpy).toHaveBeenCalledWith(1);
      }

      exitSpy.mockRestore();
    });
  });
});
