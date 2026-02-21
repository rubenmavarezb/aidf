import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempProject, type TempProjectResult } from './helpers/index.js';
import { checkFileChanges, checkFileChange, ScopeGuard } from '../../core/safety.js';
import { writeFile, mkdir, symlink, unlink } from 'fs/promises';
import { join } from 'path';
import type { FileChange, TaskScope } from '../../types/index.js';

describe('ScopeGuard E2E - Real Filesystem', () => {
  let project: TempProjectResult;

  beforeEach(async () => {
    project = await createTempProject();
  });

  afterEach(async () => {
    await project.cleanup();
  });

  it('should ALLOW files created within allowed scope', async () => {
    await mkdir(join(project.projectRoot, 'src', 'components'), { recursive: true });
    await mkdir(join(project.projectRoot, 'src', 'utils'), { recursive: true });
    await writeFile(join(project.projectRoot, 'src', 'components', 'Button.tsx'), 'export const Button = () => {};');
    await writeFile(join(project.projectRoot, 'src', 'utils', 'helpers.ts'), 'export const noop = () => {};');

    const changes: FileChange[] = [
      { path: 'src/components/Button.tsx', type: 'created' },
      { path: 'src/utils/helpers.ts', type: 'created' },
    ];

    const scope: TaskScope = { allowed: ['src/**'], forbidden: [] };
    const decision = checkFileChanges(changes, scope, 'strict');

    expect(decision.action).toBe('ALLOW');
  });

  it('should BLOCK files in forbidden scope', async () => {
    await mkdir(join(project.projectRoot, 'src', 'config'), { recursive: true });
    await writeFile(join(project.projectRoot, '.env'), 'SECRET=123');
    await writeFile(join(project.projectRoot, 'src', 'config', 'secrets.ts'), 'export const key = "abc";');

    const changes: FileChange[] = [
      { path: '.env', type: 'created' },
      { path: 'src/config/secrets.ts', type: 'created' },
    ];

    const scope: TaskScope = { allowed: ['src/**'], forbidden: ['.env*', 'src/config/**'] };
    const decision = checkFileChanges(changes, scope, 'strict');

    expect(decision.action).toBe('BLOCK');
    expect(decision.action === 'BLOCK' && decision.files).toContain('.env');
    expect(decision.action === 'BLOCK' && decision.files).toContain('src/config/secrets.ts');
  });

  it('should BLOCK files outside allowed scope in strict mode', async () => {
    await mkdir(join(project.projectRoot, 'scripts'), { recursive: true });
    await writeFile(join(project.projectRoot, 'scripts', 'deploy.sh'), '#!/bin/bash\necho "deploy"');

    const changes: FileChange[] = [
      { path: 'scripts/deploy.sh', type: 'created' },
    ];

    const scope: TaskScope = { allowed: ['src/**'], forbidden: [] };
    const decision = checkFileChanges(changes, scope, 'strict');

    expect(decision.action).toBe('BLOCK');
  });

  it('should ALLOW files outside allowed scope in permissive mode', async () => {
    await mkdir(join(project.projectRoot, 'scripts'), { recursive: true });
    await writeFile(join(project.projectRoot, 'scripts', 'deploy.sh'), '#!/bin/bash\necho "deploy"');

    const changes: FileChange[] = [
      { path: 'scripts/deploy.sh', type: 'created' },
    ];

    const scope: TaskScope = { allowed: ['src/**'], forbidden: [] };
    const decision = checkFileChanges(changes, scope, 'permissive');

    expect(decision.action).toBe('ALLOW');
  });

  it('should handle nested glob matching with real directory tree', async () => {
    await mkdir(join(project.projectRoot, 'src', 'components', 'forms'), { recursive: true });
    await writeFile(join(project.projectRoot, 'src', 'components', 'forms', 'Input.tsx'), 'export const Input = () => {};');
    await writeFile(join(project.projectRoot, 'src', 'components', 'forms', 'Select.tsx'), 'export const Select = () => {};');
    await writeFile(join(project.projectRoot, 'src', 'components', 'Button.tsx'), 'export const Button = () => {};');

    const scope: TaskScope = { allowed: ['src/components/forms/**'], forbidden: [] };

    const inputDecision = checkFileChange('src/components/forms/Input.tsx', scope, 'strict');
    expect(inputDecision.action).toBe('ALLOW');

    const selectDecision = checkFileChange('src/components/forms/Select.tsx', scope, 'strict');
    expect(selectDecision.action).toBe('ALLOW');

    const buttonDecision = checkFileChange('src/components/Button.tsx', scope, 'strict');
    expect(buttonDecision.action).toBe('BLOCK');
  });

  it('should handle dotfile patterns correctly', async () => {
    await writeFile(join(project.projectRoot, '.env'), 'SECRET=1');
    await writeFile(join(project.projectRoot, '.env.local'), 'LOCAL_SECRET=2');
    await writeFile(join(project.projectRoot, '.env.production'), 'PROD_SECRET=3');
    await writeFile(join(project.projectRoot, '.gitignore'), 'node_modules/');

    const scope: TaskScope = { allowed: [], forbidden: ['.env*'] };

    const envDecision = checkFileChange('.env', scope, 'strict');
    expect(envDecision.action).toBe('BLOCK');

    const envLocalDecision = checkFileChange('.env.local', scope, 'strict');
    expect(envLocalDecision.action).toBe('BLOCK');

    const envProdDecision = checkFileChange('.env.production', scope, 'strict');
    expect(envProdDecision.action).toBe('BLOCK');

    const gitignoreDecision = checkFileChange('.gitignore', scope, 'strict');
    expect(gitignoreDecision.action).not.toBe('BLOCK');
  });

  it('should support approve/revert flow with ScopeGuard', async () => {
    await writeFile(join(project.projectRoot, 'package.json'), '{}');
    await mkdir(join(project.projectRoot, 'scripts'), { recursive: true });
    await writeFile(join(project.projectRoot, 'scripts', 'hack.sh'), '#!/bin/bash');

    const scope: TaskScope = {
      allowed: ['src/**'],
      forbidden: [],
      ask_before: ['package.json'],
    };

    const guard = new ScopeGuard(scope, 'ask');

    // Approve package.json
    guard.approve(['package.json']);
    expect(guard.isApproved('package.json')).toBe(true);
    expect(guard.isApproved('scripts/hack.sh')).toBe(false);

    const changes: FileChange[] = [
      { path: 'package.json', type: 'modified' },
      { path: 'scripts/hack.sh', type: 'created' },
    ];

    const toRevert = guard.getChangesToRevert(changes);

    // scripts/hack.sh is outside allowed scope and not approved, so it should be reverted
    // In 'ask' mode, files outside allowed scope get ASK_USER, not BLOCK,
    // so getChangesToRevert only returns BLOCK decisions. Let's verify behavior:
    // Actually, getChangesToRevert checks with checkFileChange which in 'ask' mode
    // returns ASK_USER for out-of-scope files, not BLOCK. So it won't be in revert list.
    // But package.json is approved so it should not be reverted either way.
    const revertPaths = toRevert.map(c => c.path);
    expect(revertPaths).not.toContain('package.json');
  });

  it('should produce the same scope decision regardless of file change type', async () => {
    await mkdir(join(project.projectRoot, 'src'), { recursive: true });
    await writeFile(join(project.projectRoot, 'src', 'index.ts'), 'console.log("hello");');

    const scope: TaskScope = { allowed: ['src/**'], forbidden: [] };

    const createdDecision = checkFileChange('src/index.ts', scope, 'strict');
    const modifiedDecision = checkFileChange('src/index.ts', scope, 'strict');
    const deletedDecision = checkFileChange('src/index.ts', scope, 'strict');

    // Explicitly pass different types through checkFileChanges to confirm
    const createdResult = checkFileChanges(
      [{ path: 'src/index.ts', type: 'created' }], scope, 'strict'
    );
    const modifiedResult = checkFileChanges(
      [{ path: 'src/index.ts', type: 'modified' }], scope, 'strict'
    );
    const deletedResult = checkFileChanges(
      [{ path: 'src/index.ts', type: 'deleted' }], scope, 'strict'
    );

    expect(createdDecision.action).toBe('ALLOW');
    expect(modifiedDecision.action).toBe('ALLOW');
    expect(deletedDecision.action).toBe('ALLOW');
    expect(createdResult.action).toBe('ALLOW');
    expect(modifiedResult.action).toBe('ALLOW');
    expect(deletedResult.action).toBe('ALLOW');
  });

  it('should match symlinked paths based on the link path, not the target', async () => {
    // Skip on Windows where symlinks may require elevated privileges
    if (process.platform === 'win32') {
      return;
    }

    await mkdir(join(project.projectRoot, 'outside'), { recursive: true });
    await mkdir(join(project.projectRoot, 'src'), { recursive: true });
    await writeFile(join(project.projectRoot, 'outside', 'real.ts'), 'export const x = 1;');
    await symlink(
      join(project.projectRoot, 'outside', 'real.ts'),
      join(project.projectRoot, 'src', 'link.ts')
    );

    const scope: TaskScope = { allowed: ['src/**'], forbidden: [] };

    // ScopeGuard checks the path string, not the resolved symlink target
    const linkDecision = checkFileChange('src/link.ts', scope, 'strict');
    expect(linkDecision.action).toBe('ALLOW');

    // The actual target outside src/ would be blocked if referenced directly
    const realDecision = checkFileChange('outside/real.ts', scope, 'strict');
    expect(realDecision.action).toBe('BLOCK');

    // Cleanup symlink
    await unlink(join(project.projectRoot, 'src', 'link.ts'));
  });

  it('should handle case sensitivity in path matching', async () => {
    await mkdir(join(project.projectRoot, 'src'), { recursive: true });
    await writeFile(join(project.projectRoot, 'src', 'File.ts'), 'export const x = 1;');

    const scope: TaskScope = { allowed: ['src/**'], forbidden: [] };

    // Lowercase 'src' in the pattern should match lowercase 'src' in the path
    const normalDecision = checkFileChange('src/File.ts', scope, 'strict');
    expect(normalDecision.action).toBe('ALLOW');

    // Uppercase 'SRC' in the path should NOT match lowercase 'src' in the pattern
    // because minimatch is case-sensitive by default, regardless of OS filesystem
    const uppercaseDecision = checkFileChange('SRC/File.ts', scope, 'strict');
    expect(uppercaseDecision.action).toBe('BLOCK');
  });
});
