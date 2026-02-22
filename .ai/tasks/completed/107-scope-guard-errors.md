# TASK: Update ScopeGuard to return ScopeError instances

## Goal

Update `packages/cli/src/core/safety.ts` (`ScopeGuard.validate()`) to return `ScopeError` instances instead of plain `ScopeDecision` objects with string reasons. The `ScopeDecision` type gets an optional `error?: ScopeError` field. When `action` is `BLOCK`, the decision includes a `ScopeError` with code `SCOPE_FORBIDDEN` or `SCOPE_OUTSIDE_ALLOWED`. When `action` is `ASK_USER` and the user denies, the executor creates `ScopeError` with code `SCOPE_USER_DENIED`. This is a non-breaking change -- existing `reason` and `files` fields remain.

## Task Type

refactor

## Suggested Roles

- developer

## Auto-Mode Compatible

YES

## Scope

### Allowed

- `packages/cli/src/core/safety.ts`
- `packages/cli/src/types/index.ts`

### Forbidden

- `packages/cli/src/core/executor.ts` (read-only)
- `packages/cli/src/core/errors.ts` (read-only)
- `packages/cli/src/commands/` (read-only)

## Requirements

1. Import `ScopeError` from `core/errors.ts` in `safety.ts`.

2. Update the `ScopeDecision` type (in `types/index.ts` or wherever it is defined) to add an optional `error?: ScopeError` field alongside the existing `reason` and `files` fields.

3. When `ScopeGuard.validate()` returns `action: 'BLOCK'`:
   - For files in the forbidden list: Populate `error` with `ScopeError.forbidden(files, scopeMode)`
   - For files outside the allowed list: Populate `error` with `ScopeError.outsideAllowed(files, scopeMode)`

4. The `SCOPE_USER_DENIED` case is handled by the executor (when the user is asked and denies), not by ScopeGuard itself. Document this in a code comment.

5. This is a non-breaking change:
   - Existing `reason: string` field remains populated
   - Existing `files: string[]` field remains populated
   - The new `error` field is optional
   - Existing consumers that don't use the `error` field continue to work

## Definition of Done

- [ ] `ScopeDecision` type has optional `error?: ScopeError` field
- [ ] `ScopeGuard.validate()` populates `error` with `ScopeError.forbidden()` for forbidden files
- [ ] `ScopeGuard.validate()` populates `error` with `ScopeError.outsideAllowed()` for out-of-scope files
- [ ] Existing `reason` and `files` fields still populated (backward compatible)
- [ ] All existing tests pass (`pnpm test`)
- [ ] TypeScript compiles without errors (`pnpm typecheck`)

## Notes

- Part of PLAN-v080-error-categorization.md
- Depends on task 098 (needs `ScopeError` class from `core/errors.ts`)
- Can run in parallel with tasks 108, 109, 110
