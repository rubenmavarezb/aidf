# TASK: Create MetricsCollector Class

## Goal
Create `core/metrics-collector.ts` with a `MetricsCollector` class that accumulates timing, token, and event data during task execution.

Responsibilities:
- Instantiated at the start of `Executor.run()` with run metadata (task path, provider, config)
- Generates a `runId` (UUID v4 via `crypto.randomUUID()`)
- Provides methods:
  - `startPhase(name: string)` -- begins timing a named phase
  - `endPhase(name: string)` -- ends timing a named phase
  - `recordIteration(metrics: IterationMetrics)` -- records per-iteration data
  - `recordTokenUsage(iteration: number, input: number, output: number)` -- records token usage for an iteration
  - `recordValidation(result: ValidationRun)` -- records a validation run result
  - `recordScopeViolation(files: string[])` -- records scope violation files
  - `recordFileChange(path: string, type: 'modified' | 'created' | 'deleted')` -- records file changes
  - `recordError(error: string)` -- records an error message
- Phase timing uses `performance.now()` for high-resolution timing
- Phases can be nested (e.g., `aiExecution` contains the full provider call)
- `toReport(): ExecutionReport` -- assembles the final report from accumulated data
- The collector is passive (no I/O) -- report persistence is handled separately by ReportWriter

## Task Type
feature

## Suggested Roles
- developer

## Auto-Mode Compatible
YES

## Scope
### Allowed
- packages/cli/src/core/metrics-collector.ts
- packages/cli/src/core/metrics-collector.test.ts

### Forbidden
- packages/cli/src/core/executor.ts (read-only)
- packages/cli/src/commands/** (read-only)

## Requirements
- Use `crypto.randomUUID()` for run ID generation
- Use `performance.now()` for high-resolution timing
- Support nested phases
- `toReport()` must return a valid `ExecutionReport` object (using types from task 124)
- No I/O operations -- the collector is purely in-memory
- Constructor accepts run metadata: `{ taskPath, taskGoal, taskType, roleName, providerType, providerModel, cwd, aidfVersion }`

## Definition of Done
- [ ] `MetricsCollector` class created in `core/metrics-collector.ts`
- [ ] All methods implemented: `startPhase`, `endPhase`, `recordIteration`, `recordTokenUsage`, `recordValidation`, `recordScopeViolation`, `recordFileChange`, `recordError`
- [ ] `toReport()` returns a valid `ExecutionReport`
- [ ] Unit tests verify timing accumulation, token aggregation, iteration metrics
- [ ] Unit tests cover edge cases: zero iterations, no tokens, nested phases
- [ ] TypeScript compiles with no errors (`pnpm typecheck`)
- [ ] All tests pass (`pnpm test`)

## Notes
- Part of PLAN-v080-observability.md
- Depends on task 124 (ExecutionReport schema)
- The PhaseProfiler (task 135) will later be delegated to internally
