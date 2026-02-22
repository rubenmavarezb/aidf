// packages/cli/src/core/plan-parser.test.ts

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PlanParser } from './plan-parser.js';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { existsSync } from 'fs';

describe('PlanParser', () => {
  let parser: PlanParser;
  let tempDir: string;

  beforeEach(async () => {
    parser = new PlanParser();
    tempDir = join(tmpdir(), `plan-parser-test-${Date.now()}`);
    await mkdir(join(tempDir, '.ai', 'tasks', 'pending'), { recursive: true });
    await mkdir(join(tempDir, '.ai', 'tasks', 'completed'), { recursive: true });
    await mkdir(join(tempDir, '.ai', 'plans'), { recursive: true });
  });

  afterEach(async () => {
    if (existsSync(tempDir)) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  const writePlan = async (content: string): Promise<string> => {
    const path = join(tempDir, '.ai', 'plans', 'PLAN-test.md');
    await writeFile(path, content);
    return path;
  };

  const writeTask = async (filename: string, dir = 'pending'): Promise<void> => {
    await writeFile(
      join(tempDir, '.ai', 'tasks', dir, filename),
      `# TASK\n\n## Goal\nTest task\n`
    );
  };

  describe('extractTasks', () => {
    it('parses basic checkbox lines', () => {
      const lines = [
        '# PLAN: Test',
        '',
        '- [ ] `001-foo.md` — Do something',
        '- [x] `002-bar.md` — Already done',
      ];

      const tasks = parser.extractTasks(lines, tempDir);

      expect(tasks).toHaveLength(2);
      expect(tasks[0].filename).toBe('001-foo.md');
      expect(tasks[0].description).toBe('Do something');
      expect(tasks[0].completed).toBe(false);
      expect(tasks[0].lineNumber).toBe(3);

      expect(tasks[1].filename).toBe('002-bar.md');
      expect(tasks[1].completed).toBe(true);
      expect(tasks[1].lineNumber).toBe(4);
    });

    it('parses wave metadata', () => {
      const lines = [
        '- [ ] `001-foo.md` — Task one (wave: 2)',
      ];

      const tasks = parser.extractTasks(lines, tempDir);

      expect(tasks[0].wave).toBe(2);
    });

    it('parses depends metadata', () => {
      const lines = [
        '- [ ] `003-baz.md` — Task three (wave: 2, depends: 001-foo.md, 002-bar.md)',
      ];

      const tasks = parser.extractTasks(lines, tempDir);

      expect(tasks[0].dependsOn).toEqual(['001-foo.md', '002-bar.md']);
      expect(tasks[0].wave).toBe(2);
    });

    it('handles em dash, en dash, and hyphen separators', () => {
      const lines = [
        '- [ ] `001-foo.md` — with em dash',
        '- [ ] `002-bar.md` – with en dash',
        '- [ ] `003-baz.md` - with hyphen',
      ];

      const tasks = parser.extractTasks(lines, tempDir);
      expect(tasks).toHaveLength(3);
    });

    it('handles uppercase X for completed tasks', () => {
      const lines = ['- [X] `001-foo.md` — Done'];
      const tasks = parser.extractTasks(lines, tempDir);
      expect(tasks[0].completed).toBe(true);
    });

    it('skips non-task lines', () => {
      const lines = [
        '# PLAN: Test',
        '## Overview',
        'Some text',
        '- Regular list item',
        '- [ ] Not a task reference',
        '- [ ] `001-foo.md` — Actual task',
      ];

      const tasks = parser.extractTasks(lines, tempDir);
      expect(tasks).toHaveLength(1);
    });
  });

  describe('resolveTaskPath', () => {
    it('finds task in pending directory', async () => {
      await writeTask('001-foo.md', 'pending');

      const result = parser.resolveTaskPath('001-foo.md', tempDir);
      expect(result).toBe(join(tempDir, '.ai', 'tasks', 'pending', '001-foo.md'));
    });

    it('finds task in completed directory', async () => {
      await writeTask('002-bar.md', 'completed');

      const result = parser.resolveTaskPath('002-bar.md', tempDir);
      expect(result).toBe(join(tempDir, '.ai', 'tasks', 'completed', '002-bar.md'));
    });

    it('falls back to pending path for missing tasks', () => {
      const result = parser.resolveTaskPath('999-missing.md', tempDir);
      expect(result).toBe(join(tempDir, '.ai', 'tasks', 'pending', '999-missing.md'));
    });
  });

  describe('wave assignment', () => {
    it('assigns wave 1 to tasks without explicit wave', async () => {
      await writeTask('001-foo.md');
      await writeTask('002-bar.md');

      const planContent = [
        '# PLAN: Test',
        '## Overview',
        'Test plan',
        '## Tasks',
        '- [ ] `001-foo.md` — First task',
        '- [ ] `002-bar.md` — Second task',
      ].join('\n');

      const planPath = await writePlan(planContent);
      const plan = await parser.parse(planPath, tempDir);

      expect(plan.tasks[0].wave).toBe(1);
      expect(plan.tasks[1].wave).toBe(1);
      expect(plan.waves).toHaveLength(1);
    });

    it('assigns wave N+1 to tasks with dependencies', async () => {
      await writeTask('001-foo.md');
      await writeTask('002-bar.md');

      const planContent = [
        '# PLAN: Test',
        '## Overview',
        'Test plan',
        '## Tasks',
        '- [ ] `001-foo.md` — First task',
        '- [ ] `002-bar.md` — Depends on first (depends: 001-foo.md)',
      ].join('\n');

      const planPath = await writePlan(planContent);
      const plan = await parser.parse(planPath, tempDir);

      expect(plan.tasks[0].wave).toBe(1);
      expect(plan.tasks[1].wave).toBe(2);
      expect(plan.waves).toHaveLength(2);
    });

    it('respects explicit wave assignments', async () => {
      await writeTask('001-foo.md');

      const planContent = [
        '# PLAN: Test',
        '## Tasks',
        '- [ ] `001-foo.md` — Explicit wave (wave: 3)',
      ].join('\n');

      const planPath = await writePlan(planContent);
      const plan = await parser.parse(planPath, tempDir);

      expect(plan.tasks[0].wave).toBe(3);
    });
  });

  describe('cycle detection', () => {
    it('throws on direct cycle', async () => {
      await writeTask('001-foo.md');
      await writeTask('002-bar.md');

      const planContent = [
        '# PLAN: Test',
        '## Tasks',
        '- [ ] `001-foo.md` — First (depends: 002-bar.md)',
        '- [ ] `002-bar.md` — Second (depends: 001-foo.md)',
      ].join('\n');

      const planPath = await writePlan(planContent);
      await expect(parser.parse(planPath, tempDir)).rejects.toThrow(/cycle/i);
    });

    it('throws on transitive cycle', async () => {
      await writeTask('001-a.md');
      await writeTask('002-b.md');
      await writeTask('003-c.md');

      const planContent = [
        '# PLAN: Test',
        '## Tasks',
        '- [ ] `001-a.md` — A (depends: 003-c.md)',
        '- [ ] `002-b.md` — B (depends: 001-a.md)',
        '- [ ] `003-c.md` — C (depends: 002-b.md)',
      ].join('\n');

      const planPath = await writePlan(planContent);
      await expect(parser.parse(planPath, tempDir)).rejects.toThrow(/cycle/i);
    });

    it('does not throw on valid DAG', async () => {
      await writeTask('001-a.md');
      await writeTask('002-b.md');
      await writeTask('003-c.md');

      const planContent = [
        '# PLAN: Test',
        '## Tasks',
        '- [ ] `001-a.md` — A',
        '- [ ] `002-b.md` — B (depends: 001-a.md)',
        '- [ ] `003-c.md` — C (depends: 001-a.md, 002-b.md)',
      ].join('\n');

      const planPath = await writePlan(planContent);
      const plan = await parser.parse(planPath, tempDir);

      expect(plan.tasks).toHaveLength(3);
      expect(plan.tasks[2].wave).toBe(3); // C depends on B which depends on A
    });
  });

  describe('parse (full)', () => {
    it('extracts plan name from heading', async () => {
      const planContent = '# PLAN: v1.0.0 — Feature Release\n## Overview\nSome overview\n';
      const planPath = await writePlan(planContent);
      const plan = await parser.parse(planPath, tempDir);

      expect(plan.name).toBe('v1.0.0 — Feature Release');
    });

    it('extracts overview section', async () => {
      const planContent = [
        '# PLAN: Test',
        '## Overview',
        'This is the overview.',
        'It spans multiple lines.',
        '## Tasks',
        '- Some other content',
      ].join('\n');

      const planPath = await writePlan(planContent);
      const plan = await parser.parse(planPath, tempDir);

      expect(plan.overview).toBe('This is the overview.\nIt spans multiple lines.');
    });

    it('groups tasks into sorted waves', async () => {
      await writeTask('001-a.md');
      await writeTask('002-b.md');
      await writeTask('003-c.md');

      const planContent = [
        '# PLAN: Test',
        '## Tasks',
        '- [ ] `001-a.md` — A (wave: 1)',
        '- [ ] `002-b.md` — B (wave: 2)',
        '- [ ] `003-c.md` — C (wave: 1)',
      ].join('\n');

      const planPath = await writePlan(planContent);
      const plan = await parser.parse(planPath, tempDir);

      expect(plan.waves).toHaveLength(2);
      expect(plan.waves[0].number).toBe(1);
      expect(plan.waves[0].tasks).toHaveLength(2);
      expect(plan.waves[1].number).toBe(2);
      expect(plan.waves[1].tasks).toHaveLength(1);
    });
  });

  describe('markTaskCompleted', () => {
    it('updates checkbox from [ ] to [x]', async () => {
      const planContent = [
        '# PLAN: Test',
        '- [ ] `001-foo.md` — First task',
        '- [ ] `002-bar.md` — Second task',
      ].join('\n');

      const planPath = await writePlan(planContent);
      await PlanParser.markTaskCompleted(planPath, 2); // line 2

      const { readFile: readFileAsync } = await import('fs/promises');
      const updated = await readFileAsync(planPath, 'utf-8');
      expect(updated).toContain('- [x] `001-foo.md`');
      expect(updated).toContain('- [ ] `002-bar.md`');
    });
  });

  describe('planNameFromPath', () => {
    it('extracts name from path', () => {
      expect(PlanParser.planNameFromPath('/path/to/PLAN-v110.md')).toBe('PLAN-v110');
    });
  });
});
