// packages/cli/src/core/errors.ts

import type { ErrorCategory } from '../types/index.js';
export type { ErrorCategory };

export abstract class AidfError extends Error {
  abstract readonly category: ErrorCategory;
  readonly code: string;
  readonly retryable: boolean;
  readonly context: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    retryable: boolean,
    context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.retryable = retryable;
    this.context = context;
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      category: this.category,
      retryable: this.retryable,
      context: this.context,
      stack: this.stack,
    };
  }
}

// === Provider Errors ===

export type ProviderErrorCode =
  | 'PROVIDER_CRASH'
  | 'PROVIDER_NOT_AVAILABLE'
  | 'PROVIDER_API_ERROR'
  | 'PROVIDER_RATE_LIMIT';

export class ProviderError extends AidfError {
  readonly category = 'provider' as const;
  declare readonly code: ProviderErrorCode;
  declare readonly context: { provider: string; statusCode?: number; rawError?: string };

  constructor(
    message: string,
    code: ProviderErrorCode,
    retryable: boolean,
    context: { provider: string; statusCode?: number; rawError?: string }
  ) {
    super(message, code, retryable, context);
  }

  static crash(provider: string, rawError: string): ProviderError {
    return new ProviderError(
      `Provider "${provider}" crashed: ${rawError}`,
      'PROVIDER_CRASH',
      true,
      { provider, rawError }
    );
  }

  static notAvailable(provider: string): ProviderError {
    return new ProviderError(
      `Provider "${provider}" is not available`,
      'PROVIDER_NOT_AVAILABLE',
      false,
      { provider }
    );
  }

  static apiError(provider: string, message: string, statusCode?: number): ProviderError {
    const retryable = statusCode === undefined || statusCode >= 500;
    return new ProviderError(
      `Provider "${provider}" API error: ${message}`,
      'PROVIDER_API_ERROR',
      retryable,
      { provider, statusCode, rawError: message }
    );
  }

  static rateLimit(provider: string, rawError?: string): ProviderError {
    return new ProviderError(
      `Provider "${provider}" rate limited`,
      'PROVIDER_RATE_LIMIT',
      true,
      { provider, rawError }
    );
  }
}

// === Timeout Errors ===

export type TimeoutErrorCode = 'ITERATION_TIMEOUT' | 'OPERATION_TIMEOUT';

export class TimeoutError extends AidfError {
  readonly category = 'timeout' as const;
  declare readonly code: TimeoutErrorCode;
  declare readonly context: { timeoutMs: number; iteration: number; elapsedMs?: number };

  constructor(
    message: string,
    code: TimeoutErrorCode,
    context: { timeoutMs: number; iteration: number; elapsedMs?: number }
  ) {
    super(message, code, true, context);
  }

  static iteration(timeoutMs: number, iteration: number): TimeoutError {
    return new TimeoutError(
      `Iteration ${iteration} timed out after ${Math.round(timeoutMs / 1000)}s`,
      'ITERATION_TIMEOUT',
      { timeoutMs, iteration }
    );
  }

  static operation(timeoutMs: number, elapsedMs?: number): TimeoutError {
    return new TimeoutError(
      `Operation timed out after ${Math.round(timeoutMs / 1000)}s`,
      'OPERATION_TIMEOUT',
      { timeoutMs, iteration: 0, elapsedMs }
    );
  }
}

// === Validation Errors ===

export type ValidationErrorCode =
  | 'VALIDATION_PRE_COMMIT'
  | 'VALIDATION_PRE_PUSH'
  | 'VALIDATION_PRE_PR';

export class ValidationError extends AidfError {
  readonly category = 'validation' as const;
  declare readonly code: ValidationErrorCode;
  declare readonly context: { command: string; exitCode: number; output: string; phase: string };

  constructor(
    message: string,
    code: ValidationErrorCode,
    context: { command: string; exitCode: number; output: string; phase: string }
  ) {
    super(message, code, true, context);
  }

  static preCommit(command: string, exitCode: number, output: string): ValidationError {
    return new ValidationError(
      `Pre-commit validation failed: "${command}" exited with code ${exitCode}`,
      'VALIDATION_PRE_COMMIT',
      { command, exitCode, output, phase: 'pre_commit' }
    );
  }

  static prePush(command: string, exitCode: number, output: string): ValidationError {
    return new ValidationError(
      `Pre-push validation failed: "${command}" exited with code ${exitCode}`,
      'VALIDATION_PRE_PUSH',
      { command, exitCode, output, phase: 'pre_push' }
    );
  }
}

// === Scope Errors ===

export type ScopeErrorCode = 'SCOPE_FORBIDDEN' | 'SCOPE_OUTSIDE_ALLOWED' | 'SCOPE_USER_DENIED';

export class ScopeError extends AidfError {
  readonly category = 'scope' as const;
  declare readonly code: ScopeErrorCode;
  declare readonly context: { files: string[]; scopeMode: string; decision: 'BLOCK' | 'ASK_USER' };

  constructor(
    message: string,
    code: ScopeErrorCode,
    retryable: boolean,
    context: { files: string[]; scopeMode: string; decision: 'BLOCK' | 'ASK_USER' }
  ) {
    super(message, code, retryable, context);
  }

  static forbidden(files: string[], scopeMode: string): ScopeError {
    return new ScopeError(
      `${files.length} file(s) in forbidden scope: ${files.join(', ')}`,
      'SCOPE_FORBIDDEN',
      true,
      { files, scopeMode, decision: 'BLOCK' }
    );
  }

  static outsideAllowed(files: string[], scopeMode: string): ScopeError {
    return new ScopeError(
      `${files.length} file(s) outside allowed scope: ${files.join(', ')}`,
      'SCOPE_OUTSIDE_ALLOWED',
      true,
      { files, scopeMode, decision: 'BLOCK' }
    );
  }

  static userDenied(files: string[]): ScopeError {
    return new ScopeError(
      `User denied scope changes for: ${files.join(', ')}`,
      'SCOPE_USER_DENIED',
      false,
      { files, scopeMode: 'ask', decision: 'ASK_USER' }
    );
  }
}

// === Config Errors ===

export type ConfigErrorCode =
  | 'CONFIG_INVALID'
  | 'CONFIG_MISSING'
  | 'CONFIG_ENV_VAR_MISSING'
  | 'CONFIG_PARSE_ERROR';

export class ConfigError extends AidfError {
  readonly category = 'config' as const;
  declare readonly code: ConfigErrorCode;
  declare readonly context: { configPath?: string; field?: string; envVar?: string };

  constructor(
    message: string,
    code: ConfigErrorCode,
    context: { configPath?: string; field?: string; envVar?: string } = {}
  ) {
    super(message, code, false, context);
  }

  static invalid(field: string, value: unknown, expected: string): ConfigError {
    return new ConfigError(
      `Invalid config value for "${field}": got ${JSON.stringify(value)}, expected ${expected}`,
      'CONFIG_INVALID',
      { field }
    );
  }

  static missing(configPath: string): ConfigError {
    return new ConfigError(
      `Config file not found: ${configPath}`,
      'CONFIG_MISSING',
      { configPath }
    );
  }

  static missingEnvVar(varName: string): ConfigError {
    return new ConfigError(
      `Environment variable "${varName}" is not set`,
      'CONFIG_ENV_VAR_MISSING',
      { envVar: varName }
    );
  }

  static parseError(configPath: string, rawError: string): ConfigError {
    return new ConfigError(
      `Failed to parse config file "${configPath}": ${rawError}`,
      'CONFIG_PARSE_ERROR',
      { configPath }
    );
  }
}

// === Git Errors ===

export type GitErrorCode =
  | 'GIT_COMMIT_FAILED'
  | 'GIT_PUSH_FAILED'
  | 'GIT_REVERT_FAILED'
  | 'GIT_STATUS_FAILED';

export class GitError extends AidfError {
  readonly category = 'git' as const;
  declare readonly code: GitErrorCode;
  declare readonly context: { operation: string; files?: string[]; rawError?: string };

  constructor(
    message: string,
    code: GitErrorCode,
    retryable: boolean,
    context: { operation: string; files?: string[]; rawError?: string }
  ) {
    super(message, code, retryable, context);
  }

  static commitFailed(files: string[], rawError: string): GitError {
    return new GitError(
      `Git commit failed: ${rawError}`,
      'GIT_COMMIT_FAILED',
      true,
      { operation: 'commit', files, rawError }
    );
  }

  static pushFailed(rawError: string): GitError {
    return new GitError(
      `Git push failed: ${rawError}`,
      'GIT_PUSH_FAILED',
      true,
      { operation: 'push', rawError }
    );
  }

  static revertFailed(files: string[], rawError: string): GitError {
    return new GitError(
      `Git revert failed: ${rawError}`,
      'GIT_REVERT_FAILED',
      false,
      { operation: 'revert', files, rawError }
    );
  }

  static statusFailed(rawError: string): GitError {
    return new GitError(
      `Git status failed: ${rawError}`,
      'GIT_STATUS_FAILED',
      true,
      { operation: 'status', rawError }
    );
  }
}

// === Permission Errors ===

export type PermissionErrorCode =
  | 'PERMISSION_SKIP_DENIED'
  | 'PERMISSION_COMMAND_BLOCKED'
  | 'PERMISSION_FILE_ACCESS';

export class PermissionError extends AidfError {
  readonly category = 'permission' as const;
  declare readonly code: PermissionErrorCode;
  declare readonly context: { resource?: string; command?: string; policy?: string };

  constructor(
    message: string,
    code: PermissionErrorCode,
    context: { resource?: string; command?: string; policy?: string } = {}
  ) {
    super(message, code, false, context);
  }

  static skipDenied(resource: string): PermissionError {
    return new PermissionError(
      `Permission skip denied for: ${resource}`,
      'PERMISSION_SKIP_DENIED',
      { resource }
    );
  }

  static commandBlocked(command: string, policy: string): PermissionError {
    return new PermissionError(
      `Command blocked by policy: "${command}" (${policy})`,
      'PERMISSION_COMMAND_BLOCKED',
      { command, policy }
    );
  }

  static fileAccess(resource: string): PermissionError {
    return new PermissionError(
      `File access denied: ${resource}`,
      'PERMISSION_FILE_ACCESS',
      { resource }
    );
  }

  static apiAuth(provider: string): PermissionError {
    return new PermissionError(
      `Authentication failed for provider "${provider}"`,
      'PERMISSION_FILE_ACCESS',
      { resource: provider, policy: 'api_auth' }
    );
  }
}

// === Helper ===

export function isRetryable(error: AidfError): boolean {
  return error.retryable;
}
