# PLAN: v1.1.0 — Phase 1: Killer Features (STATE.md + Quick Mode + Plan-Driven Execution)

## Overview

Phase 1 delivers the three features with highest adoption impact: persistent project state across sessions, a zero-friction quick execution mode, and plan-driven orchestration that turns plan files from passive templates into active execution drivers. These features directly address the competitive gap with GSD while leveraging AIDF's existing typed CLI architecture.

## Goals

- Implement STATE.md as a persistent cross-session memory layer integrated into the executor pipeline
- Add `aidf quick` command for zero-ceremony ad-hoc task execution
- Make plan files drive execution via `aidf plan run` with automatic task ordering and wave assignment
- All features must be backward-compatible — existing `aidf run` workflows must work unchanged

## Non-Goals

- Context freshness per wave (Phase 2)
- Research agent pipeline (Phase 2)
- Inter-wave result forwarding (Phase 2)
- Model profiles or brownfield mapping (Phase 3)
- Changing the provider interface

## Tasks

### Phase 1: STATE.md — Persistent Project Memory

Core infrastructure: a `.ai/STATE.md` file that persists decisions, blockers, position, and session continuity across executions. Loaded as context, updated automatically by the executor.

- [ ] `110-state-types-and-manager.md` — Define state types and implement `StateManager` class (wave: 1)

  **Types to add in `types/index.ts`:**
  ```typescript
  export interface ProjectState {
    currentFocus: string;
    lastUpdated: string; // ISO 8601
    position: StatePosition;
    decisions: StateDecision[];
    blockers: StateBlocker[];
    quickTasks: QuickTaskEntry[];
    sessionContinuity: SessionContinuity;
  }

  export interface StatePosition {
    phase?: string;
    task?: string;
    status: 'idle' | 'in_progress' | 'blocked';
  }

  export interface StateDecision {
    date: string;
    description: string;
    rationale?: string;
  }

  export interface StateBlocker {
    description: string;
    resolved: boolean;
    addedAt: string;
    resolvedAt?: string;
  }

  export interface QuickTaskEntry {
    description: string;
    date: string;
    commitHash?: string;
    filesModified: number;
  }

  export interface SessionContinuity {
    lastSession?: string;
    stoppedAt?: string;
    resumeFrom?: string;
  }
  ```

  **New file `packages/cli/src/core/state-manager.ts`:**
  - `StateManager` class with methods:
    - `load(aiDir: string): Promise<ProjectState>` — parse STATE.md from `.ai/STATE.md`, return structured state
    - `save(aiDir: string, state: ProjectState): Promise<void>` — serialize state back to STATE.md markdown
    - `addDecision(state: ProjectState, description: string, rationale?: string): void`
    - `addBlocker(state: ProjectState, description: string): void`
    - `resolveBlocker(state: ProjectState, index: number): void`
    - `updatePosition(state: ProjectState, position: Partial<StatePosition>): void`
    - `addQuickTask(state: ProjectState, entry: QuickTaskEntry): void`
    - `updateSession(state: ProjectState, stoppedAt: string, resumeFrom?: string): void`
    - `render(state: ProjectState): string` — render state to markdown (max 150 lines, truncates oldest decisions/blockers)
    - `parse(markdown: string): ProjectState` — parse markdown back to structured state
  - Markdown format matches the format defined in the analysis (Current Position, Decisions, Blockers, Session Continuity sections)
  - 150-line hard cap: when rendering, if output exceeds 150 lines, drop oldest resolved blockers first, then oldest decisions

  **Scope:** `packages/cli/src/core/state-manager.ts`, `packages/cli/src/types/index.ts`
  **Tests:** `packages/cli/src/core/state-manager.test.ts` — parse/render roundtrip, truncation at 150 lines, add/resolve operations

- [ ] `111-state-context-integration.md` — Integrate STATE.md into context loading and executor pipeline (wave: 2, depends: 110)

  **Changes to `context-loader.ts`:**
  - Add `loadState()` method that reads `.ai/STATE.md` if it exists
  - Add `state?: string` field to `LoadedContext` interface (raw markdown, injected as context layer)
  - `loadContext()` calls `loadState()` and includes it between agents and role layers
  - Update `estimateContextSize()` to include state in breakdown

  **Changes to `types/index.ts`:**
  - Add `state: number` to `ContextBreakdown`
  - Add `state?: string` to `LoadedContext`

  **Changes to `phases/postflight.ts`:**
  - After task completion/blocking/failure, call `StateManager.load()`, update position and session continuity, call `StateManager.save()`
  - On task completion: update `position.status = 'idle'`, add session continuity entry
  - On task blocked: update `position.status = 'blocked'`, add blocker from blocking issue
  - Extract decisions from AI output if present (look for patterns like "Decision:", "Decided:", "Chose X over Y")

  **Changes to `phases/preflight.ts`:**
  - Load state during preflight and include in PhaseContext for access by other phases
  - Log state summary (current focus, pending blockers count)

  **Scope:** `packages/cli/src/core/context-loader.ts`, `packages/cli/src/core/phases/preflight.ts`, `packages/cli/src/core/phases/postflight.ts`, `packages/cli/src/types/index.ts`
  **Tests:** Update context-loader tests, add postflight state update tests

- [ ] `112-state-command.md` — Add `aidf state` CLI command for manual state inspection and editing (wave: 2, depends: 110)

  **New file `packages/cli/src/commands/state.ts`:**
  - `aidf state` — shows current state summary (position, focus, decision count, blocker count)
  - `aidf state show` — prints full STATE.md content
  - `aidf state decide "<description>"` — adds a decision entry
  - `aidf state block "<description>"` — adds a blocker
  - `aidf state resolve <index>` — resolves a blocker by index
  - `aidf state focus "<description>"` — updates current focus
  - `aidf state reset` — creates fresh STATE.md (with confirmation prompt)

  **Changes to `index.ts`:**
  - Register `createStateCommand()`

  **Scope:** `packages/cli/src/commands/state.ts`, `packages/cli/src/index.ts`
  **Tests:** `packages/cli/src/commands/state.test.ts`

- [ ] `113-state-template.md` — Add STATE.md template to `aidf init` (wave: 3, depends: 110, 112)

  **New file `templates/.ai/STATE.md`:**
  ```markdown
  # Project State

  **Current focus:** Not started
  **Last updated:** {{date}}

  ## Position
  - **Status:** idle

  ## Decisions

  _No decisions recorded yet._

  ## Blockers

  _No blockers._

  ## Quick Tasks

  | # | Description | Date | Commit | Files |
  |---|-------------|------|--------|-------|

  ## Session Continuity
  - **Last session:** —
  - **Stopped at:** —
  - **Resume from:** —
  ```

  **Changes to `commands/init.ts`:**
  - Copy STATE.md template during `aidf init`

  **Scope:** `templates/.ai/STATE.md`, `packages/cli/src/commands/init.ts`
  **Tests:** Update init command tests

### Phase 2: Quick Mode — Zero-Friction Execution

A new `aidf quick` command that executes ad-hoc tasks without requiring task files, plans, or the full research/plan/implement/verify cycle.

- [ ] `114-quick-executor.md` — Implement `QuickExecutor` class for lightweight task execution (wave: 1)

  **New file `packages/cli/src/core/quick-executor.ts`:**
  - `QuickExecutor` class:
    - Constructor: `(description: string, options: QuickExecutorOptions)`
    - `run(): Promise<ExecutorResult>`
    - Generates an in-memory task with:
      - Goal: the description
      - Scope: permissive (entire project, forbidden only `.env*`, `**/secrets/**`)
      - Task type: inferred from description keywords (fix/bug → bugfix, test → test, doc → docs, else → component)
      - Max iterations: 5 (default), 10 with `--full`
    - Loads context: AGENTS.md + developer role + STATE.md (no task file, no plan)
    - Builds a concise prompt (no research/plan phases, just "implement this change")
    - Calls provider directly (reuses existing provider infrastructure)
    - Runs validation only if code files were modified (skip for docs-only changes)
    - Auto-commits with prefix `quick:` if changes pass validation

  **Types to add:**
  ```typescript
  export interface QuickExecutorOptions {
    full?: boolean;       // Enable validation + scope checking
    dryRun?: boolean;
    verbose?: boolean;
    maxIterations?: number;
    provider?: string;
    model?: string;
  }
  ```

  **Scope:** `packages/cli/src/core/quick-executor.ts`, `packages/cli/src/types/index.ts`
  **Tests:** `packages/cli/src/core/quick-executor.test.ts` — in-memory task generation, prompt building, iteration limits, commit prefix

- [ ] `115-quick-command.md` — Add `aidf quick` CLI command (wave: 2, depends: 114)

  **New file `packages/cli/src/commands/quick.ts`:**
  - `aidf quick "<description>"` — runs QuickExecutor with defaults
  - `aidf quick --full "<description>"` — enables validation and scope checking
  - `aidf quick --dry-run "<description>"` — preview without execution
  - `aidf quick --max-iterations <n>` — override iteration limit
  - `aidf quick --provider <type>` — override provider
  - Shows live status spinner during execution (reuses `LiveStatus`)
  - On completion: prints summary (files modified, commit hash)
  - Updates STATE.md quick tasks table via StateManager

  **Changes to `index.ts`:**
  - Register `createQuickCommand()`

  **Scope:** `packages/cli/src/commands/quick.ts`, `packages/cli/src/index.ts`
  **Tests:** `packages/cli/src/commands/quick.test.ts`

### Phase 3: Plan-Driven Execution

Transform plan files from passive documentation into active execution orchestrators. `aidf plan run` reads a plan, extracts tasks with declared dependencies, and executes them in waves using the existing ParallelExecutor.

- [ ] `116-plan-parser.md` — Implement plan file parser that extracts tasks, waves, and dependencies (wave: 1)

  **New file `packages/cli/src/core/plan-parser.ts`:**
  - `PlanParser` class:
    - `parse(planPath: string): Promise<ParsedPlan>`
    - Extracts tasks from markdown checkboxes: `- [ ] \`taskfile.md\` - description (wave: N, depends: task1, task2)`
    - Supports shorthand: `- [ ] \`taskfile.md\` - description` (auto-assigned to wave based on dependency graph)
    - Detects already-completed tasks: `- [x] \`taskfile.md\` - description` → skipped on execution
    - Resolves task file paths relative to `.ai/tasks/`
    - Validates all referenced task files exist
    - Builds dependency graph and validates no cycles (topological sort)
    - Auto-assigns waves when not explicit: tasks with no dependencies → wave 1, tasks depending on wave 1 → wave 2, etc.

  **Types to add:**
  ```typescript
  export interface ParsedPlan {
    name: string;
    overview: string;
    tasks: PlanTask[];
    waves: PlanWave[];
    successCriteria: string[];
  }

  export interface PlanTask {
    taskPath: string;
    description: string;
    wave: number;
    dependsOn: string[];  // task file paths
    completed: boolean;
  }

  export interface PlanWave {
    number: number;
    tasks: PlanTask[];
  }
  ```

  **Scope:** `packages/cli/src/core/plan-parser.ts`, `packages/cli/src/types/index.ts`
  **Tests:** `packages/cli/src/core/plan-parser.test.ts` — parse checkboxes, dependency resolution, cycle detection, auto-wave assignment, skip completed tasks

- [ ] `117-plan-executor.md` — Implement `PlanExecutor` that orchestrates plan-driven wave execution (wave: 2, depends: 116)

  **New file `packages/cli/src/core/plan-executor.ts`:**
  - `PlanExecutor` class:
    - Constructor: `(planPath: string, options: PlanExecutorOptions)`
    - `run(): Promise<PlanExecutionResult>`
    - Calls `PlanParser.parse()` to get waves
    - Filters out completed tasks
    - For each wave:
      - Creates a `ParallelExecutor` with the wave's task paths
      - Executes the wave
      - After wave completion: updates plan file checkboxes (marks completed tasks with `[x]`)
      - Updates STATE.md position (phase, current wave)
      - If any task in wave fails/blocks: stops execution, reports partial results
    - On full completion: updates plan file with completion status
    - Resumable: re-running `aidf plan run plan.md` skips `[x]` tasks

  **Types to add:**
  ```typescript
  export interface PlanExecutorOptions {
    dryRun?: boolean;
    verbose?: boolean;
    quiet?: boolean;
    maxIterations?: number;
    concurrency?: number;
    provider?: string;
    continueOnError?: boolean;  // Continue to next wave even if current has failures
  }

  export interface PlanExecutionResult {
    success: boolean;
    planPath: string;
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    blockedTasks: number;
    skippedTasks: number;  // Already completed before this run
    waves: PlanWaveResult[];
  }

  export interface PlanWaveResult {
    wave: number;
    result: ParallelExecutionResult;
  }
  ```

  **Scope:** `packages/cli/src/core/plan-executor.ts`, `packages/cli/src/types/index.ts`
  **Tests:** `packages/cli/src/core/plan-executor.test.ts` — wave sequencing, skip completed, stop on failure, checkbox updates, resumability

- [ ] `118-plan-command.md` — Add `aidf plan` CLI subcommands (wave: 3, depends: 116, 117)

  **New file `packages/cli/src/commands/plan.ts`:**
  - `aidf plan run <planPath>` — executes a plan via PlanExecutor
    - `--concurrency <n>` — max parallel tasks per wave (default: 3)
    - `--continue-on-error` — don't stop at failed waves
    - `--dry-run` — show execution plan without running
  - `aidf plan status <planPath>` — shows plan progress (tasks completed/pending/blocked per wave)
  - `aidf plan validate <planPath>` — validates plan file (task files exist, no dependency cycles, waves are consistent)
  - Shows wave-by-wave progress during execution with live status
  - Prints execution summary on completion

  **Changes to `index.ts`:**
  - Register `createPlanCommand()`

  **Scope:** `packages/cli/src/commands/plan.ts`, `packages/cli/src/index.ts`
  **Tests:** `packages/cli/src/commands/plan.test.ts`

## Dependencies

```
110 ──────┬──> 111 ──┐
          ├──> 112 ──┼──> 113
          │          │
114 ──────┼──> 115 ──┤
          │          │
116 ──────┼──> 117 ──┼──> 118
          │          │
          └──────────┘
```

- **110** (state types/manager), **114** (quick executor), **116** (plan parser) can all start in parallel (wave 1)
- **111** (state integration) depends on 110
- **112** (state command) depends on 110
- **113** (state template) depends on 110 + 112
- **115** (quick command) depends on 114
- **117** (plan executor) depends on 116
- **118** (plan command) depends on 116 + 117

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| STATE.md parsing fragility — markdown format changes break parser | Medium | High | Strict render/parse roundtrip tests, format versioning header |
| Quick mode scope too permissive — AI modifies unexpected files | Medium | Medium | Default forbidden list (`.env*`, `node_modules/`, `.git/`), `--full` enables ScopeGuard |
| Plan dependency cycles in user-authored plans | Low | Medium | Cycle detection with clear error messages pointing to the cycle |
| STATE.md grows beyond 150 lines — context bloat | Low | Low | Hard truncation in render(), drop resolved items first |
| Plan checkbox update conflicts with user edits | Low | Medium | Read-modify-write with regex targeting specific lines, not full file rewrite |

## Success Criteria

- [ ] `aidf state` shows current project state; decisions/blockers persist across `aidf run` executions
- [ ] `aidf quick "fix typo in README"` executes in <30s with zero file artifacts (no task file created on disk)
- [ ] `aidf plan run .ai/plans/my-plan.md` executes tasks in correct wave order, skipping completed ones
- [ ] Re-running a plan after partial completion resumes from where it left off
- [ ] All existing tests pass (`pnpm test` green)
- [ ] `pnpm lint` and `pnpm typecheck` clean
- [ ] STATE.md is loaded as context layer and visible in context size estimation

## Notes

- STATE.md format is intentionally simple markdown — no YAML frontmatter, no XML. This makes it human-editable and AI-readable.
- Quick mode is designed to be the "git commit -m" of AIDF — the thing you reach for 80% of the time for small changes.
- Plan-driven execution builds on existing `ParallelExecutor` — we're adding orchestration on top, not replacing the execution engine.
- The plan parser supports both explicit waves (`wave: 2`) and implicit waves (inferred from `depends:` declarations). This gives users flexibility.
