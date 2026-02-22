# TASK: Unit and integration tests for observability pipeline

## Goal

Add dedicated test tasks for the observability plan (PLAN-v080-observability) covering MetricsCollector, ReportWriter, CSV export, webhook, CI detection, and PhaseProfiler. Validates the full pipeline: execution → metrics collection → report persistence → CLI query → export.

## Task Type

test

## Suggested Roles

- tester

## Auto-Mode Compatible

YES

## Scope

### Allowed

- `packages/cli/src/core/metrics-collector.test.ts`
- `packages/cli/src/core/report-writer.test.ts`
- `packages/cli/src/core/metrics-webhook.test.ts`
- `packages/cli/src/core/phase-profiler.test.ts`
- `packages/cli/src/utils/ci-detect.test.ts`

### Forbidden

- `packages/cli/src/core/metrics-collector.ts` (read-only)
- `packages/cli/src/core/report-writer.ts` (read-only)
- `packages/cli/src/core/metrics-webhook.ts` (read-only)
- `packages/cli/src/core/phase-profiler.ts` (read-only)
- `packages/cli/src/utils/ci-detect.ts` (read-only)

## Requirements

### MetricsCollector tests
1. Verify timing accumulation across multiple `startPhase`/`endPhase` calls
2. Verify token aggregation across iterations (inputTokens, outputTokens summed correctly)
3. Verify `toReport()` assembles all fields correctly (metadata, outcome, tokens, cost, timing, files)
4. Edge cases: zero iterations, no token data, phases started but never ended

### ReportWriter tests
5. Write/read roundtrip: write report, read it back, verify data integrity
6. Directory creation: verify date-based directories are created automatically
7. List with filters: create multiple reports, filter by date/status/task, verify correct results
8. Aggregate: verify totals, averages, success rate across multiple reports
9. Partial ID matching in `read()`: match first 8 chars of runId

### CSV Export tests
10. Verify CSV output format: correct columns, header row, data rows
11. Verify escaping of commas and quotes in values
12. Detailed CSV mode: per-iteration rows with correct columns

### Webhook tests
13. Mock fetch, verify correct URL, headers, body
14. Verify event filtering (only send for configured events)
15. Verify retry logic on failure (exponential backoff)
16. Verify `include_iterations: false` strips per-iteration data

### CI Detection tests
17. Verify detection of each CI provider (GitHub Actions, GitLab CI, Jenkins, CircleCI, Bitbucket, Azure)
18. Verify `null` returned when no CI env vars present

### PhaseProfiler tests
19. Verify timing accuracy (within tolerance) for start/end pairs
20. Verify nested phases tracked correctly
21. Verify summary stats: count, avg, max, min, percentage

### Integration test
22. Full pipeline: create a MetricsCollector → record phases, tokens, validations, files → generate report → write with ReportWriter → read back → verify all data survived the roundtrip

## Definition of Done

- [ ] 22+ test cases implemented and passing
- [ ] Tests cover unit level for each module
- [ ] Integration test validates the full metrics pipeline end-to-end
- [ ] `pnpm test` — all existing tests continue to pass

## Notes

- Part of PLAN-v080-observability.md
- Depends on tasks 124-136 being implemented first
- Tests for the `aidf report` CLI command should be added to task 131's scope (already has inline mention)
