# PLAN: v0.8.0 — End-to-End & Integration Tests

## Status: DRAFT

## Overview

The current test suite relies heavily on mocked dependencies (vi.mock for child_process, fs, simple-git, context-loader, etc.). While this provides fast, deterministic unit tests, it leaves a blind spot for real-world interactions: actual filesystem operations, real git repositories, provider API response handling, and the full init-to-completion lifecycle. This plan introduces E2E and integration tests that exercise the CLI against real filesystems, real git repos, and mock HTTP servers to catch integration bugs that unit tests miss.

## Goals

- Create reusable E2E test infrastructure (temp directory helpers, fixture generators, cleanup utilities)
- Validate ScopeGuard and file change detection against real filesystem operations (create, modify, delete files)
- Test git operations (init, commit, branch creation, scope checks) against actual git repositories
- Stand up a mock HTTP server that simulates Anthropic and OpenAI API responses for provider integration tests
- Run the full AIDF lifecycle (init -> configure -> create task -> run -> validate -> complete) as a single integration test
- Test parallel executor with real file conflicts across concurrent task executions
- Test SkillLoader discovery and loading against real SKILL.md files on disk in nested directory structures

## Non-Goals

- Testing against the real Anthropic/OpenAI APIs (costs money, flaky, slow)
- Testing the VS Code extension (blocked, separate repo)
- Performance benchmarking or load testing
- Testing notification delivery (Slack, Discord, email) against real services
- Refactoring existing unit tests to remove mocks

## Tasks

### Phase 1: E2E Test Infrastructure

- [ ] `090-e2e-test-infrastructure.md` — Create shared E2E test utilities in `packages/cli/src/__tests__/e2e/helpers/`. These helpers will be used by all subsequent E2E test files. **Specific deliverables:**

  1. **`createTempProject(options?)`** — Creates a temporary directory with a valid AIDF project structure (.ai/AGENTS.md, .ai/roles/developer.md, .ai/config.yml, .ai/tasks/ with pending/completed/blocked subdirectories). Returns `{ projectRoot, aiDir, cleanup }`. Options: `{ withGit?: boolean, config?: Partial<AidfConfig>, agentsContent?: string }`.
  2. **`createTaskFixture(projectRoot, taskDef)`** — Writes a task .md file to `.ai/tasks/pending/` with proper frontmatter. Accepts `{ id: string, goal: string, type: string, allowedScope: string[], forbiddenScope: string[], requirements: string, definitionOfDone: string[] }`. Returns the absolute path to the created task file.
  3. **`createSkillFixture(projectRoot, skillDef)`** — Writes a SKILL.md file to `.ai/skills/<name>/SKILL.md` with valid frontmatter. Accepts `{ name: string, description: string, version?: string, tags?: string[], body: string }`. Returns the absolute path.
  4. **`createRoleFixture(projectRoot, roleDef)`** — Writes a role .md file to `.ai/roles/`. Accepts `{ name: string, identity: string, expertise: string[], responsibilities: string[] }`. Returns the absolute path.
  5. **`initGitRepo(dir)`** — Runs `git init`, sets user.name/email to test values, creates initial commit. Returns the SimpleGit instance for further assertions.
  6. **`createConfigFixture(projectRoot, config)`** — Writes a valid `.ai/config.yml` from an AidfConfig object using YAML serialization. Returns the path.
  7. **`waitForFile(path, timeoutMs)`** — Polls for a file to exist (useful for async operations). Rejects after timeout.
  8. **`readTaskStatus(taskPath)`** — Reads a task .md file and extracts the `## Status:` line value.
  9. **Vitest setup file** at `packages/cli/src/__tests__/e2e/setup.ts` — Sets `TEST_TMPDIR` env var, ensures cleanup of all temp directories even on test failure using `afterAll` hooks.
  10. **Type definitions** for all helper function parameters and return values.

### Phase 2: Real Filesystem Tests

- [ ] `091-e2e-real-filesystem-scope.md` — Test ScopeGuard and file operations against a real filesystem. File: `packages/cli/src/__tests__/e2e/filesystem-scope.e2e.test.ts`. **Test cases:**

  1. **Create files in allowed scope, verify ALLOW** — Use `createTempProject()`, create files at `src/components/Button.tsx` and `src/utils/helpers.ts`. Run `checkFileChanges()` with scope `allowed: ['src/**']`. Assert action is `ALLOW`.
  2. **Create files in forbidden scope, verify BLOCK** — Create `.env` and `src/config/secrets.ts`. Run with `forbidden: ['.env*', 'src/config/**']`. Assert action is `BLOCK` and `files` contains both paths.
  3. **Create files outside allowed scope in strict mode, verify BLOCK** — Create `scripts/deploy.sh`. Run with `allowed: ['src/**']`, mode `strict`. Assert BLOCK.
  4. **Create files outside allowed scope in permissive mode, verify ALLOW** — Same file, mode `permissive`. Assert ALLOW.
  5. **Nested glob matching with real directory tree** — Create `src/components/forms/Input.tsx`, `src/components/forms/Select.tsx`, `src/components/Button.tsx`. Verify `allowed: ['src/components/forms/**']` allows the first two but blocks `Button.tsx` in strict mode.
  6. **Dotfile handling** — Create `.env`, `.env.local`, `.env.production`, `.gitignore`. Verify `forbidden: ['.env*']` blocks the first three but not `.gitignore`.
  7. **ScopeGuard approve/revert flow with real files** — Create a ScopeGuard with `ask_before: ['package.json']`. Create `package.json` on disk. Call `approve(['package.json'])`. Verify `getChangesToRevert()` returns empty for approved files but returns non-empty for other out-of-scope files.
  8. **File type detection (created vs modified vs deleted)** — Create a file, read its content, modify it, verify the change type is detected correctly. Delete the file and verify deletion detection.
  9. **Symlink handling** — Create a symlink from `src/link.ts` -> `../outside/real.ts`. Verify scope check resolves the real path and correctly blocks if the real path is outside scope.
  10. **Case sensitivity** — Create `SRC/File.ts` vs `src/File.ts`. Verify pattern matching behavior matches the OS expectations.

- [ ] `092-e2e-real-filesystem-operations.md` — Test that the executor's file tracking works with real file creation/modification. File: `packages/cli/src/__tests__/e2e/filesystem-operations.e2e.test.ts`. **Test cases:**

  1. **Detect new file creation** — Create a file after a baseline git status snapshot. Verify it appears in the changed files list.
  2. **Detect file modification** — Modify an existing tracked file. Verify it appears as modified.
  3. **Detect file deletion** — Delete a tracked file. Verify it appears as deleted.
  4. **Detect multiple simultaneous changes** — Create 3 files, modify 2, delete 1 in a single operation. Verify all 6 changes are detected.
  5. **Ignore files in .gitignore** — Create `node_modules/foo.js` (gitignored). Verify it does not appear in changed files.
  6. **Track files across nested directories** — Create files at depth 5 (`a/b/c/d/e/file.ts`). Verify detection.
  7. **Handle empty directories** — Create an empty directory. Verify it does not appear as a file change.
  8. **Binary file handling** — Create a `.png` file with buffer content. Verify it is detected as a change.

### Phase 3: Real Git Operations Tests

- [ ] `093-e2e-real-git-operations.md` — Test git operations (init, commit, branch, scope validation) against actual git repositories. File: `packages/cli/src/__tests__/e2e/git-operations.e2e.test.ts`. **Test cases:**

  1. **Initialize a git repo and verify .git exists** — Use `initGitRepo()` helper. Assert `.git/` directory exists, `git status` returns clean.
  2. **Create and commit a file, verify git log** — Write `src/index.ts`, stage, commit with prefix `aidf:`. Verify `git log --oneline` contains the prefixed message.
  3. **Auto-commit flow simulation** — Create a project with `auto_commit: true` config. Create a file in allowed scope. Simulate the executor commit step using `simple-git`. Verify the commit exists and the message follows the `commit_prefix` convention.
  4. **Branch creation with prefix** — Create a branch `aidf/task-001`. Verify branch exists via `git branch --list`.
  5. **Scope check against git diff** — Commit a baseline. Create files in allowed and forbidden scope. Run `git diff --name-only` and feed results to `checkFileChanges()`. Verify correct BLOCK/ALLOW decisions.
  6. **Revert forbidden file changes via git checkout** — Commit baseline. Modify a forbidden file. Use `git checkout -- <file>` to revert. Verify the file content is restored.
  7. **Staged vs unstaged detection** — Stage one file, leave another unstaged. Verify the executor's change detection distinguishes between them correctly.
  8. **Task file movement (pending -> completed)** — Create a task file at `.ai/tasks/pending/001-task.md`. Call `moveTaskFile()` with status `completed`. Verify the file now exists at `.ai/tasks/completed/001-task.md` and the original is gone.
  9. **Task file movement (pending -> blocked)** — Same as above but with `blocked` status. Verify the file is at `.ai/tasks/blocked/001-task.md`.
  10. **Git staging of moved task files** — After moving a task file, verify `git status` shows the old path as deleted and the new path as a new file (or renamed).

### Phase 4: Mock API Server for Provider Tests

- [ ] `094-e2e-mock-api-server.md` — Create a mock HTTP server that simulates Anthropic and OpenAI API responses. File: `packages/cli/src/__tests__/e2e/helpers/mock-api-server.ts` and test file `packages/cli/src/__tests__/e2e/api-providers.e2e.test.ts`. **Specific deliverables:**

  1. **`MockApiServer` class** — Uses Node.js built-in `http.createServer()`. Exposes `start()` (returns `{ port, baseUrl }`), `stop()`, `reset()`, `getRequestLog()`. Configurable response sequences via `enqueueResponse(response)`.
  2. **Anthropic Messages API endpoint** (`POST /v1/messages`) — Returns streaming or non-streaming responses matching the Anthropic API schema. Supports `content_block_delta` events for streaming. Configurable: model, stop_reason, usage (input/output tokens).
  3. **OpenAI Chat Completions endpoint** (`POST /v1/chat/completions`) — Returns responses matching the OpenAI API schema. Supports streaming with SSE `data:` lines. Configurable: model, finish_reason, usage.
  4. **Tool calling simulation** — Both endpoints support returning tool_use blocks (Anthropic) or tool_calls (OpenAI) that invoke `read_file`, `write_file`, `list_files`, `run_command`, `task_complete`, `task_blocked`.
  5. **Test: Anthropic provider executes with mock server** — Configure `AnthropicApiProvider` with mock server URL as base URL. Send a prompt. Verify the provider parses the response correctly, extracts output text, detects completion signal, and reports token usage.
  6. **Test: OpenAI provider executes with mock server** — Same as above but for `OpenAiApiProvider`.
  7. **Test: Tool calling round-trip** — Mock server returns a `write_file` tool call. Verify the provider handles the tool, writes the file to disk, and sends the tool result back. Then mock server returns `task_complete`. Verify the full round-trip completes.
  8. **Test: Error responses** — Mock server returns 429 (rate limit), 500 (server error), 401 (auth error). Verify each provider surfaces the error correctly with meaningful messages.
  9. **Test: Token usage accumulation** — Mock server returns specific `usage` values across 3 responses. Verify the provider accumulates `inputTokens` and `outputTokens` correctly.
  10. **Test: Streaming response handling** — Mock server sends a streaming response with 5 content deltas. Verify the `onOutput` callback receives each chunk and the final output is correctly concatenated.

### Phase 5: Full Lifecycle Integration Test

- [ ] `095-e2e-full-lifecycle.md` — Test the complete AIDF lifecycle from init to completion as a single integration test. File: `packages/cli/src/__tests__/e2e/full-lifecycle.e2e.test.ts`. **Test cases:**

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

### Phase 6: Parallel Executor with Real File Conflicts

- [ ] `096-e2e-parallel-file-conflicts.md` — Test parallel executor conflict detection and serialization with real files. File: `packages/cli/src/__tests__/e2e/parallel-conflicts.e2e.test.ts`. **Test cases:**

  1. **Two tasks with overlapping allowed scope are serialized** — Create task-A with `allowed: ['src/shared/**', 'src/a/**']` and task-B with `allowed: ['src/shared/**', 'src/b/**']`. Both share `src/shared/**`. Verify `detectDependencies()` identifies the overlap and creates a dependency.
  2. **Two tasks with disjoint scopes run in parallel** — Create task-A with `allowed: ['src/a/**']` and task-B with `allowed: ['src/b/**']`. Verify no dependencies are detected and both are scheduled concurrently.
  3. **Runtime conflict detection** — Create two tasks that both modify `src/shared/utils.ts`. Mock providers to both return `filesChanged: ['src/shared/utils.ts']`. Verify the parallel executor detects the conflict, queues the second task for retry, and the final result reports the conflict in `fileConflicts`.
  4. **Conflict retry succeeds** — After a runtime conflict is detected, verify the conflicted task is retried after the first task completes. Mock the retry to succeed. Verify final `ParallelExecutionResult.success` is `true`.
  5. **Three tasks: A and B conflict, C is independent** — Verify C runs in parallel with whichever of A/B runs first, and the conflicting task is serialized after the first completes.
  6. **Concurrency limit respected** — Create 5 tasks with disjoint scopes. Set `concurrency: 2`. Verify at most 2 tasks are executing simultaneously (track via `onTaskStart`/`onTaskComplete` callbacks with timestamps).
  7. **All tasks fail -> overall failure** — Mock all providers to return `success: false`. Verify `ParallelExecutionResult.success` is `false`, `failed` count equals total tasks, `completed` is 0.
  8. **Mixed results** — 3 tasks: one completes, one blocks, one fails. Verify `completed: 1, blocked: 1, failed: 1` in the result.
  9. **File conflict tracking in result** — Verify `ParallelExecutionResult.fileConflicts` contains the exact list of conflicting file paths.
  10. **Total iterations and files modified aggregation** — Verify `totalIterations` sums all task iterations and `totalFilesModified` is the deduplicated union of all tasks' modified files.

### Phase 7: Skill Loader with Real Disk Structures

- [ ] `097-e2e-skill-loader-real-disk.md` — Test SkillLoader against complex real directory structures on disk. File: `packages/cli/src/__tests__/e2e/skill-loader-disk.e2e.test.ts`. **Test cases:**

  1. **Discover skills in nested directory structure** — Create `.ai/skills/skill-a/SKILL.md`, `.ai/skills/skill-b/SKILL.md`, `.ai/skills/not-a-skill/README.md`. Verify `discoverSkills()` returns exactly 2 skills (skill-a, skill-b).
  2. **Load skills from multiple directories (project + config)** — Create skills in `.ai/skills/` and an extra directory. Pass extra directory via config. Verify both are discovered with correct `source` values (`project` vs `config`).
  3. **Skill priority: project overrides config** — Create a skill with the same name in both `.ai/skills/my-skill/SKILL.md` and `extra/my-skill/SKILL.md`. Verify the project version takes priority (appears first or only once with `source: 'project'`).
  4. **Large skill file handling** — Create a SKILL.md with 10,000 lines of content. Verify it loads without error and the full content is available.
  5. **Skill with complex frontmatter** — Create a SKILL.md with multi-value tags (`tags: typescript, react, testing, ci-cd`), multi-value globs (`globs: src/**/*.ts, src/**/*.tsx, tests/**`). Verify all values are parsed as arrays.
  6. **Security validation on real files** — Create a skill containing `ignore previous instructions`. Verify `loadAll()` with `block_suspicious: true` excludes it. Verify `loadAll()` with `block_suspicious: false` includes it with warnings.
  7. **loadByName with real files** — Create 3 skills on disk. Call `loadByName('skill-b')`. Verify it returns exactly skill-b with correct content. Call `loadByName('nonexistent')`. Verify it returns null.
  8. **Empty skills directory** — Create `.ai/skills/` with no subdirectories. Verify `discoverSkills()` returns `[]` without error.
  9. **Skill with missing frontmatter fields** — Create a SKILL.md with `name` but no `description`. Verify it is skipped during discovery (not loaded).
  10. **generateSkillsXml with real loaded skills** — Discover and load 3 skills from disk. Pass them to `generateSkillsXml()`. Verify the output contains all 3 `<skill>` elements with correct names, descriptions, tags, and instruction content. Verify XML special characters in skill content are properly escaped.

## Dependencies

- 090 (infrastructure) is a prerequisite for ALL other tasks (091-097).
- 091 and 092 are independent of each other (both depend only on 090).
- 093 depends on 090 only.
- 094 is independent of 091-093 (depends only on 090).
- 095 depends on 090 and benefits from 094 (mock API server can be reused).
- 096 depends on 090 and benefits from 091 (filesystem scope helpers).
- 097 depends on 090 only.

Dependency graph:
```
090 ──┬── 091 (filesystem scope)
      ├── 092 (filesystem operations)
      ├── 093 (git operations)
      ├── 094 (mock API server)
      ├── 095 (full lifecycle) ← benefits from 094
      ├── 096 (parallel conflicts) ← benefits from 091
      └── 097 (skill loader disk)
```

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Temp directory cleanup fails, leaking disk space | Medium | Low | Use `afterAll` + `afterEach` with `rm -rf`. Add a global cleanup in setup.ts that removes all `aidf-e2e-*` prefixed dirs from tmpdir. |
| Git operations tests are slow (git init, commit) | Medium | Medium | Use `--no-gpg-sign` and minimal config. Keep repos small (1-3 files). Parallelize independent test files. |
| Mock API server port conflicts in CI | Low | High | Use port 0 (random available port) and return the actual port from `start()`. |
| OS-specific path behavior (Windows vs macOS vs Linux) | Medium | Medium | Use `path.join()` and `path.resolve()` everywhere. Skip symlink tests on Windows. Normalize slashes in assertions. |
| E2E tests increase CI time significantly | High | Medium | Run E2E tests in a separate Vitest project with `--pool=forks` for isolation. Add `--timeout 30000` for longer tests. Consider a separate CI job. |
| Flaky tests due to filesystem timing | Low | Medium | Use `waitForFile()` helper with retries. Avoid `setTimeout` in favor of polling. |

## Success Criteria

- [ ] All E2E helper functions are created, typed, and documented in `helpers/`
- [ ] Real filesystem tests validate scope checking against actual files on disk (10+ test cases)
- [ ] Real git operations tests create repos, commit, branch, and verify scope against git diff (10+ test cases)
- [ ] Mock API server handles both Anthropic and OpenAI response formats with tool calling (10+ test cases)
- [ ] Full lifecycle integration test covers init -> configure -> task -> run -> complete (10+ test cases)
- [ ] Parallel executor tests verify conflict detection, serialization, and retry with real files (10+ test cases)
- [ ] Skill loader tests verify discovery, loading, security, and XML generation from real disk (10+ test cases)
- [ ] All existing 590+ unit tests continue to pass
- [ ] E2E tests run successfully in CI (GitHub Actions)
- [ ] No temp directory leaks after test completion

## Notes

- E2E test files should use the `.e2e.test.ts` suffix to distinguish them from unit tests and allow separate Vitest configuration (e.g., longer timeouts, different pool).
- Consider adding a Vitest workspace configuration that separates unit tests from E2E tests: `vitest.workspace.ts` with `{ test: { include: ['**/*.e2e.test.ts'], testTimeout: 30000 } }`.
- The mock API server should be lightweight (no Express dependency) — use Node.js built-in `http` module only.
- All temp directories should use the prefix `aidf-e2e-` for easy identification and cleanup.
- Git operations tests must set `GIT_AUTHOR_NAME`, `GIT_AUTHOR_EMAIL`, `GIT_COMMITTER_NAME`, `GIT_COMMITTER_EMAIL` env vars to avoid depending on global git config.
