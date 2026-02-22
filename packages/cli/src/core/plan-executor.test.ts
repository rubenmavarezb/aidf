// packages/cli/src/core/plan-executor.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlanExecutor } from './plan-executor.js';
import { PlanParser } from './plan-parser.js';
import type { ParsedPlan, PlanTask, PlanWave, ExecutorResult } from '../types/index.js';

// Mock dependencies
vi.mock('./executor.js', () => ({
  executeTask: vi.fn(),
}));

vi.mock('./parallel-executor.js', () => ({
  ParallelExecutor: vi.fn().mockImplementation(() => ({
    run: vi.fn(),
  })),
}));

import { executeTask } from './executor.js';
import { ParallelExecutor } from './parallel-executor.js';

const mockedExecuteTask = vi.mocked(executeTask);

function makePlan(overrides: Partial<ParsedPlan> = {}): ParsedPlan {
  const tasks: PlanTask[] = overrides.tasks || [
    {
      filename: '001-foo.md',
      taskPath: '/project/.ai/tasks/pending/001-foo.md',
      description: 'First task',
      wave: 1,
      dependsOn: [],
      completed: false,
      lineNumber: 3,
    },
  ];

  const waves: PlanWave[] = overrides.waves || [
    { number: 1, tasks },
  ];

  return {
    planPath: '/project/.ai/plans/PLAN-test.md',
    name: 'Test Plan',
    overview: 'A test plan',
    tasks,
    waves,
    ...overrides,
  };
}

function makeResult(overrides: Partial<ExecutorResult> = {}): ExecutorResult {
  return {
    success: true,
    status: 'completed',
    iterations: 3,
    filesModified: ['src/foo.ts'],
    taskPath: '/project/.ai/tasks/pending/001-foo.md',
    ...overrides,
  };
}

describe('PlanExecutor', () => {
  let executor: PlanExecutor;

  beforeEach(() => {
    vi.clearAllMocks();
    executor = new PlanExecutor({
      concurrency: 3,
      continueOnError: false,
      dryRun: false,
      verbose: false,
    });

    // Default: markTaskCompleted is a no-op in tests
    vi.spyOn(PlanParser, 'markTaskCompleted').mockResolvedValue(undefined);
  });

  it('executes a single-task wave using executeTask', async () => {
    const plan = makePlan();
    mockedExecuteTask.mockResolvedValue(makeResult());

    const result = await executor.run(plan);

    expect(mockedExecuteTask).toHaveBeenCalledOnce();
    expect(result.success).toBe(true);
    expect(result.completedTasks).toBe(1);
  });

  it('skips already completed tasks', async () => {
    const plan = makePlan({
      tasks: [
        {
          filename: '001-foo.md',
          taskPath: '/project/.ai/tasks/completed/001-foo.md',
          description: 'Already done',
          wave: 1,
          dependsOn: [],
          completed: true,
          lineNumber: 3,
        },
      ],
      waves: [
        {
          number: 1,
          tasks: [{
            filename: '001-foo.md',
            taskPath: '/project/.ai/tasks/completed/001-foo.md',
            description: 'Already done',
            wave: 1,
            dependsOn: [],
            completed: true,
            lineNumber: 3,
          }],
        },
      ],
    });

    const result = await executor.run(plan);

    expect(mockedExecuteTask).not.toHaveBeenCalled();
    expect(result.skippedTasks).toBe(1);
    expect(result.success).toBe(true);
  });

  it('marks tasks completed in plan file after success', async () => {
    const plan = makePlan();
    mockedExecuteTask.mockResolvedValue(makeResult());

    await executor.run(plan);

    expect(PlanParser.markTaskCompleted).toHaveBeenCalledWith(
      plan.planPath,
      3, // lineNumber
    );
  });

  it('stops on failure by default', async () => {
    const task1: PlanTask = {
      filename: '001-foo.md',
      taskPath: '/project/.ai/tasks/pending/001-foo.md',
      description: 'First task',
      wave: 1,
      dependsOn: [],
      completed: false,
      lineNumber: 3,
    };
    const task2: PlanTask = {
      filename: '002-bar.md',
      taskPath: '/project/.ai/tasks/pending/002-bar.md',
      description: 'Second task',
      wave: 2,
      dependsOn: [],
      completed: false,
      lineNumber: 4,
    };

    const plan = makePlan({
      tasks: [task1, task2],
      waves: [
        { number: 1, tasks: [task1] },
        { number: 2, tasks: [task2] },
      ],
    });

    mockedExecuteTask.mockResolvedValue(makeResult({
      success: false,
      status: 'failed',
      error: 'Something went wrong',
    }));

    const result = await executor.run(plan);

    expect(result.success).toBe(false);
    expect(result.failedTasks).toBe(1);
    // Second wave should not have been executed
    expect(mockedExecuteTask).toHaveBeenCalledOnce();
  });

  it('continues on error with --continue-on-error', async () => {
    executor = new PlanExecutor({
      concurrency: 3,
      continueOnError: true,
      dryRun: false,
      verbose: false,
    });

    const task1: PlanTask = {
      filename: '001-foo.md',
      taskPath: '/project/.ai/tasks/pending/001-foo.md',
      description: 'First task',
      wave: 1,
      dependsOn: [],
      completed: false,
      lineNumber: 3,
    };
    const task2: PlanTask = {
      filename: '002-bar.md',
      taskPath: '/project/.ai/tasks/pending/002-bar.md',
      description: 'Second task',
      wave: 2,
      dependsOn: [],
      completed: false,
      lineNumber: 4,
    };

    const plan = makePlan({
      tasks: [task1, task2],
      waves: [
        { number: 1, tasks: [task1] },
        { number: 2, tasks: [task2] },
      ],
    });

    mockedExecuteTask
      .mockResolvedValueOnce(makeResult({ success: false, status: 'failed', error: 'fail' }))
      .mockResolvedValueOnce(makeResult({ success: true }));

    const result = await executor.run(plan);

    expect(mockedExecuteTask).toHaveBeenCalledTimes(2);
    expect(result.success).toBe(false);
    expect(result.failedTasks).toBe(1);
    expect(result.completedTasks).toBe(1);
  });

  it('returns early in dry-run mode without executing', async () => {
    executor = new PlanExecutor({
      concurrency: 3,
      continueOnError: false,
      dryRun: true,
      verbose: false,
    });

    const plan = makePlan();
    const result = await executor.run(plan);

    expect(mockedExecuteTask).not.toHaveBeenCalled();
    expect(result.totalTasks).toBe(1);
  });

  it('uses ParallelExecutor for multi-task waves', async () => {
    const task1: PlanTask = {
      filename: '001-foo.md',
      taskPath: '/project/.ai/tasks/pending/001-foo.md',
      description: 'First',
      wave: 1,
      dependsOn: [],
      completed: false,
      lineNumber: 3,
    };
    const task2: PlanTask = {
      filename: '002-bar.md',
      taskPath: '/project/.ai/tasks/pending/002-bar.md',
      description: 'Second',
      wave: 1,
      dependsOn: [],
      completed: false,
      lineNumber: 4,
    };

    const plan = makePlan({
      tasks: [task1, task2],
      waves: [{ number: 1, tasks: [task1, task2] }],
    });

    const mockRun = vi.fn().mockResolvedValue({
      success: true,
      totalTasks: 2,
      completed: 2,
      failed: 0,
      blocked: 0,
      skipped: 0,
      tasks: [
        { taskPath: task1.taskPath, result: { success: true } },
        { taskPath: task2.taskPath, result: { success: true } },
      ],
    });

    vi.mocked(ParallelExecutor).mockImplementation(() => ({
      run: mockRun,
    }) as any);

    const result = await executor.run(plan);

    expect(ParallelExecutor).toHaveBeenCalled();
    expect(mockRun).toHaveBeenCalledWith([task1.taskPath, task2.taskPath]);
    expect(result.completedTasks).toBe(2);
  });

  it('handles executeTask throwing an error', async () => {
    const plan = makePlan();
    mockedExecuteTask.mockRejectedValue(new Error('Provider unavailable'));

    const result = await executor.run(plan);

    expect(result.success).toBe(false);
    expect(result.failedTasks).toBe(1);
  });

  it('reports blocked tasks', async () => {
    const plan = makePlan();
    mockedExecuteTask.mockResolvedValue(makeResult({
      success: false,
      status: 'blocked',
      blockedReason: 'Waiting for API key',
    }));

    const result = await executor.run(plan);

    expect(result.success).toBe(false);
  });
});
