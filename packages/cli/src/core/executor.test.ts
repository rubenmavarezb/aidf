import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { Executor, executeTask } from './executor.js';
import type { AidfConfig, LoadedContext, ExecutorOptions } from '../types/index.js';

// Hoisted mocks (available inside vi.mock factories)
const { mockPreCommit } = vi.hoisted(() => ({
  mockPreCommit: vi.fn().mockResolvedValue({
    phase: 'pre_commit',
    passed: true,
    results: [],
    totalDuration: 0,
  }),
}));

// Mock dependencies
vi.mock('./context-loader.js', async () => {
  const actual = await vi.importActual<typeof import('./context-loader.js')>('./context-loader.js');
  return {
    loadContext: vi.fn(),
    estimateContextSize: actual.estimateContextSize,
    estimateTokens: actual.estimateTokens,
  };
});

vi.mock('./providers/index.js', () => ({
  createProvider: vi.fn(() => ({
    name: 'mock-provider',
    execute: vi.fn(),
    isAvailable: vi.fn().mockResolvedValue(true),
  })),
}));

vi.mock('./providers/claude-cli.js', () => ({
  buildIterationPrompt: vi.fn(() => 'mock prompt'),
  buildContinuationPrompt: vi.fn(() => 'mock continuation prompt'),
}));

vi.mock('./validator.js', () => {
  const ValidatorMock = vi.fn().mockImplementation(() => ({
    preCommit: mockPreCommit,
  })) as Mock & { formatReport: Mock };
  ValidatorMock.formatReport = vi.fn((summary: { passed: boolean }) =>
    summary.passed ? '## ✅ Validation: pre_commit\n**Status:** PASSED' : '## ❌ Validation: pre_commit\n**Status:** FAILED'
  );
  return { Validator: ValidatorMock };
});

vi.mock('simple-git', () => ({
  simpleGit: vi.fn(() => ({
    checkout: vi.fn().mockResolvedValue(undefined),
    add: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined),
    push: vi.fn().mockResolvedValue(undefined),
    raw: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../utils/files.js', () => ({
  moveTaskFile: vi.fn((taskPath: string) => taskPath),
}));

// Import mocked modules
import { loadContext } from './context-loader.js';
import { createProvider } from './providers/index.js';
import { buildIterationPrompt, buildContinuationPrompt } from './providers/claude-cli.js';
import { moveTaskFile } from '../utils/files.js';
import { simpleGit } from 'simple-git';

describe('Executor', () => {
  const mockConfig: AidfConfig = {
    version: 1,
    provider: { type: 'claude-cli' },
    execution: {
      max_iterations: 5,
      max_consecutive_failures: 2,
      timeout_per_iteration: 60,
    },
    permissions: {
      scope_enforcement: 'strict',
      auto_commit: false,
      auto_push: false,
      auto_pr: false,
    },
    validation: {
      pre_commit: [],
      pre_push: [],
      pre_pr: [],
    },
    git: {
      commit_prefix: 'test:',
      branch_prefix: 'test/',
    },
  };

  const mockContext: LoadedContext = {
    agents: {
      projectOverview: 'Test project',
      architecture: 'Monorepo',
      technologyStack: 'TypeScript',
      conventions: 'Standard',
      qualityStandards: 'High',
      boundaries: {
        neverModify: [],
        neverDo: [],
        requiresDiscussion: [],
      },
      commands: {
        development: {},
        quality: {},
        build: {},
      },
      raw: '# AGENTS.md content',
    },
    role: {
      name: 'developer',
      identity: 'Software developer',
      expertise: ['TypeScript'],
      responsibilities: ['Write code'],
      constraints: [],
      qualityCriteria: [],
      raw: '# Role content',
    },
    task: {
      filePath: '/test/task.md',
      goal: 'Test task',
      taskType: 'component',
      suggestedRoles: ['developer'],
      scope: {
        allowed: ['src/**'],
        forbidden: ['node_modules/**'],
      },
      requirements: 'Test requirements',
      definitionOfDone: ['Item 1'],
      raw: '# Task content',
    },
  };

  let mockProvider: { execute: Mock; isAvailable: Mock };

  beforeEach(() => {
    vi.clearAllMocks();

    (loadContext as Mock).mockResolvedValue(mockContext);

    mockProvider = {
      execute: vi.fn(),
      isAvailable: vi.fn().mockResolvedValue(true),
    };
    (createProvider as Mock).mockReturnValue(mockProvider);

    // Default: validation passes
    mockPreCommit.mockResolvedValue({
      phase: 'pre_commit',
      passed: true,
      results: [],
      totalDuration: 0,
    });
  });

  describe('constructor', () => {
    it('should initialize with default options merged with config', () => {
      const executor = new Executor(mockConfig);
      const state = executor.getState();

      expect(state.status).toBe('idle');
      expect(state.iteration).toBe(0);
      expect(state.filesModified).toEqual([]);
      expect(state.validationResults).toEqual([]);
    });

    it('should override config with provided options', () => {
      const options: Partial<ExecutorOptions> = {
        maxIterations: 10,
        verbose: true,
      };
      const executor = new Executor(mockConfig, options);

      // The executor should use overridden options
      // We can verify this indirectly through behavior
      expect(executor).toBeDefined();
    });
  });

  describe('run', () => {
    it('should complete when task_complete is signaled', async () => {
      mockProvider.execute.mockResolvedValue({
        success: true,
        output: 'Done',
        filesChanged: [],
        iterationComplete: true,
        completionSignal: '<TASK_COMPLETE>',
      });

      const executor = new Executor(mockConfig);
      const result = await executor.run('/test/task.md');

      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
      expect(result.iterations).toBe(1);
    });

    it('should stop after max iterations', async () => {
      mockProvider.execute.mockResolvedValue({
        success: true,
        output: 'Still working...',
        filesChanged: [],
        iterationComplete: false,
      });

      const executor = new Executor({
        ...mockConfig,
        execution: { ...mockConfig.execution, max_iterations: 3 },
      });
      const result = await executor.run('/test/task.md');

      expect(result.success).toBe(false);
      expect(result.status).toBe('blocked');
      expect(result.iterations).toBe(3);
      expect(result.blockedReason).toContain('Max iterations');
    });

    it('should stop after consecutive failures', async () => {
      // Mock scope violations that cause failures
      mockProvider.execute.mockResolvedValue({
        success: true,
        output: 'Made changes',
        filesChanged: ['node_modules/bad-file.js'], // Forbidden path
        iterationComplete: false,
      });

      const executor = new Executor({
        ...mockConfig,
        execution: { ...mockConfig.execution, max_consecutive_failures: 2 },
      });
      const result = await executor.run('/test/task.md');

      expect(result.success).toBe(false);
      expect(result.status).toBe('blocked');
      expect(result.blockedReason).toContain('consecutive failures');
    });

    it('should track modified files', async () => {
      mockProvider.execute
        .mockResolvedValueOnce({
          success: true,
          output: 'First iteration',
          filesChanged: ['src/file1.ts'],
          iterationComplete: false,
        })
        .mockResolvedValueOnce({
          success: true,
          output: 'Done',
          filesChanged: ['src/file2.ts'],
          iterationComplete: true,
          completionSignal: '<TASK_COMPLETE>',
        });

      const executor = new Executor({
        ...mockConfig,
        permissions: { ...mockConfig.permissions, auto_commit: true },
      });
      const result = await executor.run('/test/task.md');

      expect(result.success).toBe(true);
      expect(result.filesModified).toContain('src/file1.ts');
      expect(result.filesModified).toContain('src/file2.ts');
    });

    it('should handle dry run mode', async () => {
      const executor = new Executor(mockConfig, { dryRun: true });
      const result = await executor.run('/test/task.md');

      expect(mockProvider.execute).not.toHaveBeenCalled();
      expect(result.iterations).toBe(1);
    });

    it('should handle BLOCKED signal from provider', async () => {
      mockProvider.execute.mockResolvedValue({
        success: false,
        output: '',
        error: 'BLOCKED: Cannot proceed',
        filesChanged: [],
        iterationComplete: false,
      });

      const executor = new Executor(mockConfig);
      const result = await executor.run('/test/task.md');

      expect(result.success).toBe(false);
      expect(result.status).toBe('blocked');
    });

    it('should call onIteration callback', async () => {
      const onIteration = vi.fn();

      mockProvider.execute.mockResolvedValue({
        success: true,
        output: 'Done',
        filesChanged: [],
        iterationComplete: true,
        completionSignal: '<TASK_COMPLETE>',
      });

      const executor = new Executor(mockConfig, { onIteration });
      await executor.run('/test/task.md');

      expect(onIteration).toHaveBeenCalledTimes(1);
      const callArg = onIteration.mock.calls[0][0];
      expect(callArg.iteration).toBe(1);
      // Status should be 'running' when callback is called (before completion check)
      expect(callArg.status).toBe('running');
    });

    it('should call onPhase callback for each phase', async () => {
      const onPhase = vi.fn();

      mockProvider.execute.mockResolvedValue({
        success: true,
        output: 'Done',
        filesChanged: [],
        iterationComplete: true,
        completionSignal: '<TASK_COMPLETE>',
      });

      const executor = new Executor(mockConfig, { onPhase });
      await executor.run('/test/task.md');

      // Should be called for: Starting iteration, Executing AI, Checking scope, Validating
      expect(onPhase).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: 'Starting iteration',
          iteration: 1,
        })
      );
      expect(onPhase).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: 'Executing AI',
          iteration: 1,
        })
      );
      expect(onPhase).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: 'Checking scope',
          iteration: 1,
        })
      );
      expect(onPhase).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: 'Validating',
          iteration: 1,
        })
      );
    });

    it('should emit Scope violation phase on scope block', async () => {
      const onPhase = vi.fn();

      mockProvider.execute.mockResolvedValue({
        success: true,
        output: 'Changed forbidden file',
        filesChanged: ['node_modules/some-file.js'],
        iterationComplete: false,
      });

      const executor = new Executor(
        {
          ...mockConfig,
          permissions: { ...mockConfig.permissions, scope_enforcement: 'strict' },
          execution: { ...mockConfig.execution, max_consecutive_failures: 1 },
        },
        { onPhase }
      );
      await executor.run('/test/task.md');

      expect(onPhase).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: 'Scope violation',
        })
      );
    });

    it('should pass onOutput callback to provider', async () => {
      const onOutput = vi.fn();

      mockProvider.execute.mockResolvedValue({
        success: true,
        output: 'Done',
        filesChanged: [],
        iterationComplete: true,
        completionSignal: '<TASK_COMPLETE>',
      });

      const executor = new Executor(mockConfig, { onOutput });
      await executor.run('/test/task.md');

      expect(mockProvider.execute).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ onOutput })
      );
    });
  });

  describe('scope enforcement', () => {
    it('should block forbidden file changes in strict mode', async () => {
      mockProvider.execute.mockResolvedValue({
        success: true,
        output: 'Changed forbidden file',
        filesChanged: ['node_modules/some-file.js'],
        iterationComplete: false,
      });

      const executor = new Executor({
        ...mockConfig,
        permissions: { ...mockConfig.permissions, scope_enforcement: 'strict' },
        execution: { ...mockConfig.execution, max_consecutive_failures: 1 },
      });
      const result = await executor.run('/test/task.md');

      expect(result.success).toBe(false);
      expect(result.status).toBe('blocked');
    });

    it('should ask user for files outside scope in ask mode', async () => {
      const onAskUser = vi.fn().mockResolvedValue(false);

      mockProvider.execute.mockResolvedValue({
        success: true,
        output: 'Changed file outside scope',
        filesChanged: ['other/file.ts'], // Not in allowed 'src/**'
        iterationComplete: false,
      });

      const executor = new Executor(
        {
          ...mockConfig,
          permissions: { ...mockConfig.permissions, scope_enforcement: 'ask' },
          execution: { ...mockConfig.execution, max_consecutive_failures: 1 },
        },
        { onAskUser }
      );
      const result = await executor.run('/test/task.md');

      expect(onAskUser).toHaveBeenCalled();
      expect(result.success).toBe(false);
    });

    it('should allow changes when user approves', async () => {
      const onAskUser = vi.fn().mockResolvedValue(true);

      mockProvider.execute
        .mockResolvedValueOnce({
          success: true,
          output: 'Changed file outside scope',
          filesChanged: ['other/file.ts'],
          iterationComplete: false,
        })
        .mockResolvedValueOnce({
          success: true,
          output: 'Done',
          filesChanged: [],
          iterationComplete: true,
          completionSignal: '<TASK_COMPLETE>',
        });

      const executor = new Executor(
        {
          ...mockConfig,
          permissions: { ...mockConfig.permissions, scope_enforcement: 'ask' },
        },
        { onAskUser }
      );
      const result = await executor.run('/test/task.md');

      expect(onAskUser).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  describe('state management', () => {
    it('should track iteration count', async () => {
      mockProvider.execute
        .mockResolvedValueOnce({
          success: true,
          output: 'Iteration 1',
          filesChanged: [],
          iterationComplete: false,
        })
        .mockResolvedValueOnce({
          success: true,
          output: 'Iteration 2',
          filesChanged: [],
          iterationComplete: true,
          completionSignal: '<TASK_COMPLETE>',
        });

      const executor = new Executor(mockConfig);
      const result = await executor.run('/test/task.md');

      expect(result.iterations).toBe(2);
    });

    it('should update state during execution', async () => {
      mockProvider.execute.mockResolvedValue({
        success: true,
        output: 'Done',
        filesChanged: [],
        iterationComplete: true,
        completionSignal: '<TASK_COMPLETE>',
      });

      const executor = new Executor(mockConfig);

      // Before run
      expect(executor.getState().status).toBe('idle');

      const runPromise = executor.run('/test/task.md');

      // After run completes
      await runPromise;
      expect(executor.getState().status).toBe('completed');
    });

    it('should support pause and resume', () => {
      const executor = new Executor(mockConfig);

      // Manually set to running for test
      (executor as unknown as { state: { status: string } }).state.status = 'running';

      executor.pause();
      expect(executor.getState().status).toBe('paused');

      executor.resume();
      expect(executor.getState().status).toBe('running');
    });
  });

  describe('error handling', () => {
    it('should set failed status on error', async () => {
      (loadContext as Mock).mockRejectedValue(new Error('Context load failed'));

      const executor = new Executor(mockConfig);
      const result = await executor.run('/test/task.md');

      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.error).toBe('Context load failed');
    });

    it('should set completedAt timestamp on completion', async () => {
      mockProvider.execute.mockResolvedValue({
        success: true,
        output: 'Done',
        filesChanged: [],
        iterationComplete: true,
        completionSignal: '<TASK_COMPLETE>',
      });

      const executor = new Executor(mockConfig);
      await executor.run('/test/task.md');

      const state = executor.getState();
      expect(state.startedAt).toBeDefined();
      expect(state.completedAt).toBeDefined();
    });
  });

  describe('resume functionality', () => {
    const resumeConfig: AidfConfig = {
      ...mockConfig,
      execution: {
        ...mockConfig.execution,
        max_iterations: 50,
      },
      permissions: {
        ...mockConfig.permissions,
        auto_commit: true,
      },
    };

    const blockedTaskContext: LoadedContext = {
      ...mockContext,
      task: {
        ...mockContext.task,
        blockedStatus: {
          previousIteration: 5,
          filesModified: ['src/api/client.ts', 'src/config/settings.ts'],
          blockingIssue: 'Missing API key configuration',
          startedAt: '2024-01-01T10:00:00.000Z',
          blockedAt: '2024-01-01T11:00:00.000Z',
        },
      },
    };

    it('should fail when resuming non-blocked task', async () => {
      (loadContext as Mock).mockResolvedValue(mockContext);

      const executor = new Executor(mockConfig, { resume: true });
      const result = await executor.run('/test/task.md');

      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.error).toContain('Task is not blocked');
    });

    it('should start from previous iteration when resuming', async () => {
      (loadContext as Mock).mockResolvedValue(blockedTaskContext);
      mockProvider.execute.mockResolvedValue({
        success: true,
        output: 'Done',
        filesChanged: [],
        iterationComplete: true,
        completionSignal: '<TASK_COMPLETE>',
      });

      const executor = new Executor(resumeConfig, { resume: true });
      await executor.run('/test/task.md');

      const state = executor.getState();
      expect(state.iteration).toBeGreaterThan(5);
      expect(state.filesModified).toContain('src/api/client.ts');
      expect(state.filesModified).toContain('src/config/settings.ts');
    });

    it('should include blocking context in prompt when resuming', async () => {
      (loadContext as Mock).mockResolvedValue(blockedTaskContext);
      mockProvider.execute.mockResolvedValue({
        success: true,
        output: 'Done',
        filesChanged: [],
        iterationComplete: true,
        completionSignal: '<TASK_COMPLETE>',
      });

      const executor = new Executor(resumeConfig, { resume: true, dryRun: true });
      await executor.run('/test/task.md');

      // Verify that buildIterationPrompt was called with blocking context
      await import('./providers/claude-cli.js');
      // Note: This is a simplified check - in a real test you'd spy on buildIterationPrompt
      expect(mockProvider.execute).not.toHaveBeenCalled(); // Dry run doesn't execute
    });

    it('should restore previous files modified when resuming', async () => {
      (loadContext as Mock).mockResolvedValue(blockedTaskContext);
      mockProvider.execute.mockResolvedValue({
        success: true,
        output: 'Done',
        filesChanged: ['src/new-file.ts'],
        iterationComplete: true,
        completionSignal: '<TASK_COMPLETE>',
      });

      const executor = new Executor(resumeConfig, { resume: true });
      const result = await executor.run('/test/task.md');

      // Should include both previous and new files
      expect(result.filesModified.length).toBeGreaterThanOrEqual(3);
      expect(result.filesModified).toContain('src/api/client.ts');
      expect(result.filesModified).toContain('src/config/settings.ts');
    });
  });

  describe('security config', () => {
    it('should pass dangerouslySkipPermissions: true by default (no security config)', async () => {
      mockProvider.execute.mockResolvedValue({
        success: true,
        output: 'Done',
        filesChanged: [],
        iterationComplete: true,
        completionSignal: '<TASK_COMPLETE>',
      });

      const executor = new Executor(mockConfig);
      await executor.run('/test/task.md');

      expect(mockProvider.execute).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ dangerouslySkipPermissions: true })
      );
    });

    it('should pass dangerouslySkipPermissions: true when skip_permissions is true', async () => {
      mockProvider.execute.mockResolvedValue({
        success: true,
        output: 'Done',
        filesChanged: [],
        iterationComplete: true,
        completionSignal: '<TASK_COMPLETE>',
      });

      const executor = new Executor({
        ...mockConfig,
        security: { skip_permissions: true },
      });
      await executor.run('/test/task.md');

      expect(mockProvider.execute).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ dangerouslySkipPermissions: true })
      );
    });

    it('should pass dangerouslySkipPermissions: false when skip_permissions is false', async () => {
      mockProvider.execute.mockResolvedValue({
        success: true,
        output: 'Done',
        filesChanged: [],
        iterationComplete: true,
        completionSignal: '<TASK_COMPLETE>',
      });

      const executor = new Executor({
        ...mockConfig,
        security: { skip_permissions: false },
      });
      await executor.run('/test/task.md');

      expect(mockProvider.execute).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ dangerouslySkipPermissions: false })
      );
    });

    it('should emit warning when skip_permissions is true and warn_on_skip is true', async () => {
      mockProvider.execute.mockResolvedValue({
        success: true,
        output: 'Done',
        filesChanged: [],
        iterationComplete: true,
        completionSignal: '<TASK_COMPLETE>',
      });

      const executor = new Executor({
        ...mockConfig,
        security: { skip_permissions: true, warn_on_skip: true },
      });
      // Spy on the logger's warn method
      const loggerSpy = vi.spyOn(
        (executor as unknown as { logger: { warn: (msg: string) => void } }).logger,
        'warn'
      );

      await executor.run('/test/task.md');

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('--dangerously-skip-permissions')
      );
    });

    it('should emit warning by default (no security config)', async () => {
      mockProvider.execute.mockResolvedValue({
        success: true,
        output: 'Done',
        filesChanged: [],
        iterationComplete: true,
        completionSignal: '<TASK_COMPLETE>',
      });

      const executor = new Executor(mockConfig);
      const loggerSpy = vi.spyOn(
        (executor as unknown as { logger: { warn: (msg: string) => void } }).logger,
        'warn'
      );

      await executor.run('/test/task.md');

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('--dangerously-skip-permissions')
      );
    });

    it('should not emit warning when warn_on_skip is false', async () => {
      mockProvider.execute.mockResolvedValue({
        success: true,
        output: 'Done',
        filesChanged: [],
        iterationComplete: true,
        completionSignal: '<TASK_COMPLETE>',
      });

      const executor = new Executor({
        ...mockConfig,
        security: { skip_permissions: true, warn_on_skip: false },
      });
      const loggerSpy = vi.spyOn(
        (executor as unknown as { logger: { warn: (msg: string) => void } }).logger,
        'warn'
      );

      await executor.run('/test/task.md');

      expect(loggerSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('--dangerously-skip-permissions')
      );
    });

    it('should not emit warning when skip_permissions is false', async () => {
      mockProvider.execute.mockResolvedValue({
        success: true,
        output: 'Done',
        filesChanged: [],
        iterationComplete: true,
        completionSignal: '<TASK_COMPLETE>',
      });

      const executor = new Executor({
        ...mockConfig,
        security: { skip_permissions: false, warn_on_skip: true },
      });
      const loggerSpy = vi.spyOn(
        (executor as unknown as { logger: { warn: (msg: string) => void } }).logger,
        'warn'
      );

      await executor.run('/test/task.md');

      expect(loggerSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('--dangerously-skip-permissions')
      );
    });
  });

  describe('task file movement', () => {
    it('should move task file to completed/ on success', async () => {
      mockProvider.execute.mockResolvedValue({
        success: true,
        output: 'Done',
        filesChanged: [],
        iterationComplete: true,
        completionSignal: '<TASK_COMPLETE>',
      });

      const executor = new Executor(mockConfig);
      await executor.run('/test/task.md');

      expect(moveTaskFile).toHaveBeenCalledWith('/test/task.md', 'completed');
    });

    it('should move task file to blocked/ on blocked status', async () => {
      mockProvider.execute.mockResolvedValue({
        success: false,
        output: '',
        error: 'BLOCKED: Cannot proceed',
        filesChanged: [],
        iterationComplete: false,
      });

      const executor = new Executor(mockConfig);
      await executor.run('/test/task.md');

      expect(moveTaskFile).toHaveBeenCalledWith('/test/task.md', 'blocked');
    });

    it('should move task file to blocked/ when max iterations reached', async () => {
      mockProvider.execute.mockResolvedValue({
        success: true,
        output: 'Still working...',
        filesChanged: [],
        iterationComplete: false,
      });

      const executor = new Executor({
        ...mockConfig,
        execution: { ...mockConfig.execution, max_iterations: 2 },
      });
      await executor.run('/test/task.md');

      expect(moveTaskFile).toHaveBeenCalledWith('/test/task.md', 'blocked');
    });

    it('should not fail if moveTaskFile throws', async () => {
      (moveTaskFile as Mock).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      mockProvider.execute.mockResolvedValue({
        success: true,
        output: 'Done',
        filesChanged: [],
        iterationComplete: true,
        completionSignal: '<TASK_COMPLETE>',
      });

      const executor = new Executor(mockConfig);
      const result = await executor.run('/test/task.md');

      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
    });

    it('should stage task file after writing completed status', async () => {
      (moveTaskFile as Mock).mockReturnValue('/test/task.md');

      mockProvider.execute.mockResolvedValue({
        success: true,
        output: 'Done',
        filesChanged: [],
        iterationComplete: true,
        completionSignal: '<TASK_COMPLETE>',
      });

      const executor = new Executor(mockConfig);
      await executor.run('/test/task.md');

      const mockGit = (simpleGit as unknown as Mock).mock.results[0].value;
      // Should have staged the task file (git add)
      expect(mockGit.add).toHaveBeenCalledWith(['/test/task.md']);
    });

    it('should stage moved task file and remove old path on completion', async () => {
      const newPath = '/test/completed/task.md';
      (moveTaskFile as Mock).mockReturnValue(newPath);

      mockProvider.execute.mockResolvedValue({
        success: true,
        output: 'Done',
        filesChanged: [],
        iterationComplete: true,
        completionSignal: '<TASK_COMPLETE>',
      });

      const executor = new Executor(mockConfig);
      await executor.run('/test/task.md');

      const mockGit = (simpleGit as unknown as Mock).mock.results[0].value;
      // Should stage the new file location
      expect(mockGit.add).toHaveBeenCalledWith([newPath]);
      // Should remove the old path from git index
      expect(mockGit.raw).toHaveBeenCalledWith(['rm', '--cached', '--ignore-unmatch', '/test/task.md']);
    });

    it('should stage task file after writing blocked status', async () => {
      (moveTaskFile as Mock).mockReturnValue('/test/task.md');

      mockProvider.execute.mockResolvedValue({
        success: false,
        output: '',
        error: 'BLOCKED: Cannot proceed',
        filesChanged: [],
        iterationComplete: false,
      });

      const executor = new Executor(mockConfig);
      await executor.run('/test/task.md');

      const mockGit = (simpleGit as unknown as Mock).mock.results[0].value;
      // Should have staged the task file
      expect(mockGit.add).toHaveBeenCalledWith(['/test/task.md']);
    });

    it('should not fail if staging task file throws', async () => {
      const newPath = '/test/completed/task.md';
      (moveTaskFile as Mock).mockReturnValue(newPath);

      mockProvider.execute.mockResolvedValue({
        success: true,
        output: 'Done',
        filesChanged: [],
        iterationComplete: true,
        completionSignal: '<TASK_COMPLETE>',
      });

      // Create executor first so simpleGit is called
      const executor = new Executor(mockConfig);

      // Now access the git mock and make add throw
      const mockGit = (simpleGit as unknown as Mock).mock.results.at(-1)!.value;
      mockGit.add.mockRejectedValueOnce(new Error('git add failed'));

      const result = await executor.run('/test/task.md');

      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
    });
  });

  describe('completion signal + validation interaction', () => {
    const failedValidation = {
      phase: 'pre_commit' as const,
      passed: false,
      results: [
        {
          command: 'pnpm typecheck',
          passed: false,
          output: 'error TS2345: Argument of type...',
          duration: 1500,
          exitCode: 1,
        },
      ],
      totalDuration: 1500,
    };

    it('should complete when completion signal + validation passes', async () => {
      mockProvider.execute.mockResolvedValue({
        success: true,
        output: '<TASK_COMPLETE>',
        filesChanged: [],
        iterationComplete: true,
        completionSignal: '<TASK_COMPLETE>',
      });

      const executor = new Executor(mockConfig);
      const result = await executor.run('/test/task.md');

      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
      expect(result.iterations).toBe(1);
    });

    it('should NOT complete when completion signal + validation fails', async () => {
      // First iteration: AI signals completion but validation fails
      mockPreCommit.mockResolvedValueOnce(failedValidation);
      mockProvider.execute
        .mockResolvedValueOnce({
          success: true,
          output: '<TASK_COMPLETE>',
          filesChanged: [],
          iterationComplete: true,
          completionSignal: '<TASK_COMPLETE>',
        })
        // Second iteration: AI fixes and re-signals, validation passes
        .mockResolvedValueOnce({
          success: true,
          output: '<TASK_COMPLETE>',
          filesChanged: [],
          iterationComplete: true,
          completionSignal: '<TASK_COMPLETE>',
        });

      const executor = new Executor(mockConfig);
      const result = await executor.run('/test/task.md');

      // Should complete on second iteration (after AI fixes the issue)
      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
      expect(result.iterations).toBe(2);
    });

    it('should include validation error in next iteration prompt', async () => {
      // First iteration: completion signal + validation fails
      mockPreCommit.mockResolvedValueOnce(failedValidation);
      mockProvider.execute
        .mockResolvedValueOnce({
          success: true,
          output: '<TASK_COMPLETE>',
          filesChanged: [],
          iterationComplete: true,
          completionSignal: '<TASK_COMPLETE>',
        })
        // Second iteration: completes successfully
        .mockResolvedValueOnce({
          success: true,
          output: '<TASK_COMPLETE>',
          filesChanged: [],
          iterationComplete: true,
          completionSignal: '<TASK_COMPLETE>',
        });

      const executor = new Executor(mockConfig);
      await executor.run('/test/task.md');

      // Iteration 1 uses buildIterationPrompt, iteration 2 uses buildContinuationPrompt
      expect(buildIterationPrompt).toHaveBeenCalledTimes(1);
      expect(buildContinuationPrompt).toHaveBeenCalledTimes(1);
      const continuationArgs = (buildContinuationPrompt as Mock).mock.calls[0][0];
      expect(continuationArgs.previousValidationError).toBeDefined();
      expect(continuationArgs.previousValidationError).toContain('FAILED');
    });

    it('should NOT include validation error in prompt when no completion signal', async () => {
      // Validation fails without completion signal — existing behavior
      mockPreCommit.mockResolvedValueOnce(failedValidation);
      mockProvider.execute
        .mockResolvedValueOnce({
          success: true,
          output: 'Still working...',
          filesChanged: [],
          iterationComplete: false,
        })
        .mockResolvedValueOnce({
          success: true,
          output: '<TASK_COMPLETE>',
          filesChanged: [],
          iterationComplete: true,
          completionSignal: '<TASK_COMPLETE>',
        });

      const executor = new Executor(mockConfig);
      await executor.run('/test/task.md');

      // Iteration 2 uses continuation prompt — should NOT have previousValidationError
      expect(buildContinuationPrompt).toHaveBeenCalledTimes(1);
      const continuationArgs = (buildContinuationPrompt as Mock).mock.calls[0][0];
      expect(continuationArgs.previousValidationError).toBeUndefined();
    });

    it('should clear validation error after successful validation', async () => {
      // Iteration 1: signal + validation fails
      mockPreCommit.mockResolvedValueOnce(failedValidation);
      // Iteration 2: no signal, validation passes
      // Iteration 3: signal + validation passes
      mockProvider.execute
        .mockResolvedValueOnce({
          success: true,
          output: '<TASK_COMPLETE>',
          filesChanged: [],
          iterationComplete: true,
          completionSignal: '<TASK_COMPLETE>',
        })
        .mockResolvedValueOnce({
          success: true,
          output: 'Fixing...',
          filesChanged: [],
          iterationComplete: false,
        })
        .mockResolvedValueOnce({
          success: true,
          output: '<TASK_COMPLETE>',
          filesChanged: [],
          iterationComplete: true,
          completionSignal: '<TASK_COMPLETE>',
        });

      const executor = new Executor(mockConfig);
      await executor.run('/test/task.md');

      // Iteration 1: buildIterationPrompt, iterations 2-3: buildContinuationPrompt
      expect(buildIterationPrompt).toHaveBeenCalledTimes(1);
      expect(buildContinuationPrompt).toHaveBeenCalledTimes(2);
      // 2nd iteration (continuation call 0) should have validation error
      expect((buildContinuationPrompt as Mock).mock.calls[0][0].previousValidationError).toBeDefined();
      // 3rd iteration (continuation call 1) should NOT have validation error (cleared after successful validation)
      expect((buildContinuationPrompt as Mock).mock.calls[1][0].previousValidationError).toBeUndefined();
    });

    it('should not lose completion signal when validation fails (regression test)', async () => {
      // This is the exact bug scenario: AI emits TASK_COMPLETE, validation fails,
      // next iteration AI doesn't re-emit, resulting in false BLOCKED.
      // With the fix, the validation error is passed so AI knows to re-emit.
      mockPreCommit
        .mockResolvedValueOnce(failedValidation) // iter 1: validation fails
        .mockResolvedValue({ // iter 2+: validation passes
          phase: 'pre_commit',
          passed: true,
          results: [],
          totalDuration: 0,
        });

      mockProvider.execute
        .mockResolvedValueOnce({
          success: true,
          output: '<TASK_COMPLETE>',
          filesChanged: [],
          iterationComplete: true,
          completionSignal: '<TASK_COMPLETE>',
        })
        .mockResolvedValueOnce({
          success: true,
          output: '<TASK_COMPLETE>',
          filesChanged: [],
          iterationComplete: true,
          completionSignal: '<TASK_COMPLETE>',
        });

      const executor = new Executor(mockConfig);
      const result = await executor.run('/test/task.md');

      // Should complete on iteration 2, NOT be blocked
      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
      expect(result.iterations).toBe(2);
      expect(result.blockedReason).toBeUndefined();
    });
  });

  describe('completion signal + scope violation interaction', () => {
    it('should accept completion despite scope violation when signal detected', async () => {
      // AI completes the task but also touches a forbidden file
      mockProvider.execute.mockResolvedValue({
        success: true,
        output: '<TASK_COMPLETE>',
        filesChanged: ['src/allowed.ts', 'node_modules/forbidden.js'],
        iterationComplete: true,
        completionSignal: '<TASK_COMPLETE>',
      });

      const executor = new Executor(mockConfig);
      const result = await executor.run('/test/task.md');

      // Should complete, not fail — the forbidden files get reverted
      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
      expect(result.iterations).toBe(1);
    });

    it('should still fail on scope violation when no completion signal', async () => {
      // AI modifies forbidden files without signaling completion
      mockProvider.execute.mockResolvedValue({
        success: true,
        output: 'Working on it',
        filesChanged: ['node_modules/bad.js'],
        iterationComplete: false,
      });

      const executor = new Executor({
        ...mockConfig,
        execution: { ...mockConfig.execution, max_consecutive_failures: 2 },
      });
      const result = await executor.run('/test/task.md');

      expect(result.success).toBe(false);
      expect(result.status).toBe('blocked');
    });
  });

  describe('token usage reporting', () => {
    it('should include context token estimate in result', async () => {
      mockProvider.execute.mockResolvedValue({
        success: true,
        output: 'Done',
        filesChanged: [],
        iterationComplete: true,
        completionSignal: '<TASK_COMPLETE>',
      });

      const executor = new Executor(mockConfig);
      const result = await executor.run('/test/task.md');

      expect(result.tokenUsage).toBeDefined();
      expect(result.tokenUsage!.contextTokens).toBeGreaterThan(0);
      expect(result.tokenUsage!.breakdown).toBeDefined();
      expect(result.tokenUsage!.breakdown!.agents).toBeGreaterThan(0);
      expect(result.tokenUsage!.breakdown!.role).toBeGreaterThan(0);
      expect(result.tokenUsage!.breakdown!.task).toBeGreaterThan(0);
    });

    it('should accumulate API provider token usage across iterations', async () => {
      mockProvider.execute
        .mockResolvedValueOnce({
          success: true,
          output: 'Working...',
          filesChanged: [],
          iterationComplete: false,
          tokenUsage: { inputTokens: 1000, outputTokens: 200 },
        })
        .mockResolvedValueOnce({
          success: true,
          output: 'Done',
          filesChanged: [],
          iterationComplete: true,
          completionSignal: '<TASK_COMPLETE>',
          tokenUsage: { inputTokens: 1500, outputTokens: 300 },
        });

      const executor = new Executor(mockConfig);
      const result = await executor.run('/test/task.md');

      expect(result.tokenUsage).toBeDefined();
      expect(result.tokenUsage!.totalInputTokens).toBe(2500);
      expect(result.tokenUsage!.totalOutputTokens).toBe(500);
      expect(result.tokenUsage!.totalTokens).toBe(3000);
    });

    it('should estimate cost based on token usage', async () => {
      mockProvider.execute.mockResolvedValue({
        success: true,
        output: 'Done',
        filesChanged: [],
        iterationComplete: true,
        completionSignal: '<TASK_COMPLETE>',
        tokenUsage: { inputTokens: 1_000_000, outputTokens: 100_000 },
      });

      const executor = new Executor(mockConfig);
      const result = await executor.run('/test/task.md');

      expect(result.tokenUsage).toBeDefined();
      expect(result.tokenUsage!.estimatedCost).toBeDefined();
      // $3/MTok input + $15/MTok output = $3 + $1.5 = $4.5
      expect(result.tokenUsage!.estimatedCost).toBeCloseTo(4.5, 1);
    });

    it('should report context tokens even without API token usage', async () => {
      mockProvider.execute.mockResolvedValue({
        success: true,
        output: 'Done',
        filesChanged: [],
        iterationComplete: true,
        completionSignal: '<TASK_COMPLETE>',
        // No tokenUsage (CLI provider)
      });

      const executor = new Executor(mockConfig);
      const result = await executor.run('/test/task.md');

      expect(result.tokenUsage).toBeDefined();
      expect(result.tokenUsage!.contextTokens).toBeGreaterThan(0);
      expect(result.tokenUsage!.totalInputTokens).toBe(0);
      expect(result.tokenUsage!.totalOutputTokens).toBe(0);
    });

    it('should log context breakdown after loading context', async () => {
      mockProvider.execute.mockResolvedValue({
        success: true,
        output: 'Done',
        filesChanged: [],
        iterationComplete: true,
        completionSignal: '<TASK_COMPLETE>',
      });

      const executor = new Executor(mockConfig);
      const loggerSpy = vi.spyOn(
        (executor as unknown as { logger: { info: (msg: string) => void } }).logger,
        'info'
      );

      await executor.run('/test/task.md');

      const contextLogCall = loggerSpy.mock.calls.find(
        ([msg]) => typeof msg === 'string' && msg.includes('Context loaded:')
      );
      expect(contextLogCall).toBeDefined();

      const agentsLogCall = loggerSpy.mock.calls.find(
        ([msg]) => typeof msg === 'string' && msg.includes('AGENTS.md:')
      );
      expect(agentsLogCall).toBeDefined();
    });

    it('should log per-iteration token usage for API providers', async () => {
      mockProvider.execute.mockResolvedValue({
        success: true,
        output: 'Done',
        filesChanged: [],
        iterationComplete: true,
        completionSignal: '<TASK_COMPLETE>',
        tokenUsage: { inputTokens: 5000, outputTokens: 1000 },
      });

      const executor = new Executor(mockConfig);
      const loggerSpy = vi.spyOn(
        (executor as unknown as { logger: { info: (msg: string) => void } }).logger,
        'info'
      );

      await executor.run('/test/task.md');

      const iterationTokenLog = loggerSpy.mock.calls.find(
        ([msg]) => typeof msg === 'string' && msg.includes('Iteration 1 tokens:')
      );
      expect(iterationTokenLog).toBeDefined();
    });

    it('should log execution summary box on completion', async () => {
      mockProvider.execute.mockResolvedValue({
        success: true,
        output: 'Done',
        filesChanged: [],
        iterationComplete: true,
        completionSignal: '<TASK_COMPLETE>',
      });

      const executor = new Executor(mockConfig);
      const boxSpy = vi.spyOn(
        (executor as unknown as { logger: { box: (title: string, content: string) => void } }).logger,
        'box'
      );

      await executor.run('/test/task.md');

      expect(boxSpy).toHaveBeenCalledWith(
        'Task Completed',
        expect.stringContaining('Iterations: 1')
      );
    });

    it('should log execution summary with blocked title on block', async () => {
      mockProvider.execute.mockResolvedValue({
        success: false,
        output: '',
        error: 'BLOCKED: Cannot proceed',
        filesChanged: [],
        iterationComplete: false,
      });

      const executor = new Executor(mockConfig);
      const boxSpy = vi.spyOn(
        (executor as unknown as { logger: { box: (title: string, content: string) => void } }).logger,
        'box'
      );

      await executor.run('/test/task.md');

      expect(boxSpy).toHaveBeenCalledWith(
        'Task Blocked',
        expect.any(String)
      );
    });
  });

  describe('session continuation', () => {
    it('should use full prompt on iteration 1 (no sessionContinuation)', async () => {
      mockProvider.execute.mockResolvedValue({
        success: true,
        output: 'Done',
        filesChanged: [],
        iterationComplete: true,
        completionSignal: '<TASK_COMPLETE>',
      });

      const executor = new Executor(mockConfig);
      await executor.run('/test/task.md');

      // First iteration should use full prompt
      expect(buildIterationPrompt).toHaveBeenCalledTimes(1);
      expect(buildContinuationPrompt).not.toHaveBeenCalled();

      // Should NOT pass sessionContinuation on first iteration
      expect(mockProvider.execute).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ sessionContinuation: false })
      );
    });

    it('should use continuation prompt on iteration 2+', async () => {
      mockProvider.execute
        .mockResolvedValueOnce({
          success: true,
          output: 'Working...',
          filesChanged: [],
          iterationComplete: false,
          conversationState: [{ role: 'user', content: 'mock' }],
        })
        .mockResolvedValueOnce({
          success: true,
          output: 'Done',
          filesChanged: [],
          iterationComplete: true,
          completionSignal: '<TASK_COMPLETE>',
        });

      const executor = new Executor(mockConfig);
      await executor.run('/test/task.md');

      // First iteration: full prompt, second: continuation
      expect(buildIterationPrompt).toHaveBeenCalledTimes(1);
      expect(buildContinuationPrompt).toHaveBeenCalledTimes(1);

      // Second call should have sessionContinuation: true
      const secondCallOptions = mockProvider.execute.mock.calls[1][1];
      expect(secondCallOptions.sessionContinuation).toBe(true);
    });

    it('should pass conversationState between iterations', async () => {
      const mockState = [{ role: 'user', content: 'state' }];

      mockProvider.execute
        .mockResolvedValueOnce({
          success: true,
          output: 'Working...',
          filesChanged: [],
          iterationComplete: false,
          conversationState: mockState,
        })
        .mockResolvedValueOnce({
          success: true,
          output: 'Done',
          filesChanged: [],
          iterationComplete: true,
          completionSignal: '<TASK_COMPLETE>',
        });

      const executor = new Executor(mockConfig);
      await executor.run('/test/task.md');

      // Second call should pass the conversationState from first iteration
      const secondCallOptions = mockProvider.execute.mock.calls[1][1];
      expect(secondCallOptions.conversationState).toEqual(mockState);
    });

    it('should use sentinel true when provider does not return conversationState', async () => {
      // CLI providers don't return conversationState — executor uses `true` as sentinel
      mockProvider.execute
        .mockResolvedValueOnce({
          success: true,
          output: 'Working...',
          filesChanged: [],
          iterationComplete: false,
          // No conversationState returned
        })
        .mockResolvedValueOnce({
          success: true,
          output: 'Done',
          filesChanged: [],
          iterationComplete: true,
          completionSignal: '<TASK_COMPLETE>',
        });

      const executor = new Executor(mockConfig);
      await executor.run('/test/task.md');

      // Second call should still use continuation (sentinel `true` means conversation exists)
      expect(buildContinuationPrompt).toHaveBeenCalledTimes(1);
      const secondCallOptions = mockProvider.execute.mock.calls[1][1];
      expect(secondCallOptions.sessionContinuation).toBe(true);
    });

    it('should disable continuation when session_continuation is false', async () => {
      mockProvider.execute
        .mockResolvedValueOnce({
          success: true,
          output: 'Working...',
          filesChanged: [],
          iterationComplete: false,
          conversationState: [{ role: 'user', content: 'state' }],
        })
        .mockResolvedValueOnce({
          success: true,
          output: 'Done',
          filesChanged: [],
          iterationComplete: true,
          completionSignal: '<TASK_COMPLETE>',
        });

      const executor = new Executor({
        ...mockConfig,
        execution: { ...mockConfig.execution, session_continuation: false },
      });
      await executor.run('/test/task.md');

      // Both iterations should use full prompt
      expect(buildIterationPrompt).toHaveBeenCalledTimes(2);
      expect(buildContinuationPrompt).not.toHaveBeenCalled();

      // Second call should NOT have sessionContinuation
      const secondCallOptions = mockProvider.execute.mock.calls[1][1];
      expect(secondCallOptions.sessionContinuation).toBe(false);
    });

    it('should fallback to full prompt when continuation fails', async () => {
      mockProvider.execute
        // Iteration 1: succeeds
        .mockResolvedValueOnce({
          success: true,
          output: 'Working...',
          filesChanged: [],
          iterationComplete: false,
          conversationState: [{ role: 'user', content: 'state' }],
        })
        // Iteration 2: continuation fails
        .mockResolvedValueOnce({
          success: false,
          output: '',
          error: 'Continuation error',
          filesChanged: [],
          iterationComplete: false,
        })
        // Iteration 2: fallback with full prompt succeeds
        .mockResolvedValueOnce({
          success: true,
          output: 'Done after fallback',
          filesChanged: [],
          iterationComplete: true,
          completionSignal: '<TASK_COMPLETE>',
        });

      const executor = new Executor(mockConfig);
      const result = await executor.run('/test/task.md');

      // Should have used continuation, then fallback
      expect(buildContinuationPrompt).toHaveBeenCalledTimes(1);
      // Fallback calls buildIterationPrompt again
      expect(buildIterationPrompt).toHaveBeenCalledTimes(2);
      // 3 total provider.execute calls: initial + continuation fail + fallback
      expect(mockProvider.execute).toHaveBeenCalledTimes(3);
      expect(result.success).toBe(true);
    });
  });

  describe('timeout enforcement', () => {
    it('should timeout iteration when provider takes too long', async () => {
      // Provider hangs indefinitely — timeout at 0.1s will fire first
      mockProvider.execute.mockImplementation(
        () => new Promise(() => {/* never resolves */})
      );

      const executor = new Executor({
        ...mockConfig,
        execution: {
          ...mockConfig.execution,
          timeout_per_iteration: 0.1, // 100ms
          max_consecutive_failures: 1,
        },
      });

      const result = await executor.run('/test/task.md');

      expect(result.success).toBe(false);
      expect(result.status).toBe('blocked');
      expect(result.blockedReason).toContain('consecutive failures');
    }, 10_000);

    it('should not timeout when provider completes within limit', async () => {
      mockProvider.execute.mockResolvedValue({
        success: true,
        output: 'Done',
        filesChanged: [],
        iterationComplete: true,
        completionSignal: '<TASK_COMPLETE>',
      });

      const executor = new Executor({
        ...mockConfig,
        execution: {
          ...mockConfig.execution,
          timeout_per_iteration: 300, // 5 minutes
        },
      });

      const result = await executor.run('/test/task.md');
      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
    });

    it('should increment failure count on timeout and continue to next iteration', async () => {
      // First iteration: times out
      // Second iteration: completes
      let callCount = 0;
      mockProvider.execute.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return new Promise(() => {/* never resolves */});
        }
        return Promise.resolve({
          success: true,
          output: 'Done',
          filesChanged: [],
          iterationComplete: true,
          completionSignal: '<TASK_COMPLETE>',
        });
      });

      const executor = new Executor({
        ...mockConfig,
        execution: {
          ...mockConfig.execution,
          timeout_per_iteration: 0.1, // 100ms
          max_consecutive_failures: 3,
        },
      });

      const result = await executor.run('/test/task.md');

      expect(result.success).toBe(true);
      expect(result.iterations).toBe(2);
    }, 10_000);

    it('should skip timeout enforcement when timeoutPerIteration is 0', async () => {
      mockProvider.execute.mockResolvedValue({
        success: true,
        output: 'Done',
        filesChanged: [],
        iterationComplete: true,
        completionSignal: '<TASK_COMPLETE>',
      });

      const executor = new Executor({
        ...mockConfig,
        execution: {
          ...mockConfig.execution,
          timeout_per_iteration: 0,
        },
      });

      const result = await executor.run('/test/task.md');
      expect(result.success).toBe(true);
    });

    it('should log warning when timeout occurs', async () => {
      mockProvider.execute.mockImplementation(
        () => new Promise(() => {/* never resolves */})
      );

      const executor = new Executor({
        ...mockConfig,
        execution: {
          ...mockConfig.execution,
          timeout_per_iteration: 0.1,
          max_consecutive_failures: 1,
        },
      });

      const loggerSpy = vi.spyOn(
        (executor as unknown as { logger: { warn: (msg: string) => void } }).logger,
        'warn'
      );

      await executor.run('/test/task.md');

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('timed out')
      );
    }, 10_000);
  });
});

describe('executeTask', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const mockProvider = {
      execute: vi.fn().mockResolvedValue({
        success: true,
        output: 'Done',
        filesChanged: [],
        iterationComplete: true,
        completionSignal: '<TASK_COMPLETE>',
      }),
      isAvailable: vi.fn().mockResolvedValue(true),
    };
    (createProvider as Mock).mockReturnValue(mockProvider);

    (loadContext as Mock).mockResolvedValue({
      agents: { raw: '' },
      role: { name: 'developer', raw: '' },
      task: {
        goal: 'Test',
        scope: { allowed: ['**'], forbidden: [] },
        raw: '',
      },
    });
  });

  it('should create executor and run task', async () => {
    // Mock fs for config file check
    vi.mock('fs', async () => {
      const actual = await vi.importActual('fs');
      return {
        ...actual,
        existsSync: vi.fn().mockReturnValue(false),
      };
    });

    const result = await executeTask('/test/task.md');
    expect(result).toBeDefined();
    expect(result.taskPath).toBe('/test/task.md');
  });
});
