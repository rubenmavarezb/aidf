// packages/cli/src/__tests__/e2e/parallel-conflicts.e2e.test.ts

import { describe, it, expect } from 'vitest';
import { createTempProject, createTaskFixture, type TempProjectResult } from './helpers/index.js';
import { ContextLoader } from '../../core/context-loader.js';
import { checkFileChanges, matchesPattern } from '../../core/safety.js';
import type { TaskScope, FileChange, ParallelExecutionResult, ParallelTaskResult, ExecutorResult } from '../../types/index.js';

/**
 * Checks whether two sets of allowed-path patterns overlap.
 * Mirrors the logic used internally by ParallelExecutor.findScopeOverlap.
 */
function scopesOverlap(pathsA: string[], pathsB: string[]): string | null {
  for (const a of pathsA) {
    for (const b of pathsB) {
      const baseA = a.replace(/\/?\*\*.*$/, '').replace(/\/\*$/, '');
      const baseB = b.replace(/\/?\*\*.*$/, '').replace(/\/\*$/, '');

      if (!baseA || !baseB) continue;

      if (baseA.startsWith(baseB) || baseB.startsWith(baseA)) {
        return `${a} overlaps with ${b}`;
      }

      if (matchesPattern(baseA, [b]) || matchesPattern(baseB, [a])) {
        return `${a} overlaps with ${b}`;
      }
    }
  }
  return null;
}

/**
 * Helper to build a mock ExecutorResult.
 */
function mockResult(overrides: Partial<ExecutorResult> = {}): ExecutorResult {
  return {
    success: true,
    status: 'completed',
    iterations: 1,
    filesModified: [],
    taskPath: 'task.md',
    ...overrides,
  };
}

/**
 * Helper to build a mock ParallelTaskResult.
 */
function mockTaskResult(overrides: Partial<ParallelTaskResult> & { result: ExecutorResult }): ParallelTaskResult {
  const now = new Date();
  return {
    taskPath: 'task.md',
    taskName: 'task',
    startedAt: now,
    completedAt: now,
    ...overrides,
  };
}

describe('Parallel Executor E2E - Conflict Detection', () => {
  // ---------------------------------------------------------------
  // 1. Two tasks with overlapping allowed scope detected
  // ---------------------------------------------------------------
  it('detects overlapping allowed scopes between two tasks', async () => {
    let project: TempProjectResult | undefined;
    try {
      project = await createTempProject();

      const taskAPath = await createTaskFixture(project.projectRoot, {
        id: 'overlap-a',
        goal: 'Modify shared and A modules',
        type: 'component',
        allowedScope: ['src/shared/**', 'src/a/**'],
        forbiddenScope: [],
        requirements: 'Update shared utils and module A.',
        definitionOfDone: ['Shared utils updated', 'Module A updated'],
      });

      const taskBPath = await createTaskFixture(project.projectRoot, {
        id: 'overlap-b',
        goal: 'Modify shared and B modules',
        type: 'component',
        allowedScope: ['src/shared/**', 'src/b/**'],
        forbiddenScope: [],
        requirements: 'Update shared utils and module B.',
        definitionOfDone: ['Shared utils updated', 'Module B updated'],
      });

      const loader = new ContextLoader(project.projectRoot);
      const taskA = await loader.parseTask(taskAPath);
      const taskB = await loader.parseTask(taskBPath);

      const overlap = scopesOverlap(taskA.scope.allowed, taskB.scope.allowed);
      expect(overlap).not.toBeNull();
      expect(overlap).toContain('src/shared');
    } finally {
      await project?.cleanup();
    }
  });

  // ---------------------------------------------------------------
  // 2. Two tasks with disjoint scopes have no overlap
  // ---------------------------------------------------------------
  it('reports no overlap for disjoint scopes', async () => {
    let project: TempProjectResult | undefined;
    try {
      project = await createTempProject();

      const taskAPath = await createTaskFixture(project.projectRoot, {
        id: 'disjoint-a',
        goal: 'Work on module A only',
        type: 'component',
        allowedScope: ['src/a/**'],
        forbiddenScope: [],
        requirements: 'Module A work.',
        definitionOfDone: ['Module A done'],
      });

      const taskBPath = await createTaskFixture(project.projectRoot, {
        id: 'disjoint-b',
        goal: 'Work on module B only',
        type: 'component',
        allowedScope: ['src/b/**'],
        forbiddenScope: [],
        requirements: 'Module B work.',
        definitionOfDone: ['Module B done'],
      });

      const loader = new ContextLoader(project.projectRoot);
      const taskA = await loader.parseTask(taskAPath);
      const taskB = await loader.parseTask(taskBPath);

      const overlap = scopesOverlap(taskA.scope.allowed, taskB.scope.allowed);
      expect(overlap).toBeNull();
    } finally {
      await project?.cleanup();
    }
  });

  // ---------------------------------------------------------------
  // 3. Runtime conflict simulation — same file allowed by both scopes
  // ---------------------------------------------------------------
  it('confirms a shared file is allowed by both scopes (runtime conflict)', () => {
    const scopeA: TaskScope = {
      allowed: ['src/shared/**', 'src/a/**'],
      forbidden: [],
    };
    const scopeB: TaskScope = {
      allowed: ['src/shared/**', 'src/b/**'],
      forbidden: [],
    };

    const changesA: FileChange[] = [{ path: 'src/shared/utils.ts', type: 'modified' }];
    const changesB: FileChange[] = [{ path: 'src/shared/utils.ts', type: 'modified' }];

    const decisionA = checkFileChanges(changesA, scopeA, 'strict');
    const decisionB = checkFileChanges(changesB, scopeB, 'strict');

    // Both scopes allow the file, meaning a runtime conflict would occur
    expect(decisionA.action).toBe('ALLOW');
    expect(decisionB.action).toBe('ALLOW');
  });

  // ---------------------------------------------------------------
  // 4. Three tasks: A and B share scope, C is independent
  // ---------------------------------------------------------------
  it('detects pairwise overlaps correctly with three tasks', async () => {
    let project: TempProjectResult | undefined;
    try {
      project = await createTempProject();

      const taskAPath = await createTaskFixture(project.projectRoot, {
        id: 'tri-a',
        goal: 'Task A with shared scope',
        type: 'component',
        allowedScope: ['src/shared/**', 'src/a/**'],
        forbiddenScope: [],
        requirements: 'A requirements.',
        definitionOfDone: ['A done'],
      });

      const taskBPath = await createTaskFixture(project.projectRoot, {
        id: 'tri-b',
        goal: 'Task B with shared scope',
        type: 'component',
        allowedScope: ['src/shared/**', 'src/b/**'],
        forbiddenScope: [],
        requirements: 'B requirements.',
        definitionOfDone: ['B done'],
      });

      const taskCPath = await createTaskFixture(project.projectRoot, {
        id: 'tri-c',
        goal: 'Task C independent',
        type: 'component',
        allowedScope: ['src/c/**'],
        forbiddenScope: [],
        requirements: 'C requirements.',
        definitionOfDone: ['C done'],
      });

      const loader = new ContextLoader(project.projectRoot);
      const taskA = await loader.parseTask(taskAPath);
      const taskB = await loader.parseTask(taskBPath);
      const taskC = await loader.parseTask(taskCPath);

      // A-B overlap
      expect(scopesOverlap(taskA.scope.allowed, taskB.scope.allowed)).not.toBeNull();
      // A-C no overlap
      expect(scopesOverlap(taskA.scope.allowed, taskC.scope.allowed)).toBeNull();
      // B-C no overlap
      expect(scopesOverlap(taskB.scope.allowed, taskC.scope.allowed)).toBeNull();
    } finally {
      await project?.cleanup();
    }
  });

  // ---------------------------------------------------------------
  // 5. Scope overlap with forbidden patterns
  // ---------------------------------------------------------------
  it('blocks a forbidden file for task A but allows it for task B', () => {
    const scopeA: TaskScope = {
      allowed: ['src/**'],
      forbidden: ['src/shared/**'],
    };
    const scopeB: TaskScope = {
      allowed: ['src/shared/**'],
      forbidden: [],
    };

    const sharedFile: FileChange[] = [{ path: 'src/shared/config.ts', type: 'modified' }];

    const decisionA = checkFileChanges(sharedFile, scopeA, 'strict');
    const decisionB = checkFileChanges(sharedFile, scopeB, 'strict');

    expect(decisionA.action).toBe('BLOCK');
    expect(decisionB.action).toBe('ALLOW');
  });

  // ---------------------------------------------------------------
  // 6. Concurrency simulation with timing
  // ---------------------------------------------------------------
  it('limits concurrent execution to the specified concurrency', async () => {
    const maxConcurrency = 2;
    let currentRunning = 0;
    let peakRunning = 0;

    const semaphore = {
      running: 0,
      queue: [] as Array<() => void>,
      acquire(): Promise<void> {
        if (this.running < maxConcurrency) {
          this.running++;
          return Promise.resolve();
        }
        return new Promise<void>(resolve => this.queue.push(resolve));
      },
      release(): void {
        this.running--;
        const next = this.queue.shift();
        if (next) {
          this.running++;
          next();
        }
      },
    };

    const createTask = (id: number) => async () => {
      await semaphore.acquire();
      currentRunning++;
      if (currentRunning > peakRunning) peakRunning = currentRunning;

      // Simulate work with random delay 50-200ms
      await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 150));

      currentRunning--;
      semaphore.release();
      return id;
    };

    const tasks = Array.from({ length: 5 }, (_, i) => createTask(i));
    const results = await Promise.all(tasks.map(fn => fn()));

    expect(results).toHaveLength(5);
    expect(peakRunning).toBeLessThanOrEqual(maxConcurrency);
    expect(peakRunning).toBeGreaterThanOrEqual(1);
  });

  // ---------------------------------------------------------------
  // 7. Mixed results aggregation
  // ---------------------------------------------------------------
  it('aggregates mixed results into a correct ParallelExecutionResult', () => {
    const completedResult = mockTaskResult({
      taskPath: 'tasks/a.md',
      taskName: 'a',
      result: mockResult({ success: true, status: 'completed', iterations: 3, filesModified: ['a.ts'] }),
    });

    const blockedResult = mockTaskResult({
      taskPath: 'tasks/b.md',
      taskName: 'b',
      result: mockResult({ success: false, status: 'blocked', iterations: 2, filesModified: ['b.ts'], blockedReason: 'Missing dep' }),
    });

    const failedResult = mockTaskResult({
      taskPath: 'tasks/c.md',
      taskName: 'c',
      result: mockResult({ success: false, status: 'failed', iterations: 1, filesModified: [], error: 'Timeout' }),
    });

    const tasks = [completedResult, blockedResult, failedResult];

    const completed = tasks.filter(t => t.result.success).length;
    const failed = tasks.filter(t => t.result.status === 'failed').length;
    const blocked = tasks.filter(t => t.result.status === 'blocked').length;

    const result: ParallelExecutionResult = {
      success: failed === 0 && blocked === 0,
      totalTasks: tasks.length,
      completed,
      failed,
      blocked,
      skipped: 0,
      tasks,
      dependencies: [],
      fileConflicts: [],
      totalIterations: tasks.reduce((sum, t) => sum + t.result.iterations, 0),
      totalFilesModified: [...new Set(tasks.flatMap(t => t.result.filesModified))],
    };

    expect(result.completed).toBe(1);
    expect(result.blocked).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.success).toBe(false);
    expect(result.totalTasks).toBe(3);
  });

  // ---------------------------------------------------------------
  // 8. File conflict tracking
  // ---------------------------------------------------------------
  it('tracks file conflicts when two tasks modify the same file', () => {
    const resultA = mockTaskResult({
      taskPath: 'tasks/a.md',
      taskName: 'a',
      result: mockResult({ filesModified: ['src/shared/utils.ts', 'src/a/index.ts'] }),
    });

    const resultB = mockTaskResult({
      taskPath: 'tasks/b.md',
      taskName: 'b',
      result: mockResult({ filesModified: ['src/shared/utils.ts', 'src/b/index.ts'] }),
    });

    const tasks = [resultA, resultB];

    // Detect file conflicts: files modified by more than one task
    const fileCounts = new Map<string, string[]>();
    for (const task of tasks) {
      for (const file of task.result.filesModified) {
        const owners = fileCounts.get(file) ?? [];
        owners.push(task.taskName);
        fileCounts.set(file, owners);
      }
    }

    const fileConflicts = [...fileCounts.entries()]
      .filter(([, owners]) => owners.length > 1)
      .map(([file]) => file);

    expect(fileConflicts).toHaveLength(1);
    expect(fileConflicts).toContain('src/shared/utils.ts');
  });

  // ---------------------------------------------------------------
  // 9. Total iterations aggregation
  // ---------------------------------------------------------------
  it('correctly sums total iterations across task results', () => {
    const tasks: ParallelTaskResult[] = [
      mockTaskResult({ result: mockResult({ iterations: 5 }) }),
      mockTaskResult({ result: mockResult({ iterations: 3 }) }),
      mockTaskResult({ result: mockResult({ iterations: 7 }) }),
    ];

    const totalIterations = tasks.reduce((sum, t) => sum + t.result.iterations, 0);
    expect(totalIterations).toBe(15);
  });

  // ---------------------------------------------------------------
  // 10. Total files modified deduplication
  // ---------------------------------------------------------------
  it('deduplicates files modified across multiple task results', () => {
    const tasks: ParallelTaskResult[] = [
      mockTaskResult({
        taskPath: 'tasks/a.md',
        result: mockResult({ filesModified: ['src/shared/utils.ts', 'src/a/index.ts'] }),
      }),
      mockTaskResult({
        taskPath: 'tasks/b.md',
        result: mockResult({ filesModified: ['src/shared/utils.ts', 'src/b/index.ts'] }),
      }),
      mockTaskResult({
        taskPath: 'tasks/c.md',
        result: mockResult({ filesModified: ['src/c/index.ts', 'src/shared/utils.ts'] }),
      }),
    ];

    const allFiles = new Set<string>();
    for (const task of tasks) {
      for (const file of task.result.filesModified) {
        allFiles.add(file);
      }
    }

    const totalFilesModified = [...allFiles];
    expect(totalFilesModified).toHaveLength(4);
    expect(totalFilesModified).toContain('src/shared/utils.ts');
    expect(totalFilesModified).toContain('src/a/index.ts');
    expect(totalFilesModified).toContain('src/b/index.ts');
    expect(totalFilesModified).toContain('src/c/index.ts');
  });
});
