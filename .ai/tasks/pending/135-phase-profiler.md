# TASK: Create PhaseProfiler Class

## Goal
Create `core/phase-profiler.ts` with a `PhaseProfiler` class that provides lightweight, high-resolution timing for measuring execution phases.

API:
- `start(phase: string)` -- begins timing a named phase
- `end(phase: string)` -- ends timing a named phase
- `getTimings(): Record<string, number>` -- returns cumulative ms per phase
- `getSummary(): PhaseSummary[]` -- returns detailed summary per phase

Features:
- Lightweight wrapper around `performance.now()` for high-resolution timing
- Supports nested phases (e.g., `aiExecution` > `promptBuilding`)
- `PhaseSummary` includes: `phase`, `totalMs`, `count` (how many times the phase was entered), `avgMs`, `maxMs`, `minMs`, `percentage` (of total execution time)
- The `MetricsCollector` from task 125 delegates to `PhaseProfiler` internally
- Output in `ExecutionReport.timing.phases` as a flat map of phase -> cumulative ms
- Verbose mode (`--verbose`) prints phase timings after each iteration
- The final execution summary box includes top-level phase breakdown (% of total time)

## Task Type
feature

## Suggested Roles
- developer

## Auto-Mode Compatible
YES

## Scope
### Allowed
- packages/cli/src/core/phase-profiler.ts
- packages/cli/src/core/phase-profiler.test.ts
- packages/cli/src/types/index.ts

### Forbidden
- packages/cli/src/core/executor.ts (read-only)
- packages/cli/src/commands/** (read-only)

## Requirements
- Define `PhaseSummary` interface in `types/index.ts`: `{ phase: string, totalMs: number, count: number, avgMs: number, maxMs: number, minMs: number, percentage: number }`
- Use `performance.now()` for all timing (not `Date.now()`)
- Support nested phases -- ending an outer phase while inner is running should not error
- Each phase can be started/ended multiple times -- stats accumulate
- `percentage` in `PhaseSummary` is relative to total wall-clock time
- Calling `end()` without a matching `start()` should be a no-op (log warning, don't throw)
- Calling `start()` on an already-started phase should be a no-op (log warning, don't throw)
- Thread-safe design (no shared mutable state beyond the profiler instance)

## Definition of Done
- [ ] `PhaseProfiler` class created in `core/phase-profiler.ts`
- [ ] `PhaseSummary` interface defined in `types/index.ts`
- [ ] `start()`, `end()`, `getTimings()`, `getSummary()` implemented
- [ ] Nested phases supported
- [ ] Multiple start/end cycles per phase accumulate correctly
- [ ] Edge cases handled gracefully (end without start, start without end)
- [ ] Unit tests verify timing accuracy (within tolerance)
- [ ] Unit tests verify nested phases
- [ ] Unit tests verify multiple entries per phase
- [ ] TypeScript compiles with no errors (`pnpm typecheck`)
- [ ] All tests pass (`pnpm test`)

## Notes
- Part of PLAN-v080-observability.md
- Depends on task 125 (MetricsCollector delegates to PhaseProfiler)
