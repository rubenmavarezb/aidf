# TASK: Add `aidf report` CLI Command

## Goal
Add `aidf report` command to the CLI (`commands/report.ts`) with subcommands for listing, viewing, summarizing, exporting, and cleaning execution reports.

Subcommands:

- `aidf report list` -- List recent execution reports.
  Options: `--since <date>`, `--until <date>`, `--status <completed|blocked|failed>`, `--task <glob>`, `--limit <n>` (default 20), `--json` (output as JSON array)

- `aidf report show <run-id>` -- Display detailed report for a specific run.
  Shows: metadata, outcome, token usage with cost, per-iteration breakdown, phase timings, file changes, validation results.
  Supports `--json` for machine-readable output.

- `aidf report summary` -- Aggregate statistics across all (or filtered) reports.
  Shows: total runs, success rate, total tokens, total cost, average iterations, average duration, top 5 most expensive tasks.
  Options: `--since`, `--until`, `--json`, `--csv <path>`

- `aidf report export --csv <path>` -- Export all (or filtered) reports to CSV.
  Options: `--since`, `--until`, `--detailed` (per-iteration rows)

- `aidf report clean --before <date>` -- Delete reports older than the specified date.
  Requires `--confirm` flag for safety.

## Task Type
feature

## Suggested Roles
- developer

## Auto-Mode Compatible
YES

## Scope
### Allowed
- packages/cli/src/commands/report.ts
- packages/cli/src/commands/report.test.ts
- packages/cli/src/index.ts

### Forbidden
- packages/cli/src/core/report-writer.ts (read-only)
- packages/cli/src/core/executor.ts (read-only)

## Requirements
- Register the command in `src/index.ts` with Commander
- Use `Logger.box()` for summary displays
- Use tabular output for lists (pad columns, align numbers right)
- Use chalk colors for status indicators (green=completed, yellow=blocked, red=failed)
- `--json` flag outputs machine-readable JSON for all subcommands
- `report clean` requires `--confirm` flag -- without it, only shows what would be deleted
- All subcommands should handle empty report directories gracefully
- Date parsing should accept ISO 8601 dates and relative formats (e.g., "7d", "30d")

## Definition of Done
- [ ] `report` command created in `commands/report.ts`
- [ ] `list` subcommand with filtering and `--json` support
- [ ] `show` subcommand with detailed output and `--json` support
- [ ] `summary` subcommand with aggregate stats and `--csv` support
- [ ] `export` subcommand with CSV export and `--detailed` flag
- [ ] `clean` subcommand with `--confirm` safety flag
- [ ] Command registered in `src/index.ts`
- [ ] Integration tests: create sample report files, verify list/show/summary output
- [ ] TypeScript compiles with no errors (`pnpm typecheck`)
- [ ] All tests pass (`pnpm test`)

## Notes
- Part of PLAN-v080-observability.md
- Depends on tasks 127 (ReportWriter) and 128 (CSV export)
