import { describe, it, expect } from 'vitest';
import {
  matchesPattern,
  checkFileChange,
  checkFileChanges,
  ScopeGuard
} from './safety.js';
import type { TaskScope, FileChange } from '../types/index.js';

describe('matchesPattern', () => {
  it('should match exact paths', () => {
    expect(matchesPattern('src/index.ts', ['src/index.ts'])).toBe(true);
    expect(matchesPattern('src/other.ts', ['src/index.ts'])).toBe(false);
  });

  it('should match glob patterns', () => {
    expect(matchesPattern('src/components/Button.tsx', ['src/components/**'])).toBe(true);
    expect(matchesPattern('src/utils/helper.ts', ['src/components/**'])).toBe(false);
  });

  it('should match wildcard extensions', () => {
    expect(matchesPattern('src/test.ts', ['**/*.ts'])).toBe(true);
    expect(matchesPattern('src/test.js', ['**/*.ts'])).toBe(false);
  });

  it('should handle dotfiles', () => {
    expect(matchesPattern('.env', ['.env*'])).toBe(true);
    expect(matchesPattern('.env.local', ['.env*'])).toBe(true);
  });
});

describe('checkFileChange', () => {
  const scope: TaskScope = {
    allowed: ['src/components/**', 'src/utils/**'],
    forbidden: ['.env*', 'src/config/**'],
    ask_before: ['package.json'],
  };

  it('should allow files in allowed scope', () => {
    const result = checkFileChange('src/components/Button.tsx', scope, 'strict');
    expect(result.action).toBe('ALLOW');
  });

  it('should block files in forbidden scope', () => {
    const result = checkFileChange('.env', scope, 'strict');
    expect(result.action).toBe('BLOCK');
  });

  it('should ask for files in ask_before', () => {
    const result = checkFileChange('package.json', scope, 'ask');
    expect(result.action).toBe('ASK_USER');
  });

  it('should block files outside allowed in strict mode', () => {
    const result = checkFileChange('src/other/file.ts', scope, 'strict');
    expect(result.action).toBe('BLOCK');
  });

  it('should allow files outside allowed in permissive mode', () => {
    const result = checkFileChange('src/other/file.ts', scope, 'permissive');
    expect(result.action).toBe('ALLOW');
  });
});

describe('checkFileChanges', () => {
  const scope: TaskScope = {
    allowed: ['src/**'],
    forbidden: ['.env'],
  };

  it('should aggregate multiple violations', () => {
    const changes: FileChange[] = [
      { path: 'src/index.ts', type: 'modified' },
      { path: '.env', type: 'modified' },
      { path: 'config/app.ts', type: 'created' },
    ];

    const result = checkFileChanges(changes, scope, 'strict');
    expect(result.action).toBe('BLOCK');
    if (result.action === 'BLOCK' || result.action === 'ASK_USER') {
      expect(result.files).toContain('.env');
    }
  });
});

describe('ScopeGuard', () => {
  it('should track approved files', () => {
    const scope: TaskScope = {
      allowed: ['src/**'],
      forbidden: [],
      ask_before: ['package.json'],
    };

    const guard = new ScopeGuard(scope, 'ask');
    guard.approve(['package.json']);

    expect(guard.isApproved('package.json')).toBe(true);
    expect(guard.isApproved('other.json')).toBe(false);
  });

  it('should validate changes correctly', () => {
    const scope: TaskScope = {
      allowed: ['src/**'],
      forbidden: ['.env'],
    };

    const guard = new ScopeGuard(scope, 'strict');
    const changes: FileChange[] = [
      { path: 'src/index.ts', type: 'modified' },
    ];

    const result = guard.validate(changes);
    expect(result.action).toBe('ALLOW');
  });

  it('should identify changes to revert', () => {
    const scope: TaskScope = {
      allowed: ['src/**'],
      forbidden: ['.env'],
    };

    const guard = new ScopeGuard(scope, 'strict');
    const changes: FileChange[] = [
      { path: 'src/index.ts', type: 'modified' },
      { path: '.env', type: 'modified' },
    ];

    const toRevert = guard.getChangesToRevert(changes);
    expect(toRevert.length).toBe(1);
    expect(toRevert[0].path).toBe('.env');
  });

  it('should not revert approved files', () => {
    const scope: TaskScope = {
      allowed: ['src/**'],
      forbidden: [],
      ask_before: ['package.json'],
    };

    const guard = new ScopeGuard(scope, 'strict');
    guard.approve(['package.json']);

    const changes: FileChange[] = [
      { path: 'package.json', type: 'modified' },
    ];

    const toRevert = guard.getChangesToRevert(changes);
    expect(toRevert.length).toBe(0);
  });

  it('should generate violation report', () => {
    const scope: TaskScope = {
      allowed: ['src/**'],
      forbidden: ['.env'],
    };

    const guard = new ScopeGuard(scope, 'strict');
    const changes: FileChange[] = [
      { path: '.env', type: 'modified' },
    ];

    const report = guard.generateViolationReport(changes);
    expect(report).toContain('Scope Violations Detected');
    expect(report).toContain('.env');
    expect(report).toContain('BLOCK');
  });

  it('should return empty string when no violations', () => {
    const scope: TaskScope = {
      allowed: ['src/**'],
      forbidden: [],
    };

    const guard = new ScopeGuard(scope, 'strict');
    const changes: FileChange[] = [
      { path: 'src/index.ts', type: 'modified' },
    ];

    const report = guard.generateViolationReport(changes);
    expect(report).toBe('');
  });
});
