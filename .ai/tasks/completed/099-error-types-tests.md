# TASK: Tests for error class hierarchy

## Goal

Create `packages/cli/src/core/errors.test.ts`. Test all 7 error classes: construction, code narrowing, retryable flag, context object, `toJSON()` serialization, `instanceof` checks, factory methods. Test that `AidfError` is a proper `Error` subclass (has stack trace, message, name). Test `isRetryable()` helper. At least 30 test cases covering all error codes.

## Task Type

test

## Suggested Roles

- tester

## Auto-Mode Compatible

YES

## Scope

### Allowed

- `packages/cli/src/core/errors.test.ts`

### Forbidden

- `packages/cli/src/core/errors.ts` (read-only)
- `packages/cli/src/core/executor.ts` (read-only)
- `packages/cli/src/core/providers/` (read-only)

## Requirements

1. Test `AidfError` base class:
   - Is a proper `Error` subclass (`instanceof Error` is `true`)
   - Has `stack` property (stack trace)
   - Has `message` property
   - Has `name` property set to the class name
   - `toJSON()` returns `{ name, code, message, category, retryable, context, stack }`

2. Test `ProviderError`:
   - `ProviderError.crash('claude-cli', 'segfault')` creates error with code `PROVIDER_CRASH`, retryable `true`, context `{ provider: 'claude-cli', rawError: 'segfault' }`
   - `ProviderError.notAvailable('claude-cli')` creates error with code `PROVIDER_NOT_AVAILABLE`, retryable `false`
   - `ProviderError.apiError('anthropic-api', 'server error', 500)` creates retryable error
   - `ProviderError.apiError('anthropic-api', 'unauthorized', 401)` creates non-retryable error
   - `ProviderError.rateLimit('openai-api')` creates error with code `PROVIDER_RATE_LIMIT`, retryable `true`
   - `category` is always `'provider'`
   - `instanceof ProviderError` and `instanceof AidfError` both return `true`

3. Test `TimeoutError`:
   - `TimeoutError.iteration(300000, 5)` creates error with code `ITERATION_TIMEOUT`, retryable `true`, context `{ timeoutMs: 300000, iteration: 5 }`
   - `TimeoutError.operation(60000, 45000)` creates error with code `OPERATION_TIMEOUT`, retryable `true`
   - `category` is always `'timeout'`
   - All timeout errors are retryable

4. Test `ValidationError`:
   - `ValidationError.preCommit('pnpm lint', 1, 'ESLint errors found')` creates error with code `VALIDATION_PRE_COMMIT`, retryable `true`, context `{ command: 'pnpm lint', exitCode: 1, output: 'ESLint errors found', phase: 'pre_commit' }`
   - `ValidationError.prePush('pnpm test', 1, 'Tests failed')` creates error with code `VALIDATION_PRE_PUSH`
   - `category` is always `'validation'`

5. Test `ScopeError`:
   - `ScopeError.forbidden(['src/secret.ts'], 'strict')` creates error with code `SCOPE_FORBIDDEN`, retryable `true`
   - `ScopeError.outsideAllowed(['README.md'], 'strict')` creates error with code `SCOPE_OUTSIDE_ALLOWED`, retryable `true`
   - `ScopeError.userDenied(['config.yml'])` creates error with code `SCOPE_USER_DENIED`, retryable `false`
   - `category` is always `'scope'`

6. Test `ConfigError`:
   - `ConfigError.invalid('provider.type', 'invalid', 'claude-cli | anthropic-api')` creates error with code `CONFIG_INVALID`, retryable `false`
   - `ConfigError.missing('/path/to/config.yml')` creates error with code `CONFIG_MISSING`, retryable `false`
   - `ConfigError.missingEnvVar('ANTHROPIC_API_KEY')` creates error with code `CONFIG_ENV_VAR_MISSING`, retryable `false`
   - `ConfigError.parseError('/path/config.yml', 'unexpected token')` creates error with code `CONFIG_PARSE_ERROR`, retryable `false`
   - `category` is always `'config'`

7. Test `GitError`:
   - `GitError.commitFailed(['file.ts'], 'lock file exists')` creates error with code `GIT_COMMIT_FAILED`, retryable `true`
   - `GitError.pushFailed('rejected non-fast-forward')` creates error with code `GIT_PUSH_FAILED`, retryable `true`
   - `GitError.revertFailed(['file.ts'], 'merge conflict')` creates error with code `GIT_REVERT_FAILED`, retryable `false`
   - `GitError.statusFailed('not a git repo')` creates error with code `GIT_STATUS_FAILED`, retryable `true`
   - `category` is always `'git'`

8. Test `PermissionError`:
   - `PermissionError.skipDenied('--dangerously-skip-permissions')` creates error with code `PERMISSION_SKIP_DENIED`, retryable `false`
   - `PermissionError.commandBlocked('rm -rf /', 'destructive')` creates error with code `PERMISSION_COMMAND_BLOCKED`, retryable `false`
   - `PermissionError.fileAccess('/etc/passwd')` creates error with code `PERMISSION_FILE_ACCESS`, retryable `false`
   - `category` is always `'permission'`

9. Test `isRetryable()` helper:
   - Returns `true` for retryable errors
   - Returns `false` for non-retryable errors
   - Works correctly for all error codes

10. Test `toJSON()` serialization:
    - Verify output structure for each error class
    - Verify `stack` is included
    - Verify `context` is properly serialized

11. Minimum 30 test cases total across all error classes.

## Definition of Done

- [ ] `packages/cli/src/core/errors.test.ts` exists with at least 30 test cases
- [ ] All 7 error classes are tested: construction, code, retryable, context, category
- [ ] Factory methods are tested for each subclass
- [ ] `instanceof` checks verified for all classes
- [ ] `toJSON()` serialization tested
- [ ] `isRetryable()` helper tested
- [ ] All tests pass (`pnpm test`)

## Notes

- Part of PLAN-v080-error-categorization.md
- Depends on task 098 (error classes must exist first)
