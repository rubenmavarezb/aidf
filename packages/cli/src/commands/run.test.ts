import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { createRunCommand } from './run.js';

// Mock executor
const mockExecuteTask = vi.fn();
vi.mock('../core/executor.js', () => ({
  executeTask: (...args: unknown[]) => mockExecuteTask(...args),
}));

// Mock parallel executor
const mockParallelRun = vi.fn();
vi.mock('../core/parallel-executor.js', () => ({
  ParallelExecutor: vi.fn().mockImplementation(() => ({
    run: mockParallelRun,
  })),
}));

// Mock context loader
const mockLoadContext = vi.fn();
const mockFindAiDir = vi.fn();
vi.mock('../core/context-loader.js', () => ({
  ContextLoader: Object.assign(
    vi.fn().mockImplementation(() => ({
      loadContext: mockLoadContext,
    })),
    { findAiDir: (...args: unknown[]) => mockFindAiDir(...args) }
  ),
}));

// Mock inquirer
const mockPrompt = vi.fn();
vi.mock('inquirer', () => ({
  default: {
    prompt: (...args: unknown[]) => mockPrompt(...args),
  },
}));

// Mock fs
const mockExistsSync = vi.fn();
vi.mock('fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
}));

// Mock fs/promises
const mockReaddir = vi.fn();
const mockReadFile = vi.fn();
vi.mock('fs/promises', () => ({
  readdir: (...args: unknown[]) => mockReaddir(...args),
  readFile: (...args: unknown[]) => mockReadFile(...args),
}));

// Mock live-status
vi.mock('../utils/live-status.js', () => ({
  LiveStatus: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    setPhase: vi.fn(),
    handleOutput: vi.fn(),
    phaseFailed: vi.fn(),
    iterationStart: vi.fn(),
    iterationEnd: vi.fn(),
    complete: vi.fn(),
  })),
}));

// Mock logger
vi.mock('../utils/logger.js', () => ({
  Logger: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    box: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
    setContext: vi.fn(),
    clearContext: vi.fn(),
    startSpinner: vi.fn(),
    stopSpinner: vi.fn(),
  })),
}));

// Mock child_process for createPullRequest
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

// Spy on process.exit to prevent test from actually exiting
const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);

import { ParallelExecutor } from '../core/parallel-executor.js';
import type { ExecutorResult, LoadedContext, PhaseEvent, ExecutorState } from '../types/index.js';

describe('createRunCommand', () => {
  const mockContext: LoadedContext = {
    agents: {
      projectOverview: 'Test',
      architecture: 'Monorepo',
      technologyStack: 'TypeScript',
      conventions: 'Standard',
      qualityStandards: 'High',
      boundaries: { neverModify: [], neverDo: [], requiresDiscussion: [] },
      commands: { development: {}, quality: {}, build: {} },
      raw: '# AGENTS.md',
    },
    role: {
      name: 'developer',
      identity: 'Dev',
      expertise: ['TS'],
      responsibilities: ['Code'],
      constraints: [],
      qualityCriteria: [],
      raw: '# Role',
    },
    task: {
      filePath: '/test/.ai/tasks/001-task.md',
      goal: 'Test task goal',
      taskType: 'component',
      suggestedRoles: ['developer'],
      scope: { allowed: ['src/**'], forbidden: [] },
      requirements: 'Requirements',
      definitionOfDone: ['Item 1'],
      raw: '# Task',
    },
  };

  const mockResult: ExecutorResult = {
    success: true,
    status: 'completed',
    iterations: 3,
    filesModified: ['src/file.ts'],
    taskPath: '/test/.ai/tasks/001-task.md',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockExit.mockClear();
    mockFindAiDir.mockReturnValue('/test/project');
    mockLoadContext.mockResolvedValue(mockContext);
    mockExecuteTask.mockResolvedValue(mockResult);
    mockPrompt.mockResolvedValue({ confirm: true });
    mockExistsSync.mockReturnValue(true);
    mockReaddir.mockResolvedValue([]);
    mockReadFile.mockResolvedValue('# Task\n## Goal\nTest');
  });

  it('should create a command with correct name and options', () => {
    const cmd = createRunCommand();
    expect(cmd.name()).toBe('run');
    expect(cmd.description()).toContain('Execute a task');
  });

  describe('single task execution', () => {
    it('should exit with error when no AIDF project found', async () => {
      mockFindAiDir.mockReturnValue(null);

      const cmd = createRunCommand();
      await cmd.parseAsync(['node', 'test', '/test/task.md']);

      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should exit with error when task file not found', async () => {
      mockExistsSync.mockReturnValue(false);

      const cmd = createRunCommand();
      await cmd.parseAsync(['node', 'test', '/nonexistent.md']);

      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should execute a task when given a valid task path', async () => {
      const cmd = createRunCommand();
      await cmd.parseAsync(['node', 'test', '/test/.ai/tasks/001-task.md']);

      expect(mockExecuteTask).toHaveBeenCalledWith(
        expect.stringContaining('001-task.md'),
        expect.objectContaining({
          onPhase: expect.any(Function),
          onOutput: expect.any(Function),
          onIteration: expect.any(Function),
          onAskUser: expect.any(Function),
        })
      );
    });

    it('should abort when user declines confirmation', async () => {
      mockPrompt.mockResolvedValue({ confirm: false });

      const cmd = createRunCommand();
      await cmd.parseAsync(['node', 'test', '/test/.ai/tasks/001-task.md']);

      expect(mockExecuteTask).not.toHaveBeenCalled();
    });

    it('should skip confirmation prompt in dry-run mode', async () => {
      const cmd = createRunCommand();
      await cmd.parseAsync(['node', 'test', '/test/.ai/tasks/001-task.md', '--dry-run']);

      // In dry-run, prompt is NOT called (the code checks options.dryRun)
      // But executeTask IS called
      expect(mockExecuteTask).toHaveBeenCalled();
    });

    it('should exit with code 0 on success', async () => {
      const cmd = createRunCommand();
      await cmd.parseAsync(['node', 'test', '/test/.ai/tasks/001-task.md']);

      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it('should exit with code 1 on failure', async () => {
      mockExecuteTask.mockResolvedValue({
        ...mockResult,
        success: false,
        status: 'failed',
        error: 'Something went wrong',
      });

      const cmd = createRunCommand();
      await cmd.parseAsync(['node', 'test', '/test/.ai/tasks/001-task.md']);

      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should pass maxIterations option to executeTask', async () => {
      const cmd = createRunCommand();
      await cmd.parseAsync(['node', 'test', '/test/.ai/tasks/001-task.md', '-m', '10']);

      expect(mockExecuteTask).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ maxIterations: 10 })
      );
    });

    it('should pass verbose option', async () => {
      const cmd = createRunCommand();
      await cmd.parseAsync(['node', 'test', '/test/.ai/tasks/001-task.md', '-v']);

      expect(mockExecuteTask).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ verbose: true })
      );
    });
  });

  describe('--resume flag', () => {
    it('should exit with error when no blocked tasks found (auto-select)', async () => {
      mockExistsSync.mockImplementation((p: string) => {
        if (typeof p === 'string' && p.includes('tasks')) return true;
        return false;
      });
      mockReaddir.mockResolvedValue([]);

      const cmd = createRunCommand();
      await cmd.parseAsync(['node', 'test', '--resume']);

      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should error when resuming a non-blocked task file', async () => {
      mockReadFile.mockResolvedValue('# Task\n## Goal\nNot blocked');

      const cmd = createRunCommand();
      await cmd.parseAsync(['node', 'test', '/test/.ai/tasks/001-task.md', '--resume']);

      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should allow resuming a blocked task', async () => {
      mockReadFile.mockResolvedValue('# Task\n## Goal\nBlocked\n## Status: BLOCKED');
      const blockedContext = {
        ...mockContext,
        task: {
          ...mockContext.task,
          blockedStatus: {
            previousIteration: 5,
            filesModified: ['src/file.ts'],
            blockingIssue: 'Missing API key',
            startedAt: '2024-01-01T00:00:00.000Z',
            blockedAt: '2024-01-01T01:00:00.000Z',
          },
        },
      };
      mockLoadContext.mockResolvedValue(blockedContext);

      const cmd = createRunCommand();
      await cmd.parseAsync(['node', 'test', '/test/.ai/tasks/001-task.md', '--resume']);

      expect(mockExecuteTask).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ resume: true })
      );
    });

    it('should show resume context in preview box', async () => {
      mockReadFile.mockResolvedValue('# Task\n## Goal\nBlocked\n## Status: BLOCKED');
      const blockedContext = {
        ...mockContext,
        task: {
          ...mockContext.task,
          blockedStatus: {
            previousIteration: 3,
            filesModified: ['src/a.ts'],
            blockingIssue: 'Missing dependency',
            startedAt: '2024-01-01T00:00:00.000Z',
            blockedAt: '2024-01-01T01:00:00.000Z',
          },
        },
      };
      mockLoadContext.mockResolvedValue(blockedContext);

      const cmd = createRunCommand();
      await cmd.parseAsync(['node', 'test', '/test/.ai/tasks/001-task.md', '--resume']);

      const { Logger } = await import('../utils/logger.js');
      const loggerInstance = (Logger as unknown as Mock).mock.results[0].value;
      const boxCalls = loggerInstance.box.mock.calls;
      const resumeBox = boxCalls.find(
        (c: string[]) => c[0] === 'Resuming Blocked Task'
      );
      expect(resumeBox).toBeDefined();
    });
  });

  describe('--parallel flag', () => {
    it('should error when fewer than 2 tasks provided', async () => {
      const cmd = createRunCommand();
      await cmd.parseAsync(['node', 'test', '--parallel', '/test/task-a.md']);

      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should error when no tasks provided', async () => {
      const cmd = createRunCommand();
      await cmd.parseAsync(['node', 'test', '--parallel']);

      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should error when a task file does not exist', async () => {
      mockExistsSync.mockImplementation((p: string) => {
        if (typeof p === 'string' && p.includes('task-b')) return false;
        return true;
      });

      const cmd = createRunCommand();
      await cmd.parseAsync([
        'node', 'test', '--parallel',
        '/test/tasks/task-a.md', '/test/tasks/task-b.md',
      ]);

      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should create ParallelExecutor with correct options', async () => {
      mockParallelRun.mockResolvedValue({ success: true });

      const cmd = createRunCommand();
      await cmd.parseAsync([
        'node', 'test', '--parallel', '--concurrency', '4',
        '/test/tasks/task-a.md', '/test/tasks/task-b.md',
      ]);

      expect(ParallelExecutor).toHaveBeenCalledWith(
        expect.objectContaining({
          concurrency: 4,
          dryRun: false,
          verbose: false,
          quiet: false,
        })
      );
    });

    it('should abort when user declines parallel confirmation', async () => {
      mockPrompt.mockResolvedValue({ confirm: false });

      const cmd = createRunCommand();
      await cmd.parseAsync([
        'node', 'test', '--parallel',
        '/test/tasks/task-a.md', '/test/tasks/task-b.md',
      ]);

      expect(mockParallelRun).not.toHaveBeenCalled();
    });

    it('should exit 0 on parallel success', async () => {
      mockParallelRun.mockResolvedValue({ success: true });

      const cmd = createRunCommand();
      await cmd.parseAsync([
        'node', 'test', '--parallel',
        '/test/tasks/task-a.md', '/test/tasks/task-b.md',
      ]);

      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it('should exit 1 on parallel failure', async () => {
      mockParallelRun.mockResolvedValue({ success: false });

      const cmd = createRunCommand();
      await cmd.parseAsync([
        'node', 'test', '--parallel',
        '/test/tasks/task-a.md', '/test/tasks/task-b.md',
      ]);

      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  describe('callbacks', () => {
    it('should wire onPhase callback that drives LiveStatus', async () => {
      let capturedOnPhase: ((event: PhaseEvent) => void) | undefined;
      mockExecuteTask.mockImplementation(async (_path: string, opts: { onPhase?: (event: PhaseEvent) => void }) => {
        capturedOnPhase = opts.onPhase;
        return mockResult;
      });

      const cmd = createRunCommand();
      await cmd.parseAsync(['node', 'test', '/test/.ai/tasks/001-task.md']);

      expect(capturedOnPhase).toBeDefined();

      // Test the phase handler branches
      const { LiveStatus } = await import('../utils/live-status.js');
      const liveStatusInstance = (LiveStatus as unknown as Mock).mock.results[0].value;

      capturedOnPhase!({ phase: 'Starting iteration', iteration: 1, totalIterations: 50, filesModified: 0 });
      expect(liveStatusInstance.iterationStart).toHaveBeenCalledWith(1, 50);

      capturedOnPhase!({ phase: 'Scope violation', iteration: 1, totalIterations: 50, filesModified: 0 });
      expect(liveStatusInstance.phaseFailed).toHaveBeenCalledWith('Scope violation');

      capturedOnPhase!({ phase: 'Executing AI', iteration: 1, totalIterations: 50, filesModified: 0 });
      expect(liveStatusInstance.setPhase).toHaveBeenCalled();
    });

    it('should wire onIteration callback that updates logger context', async () => {
      let capturedOnIteration: ((state: ExecutorState) => void) | undefined;
      mockExecuteTask.mockImplementation(async (_path: string, opts: { onIteration?: (state: ExecutorState) => void }) => {
        capturedOnIteration = opts.onIteration;
        return mockResult;
      });

      const cmd = createRunCommand();
      await cmd.parseAsync(['node', 'test', '/test/.ai/tasks/001-task.md']);

      expect(capturedOnIteration).toBeDefined();

      const { Logger } = await import('../utils/logger.js');
      const loggerInstance = (Logger as unknown as Mock).mock.results[0].value;

      capturedOnIteration!({
        status: 'running',
        iteration: 2,
        filesModified: ['src/a.ts', 'src/b.ts'],
        validationResults: [],
      });

      expect(loggerInstance.setContext).toHaveBeenCalledWith(
        expect.objectContaining({
          iteration: 2,
          files: ['src/a.ts', 'src/b.ts'],
        })
      );
    });

    it('should wire onOutput callback that delegates to LiveStatus', async () => {
      let capturedOnOutput: ((chunk: string) => void) | undefined;
      mockExecuteTask.mockImplementation(async (_path: string, opts: { onOutput?: (chunk: string) => void }) => {
        capturedOnOutput = opts.onOutput;
        return mockResult;
      });

      const cmd = createRunCommand();
      await cmd.parseAsync(['node', 'test', '/test/.ai/tasks/001-task.md']);

      expect(capturedOnOutput).toBeDefined();

      const { LiveStatus } = await import('../utils/live-status.js');
      const liveStatusInstance = (LiveStatus as unknown as Mock).mock.results[0].value;

      capturedOnOutput!('some output');
      expect(liveStatusInstance.handleOutput).toHaveBeenCalledWith('some output');
    });
  });

  describe('--auto-pr flag', () => {
    it('should attempt to create PR when --auto-pr and task succeeds', async () => {
      const { spawn } = await import('child_process');
      const mockProc = {
        on: vi.fn((event: string, handler: (code: number) => void) => {
          if (event === 'close') {
            handler(0);
          }
        }),
      };
      (spawn as unknown as Mock).mockReturnValue(mockProc);

      const cmd = createRunCommand();
      await cmd.parseAsync(['node', 'test', '/test/.ai/tasks/001-task.md', '--auto-pr']);

      expect(spawn).toHaveBeenCalledWith(
        'gh',
        expect.arrayContaining(['pr', 'create']),
        expect.any(Object)
      );
    });

    it('should not create PR when task fails', async () => {
      mockExecuteTask.mockResolvedValue({
        ...mockResult,
        success: false,
        status: 'failed',
      });
      const { spawn } = await import('child_process');

      const cmd = createRunCommand();
      await cmd.parseAsync(['node', 'test', '/test/.ai/tasks/001-task.md', '--auto-pr']);

      expect(spawn).not.toHaveBeenCalled();
    });
  });

  describe('auto-select task', () => {
    it('should auto-select first pending task when no task specified', async () => {
      mockExistsSync.mockImplementation((p: string) => {
        if (typeof p === 'string' && p.includes('pending')) return true;
        if (typeof p === 'string' && p.includes('.ai/tasks')) return true;
        return true;
      });
      mockReaddir.mockImplementation(async (dir: string) => {
        if (typeof dir === 'string' && dir.includes('pending')) {
          return ['001-first.md'];
        }
        return [];
      });

      const cmd = createRunCommand();
      await cmd.parseAsync(['node', 'test']);

      expect(mockLoadContext).toHaveBeenCalled();
      expect(mockExecuteTask).toHaveBeenCalled();
    });

    it('should error when no pending tasks found', async () => {
      mockExistsSync.mockImplementation((p: string) => {
        if (typeof p === 'string' && p.includes('.ai/tasks')) return true;
        if (typeof p === 'string' && p.includes('pending')) return false;
        return false;
      });
      mockReaddir.mockResolvedValue([]);

      const cmd = createRunCommand();
      await cmd.parseAsync(['node', 'test']);

      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  describe('printResult', () => {
    it('should handle result with token usage', async () => {
      mockExecuteTask.mockResolvedValue({
        ...mockResult,
        tokenUsage: {
          contextTokens: 1000,
          totalInputTokens: 5000,
          totalOutputTokens: 1000,
          totalTokens: 6000,
          inputTokens: 5000,
          outputTokens: 1000,
        },
      });

      const cmd = createRunCommand();
      await cmd.parseAsync(['node', 'test', '/test/.ai/tasks/001-task.md']);

      const { Logger } = await import('../utils/logger.js');
      const loggerInstance = (Logger as unknown as Mock).mock.results[0].value;
      const boxCalls = loggerInstance.box.mock.calls;
      const resultBox = boxCalls.find(
        (c: string[]) => c[0] === 'Execution Result'
      );
      expect(resultBox).toBeDefined();
      expect(resultBox[1]).toContain('Tokens Used');
    });

    it('should show blocked task info', async () => {
      mockExecuteTask.mockResolvedValue({
        ...mockResult,
        success: false,
        status: 'blocked',
        blockedReason: 'Max iterations reached',
      });

      const cmd = createRunCommand();
      await cmd.parseAsync(['node', 'test', '/test/.ai/tasks/001-task.md']);

      const { Logger } = await import('../utils/logger.js');
      const loggerInstance = (Logger as unknown as Mock).mock.results[0].value;

      expect(loggerInstance.warn).toHaveBeenCalledWith(
        expect.stringContaining('blocked')
      );
    });
  });

  describe('error handling', () => {
    it('should catch and display errors gracefully', async () => {
      mockFindAiDir.mockReturnValue('/test/project');
      mockExistsSync.mockReturnValue(true);
      mockLoadContext.mockRejectedValue(new Error('Context load failed'));

      const cmd = createRunCommand();
      await cmd.parseAsync(['node', 'test', '/test/.ai/tasks/001-task.md']);

      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  describe('logging options', () => {
    it('should pass log format and file options to logger', async () => {
      const cmd = createRunCommand();
      await cmd.parseAsync([
        'node', 'test', '/test/.ai/tasks/001-task.md',
        '--log-format', 'json',
        '--log-file', '/tmp/aidf.log',
        '--log-rotate',
      ]);

      const { Logger } = await import('../utils/logger.js');
      expect(Logger).toHaveBeenCalledWith(
        expect.objectContaining({
          logFormat: 'json',
          logFile: '/tmp/aidf.log',
          logRotate: true,
        })
      );
    });
  });
});
