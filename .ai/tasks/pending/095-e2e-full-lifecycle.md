# TASK: E2E test for the full AIDF lifecycle

## Goal

Test the complete AIDF lifecycle from init to completion as a single integration test, covering project initialization, configuration, task creation, execution, validation, scope enforcement, context loading, and task status management. File: `packages/cli/src/__tests__/e2e/full-lifecycle.e2e.test.ts`.

## Task Type

test

## Suggested Roles

- tester

## Auto-Mode Compatible

YES

## Scope

### Allowed

- `packages/cli/src/__tests__/e2e/full-lifecycle.e2e.test.ts`

### Forbidden

- `packages/cli/src/core/executor.ts` (read-only)
- `packages/cli/src/core/context-loader.ts` (read-only)
- `packages/cli/src/core/safety.ts` (read-only)
- `packages/cli/src/core/providers/**` (read-only)
- `packages/cli/src/commands/**` (read-only)
- `packages/cli/src/utils/**` (read-only)

## Requirements

1. **Init -> Configure -> Create Task -> Run (dry-run) -> Verify** — Create a temp directory. Run `aidf init` programmatically (import and call `createInitCommand().parseAsync()`). Verify `.ai/` structure is created. Write a `config.yml`. Create a task file. Run the executor in dry-run mode. Verify the task file is untouched (no status update in dry-run).

2. **Full execution with mock provider** — Create a temp project with `createTempProject({ withGit: true })`. Create a task with `allowed: ['src/**']`. Wire a mock provider that returns `{ success: true, filesChanged: ['src/new-file.ts'], completionSignal: '<TASK_COMPLETE>' }`. Run the executor. Verify: (a) task status is COMPLETED, (b) task file moved to `completed/`, (c) git commit exists with prefix, (d) result.filesModified contains `src/new-file.ts`.

3. **Execution with scope violation -> blocked** — Create a task with `allowed: ['src/**'], forbidden: ['config/**']`. Mock provider returns `filesChanged: ['config/bad.ts']`. Run executor with `scope_enforcement: 'strict'` and `max_consecutive_failures: 1`. Verify: (a) status is BLOCKED, (b) task file moved to `blocked/`, (c) blocked reason mentions scope violation.

4. **Execution with validation failure -> retry -> success** — Configure `pre_commit: ['echo "ok"']` (passes). Mock provider signals `<TASK_COMPLETE>` on iteration 1. Validation passes. Verify completion in 1 iteration.

5. **Execution with validation failure that actually fails** — Configure `pre_commit: ['exit 1']` (always fails). Mock provider signals `<TASK_COMPLETE>` on every iteration. Verify executor retries (validation error passed back) and eventually blocks after max iterations.

6. **Resume blocked task** — Create a task file with `## Status: BLOCKED` and blocked status metadata. Run executor with `resume: true`. Verify iteration count starts from `previousIteration + 1` and previous files are restored.

7. **Context loading verification** — Create a project with custom AGENTS.md, a role file, a task file, and a SKILL.md. Load context via `ContextLoader`. Verify all fields are parsed correctly (projectOverview, role.identity, task.goal, skill.name).

8. **Config.yml loading and validation** — Create a config.yml with all fields. Load and validate with Zod schema. Verify no errors. Then create an invalid config (missing `provider.type`). Verify a descriptive error is thrown.

9. **Task auto-selection** — Create a project with 3 tasks in `pending/` (001, 002, 003). Verify auto-select picks `001` (sorted by filename).

10. **End-to-end with skills** — Create a project with a SKILL.md. Load context. Verify the loaded context includes the skill in `context.skills[]` with correct metadata and content.

## Definition of Done

- [ ] All 10 test cases are implemented and passing
- [ ] Tests use E2E helpers from task 090 (`createTempProject`, `createTaskFixture`, etc.)
- [ ] Tests use mock providers (not real API calls) but exercise real filesystem and git operations
- [ ] Full lifecycle test covers: init -> configure -> task creation -> execution -> validation -> completion
- [ ] Scope violation test verifies the task is correctly blocked and moved to `blocked/`
- [ ] Context loading test verifies all context fields (AGENTS.md, roles, tasks, skills) are correctly parsed
- [ ] Resume test verifies iteration counting continues from previous state
- [ ] Each test creates its own temp directory and cleans up after itself
- [ ] `pnpm test` — all existing tests continue to pass

## Notes

- Part of PLAN-v080-e2e-tests.md
- Depends on task 090 (E2E test infrastructure)
- Benefits from task 094 (mock API server can be reused for provider tests)
- This is the most comprehensive integration test — it exercises the full AIDF pipeline
- Consider using longer test timeouts (30s) for the full lifecycle tests
