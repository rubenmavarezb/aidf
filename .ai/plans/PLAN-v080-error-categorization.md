# PLAN: v0.8.0 — Error Categorization & Recovery

## Status: COMPLETED

## Overview

The current error handling in AIDF is flat: providers return `{ success: false, error: "string" }` and the executor treats all failures identically — increment a consecutive failure counter, retry, and eventually give up. There is no distinction between a transient timeout (retry-worthy), a permissions error (fatal), a scope violation (warn and continue), or a config error (fix before retrying). This plan introduces a structured error taxonomy, typed error classes, per-category recovery strategies, and updates all providers and the executor to use them.

## Goals

- Define a clear error taxonomy with 7 categories: `ProviderError`, `TimeoutError`, `ValidationError`, `ScopeError`, `ConfigError`, `GitError`, `PermissionError`
- Each error carries a machine-readable `code`, human-readable `message`, optional `context` object, and a `retryable` flag
- Providers throw or return categorized errors instead of generic `success: false` with string messages
- The executor reacts differently to each error category (retry, fail fast, warn, backoff)
- `ExecutionResult` includes the error category so consumers (CLI, notifications, parallel executor) can act on it
- Error recovery strategies are explicit and configurable
- Full test coverage for all error paths

## Non-Goals

- User-facing error reporting UI (CLI output formatting is a separate concern)
- Retry policies with exponential backoff (can be added later on top of the `retryable` flag)
- Error telemetry or external error reporting services
- Changing the Provider interface signature (we extend, not break)

## Error Taxonomy

### Hierarchy

```
AidfError (base)
├── ProviderError       — Provider-level failures (process crash, API error, rate limit)
│   ├── code: PROVIDER_CRASH | PROVIDER_NOT_AVAILABLE | PROVIDER_API_ERROR | PROVIDER_RATE_LIMIT
│   ├── retryable: true (for RATE_LIMIT, transient API errors), false (for NOT_AVAILABLE, auth)
│   └── context: { provider: string, statusCode?: number, rawError?: string }
│
├── TimeoutError        — Iteration or operation exceeded time limit
│   ├── code: ITERATION_TIMEOUT | OPERATION_TIMEOUT
│   ├── retryable: true (always — timeouts are transient by nature)
│   └── context: { timeoutMs: number, iteration: number, elapsedMs?: number }
│
├── ValidationError     — Pre-commit/pre-push validation commands failed
│   ├── code: VALIDATION_PRE_COMMIT | VALIDATION_PRE_PUSH | VALIDATION_PRE_PR
│   ├── retryable: true (AI can fix and retry)
│   └── context: { command: string, exitCode: number, output: string, phase: string }
│
├── ScopeError          — File changes outside allowed scope
│   ├── code: SCOPE_FORBIDDEN | SCOPE_OUTSIDE_ALLOWED | SCOPE_USER_DENIED
│   ├── retryable: true (for FORBIDDEN/OUTSIDE — AI can retry within scope)
│   │             false (for USER_DENIED — user explicitly said no)
│   └── context: { files: string[], scopeMode: string, decision: 'BLOCK' | 'ASK_USER' }
│
├── ConfigError         — Invalid or missing configuration
│   ├── code: CONFIG_INVALID | CONFIG_MISSING | CONFIG_ENV_VAR_MISSING | CONFIG_PARSE_ERROR
│   ├── retryable: false (always — requires human intervention)
│   └── context: { configPath?: string, field?: string, envVar?: string }
│
├── GitError            — Git operations failed (commit, push, checkout, revert)
│   ├── code: GIT_COMMIT_FAILED | GIT_PUSH_FAILED | GIT_REVERT_FAILED | GIT_STATUS_FAILED
│   ├── retryable: true (for COMMIT/PUSH — transient lock issues)
│   │             false (for REVERT_FAILED — corrupted state)
│   └── context: { operation: string, files?: string[], rawError?: string }
│
└── PermissionError     — Security or permission violations
    ├── code: PERMISSION_SKIP_DENIED | PERMISSION_COMMAND_BLOCKED | PERMISSION_FILE_ACCESS
    ├── retryable: false (always — requires config change or human approval)
    └── context: { resource?: string, command?: string, policy?: string }
```

### Retryable Summary

| Error Class       | Codes                                              | Retryable | Executor Reaction                                            |
|--------------------|-----------------------------------------------------|-----------|--------------------------------------------------------------|
| `ProviderError`    | `PROVIDER_CRASH`                                    | Yes       | Retry, increment failure counter                             |
| `ProviderError`    | `PROVIDER_NOT_AVAILABLE`                            | No        | Fail fast, abort execution immediately                       |
| `ProviderError`    | `PROVIDER_API_ERROR` (5xx, network)                 | Yes       | Retry with backoff, increment failure counter                |
| `ProviderError`    | `PROVIDER_API_ERROR` (4xx auth)                     | No        | Fail fast, abort execution                                   |
| `ProviderError`    | `PROVIDER_RATE_LIMIT`                               | Yes       | Retry after delay, do NOT increment failure counter          |
| `TimeoutError`     | `ITERATION_TIMEOUT`                                 | Yes       | Retry, increment failure counter                             |
| `TimeoutError`     | `OPERATION_TIMEOUT`                                 | Yes       | Retry, increment failure counter                             |
| `ValidationError`  | `VALIDATION_PRE_COMMIT`                             | Yes       | Feed error back to AI, increment failure counter             |
| `ValidationError`  | `VALIDATION_PRE_PUSH`                               | Yes       | Feed error back to AI, increment failure counter             |
| `ScopeError`       | `SCOPE_FORBIDDEN`                                   | Yes       | Revert files, warn AI, increment failure counter             |
| `ScopeError`       | `SCOPE_OUTSIDE_ALLOWED`                             | Yes       | Revert files, warn AI, increment failure counter             |
| `ScopeError`       | `SCOPE_USER_DENIED`                                 | No        | Revert files, increment failure counter                      |
| `ConfigError`      | All codes                                            | No        | Fail fast, abort execution immediately                       |
| `GitError`         | `GIT_COMMIT_FAILED`                                 | Yes       | Retry once, then warn and continue without commit            |
| `GitError`         | `GIT_PUSH_FAILED`                                   | Yes       | Retry once, then mark as warning (push can be manual)        |
| `GitError`         | `GIT_REVERT_FAILED`                                 | No        | Fail fast — state is potentially corrupted                   |
| `PermissionError`  | All codes                                            | No        | Fail fast, abort execution immediately                       |

## Tasks

### Phase 1: Error Foundation

- [ ] `098-error-types.md` — Create `packages/cli/src/core/errors.ts` with the full error class hierarchy. Define `AidfError` base class extending `Error` with: `code: string`, `retryable: boolean`, `context: Record<string, unknown>`, `category: ErrorCategory` (union type of `'provider' | 'timeout' | 'validation' | 'scope' | 'config' | 'git' | 'permission'`). Create 7 subclasses: `ProviderError`, `TimeoutError`, `ValidationError`, `ScopeError`, `ConfigError`, `GitError`, `PermissionError`. Each subclass restricts `code` to its specific union of codes (e.g., `ProviderError` only accepts `'PROVIDER_CRASH' | 'PROVIDER_NOT_AVAILABLE' | 'PROVIDER_API_ERROR' | 'PROVIDER_RATE_LIMIT'`). Add static factory methods for common cases (e.g., `ProviderError.crash(provider, rawError)`, `TimeoutError.iteration(timeoutMs, iteration)`, `ConfigError.missingEnvVar(varName)`). Export an `ErrorCategory` type and a `isRetryable(error: AidfError): boolean` helper. Add `toJSON()` method for structured logging.

- [ ] `099-error-types-tests.md` — Create `packages/cli/src/core/errors.test.ts`. Test all 7 error classes: construction, code narrowing, retryable flag, context object, `toJSON()` serialization, `instanceof` checks, factory methods. Test that `AidfError` is a proper `Error` subclass (has stack trace, message, name). Test `isRetryable()` helper. At least 30 test cases covering all error codes.

### Phase 2: Update ExecutionResult

- [ ] `100-execution-result-error-category.md` — Update `ExecutionResult` in `packages/cli/src/core/providers/types.ts`: add optional `errorCategory?: ErrorCategory` and `errorCode?: string` fields alongside the existing `error?: string`. Update `ExecutorResult` in `packages/cli/src/types/index.ts`: add optional `errorCategory?: ErrorCategory`, `errorCode?: string`, and `errorDetails?: Record<string, unknown>` fields. These are additive changes — the existing `error` string field is preserved for backward compatibility. Update the `ExecutorResult` construction in `executor.ts` to populate the new fields when an `AidfError` is caught.

### Phase 3: Update Providers

- [ ] `101-claude-cli-errors.md` — Update `packages/cli/src/core/providers/claude-cli.ts` to return categorized errors. Map the current error paths: (1) `proc.on('error')` → `ProviderError.crash('claude-cli', error.message)`, (2) timeout handler → `TimeoutError.iteration(timeout, ...)`, (3) non-zero exit code with stderr → `ProviderError.apiError('claude-cli', stderr, exitCode)`, (4) `isAvailable()` failure → `ProviderError.notAvailable('claude-cli')`. Populate `errorCategory` and `errorCode` in the returned `ExecutionResult`. The `detectChangedFiles` helper: wrap git spawn errors as `GitError.statusFailed(rawError)`.

- [ ] `102-anthropic-api-errors.md` — Update `packages/cli/src/core/providers/anthropic-api.ts` to categorize errors from the Anthropic SDK. In the `catch` block: (1) check for `Anthropic.RateLimitError` or status 429 → `ProviderError.rateLimit('anthropic-api', ...)`, (2) status 401/403 → `PermissionError.apiAuth('anthropic-api')`, (3) status 5xx or network errors → `ProviderError.apiError('anthropic-api', message, statusCode)`, (4) other errors → `ProviderError.crash('anthropic-api', message)`. Populate `errorCategory` and `errorCode` in returned `ExecutionResult`.

- [ ] `103-openai-api-errors.md` — Update `packages/cli/src/core/providers/openai-api.ts` to categorize errors from the OpenAI SDK. Same mapping pattern as task 102: (1) rate limit (429) → `ProviderError.rateLimit('openai-api', ...)`, (2) auth errors (401/403) → `PermissionError.apiAuth('openai-api')`, (3) server errors (5xx) → `ProviderError.apiError('openai-api', ...)`, (4) JSON parse errors for tool call arguments → `ProviderError.crash('openai-api', 'Invalid tool call arguments')`. Populate `errorCategory` and `errorCode` in returned `ExecutionResult`.

- [ ] `104-provider-errors-tests.md` — Create or extend test files for all three providers. For each provider, test: (1) successful execution still works unchanged, (2) timeout returns `TimeoutError` category, (3) process/API crash returns `ProviderError` category, (4) rate limit returns correct category and `retryable: true`, (5) auth errors return `PermissionError` and `retryable: false`, (6) `errorCategory` and `errorCode` fields are correctly populated in `ExecutionResult`. Mock external dependencies (child_process, Anthropic SDK, OpenAI SDK). At least 20 new test cases.

### Phase 4: Update Executor

- [ ] `105-executor-error-handling.md` — Refactor the main loop in `packages/cli/src/core/executor.ts` to handle errors by category instead of treating all failures identically. Import error classes from `core/errors.ts`. Changes: (1) When `ExecutionResult` has `errorCategory`, use it to decide behavior. (2) `ConfigError` / `PermissionError` → set status to `'failed'`, break loop immediately, do NOT increment consecutive failure counter. (3) `TimeoutError` → log warning, increment failure counter, retry. (4) `ProviderError` with `PROVIDER_RATE_LIMIT` → log info "Rate limited, waiting...", do NOT increment failure counter, add a 5-second delay before next iteration. (5) `ProviderError` with `PROVIDER_NOT_AVAILABLE` → fail fast, break loop. (6) `ProviderError` with `PROVIDER_CRASH` or `PROVIDER_API_ERROR` (retryable) → increment failure counter, retry. (7) `ValidationError` → feed validation output back to AI (existing behavior), increment failure counter. (8) `ScopeError` → revert files (existing behavior), increment failure counter unless `SCOPE_USER_DENIED` which fails fast. (9) `GitError` with `GIT_REVERT_FAILED` → fail fast. (10) `GitError` with `GIT_COMMIT_FAILED` / `GIT_PUSH_FAILED` → retry once, then warn and continue. Also update the outer `catch` block to detect `AidfError` instances and populate `ExecutorResult` with category info.

- [ ] `106-executor-error-handling-tests.md` — Extend `packages/cli/src/core/executor.test.ts` with tests for the new error category handling. Test scenarios: (1) `ConfigError` causes immediate abort with `status: 'failed'`. (2) `PermissionError` causes immediate abort. (3) `TimeoutError` is retried up to `maxConsecutiveFailures`. (4) `PROVIDER_RATE_LIMIT` does not increment failure counter. (5) `PROVIDER_NOT_AVAILABLE` causes immediate abort. (6) `ValidationError` feeds error back to AI prompt. (7) `ScopeError.SCOPE_USER_DENIED` causes immediate abort. (8) `GitError.GIT_REVERT_FAILED` causes immediate abort. (9) `GitError.GIT_COMMIT_FAILED` retries once then continues without commit. (10) Mixed error sequence: timeout → success → scope error → success → complete. At least 15 new test cases.

### Phase 5: Integration & Observability

- [ ] `107-scope-guard-errors.md` — Update `packages/cli/src/core/safety.ts` (`ScopeGuard.validate()`) to return `ScopeError` instances instead of plain `ScopeDecision` objects with string reasons. The `ScopeDecision` type gets an optional `error?: ScopeError` field. When `action` is `BLOCK`, the decision includes a `ScopeError` with code `SCOPE_FORBIDDEN` or `SCOPE_OUTSIDE_ALLOWED`. When `action` is `ASK_USER` and the user denies, the executor creates `ScopeError` with code `SCOPE_USER_DENIED`. This is a non-breaking change — existing `reason` and `files` fields remain.

- [ ] `108-validator-errors.md` — Update `packages/cli/src/core/validator.ts` to produce `ValidationError` instances. When `preCommit()` returns `{ passed: false }`, the `ValidationSummary` gets an optional `error?: ValidationError` field populated with the failing command, exit code, and output. The executor can then use this typed error instead of formatting the report itself.

- [ ] `109-config-errors.md` — Update `packages/cli/src/utils/config.ts` (`resolveConfig`, `findAndLoadConfig`) to throw `ConfigError` instances instead of generic `Error`. Map: missing config file → `ConfigError.missing(path)`, YAML parse failure → `ConfigError.parseError(path, rawError)`, missing env var reference → `ConfigError.missingEnvVar(varName)`, invalid field value → `ConfigError.invalid(field, value, expected)`.

- [ ] `110-git-errors.md` — Update git operations in `executor.ts` (`commitChanges`, `revertChanges`, `stageTaskFileChanges`) and `claude-cli.ts` (`detectChangedFiles`) to throw or return `GitError` instances. Map: `git.add()` failure → `GitError.commitFailed(files, rawError)`, `git.push()` failure → `GitError.pushFailed(rawError)`, `git.checkout()` failure → `GitError.revertFailed(files, rawError)`.

- [ ] `111-notification-error-category.md` — Update `NotificationEvent` in `packages/cli/src/types/index.ts` to include optional `errorCategory?: ErrorCategory` and `errorCode?: string`. Update `NotificationService.notifyResult()` to pass error category info. Update notification message formatting to include the error category when present (e.g., "[TIMEOUT] Task blocked: iteration exceeded 300s limit" instead of generic "Task blocked").

- [ ] `112-integration-tests.md` — End-to-end tests that verify the full error flow: (1) Provider returns categorized error → executor handles it correctly → `ExecutorResult` has category → notification includes category. (2) Config error during `executor.run()` → immediate failure with `ConfigError` category. (3) Scope violation → `ScopeError` in result. (4) Validation failure → `ValidationError` passed back to AI. (5) Git commit failure → retry and recovery. At least 10 integration-level test cases.

## Dependencies

- Task 099 depends on 098 (tests need the error classes)
- Task 100 depends on 098 (needs `ErrorCategory` type)
- Tasks 101, 102, 103 depend on 098 + 100 (need error classes and updated `ExecutionResult`)
- Task 104 depends on 101 + 102 + 103
- Task 105 depends on 098 + 100 + 101 + 102 + 103 (executor needs all providers updated)
- Task 106 depends on 105
- Tasks 107, 108, 109, 110 depend on 098 (need error classes), can run in parallel
- Task 111 depends on 098 + 100
- Task 112 depends on all previous tasks

```
098 ──→ 099
  │
  ├──→ 100 ──→ 101 ──┐
  │          ├──→ 102 ──┤
  │          └──→ 103 ──┤
  │                     ├──→ 104
  │                     └──→ 105 ──→ 106
  ├──→ 107
  ├──→ 108
  ├──→ 109
  ├──→ 110
  └──→ 111
                              All ──→ 112
```

## Risks

- **Backward compatibility**: Adding `errorCategory`/`errorCode` to `ExecutionResult` and `ExecutorResult` is additive, but consumers that destructure these types may need updates. Mitigated by keeping all new fields optional.
- **Provider SDK error shapes**: Anthropic and OpenAI SDK error classes may change between versions. Mitigated by checking for status codes and error types defensively, with fallback to `ProviderError.crash()`.
- **Over-categorization**: Too many error codes can make the system harder to reason about. Mitigated by keeping the taxonomy flat (7 classes, ~20 codes total) and using factory methods to enforce consistency.
- **Rate limit handling**: The 5-second delay for rate limits is a simple heuristic. In production, providers may return `Retry-After` headers. This plan does not implement adaptive backoff — that can be added in a follow-up.
- **Test mocking complexity**: Simulating all error paths across 3 providers and the executor requires careful mocking. Mitigated by using existing mock patterns from the codebase (`vi.mock('child_process')`, mock SDK clients).

## Success Criteria

- All 7 error classes exist in `core/errors.ts` with proper TypeScript typing (code narrowing, context types)
- All 3 providers return categorized errors for every failure path (no more bare `success: false` with only a string)
- The executor handles at least 6 distinct error categories with different behaviors (retry, fail fast, warn, backoff)
- `ExecutorResult` includes `errorCategory` and `errorCode` for all failure/blocked states
- Notifications include error category in messages
- At least 75 new test cases across all error-related test files
- All existing 298+ tests still pass
- Zero breaking changes to public types (all new fields are optional)
