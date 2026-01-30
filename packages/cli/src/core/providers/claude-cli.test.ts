import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClaudeCliProvider, buildIterationPrompt, buildContinuationPrompt } from './claude-cli.js';
import { spawn } from 'child_process';

// Mock child_process for tests without real Claude CLI
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

describe('ClaudeCliProvider', () => {
  let provider: ClaudeCliProvider;

  beforeEach(() => {
    provider = new ClaudeCliProvider('/test/cwd');
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should set name to claude-cli', () => {
      expect(provider.name).toBe('claude-cli');
    });

    it('should use provided cwd', () => {
      const customProvider = new ClaudeCliProvider('/custom/path');
      expect(customProvider.name).toBe('claude-cli');
    });
  });

  describe('execute', () => {
    it('should include --dangerously-skip-permissions when option is true', async () => {
      // Execute with dangerouslySkipPermissions: true
      // Don't await — we just need to wait for detectChangedFiles to resolve
      // so the claude spawn is called
      const executePromise = provider.execute('test prompt', { dangerouslySkipPermissions: true });

      // Wait for detectChangedFiles mock (setTimeout 10ms) to resolve,
      // which triggers the claude spawn
      await new Promise(resolve => setTimeout(resolve, 20));

      // spawn is called twice: once for git status (detectChangedFiles), once for claude
      const spawnMock = spawn as unknown as ReturnType<typeof vi.fn>;
      const claudeCall = spawnMock.mock.calls.find(
        (call: unknown[]) => call[0] === 'claude'
      );
      expect(claudeCall).toBeDefined();
      expect(claudeCall![1]).toContain('--dangerously-skip-permissions');

      // Let the execute promise settle to avoid unhandled rejections
      await executePromise;
    });

    it('should not include --dangerously-skip-permissions when option is false', async () => {
      const executePromise = provider.execute('test prompt', { dangerouslySkipPermissions: false });

      await new Promise(resolve => setTimeout(resolve, 20));

      const spawnMock = spawn as unknown as ReturnType<typeof vi.fn>;
      const claudeCall = spawnMock.mock.calls.find(
        (call: unknown[]) => call[0] === 'claude'
      );
      expect(claudeCall).toBeDefined();
      expect(claudeCall![1]).not.toContain('--dangerously-skip-permissions');

      await executePromise;
    });

    it('should not include --dangerously-skip-permissions by default', async () => {
      const executePromise = provider.execute('test prompt');

      await new Promise(resolve => setTimeout(resolve, 20));

      const spawnMock = spawn as unknown as ReturnType<typeof vi.fn>;
      const claudeCall = spawnMock.mock.calls.find(
        (call: unknown[]) => call[0] === 'claude'
      );
      expect(claudeCall).toBeDefined();
      expect(claudeCall![1]).not.toContain('--dangerously-skip-permissions');

      await executePromise;
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
});

describe('buildIterationPrompt', () => {
  it('should include iteration number in header', () => {
    const prompt = buildIterationPrompt({
      agents: 'agents content',
      role: 'role content',
      task: 'task content',
      iteration: 5,
    });

    expect(prompt).toContain('Iteration 5');
    expect(prompt).toContain('AIDF Autonomous Execution');
  });

  it('should include all context sections', () => {
    const prompt = buildIterationPrompt({
      agents: '# Project Overview\nTest project description',
      role: '# Role: Developer\nYou are a developer',
      task: '# Task\nImplement feature X',
      iteration: 1,
    });

    expect(prompt).toContain('Project Context (AGENTS.md)');
    expect(prompt).toContain('Test project description');
    expect(prompt).toContain('Your Role');
    expect(prompt).toContain('You are a developer');
    expect(prompt).toContain('Current Task');
    expect(prompt).toContain('Implement feature X');
  });

  it('should include plan when provided', () => {
    const prompt = buildIterationPrompt({
      agents: 'agents',
      role: 'role',
      task: 'task',
      plan: '# Implementation Plan\n1. First step\n2. Second step',
      iteration: 2,
    });

    expect(prompt).toContain('Implementation Plan');
    expect(prompt).toContain('First step');
    expect(prompt).toContain('Second step');
  });

  it('should not include plan section when not provided', () => {
    const prompt = buildIterationPrompt({
      agents: 'agents',
      role: 'role',
      task: 'task',
      iteration: 1,
    });

    expect(prompt).not.toContain('Implementation Plan');
  });

  it('should include previous output when provided', () => {
    const prompt = buildIterationPrompt({
      agents: 'agents',
      role: 'role',
      task: 'task',
      previousOutput: 'Previous iteration did something',
      iteration: 3,
    });

    expect(prompt).toContain('Previous Iteration Output');
    expect(prompt).toContain('Previous iteration did something');
  });

  it('should truncate long previous output to 2000 chars', () => {
    const longOutput = 'Z'.repeat(5000);
    const prompt = buildIterationPrompt({
      agents: 'agents',
      role: 'role',
      task: 'task',
      previousOutput: longOutput,
      iteration: 3,
    });

    expect(prompt).toContain('Previous Iteration Output');
    // The output should be truncated - check that we don't have all 5000
    const zCount = (prompt.match(/Z/g) || []).length;
    expect(zCount).toBe(2000);
    expect(zCount).toBeLessThan(5000);
  });

  it('should include execution instructions', () => {
    const prompt = buildIterationPrompt({
      agents: 'agents',
      role: 'role',
      task: 'task',
      iteration: 1,
    });

    expect(prompt).toContain('Execution Instructions');
    expect(prompt).toContain('<TASK_COMPLETE>');
    expect(prompt).toContain('<BLOCKED:');
    expect(prompt).toContain('allowed scope');
    expect(prompt).toContain('forbidden scope');
  });

  it('should include blocking context when resuming', () => {
    const prompt = buildIterationPrompt({
      agents: 'agents',
      role: 'role',
      task: 'task',
      iteration: 6,
      blockingContext: {
        previousIteration: 5,
        blockingIssue: 'Missing API key configuration',
        filesModified: ['src/api/client.ts', 'src/config/settings.ts'],
      },
    });

    expect(prompt).toContain('Resuming Blocked Task');
    expect(prompt).toContain('previously blocked at iteration 5');
    expect(prompt).toContain('Previous Blocking Issue');
    expect(prompt).toContain('Missing API key configuration');
    expect(prompt).toContain('Files Modified in Previous Attempt');
    expect(prompt).toContain('src/api/client.ts');
    expect(prompt).toContain('src/config/settings.ts');
    expect(prompt).toContain('Continue from where it left off');
  });

  it('should not include blocking context section when not resuming', () => {
    const prompt = buildIterationPrompt({
      agents: 'agents',
      role: 'role',
      task: 'task',
      iteration: 1,
    });

    expect(prompt).not.toContain('Resuming Blocked Task');
    expect(prompt).not.toContain('Previous Blocking Issue');
  });

  it('should handle blocking context with no files modified', () => {
    const prompt = buildIterationPrompt({
      agents: 'agents',
      role: 'role',
      task: 'task',
      iteration: 2,
      blockingContext: {
        previousIteration: 1,
        blockingIssue: 'Initial blocker',
        filesModified: [],
      },
    });

    expect(prompt).toContain('Resuming Blocked Task');
    expect(prompt).toContain('_None_');
  });

  it('should include Definition of Done reference', () => {
    const prompt = buildIterationPrompt({
      agents: 'agents',
      role: 'role',
      task: 'task',
      iteration: 1,
    });

    expect(prompt).toContain('Definition of Done');
  });

  it('should include previous validation error when provided', () => {
    const prompt = buildIterationPrompt({
      agents: 'agents',
      role: 'role',
      task: 'task',
      iteration: 2,
      previousValidationError: '❌ pnpm typecheck failed\nerror TS2345: Argument...',
    });

    expect(prompt).toContain('Previous Iteration Feedback');
    expect(prompt).toContain('signaled <TASK_COMPLETE> but validation failed');
    expect(prompt).toContain('pnpm typecheck failed');
    expect(prompt).toContain('fix the validation errors');
    expect(prompt).toContain('signal <TASK_COMPLETE> again');
  });

  it('should not include validation error section when not provided', () => {
    const prompt = buildIterationPrompt({
      agents: 'agents',
      role: 'role',
      task: 'task',
      iteration: 1,
    });

    expect(prompt).not.toContain('Previous Iteration Feedback');
  });
});

describe('ClaudeCliProvider session continuation', () => {
  let provider: ClaudeCliProvider;

  beforeEach(() => {
    provider = new ClaudeCliProvider('/test/cwd');
    vi.clearAllMocks();
  });

  it('should include --continue when sessionContinuation is true', async () => {
    const executePromise = provider.execute('test prompt', { sessionContinuation: true });

    await new Promise(resolve => setTimeout(resolve, 20));

    const spawnMock = spawn as unknown as ReturnType<typeof vi.fn>;
    const claudeCall = spawnMock.mock.calls.find(
      (call: unknown[]) => call[0] === 'claude'
    );
    expect(claudeCall).toBeDefined();
    expect(claudeCall![1]).toContain('--continue');

    await executePromise;
  });

  it('should not include --continue when sessionContinuation is false', async () => {
    const executePromise = provider.execute('test prompt', { sessionContinuation: false });

    await new Promise(resolve => setTimeout(resolve, 20));

    const spawnMock = spawn as unknown as ReturnType<typeof vi.fn>;
    const claudeCall = spawnMock.mock.calls.find(
      (call: unknown[]) => call[0] === 'claude'
    );
    expect(claudeCall).toBeDefined();
    expect(claudeCall![1]).not.toContain('--continue');

    await executePromise;
  });

  it('should not include --continue by default', async () => {
    const executePromise = provider.execute('test prompt');

    await new Promise(resolve => setTimeout(resolve, 20));

    const spawnMock = spawn as unknown as ReturnType<typeof vi.fn>;
    const claudeCall = spawnMock.mock.calls.find(
      (call: unknown[]) => call[0] === 'claude'
    );
    expect(claudeCall).toBeDefined();
    expect(claudeCall![1]).not.toContain('--continue');

    await executePromise;
  });

  it('should include both --continue and --dangerously-skip-permissions when both enabled', async () => {
    const executePromise = provider.execute('test prompt', {
      sessionContinuation: true,
      dangerouslySkipPermissions: true,
    });

    await new Promise(resolve => setTimeout(resolve, 20));

    const spawnMock = spawn as unknown as ReturnType<typeof vi.fn>;
    const claudeCall = spawnMock.mock.calls.find(
      (call: unknown[]) => call[0] === 'claude'
    );
    expect(claudeCall).toBeDefined();
    expect(claudeCall![1]).toContain('--continue');
    expect(claudeCall![1]).toContain('--dangerously-skip-permissions');

    await executePromise;
  });
});

describe('buildContinuationPrompt', () => {
  it('should include iteration number', () => {
    const prompt = buildContinuationPrompt({
      iteration: 3,
    });

    expect(prompt).toContain('Iteration 3');
    expect(prompt).toContain('Continuation');
  });

  it('should be minimal — no AGENTS.md, role, or task sections', () => {
    const prompt = buildContinuationPrompt({
      iteration: 2,
    });

    expect(prompt).not.toContain('Project Context (AGENTS.md)');
    expect(prompt).not.toContain('Your Role');
    expect(prompt).not.toContain('Current Task');
    expect(prompt).not.toContain('Implementation Plan');
  });

  it('should include previous output when provided', () => {
    const prompt = buildContinuationPrompt({
      iteration: 2,
      previousOutput: 'Some output from last iteration',
    });

    expect(prompt).toContain('Previous Iteration Output');
    expect(prompt).toContain('Some output from last iteration');
  });

  it('should truncate long previous output to 2000 chars', () => {
    const longOutput = 'X'.repeat(5000);
    const prompt = buildContinuationPrompt({
      iteration: 2,
      previousOutput: longOutput,
    });

    const xCount = (prompt.match(/X/g) || []).length;
    expect(xCount).toBe(2000);
  });

  it('should include validation error when provided', () => {
    const prompt = buildContinuationPrompt({
      iteration: 3,
      previousValidationError: 'pnpm typecheck failed\nerror TS2345',
    });

    expect(prompt).toContain('Previous Iteration Feedback');
    expect(prompt).toContain('pnpm typecheck failed');
    expect(prompt).toContain('fix the validation errors');
  });

  it('should include reminder with completion signals', () => {
    const prompt = buildContinuationPrompt({
      iteration: 2,
    });

    expect(prompt).toContain('<TASK_COMPLETE>');
    expect(prompt).toContain('<BLOCKED:');
  });

  it('should be much shorter than full prompt', () => {
    const fullPrompt = buildIterationPrompt({
      agents: 'A'.repeat(2000),
      role: 'R'.repeat(500),
      task: 'T'.repeat(500),
      iteration: 2,
    });

    const continuationPrompt = buildContinuationPrompt({
      iteration: 2,
    });

    expect(continuationPrompt.length).toBeLessThan(fullPrompt.length / 2);
  });
});
