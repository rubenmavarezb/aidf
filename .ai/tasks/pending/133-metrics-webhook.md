# TASK: Add Metrics Webhook Export

## Goal
Add optional webhook export for execution metrics, allowing CI/CD dashboards and external systems to receive execution report data.

New config section in `config.yml`:
```yaml
observability:
  webhook:
    enabled: false
    url: https://example.com/aidf-metrics
    headers:
      Authorization: "Bearer ${AIDF_METRICS_TOKEN}"
    events: [completed, blocked, failed]
    include_iterations: false
    timeout: 10000
    retry: 2
```

Create `core/metrics-webhook.ts` with `MetricsWebhook` class:
- `send(report: ExecutionReport): Promise<void>` -- POST the report as JSON to the configured URL
- Respects `events` filter (only sends for matching statuses)
- Strips per-iteration data if `include_iterations: false` to reduce payload size
- Includes `X-AIDF-Event` header with the event type
- Includes `X-AIDF-Run-ID` header with the run ID
- Timeout and retry with exponential backoff
- Failures are logged but never block execution (fire-and-forget after retries)

Wire into executor: after `ReportWriter.write()`, call `MetricsWebhook.send()` if configured.

## Task Type
feature

## Suggested Roles
- developer

## Auto-Mode Compatible
YES

## Scope
### Allowed
- packages/cli/src/core/metrics-webhook.ts
- packages/cli/src/core/metrics-webhook.test.ts
- packages/cli/src/types/index.ts
- packages/cli/src/core/executor.ts

### Forbidden
- packages/cli/src/commands/** (read-only)
- packages/cli/src/core/safety.ts (read-only)

## Requirements
- Add `ObservabilityConfig` interface to `types/index.ts`: `{ webhook?: WebhookConfig }`
- Add `WebhookConfig` interface: `{ enabled: boolean, url: string, headers?: Record<string, string>, events: string[], include_iterations: boolean, timeout: number, retry: number }`
- Add `observability?: ObservabilityConfig` to `AidfConfig`
- Environment variable expansion in header values (e.g., `${AIDF_METRICS_TOKEN}`)
- Use native `fetch()` (Node 18+) for HTTP requests
- Exponential backoff: delay = `1000 * 2^attempt` ms
- Maximum timeout configurable (default 10000ms)
- Webhook failures must never throw -- catch all errors and log warnings
- Strip `timing.perIteration` and `tokens.perIteration` when `include_iterations: false`

## Definition of Done
- [ ] `MetricsWebhook` class created in `core/metrics-webhook.ts`
- [ ] `send()` POSTs report as JSON with correct headers
- [ ] Event filtering works (only sends for matching statuses)
- [ ] Per-iteration data stripped when `include_iterations: false`
- [ ] Timeout and retry with exponential backoff implemented
- [ ] Failures logged but never block execution
- [ ] `ObservabilityConfig` and `WebhookConfig` interfaces defined in `types/index.ts`
- [ ] Wired into executor after `ReportWriter.write()`
- [ ] Unit tests: mock fetch, verify headers, verify filtering, verify retry logic
- [ ] TypeScript compiles with no errors (`pnpm typecheck`)
- [ ] All tests pass (`pnpm test`)

## Notes
- Part of PLAN-v080-observability.md
- Depends on tasks 124 (types) and 129 (report data flowing through executor)
