import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { Executor, executeTask } from './executor.js';
import type { AidfConfig, LoadedContext, ExecutorOptions, ExecutorDependencies } from '../types/index.js';
import type { SimpleGit } from 'simple-git';

// We still need vi.mock for modules that PreFlightPhase imports directly
// (loadContext, estimateContextSize, resolveConfig, detectPlaintextSecrets)
// and prompt builders used by ExecutionPhase
vi.mock('./context-loader.js', async () => {
  const actual = await vi.importActual<typeof import('./context-loader.js')>('./context-loader.js');
  return {
    loadContext: vi.fn(),
    estimateContextSize: actual.estimateContextSize,
    estimateTokens: actual.estimateTokens,
  };
});

vi.mock('./providers/claude-cli.js', () => ({
  buildIterationPrompt: vi.fn(() => 'mock prompt'),
  buildContinuationPrompt: vi.fn(() => 'mock continuation prompt'),
}));

vi.mock('../utils/files.js', () => ({
  moveTaskFile: vi.fn((taskPath: string) => taskPath),
}));

// Import mocked modules
import { loadContext } from './context-loader.js';
import { buildIterationPrompt, buildContinuationPrompt } from './providers/claude-cli.js';
import { moveTaskFile } from '../utils/files.js';

function createMockGit(): SimpleGit {
  return {
    checkout: vi.fn().mockResolvedValue(undefined),
    add: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined),
    push: vi.fn().mockResolvedValue(undefined),
    raw: vi.fn().mockResolvedValue(undefined),
  } as unknown as SimpleGit;
}

function createMockProvider() {
  return {
    name: 'mock-provider',
    execute: vi.fn(),
    isAvailable: vi.fn().mockResolvedValue(true),
  };
}

function createMockDeps(overrides?: Partial<ExecutorDependencies>): Partial<ExecutorDependencies> {
  const mockGit = createMockGit();
  const mockProvider = createMockProvider();

  return {
    git: mockGit,
    createScopeGuard: undefined, // Use default ScopeGuard
    createValidator: vi.fn(() => ({
      preCommit: vi.fn().mockResolvedValue({
        phase: 'pre_commit',
        passed: true,
        results: [],
        totalDuration: 0,
      }),
    })) as unknown as ExecutorDependencies['createValidator'],
    createProvider: vi.fn(() => mockProvider),
    notificationService: { notifyResult: vi.fn() } as unknown as ExecutorDependencies['notificationService'],
    moveTaskFile: moveTaskFile as unknown as ExecutorDependencies['moveTaskFile'],
    ...overrides,
  };
}

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

  let mockDeps: Partial<ExecutorDependencies>;
  let mockProvider: ReturnType<typeof createMockProvider>;

  beforeEach(() => {
    vi.clearAllMocks();

    (loadContext as Mock).mockResolvedValue(mockContext);

    mockDeps = createMockDeps();
    mockProvider = (mockDeps.createProvider as Mock).mock.results[0]?.value ?? createMockProvider();
    (mockDeps.createProvider as Mock).mockReturnValue(mockProvider);
  });

  describe('constructor', () => {
    it('should initialize with default options merged with config', () => {
      const executor = new Executor(mockConfig, {}, process.cwd(), mockDeps);
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
      const executor = new Executor(mockConfig, options, process.cwd(), mockDeps);
      expect(executor).toBeDefined();
    });

    it('should use injected dependencies when provided', () => {
      const executor = new Executor(mockConfig, {}, process.cwd(), mockDeps);
      expect(executor).toBeDefined();
      expect(mockDeps.createProvider).toHaveBeenCalled();
    });

    it('should create default dependencies when deps is omitted', () => {
      const executor = new Executor(mockConfig);
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

      const executor = new Executor(mockConfig, {}, process.cwd(), mockDeps);
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
      }, {}, process.cwd(), mockDeps);
      const result = await executor.run('/test/task.md');

      expect(result.success).toBe(false);
      expect(result.status).toBe('blocked');
      expect(result.iterations).toBe(3);
      expect(result.blockedReason).toContain('Max iterations');
    });

    it('should stop after consecutive failures', async () => {
      mockProvider.execute.mockResolvedValue({
        success: true,
        output: 'Made changes',
        filesChanged: ['node_modules/bad-file.js'],
        iterationComplete: false,
      });

      const executor = new Executor({
        ...mockConfig,
        execution: { ...mockConfig.execution, max_consecutive_failures: 2 },
      }, {}, process.cwd(), mockDeps);
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
      }, {}, process.cwd(), mockDeps);
      const result = await executor.run('/test/task.md');

      expect(result.success).toBe(true);
      expect(result.filesModified).toContain('src/file1.ts');
      expect(result.filesModified).toContain('src/file2.ts');
    });

    it('should handle dry run mode', async () => {
      const executor = new Executor(mockConfig, { dryRun: true }, process.cwd(), mockDeps);
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

      const executor = new Executor(mockConfig, {}, process.cwd(), mockDeps);
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

      const executor = new Executor(mockConfig, { onIteration }, process.cwd(), mockDeps);
      await executor.run('/test/task.md');

      expect(onIteration).toHaveBeenCalledTimes(1);
      const callArg = onIteration.mock.calls[0][0];
      expect(callArg.iteration).toBe(1);
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

      const executor = new Executor(mockConfig, { onPhase }, process.cwd(), mockDeps);
      await executor.run('/test/task.md');

      expect(onPhase).toHaveBeenCalledWith(
        expect.objectContaining({ phase: 'Starting iteration', iteration: 1 })
      );
      expect(onPhase).toHaveBeenCalledWith(
        expect.objectContaining({ phase: 'Executing AI', iteration: 1 })
      );
      expect(onPhase).toHaveBeenCalledWith(
        expect.objectContaining({ phase: 'Checking scope', iteration: 1 })
      );
      expect(onPhase).toHaveBeenCalledWith(
        expect.objectContaining({ phase: 'Validating', iteration: 1 })
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
        { onPhase },
        process.cwd(),
        mockDeps
      );
      await executor.run('/test/task.md');

      expect(onPhase).toHaveBeenCalledWith(
        expect.objectContaining({ phase: 'Scope violation' })
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

      const executor = new Executor(mockConfig, { onOutput }, process.cwd(), mockDeps);
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
      }, {}, process.cwd(), mockDeps);
      const result = await executor.run('/test/task.md');

      expect(result.success).toBe(false);
      expect(result.status).toBe('blocked');
    });

    it('should ask user for files outside scope in ask mode', async () => {
      const onAskUser = vi.fn().mockResolvedValue(false);

      mockProvider.execute.mockResolvedValue({
        success: true,
        output: 'Changed file outside scope',
        filesChanged: ['other/file.ts'],
        iterationComplete: false,
      });

      const executor = new Executor(
        {
          ...mockConfig,
          permissions: { ...mockConfig.permissions, scope_enforcement: 'ask' },
          execution: { ...mockConfig.execution, max_consecutive_failures: 1 },
        },
        { onAskUser },
        process.cwd(),
        mockDeps
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
        { onAskUser },
        process.cwd(),
        mockDeps
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

      const executor = new Executor(mockConfig, {}, process.cwd(), mockDeps);
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

      const executor = new Executor(mockConfig, {}, process.cwd(), mockDeps);
      expect(executor.getState().status).toBe('idle');

      await executor.run('/test/task.md');
      expect(executor.getState().status).toBe('completed');
    });

    it('should support pause and resume', () => {
      const executor = new Executor(mockConfig, {}, process.cwd(), mockDeps);
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

      const executor = new Executor(mockConfig, {}, process.cwd(), mockDeps);
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

      const executor = new Executor(mockConfig, {}, process.cwd(), mockDeps);
      await executor.run('/test/task.md');

      const state = executor.getState();
      expect(state.startedAt).toBeDefined();
      expect(state.completedAt).toBeDefined();
    });
  });

  describe('resume functionality', () => {
    const resumeConfig: AidfConfig = {
      ...mockConfig,
      execution: { ...mockConfig.execution, max_iterations: 50 },
      permissions: { ...mockConfig.permissions, auto_commit: true },
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

      const executor = new Executor(mockConfig, { resume: true }, process.cwd(), mockDeps);
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

      const executor = new Executor(resumeConfig, { resume: true }, process.cwd(), mockDeps);
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

      const executor = new Executor(resumeConfig, { resume: true, dryRun: true }, process.cwd(), mockDeps);
      await executor.run('/test/task.md');

      expect(mockProvider.execute).not.toHaveBeenCalled();
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

      const executor = new Executor(resumeConfig, { resume: true }, process.cwd(), mockDeps);
      const result = await executor.run('/test/task.md');

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

      const executor = new Executor(mockConfig, {}, process.cwd(), mockDeps);
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
      }, {}, process.cwd(), mockDeps);
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
      }, {}, process.cwd(), mockDeps);
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
      }, {}, process.cwd(), mockDeps);
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

      const executor = new Executor(mockConfig, {}, process.cwd(), mockDeps);
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
      }, {}, process.cwd(), mockDeps);
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
      }, {}, process.cwd(), mockDeps);
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

      const executor = new Executor(mockConfig, {}, process.cwd(), mockDeps);
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

      const executor = new Executor(mockConfig, {}, process.cwd(), mockDeps);
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
      }, {}, process.cwd(), mockDeps);
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

      const executor = new Executor(mockConfig, {}, process.cwd(), mockDeps);
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

      const executor = new Executor(mockConfig, {}, process.cwd(), mockDeps);
      await executor.run('/test/task.md');

      const mockGit = mockDeps.git as unknown as { add: Mock };
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

      const executor = new Executor(mockConfig, {}, process.cwd(), mockDeps);
      await executor.run('/test/task.md');

      const mockGit = mockDeps.git as unknown as { add: Mock; raw: Mock };
      expect(mockGit.add).toHaveBeenCalledWith([newPath]);
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

      const executor = new Executor(mockConfig, {}, process.cwd(), mockDeps);
      await executor.run('/test/task.md');

      const mockGit = mockDeps.git as unknown as { add: Mock };
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

      const mockGit = createMockGit();
      (mockGit.add as Mock).mockRejectedValueOnce(new Error('git add failed'));

      const executor = new Executor(mockConfig, {}, process.cwd(), {
        ...mockDeps,
        git: mockGit,
      });
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

      const executor = new Executor(mockConfig, {}, process.cwd(), mockDeps);
      const result = await executor.run('/test/task.md');

      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
      expect(result.iterations).toBe(1);
    });

    it('should NOT complete when completion signal + validation fails', async () => {
      const mockValidator = vi.fn().mockResolvedValueOnce(failedValidation).mockResolvedValue({
        phase: 'pre_commit',
        passed: true,
        results: [],
        totalDuration: 0,
      });

      const depsWithFailingValidator = {
        ...mockDeps,
        createValidator: vi.fn(() => ({ preCommit: mockValidator })) as unknown as ExecutorDependencies['createValidator'],
      };

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

      const executor = new Executor(mockConfig, {}, process.cwd(), depsWithFailingValidator);
      const result = await executor.run('/test/task.md');

      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
      expect(result.iterations).toBe(2);
    });

    it('should include validation error in next iteration prompt', async () => {
      const mockValidator = vi.fn().mockResolvedValueOnce(failedValidation).mockResolvedValue({
        phase: 'pre_commit',
        passed: true,
        results: [],
        totalDuration: 0,
      });

      const depsWithFailingValidator = {
        ...mockDeps,
        createValidator: vi.fn(() => ({ preCommit: mockValidator })) as unknown as ExecutorDependencies['createValidator'],
      };

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

      const executor = new Executor(mockConfig, {}, process.cwd(), depsWithFailingValidator);
      await executor.run('/test/task.md');

      expect(buildIterationPrompt).toHaveBeenCalledTimes(1);
      expect(buildContinuationPrompt).toHaveBeenCalledTimes(1);
      const continuationArgs = (buildContinuationPrompt as Mock).mock.calls[0][0];
      expect(continuationArgs.previousValidationError).toBeDefined();
      expect(continuationArgs.previousValidationError).toContain('FAILED');
    });

    it('should NOT include validation error in prompt when no completion signal', async () => {
      const mockValidator = vi.fn().mockResolvedValueOnce(failedValidation).mockResolvedValue({
        phase: 'pre_commit',
        passed: true,
        results: [],
        totalDuration: 0,
      });

      const depsWithFailingValidator = {
        ...mockDeps,
        createValidator: vi.fn(() => ({ preCommit: mockValidator })) as unknown as ExecutorDependencies['createValidator'],
      };

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

      const executor = new Executor(mockConfig, {}, process.cwd(), depsWithFailingValidator);
      await executor.run('/test/task.md');

      expect(buildContinuationPrompt).toHaveBeenCalledTimes(1);
      const continuationArgs = (buildContinuationPrompt as Mock).mock.calls[0][0];
      expect(continuationArgs.previousValidationError).toBeUndefined();
    });

    it('should clear validation error after successful validation', async () => {
      const mockValidator = vi.fn()
        .mockResolvedValueOnce(failedValidation)
        .mockResolvedValue({
          phase: 'pre_commit',
          passed: true,
          results: [],
          totalDuration: 0,
        });

      const depsWithFailingValidator = {
        ...mockDeps,
        createValidator: vi.fn(() => ({ preCommit: mockValidator })) as unknown as ExecutorDependencies['createValidator'],
      };

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

      const executor = new Executor(mockConfig, {}, process.cwd(), depsWithFailingValidator);
      await executor.run('/test/task.md');

      expect(buildIterationPrompt).toHaveBeenCalledTimes(1);
      expect(buildContinuationPrompt).toHaveBeenCalledTimes(2);
      expect((buildContinuationPrompt as Mock).mock.calls[0][0].previousValidationError).toBeDefined();
      expect((buildContinuationPrompt as Mock).mock.calls[1][0].previousValidationError).toBeUndefined();
    });

    it('should not lose completion signal when validation fails (regression test)', async () => {
      const mockValidator = vi.fn()
        .mockResolvedValueOnce(failedValidation)
        .mockResolvedValue({
          phase: 'pre_commit',
          passed: true,
          results: [],
          totalDuration: 0,
        });

      const depsWithFailingValidator = {
        ...mockDeps,
        createValidator: vi.fn(() => ({ preCommit: mockValidator })) as unknown as ExecutorDependencies['createValidator'],
      };

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

      const executor = new Executor(mockConfig, {}, process.cwd(), depsWithFailingValidator);
      const result = await executor.run('/test/task.md');

      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
      expect(result.iterations).toBe(2);
      expect(result.blockedReason).toBeUndefined();
    });
  });

  describe('completion signal + scope violation interaction', () => {
    it('should accept completion despite scope violation when signal detected', async () => {
      mockProvider.execute.mockResolvedValue({
        success: true,
        output: '<TASK_COMPLETE>',
        filesChanged: ['src/allowed.ts', 'node_modules/forbidden.js'],
        iterationComplete: true,
        completionSignal: '<TASK_COMPLETE>',
      });

      const executor = new Executor(mockConfig, {}, process.cwd(), mockDeps);
      const result = await executor.run('/test/task.md');

      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
      expect(result.iterations).toBe(1);
    });

    it('should still fail on scope violation when no completion signal', async () => {
      mockProvider.execute.mockResolvedValue({
        success: true,
        output: 'Working on it',
        filesChanged: ['node_modules/bad.js'],
        iterationComplete: false,
      });

      const executor = new Executor({
        ...mockConfig,
        execution: { ...mockConfig.execution, max_consecutive_failures: 2 },
      }, {}, process.cwd(), mockDeps);
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

      const executor = new Executor(mockConfig, {}, process.cwd(), mockDeps);
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

      const executor = new Executor(mockConfig, {}, process.cwd(), mockDeps);
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

      const executor = new Executor(mockConfig, {}, process.cwd(), mockDeps);
      const result = await executor.run('/test/task.md');

      expect(result.tokenUsage).toBeDefined();
      expect(result.tokenUsage!.estimatedCost).toBeDefined();
      expect(result.tokenUsage!.estimatedCost).toBeCloseTo(4.5, 1);
    });

    it('should report context tokens even without API token usage', async () => {
      mockProvider.execute.mockResolvedValue({
        success: true,
        output: 'Done',
        filesChanged: [],
        iterationComplete: true,
        completionSignal: '<TASK_COMPLETE>',
      });

      const executor = new Executor(mockConfig, {}, process.cwd(), mockDeps);
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

      const executor = new Executor(mockConfig, {}, process.cwd(), mockDeps);
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

      const executor = new Executor(mockConfig, {}, process.cwd(), mockDeps);
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

      const executor = new Executor(mockConfig, {}, process.cwd(), mockDeps);
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

      const executor = new Executor(mockConfig, {}, process.cwd(), mockDeps);
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

      const executor = new Executor(mockConfig, {}, process.cwd(), mockDeps);
      await executor.run('/test/task.md');

      expect(buildIterationPrompt).toHaveBeenCalledTimes(1);
      expect(buildContinuationPrompt).not.toHaveBeenCalled();
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

      const executor = new Executor(mockConfig, {}, process.cwd(), mockDeps);
      await executor.run('/test/task.md');

      expect(buildIterationPrompt).toHaveBeenCalledTimes(1);
      expect(buildContinuationPrompt).toHaveBeenCalledTimes(1);

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

      const executor = new Executor(mockConfig, {}, process.cwd(), mockDeps);
      await executor.run('/test/task.md');

      const secondCallOptions = mockProvider.execute.mock.calls[1][1];
      expect(secondCallOptions.conversationState).toEqual(mockState);
    });

    it('should use sentinel true when provider does not return conversationState', async () => {
      mockProvider.execute
        .mockResolvedValueOnce({
          success: true,
          output: 'Working...',
          filesChanged: [],
          iterationComplete: false,
        })
        .mockResolvedValueOnce({
          success: true,
          output: 'Done',
          filesChanged: [],
          iterationComplete: true,
          completionSignal: '<TASK_COMPLETE>',
        });

      const executor = new Executor(mockConfig, {}, process.cwd(), mockDeps);
      await executor.run('/test/task.md');

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
      }, {}, process.cwd(), mockDeps);
      await executor.run('/test/task.md');

      expect(buildIterationPrompt).toHaveBeenCalledTimes(2);
      expect(buildContinuationPrompt).not.toHaveBeenCalled();

      const secondCallOptions = mockProvider.execute.mock.calls[1][1];
      expect(secondCallOptions.sessionContinuation).toBe(false);
    });

    it('should fallback to full prompt when continuation fails', async () => {
      mockProvider.execute
        .mockResolvedValueOnce({
          success: true,
          output: 'Working...',
          filesChanged: [],
          iterationComplete: false,
          conversationState: [{ role: 'user', content: 'state' }],
        })
        .mockResolvedValueOnce({
          success: false,
          output: '',
          error: 'Continuation error',
          filesChanged: [],
          iterationComplete: false,
        })
        .mockResolvedValueOnce({
          success: true,
          output: 'Done after fallback',
          filesChanged: [],
          iterationComplete: true,
          completionSignal: '<TASK_COMPLETE>',
        });

      const executor = new Executor(mockConfig, {}, process.cwd(), mockDeps);
      const result = await executor.run('/test/task.md');

      expect(buildContinuationPrompt).toHaveBeenCalledTimes(1);
      expect(buildIterationPrompt).toHaveBeenCalledTimes(2);
      expect(mockProvider.execute).toHaveBeenCalledTimes(3);
      expect(result.success).toBe(true);
    });
  });

  describe('timeout enforcement', () => {
    it('should timeout iteration when provider takes too long', async () => {
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
      }, {}, process.cwd(), mockDeps);

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
        execution: { ...mockConfig.execution, timeout_per_iteration: 300 },
      }, {}, process.cwd(), mockDeps);

      const result = await executor.run('/test/task.md');
      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
    });

    it('should increment failure count on timeout and continue to next iteration', async () => {
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
          timeout_per_iteration: 0.1,
          max_consecutive_failures: 3,
        },
      }, {}, process.cwd(), mockDeps);

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
        execution: { ...mockConfig.execution, timeout_per_iteration: 0 },
      }, {}, process.cwd(), mockDeps);

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
      }, {}, process.cwd(), mockDeps);

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

// Mock createProvider at module level for executeTask tests
vi.mock('./providers/index.js', () => ({
  createProvider: vi.fn(() => ({
    name: 'mock-provider',
    execute: vi.fn().mockResolvedValue({
      success: true,
      output: 'Done',
      filesChanged: [],
      iterationComplete: true,
      completionSignal: '<TASK_COMPLETE>',
    }),
    isAvailable: vi.fn().mockResolvedValue(true),
  })),
}));

import { createProvider } from './providers/index.js';

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
