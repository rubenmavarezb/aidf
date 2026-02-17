# TASK: E2E tests for executor file tracking with real filesystem

## Goal

Test that the executor's file tracking works correctly with real file creation, modification, and deletion on disk. File: `packages/cli/src/__tests__/e2e/filesystem-operations.e2e.test.ts`.

## Task Type

test

## Suggested Roles

- tester

## Auto-Mode Compatible

YES

## Scope

### Allowed

- `packages/cli/src/__tests__/e2e/filesystem-operations.e2e.test.ts`

### Forbidden

- `packages/cli/src/core/executor.ts` (read-only)
- `packages/cli/src/core/safety.ts` (read-only)
- `packages/cli/src/commands/**` (read-only)
- `packages/cli/src/utils/**` (read-only)

## Requirements

1. **Detect new file creation** — Create a file after a baseline git status snapshot. Verify it appears in the changed files list.

2. **Detect file modification** — Modify an existing tracked file. Verify it appears as modified.

3. **Detect file deletion** — Delete a tracked file. Verify it appears as deleted.

4. **Detect multiple simultaneous changes** — Create 3 files, modify 2, delete 1 in a single operation. Verify all 6 changes are detected.

5. **Ignore files in .gitignore** — Create `node_modules/foo.js` (gitignored). Verify it does not appear in changed files.

6. **Track files across nested directories** — Create files at depth 5 (`a/b/c/d/e/file.ts`). Verify detection.

7. **Handle empty directories** — Create an empty directory. Verify it does not appear as a file change.

8. **Binary file handling** — Create a `.png` file with buffer content. Verify it is detected as a change.

## Definition of Done

- [ ] All 8 test cases are implemented and passing
- [ ] Tests use `createTempProject({ withGit: true })` from the E2E helpers (task 090)
- [ ] Tests run against real files on disk with a real git repository
- [ ] Each test creates its own temp directory and cleans up after itself
- [ ] File change detection is tested using actual git diff/status commands
- [ ] `pnpm test` — all existing tests continue to pass

## Notes

- Part of PLAN-v080-e2e-tests.md
- Depends on task 090 (E2E test infrastructure)
- Independent of tasks 091, 093-097
- All temp directories should use the `aidf-e2e-` prefix
