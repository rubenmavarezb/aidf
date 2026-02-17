# TASK: Enhance `aidf status` with Report Summary

## Goal
Enhance the existing `aidf status` command to optionally display the last execution report summary alongside the current task status.

Enhancements:
- Add `--report` flag that appends last execution report summary to status output
- Show token usage and cost from the most recent run
- Show trend indicators if multiple reports exist (e.g., "cost trending up/down vs last 5 runs")
- Backward compatible -- existing `aidf status` output unchanged without `--report`

## Task Type
feature

## Suggested Roles
- developer

## Auto-Mode Compatible
YES

## Scope
### Allowed
- packages/cli/src/commands/status.ts
- packages/cli/src/commands/status.test.ts

### Forbidden
- packages/cli/src/core/executor.ts (read-only)
- packages/cli/src/core/report-writer.ts (read-only)

## Requirements
- `--report` flag is optional and defaults to false
- Without `--report`, output is identical to current behavior
- With `--report`, append a "Last Run" section showing: run ID, status, tokens used, estimated cost, duration, iterations
- If multiple reports exist (5+), show trend: compare last run cost vs average of previous 5 runs
- Trend indicators: arrow up/down with percentage change
- Handle case where no reports exist gracefully (show "No execution reports found")
- Use `ReportWriter.list()` and `ReportWriter.read()` for data access

## Definition of Done
- [ ] `--report` flag added to `aidf status` command
- [ ] Last run summary displayed when flag is set
- [ ] Trend indicators shown when sufficient history exists
- [ ] Backward compatible -- no change without `--report` flag
- [ ] Handles missing reports gracefully
- [ ] TypeScript compiles with no errors (`pnpm typecheck`)
- [ ] All tests pass (`pnpm test`)

## Notes
- Part of PLAN-v080-observability.md
- Depends on task 127 (ReportWriter for reading reports)
