# PLAN: v0.8.0 — Observability & Execution Reports

## Status: DRAFT

## Overview

AIDF currently tracks token usage and execution state during runs, but all data is ephemeral — lost as soon as the process exits. This plan introduces a comprehensive observability layer: structured execution reports persisted to disk, accurate per-provider token and cost tracking, a centralized metrics collector, a CLI reporting command, optional webhook export for CI/CD integration, and performance profiling hooks to measure time spent in each execution phase.

The goal is to give teams full visibility into how their AI-assisted development budget is being spent, which tasks are expensive, which providers are most efficient, and where execution bottlenecks lie.

## Goals

- Persist structured execution data (JSON) after every run, enabling historical analysis
- Provide accurate, per-provider token tracking with configurable cost rates
- Introduce a centralized `MetricsCollector` that accumulates timing, token, and event data during execution
- Add `aidf report` command to query, filter, and display historical execution data
- Support optional webhook/callback export of metrics for CI/CD dashboards
- Add performance profiling hooks to measure time spent in each phase (context loading, AI execution, scope checking, validation, git operations)

## Non-Goals

- Building a web UI or dashboard (consumers of the data can build their own)
- Real-time streaming metrics (e.g., StatsD/Prometheus push) — webhook is sufficient for v0.8.0
- Changing the execution model or provider interface signatures
- Database-backed storage (JSON files are sufficient for single-project use)
- Multi-project aggregation (each project has its own `.ai/reports/` directory)

## Tasks

### Phase 1: Metrics Schema & Collector

- [ ] `124-execution-report-schema.md` — Define the `ExecutionReport` TypeScript interface in `types/index.ts`. The schema must capture:
  - **Run metadata**: `runId` (UUID), `timestamp` (ISO 8601), `taskPath`, `taskGoal`, `taskType`, `roleName`, `provider` (type + model), `cwd`, `aidfVersion`
  - **Outcome**: `status` (completed | blocked | failed), `iterations` (total), `maxIterations` (configured limit), `consecutiveFailures`, `error?`, `blockedReason?`
  - **Token usage**: `tokens.contextTokens`, `tokens.totalInput`, `tokens.totalOutput`, `tokens.totalTokens`, `tokens.perIteration[]` (array of `{ iteration, input, output }`), `tokens.breakdown?` (ContextBreakdown)
  - **Cost**: `cost.estimatedTotal`, `cost.currency` (always USD), `cost.rates` (the rates used: `{ inputPer1M, outputPer1M }`), `cost.perIteration[]`
  - **Timing**: `timing.startedAt`, `timing.completedAt`, `timing.totalDurationMs`, `timing.phases` (object mapping phase name to cumulative ms: `contextLoading`, `aiExecution`, `scopeChecking`, `validation`, `gitOperations`, `other`), `timing.perIteration[]` (array of `{ iteration, durationMs, phases }`)
  - **Files**: `files.modified` (string[]), `files.created` (string[]), `files.deleted` (string[]), `files.totalCount`
  - **Validation**: `validation.runs[]` (array of `{ iteration, phase, command, passed, durationMs, exitCode }`), `validation.totalRuns`, `validation.failures`
  - **Scope**: `scope.mode`, `scope.violations` (count), `scope.blockedFiles` (string[])
  - **Environment**: `environment.nodeVersion`, `environment.os`, `environment.ci` (boolean, detected from `CI` env var)

  Also define `CostRates` interface (`{ inputPer1M: number, outputPer1M: number }`) and `PhaseTimings` interface. Add `IterationMetrics` interface for per-iteration detail. Ensure all fields are optional where data may not be available (e.g., CLI providers don't report tokens).

- [ ] `125-metrics-collector.md` — Create `core/metrics-collector.ts` with a `MetricsCollector` class. Responsibilities:
  - Instantiated at the start of `Executor.run()` with run metadata (task path, provider, config)
  - Generates a `runId` (UUID v4 via `crypto.randomUUID()`)
  - Provides methods: `startPhase(name)`, `endPhase(name)`, `recordIteration(metrics)`, `recordTokenUsage(iteration, input, output)`, `recordValidation(result)`, `recordScopeViolation(files)`, `recordFileChange(path, type)`, `recordError(error)`
  - Phase timing: uses `performance.now()` for high-resolution timing; phases can be nested (e.g., `aiExecution` contains the full provider call)
  - `toReport(): ExecutionReport` — assembles the final report from accumulated data
  - The collector is passive (no I/O) — report persistence is handled separately
  - Unit tests: verify timing accumulation, token aggregation, iteration metrics, edge cases (zero iterations, no tokens)

- [ ] `126-cost-rates-config.md` — Add `cost` section to `AidfConfig` and `config.yml`:
  ```yaml
  cost:
    rates:
      claude-sonnet:
        input_per_1m: 3.0
        output_per_1m: 15.0
      claude-opus:
        input_per_1m: 15.0
        output_per_1m: 75.0
      claude-haiku:
        input_per_1m: 0.25
        output_per_1m: 1.25
      gpt-4o:
        input_per_1m: 2.5
        output_per_1m: 10.0
      gpt-4o-mini:
        input_per_1m: 0.15
        output_per_1m: 0.60
    currency: USD
  ```
  Update `types/index.ts` with `CostConfig` and `ModelCostRates` interfaces. The executor should look up rates by model name (substring match against configured keys, falling back to provider-type defaults). Replace the hardcoded `$3/$15` cost estimation in `executor.ts` `buildTokenUsageSummary()` with configurable rate lookup. Add validation that rates are positive numbers. Default rates are built into the code for common models so config is optional.

### Phase 2: Report Persistence & Storage

- [ ] `127-report-writer.md` — Create `core/report-writer.ts` with a `ReportWriter` class. Responsibilities:
  - `write(report: ExecutionReport): string` — persists report as JSON to `.ai/reports/YYYY-MM-DD/run-{runId}.json`. Returns the file path.
  - Creates directory structure automatically (`mkdirSync` with `recursive: true`)
  - File naming: `run-{runId}.json` where runId is the first 8 chars of the UUID for readability
  - Supports configurable base directory (default: `.ai/reports/`)
  - `list(options?: { since?, until?, status?, task? }): ReportSummary[]` — reads all report files, applies filters, returns sorted array of summaries (lightweight: only metadata + outcome, no per-iteration detail)
  - `read(runId: string): ExecutionReport | null` — reads a specific report by ID (supports partial ID matching)
  - `aggregate(reports: ExecutionReport[]): AggregateMetrics` — computes totals and averages across multiple reports: total cost, total tokens, average iterations, success rate, average duration, most modified files
  - File format: pretty-printed JSON (2-space indent) for human readability when debugging
  - Add `.ai/reports/` to the default `.gitignore` generated by `aidf init` (reports contain local paths and are per-machine)
  - Unit tests: verify write/read round-trip, directory creation, filtering, aggregation math

- [ ] `128-csv-export.md` — Add CSV export capability to `ReportWriter`:
  - `exportCsv(reports: ExecutionReport[], outputPath: string): void` — writes a flat CSV with columns: `run_id, timestamp, task, status, iterations, input_tokens, output_tokens, total_tokens, estimated_cost, duration_seconds, files_modified, provider, model, scope_violations, validation_failures`
  - One row per execution run (not per-iteration)
  - Optional `--detailed` flag that produces per-iteration CSV: `run_id, iteration, input_tokens, output_tokens, duration_ms, phase_ai_ms, phase_validation_ms, files_changed`
  - Uses simple string concatenation (no CSV library dependency) with proper escaping of commas and quotes in values
  - Unit tests: verify CSV output format, escaping, header row

### Phase 3: Integration with Executor

- [ ] `129-executor-metrics-integration.md` — Wire `MetricsCollector` into the `Executor` class:
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
  - Update existing tests to verify MetricsCollector is called (mock the collector)

- [ ] `130-provider-token-tracking.md` — Improve per-provider token tracking accuracy:
  - **anthropic-api**: Already returns `usage.input_tokens` and `usage.output_tokens` from the API response. Ensure these are passed through in `ExecutionResult.tokenUsage`. Add cache read/write token tracking if available.
  - **openai-api**: Extract `usage.prompt_tokens` and `usage.completion_tokens` from the API response. Map to `inputTokens`/`outputTokens` in `ExecutionResult.tokenUsage`.
  - **claude-cli**: Parse `claude --print` output for token usage hints. Claude CLI may output usage stats in stderr or structured output. If not available, estimate from prompt character count (1 token ~ 4 chars) and output character count. Mark estimates with `estimated: true` flag.
  - **cursor-cli**: Similar to claude-cli — parse output or estimate. Mark as estimated.
  - Add `estimated: boolean` field to the token usage in `ExecutionResult` so reports can distinguish actual vs estimated usage.
  - Update `providers/types.ts` `ExecutionResult.tokenUsage` to include the `estimated` flag.
  - Unit tests for each provider's token extraction logic.

### Phase 4: Report Command

- [ ] `131-report-command.md` — Add `aidf report` command to the CLI (`commands/report.ts`):
  - Subcommands:
    - `aidf report list` — List recent execution reports. Options: `--since <date>`, `--until <date>`, `--status <completed|blocked|failed>`, `--task <glob>`, `--limit <n>` (default 20), `--json` (output as JSON array)
    - `aidf report show <run-id>` — Display detailed report for a specific run. Shows: metadata, outcome, token usage with cost, per-iteration breakdown, phase timings, file changes, validation results. Supports `--json` for machine-readable output.
    - `aidf report summary` — Aggregate statistics across all (or filtered) reports. Shows: total runs, success rate, total tokens, total cost, average iterations, average duration, top 5 most expensive tasks. Options: `--since`, `--until`, `--json`, `--csv <path>`
    - `aidf report export --csv <path>` — Export all (or filtered) reports to CSV. Options: `--since`, `--until`, `--detailed` (per-iteration rows)
    - `aidf report clean --before <date>` — Delete reports older than the specified date. Requires `--confirm` flag.
  - Output formatting: use `Logger.box()` for summary displays, tabular output for lists (pad columns, align numbers right), chalk colors for status indicators
  - Register in `src/index.ts` with Commander
  - Integration tests: create sample report files, verify list/show/summary output

- [ ] `132-status-command-enhancement.md` — Enhance existing `aidf status` command:
  - Add `--report` flag that appends last execution report summary to status output
  - Show token usage and cost from the most recent run
  - Show trend indicators if multiple reports exist (e.g., "cost trending up/down vs last 5 runs")
  - Backward compatible — existing `aidf status` output unchanged without `--report`

### Phase 5: Webhook Export & CI/CD Integration

- [ ] `133-metrics-webhook.md` — Add optional webhook export for execution metrics:
  - New config section in `config.yml`:
    ```yaml
    observability:
      webhook:
        enabled: false
        url: https://example.com/aidf-metrics
        headers:
          Authorization: "Bearer ${AIDF_METRICS_TOKEN}"
        events: [completed, blocked, failed]  # which events trigger webhook
        include_iterations: false  # include per-iteration detail (can be large)
        timeout: 10000  # ms
        retry: 2  # retry count on failure
    ```
  - Create `core/metrics-webhook.ts` with `MetricsWebhook` class:
    - `send(report: ExecutionReport): Promise<void>` — POST the report as JSON to the configured URL
    - Respects `events` filter (only sends for matching statuses)
    - Strips per-iteration data if `include_iterations: false` to reduce payload size
    - Includes `X-AIDF-Event` header with the event type
    - Includes `X-AIDF-Run-ID` header with the run ID
    - Timeout and retry with exponential backoff
    - Failures are logged but never block execution (fire-and-forget after retries)
  - Wire into executor: after `ReportWriter.write()`, call `MetricsWebhook.send()` if configured
  - Add `ObservabilityConfig` and `WebhookConfig` interfaces to `types/index.ts`
  - Unit tests: mock fetch, verify headers, verify filtering, verify retry logic

- [ ] `134-ci-environment-detection.md` — Enhance reports with CI/CD environment data:
  - Detect CI environment from standard env vars: `CI`, `GITHUB_ACTIONS`, `GITLAB_CI`, `JENKINS_URL`, `CIRCLECI`, `BITBUCKET_PIPELINE_UUID`, `AZURE_PIPELINE`
  - When in CI, add to report: `environment.ci = true`, `environment.ciProvider` (e.g., "github-actions"), `environment.ciBuildId`, `environment.ciBranch`, `environment.ciCommit`
  - This data helps correlate AIDF runs with CI builds when using webhook export
  - Create `utils/ci-detect.ts` with `detectCIEnvironment(): CIEnvironment | null`
  - Unit tests with mocked env vars

### Phase 6: Performance Profiling Hooks

- [ ] `135-phase-profiler.md` — Create `core/phase-profiler.ts` with a `PhaseProfiler` class:
  - Lightweight wrapper around `performance.now()` for measuring execution phases
  - API: `start(phase)`, `end(phase)`, `getTimings(): Record<string, number>`, `getSummary(): PhaseSummary[]`
  - Supports nested phases (e.g., `aiExecution` > `promptBuilding`)
  - `PhaseSummary` includes: `phase`, `totalMs`, `count` (how many times the phase was entered), `avgMs`, `maxMs`, `minMs`, `percentage` (of total execution time)
  - The `MetricsCollector` from task 125 delegates to `PhaseProfiler` internally
  - Output in `ExecutionReport.timing.phases` as a flat map of phase -> cumulative ms
  - Verbose mode (`--verbose`) prints phase timings after each iteration
  - The final execution summary box includes top-level phase breakdown (% of total time)
  - Unit tests: verify timing accuracy (within tolerance), nested phases, multiple entries

- [ ] `136-profiling-verbose-output.md` — Add profiling output to verbose and report modes:
  - When `--verbose` is set, print phase timing after each iteration: `[profile] AI execution: 12.3s | Validation: 1.2s | Scope check: 0.05s | Git: 0.8s`
  - In the final execution summary box, add a "Phase Breakdown" section showing percentage of time in each phase
  - In `aidf report show`, display phase timings as a horizontal bar chart (ASCII): `AI execution  ████████████████████░░░░░ 78%`
  - In `aidf report summary`, show average phase distribution across all runs
  - No new command-line flags — this enhances existing `--verbose` and `aidf report` output

### Phase 7: Dedicated Tests

- [ ] `163-observability-tests.md` — Unit and integration tests for the full observability pipeline. Covers MetricsCollector (timing, tokens, edge cases), ReportWriter (write/read roundtrip, filtering, aggregation), CSV export (format, escaping), webhook (mock fetch, retry, filtering), CI detection (env var mocking), PhaseProfiler (timing accuracy, nested phases), and a full pipeline integration test (collector → report → write → read → verify). **22+ test cases.**

## Dependencies

- **124** is foundational — all other tasks depend on its type definitions
- **125** depends on 124 (uses the schema types)
- **126** depends on 124 (adds cost config types), independent of 125
- **127** depends on 124 (reads/writes ExecutionReport), independent of 125/126
- **128** depends on 127 (extends ReportWriter)
- **129** depends on 125 + 126 + 127 (wires everything into executor)
- **130** is independent of 125-129 (modifies providers only), depends on 124 for types
- **131** depends on 127 + 128 (reads reports, exports CSV)
- **132** depends on 127 (reads latest report)
- **133** depends on 124 + 129 (needs report data flowing through executor)
- **134** is independent (utility module), should be integrated during 129
- **135** depends on 125 (MetricsCollector delegates to PhaseProfiler)
- **136** depends on 135 + 131 (profiling data + report display)

- **163** depends on all implementation tasks (124-136) — runs after all features are built

Suggested execution order: 124 -> 125 + 126 + 130 (parallel) -> 127 -> 128 + 129 + 134 + 135 (parallel) -> 131 + 132 + 133 + 136 -> 163

## Risks

- **Storage growth**: JSON report files will accumulate over time. Mitigated by date-based directory structure and `aidf report clean` command. Consider adding auto-cleanup config (e.g., `max_report_age_days: 90`).
- **Token tracking accuracy**: CLI providers (claude-cli, cursor-cli) may not expose token counts, forcing estimation from character counts. Reports should clearly flag estimated values vs actual API-reported values.
- **Performance overhead**: Phase profiling adds `performance.now()` calls per phase transition. Overhead is negligible (nanoseconds per call) but should be verified under high-iteration scenarios.
- **Webhook reliability**: External webhook endpoints may be slow or unavailable. Mitigated by timeout, retry with backoff, and fire-and-forget semantics (never block execution).
- **Config complexity**: Adding `cost` and `observability` sections to config.yml increases the configuration surface. All new config should have sensible defaults and be entirely optional.
- **Backward compatibility**: `ExecutorResult` gains a new `report` field. Existing consumers that destructure the result will not break since it is optional.

## Success Criteria

- Every `aidf run` produces a JSON report in `.ai/reports/` with complete metadata, timing, tokens, cost, and file change data
- `aidf report list` shows recent runs with status, cost, and duration
- `aidf report summary` shows aggregate statistics (total cost, success rate, average duration)
- `aidf report export --csv` produces valid CSV importable into Excel/Google Sheets
- Cost estimates use configurable per-model rates from `config.yml` (with sensible defaults)
- Phase profiling shows time distribution across context loading, AI execution, validation, and git operations
- Webhook export delivers report JSON to a configured endpoint within 10 seconds of run completion
- Reports from CLI providers clearly indicate estimated (vs actual) token counts
- All new code has unit tests; existing 298+ tests remain green
- Zero performance regression: execution overhead from metrics collection is under 100ms per run
