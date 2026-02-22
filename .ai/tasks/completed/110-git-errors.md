# TASK: Update git operations to throw/return GitError instances

## Goal

Update git operations in `executor.ts` (`commitChanges`, `revertChanges`, `stageTaskFileChanges`) and `claude-cli.ts` (`detectChangedFiles`) to throw or return `GitError` instances. Map: `git.add()` failure to `GitError.commitFailed(files, rawError)`, `git.push()` failure to `GitError.pushFailed(rawError)`, `git.checkout()` failure to `GitError.revertFailed(files, rawError)`.

## Task Type

refactor

## Suggested Roles

- developer

## Auto-Mode Compatible

YES

## Scope

### Allowed

- `packages/cli/src/core/executor.ts`
- `packages/cli/src/core/providers/claude-cli.ts`

### Forbidden

- `packages/cli/src/core/errors.ts` (read-only)
- `packages/cli/src/core/providers/anthropic-api.ts` (read-only)
- `packages/cli/src/core/providers/openai-api.ts` (read-only)
- `packages/cli/src/commands/` (read-only)

## Requirements

1. Import `GitError` from `core/errors.ts` in both `executor.ts` and `claude-cli.ts`.

2. In `executor.ts`, update git operation error handling:
   - `commitChanges` / `stageTaskFileChanges`: When `git.add()` or `git.commit()` fails, throw `GitError.commitFailed(files, rawError)` with:
     - `code: 'GIT_COMMIT_FAILED'`
     - `retryable: true`
     - `context: { operation: 'commit', files, rawError }`
   - `revertChanges`: When `git.checkout()` fails, throw `GitError.revertFailed(files, rawError)` with:
     - `code: 'GIT_REVERT_FAILED'`
     - `retryable: false`
     - `context: { operation: 'revert', files, rawError }`
   - Push operations (if any): When `git.push()` fails, throw `GitError.pushFailed(rawError)` with:
     - `code: 'GIT_PUSH_FAILED'`
     - `retryable: true`
     - `context: { operation: 'push', rawError }`

3. In `claude-cli.ts`, update `detectChangedFiles`:
   - When git spawn for `git status` or `git diff` fails, throw `GitError.statusFailed(rawError)` with:
     - `code: 'GIT_STATUS_FAILED'`
     - `retryable: true`
     - `context: { operation: 'status', rawError }`

4. Each `GitError` should have a descriptive `message` explaining what git operation failed and why.

5. Existing callers that catch generic `Error` will still catch `GitError` since it extends `Error` (backward compatible).

## Definition of Done

- [ ] `git.add()` / `git.commit()` failures throw `GitError.commitFailed()` with code `GIT_COMMIT_FAILED`
- [ ] `git.checkout()` failures throw `GitError.revertFailed()` with code `GIT_REVERT_FAILED`
- [ ] `git.push()` failures throw `GitError.pushFailed()` with code `GIT_PUSH_FAILED`
- [ ] `detectChangedFiles` git failures throw `GitError.statusFailed()` with code `GIT_STATUS_FAILED`
- [ ] All `GitError` instances have correct `retryable` values
- [ ] Existing callers still work (backward compatible)
- [ ] All existing tests pass (`pnpm test`)
- [ ] TypeScript compiles without errors (`pnpm typecheck`)

## Notes

- Part of PLAN-v080-error-categorization.md
- Depends on task 098 (needs `GitError` class from `core/errors.ts`)
- Can run in parallel with tasks 107, 108, 109
