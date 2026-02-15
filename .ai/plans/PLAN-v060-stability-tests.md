# PLAN: v0.6.0 — Stability & Test Coverage

## Overview

Add test coverage for the critical untested commands (run, watcher), implement real timeout enforcement in the executor, and add schema validation for config files. This solidifies the foundation before building new features.

## Goals

- Test coverage for run.ts and watcher.ts (the two largest untested files)
- Real timeout enforcement in executor (not just a config value)
- Schema validation for config.yml (catch errors at load time, not runtime)
- Fix race condition in parallel-executor conflict detection

## Non-Goals

- Refactoring executor into smaller classes (deferred — too risky without tests first)
- Testing hooks.ts and task.ts (lower priority, deferred to future plan)
- New features or new commands

## Tasks

### Phase 1: Critical test coverage

- [ ] `067-test-run-command.md` — Add tests for `commands/run.ts`: parallel mode execution, --resume flag, --auto-pr flag, logger callbacks (onIteration, onPhase, onOutput). Mock executor and parallel-executor. Target: 80%+ line coverage for run.ts.
- [ ] `068-test-watcher.md` — Add tests for `core/watcher.ts`: file change detection, debounce timing, task queue management, signal handling (SIGINT graceful shutdown). Mock chokidar and executor. Target: 70%+ line coverage for watcher.ts.

### Phase 2: Runtime safety

- [ ] `069-executor-timeout.md` — Implement real timeout enforcement in executor.ts using `Promise.race()` around `provider.execute()`. On timeout: log warning, increment failure count, continue to next iteration (or abort if max failures reached). Add tests for timeout behavior.
- [ ] `070-zod-config-validation.md` — Add Zod as dependency. Create schema for AidfConfig in utils/config.ts. Validate after `normalizeConfig()` — throw descriptive errors for missing/invalid fields. Ensure backward-compatible configs still pass. Add tests for valid and invalid configs.

### Phase 3: Parallel execution fix

- [ ] `071-fix-parallel-race-condition.md` — In parallel-executor.ts: add runtime conflict detection during execution (not just pre-planned). Track files modified per task in real-time via executor callbacks. If conflict detected mid-execution, queue the conflicting task for retry. Add test for the race condition scenario.

## Dependencies

- 067 and 068 are independent (can run in parallel).
- 069 depends on 067 (run tests should exist before changing executor behavior).
- 070 is independent.
- 071 is independent but benefits from 068 (watcher tests exercise parallel paths).

## Risks

- Mocking chokidar for watcher tests can be flaky — use fake timers (vi.useFakeTimers).
- Adding Zod increases bundle size (~50KB) — acceptable for a CLI tool.
- Timeout enforcement may break long-running API provider calls — make timeout configurable per-provider.

## Success Criteria

- run.ts and watcher.ts have dedicated test files with meaningful coverage
- `Promise.race()` timeout is enforced and tested
- Invalid config.yml produces clear error messages at load time
- Parallel executor handles runtime file conflicts gracefully
- All 298+ existing tests still pass + new tests
