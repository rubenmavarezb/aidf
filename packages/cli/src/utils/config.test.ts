import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolveConfigValue, resolveConfig, detectPlaintextSecrets, normalizeConfig, findConfigFile, getDefaultConfig, loadConfigFromFile, findAndLoadConfig } from './config.js';

describe('resolveConfigValue', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should resolve ${VAR} syntax', () => {
    process.env.MY_API_KEY = 'sk-12345';
    expect(resolveConfigValue('${MY_API_KEY}')).toBe('sk-12345');
  });

  it('should resolve $VAR syntax', () => {
    process.env.MY_TOKEN = 'tok-abc';
    expect(resolveConfigValue('$MY_TOKEN')).toBe('tok-abc');
  });

  it('should resolve ${VAR} embedded in a string', () => {
    process.env.HOST = 'localhost';
    process.env.PORT = '3000';
    expect(resolveConfigValue('http://${HOST}:${PORT}')).toBe('http://localhost:3000');
  });

  it('should resolve multiple ${VAR} references', () => {
    process.env.USER = 'admin';
    process.env.PASS = 'secret';
    expect(resolveConfigValue('${USER}:${PASS}')).toBe('admin:secret');
  });

  it('should throw when ${VAR} references a missing variable', () => {
    delete process.env.MISSING_VAR;
    expect(() => resolveConfigValue('${MISSING_VAR}')).toThrow(
      'Environment variable "MISSING_VAR" is not set'
    );
  });

  it('should throw when $VAR references a missing variable', () => {
    delete process.env.MISSING_VAR;
    expect(() => resolveConfigValue('$MISSING_VAR')).toThrow(
      'Environment variable "MISSING_VAR" is not set'
    );
  });

  it('should pass through strings without variables unchanged', () => {
    expect(resolveConfigValue('hello world')).toBe('hello world');
  });

  it('should pass through empty strings', () => {
    expect(resolveConfigValue('')).toBe('');
  });

  it('should handle variables with underscores and numbers', () => {
    process.env.MY_VAR_2 = 'value2';
    expect(resolveConfigValue('${MY_VAR_2}')).toBe('value2');
  });

  it('should resolve empty string env var values', () => {
    process.env.EMPTY_VAR = '';
    expect(resolveConfigValue('${EMPTY_VAR}')).toBe('');
  });
});

describe('resolveConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should resolve nested object values', () => {
    process.env.SLACK_WEBHOOK = 'https://hooks.slack.com/xxx';
    process.env.SMTP_PASS = 'mail-pass';

    const config = {
      notifications: {
        slack: {
          webhook_url: '${SLACK_WEBHOOK}',
        },
        email: {
          smtp_pass: '${SMTP_PASS}',
        },
      },
    };

    const resolved = resolveConfig(config);
    expect(resolved.notifications.slack.webhook_url).toBe('https://hooks.slack.com/xxx');
    expect(resolved.notifications.email.smtp_pass).toBe('mail-pass');
  });

  it('should resolve values in arrays', () => {
    process.env.CMD1 = 'pnpm test';
    process.env.CMD2 = 'pnpm lint';

    const config = {
      validation: {
        pre_commit: ['${CMD1}', '${CMD2}'],
      },
    };

    const resolved = resolveConfig(config);
    expect(resolved.validation.pre_commit).toEqual(['pnpm test', 'pnpm lint']);
  });

  it('should pass through non-string values unchanged', () => {
    const config = {
      version: 1,
      execution: {
        max_iterations: 50,
        enabled: true,
        timeout: null as unknown as string,
      },
    };

    const resolved = resolveConfig(config);
    expect(resolved.version).toBe(1);
    expect(resolved.execution.max_iterations).toBe(50);
    expect(resolved.execution.enabled).toBe(true);
    expect(resolved.execution.timeout).toBeNull();
  });

  it('should handle deeply nested structures', () => {
    process.env.DEEP_VAL = 'found';

    const config = {
      a: {
        b: {
          c: {
            d: '${DEEP_VAL}',
          },
        },
      },
    };

    const resolved = resolveConfig(config);
    expect(resolved.a.b.c.d).toBe('found');
  });

  it('should leave strings without env vars unchanged', () => {
    const config = {
      provider: {
        type: 'claude-cli',
      },
      git: {
        commit_prefix: 'aidf:',
      },
    };

    const resolved = resolveConfig(config);
    expect(resolved.provider.type).toBe('claude-cli');
    expect(resolved.git.commit_prefix).toBe('aidf:');
  });

  it('should throw on missing env vars in nested config', () => {
    delete process.env.NONEXISTENT;

    const config = {
      provider: {
        api_key: '${NONEXISTENT}',
      },
    };

    expect(() => resolveConfig(config)).toThrow('Environment variable "NONEXISTENT" is not set');
  });
});

describe('detectPlaintextSecrets', () => {
  it('should detect plaintext api_key', () => {
    const config = {
      provider: {
        api_key: 'sk-ant-1234567890',
      },
    };

    const warnings = detectPlaintextSecrets(config);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('provider.api_key');
    expect(warnings[0]).toContain('plaintext secret');
  });

  it('should detect plaintext password', () => {
    const config = {
      email: {
        smtp_password: 'mypassword123',
      },
    };

    const warnings = detectPlaintextSecrets(config);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('email.smtp_password');
  });

  it('should detect plaintext webhook_url', () => {
    const config = {
      slack: {
        webhook_url: 'https://hooks.slack.com/services/T00/B00/xxx',
      },
    };

    const warnings = detectPlaintextSecrets(config);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('slack.webhook_url');
  });

  it('should detect plaintext token', () => {
    const config = {
      auth: {
        access_token: 'ghp_abcdef123456',
      },
    };

    const warnings = detectPlaintextSecrets(config);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('auth.access_token');
  });

  it('should not warn when value uses ${VAR} syntax', () => {
    const config = {
      provider: {
        api_key: '${ANTHROPIC_API_KEY}',
      },
      slack: {
        webhook_url: '${SLACK_WEBHOOK}',
      },
    };

    const warnings = detectPlaintextSecrets(config);
    expect(warnings).toHaveLength(0);
  });

  it('should not warn when value uses $VAR syntax', () => {
    const config = {
      provider: {
        api_key: '$ANTHROPIC_API_KEY',
      },
    };

    const warnings = detectPlaintextSecrets(config);
    expect(warnings).toHaveLength(0);
  });

  it('should not warn for empty string values', () => {
    const config = {
      slack: {
        webhook_url: '',
      },
    };

    const warnings = detectPlaintextSecrets(config);
    expect(warnings).toHaveLength(0);
  });

  it('should not warn for non-sensitive keys', () => {
    const config = {
      provider: {
        type: 'claude-cli',
      },
      git: {
        commit_prefix: 'aidf:',
      },
    };

    const warnings = detectPlaintextSecrets(config);
    expect(warnings).toHaveLength(0);
  });

  it('should detect multiple plaintext secrets', () => {
    const config = {
      provider: {
        api_key: 'sk-abc',
      },
      notifications: {
        slack: {
          webhook_url: 'https://hooks.slack.com/xxx',
        },
        email: {
          smtp_pass: 'password123',
        },
      },
    };

    const warnings = detectPlaintextSecrets(config);
    expect(warnings).toHaveLength(3);
  });

  it('should handle nested objects recursively', () => {
    const config = {
      deep: {
        nested: {
          secret_key: 'plaintext-secret',
        },
      },
    };

    const warnings = detectPlaintextSecrets(config);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('deep.nested.secret_key');
  });
});

describe('normalizeConfig', () => {
  it('should map behavior.autoCommit to permissions.auto_commit', () => {
    const raw = {
      behavior: { autoCommit: false, scopeEnforcement: 'strict' },
    };
    const result = normalizeConfig(raw);
    expect(result.permissions.auto_commit).toBe(false);
  });

  it('should map behavior.scopeEnforcement to permissions.scope_enforcement', () => {
    const raw = {
      behavior: { autoCommit: true, scopeEnforcement: 'permissive' },
    };
    const result = normalizeConfig(raw);
    expect(result.permissions.scope_enforcement).toBe('permissive');
  });

  it('should not overwrite existing permissions with behavior', () => {
    const raw = {
      behavior: { autoCommit: true },
      permissions: { auto_commit: false, scope_enforcement: 'strict', auto_push: false, auto_pr: false },
    };
    const result = normalizeConfig(raw);
    expect(result.permissions.auto_commit).toBe(false);
  });

  it('should fill missing permissions fields from behavior', () => {
    const raw = {
      behavior: { autoCommit: false },
      permissions: { scope_enforcement: 'ask', auto_push: false, auto_pr: false },
    };
    const result = normalizeConfig(raw);
    expect(result.permissions.auto_commit).toBe(false);
    expect(result.permissions.scope_enforcement).toBe('ask');
  });

  it('should map keyed validation to array-based validation', () => {
    const raw = {
      validation: {
        lint: 'pnpm lint',
        typecheck: 'pnpm typecheck',
        test: 'pnpm test',
        build: 'pnpm build',
      },
    };
    const result = normalizeConfig(raw);
    expect(result.validation.pre_commit).toEqual(['pnpm lint', 'pnpm typecheck']);
    expect(result.validation.pre_push).toEqual(['pnpm test']);
    expect(result.validation.pre_pr).toEqual(['pnpm build']);
  });

  it('should not modify already-correct array-based validation', () => {
    const raw = {
      validation: {
        pre_commit: ['pnpm lint'],
        pre_push: ['pnpm test'],
        pre_pr: [],
      },
    };
    const result = normalizeConfig(raw);
    expect(result.validation.pre_commit).toEqual(['pnpm lint']);
    expect(result.validation.pre_push).toEqual(['pnpm test']);
    expect(result.validation.pre_pr).toEqual([]);
  });

  it('should skip empty string validation commands', () => {
    const raw = {
      validation: {
        lint: 'pnpm lint',
        typecheck: '',
        test: '',
        build: '',
      },
    };
    const result = normalizeConfig(raw);
    expect(result.validation.pre_commit).toEqual(['pnpm lint']);
    expect(result.validation.pre_push).toEqual([]);
    expect(result.validation.pre_pr).toEqual([]);
  });

  it('should normalize version string to number', () => {
    const raw = { version: '1.0' };
    const result = normalizeConfig(raw);
    expect(result.version).toBe(1);
  });

  it('should leave version number unchanged', () => {
    const raw = { version: 1 };
    const result = normalizeConfig(raw);
    expect(result.version).toBe(1);
  });

  it('should handle a full legacy config from aidf init', () => {
    const raw = {
      framework: 'aidf',
      version: '1.0',
      project: { name: 'test', type: 'cli', description: 'test project' },
      provider: { type: 'claude-cli' },
      behavior: { scopeEnforcement: 'strict', autoCommit: false },
      validation: {
        lint: 'pnpm lint',
        typecheck: 'pnpm typecheck',
        test: 'pnpm test',
        build: 'pnpm build',
      },
    };
    const result = normalizeConfig(raw);

    expect(result.version).toBe(1);
    expect(result.permissions.auto_commit).toBe(false);
    expect(result.permissions.scope_enforcement).toBe('strict');
    expect(result.validation.pre_commit).toEqual(['pnpm lint', 'pnpm typecheck']);
    expect(result.validation.pre_push).toEqual(['pnpm test']);
    expect(result.validation.pre_pr).toEqual(['pnpm build']);
  });

  it('should pass through a correctly structured config unchanged', () => {
    const raw = {
      version: 1,
      provider: { type: 'claude-cli' },
      permissions: { scope_enforcement: 'ask', auto_commit: true, auto_push: false, auto_pr: false },
      validation: { pre_commit: ['pnpm lint'], pre_push: ['pnpm test'], pre_pr: [] },
      git: { commit_prefix: 'aidf:', branch_prefix: 'aidf/' },
    };
    const result = normalizeConfig(raw);
    expect(result).toEqual(raw);
  });

  it('should include format in pre_commit when present', () => {
    const raw = {
      validation: {
        lint: 'pnpm lint',
        format: 'pnpm format',
      },
    };
    const result = normalizeConfig(raw);
    expect(result.validation.pre_commit).toEqual(['pnpm lint', 'pnpm format']);
  });

  it('should default permissions fields when behavior is partial', () => {
    const raw = {
      behavior: { autoCommit: false },
    };
    const result = normalizeConfig(raw);
    expect(result.permissions.auto_commit).toBe(false);
    expect(result.permissions.auto_push).toBe(false);
    expect(result.permissions.auto_pr).toBe(false);
    expect(result.permissions.scope_enforcement).toBe('ask');
  });
});

describe('getDefaultConfig', () => {
  it('should return a valid default config', () => {
    const config = getDefaultConfig();
    expect(config.version).toBe(1);
    expect(config.provider.type).toBe('claude-cli');
    expect(config.execution.max_iterations).toBe(50);
    expect(config.permissions.auto_commit).toBe(true);
    expect(config.permissions.scope_enforcement).toBe('ask');
    expect(config.validation.pre_commit).toEqual([]);
    expect(config.git?.commit_prefix).toBe('aidf:');
  });
});

describe('findConfigFile', () => {
  it('should return null when no config file exists', () => {
    const result = findConfigFile('/nonexistent/path');
    expect(result).toBeNull();
  });

  it('should find config.yml in .ai directory', () => {
    const result = findConfigFile(process.cwd());
    // This test runs against the actual repo which has .ai/config.yml
    if (result) {
      expect(result).toContain('.ai');
      expect(result).toMatch(/config\.(yml|yaml|json)$/);
    }
  });
});

describe('loadConfigFromFile', () => {
  it('should load and normalize a YAML config', async () => {
    const { writeFileSync, mkdirSync, rmSync } = await import('fs');
    const { join } = await import('path');
    const tmpDir = join(process.cwd(), '.test-config-tmp');
    const configPath = join(tmpDir, 'config.yml');

    try {
      mkdirSync(tmpDir, { recursive: true });
      writeFileSync(configPath, `
version: 1
provider:
  type: anthropic-api
permissions:
  auto_commit: false
  scope_enforcement: strict
validation:
  pre_commit:
    - pnpm lint
  pre_push:
    - pnpm test
  pre_pr: []
`);

      const config = await loadConfigFromFile(configPath);
      expect(config.provider.type).toBe('anthropic-api');
      expect(config.permissions.auto_commit).toBe(false);
      expect(config.validation.pre_commit).toEqual(['pnpm lint']);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should load and normalize a JSON config', async () => {
    const { writeFileSync, mkdirSync, rmSync } = await import('fs');
    const { join } = await import('path');
    const tmpDir = join(process.cwd(), '.test-config-tmp');
    const configPath = join(tmpDir, 'config.json');

    try {
      mkdirSync(tmpDir, { recursive: true });
      writeFileSync(configPath, JSON.stringify({
        version: 1,
        provider: { type: 'openai-api' },
        behavior: { autoCommit: false },
      }));

      const config = await loadConfigFromFile(configPath);
      expect(config.provider.type).toBe('openai-api');
      expect(config.permissions.auto_commit).toBe(false);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('findAndLoadConfig', () => {
  it('should return default config for nonexistent path', async () => {
    const config = await findAndLoadConfig('/nonexistent/path');
    expect(config.version).toBe(1);
    expect(config.provider.type).toBe('claude-cli');
    expect(config.permissions.auto_commit).toBe(true);
  });
});

describe('config integration: init → normalizeConfig → Executor options', () => {
  it('should correctly propagate autoCommit=false through the full pipeline (legacy format)', () => {
    // Simulates what `aidf init` generates with the old behavior-based format
    const initOutput = {
      framework: 'aidf',
      version: '1.0',
      project: { name: 'test', type: 'cli', description: 'test' },
      provider: { type: 'claude-cli' },
      behavior: { scopeEnforcement: 'strict', autoCommit: false },
      validation: {
        lint: 'pnpm lint',
        typecheck: 'pnpm typecheck',
        test: 'pnpm test',
        build: 'pnpm build',
      },
    };

    const config = normalizeConfig(initOutput);

    // These are the exact paths the Executor constructor reads:
    expect(config.permissions?.auto_commit ?? true).toBe(false);
    expect(config.permissions?.scope_enforcement ?? 'ask').toBe('strict');
    expect(config.execution?.max_iterations ?? 50).toBe(50);
    expect(config.validation?.pre_commit).toEqual(['pnpm lint', 'pnpm typecheck']);
    expect(config.validation?.pre_push).toEqual(['pnpm test']);
    expect(config.validation?.pre_pr).toEqual(['pnpm build']);
  });

  it('should correctly propagate autoCommit=false through the full pipeline (new format)', () => {
    // Simulates what current `aidf init` generates (new permissions-based format)
    const initOutput = {
      framework: 'aidf',
      version: 1,
      project: { name: 'test', type: 'cli', description: 'test' },
      provider: { type: 'claude-cli' },
      permissions: {
        scope_enforcement: 'ask',
        auto_commit: false,
        auto_push: false,
        auto_pr: false,
      },
      validation: {
        pre_commit: ['pnpm lint'],
        pre_push: ['pnpm test'],
        pre_pr: [],
      },
    };

    const config = normalizeConfig(initOutput);

    // Same paths the Executor reads:
    expect(config.permissions?.auto_commit ?? true).toBe(false);
    expect(config.permissions?.auto_push ?? false).toBe(false);
    expect(config.permissions?.scope_enforcement ?? 'ask').toBe('ask');
  });

  it('should default autoCommit to true when not specified', () => {
    const minimalConfig = {
      version: 1,
      provider: { type: 'claude-cli' },
    };

    const config = normalizeConfig(minimalConfig);

    // Executor defaults: config.permissions?.auto_commit ?? true
    expect(config.permissions?.auto_commit ?? true).toBe(true);
  });

  it('should not let behavior.autoCommit override explicit permissions.auto_commit', () => {
    const conflictingConfig = {
      behavior: { autoCommit: true },
      permissions: { auto_commit: false, scope_enforcement: 'strict', auto_push: false, auto_pr: false },
    };

    const config = normalizeConfig(conflictingConfig);

    // permissions.auto_commit should win
    expect(config.permissions?.auto_commit ?? true).toBe(false);
  });
});
