# TASK: Update validator to produce ValidationError instances

## Goal

Update `packages/cli/src/core/validator.ts` to produce `ValidationError` instances. When `preCommit()` returns `{ passed: false }`, the `ValidationSummary` gets an optional `error?: ValidationError` field populated with the failing command, exit code, and output. The executor can then use this typed error instead of formatting the report itself.

## Task Type

refactor

## Suggested Roles

- developer

## Auto-Mode Compatible

YES

## Scope

### Allowed

- `packages/cli/src/core/validator.ts`
- `packages/cli/src/types/index.ts`

### Forbidden

- `packages/cli/src/core/executor.ts` (read-only)
- `packages/cli/src/core/errors.ts` (read-only)
- `packages/cli/src/commands/` (read-only)

## Requirements

1. Import `ValidationError` from `core/errors.ts` in `validator.ts`.

2. Update the `ValidationSummary` type (in `types/index.ts` or wherever it is defined) to add an optional `error?: ValidationError` field.

3. When `preCommit()` returns `{ passed: false }`:
   - Populate `error` with `ValidationError.preCommit(command, exitCode, output)` for the first failing command
   - The `command` is the specific validation command that failed (e.g., `pnpm lint`)
   - The `exitCode` is the process exit code
   - The `output` is the stderr/stdout from the failed command

4. When `prePush()` returns `{ passed: false }`:
   - Populate `error` with `ValidationError.prePush(command, exitCode, output)`

5. This is a non-breaking change:
   - Existing `passed`, `results`, and other fields remain populated
   - The new `error` field is optional
   - Existing consumers that don't use the `error` field continue to work

## Definition of Done

- [ ] `ValidationSummary` type has optional `error?: ValidationError` field
- [ ] `preCommit()` populates `error` with `ValidationError.preCommit()` when validation fails
- [ ] `prePush()` populates `error` with `ValidationError.prePush()` when validation fails
- [ ] Existing fields still populated (backward compatible)
- [ ] All existing tests pass (`pnpm test`)
- [ ] TypeScript compiles without errors (`pnpm typecheck`)

## Notes

- Part of PLAN-v080-error-categorization.md
- Depends on task 098 (needs `ValidationError` class from `core/errors.ts`)
- Can run in parallel with tasks 107, 109, 110
