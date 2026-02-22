# TASK: Add error category to notification events and messages

## Goal

Update `NotificationEvent` in `packages/cli/src/types/index.ts` to include optional `errorCategory?: ErrorCategory` and `errorCode?: string`. Update `NotificationService.notifyResult()` to pass error category info. Update notification message formatting to include the error category when present (e.g., "[TIMEOUT] Task blocked: iteration exceeded 300s limit" instead of generic "Task blocked").

## Task Type

refactor

## Suggested Roles

- developer

## Auto-Mode Compatible

YES

## Scope

### Allowed

- `packages/cli/src/types/index.ts`
- `packages/cli/src/utils/notifications.ts`

### Forbidden

- `packages/cli/src/core/executor.ts` (read-only)
- `packages/cli/src/core/errors.ts` (read-only)
- `packages/cli/src/commands/` (read-only)

## Requirements

1. Import `ErrorCategory` from `core/errors.ts` in `types/index.ts` (if not already imported from task 100).

2. Update `NotificationEvent` type in `types/index.ts` to add:
   ```typescript
   errorCategory?: ErrorCategory;
   errorCode?: string;
   ```

3. Update `NotificationService.notifyResult()` in `notifications.ts`:
   - Accept or extract `errorCategory` and `errorCode` from the `ExecutorResult`
   - Pass these fields to the `NotificationEvent`

4. Update notification message formatting in `notifications.ts`:
   - When `errorCategory` is present, prefix the error message with the category in brackets
   - Examples:
     - `[TIMEOUT] Task blocked: iteration exceeded 300s limit`
     - `[PROVIDER] Task failed: claude-cli process crashed`
     - `[CONFIG] Task failed: missing config file at .ai/config.yml`
     - `[SCOPE] Task blocked: files outside allowed scope`
     - `[PERMISSION] Task failed: API authentication error`
     - `[GIT] Task blocked: git revert failed`
     - `[VALIDATION] Task blocked: pnpm lint failed`
   - When `errorCategory` is NOT present, use the existing generic message format (backward compatible)

5. This is a non-breaking change:
   - Existing `NotificationEvent` fields remain
   - New fields are optional
   - Existing message format is preserved when category is not available

## Definition of Done

- [ ] `NotificationEvent` has `errorCategory` and `errorCode` optional fields
- [ ] `NotificationService.notifyResult()` passes error category info to events
- [ ] Notification messages include error category prefix when available
- [ ] Backward compatible when `errorCategory` is not set
- [ ] All existing tests pass (`pnpm test`)
- [ ] TypeScript compiles without errors (`pnpm typecheck`)

## Notes

- Part of PLAN-v080-error-categorization.md
- Depends on tasks 098 (ErrorCategory type) and 100 (ExecutorResult with error fields)
