// packages/cli/src/core/project-analyzer.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeProject, formatProfile, type ProjectProfile } from './project-analyzer.js';
import * as fs from 'fs';

vi.mock('fs');

const mockExistsSync = vi.mocked(fs.existsSync);
const mockReadFileSync = vi.mocked(fs.readFileSync);

describe('analyzeProject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
  });

  function setupPackageJson(pkg: Record<string, unknown>, lockFile?: string) {
    mockExistsSync.mockImplementation((path: fs.PathLike) => {
      const p = path.toString();
      if (p.endsWith('package.json')) return true;
      if (lockFile && p.endsWith(lockFile)) return true;
      return false;
    });
    mockReadFileSync.mockReturnValue(JSON.stringify(pkg));
  }

  it('should return null package manager when no package.json exists', () => {
    mockExistsSync.mockReturnValue(false);
    const profile = analyzeProject('/test');
    expect(profile.packageManager).toBeNull();
  });

  it('should detect npm from package-lock.json', () => {
    setupPackageJson({ name: 'test' }, 'package-lock.json');
    const profile = analyzeProject('/test');
    expect(profile.packageManager).toBe('npm');
  });

  it('should detect pnpm from pnpm-lock.yaml', () => {
    setupPackageJson({ name: 'test' }, 'pnpm-lock.yaml');
    const profile = analyzeProject('/test');
    expect(profile.packageManager).toBe('pnpm');
  });

  it('should detect yarn from yarn.lock', () => {
    setupPackageJson({ name: 'test' }, 'yarn.lock');
    const profile = analyzeProject('/test');
    expect(profile.packageManager).toBe('yarn');
  });

  it('should detect bun from bun.lockb', () => {
    setupPackageJson({ name: 'test' }, 'bun.lockb');
    const profile = analyzeProject('/test');
    expect(profile.packageManager).toBe('bun');
  });

  it('should detect Next.js framework', () => {
    setupPackageJson({
      dependencies: { next: '^14.0.0', react: '^18.0.0' },
    });
    const profile = analyzeProject('/test');
    expect(profile.framework).toEqual({ name: 'Next.js', version: '14.0.0' });
  });

  it('should detect Express framework', () => {
    setupPackageJson({
      dependencies: { express: '^4.18.0' },
    });
    const profile = analyzeProject('/test');
    expect(profile.framework).toEqual({ name: 'Express', version: '4.18.0' });
  });

  it('should detect Vitest test runner', () => {
    setupPackageJson({
      devDependencies: { vitest: '^2.0.0' },
    });
    const profile = analyzeProject('/test');
    expect(profile.testRunner).toEqual({ name: 'Vitest', version: '2.0.0' });
  });

  it('should detect Jest test runner', () => {
    setupPackageJson({
      devDependencies: { jest: '^29.0.0' },
    });
    const profile = analyzeProject('/test');
    expect(profile.testRunner).toEqual({ name: 'Jest', version: '29.0.0' });
  });

  it('should detect ESLint linter', () => {
    setupPackageJson({
      devDependencies: { eslint: '^9.0.0' },
    });
    const profile = analyzeProject('/test');
    expect(profile.linter).toEqual({ name: 'ESLint', version: '9.0.0' });
  });

  it('should detect Biome linter', () => {
    setupPackageJson({
      devDependencies: { '@biomejs/biome': '^1.5.0' },
    });
    const profile = analyzeProject('/test');
    expect(profile.linter).toEqual({ name: 'Biome', version: '1.5.0' });
  });

  it('should detect TypeScript from tsconfig.json', () => {
    mockExistsSync.mockImplementation((path: fs.PathLike) => {
      const p = path.toString();
      if (p.endsWith('package.json')) return true;
      if (p.endsWith('tsconfig.json')) return true;
      return false;
    });
    mockReadFileSync.mockReturnValue(JSON.stringify({ name: 'test' }));
    const profile = analyzeProject('/test');
    expect(profile.typescript).toBe(true);
  });

  it('should detect TypeScript from dependencies', () => {
    setupPackageJson({
      devDependencies: { typescript: '^5.0.0' },
    });
    const profile = analyzeProject('/test');
    expect(profile.typescript).toBe(true);
  });

  it('should detect monorepo from workspaces', () => {
    setupPackageJson({
      workspaces: ['packages/*'],
    });
    const profile = analyzeProject('/test');
    expect(profile.monorepo).toBe(true);
  });

  it('should detect monorepo from pnpm-workspace.yaml', () => {
    mockExistsSync.mockImplementation((path: fs.PathLike) => {
      const p = path.toString();
      if (p.endsWith('package.json')) return true;
      if (p.endsWith('pnpm-workspace.yaml')) return true;
      return false;
    });
    mockReadFileSync.mockReturnValue(JSON.stringify({ name: 'test' }));
    const profile = analyzeProject('/test');
    expect(profile.monorepo).toBe(true);
  });

  it('should detect monorepo from turbo.json', () => {
    mockExistsSync.mockImplementation((path: fs.PathLike) => {
      const p = path.toString();
      if (p.endsWith('package.json')) return true;
      if (p.endsWith('turbo.json')) return true;
      return false;
    });
    mockReadFileSync.mockReturnValue(JSON.stringify({ name: 'test' }));
    const profile = analyzeProject('/test');
    expect(profile.monorepo).toBe(true);
  });

  it('should extract scripts', () => {
    setupPackageJson({
      scripts: { build: 'tsc', test: 'vitest', lint: 'eslint .' },
    });
    const profile = analyzeProject('/test');
    expect(profile.scripts).toEqual({ build: 'tsc', test: 'vitest', lint: 'eslint .' });
  });

  it('should handle a full project detection', () => {
    mockExistsSync.mockImplementation((path: fs.PathLike) => {
      const p = path.toString();
      if (p.endsWith('package.json')) return true;
      if (p.endsWith('pnpm-lock.yaml')) return true;
      if (p.endsWith('tsconfig.json')) return true;
      return false;
    });
    mockReadFileSync.mockReturnValue(JSON.stringify({
      dependencies: { next: '^14.2.0', react: '^18.2.0' },
      devDependencies: { vitest: '^2.0.0', eslint: '^9.0.0', typescript: '^5.5.0' },
      scripts: { build: 'next build', test: 'vitest', lint: 'eslint .' },
    }));

    const profile = analyzeProject('/test');
    expect(profile.packageManager).toBe('pnpm');
    expect(profile.framework?.name).toBe('Next.js');
    expect(profile.testRunner?.name).toBe('Vitest');
    expect(profile.linter?.name).toBe('ESLint');
    expect(profile.typescript).toBe(true);
    expect(profile.monorepo).toBe(false);
  });

  it('should return empty profile for non-node project', () => {
    mockExistsSync.mockReturnValue(false);
    const profile = analyzeProject('/test');
    expect(profile.packageManager).toBeNull();
    expect(profile.framework).toBeNull();
    expect(profile.testRunner).toBeNull();
    expect(profile.linter).toBeNull();
    expect(profile.typescript).toBe(false);
    expect(profile.monorepo).toBe(false);
  });
});

describe('formatProfile', () => {
  it('should format a full profile', () => {
    const profile: ProjectProfile = {
      packageManager: 'pnpm',
      framework: { name: 'Next.js', version: '14.2.0' },
      testRunner: { name: 'Vitest', version: '2.0.0' },
      linter: { name: 'ESLint', version: '9.0.0' },
      typescript: true,
      monorepo: false,
      scripts: { build: 'next build', test: 'vitest' },
      dependencies: ['next', 'react'],
      devDependencies: ['vitest', 'eslint'],
    };

    const output = formatProfile(profile);
    expect(output).toContain('pnpm');
    expect(output).toContain('Next.js');
    expect(output).toContain('Vitest');
    expect(output).toContain('ESLint');
    expect(output).toContain('TypeScript:      Yes');
    expect(output).toContain('Monorepo:        No');
    expect(output).toContain('build: next build');
  });

  it('should handle minimal profile', () => {
    const profile: ProjectProfile = {
      packageManager: null,
      framework: null,
      testRunner: null,
      linter: null,
      typescript: false,
      monorepo: false,
      scripts: {},
      dependencies: [],
      devDependencies: [],
    };

    const output = formatProfile(profile);
    expect(output).toContain('TypeScript:      No');
    expect(output).not.toContain('Package Manager');
  });
});
