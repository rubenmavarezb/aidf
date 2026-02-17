# TASK: Add Profiling Output to Verbose and Report Modes

## Goal
Enhance verbose mode and report display with profiling output, showing phase timing breakdowns during execution and in report views.

Enhancements:

1. **Verbose mode (`--verbose`)**: After each iteration, print phase timing:
   `[profile] AI execution: 12.3s | Validation: 1.2s | Scope check: 0.05s | Git: 0.8s`

2. **Final execution summary box**: Add a "Phase Breakdown" section showing percentage of time in each phase:
   ```
   Phase Breakdown:
     AI execution     78%  ████████████████████░░░░░
     Validation       12%  ███░░░░░░░░░░░░░░░░░░░░░
     Git operations    6%  ██░░░░░░░░░░░░░░░░░░░░░░
     Scope checking    3%  █░░░░░░░░░░░░░░░░░░░░░░░
     Context loading   1%  ░░░░░░░░░░░░░░░░░░░░░░░░
   ```

3. **`aidf report show`**: Display phase timings as a horizontal bar chart (ASCII):
   `AI execution  ████████████████████░░░░░ 78%`

4. **`aidf report summary`**: Show average phase distribution across all runs.

No new command-line flags -- this enhances existing `--verbose` and `aidf report` output.

## Task Type
feature

## Suggested Roles
- developer

## Auto-Mode Compatible
YES

## Scope
### Allowed
- packages/cli/src/core/executor.ts
- packages/cli/src/commands/report.ts
- packages/cli/src/utils/logger.ts
- packages/cli/src/core/executor.test.ts
- packages/cli/src/commands/report.test.ts

### Forbidden
- packages/cli/src/core/phase-profiler.ts (read-only)
- packages/cli/src/core/metrics-collector.ts (read-only)

## Requirements
- Verbose iteration output format: `[profile] Phase1: X.Xs | Phase2: X.Xs | ...`
- Bar chart rendering: 25-character wide bars using block characters
- Phase breakdown in summary box sorted by percentage (highest first)
- Phases with less than 1% shown as `<1%`
- ASCII bar chart helper function should be reusable (add to logger or utils)
- No new CLI flags -- automatically included in verbose and report output
- Average phase distribution in `report summary` computed from `aggregate()` data

## Definition of Done
- [ ] Verbose mode prints phase timing after each iteration
- [ ] Final execution summary box includes phase breakdown section
- [ ] `aidf report show` displays phase timings as ASCII bar chart
- [ ] `aidf report summary` shows average phase distribution
- [ ] Bar chart rendering helper created and reusable
- [ ] Output is clean and well-formatted
- [ ] TypeScript compiles with no errors (`pnpm typecheck`)
- [ ] All tests pass (`pnpm test`)

## Notes
- Part of PLAN-v080-observability.md
- Depends on tasks 135 (PhaseProfiler) and 131 (report command)
