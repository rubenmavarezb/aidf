# TASK: Create error class hierarchy in core/errors.ts

## Goal

Create `packages/cli/src/core/errors.ts` with the full error class hierarchy. Define `AidfError` base class extending `Error` with: `code: string`, `retryable: boolean`, `context: Record<string, unknown>`, `category: ErrorCategory` (union type of `'provider' | 'timeout' | 'validation' | 'scope' | 'config' | 'git' | 'permission'`). Create 7 subclasses: `ProviderError`, `TimeoutError`, `ValidationError`, `ScopeError`, `ConfigError`, `GitError`, `PermissionError`. Each subclass restricts `code` to its specific union of codes. Add static factory methods for common cases. Export an `ErrorCategory` type and a `isRetryable(error: AidfError): boolean` helper. Add `toJSON()` method for structured logging.

## Task Type

refactor

## Suggested Roles

- developer

## Auto-Mode Compatible

YES

## Scope

### Allowed

- `packages/cli/src/core/errors.ts`
- `packages/cli/src/types/index.ts`

### Forbidden

- `packages/cli/src/core/executor.ts` (read-only)
- `packages/cli/src/core/providers/` (read-only)
- `packages/cli/src/commands/` (read-only)

## Requirements

1. Define `ErrorCategory` type as `'provider' | 'timeout' | 'validation' | 'scope' | 'config' | 'git' | 'permission'`.

2. Create `AidfError` base class extending `Error` with:
   - `code: string` — machine-readable error code
   - `retryable: boolean` — whether the executor should retry
   - `context: Record<string, unknown>` — structured context data
   - `category: ErrorCategory` — which error class this belongs to
   - `toJSON()` method returning `{ name, code, message, category, retryable, context, stack }`
   - Proper `Error` subclass behavior (stack trace, message, name)

3. Create `ProviderError` subclass with:
   - `code` restricted to `'PROVIDER_CRASH' | 'PROVIDER_NOT_AVAILABLE' | 'PROVIDER_API_ERROR' | 'PROVIDER_RATE_LIMIT'`
   - `category` always `'provider'`
   - `context: { provider: string, statusCode?: number, rawError?: string }`
   - Static factory methods:
     - `ProviderError.crash(provider: string, rawError: string): ProviderError` — retryable: true
     - `ProviderError.notAvailable(provider: string): ProviderError` — retryable: false
     - `ProviderError.apiError(provider: string, message: string, statusCode?: number): ProviderError` — retryable: true for 5xx/network, false for 4xx auth
     - `ProviderError.rateLimit(provider: string, rawError?: string): ProviderError` — retryable: true

4. Create `TimeoutError` subclass with:
   - `code` restricted to `'ITERATION_TIMEOUT' | 'OPERATION_TIMEOUT'`
   - `category` always `'timeout'`
   - `retryable` always `true`
   - `context: { timeoutMs: number, iteration: number, elapsedMs?: number }`
   - Static factory methods:
     - `TimeoutError.iteration(timeoutMs: number, iteration: number): TimeoutError`
     - `TimeoutError.operation(timeoutMs: number, elapsedMs?: number): TimeoutError`

5. Create `ValidationError` subclass with:
   - `code` restricted to `'VALIDATION_PRE_COMMIT' | 'VALIDATION_PRE_PUSH' | 'VALIDATION_PRE_PR'`
   - `category` always `'validation'`
   - `retryable` always `true` (AI can fix and retry)
   - `context: { command: string, exitCode: number, output: string, phase: string }`
   - Static factory methods:
     - `ValidationError.preCommit(command: string, exitCode: number, output: string): ValidationError`
     - `ValidationError.prePush(command: string, exitCode: number, output: string): ValidationError`

6. Create `ScopeError` subclass with:
   - `code` restricted to `'SCOPE_FORBIDDEN' | 'SCOPE_OUTSIDE_ALLOWED' | 'SCOPE_USER_DENIED'`
   - `category` always `'scope'`
   - `retryable`: true for `SCOPE_FORBIDDEN` and `SCOPE_OUTSIDE_ALLOWED`, false for `SCOPE_USER_DENIED`
   - `context: { files: string[], scopeMode: string, decision: 'BLOCK' | 'ASK_USER' }`
   - Static factory methods:
     - `ScopeError.forbidden(files: string[], scopeMode: string): ScopeError`
     - `ScopeError.outsideAllowed(files: string[], scopeMode: string): ScopeError`
     - `ScopeError.userDenied(files: string[]): ScopeError`

7. Create `ConfigError` subclass with:
   - `code` restricted to `'CONFIG_INVALID' | 'CONFIG_MISSING' | 'CONFIG_ENV_VAR_MISSING' | 'CONFIG_PARSE_ERROR'`
   - `category` always `'config'`
   - `retryable` always `false` (requires human intervention)
   - `context: { configPath?: string, field?: string, envVar?: string }`
   - Static factory methods:
     - `ConfigError.invalid(field: string, value: unknown, expected: string): ConfigError`
     - `ConfigError.missing(configPath: string): ConfigError`
     - `ConfigError.missingEnvVar(varName: string): ConfigError`
     - `ConfigError.parseError(configPath: string, rawError: string): ConfigError`

8. Create `GitError` subclass with:
   - `code` restricted to `'GIT_COMMIT_FAILED' | 'GIT_PUSH_FAILED' | 'GIT_REVERT_FAILED' | 'GIT_STATUS_FAILED'`
   - `category` always `'git'`
   - `retryable`: true for `GIT_COMMIT_FAILED` and `GIT_PUSH_FAILED`, false for `GIT_REVERT_FAILED`
   - `context: { operation: string, files?: string[], rawError?: string }`
   - Static factory methods:
     - `GitError.commitFailed(files: string[], rawError: string): GitError`
     - `GitError.pushFailed(rawError: string): GitError`
     - `GitError.revertFailed(files: string[], rawError: string): GitError`
     - `GitError.statusFailed(rawError: string): GitError`

9. Create `PermissionError` subclass with:
   - `code` restricted to `'PERMISSION_SKIP_DENIED' | 'PERMISSION_COMMAND_BLOCKED' | 'PERMISSION_FILE_ACCESS'`
   - `category` always `'permission'`
   - `retryable` always `false`
   - `context: { resource?: string, command?: string, policy?: string }`
   - Static factory methods:
     - `PermissionError.skipDenied(resource: string): PermissionError`
     - `PermissionError.commandBlocked(command: string, policy: string): PermissionError`
     - `PermissionError.fileAccess(resource: string): PermissionError`

10. Export `isRetryable(error: AidfError): boolean` helper function.

11. Export `ErrorCategory` type from `packages/cli/src/types/index.ts` as well (re-export).

## Definition of Done

- [ ] `packages/cli/src/core/errors.ts` exists with all 7 error subclasses
- [ ] `AidfError` base class extends `Error` with code, retryable, context, category, toJSON()
- [ ] Each subclass has typed code union, correct category, and static factory methods
- [ ] `isRetryable()` helper is exported
- [ ] `ErrorCategory` type is exported from both `core/errors.ts` and `types/index.ts`
- [ ] All classes compile without TypeScript errors (`pnpm typecheck` passes)
- [ ] Existing tests still pass (`pnpm test`)

## Notes

- Part of PLAN-v080-error-categorization.md
