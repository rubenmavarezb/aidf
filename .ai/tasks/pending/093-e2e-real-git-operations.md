# TASK: E2E tests for git operations against real repositories

## Goal

Test git operations (init, commit, branch, scope validation, task file movement) against actual git repositories created on disk. File: `packages/cli/src/__tests__/e2e/git-operations.e2e.test.ts`.

## Task Type

test

## Suggested Roles

- tester

## Auto-Mode Compatible

YES

## Scope

### Allowed

- `packages/cli/src/__tests__/e2e/git-operations.e2e.test.ts`

### Forbidden

- `packages/cli/src/core/executor.ts` (read-only)
- `packages/cli/src/core/safety.ts` (read-only)
- `packages/cli/src/commands/**` (read-only)
- `packages/cli/src/utils/**` (read-only)

## Requirements

1. **Initialize a git repo and verify .git exists** — Use `initGitRepo()` helper. Assert `.git/` directory exists, `git status` returns clean.

2. **Create and commit a file, verify git log** — Write `src/index.ts`, stage, commit with prefix `aidf:`. Verify `git log --oneline` contains the prefixed message.

3. **Auto-commit flow simulation** — Create a project with `auto_commit: true` config. Create a file in allowed scope. Simulate the executor commit step using `simple-git`. Verify the commit exists and the message follows the `commit_prefix` convention.

4. **Branch creation with prefix** — Create a branch `aidf/task-001`. Verify branch exists via `git branch --list`.

5. **Scope check against git diff** — Commit a baseline. Create files in allowed and forbidden scope. Run `git diff --name-only` and feed results to `checkFileChanges()`. Verify correct BLOCK/ALLOW decisions.

6. **Revert forbidden file changes via git checkout** — Commit baseline. Modify a forbidden file. Use `git checkout -- <file>` to revert. Verify the file content is restored.

7. **Staged vs unstaged detection** — Stage one file, leave another unstaged. Verify the executor's change detection distinguishes between them correctly.

8. **Task file movement (pending -> completed)** — Create a task file at `.ai/tasks/pending/001-task.md`. Call `moveTaskFile()` with status `completed`. Verify the file now exists at `.ai/tasks/completed/001-task.md` and the original is gone.

9. **Task file movement (pending -> blocked)** — Same as above but with `blocked` status. Verify the file is at `.ai/tasks/blocked/001-task.md`.

10. **Git staging of moved task files** — After moving a task file, verify `git status` shows the old path as deleted and the new path as a new file (or renamed).

## Definition of Done

- [ ] All 10 test cases are implemented and passing
- [ ] Tests use `createTempProject({ withGit: true })` and `initGitRepo()` from the E2E helpers (task 090)
- [ ] Tests run against real git repositories, not mocked git
- [ ] Each test creates its own temp directory with its own git repo and cleans up after itself
- [ ] Git operations use `--no-gpg-sign` and minimal config for speed
- [ ] Git user config is set via env vars (`GIT_AUTHOR_NAME`, `GIT_AUTHOR_EMAIL`, `GIT_COMMITTER_NAME`, `GIT_COMMITTER_EMAIL`) to avoid depending on global git config
- [ ] `pnpm test` — all existing tests continue to pass

## Notes

- Part of PLAN-v080-e2e-tests.md
- Depends on task 090 (E2E test infrastructure)
- Independent of tasks 091-092, 094-097
- Keep repos small (1-3 files) to keep tests fast
