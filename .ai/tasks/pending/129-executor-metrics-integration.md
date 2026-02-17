# TASK: Wire MetricsCollector into Executor

## Goal
Integrate `MetricsCollector` into the `Executor` class so that every execution run automatically collects metrics and persists an execution report.

Integration points:
- Instantiate `MetricsCollector` at the start of `run()`
- Call `startPhase('contextLoading')` before `loadContext()`, `endPhase('contextLoading')` after
- Call `startPhase('aiExecution')` before `provider.execute()`, `endPhase('aiExecution')` after
- Call `startPhase('scopeChecking')` around scope guard validation
- Call `startPhase('validation')` around `validator.preCommit()`
- Call `startPhase('gitOperations')` around commit/push operations
- Call `recordTokenUsage()` after each iteration when `result.tokenUsage` is present
- Call `recordValidation()` for each validation result
- Call `recordScopeViolation()` when scope guard blocks files
- Call `recordFileChange()` for each file in `result.filesChanged`
- After the execution loop, call `collector.toReport()` and persist via `ReportWriter.write()`
- Pass the report to `NotificationService` for enriched notifications
- Add `report` field to `ExecutorResult` so callers can access the report object
- Ensure all phase timing calls are in try/finally blocks so phases are always ended even on errors

## Task Type
feature

## Suggested Roles
- developer

## Auto-Mode Compatible
YES

## Scope
### Allowed
- packages/cli/src/core/executor.ts
- packages/cli/src/core/executor.test.ts
- packages/cli/src/types/index.ts

### Forbidden
- packages/cli/src/core/metrics-collector.ts (read-only)
- packages/cli/src/core/report-writer.ts (read-only)
- packages/cli/src/commands/** (read-only)

## Requirements
- All `startPhase()`/`endPhase()` calls must be wrapped in try/finally blocks
- `MetricsCollector` is instantiated once per `run()` call
- `ReportWriter.write()` is called after the execution loop completes (success, failure, or blocked)
- The `report` field added to `ExecutorResult` must be optional (backward compatible)
- Token usage recording only happens when `result.tokenUsage` is present (CLI providers may not have it)
- Phase timing should not interfere with existing execution flow
- Errors in metrics collection/report writing must not break the execution (catch and log)

## Definition of Done
- [ ] `MetricsCollector` instantiated in `Executor.run()`
- [ ] Phase timing calls added for all 5 phases (contextLoading, aiExecution, scopeChecking, validation, gitOperations)
- [ ] All phase timing calls wrapped in try/finally
- [ ] Token usage, validation, scope violations, and file changes recorded
- [ ] Report persisted via `ReportWriter.write()` after execution
- [ ] `report` field added to `ExecutorResult` interface
- [ ] Existing tests updated to verify MetricsCollector is called (mock the collector)
- [ ] TypeScript compiles with no errors (`pnpm typecheck`)
- [ ] All tests pass (`pnpm test`)

## Notes
- Part of PLAN-v080-observability.md
- Depends on tasks 125 (MetricsCollector), 126 (CostRates), and 127 (ReportWriter)
