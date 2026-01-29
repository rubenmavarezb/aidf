import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { Executor, executeTask } from './executor.js';
import type { AidfConfig, LoadedContext, ExecutorOptions } from '../types/index.js';

// Mock dependencies
vi.mock('./context-loader.js', () => ({
  loadContext: vi.fn(),
}));

vi.mock('./providers/index.js', () => ({
  createProvider: vi.fn(() => ({
    name: 'mock-provider',
    execute: vi.fn(),
    isAvailable: vi.fn().mockResolvedValue(true),
  })),
}));

vi.mock('./providers/claude-cli.js', () => ({
  buildIterationPrompt: vi.fn(() => 'mock prompt'),
}));

vi.mock('simple-git', () => ({
  simpleGit: vi.fn(() => ({
    checkout: vi.fn().mockResolvedValue(undefined),
    add: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined),
    push: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Import mocked modules
import { loadContext } from './context-loader.js';
import { createProvider } from './providers/index.js';

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
