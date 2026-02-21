// packages/cli/src/__tests__/e2e/git-operations.e2e.test.ts

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTempProject,
  createTaskFixture,
  initGitRepo,
  type TempProjectResult,
} from './helpers/index.js';
import { writeFile, mkdir, readFile, access } from 'fs/promises';
import { existsSync } from 'fs';
import { join, basename, dirname } from 'path';
import { simpleGit, type SimpleGit } from 'simple-git';
import { checkFileChanges } from '../../core/safety.js';
import { moveTaskFile } from '../../utils/files.js';
import type { FileChange } from '../../types/index.js';

describe('Git Operations E2E', () => {
  it('should initialize a git repo and verify .git exists', async () => {
    const { projectRoot, cleanup } = await createTempProject({ withGit: true });

    try {
      expect(existsSync(join(projectRoot, '.git'))).toBe(true);

      const git = simpleGit(projectRoot);
      const status = await git.status();
      expect(status.isClean()).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it('should create and commit a file, verify git log', async () => {
    const { projectRoot, cleanup } = await createTempProject({ withGit: true });

    try {
      const git = simpleGit(projectRoot);

      await mkdir(join(projectRoot, 'src'), { recursive: true });
      await writeFile(join(projectRoot, 'src', 'index.ts'), 'export const main = () => {};\n');

      await git.add('src/index.ts');
      await git.commit('aidf: add index', { '--no-gpg-sign': null });

      const log = await git.log();
      expect(log.latest!.message).toMatch(/^aidf:/);
    } finally {
      await cleanup();
    }
  });

  it('should simulate auto-commit flow', async () => {
    const { projectRoot, cleanup } = await createTempProject({ withGit: true });

    try {
      const git = simpleGit(projectRoot);

      await mkdir(join(projectRoot, 'src'), { recursive: true });
      await writeFile(join(projectRoot, 'src', 'feature.ts'), 'export function feature() { return true; }\n');

      await git.add('src/feature.ts');
      await git.commit('aidf: add feature module', { '--no-gpg-sign': null });

      const log = await git.log();
      expect(log.latest!.message).toBe('aidf: add feature module');

      const diff = await git.diff(['--name-only', 'HEAD~1', 'HEAD']);
      expect(diff).toContain('src/feature.ts');
    } finally {
      await cleanup();
    }
  });

  it('should create a branch with the configured prefix', async () => {
    const { projectRoot, cleanup } = await createTempProject({ withGit: true });

    try {
      const git = simpleGit(projectRoot);

      await git.checkoutLocalBranch('aidf/task-001');

      const branches = await git.branchLocal();
      expect(branches.all).toContain('aidf/task-001');
    } finally {
      await cleanup();
    }
  });

  it('should block forbidden files in scope check against git diff', async () => {
    const { projectRoot, cleanup } = await createTempProject({ withGit: true });

    try {
      const git = simpleGit(projectRoot);

      // Commit a baseline file
      await mkdir(join(projectRoot, 'src'), { recursive: true });
      await writeFile(join(projectRoot, 'src', 'baseline.ts'), 'export const x = 1;\n');
      await git.add('src/baseline.ts');
      await git.commit('aidf: add baseline', { '--no-gpg-sign': null });

      // Create files in allowed and forbidden scope
      await writeFile(join(projectRoot, 'src', 'good.ts'), 'export const good = true;\n');
      await mkdir(join(projectRoot, 'config'), { recursive: true });
      await writeFile(join(projectRoot, 'config', 'bad.ts'), 'export const bad = true;\n');

      const status = await git.status();
      const changes: FileChange[] = [
        ...status.not_added.map(f => ({ path: f, type: 'created' as const })),
        ...status.modified.map(f => ({ path: f, type: 'modified' as const })),
        ...status.created.map(f => ({ path: f, type: 'created' as const })),
      ];

      const decision = checkFileChanges(
        changes,
        { allowed: ['src/**'], forbidden: ['config/**'] },
        'strict'
      );

      expect(decision.action).toBe('BLOCK');
      if (decision.action === 'BLOCK') {
        expect(decision.files).toContain('config/bad.ts');
      }
    } finally {
      await cleanup();
    }
  });

  it('should revert forbidden file changes via git checkout', async () => {
    const { projectRoot, cleanup } = await createTempProject({ withGit: true });

    try {
      const git = simpleGit(projectRoot);

      // Commit original file
      await mkdir(join(projectRoot, 'config'), { recursive: true });
      await writeFile(join(projectRoot, 'config', 'settings.ts'), 'original');
      await git.add('config/settings.ts');
      await git.commit('aidf: add settings', { '--no-gpg-sign': null });

      // Modify the file
      await writeFile(join(projectRoot, 'config', 'settings.ts'), 'modified');
      const modifiedContent = await readFile(join(projectRoot, 'config', 'settings.ts'), 'utf-8');
      expect(modifiedContent).toBe('modified');

      // Revert via git checkout
      await git.checkout(['--', 'config/settings.ts']);

      const revertedContent = await readFile(join(projectRoot, 'config', 'settings.ts'), 'utf-8');
      expect(revertedContent).toBe('original');
    } finally {
      await cleanup();
    }
  });

  it('should detect staged vs unstaged files', async () => {
    const { projectRoot, cleanup } = await createTempProject({ withGit: true });

    try {
      const git = simpleGit(projectRoot);

      // Commit baseline
      await mkdir(join(projectRoot, 'src'), { recursive: true });
      await writeFile(join(projectRoot, 'src', 'base.ts'), 'export const base = 1;\n');
      await git.add('src/base.ts');
      await git.commit('aidf: add base', { '--no-gpg-sign': null });

      // Create two new files
      await writeFile(join(projectRoot, 'src', 'staged.ts'), 'export const staged = true;\n');
      await writeFile(join(projectRoot, 'src', 'unstaged.ts'), 'export const unstaged = true;\n');

      // Stage only one
      await git.add('src/staged.ts');

      const status = await git.status();
      expect(status.created).toContain('src/staged.ts');
      expect(status.not_added).toContain('src/unstaged.ts');
    } finally {
      await cleanup();
    }
  });

  it('should move task file from pending to completed', async () => {
    const { projectRoot, cleanup } = await createTempProject({ withGit: true });

    try {
      const taskPath = await createTaskFixture(projectRoot, {
        id: 'TEST-001',
        goal: 'Test task movement to completed',
        type: 'feature',
        allowedScope: ['src/**'],
        forbiddenScope: ['node_modules/**'],
        requirements: 'Move this task to completed.',
        definitionOfDone: ['Task is in completed folder'],
      });

      const newPath = moveTaskFile(taskPath, 'completed');

      expect(existsSync(newPath)).toBe(true);
      expect(basename(dirname(newPath))).toBe('completed');
      expect(existsSync(taskPath)).toBe(false);
    } finally {
      await cleanup();
    }
  });

  it('should move task file from pending to blocked', async () => {
    const { projectRoot, cleanup } = await createTempProject({ withGit: true });

    try {
      const taskPath = await createTaskFixture(projectRoot, {
        id: 'TEST-002',
        goal: 'Test task movement to blocked',
        type: 'bugfix',
        allowedScope: ['src/**'],
        forbiddenScope: ['node_modules/**'],
        requirements: 'Move this task to blocked.',
        definitionOfDone: ['Task is in blocked folder'],
      });

      const newPath = moveTaskFile(taskPath, 'blocked');

      expect(existsSync(newPath)).toBe(true);
      expect(basename(dirname(newPath))).toBe('blocked');
      expect(existsSync(taskPath)).toBe(false);
    } finally {
      await cleanup();
    }
  });

  it('should detect moved task files in git status', async () => {
    const { projectRoot, cleanup } = await createTempProject({ withGit: true });

    try {
      const git = simpleGit(projectRoot);

      // Create and commit a task file
      const taskPath = await createTaskFixture(projectRoot, {
        id: 'TEST-003',
        goal: 'Test git staging of moved tasks',
        type: 'feature',
        allowedScope: ['src/**'],
        forbiddenScope: ['node_modules/**'],
        requirements: 'Verify git detects file movement.',
        definitionOfDone: ['Git status reflects the move'],
      });

      await git.add('.');
      await git.commit('aidf: add task TEST-003', { '--no-gpg-sign': null });

      // Move the task file
      const newPath = moveTaskFile(taskPath, 'completed');

      // Check git status
      const status = await git.status();

      // The old path should appear as deleted and the new path as untracked
      const deletedFiles = status.deleted;
      const notAddedFiles = status.not_added;

      // Get relative paths for comparison
      const oldRelative = taskPath.replace(projectRoot + '/', '');
      const newRelative = newPath.replace(projectRoot + '/', '');

      expect(deletedFiles).toContain(oldRelative);
      expect(notAddedFiles).toContain(newRelative);
    } finally {
      await cleanup();
    }
  });
});
