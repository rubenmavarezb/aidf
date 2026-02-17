# TASK: Create shared E2E test infrastructure

## Goal

Create reusable E2E test utilities in `packages/cli/src/__tests__/e2e/helpers/` that will be used by all subsequent E2E test files. This includes temp project creators, fixture generators, git repo initializers, cleanup utilities, a Vitest setup file, and full type definitions.

## Task Type

test

## Suggested Roles

- tester

## Auto-Mode Compatible

YES

## Scope

### Allowed

- `packages/cli/src/__tests__/e2e/helpers/**`
- `packages/cli/src/__tests__/e2e/setup.ts`
- `packages/cli/vitest.config.e2e.ts` (optional, for separate E2E config)

### Forbidden

- `packages/cli/src/core/**` (read-only)
- `packages/cli/src/commands/**` (read-only)
- `packages/cli/src/utils/**` (read-only)
- `packages/cli/src/types/**` (read-only)

## Requirements

1. **`createTempProject(options?)`** — Creates a temporary directory with a valid AIDF project structure (.ai/AGENTS.md, .ai/roles/developer.md, .ai/config.yml, .ai/tasks/ with pending/completed/blocked subdirectories). Returns `{ projectRoot, aiDir, cleanup }`. Options: `{ withGit?: boolean, config?: Partial<AidfConfig>, agentsContent?: string }`.

2. **`createTaskFixture(projectRoot, taskDef)`** — Writes a task .md file to `.ai/tasks/pending/` with proper frontmatter. Accepts `{ id: string, goal: string, type: string, allowedScope: string[], forbiddenScope: string[], requirements: string, definitionOfDone: string[] }`. Returns the absolute path to the created task file.

3. **`createSkillFixture(projectRoot, skillDef)`** — Writes a SKILL.md file to `.ai/skills/<name>/SKILL.md` with valid frontmatter. Accepts `{ name: string, description: string, version?: string, tags?: string[], body: string }`. Returns the absolute path.

4. **`createRoleFixture(projectRoot, roleDef)`** — Writes a role .md file to `.ai/roles/`. Accepts `{ name: string, identity: string, expertise: string[], responsibilities: string[] }`. Returns the absolute path.

5. **`initGitRepo(dir)`** — Runs `git init`, sets user.name/email to test values, creates initial commit. Returns the SimpleGit instance for further assertions.

6. **`createConfigFixture(projectRoot, config)`** — Writes a valid `.ai/config.yml` from an AidfConfig object using YAML serialization. Returns the path.

7. **`waitForFile(path, timeoutMs)`** — Polls for a file to exist (useful for async operations). Rejects after timeout.

8. **`readTaskStatus(taskPath)`** — Reads a task .md file and extracts the `## Status:` line value.

9. **Vitest setup file** at `packages/cli/src/__tests__/e2e/setup.ts` — Sets `TEST_TMPDIR` env var, ensures cleanup of all temp directories even on test failure using `afterAll` hooks.

10. **Type definitions** for all helper function parameters and return values. All functions must be fully typed with explicit interfaces for options, fixture definitions, and return values.

## Definition of Done

- [ ] `createTempProject()` creates a valid AIDF project structure with all required directories and files
- [ ] `createTempProject({ withGit: true })` also initializes a git repo with initial commit
- [ ] `createTaskFixture()` creates a properly formatted task .md file in pending/
- [ ] `createSkillFixture()` creates a SKILL.md with valid frontmatter
- [ ] `createRoleFixture()` creates a role .md with proper structure
- [ ] `initGitRepo()` creates a git repo with test user config and initial commit
- [ ] `createConfigFixture()` serializes AidfConfig to valid YAML
- [ ] `waitForFile()` polls and resolves when file exists, rejects on timeout
- [ ] `readTaskStatus()` correctly parses status from task files
- [ ] Vitest setup file sets TEST_TMPDIR and cleans up all `aidf-e2e-*` prefixed temp dirs
- [ ] All helper functions have full TypeScript type definitions
- [ ] All temp directories use the `aidf-e2e-` prefix for easy identification
- [ ] `pnpm test` — all existing tests continue to pass

## Notes

- Part of PLAN-v080-e2e-tests.md
- This task is a prerequisite for ALL other E2E tasks (091-097)
- All temp directories should use the prefix `aidf-e2e-` for easy identification and cleanup
- Git operations must set `GIT_AUTHOR_NAME`, `GIT_AUTHOR_EMAIL`, `GIT_COMMITTER_NAME`, `GIT_COMMITTER_EMAIL` env vars to avoid depending on global git config
- E2E test files should use the `.e2e.test.ts` suffix
- The mock API server (task 094) should be lightweight — use Node.js built-in `http` module only, no Express dependency
