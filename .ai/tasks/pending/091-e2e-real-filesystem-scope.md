# TASK: E2E tests for ScopeGuard with real filesystem

## Goal

Test ScopeGuard and file operations against a real filesystem to validate that scope checking, glob matching, and file change detection work correctly with actual files and directories on disk. File: `packages/cli/src/__tests__/e2e/filesystem-scope.e2e.test.ts`.

## Task Type

test

## Suggested Roles

- tester

## Auto-Mode Compatible

YES

## Scope

### Allowed

- `packages/cli/src/__tests__/e2e/filesystem-scope.e2e.test.ts`

### Forbidden

- `packages/cli/src/core/safety.ts` (read-only)
- `packages/cli/src/core/executor.ts` (read-only)
- `packages/cli/src/commands/**` (read-only)
- `packages/cli/src/utils/**` (read-only)

## Requirements

1. **Create files in allowed scope, verify ALLOW** — Use `createTempProject()`, create files at `src/components/Button.tsx` and `src/utils/helpers.ts`. Run `checkFileChanges()` with scope `allowed: ['src/**']`. Assert action is `ALLOW`.

2. **Create files in forbidden scope, verify BLOCK** — Create `.env` and `src/config/secrets.ts`. Run with `forbidden: ['.env*', 'src/config/**']`. Assert action is `BLOCK` and `files` contains both paths.

3. **Create files outside allowed scope in strict mode, verify BLOCK** — Create `scripts/deploy.sh`. Run with `allowed: ['src/**']`, mode `strict`. Assert BLOCK.

4. **Create files outside allowed scope in permissive mode, verify ALLOW** — Same file (`scripts/deploy.sh`), mode `permissive`. Assert ALLOW.

5. **Nested glob matching with real directory tree** — Create `src/components/forms/Input.tsx`, `src/components/forms/Select.tsx`, `src/components/Button.tsx`. Verify `allowed: ['src/components/forms/**']` allows the first two but blocks `Button.tsx` in strict mode.

6. **Dotfile handling** — Create `.env`, `.env.local`, `.env.production`, `.gitignore`. Verify `forbidden: ['.env*']` blocks the first three but not `.gitignore`.

7. **ScopeGuard approve/revert flow with real files** — Create a ScopeGuard with `ask_before: ['package.json']`. Create `package.json` on disk. Call `approve(['package.json'])`. Verify `getChangesToRevert()` returns empty for approved files but returns non-empty for other out-of-scope files.

8. **File type detection (created vs modified vs deleted)** — Create a file, read its content, modify it, verify the change type is detected correctly. Delete the file and verify deletion detection.

9. **Symlink handling** — Create a symlink from `src/link.ts` -> `../outside/real.ts`. Verify scope check resolves the real path and correctly blocks if the real path is outside scope.

10. **Case sensitivity** — Create `SRC/File.ts` vs `src/File.ts`. Verify pattern matching behavior matches the OS expectations.

## Definition of Done

- [ ] All 10 test cases are implemented and passing
- [ ] Tests use `createTempProject()` from the E2E helpers (task 090)
- [ ] Tests run against real files on disk, not mocked filesystem
- [ ] Symlink test is skipped on Windows (if applicable)
- [ ] Each test creates its own temp directory and cleans up after itself
- [ ] `pnpm test` — all existing tests continue to pass

## Notes

- Part of PLAN-v080-e2e-tests.md
- Depends on task 090 (E2E test infrastructure)
- Independent of tasks 092-097
- OS-specific path behavior (Windows vs macOS vs Linux) should be handled — use `path.join()` and `path.resolve()` everywhere, normalize slashes in assertions
