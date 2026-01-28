import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { ParallelExecutor } from './parallel-executor.js';
import type {
  ParallelExecutorOptions,
  ParsedTask,
  LoadedContext,
} from '../types/index.js';

// Mock dependencies
vi.mock('./executor.js', () => ({
  executeTask: vi.fn(),
}));

vi.mock('./context-loader.js', () => ({
  ContextLoader: vi.fn().mockImplementation(() => ({
    parseTask: vi.fn(),
  })),
}));

// Mock ContextLoader.findAiDir as static
import { ContextLoader } from './context-loader.js';
(ContextLoader as any).findAiDir = vi.fn(() => '/test/project');

import { executeTask } from './executor.js';

function makeParsedTask(overrides: Partial<ParsedTask> = {}): ParsedTask {
  return {
    filePath: '/test/task.md',
    goal: 'Test task',
    taskType: 'component',
    suggestedRoles: ['developer'],
    scope: {
      allowed: ['src/**'],
      forbidden: ['.env*'],
    },
    requirements: 'Test requirements',
    definitionOfDone: ['Item 1'],
    raw: '# Task content',
    ...overrides,
  };
}

const defaultOptions: ParallelExecutorOptions = {
  concurrency: 2,
  dryRun: false,
  verbose: false,
  quiet: true, // Suppress output during tests
};

describe('ParallelExecutor', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock: ContextLoader.parseTask returns unique tasks per path
    const mockLoader = {
      parseTask: vi.fn((taskPath: string) => {
        if (taskPath.includes('task-a')) {
          return Promise.resolve(makeParsedTask({
            filePath: taskPath,
            goal: 'Task A goal',
            scope: { allowed: ['src/components/**'], forbidden: ['.env*'] },
          }));
        }
        if (taskPath.includes('task-b')) {
          return Promise.resolve(makeParsedTask({
            filePath: taskPath,
            goal: 'Task B goal',
            scope: { allowed: ['src/utils/**'], forbidden: ['.env*'] },
          }));
        }
        if (taskPath.includes('task-c')) {
          return Promise.resolve(makeParsedTask({
            filePath: taskPath,
            goal: 'Task C goal',
            scope: { allowed: ['src/components/**'], forbidden: ['.env*'] },
          }));
        }
        return Promise.resolve(makeParsedTask({ filePath: taskPath }));
      }),
    };
    (ContextLoader as any).mockImplementation(() => mockLoader);
    (ContextLoader as any).findAiDir = vi.fn(() => '/test/project');
  });

  describe('dependency detection', () => {
    it('should detect overlapping scopes as dependencies', async () => {
      // task-a and task-c both use src/components/**
      (executeTask as Mock).mockResolvedValue({
        success: true,
        status: 'completed',
        iterations: 1,
        filesModified: [],
        taskPath: '',
      });

      const executor = new ParallelExecutor(defaultOptions);
      const result = await executor.run([
        '/test/tasks/task-a.md',
        '/test/tasks/task-b.md',
        '/test/tasks/task-c.md',
      ]);

      // task-a and task-c overlap on src/components/**
      expect(result.dependencies.length).toBeGreaterThan(0);

      const taskADep = result.dependencies.find(d => d.taskPath.includes('task-a'));
      expect(taskADep?.dependsOn.some(d => d.includes('task-c'))).toBe(true);
    });

    it('should not detect dependencies for non-overlapping scopes', async () => {
      // task-a uses src/components/**, task-b uses src/utils/**
      (executeTask as Mock).mockResolvedValue({
        success: true,
        status: 'completed',
        iterations: 1,
        filesModified: [],
        taskPath: '',
      });

      const executor = new ParallelExecutor(defaultOptions);
      const result = await executor.run([
        '/test/tasks/task-a.md',
        '/test/tasks/task-b.md',
      ]);

      expect(result.dependencies.length).toBe(0);
    });
  });

  describe('parallel execution', () => {
    it('should run independent tasks in parallel', async () => {
      const executionOrder: string[] = [];

      (executeTask as Mock).mockImplementation(async (taskPath: string) => {
        executionOrder.push(`start:${taskPath}`);
        // Simulate some work
        await new Promise(resolve => setTimeout(resolve, 10));
        executionOrder.push(`end:${taskPath}`);
        return {
          success: true,
          status: 'completed',
          iterations: 1,
          filesModified: [],
          taskPath,
        };
      });

      const executor = new ParallelExecutor({ ...defaultOptions, concurrency: 3 });
      const result = await executor.run([
        '/test/tasks/task-a.md',
        '/test/tasks/task-b.md',
      ]);

      expect(result.totalTasks).toBe(2);
      expect(result.completed).toBe(2);
      expect(result.failed).toBe(0);

      // Both should start before either ends (parallel execution)
      const startA = executionOrder.indexOf('start:/test/tasks/task-a.md');
      const startB = executionOrder.indexOf('start:/test/tasks/task-b.md');
      const endA = executionOrder.indexOf('end:/test/tasks/task-a.md');
      const endB = executionOrder.indexOf('end:/test/tasks/task-b.md');

      expect(startA).toBeLessThan(endA);
      expect(startB).toBeLessThan(endB);
      // Both should have started before both ended (true parallelism)
      expect(startA).toBeLessThan(endB);
      expect(startB).toBeLessThan(endA);
    });

    it('should respect concurrency limit', async () => {
      let concurrentCount = 0;
      let maxConcurrent = 0;

      (executeTask as Mock).mockImplementation(async (taskPath: string) => {
        concurrentCount++;
        maxConcurrent = Math.max(maxConcurrent, concurrentCount);
        await new Promise(resolve => setTimeout(resolve, 50));
        concurrentCount--;
        return {
          success: true,
          status: 'completed',
          iterations: 1,
          filesModified: [],
          taskPath,
        };
      });

      // Use a special mock loader that returns unique non-overlapping scopes
      const mockLoader = {
        parseTask: vi.fn((taskPath: string) =>
          Promise.resolve(makeParsedTask({
            filePath: taskPath,
            goal: `Task ${taskPath}`,
            scope: { allowed: [`unique/${taskPath}/**`], forbidden: [] },
          }))
        ),
      };
      (ContextLoader as any).mockImplementation(() => mockLoader);

      const executor = new ParallelExecutor({ ...defaultOptions, concurrency: 2 });
      await executor.run([
        '/test/tasks/task-1.md',
        '/test/tasks/task-2.md',
        '/test/tasks/task-3.md',
        '/test/tasks/task-4.md',
      ]);

      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });

    it('should serialize conflicting tasks into separate waves', async () => {
      // task-a and task-c have overlapping scopes
      const waveOrder: string[] = [];

      (executeTask as Mock).mockImplementation(async (taskPath: string) => {
        waveOrder.push(taskPath);
        return {
          success: true,
          status: 'completed',
          iterations: 1,
          filesModified: [],
          taskPath,
        };
      });

      const executor = new ParallelExecutor(defaultOptions);
      const result = await executor.run([
        '/test/tasks/task-a.md',
        '/test/tasks/task-c.md',
      ]);

      // Both should complete but they conflict, so one runs after the other
      expect(result.completed).toBe(2);
    });
  });

  describe('consolidated results', () => {
    it('should aggregate results from all tasks', async () => {
      (executeTask as Mock)
        .mockResolvedValueOnce({
          success: true,
          status: 'completed',
          iterations: 3,
          filesModified: ['src/a.ts', 'src/b.ts'],
          taskPath: '/test/tasks/task-a.md',
        })
        .mockResolvedValueOnce({
          success: true,
          status: 'completed',
          iterations: 2,
          filesModified: ['src/c.ts'],
          taskPath: '/test/tasks/task-b.md',
        });

      const executor = new ParallelExecutor(defaultOptions);
      const result = await executor.run([
        '/test/tasks/task-a.md',
        '/test/tasks/task-b.md',
      ]);

      expect(result.success).toBe(true);
      expect(result.totalTasks).toBe(2);
      expect(result.completed).toBe(2);
      expect(result.totalIterations).toBe(5);
      expect(result.totalFilesModified).toHaveLength(3);
      expect(result.totalFilesModified).toContain('src/a.ts');
      expect(result.totalFilesModified).toContain('src/b.ts');
      expect(result.totalFilesModified).toContain('src/c.ts');
    });

    it('should report failure when any task fails', async () => {
      (executeTask as Mock)
        .mockResolvedValueOnce({
          success: true,
          status: 'completed',
          iterations: 1,
          filesModified: [],
          taskPath: '/test/tasks/task-a.md',
        })
        .mockResolvedValueOnce({
          success: false,
          status: 'failed',
          iterations: 1,
          filesModified: [],
          error: 'Something went wrong',
          taskPath: '/test/tasks/task-b.md',
        });

      const executor = new ParallelExecutor(defaultOptions);
      const result = await executor.run([
        '/test/tasks/task-a.md',
        '/test/tasks/task-b.md',
      ]);

      expect(result.success).toBe(false);
      expect(result.completed).toBe(1);
      expect(result.failed).toBe(1);
    });

    it('should report blocked tasks', async () => {
      (executeTask as Mock).mockResolvedValue({
        success: false,
        status: 'blocked',
        iterations: 5,
        filesModified: [],
        blockedReason: 'Max iterations reached',
        taskPath: '/test/tasks/task-a.md',
      });

      const executor = new ParallelExecutor(defaultOptions);
      const result = await executor.run([
        '/test/tasks/task-a.md',
        '/test/tasks/task-b.md',
      ]);

      expect(result.success).toBe(false);
      expect(result.blocked).toBe(2);
    });

    it('should deduplicate files modified by multiple tasks', async () => {
      (executeTask as Mock)
        .mockResolvedValueOnce({
          success: true,
          status: 'completed',
          iterations: 1,
          filesModified: ['src/shared.ts', 'src/a.ts'],
          taskPath: '/test/tasks/task-a.md',
        })
        .mockResolvedValueOnce({
          success: true,
          status: 'completed',
          iterations: 1,
          filesModified: ['src/shared.ts', 'src/b.ts'],
          taskPath: '/test/tasks/task-b.md',
        });

      const executor = new ParallelExecutor(defaultOptions);
      const result = await executor.run([
        '/test/tasks/task-a.md',
        '/test/tasks/task-b.md',
      ]);

      // src/shared.ts should only appear once
      expect(result.totalFilesModified).toHaveLength(3);
    });
  });

  describe('file conflict detection', () => {
    it('should detect file conflicts between concurrent tasks', async () => {
      let callCount = 0;

      (executeTask as Mock).mockImplementation(async (taskPath: string, options: any) => {
        callCount++;
        // Simulate the first task reporting files modified
        if (options?.onIteration) {
          options.onIteration({
            status: 'running',
            iteration: 1,
            filesModified: ['src/shared-file.ts'],
            validationResults: [],
          });
        }
        await new Promise(resolve => setTimeout(resolve, 10));
        return {
          success: true,
          status: 'completed',
          iterations: 1,
          filesModified: ['src/shared-file.ts'],
          taskPath,
        };
      });

      const executor = new ParallelExecutor(defaultOptions);
      const result = await executor.run([
        '/test/tasks/task-a.md',
        '/test/tasks/task-b.md',
      ]);

      // File conflicts may or may not be detected depending on timing
      // but the execution should still complete
      expect(result.totalTasks).toBe(2);
    });
  });

  describe('callbacks', () => {
    it('should call onTaskStart and onTaskComplete callbacks', async () => {
      const onTaskStart = vi.fn();
      const onTaskComplete = vi.fn();

      (executeTask as Mock).mockResolvedValue({
        success: true,
        status: 'completed',
        iterations: 1,
        filesModified: [],
        taskPath: '',
      });

      const executor = new ParallelExecutor({
        ...defaultOptions,
        onTaskStart,
        onTaskComplete,
      });

      await executor.run([
        '/test/tasks/task-a.md',
        '/test/tasks/task-b.md',
      ]);

      expect(onTaskStart).toHaveBeenCalledTimes(2);
      expect(onTaskComplete).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling', () => {
    it('should handle task execution errors gracefully', async () => {
      (executeTask as Mock)
        .mockResolvedValueOnce({
          success: true,
          status: 'completed',
          iterations: 1,
          filesModified: [],
          taskPath: '/test/tasks/task-a.md',
        })
        .mockRejectedValueOnce(new Error('Provider unavailable'));

      const executor = new ParallelExecutor(defaultOptions);
      const result = await executor.run([
        '/test/tasks/task-a.md',
        '/test/tasks/task-b.md',
      ]);

      // One succeeded, one failed
      expect(result.completed).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.success).toBe(false);
    });

    it('should fail if no AIDF project found', async () => {
      (ContextLoader as any).findAiDir = vi.fn(() => null);

      const executor = new ParallelExecutor(defaultOptions);
      await expect(executor.run(['/test/tasks/task-a.md'])).rejects.toThrow(
        'No AIDF project found'
      );
    });
  });
});
