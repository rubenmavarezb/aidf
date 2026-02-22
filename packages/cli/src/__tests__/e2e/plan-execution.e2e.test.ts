// packages/cli/src/__tests__/e2e/plan-execution.e2e.test.ts

import { describe, it, expect } from 'vitest';
import { createTempProject, createTaskFixture } from './helpers/index.js';
import { PlanParser } from '../../core/plan-parser.js';
import { PlanExecutor } from '../../core/plan-executor.js';
import { writeFile, readFile, mkdir, readdir } from 'fs/promises';
import { join } from 'path';

/**
 * Helper: create a plan file in .ai/plans/
 */
async function createPlanFixture(
  projectRoot: string,
  name: string,
  content: string
): Promise<string> {
  const plansDir = join(projectRoot, '.ai', 'plans');
  await mkdir(plansDir, { recursive: true });
  const planPath = join(plansDir, `PLAN-${name}.md`);
  await writeFile(planPath, content);
  return planPath;
}

describe('Plan Execution E2E', () => {
  it('should parse a plan file and extract tasks with correct metadata', async () => {
    const { projectRoot, cleanup } = await createTempProject();
    try {
      await createTaskFixture(projectRoot, {
        id: '001',
        goal: 'Add user model',
        type: 'component',
        allowedScope: ['src/models/**'],
        forbiddenScope: ['.env'],
        requirements: 'Create User model.',
        definitionOfDone: ['Model created'],
      });
      await createTaskFixture(projectRoot, {
        id: '002',
        goal: 'Add user API',
        type: 'component',
        allowedScope: ['src/api/**'],
        forbiddenScope: ['.env'],
        requirements: 'Create user endpoints.',
        definitionOfDone: ['Endpoints work'],
      });

      const planPath = await createPlanFixture(projectRoot, 'test', [
        '# PLAN: Test Feature',
        '',
        '## Overview',
        '',
        'Implement user management.',
        '',
        '## Tasks',
        '',
        '- [ ] `001-task.md` — Add user model',
        '- [ ] `002-task.md` — Add user API (depends: 001-task.md)',
      ].join('\n'));

      const parser = new PlanParser();
      const plan = await parser.parse(planPath, projectRoot);

      expect(plan.name).toBe('Test Feature');
      expect(plan.overview).toBe('Implement user management.');
      expect(plan.tasks).toHaveLength(2);

      expect(plan.tasks[0].filename).toBe('001-task.md');
      expect(plan.tasks[0].completed).toBe(false);
      expect(plan.tasks[0].wave).toBe(1);
      expect(plan.tasks[0].taskPath).toContain('001-task.md');

      expect(plan.tasks[1].filename).toBe('002-task.md');
      expect(plan.tasks[1].dependsOn).toEqual(['001-task.md']);
      expect(plan.tasks[1].wave).toBe(2);

      expect(plan.waves).toHaveLength(2);
      expect(plan.waves[0].number).toBe(1);
      expect(plan.waves[0].tasks).toHaveLength(1);
      expect(plan.waves[1].number).toBe(2);
      expect(plan.waves[1].tasks).toHaveLength(1);
    } finally {
      await cleanup();
    }
  });

  it('should resolve task paths from pending, completed, and blocked directories', async () => {
    const { projectRoot, cleanup } = await createTempProject();
    try {
      // Create tasks in different directories
      await createTaskFixture(projectRoot, {
        id: '010',
        goal: 'Pending task',
        type: 'component',
        allowedScope: ['src/**'],
        forbiddenScope: [],
        requirements: 'Pending.',
        definitionOfDone: ['Done'],
      });

      // Move one task to completed
      const completedDir = join(projectRoot, '.ai', 'tasks', 'completed');
      await writeFile(join(completedDir, '011-task.md'), '# TASK\n\n## Goal\nCompleted task\n');

      // Put one in blocked
      const blockedDir = join(projectRoot, '.ai', 'tasks', 'blocked');
      await writeFile(join(blockedDir, '012-task.md'), '# TASK\n\n## Goal\nBlocked task\n');

      const parser = new PlanParser();

      const pendingPath = parser.resolveTaskPath('010-task.md', projectRoot);
      expect(pendingPath).toContain(join('tasks', 'pending', '010-task.md'));

      const completedPath = parser.resolveTaskPath('011-task.md', projectRoot);
      expect(completedPath).toContain(join('tasks', 'completed', '011-task.md'));

      const blockedPath = parser.resolveTaskPath('012-task.md', projectRoot);
      expect(blockedPath).toContain(join('tasks', 'blocked', '012-task.md'));
    } finally {
      await cleanup();
    }
  });

  it('should skip already-completed tasks when running a plan', async () => {
    const { projectRoot, cleanup } = await createTempProject();
    try {
      await createTaskFixture(projectRoot, {
        id: '001',
        goal: 'Already done',
        type: 'component',
        allowedScope: ['src/**'],
        forbiddenScope: [],
        requirements: 'Done.',
        definitionOfDone: ['Done'],
      });
      await createTaskFixture(projectRoot, {
        id: '002',
        goal: 'Not done yet',
        type: 'component',
        allowedScope: ['src/**'],
        forbiddenScope: [],
        requirements: 'Todo.',
        definitionOfDone: ['Done'],
      });

      const planPath = await createPlanFixture(projectRoot, 'skip-test', [
        '# PLAN: Skip Test',
        '',
        '## Overview',
        '',
        'Test skipping completed tasks.',
        '',
        '## Tasks',
        '',
        '- [x] `001-task.md` — Already done',
        '- [ ] `002-task.md` — Not done yet',
      ].join('\n'));

      const parser = new PlanParser();
      const plan = await parser.parse(planPath, projectRoot);

      expect(plan.tasks[0].completed).toBe(true);
      expect(plan.tasks[1].completed).toBe(false);

      // Dry-run should not execute anything
      const executor = new PlanExecutor({
        concurrency: 1,
        continueOnError: false,
        dryRun: true,
        verbose: false,
      });

      const result = await executor.run(plan);
      expect(result.skippedTasks).toBe(1);
      expect(result.totalTasks).toBe(2);
    } finally {
      await cleanup();
    }
  });

  it('should update checkboxes in plan file after marking task completed', async () => {
    const { projectRoot, cleanup } = await createTempProject();
    try {
      const planContent = [
        '# PLAN: Checkbox Test',
        '',
        '- [ ] `001-task.md` — First task',
        '- [ ] `002-task.md` — Second task',
        '- [ ] `003-task.md` — Third task',
      ].join('\n');

      const planPath = await createPlanFixture(projectRoot, 'checkbox', planContent);

      // Mark line 3 (001-task.md) as completed
      await PlanParser.markTaskCompleted(planPath, 3);

      const updated = await readFile(planPath, 'utf-8');
      const lines = updated.split('\n');

      expect(lines[2]).toContain('- [x] `001-task.md`');
      expect(lines[3]).toContain('- [ ] `002-task.md`');
      expect(lines[4]).toContain('- [ ] `003-task.md`');

      // Mark line 5 (003-task.md) as completed
      await PlanParser.markTaskCompleted(planPath, 5);

      const updated2 = await readFile(planPath, 'utf-8');
      const lines2 = updated2.split('\n');

      expect(lines2[2]).toContain('- [x] `001-task.md`');
      expect(lines2[3]).toContain('- [ ] `002-task.md`');
      expect(lines2[4]).toContain('- [x] `003-task.md`');
    } finally {
      await cleanup();
    }
  });

  it('should detect dependency cycles and throw an error', async () => {
    const { projectRoot, cleanup } = await createTempProject();
    try {
      await createTaskFixture(projectRoot, {
        id: '001', goal: 'A', type: 'component',
        allowedScope: ['src/**'], forbiddenScope: [],
        requirements: 'A.', definitionOfDone: ['Done'],
      });
      await createTaskFixture(projectRoot, {
        id: '002', goal: 'B', type: 'component',
        allowedScope: ['src/**'], forbiddenScope: [],
        requirements: 'B.', definitionOfDone: ['Done'],
      });

      const planPath = await createPlanFixture(projectRoot, 'cycle', [
        '# PLAN: Cycle Test',
        '',
        '## Tasks',
        '',
        '- [ ] `001-task.md` — A (depends: 002-task.md)',
        '- [ ] `002-task.md` — B (depends: 001-task.md)',
      ].join('\n'));

      const parser = new PlanParser();
      await expect(parser.parse(planPath, projectRoot)).rejects.toThrow(/cycle/i);
    } finally {
      await cleanup();
    }
  });

  it('should handle a plan with multiple waves and explicit wave assignments', async () => {
    const { projectRoot, cleanup } = await createTempProject();
    try {
      for (const id of ['001', '002', '003', '004']) {
        await createTaskFixture(projectRoot, {
          id, goal: `Task ${id}`, type: 'component',
          allowedScope: ['src/**'], forbiddenScope: [],
          requirements: `Task ${id}.`, definitionOfDone: ['Done'],
        });
      }

      const planPath = await createPlanFixture(projectRoot, 'waves', [
        '# PLAN: Multi-Wave',
        '',
        '## Overview',
        '',
        'Tasks across 3 waves.',
        '',
        '## Tasks',
        '',
        '- [ ] `001-task.md` — Foundation (wave: 1)',
        '- [ ] `002-task.md` — Also foundation (wave: 1)',
        '- [ ] `003-task.md` — Depends on wave 1 (wave: 2)',
        '- [ ] `004-task.md` — Final integration (wave: 3)',
      ].join('\n'));

      const parser = new PlanParser();
      const plan = await parser.parse(planPath, projectRoot);

      expect(plan.waves).toHaveLength(3);
      expect(plan.waves[0].number).toBe(1);
      expect(plan.waves[0].tasks).toHaveLength(2);
      expect(plan.waves[1].number).toBe(2);
      expect(plan.waves[1].tasks).toHaveLength(1);
      expect(plan.waves[2].number).toBe(3);
      expect(plan.waves[2].tasks).toHaveLength(1);
    } finally {
      await cleanup();
    }
  });

  it('should parse a real plan from the project repository', async () => {
    // Parse one of the actual plans in this repo
    const projectRoot = join(process.cwd());
    const plansDir = join(projectRoot, '.ai', 'plans');

    let files: string[];
    try {
      files = await readdir(plansDir);
    } catch {
      // Skip if no plans directory (running outside repo)
      return;
    }

    const planFiles = files.filter((f: string) => f.startsWith('PLAN-') && f.endsWith('.md'));
    if (planFiles.length === 0) return;

    const parser = new PlanParser();
    const planPath = join(plansDir, planFiles[0]);
    const plan = await parser.parse(planPath, projectRoot);

    // Basic structure should be valid
    expect(plan.planPath).toBe(planPath);
    expect(plan.name).toBeTruthy();
    expect(typeof plan.name).toBe('string');
    // Tasks may or may not exist depending on the plan
    expect(Array.isArray(plan.tasks)).toBe(true);
    expect(Array.isArray(plan.waves)).toBe(true);
  });

  it('should handle a plan with all tasks completed (fully done)', async () => {
    const { projectRoot, cleanup } = await createTempProject();
    try {
      await createTaskFixture(projectRoot, {
        id: '001', goal: 'Done', type: 'component',
        allowedScope: ['src/**'], forbiddenScope: [],
        requirements: 'Done.', definitionOfDone: ['Done'],
      });

      const planPath = await createPlanFixture(projectRoot, 'all-done', [
        '# PLAN: All Done',
        '',
        '## Tasks',
        '',
        '- [x] `001-task.md` — Already completed',
      ].join('\n'));

      const parser = new PlanParser();
      const plan = await parser.parse(planPath, projectRoot);

      const executor = new PlanExecutor({
        concurrency: 1,
        continueOnError: false,
        dryRun: false,
        verbose: false,
      });

      const result = await executor.run(plan);

      expect(result.success).toBe(true);
      expect(result.skippedTasks).toBe(1);
      expect(result.completedTasks).toBe(1);
      expect(result.failedTasks).toBe(0);
    } finally {
      await cleanup();
    }
  });

  it('should handle a plan with no task references', async () => {
    const { projectRoot, cleanup } = await createTempProject();
    try {
      const planPath = await createPlanFixture(projectRoot, 'empty', [
        '# PLAN: Empty Plan',
        '',
        '## Overview',
        '',
        'This plan has no tasks yet.',
        '',
        '## Goals',
        '',
        '- Think about things',
      ].join('\n'));

      const parser = new PlanParser();
      const plan = await parser.parse(planPath, projectRoot);

      expect(plan.tasks).toHaveLength(0);
      expect(plan.waves).toHaveLength(0);
    } finally {
      await cleanup();
    }
  });

  it('should dry-run a multi-wave plan without executing anything', async () => {
    const { projectRoot, cleanup } = await createTempProject();
    try {
      for (const id of ['001', '002', '003']) {
        await createTaskFixture(projectRoot, {
          id, goal: `Task ${id}`, type: 'component',
          allowedScope: ['src/**'], forbiddenScope: [],
          requirements: `Req ${id}.`, definitionOfDone: ['Done'],
        });
      }

      const planPath = await createPlanFixture(projectRoot, 'dry-multi', [
        '# PLAN: Dry Run Multi',
        '',
        '## Overview',
        '',
        'Three tasks in two waves.',
        '',
        '## Tasks',
        '',
        '- [ ] `001-task.md` — First',
        '- [ ] `002-task.md` — Second',
        '- [ ] `003-task.md` — Third (depends: 001-task.md, 002-task.md)',
      ].join('\n'));

      const parser = new PlanParser();
      const plan = await parser.parse(planPath, projectRoot);

      // Wave structure: wave 1 has 001 + 002, wave 2 has 003
      expect(plan.waves).toHaveLength(2);
      expect(plan.waves[0].tasks.map((t: { filename: string }) => t.filename)).toEqual(['001-task.md', '002-task.md']);
      expect(plan.waves[1].tasks.map((t: { filename: string }) => t.filename)).toEqual(['003-task.md']);

      const executor = new PlanExecutor({
        concurrency: 2,
        continueOnError: false,
        dryRun: true,
        verbose: false,
      });

      const result = await executor.run(plan);

      // Dry run: nothing executed, nothing failed
      expect(result.totalTasks).toBe(3);
      expect(result.failedTasks).toBe(0);
      expect(result.completedTasks).toBe(0);

      // Plan file should be unchanged (no checkboxes updated)
      const planAfter = await readFile(planPath, 'utf-8');
      expect(planAfter).not.toContain('[x]');
    } finally {
      await cleanup();
    }
  });
});
