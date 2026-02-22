# TASK: Add error category fields to ExecutionResult and ExecutorResult

## Goal

Update `ExecutionResult` in `packages/cli/src/core/providers/types.ts`: add optional `errorCategory?: ErrorCategory` and `errorCode?: string` fields alongside the existing `error?: string`. Update `ExecutorResult` in `packages/cli/src/types/index.ts`: add optional `errorCategory?: ErrorCategory`, `errorCode?: string`, and `errorDetails?: Record<string, unknown>` fields. These are additive changes -- the existing `error` string field is preserved for backward compatibility. Update the `ExecutorResult` construction in `executor.ts` to populate the new fields when an `AidfError` is caught.

## Task Type

refactor

## Suggested Roles

- developer

## Auto-Mode Compatible

YES

## Scope

### Allowed

- `packages/cli/src/core/providers/types.ts`
- `packages/cli/src/types/index.ts`
- `packages/cli/src/core/executor.ts`

### Forbidden

- `packages/cli/src/core/providers/claude-cli.ts` (read-only)
- `packages/cli/src/core/providers/anthropic-api.ts` (read-only)
- `packages/cli/src/core/providers/openai-api.ts` (read-only)
- `packages/cli/src/commands/` (read-only)

## Requirements

1. Import `ErrorCategory` from `core/errors.ts` in `packages/cli/src/core/providers/types.ts`.

2. Add to `ExecutionResult` interface (alongside existing `error?: string`):
   ```typescript
   errorCategory?: ErrorCategory;
   errorCode?: string;
   ```

3. Import `ErrorCategory` from `core/errors.ts` in `packages/cli/src/types/index.ts`.

4. Add to `ExecutorResult` interface (alongside existing fields):
   ```typescript
   errorCategory?: ErrorCategory;
   errorCode?: string;
   errorDetails?: Record<string, unknown>;
   ```

5. In `executor.ts`, update the outer `catch` block and failure paths:
   - When catching an `AidfError` instance, populate `errorCategory`, `errorCode`, and `errorDetails` from the error's properties
   - When catching a generic `Error`, leave the new fields undefined (backward compatible)
   - When building the final `ExecutorResult` on failure/blocked status, include the error category info if available

6. All new fields are optional to ensure backward compatibility — no existing code breaks.

## Definition of Done

- [ ] `ExecutionResult` in `providers/types.ts` has `errorCategory` and `errorCode` optional fields
- [ ] `ExecutorResult` in `types/index.ts` has `errorCategory`, `errorCode`, and `errorDetails` optional fields
- [ ] `executor.ts` populates the new fields when an `AidfError` is caught
- [ ] All existing tests pass (`pnpm test`)
- [ ] TypeScript compiles without errors (`pnpm typecheck`)
- [ ] No breaking changes to existing consumers

## Notes

- Part of PLAN-v080-error-categorization.md
- Depends on task 098 (needs `ErrorCategory` type from `core/errors.ts`)
