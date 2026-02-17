# TASK: Define ExecutionReport TypeScript Schema

## Goal
Define the `ExecutionReport` TypeScript interface and all supporting types in `types/index.ts`. This schema is the foundation for the entire observability layer -- every other task in this plan depends on these type definitions.

The schema must capture:

- **Run metadata**: `runId` (UUID), `timestamp` (ISO 8601), `taskPath`, `taskGoal`, `taskType`, `roleName`, `provider` (type + model), `cwd`, `aidfVersion`
- **Outcome**: `status` (completed | blocked | failed), `iterations` (total), `maxIterations` (configured limit), `consecutiveFailures`, `error?`, `blockedReason?`
- **Token usage**: `tokens.contextTokens`, `tokens.totalInput`, `tokens.totalOutput`, `tokens.totalTokens`, `tokens.perIteration[]` (array of `{ iteration, input, output }`), `tokens.breakdown?` (ContextBreakdown)
- **Cost**: `cost.estimatedTotal`, `cost.currency` (always USD), `cost.rates` (the rates used: `{ inputPer1M, outputPer1M }`), `cost.perIteration[]`
- **Timing**: `timing.startedAt`, `timing.completedAt`, `timing.totalDurationMs`, `timing.phases` (object mapping phase name to cumulative ms: `contextLoading`, `aiExecution`, `scopeChecking`, `validation`, `gitOperations`, `other`), `timing.perIteration[]` (array of `{ iteration, durationMs, phases }`)
- **Files**: `files.modified` (string[]), `files.created` (string[]), `files.deleted` (string[]), `files.totalCount`
- **Validation**: `validation.runs[]` (array of `{ iteration, phase, command, passed, durationMs, exitCode }`), `validation.totalRuns`, `validation.failures`
- **Scope**: `scope.mode`, `scope.violations` (count), `scope.blockedFiles` (string[])
- **Environment**: `environment.nodeVersion`, `environment.os`, `environment.ci` (boolean, detected from `CI` env var)

Also define:
- `CostRates` interface (`{ inputPer1M: number, outputPer1M: number }`)
- `PhaseTimings` interface (maps phase name to cumulative ms)
- `IterationMetrics` interface for per-iteration detail
- `IterationTokenUsage` interface (`{ iteration, input, output }`)
- `IterationCost` interface (`{ iteration, cost }`)
- `ValidationRun` interface (`{ iteration, phase, command, passed, durationMs, exitCode }`)
- `ReportTokenUsage` interface (top-level token usage block)
- `ReportCost` interface (top-level cost block)
- `ReportTiming` interface (top-level timing block)
- `ReportFiles` interface (top-level files block)
- `ReportValidation` interface (top-level validation block)
- `ReportScope` interface (top-level scope block)
- `ReportEnvironment` interface (top-level environment block)

Ensure all fields are optional where data may not be available (e.g., CLI providers don't report tokens). Use `?` for optional fields.

## Task Type
feature

## Suggested Roles
- developer

## Auto-Mode Compatible
YES

## Scope
### Allowed
- packages/cli/src/types/index.ts
- packages/cli/src/types/*.ts

### Forbidden
- packages/cli/src/core/** (read-only)
- packages/cli/src/commands/** (read-only)

## Requirements
- All interfaces must be exported
- Use strict TypeScript types (no `any`)
- All fields that may not be available must be optional (`?`)
- `status` field must be a union type: `'completed' | 'blocked' | 'failed'`
- `currency` field must be literal type `'USD'`
- Phase timing keys should be typed but extensible (use `Record<string, number>` with well-known keys documented)
- Interfaces must be compatible with JSON serialization (no Date objects, no functions, no class instances)

## Definition of Done
- [ ] `ExecutionReport` interface defined in `types/index.ts`
- [ ] All supporting interfaces (`CostRates`, `PhaseTimings`, `IterationMetrics`, etc.) defined and exported
- [ ] All optional fields marked with `?`
- [ ] TypeScript compiles with no errors (`pnpm typecheck`)
- [ ] Existing tests pass (`pnpm test`)

## Notes
- Part of PLAN-v080-observability.md
- This is the foundational task -- all other observability tasks depend on these type definitions
