# TASK: Add CSV Export to ReportWriter

## Goal
Add CSV export capability to `ReportWriter` for exporting execution reports to CSV format suitable for import into Excel/Google Sheets.

New method:
- `exportCsv(reports: ExecutionReport[], outputPath: string): void` -- writes a flat CSV with columns: `run_id, timestamp, task, status, iterations, input_tokens, output_tokens, total_tokens, estimated_cost, duration_seconds, files_modified, provider, model, scope_violations, validation_failures`

Features:
- One row per execution run (not per-iteration)
- Optional `--detailed` flag that produces per-iteration CSV: `run_id, iteration, input_tokens, output_tokens, duration_ms, phase_ai_ms, phase_validation_ms, files_changed`
- Uses simple string concatenation (no CSV library dependency)
- Proper escaping of commas and quotes in values (RFC 4180 compliant)

## Task Type
feature

## Suggested Roles
- developer

## Auto-Mode Compatible
YES

## Scope
### Allowed
- packages/cli/src/core/report-writer.ts
- packages/cli/src/core/report-writer.test.ts

### Forbidden
- packages/cli/src/core/executor.ts (read-only)
- packages/cli/src/commands/** (read-only)

## Requirements
- No external CSV library -- use simple string concatenation
- Properly escape commas, quotes, and newlines in values per RFC 4180
- Summary CSV: one row per run with all key metrics
- Detailed CSV: one row per iteration with per-iteration metrics
- Header row always included
- Numeric values should not be quoted (for proper spreadsheet handling)
- Empty/undefined values should be empty strings in CSV

## Definition of Done
- [ ] `exportCsv()` method added to `ReportWriter`
- [ ] `exportDetailedCsv()` method added for per-iteration export
- [ ] CSV output includes proper header row
- [ ] Commas, quotes, and newlines in values are properly escaped
- [ ] Unit tests verify CSV output format, escaping, and header row
- [ ] Unit tests verify detailed CSV format
- [ ] TypeScript compiles with no errors (`pnpm typecheck`)
- [ ] All tests pass (`pnpm test`)

## Notes
- Part of PLAN-v080-observability.md
- Depends on task 127 (extends ReportWriter)
