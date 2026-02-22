import { describe, it, expect } from 'vitest';
import {
  AidfError,
  ProviderError,
  TimeoutError,
  ValidationError,
  ScopeError,
  ConfigError,
  GitError,
  PermissionError,
  isRetryable,
} from './errors.js';

describe('AidfError base class', () => {
  it('should be a proper Error subclass', () => {
    const err = ProviderError.crash('test', 'boom');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AidfError);
    expect(err).toBeInstanceOf(ProviderError);
  });

  it('should have a stack trace', () => {
    const err = ProviderError.crash('test', 'boom');
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain('ProviderError');
  });

  it('should set name to constructor name', () => {
    const err = ProviderError.crash('test', 'boom');
    expect(err.name).toBe('ProviderError');
  });
});

describe('ProviderError', () => {
  it('should have category "provider"', () => {
    const err = ProviderError.crash('claude-cli', 'process exited');
    expect(err.category).toBe('provider');
  });

  describe('.crash()', () => {
    it('should create a retryable PROVIDER_CRASH error', () => {
      const err = ProviderError.crash('claude-cli', 'segfault');
      expect(err.code).toBe('PROVIDER_CRASH');
      expect(err.retryable).toBe(true);
      expect(err.context.provider).toBe('claude-cli');
      expect(err.context.rawError).toBe('segfault');
      expect(err.message).toContain('claude-cli');
      expect(err.message).toContain('segfault');
    });
  });

  describe('.notAvailable()', () => {
    it('should create a non-retryable PROVIDER_NOT_AVAILABLE error', () => {
      const err = ProviderError.notAvailable('anthropic-api');
      expect(err.code).toBe('PROVIDER_NOT_AVAILABLE');
      expect(err.retryable).toBe(false);
      expect(err.context.provider).toBe('anthropic-api');
    });
  });

  describe('.apiError()', () => {
    it('should be retryable for 5xx status codes', () => {
      const err = ProviderError.apiError('anthropic-api', 'internal error', 500);
      expect(err.code).toBe('PROVIDER_API_ERROR');
      expect(err.retryable).toBe(true);
      expect(err.context.statusCode).toBe(500);
    });

    it('should be non-retryable for 4xx status codes', () => {
      const err = ProviderError.apiError('anthropic-api', 'bad request', 400);
      expect(err.code).toBe('PROVIDER_API_ERROR');
      expect(err.retryable).toBe(false);
      expect(err.context.statusCode).toBe(400);
    });

    it('should be retryable when no status code (network error)', () => {
      const err = ProviderError.apiError('anthropic-api', 'network timeout');
      expect(err.retryable).toBe(true);
      expect(err.context.statusCode).toBeUndefined();
    });
  });

  describe('.rateLimit()', () => {
    it('should create a retryable PROVIDER_RATE_LIMIT error', () => {
      const err = ProviderError.rateLimit('openai-api', 'too many requests');
      expect(err.code).toBe('PROVIDER_RATE_LIMIT');
      expect(err.retryable).toBe(true);
      expect(err.context.provider).toBe('openai-api');
    });
  });
});

describe('TimeoutError', () => {
  it('should have category "timeout"', () => {
    const err = TimeoutError.iteration(30000, 5);
    expect(err.category).toBe('timeout');
  });

  it('should always be retryable', () => {
    expect(TimeoutError.iteration(30000, 1).retryable).toBe(true);
    expect(TimeoutError.operation(10000).retryable).toBe(true);
  });

  describe('.iteration()', () => {
    it('should create ITERATION_TIMEOUT with context', () => {
      const err = TimeoutError.iteration(60000, 3);
      expect(err.code).toBe('ITERATION_TIMEOUT');
      expect(err.context.timeoutMs).toBe(60000);
      expect(err.context.iteration).toBe(3);
      expect(err.message).toContain('60s');
    });
  });

  describe('.operation()', () => {
    it('should create OPERATION_TIMEOUT with context', () => {
      const err = TimeoutError.operation(5000, 4500);
      expect(err.code).toBe('OPERATION_TIMEOUT');
      expect(err.context.timeoutMs).toBe(5000);
      expect(err.context.elapsedMs).toBe(4500);
    });
  });
});

describe('ValidationError', () => {
  it('should have category "validation"', () => {
    const err = ValidationError.preCommit('pnpm lint', 1, 'ESLint errors');
    expect(err.category).toBe('validation');
  });

  it('should always be retryable', () => {
    expect(ValidationError.preCommit('lint', 1, '').retryable).toBe(true);
    expect(ValidationError.prePush('test', 1, '').retryable).toBe(true);
  });

  describe('.preCommit()', () => {
    it('should create VALIDATION_PRE_COMMIT with context', () => {
      const err = ValidationError.preCommit('pnpm lint', 1, 'error: unused var');
      expect(err.code).toBe('VALIDATION_PRE_COMMIT');
      expect(err.context.command).toBe('pnpm lint');
      expect(err.context.exitCode).toBe(1);
      expect(err.context.output).toBe('error: unused var');
      expect(err.context.phase).toBe('pre_commit');
    });
  });

  describe('.prePush()', () => {
    it('should create VALIDATION_PRE_PUSH with context', () => {
      const err = ValidationError.prePush('pnpm test', 2, 'test failed');
      expect(err.code).toBe('VALIDATION_PRE_PUSH');
      expect(err.context.phase).toBe('pre_push');
    });
  });
});

describe('ScopeError', () => {
  it('should have category "scope"', () => {
    const err = ScopeError.forbidden(['src/secret.ts'], 'strict');
    expect(err.category).toBe('scope');
  });

  describe('.forbidden()', () => {
    it('should be retryable with SCOPE_FORBIDDEN', () => {
      const err = ScopeError.forbidden(['file.ts'], 'strict');
      expect(err.code).toBe('SCOPE_FORBIDDEN');
      expect(err.retryable).toBe(true);
      expect(err.context.files).toEqual(['file.ts']);
      expect(err.context.scopeMode).toBe('strict');
      expect(err.context.decision).toBe('BLOCK');
    });
  });

  describe('.outsideAllowed()', () => {
    it('should be retryable with SCOPE_OUTSIDE_ALLOWED', () => {
      const err = ScopeError.outsideAllowed(['outside.ts'], 'ask');
      expect(err.code).toBe('SCOPE_OUTSIDE_ALLOWED');
      expect(err.retryable).toBe(true);
      expect(err.context.decision).toBe('BLOCK');
    });
  });

  describe('.userDenied()', () => {
    it('should be non-retryable with SCOPE_USER_DENIED', () => {
      const err = ScopeError.userDenied(['denied.ts']);
      expect(err.code).toBe('SCOPE_USER_DENIED');
      expect(err.retryable).toBe(false);
      expect(err.context.decision).toBe('ASK_USER');
    });
  });
});

describe('ConfigError', () => {
  it('should have category "config"', () => {
    const err = ConfigError.missing('/path/config.yml');
    expect(err.category).toBe('config');
  });

  it('should never be retryable', () => {
    expect(ConfigError.missing('/path').retryable).toBe(false);
    expect(ConfigError.missingEnvVar('VAR').retryable).toBe(false);
    expect(ConfigError.invalid('f', 'v', 'e').retryable).toBe(false);
    expect(ConfigError.parseError('/p', 'e').retryable).toBe(false);
  });

  describe('.invalid()', () => {
    it('should create CONFIG_INVALID with context', () => {
      const err = ConfigError.invalid('provider.type', 'bogus', 'claude-cli | openai-api');
      expect(err.code).toBe('CONFIG_INVALID');
      expect(err.context.field).toBe('provider.type');
      expect(err.message).toContain('bogus');
    });
  });

  describe('.missing()', () => {
    it('should create CONFIG_MISSING with context', () => {
      const err = ConfigError.missing('/app/.ai/config.yml');
      expect(err.code).toBe('CONFIG_MISSING');
      expect(err.context.configPath).toBe('/app/.ai/config.yml');
    });
  });

  describe('.missingEnvVar()', () => {
    it('should create CONFIG_ENV_VAR_MISSING with context', () => {
      const err = ConfigError.missingEnvVar('ANTHROPIC_API_KEY');
      expect(err.code).toBe('CONFIG_ENV_VAR_MISSING');
      expect(err.context.envVar).toBe('ANTHROPIC_API_KEY');
    });
  });

  describe('.parseError()', () => {
    it('should create CONFIG_PARSE_ERROR with context', () => {
      const err = ConfigError.parseError('/app/config.yml', 'invalid YAML');
      expect(err.code).toBe('CONFIG_PARSE_ERROR');
      expect(err.context.configPath).toBe('/app/config.yml');
    });
  });
});

describe('GitError', () => {
  it('should have category "git"', () => {
    const err = GitError.commitFailed(['file.ts'], 'nothing to commit');
    expect(err.category).toBe('git');
  });

  describe('.commitFailed()', () => {
    it('should be retryable with GIT_COMMIT_FAILED', () => {
      const err = GitError.commitFailed(['a.ts', 'b.ts'], 'lock file exists');
      expect(err.code).toBe('GIT_COMMIT_FAILED');
      expect(err.retryable).toBe(true);
      expect(err.context.operation).toBe('commit');
      expect(err.context.files).toEqual(['a.ts', 'b.ts']);
      expect(err.context.rawError).toBe('lock file exists');
    });
  });

  describe('.pushFailed()', () => {
    it('should be retryable with GIT_PUSH_FAILED', () => {
      const err = GitError.pushFailed('rejected by remote');
      expect(err.code).toBe('GIT_PUSH_FAILED');
      expect(err.retryable).toBe(true);
      expect(err.context.operation).toBe('push');
    });
  });

  describe('.revertFailed()', () => {
    it('should be non-retryable with GIT_REVERT_FAILED', () => {
      const err = GitError.revertFailed(['dirty.ts'], 'merge conflict');
      expect(err.code).toBe('GIT_REVERT_FAILED');
      expect(err.retryable).toBe(false);
      expect(err.context.operation).toBe('revert');
    });
  });

  describe('.statusFailed()', () => {
    it('should be retryable with GIT_STATUS_FAILED', () => {
      const err = GitError.statusFailed('not a git repo');
      expect(err.code).toBe('GIT_STATUS_FAILED');
      expect(err.retryable).toBe(true);
      expect(err.context.operation).toBe('status');
    });
  });
});

describe('PermissionError', () => {
  it('should have category "permission"', () => {
    const err = PermissionError.skipDenied('test-resource');
    expect(err.category).toBe('permission');
  });

  it('should never be retryable', () => {
    expect(PermissionError.skipDenied('r').retryable).toBe(false);
    expect(PermissionError.commandBlocked('cmd', 'p').retryable).toBe(false);
    expect(PermissionError.fileAccess('f').retryable).toBe(false);
    expect(PermissionError.apiAuth('provider').retryable).toBe(false);
  });

  describe('.skipDenied()', () => {
    it('should create PERMISSION_SKIP_DENIED with context', () => {
      const err = PermissionError.skipDenied('dangerous-flag');
      expect(err.code).toBe('PERMISSION_SKIP_DENIED');
      expect(err.context.resource).toBe('dangerous-flag');
    });
  });

  describe('.commandBlocked()', () => {
    it('should create PERMISSION_COMMAND_BLOCKED with context', () => {
      const err = PermissionError.commandBlocked('rm -rf /', 'strict');
      expect(err.code).toBe('PERMISSION_COMMAND_BLOCKED');
      expect(err.context.command).toBe('rm -rf /');
      expect(err.context.policy).toBe('strict');
    });
  });

  describe('.fileAccess()', () => {
    it('should create PERMISSION_FILE_ACCESS with context', () => {
      const err = PermissionError.fileAccess('/etc/passwd');
      expect(err.code).toBe('PERMISSION_FILE_ACCESS');
      expect(err.context.resource).toBe('/etc/passwd');
    });
  });

  describe('.apiAuth()', () => {
    it('should create PERMISSION_FILE_ACCESS with api_auth policy', () => {
      const err = PermissionError.apiAuth('anthropic-api');
      expect(err.code).toBe('PERMISSION_FILE_ACCESS');
      expect(err.context.resource).toBe('anthropic-api');
      expect(err.context.policy).toBe('api_auth');
    });
  });
});

describe('toJSON()', () => {
  it('should return a serializable object', () => {
    const err = ProviderError.crash('claude-cli', 'boom');
    const json = err.toJSON();

    expect(json.name).toBe('ProviderError');
    expect(json.code).toBe('PROVIDER_CRASH');
    expect(json.category).toBe('provider');
    expect(json.retryable).toBe(true);
    expect(json.message).toContain('boom');
    expect(json.context).toEqual({ provider: 'claude-cli', rawError: 'boom' });
    expect(json.stack).toBeDefined();
  });

  it('should be JSON.stringify-able', () => {
    const err = ConfigError.missing('/path');
    const str = JSON.stringify(err.toJSON());
    const parsed = JSON.parse(str);
    expect(parsed.code).toBe('CONFIG_MISSING');
  });
});

describe('isRetryable()', () => {
  it('should return true for retryable errors', () => {
    expect(isRetryable(ProviderError.crash('p', 'e'))).toBe(true);
    expect(isRetryable(ProviderError.rateLimit('p'))).toBe(true);
    expect(isRetryable(TimeoutError.iteration(1000, 1))).toBe(true);
    expect(isRetryable(ValidationError.preCommit('cmd', 1, 'out'))).toBe(true);
    expect(isRetryable(ScopeError.forbidden(['f'], 's'))).toBe(true);
    expect(isRetryable(GitError.commitFailed([], 'e'))).toBe(true);
  });

  it('should return false for non-retryable errors', () => {
    expect(isRetryable(ProviderError.notAvailable('p'))).toBe(false);
    expect(isRetryable(ConfigError.missing('/p'))).toBe(false);
    expect(isRetryable(PermissionError.skipDenied('r'))).toBe(false);
    expect(isRetryable(ScopeError.userDenied(['f']))).toBe(false);
    expect(isRetryable(GitError.revertFailed([], 'e'))).toBe(false);
  });
});

describe('instanceof checks', () => {
  it('should work across all error types', () => {
    const errors = [
      ProviderError.crash('p', 'e'),
      TimeoutError.iteration(1000, 1),
      ValidationError.preCommit('cmd', 1, 'out'),
      ScopeError.forbidden(['f'], 's'),
      ConfigError.missing('/p'),
      GitError.commitFailed([], 'e'),
      PermissionError.skipDenied('r'),
    ];

    for (const err of errors) {
      expect(err).toBeInstanceOf(AidfError);
      expect(err).toBeInstanceOf(Error);
    }

    expect(errors[0]).toBeInstanceOf(ProviderError);
    expect(errors[1]).toBeInstanceOf(TimeoutError);
    expect(errors[2]).toBeInstanceOf(ValidationError);
    expect(errors[3]).toBeInstanceOf(ScopeError);
    expect(errors[4]).toBeInstanceOf(ConfigError);
    expect(errors[5]).toBeInstanceOf(GitError);
    expect(errors[6]).toBeInstanceOf(PermissionError);
  });

  it('should not match wrong subclass', () => {
    const err = ProviderError.crash('p', 'e');
    expect(err).not.toBeInstanceOf(TimeoutError);
    expect(err).not.toBeInstanceOf(ConfigError);
  });
});
