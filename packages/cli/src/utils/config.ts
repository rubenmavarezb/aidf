// packages/cli/src/utils/config.ts

import { existsSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';
import type { AidfConfig } from '../types/index.js';
import { ConfigError } from '../core/errors.js';

// === Zod Schema for AidfConfig ===

const providerConfigSchema = z.object({
  type: z.enum(['claude-cli', 'cursor-cli', 'anthropic-api', 'openai-api']),
  model: z.string().optional(),
}).optional();

const executionConfigSchema = z.object({
  max_iterations: z.number().int().positive().max(1000).optional(),
  max_consecutive_failures: z.number().int().positive().max(100).optional(),
  timeout_per_iteration: z.number().nonnegative().max(3600).optional(),
  session_continuation: z.boolean().optional(),
}).optional();

const permissionsConfigSchema = z.object({
  scope_enforcement: z.enum(['strict', 'ask', 'permissive']).optional(),
  auto_commit: z.boolean().optional(),
  auto_push: z.boolean().optional(),
  auto_pr: z.boolean().optional(),
}).optional();

const validationConfigSchema = z.object({
  pre_commit: z.array(z.string()).optional(),
  pre_push: z.array(z.string()).optional(),
  pre_pr: z.array(z.string()).optional(),
}).optional();

const gitConfigSchema = z.object({
  commit_prefix: z.string().optional(),
  branch_prefix: z.string().optional(),
}).optional();

const notificationsConfigSchema = z.object({
  level: z.enum(['all', 'errors', 'blocked']).optional(),
  desktop: z.object({ enabled: z.boolean() }).optional(),
  slack: z.object({ enabled: z.boolean(), webhook_url: z.string() }).optional(),
  discord: z.object({ enabled: z.boolean(), webhook_url: z.string() }).optional(),
  email: z.object({
    enabled: z.boolean(),
    smtp_host: z.string(),
    smtp_port: z.number().int().positive(),
    smtp_user: z.string(),
    smtp_pass: z.string(),
    from: z.string(),
    to: z.string(),
  }).optional(),
  webhook: z.object({
    enabled: z.boolean(),
    url: z.string(),
    headers: z.record(z.string()).optional(),
  }).optional(),
}).optional();

const skillsConfigSchema = z.object({
  enabled: z.boolean().optional(),
  directories: z.array(z.string()).optional(),
  extras: z.array(z.string()).optional(),
  block_suspicious: z.boolean().optional(),
}).optional();

const securityConfigSchema = z.object({
  skip_permissions: z.boolean().optional(),
  warn_on_skip: z.boolean().optional(),
  commands: z.object({
    allowed: z.array(z.string()).optional(),
    blocked: z.array(z.string()).optional(),
    strict: z.boolean().optional(),
  }).optional(),
}).optional();

export const aidfConfigSchema = z.object({
  version: z.number().default(1),
  provider: providerConfigSchema,
  execution: executionConfigSchema,
  permissions: permissionsConfigSchema,
  validation: validationConfigSchema,
  git: gitConfigSchema,
  notifications: notificationsConfigSchema,
  skills: skillsConfigSchema,
  security: securityConfigSchema,
}).passthrough(); // Allow extra fields for forward compatibility

/**
 * Validates a normalized config against the Zod schema.
 * Returns the validated config or throws a descriptive error.
 */
export function validateConfig(config: unknown): AidfConfig {
  const result = aidfConfigSchema.safeParse(config);
  if (!result.success) {
    const issues = result.error.issues.map(issue => {
      const path = issue.path.join('.');
      return `  - ${path || 'root'}: ${issue.message}`;
    });
    throw ConfigError.invalid(
      'config',
      config,
      `Valid AIDF config.\n${issues.join('\n')}`
    );
  }
  return result.data as AidfConfig;
}

/**
 * Resolves environment variable references in configuration strings.
 * Supports ${VAR} and $VAR syntax.
 * Throws if the referenced variable is not set.
 */
export function resolveConfigValue(value: string): string {
  // Match ${VAR_NAME} syntax
  let resolved = value.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_match, varName: string) => {
    const envValue = process.env[varName];
    if (envValue === undefined) {
      throw ConfigError.missingEnvVar(varName);
    }
    return envValue;
  });

  // Match $VAR_NAME syntax (not preceded by \ or inside ${})
  // Only match standalone $VAR at word boundaries, not already handled ${VAR}
  resolved = resolved.replace(/(?<!\$\{)\$([A-Za-z_][A-Za-z0-9_]*)/g, (_match, varName: string) => {
    const envValue = process.env[varName];
    if (envValue === undefined) {
      throw ConfigError.missingEnvVar(varName);
    }
    return envValue;
  });

  return resolved;
}

/**
 * Recursively resolves all environment variable references in a config object.
 * Walks through nested objects and arrays, resolving string values.
 */
export function resolveConfig<T extends object>(config: T): T {
  return resolveValue(config) as T;
}

function resolveValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return resolveConfigValue(value);
  }

  if (Array.isArray(value)) {
    return value.map(item => resolveValue(item));
  }

  if (value !== null && typeof value === 'object') {
    const resolved: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      resolved[key] = resolveValue(val);
    }
    return resolved;
  }

  // Numbers, booleans, null, undefined — pass through unchanged
  return value;
}

/**
 * Normalizes a raw config object (from YAML/JSON) into the expected AidfConfig structure.
 * Handles backward compatibility with configs generated by older versions of `aidf init`,
 * which used `behavior.autoCommit` / `behavior.scopeEnforcement` (camelCase) instead of
 * `permissions.auto_commit` / `permissions.scope_enforcement` (snake_case), and
 * `validation.lint` / `validation.typecheck` (keyed) instead of `validation.pre_commit[]` (arrays).
 */
export function normalizeConfig(raw: Record<string, unknown>): AidfConfig {
  const config: Record<string, unknown> = { ...raw };

  // --- Normalize behavior → permissions ---
  const behavior = config.behavior as Record<string, unknown> | undefined;
  if (behavior && !config.permissions) {
    config.permissions = {
      auto_commit: behavior.autoCommit ?? behavior.auto_commit ?? true,
      auto_push: behavior.autoPush ?? behavior.auto_push ?? false,
      auto_pr: behavior.autoPr ?? behavior.auto_pr ?? false,
      scope_enforcement: behavior.scopeEnforcement ?? behavior.scope_enforcement ?? 'ask',
    };
  } else if (behavior && config.permissions) {
    // Merge: behavior values serve as fallbacks for missing permissions fields
    const permissions = config.permissions as Record<string, unknown>;
    if (permissions.auto_commit === undefined && (behavior.autoCommit !== undefined || behavior.auto_commit !== undefined)) {
      permissions.auto_commit = behavior.autoCommit ?? behavior.auto_commit;
    }
    if (permissions.scope_enforcement === undefined && (behavior.scopeEnforcement !== undefined || behavior.scope_enforcement !== undefined)) {
      permissions.scope_enforcement = behavior.scopeEnforcement ?? behavior.scope_enforcement;
    }
  }

  // --- Normalize keyed validation → array-based validation ---
  const validation = config.validation as Record<string, unknown> | undefined;
  if (validation && !Array.isArray(validation.pre_commit) && !Array.isArray(validation.pre_push)) {
    // Old format: { lint: "pnpm lint", typecheck: "pnpm typecheck", test: "pnpm test", build: "pnpm build" }
    // Check if it has old-format keys (lint, typecheck, test, build, format)
    const oldKeys = ['lint', 'typecheck', 'format', 'test', 'build'];
    const hasOldKeys = oldKeys.some(k => typeof validation[k] === 'string');

    if (hasOldKeys) {
      const preCommit: string[] = [];
      const prePush: string[] = [];
      const prePr: string[] = [];

      // lint, typecheck, format → pre_commit
      for (const key of ['lint', 'typecheck', 'format']) {
        if (typeof validation[key] === 'string' && (validation[key] as string).length > 0) {
          preCommit.push(validation[key] as string);
        }
      }
      // test → pre_push
      if (typeof validation.test === 'string' && (validation.test as string).length > 0) {
        prePush.push(validation.test as string);
      }
      // build → pre_pr
      if (typeof validation.build === 'string' && (validation.build as string).length > 0) {
        prePr.push(validation.build as string);
      }

      config.validation = {
        pre_commit: preCommit,
        pre_push: prePush,
        pre_pr: prePr,
      };
    }
  }

  // --- Normalize version ---
  if (typeof config.version === 'string') {
    const parsed = parseFloat(config.version as string);
    if (!isNaN(parsed)) {
      config.version = parsed;
    }
  }

  return config as unknown as AidfConfig;
}

/**
 * Searches for a config file in the .ai/ directory of the given base path.
 * Returns the path if found, or null if no config file exists.
 */
export function findConfigFile(basePath?: string): string | null {
  const base = basePath ?? process.cwd();

  const possiblePaths = [
    join(base, '.ai', 'config.yml'),
    join(base, '.ai', 'config.yaml'),
    join(base, '.ai', 'config.json'),
  ];

  for (const p of possiblePaths) {
    if (existsSync(p)) {
      return p;
    }
  }
  return null;
}

/**
 * Loads and normalizes a config file from the given path.
 */
export async function loadConfigFromFile(configPath: string): Promise<AidfConfig> {
  const fs = await import('fs/promises');
  const yaml = await import('yaml');

  let content: string;
  try {
    content = await fs.readFile(configPath, 'utf-8');
  } catch {
    throw ConfigError.missing(configPath);
  }

  let raw: unknown;
  try {
    raw = configPath.endsWith('.json')
      ? JSON.parse(content)
      : yaml.parse(content);
  } catch (error) {
    const rawError = error instanceof Error ? error.message : String(error);
    throw ConfigError.parseError(configPath, rawError);
  }

  const normalized = normalizeConfig(raw as Record<string, unknown>);
  return validateConfig(normalized);
}

/**
 * Returns a default AidfConfig with sensible defaults.
 */
export function getDefaultConfig(): AidfConfig {
  return {
    version: 1,
    provider: { type: 'claude-cli' },
    execution: {
      max_iterations: 50,
      max_consecutive_failures: 3,
      timeout_per_iteration: 300,
    },
    permissions: {
      scope_enforcement: 'ask',
      auto_commit: true,
      auto_push: false,
      auto_pr: false,
    },
    validation: {
      pre_commit: [],
      pre_push: [],
      pre_pr: [],
    },
    git: {
      commit_prefix: 'aidf:',
      branch_prefix: 'aidf/',
    },
    notifications: {
      level: 'all',
      desktop: { enabled: false },
      slack: { enabled: false, webhook_url: '' },
      discord: { enabled: false, webhook_url: '' },
      webhook: { enabled: false, url: '' },
      email: {
        enabled: false,
        smtp_host: '',
        smtp_port: 587,
        smtp_user: '',
        smtp_pass: '',
        from: '',
        to: '',
      },
    },
  };
}

/**
 * Finds and loads a config file from the .ai/ directory, or returns defaults.
 */
export async function findAndLoadConfig(basePath?: string): Promise<AidfConfig> {
  const configPath = findConfigFile(basePath);
  return configPath ? loadConfigFromFile(configPath) : getDefaultConfig();
}

/** Keys in config that are likely to hold secrets */
const SENSITIVE_KEY_PATTERNS = [
  'key',
  'secret',
  'password',
  'token',
  'pass',
  'webhook_url',
];

/**
 * Checks a config object for values that look like plaintext secrets
 * (i.e., sensitive keys whose values don't use ${...} env var syntax).
 * Returns a list of warning messages.
 */
export function detectPlaintextSecrets(
  config: Record<string, unknown>,
  path: string[] = []
): string[] {
  const warnings: string[] = [];

  for (const [key, value] of Object.entries(config)) {
    const currentPath = [...path, key];

    if (typeof value === 'string' && value.length > 0) {
      const keyLower = key.toLowerCase();
      const isSensitiveKey = SENSITIVE_KEY_PATTERNS.some(pattern => keyLower.includes(pattern));
      const usesEnvVar = /\$\{[A-Za-z_][A-Za-z0-9_]*\}/.test(value) || /^\$[A-Za-z_][A-Za-z0-9_]*$/.test(value);

      if (isSensitiveKey && !usesEnvVar) {
        warnings.push(
          `Possible plaintext secret at "${currentPath.join('.')}". Consider using an environment variable: \${ENV_VAR_NAME}`
        );
      }
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      warnings.push(
        ...detectPlaintextSecrets(value as Record<string, unknown>, currentPath)
      );
    }
  }

  return warnings;
}
