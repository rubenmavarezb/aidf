# TASK: Replace DetectedCommands with Partial<ValidationConfig> in init

## Goal

Remove the `DetectedCommands` interface from `utils/files.ts` and update `init.ts` to use `Partial<ValidationConfig>` (which already exists in `validator.ts`) or build `pre_commit/pre_push/pre_pr` arrays directly from detected scripts.

## Task Type

refactor

## Suggested Roles

- developer

## Auto-Mode Compatible

YES - Type cleanup, no logic changes.

## Scope

### Allowed

- `packages/cli/src/utils/files.ts`
- `packages/cli/src/utils/files.test.ts`
- `packages/cli/src/commands/init.ts`
- `packages/cli/src/commands/init.test.ts`

### Forbidden

- `packages/cli/src/core/**`
- `templates/**`
- `docs/**`

## Requirements

1. In `utils/files.ts`:
   - Change `detectValidationCommands()` return type from `DetectedCommands` to `{ pre_commit: string[]; pre_push: string[]; pre_pr: string[] }`
   - Map detected scripts directly: lint/typecheck/format -> pre_commit, test -> pre_push, build -> pre_pr
   - Remove the `DetectedCommands` interface export

2. In `init.ts`:
   - Remove import of `DetectedCommands`
   - Remove the manual mapping code (preCommit/prePush/prePr arrays) since `detectValidationCommands` now returns the correct shape
   - Assign `validation` directly from the function return value

3. Update `init.test.ts` and `files.test.ts` to match the new return type

## Definition of Done

- [ ] `DetectedCommands` interface no longer exists
- [ ] `detectValidationCommands()` returns `{ pre_commit, pre_push, pre_pr }` directly
- [ ] `init.ts` has no manual mapping logic for validation commands
- [ ] `pnpm test` — all tests pass
- [ ] `pnpm build` — succeeds

## Notes

- `validator.ts:200` already has `detectValidationCommands()` returning `Partial<ValidationConfig>` — check if `files.ts` version can be removed entirely in favor of that one
- The duplicate function in validator.ts is async and reads package.json; the one in files.ts is sync — reconcile or pick one
