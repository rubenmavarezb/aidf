// packages/cli/src/utils/config.ts

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
      throw new Error(`Environment variable "${varName}" is not set (referenced as \${${varName}})`);
    }
    return envValue;
  });

  // Match $VAR_NAME syntax (not preceded by \ or inside ${})
  // Only match standalone $VAR at word boundaries, not already handled ${VAR}
  resolved = resolved.replace(/(?<!\$\{)\$([A-Za-z_][A-Za-z0-9_]*)/g, (_match, varName: string) => {
    const envValue = process.env[varName];
    if (envValue === undefined) {
      throw new Error(`Environment variable "${varName}" is not set (referenced as $${varName})`);
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
