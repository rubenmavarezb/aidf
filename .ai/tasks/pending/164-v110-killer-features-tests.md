# TASK: Dedicated tests for v1.1.0 killer features (STATE.md, Quick Mode, Plan Execution)

## Goal

Add dedicated integration and E2E test tasks for the v1.1.0 plan (PLAN-v110-phase1-killer-features) covering STATE.md persistence across sessions, quick mode's in-memory task execution, and plan-driven wave execution with resumability.

## Task Type

test

## Suggested Roles

- tester

## Auto-Mode Compatible

YES

## Scope

### Allowed

- `packages/cli/src/__tests__/e2e/state-persistence.e2e.test.ts`
- `packages/cli/src/__tests__/e2e/quick-mode.e2e.test.ts`
- `packages/cli/src/__tests__/e2e/plan-execution.e2e.test.ts`

### Forbidden

- `packages/cli/src/core/state-manager.ts` (read-only)
- `packages/cli/src/core/quick-executor.ts` (read-only)
- `packages/cli/src/core/plan-parser.ts` (read-only)
- `packages/cli/src/core/plan-executor.ts` (read-only)
- `packages/cli/src/commands/**` (read-only)

## Requirements

### STATE.md Persistence E2E (state-persistence.e2e.test.ts)
1. Create project with STATE.md → simulate execution → verify STATE.md updated with new position/focus
2. Add decisions via StateManager → save → reload → verify decisions persisted
3. Add blockers → resolve one → save → reload → verify resolved status persisted
4. Session continuity: save stoppedAt + resumeFrom → reload → verify fields intact
5. Truncation test: add >150 lines of content → render → verify output is ≤150 lines, oldest resolved items dropped
6. Quick tasks table: add entries → save → reload → verify table populated
7. STATE.md loaded as context: use ContextLoader with a project that has STATE.md → verify it appears in context

### Quick Mode E2E (quick-mode.e2e.test.ts)
8. In-memory task generation: create QuickExecutor with description → verify generated task has correct goal, permissive scope, inferred type
9. Type inference: "fix bug in auth" → bugfix, "add tests for utils" → test, "update README" → docs
10. Prompt building: verify prompt is concise (no research/plan phases), contains the description and AGENTS.md context
11. Iteration limits: default max 5, with `--full` max 10
12. Commit prefix: verify auto-commit uses `quick:` prefix

### Plan Execution E2E (plan-execution.e2e.test.ts)
13. Parse plan with checkboxes: `- [ ] task.md` and `- [x] task.md` → verify completed tasks are skipped
14. Dependency resolution: parse `depends: task-a, task-b` → verify correct wave assignment
15. Cycle detection: create circular dependency → verify error thrown with clear message
16. Auto-wave assignment: tasks with no explicit wave assigned correctly based on dependency graph
17. Wave execution order: verify wave 1 tasks run before wave 2
18. Checkbox update: after task completion → verify plan file updated with `[x]`
19. Resumability: mark 2 of 4 tasks as `[x]` → run plan → verify only remaining 2 tasks executed
20. Stop on failure: task in wave 1 fails → verify wave 2 is not started

## Definition of Done

- [ ] 20+ test cases implemented and passing
- [ ] STATE.md persistence tested across save/load cycles with real filesystem
- [ ] Quick mode task generation and type inference tested
- [ ] Plan parsing, dependency resolution, and wave execution tested
- [ ] Each test uses `createTempProject()` from E2E helpers
- [ ] `pnpm test` — all existing tests continue to pass

## Notes

- Part of PLAN-v110-phase1-killer-features.md
- Depends on tasks 110-118 being implemented first
- Uses E2E test infrastructure from task 090
