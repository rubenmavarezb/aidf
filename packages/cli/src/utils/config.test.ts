import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveConfigValue, resolveConfig, detectPlaintextSecrets } from './config.js';

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
