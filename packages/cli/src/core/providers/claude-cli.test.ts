import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClaudeCliProvider, buildIterationPrompt } from './claude-cli.js';

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

  it('should include Definition of Done reference', () => {
    const prompt = buildIterationPrompt({
      agents: 'agents',
      role: 'role',
      task: 'task',
      iteration: 1,
    });

    expect(prompt).toContain('Definition of Done');
  });
});
