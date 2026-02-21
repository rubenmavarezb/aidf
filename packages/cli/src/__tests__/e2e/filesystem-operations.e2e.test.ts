// packages/cli/src/__tests__/e2e/filesystem-operations.e2e.test.ts

import { describe, it, expect } from 'vitest';
import { createTempProject, type TempProjectResult } from './helpers/index.js';
import { writeFile, mkdir, unlink, readFile } from 'fs/promises';
import { join } from 'path';
import { simpleGit, type SimpleGit } from 'simple-git';

describe('File Operations E2E - Real Filesystem', () => {
  it('should detect new file creation', async () => {
    const { projectRoot, cleanup } = await createTempProject({ withGit: true });
    try {
      const git = simpleGit(projectRoot);

      await mkdir(join(projectRoot, 'src'), { recursive: true });
      await writeFile(join(projectRoot, 'src/newfile.ts'), 'export const x = 1;\n');

      const status = await git.status();

      const allFiles = status.files.map(f => f.path);
      expect(allFiles).toContain('src/newfile.ts');
      expect(status.not_added).toContain('src/newfile.ts');
    } finally {
      await cleanup();
    }
  });

  it('should detect file modification', async () => {
    const { projectRoot, cleanup } = await createTempProject({ withGit: true });
    try {
      const git = simpleGit(projectRoot);

      await mkdir(join(projectRoot, 'src'), { recursive: true });
      await writeFile(join(projectRoot, 'src/existing.ts'), 'export const x = 1;\n');
      await git.add('src/existing.ts');
      await git.commit('Add existing file', { '--no-gpg-sign': null });

      await writeFile(join(projectRoot, 'src/existing.ts'), 'export const x = 2;\n');

      const status = await git.status();

      expect(status.modified).toContain('src/existing.ts');
    } finally {
      await cleanup();
    }
  });

  it('should detect file deletion', async () => {
    const { projectRoot, cleanup } = await createTempProject({ withGit: true });
    try {
      const git = simpleGit(projectRoot);

      await mkdir(join(projectRoot, 'src'), { recursive: true });
      await writeFile(join(projectRoot, 'src/toDelete.ts'), 'export const x = 1;\n');
      await git.add('src/toDelete.ts');
      await git.commit('Add file to delete', { '--no-gpg-sign': null });

      await unlink(join(projectRoot, 'src/toDelete.ts'));

      const status = await git.status();

      expect(status.deleted).toContain('src/toDelete.ts');
    } finally {
      await cleanup();
    }
  });

  it('should detect multiple simultaneous changes', async () => {
    const { projectRoot, cleanup } = await createTempProject({ withGit: true });
    try {
      const git = simpleGit(projectRoot);

      // Create and commit 3 files
      await mkdir(join(projectRoot, 'src'), { recursive: true });
      await writeFile(join(projectRoot, 'src/file1.ts'), 'export const a = 1;\n');
      await writeFile(join(projectRoot, 'src/file2.ts'), 'export const b = 1;\n');
      await writeFile(join(projectRoot, 'src/file3.ts'), 'export const c = 1;\n');
      await git.add('.');
      await git.commit('Add initial files', { '--no-gpg-sign': null });

      // Create 3 new files
      await writeFile(join(projectRoot, 'src/new1.ts'), 'export const d = 1;\n');
      await writeFile(join(projectRoot, 'src/new2.ts'), 'export const e = 1;\n');
      await writeFile(join(projectRoot, 'src/new3.ts'), 'export const f = 1;\n');

      // Modify 2 existing files
      await writeFile(join(projectRoot, 'src/file1.ts'), 'export const a = 2;\n');
      await writeFile(join(projectRoot, 'src/file2.ts'), 'export const b = 2;\n');

      // Delete 1 existing file
      await unlink(join(projectRoot, 'src/file3.ts'));

      const status = await git.status();

      // 3 new files
      expect(status.not_added).toContain('src/new1.ts');
      expect(status.not_added).toContain('src/new2.ts');
      expect(status.not_added).toContain('src/new3.ts');
      expect(status.not_added).toHaveLength(3);

      // 2 modified files
      expect(status.modified).toContain('src/file1.ts');
      expect(status.modified).toContain('src/file2.ts');
      expect(status.modified).toHaveLength(2);

      // 1 deleted file
      expect(status.deleted).toContain('src/file3.ts');
      expect(status.deleted).toHaveLength(1);
    } finally {
      await cleanup();
    }
  });

  it('should ignore files in .gitignore', async () => {
    const { projectRoot, cleanup } = await createTempProject({ withGit: true });
    try {
      const git = simpleGit(projectRoot);

      // The project already has node_modules/ in .gitignore from initGitRepo
      await mkdir(join(projectRoot, 'node_modules'), { recursive: true });
      await writeFile(join(projectRoot, 'node_modules/foo.js'), 'module.exports = {};\n');

      const status = await git.status();

      const allFiles = status.files.map(f => f.path);
      expect(allFiles).not.toContain('node_modules/foo.js');
      expect(status.not_added).not.toContain('node_modules/foo.js');
      expect(status.modified).not.toContain('node_modules/foo.js');
    } finally {
      await cleanup();
    }
  });

  it('should track files across nested directories', async () => {
    const { projectRoot, cleanup } = await createTempProject({ withGit: true });
    try {
      const git = simpleGit(projectRoot);

      await mkdir(join(projectRoot, 'a/b/c/d/e'), { recursive: true });
      await writeFile(join(projectRoot, 'a/b/c/d/e/file.ts'), 'export const deep = true;\n');

      const status = await git.status();

      const allFiles = status.files.map(f => f.path);
      expect(allFiles).toContain('a/b/c/d/e/file.ts');
      expect(status.not_added).toContain('a/b/c/d/e/file.ts');
    } finally {
      await cleanup();
    }
  });

  it('should handle empty directories', async () => {
    const { projectRoot, cleanup } = await createTempProject({ withGit: true });
    try {
      const git = simpleGit(projectRoot);

      await mkdir(join(projectRoot, 'src/empty'), { recursive: true });

      const status = await git.status();

      // Git does not track empty directories
      const allFiles = status.files.map(f => f.path);
      const hasEmptyDir = allFiles.some(f => f.includes('src/empty'));
      expect(hasEmptyDir).toBe(false);
    } finally {
      await cleanup();
    }
  });

  it('should handle binary file creation', async () => {
    const { projectRoot, cleanup } = await createTempProject({ withGit: true });
    try {
      const git = simpleGit(projectRoot);

      // PNG magic bytes
      const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
      await writeFile(join(projectRoot, 'image.png'), pngHeader);

      const status = await git.status();

      const allFiles = status.files.map(f => f.path);
      expect(allFiles).toContain('image.png');
      expect(status.not_added).toContain('image.png');
    } finally {
      await cleanup();
    }
  });
});
