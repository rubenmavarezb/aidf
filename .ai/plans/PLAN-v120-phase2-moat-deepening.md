# PLAN: v1.2.0 — Phase 2: Moat Deepening (Context Freshness + Research Pipeline + Smart Waves)

## Overview

Phase 2 addresses the technical moat: solving context rot (GSD's primary selling point) with multi-provider support, creating a structured research-to-implementation pipeline, and making wave execution intelligent with result forwarding. These features transform AIDF from a task runner into a context-aware orchestration engine.

## Goals

- Implement context freshness per wave — each wave starts with a clean context plus compressed summaries from prior waves
- Create a research task type with structured findings that feed into subsequent implementation tasks
- Upgrade `ParallelExecutor` with inter-wave result forwarding, explicit `creates/needs` dependencies, and inter-wave verification
- All features build on Phase 1 infrastructure (STATE.md, PlanExecutor, ParallelExecutor)

## Non-Goals

- Changing the provider interface or adding new providers
- Multi-model profiles (Phase 3)
- Brownfield codebase mapping (Phase 3)
- Post-execution verification loops (Phase 3)
- Modifying the core `ExecutionPhase` iteration loop internals

## Tasks

### Phase 1: Task Summaries — The Foundation for Context Freshness

Before context can be refreshed between waves, we need a way to compress task results into portable summaries that can be injected into future contexts.

- [ ] `120-task-summary-system.md` — Implement task summary generation and persistence (wave: 1)

  **Types to add in `types/index.ts`:**
  ```typescript
  export interface TaskSummary {
    taskPath: string;
    taskName: string;
    status: 'completed' | 'blocked' | 'failed';
    filesModified: string[];
    filesCreated: string[];
    decisions: string[];       // Extracted from AI output
    keyChanges: string[];      // One-liner per significant change
    warnings: string[];        // Issues encountered
    iterations: number;
    completedAt: string;
  }

  export interface WaveSummary {
    wave: number;
    tasks: TaskSummary[];
    totalFilesModified: string[];
  }
  ```

  **New file `packages/cli/src/core/summary-generator.ts`:**
  - `SummaryGenerator` class:
    - `generateFromResult(taskPath: string, result: ExecutorResult, aiOutput?: string): TaskSummary`
      - Extracts decisions from AI output (patterns: "I decided", "chose X over Y", "using X because")
      - Extracts key changes from git diff summary
      - Separates created vs modified files
    - `renderMarkdown(summary: TaskSummary): string` — compact markdown (target: 20-30 lines max)
    - `renderForPrompt(summaries: TaskSummary[]): string` — format optimized for injection into AI prompts
    - `save(summary: TaskSummary, dir: string): Promise<void>` — saves to `.ai/summaries/{taskName}.summary.md`
    - `loadAll(dir: string): Promise<TaskSummary[]>` — loads all summaries from directory
    - `buildWaveSummary(wave: number, summaries: TaskSummary[]): WaveSummary`

  **Changes to `phases/postflight.ts`:**
  - After task completion, generate and save a TaskSummary
  - Summary saved to `.ai/summaries/` directory

  **Scope:** `packages/cli/src/core/summary-generator.ts`, `packages/cli/src/core/phases/postflight.ts`, `packages/cli/src/types/index.ts`
  **Tests:** `packages/cli/src/core/summary-generator.test.ts` — decision extraction, markdown rendering, prompt rendering, file separation, save/load roundtrip

### Phase 2: Context Freshness Per Wave

The core anti-context-rot mechanism: each wave in parallel execution starts with a fresh context that includes only base context + compressed summaries from prior waves.

- [ ] `121-context-loader-summaries.md` — Extend ContextLoader to accept and inject previous wave summaries (wave: 2, depends: 120)

  **Changes to `context-loader.ts`:**
  - Add optional `previousSummaries?: TaskSummary[]` parameter to `loadContext()`
  - When summaries are provided, inject them as a `## Previous Results` section in the context
  - Position in context: after STATE.md, before task-specific content
  - Add `previousResults: number` to `ContextBreakdown`
  - `estimateContextSize()` includes previous results in calculation

  **Changes to `LoadedContext` type:**
  - Add `previousResults?: string` field (rendered summary text)

  **Scope:** `packages/cli/src/core/context-loader.ts`, `packages/cli/src/types/index.ts`
  **Tests:** Update context-loader tests — verify summaries are included in context, token estimation includes them

- [ ] `122-fresh-context-waves.md` — Implement context refresh between waves in ParallelExecutor and PlanExecutor (wave: 3, depends: 120, 121)

  **Changes to `parallel-executor.ts`:**
  - After each wave completes, collect `TaskSummary` objects from completed tasks
  - Accumulate summaries across waves: wave 2 sees wave 1 summaries, wave 3 sees wave 1+2 summaries
  - Pass accumulated summaries to `executeTask()` via a new `previousSummaries` option in `ExecutorOptions`
  - Each task in wave N gets a fresh context (no session continuation from wave N-1)

  **Changes to `ExecutorOptions` type:**
  - Add `previousSummaries?: TaskSummary[]`

  **Changes to `phases/preflight.ts`:**
  - When `options.previousSummaries` is provided, pass them to `contextLoader.loadContext()`

  **Changes to `plan-executor.ts`** (from Phase 1):
  - PlanExecutor already runs waves sequentially — now after each wave, collect summaries and pass to next wave
  - Log context freshness: "Wave 2: fresh context + 3 task summaries from wave 1"

  **Scope:** `packages/cli/src/core/parallel-executor.ts`, `packages/cli/src/core/plan-executor.ts`, `packages/cli/src/core/phases/preflight.ts`, `packages/cli/src/types/index.ts`
  **Tests:** Update parallel-executor tests — verify summaries are collected and forwarded, verify context is fresh per wave

### Phase 3: Research Task Pipeline

A structured research-to-implementation flow: research tasks produce findings, implementation tasks consume them as context.

- [ ] `123-research-task-type.md` — Add `research` task type with structured output handling (wave: 1)

  **Changes to `types/index.ts`:**
  - Add `'research'` to `ParsedTask.taskType` union: `'component' | 'refactor' | 'test' | 'docs' | 'architecture' | 'bugfix' | 'research'`
  - Add to `ContextLoader.extractTaskType()` valid types list

  **New file `templates/.ai/templates/tasks/research.template.md`:**
  ```markdown
  # TASK: Research — [Topic]

  ## Goal

  Investigate [topic] and produce structured findings to inform implementation decisions.

  ## Task Type
  research

  ## Suggested Roles
  - architect

  ## Scope

  ### Allowed
  - `.ai/research/**`

  ### Forbidden
  - `src/**`
  - `packages/**`

  ## Requirements

  - Investigate [aspect 1]
  - Investigate [aspect 2]
  - Compare approaches: [A vs B vs C]

  ## Output Format

  Produce a findings file at `.ai/research/[topic]-findings.md` with:

  ### Required Sections
  - **Summary** — Executive summary (3-5 bullet points)
  - **Recommendations** — Prescriptive ("Use X") not exploratory ("Consider X or Y")
  - **Comparison** — If multiple approaches, include decision matrix
  - **Pitfalls** — Common mistakes and how to avoid them
  - **References** — URLs and sources with confidence levels (HIGH/MEDIUM/LOW)

  ## Definition of Done

  - [ ] Findings file created at `.ai/research/[topic]-findings.md`
  - [ ] All required sections present with substantive content
  - [ ] At least one HIGH-confidence recommendation
  - [ ] No source code modified (research only)
  ```

  **Scope:** `packages/cli/src/types/index.ts`, `packages/cli/src/core/context-loader.ts`, `templates/.ai/templates/tasks/research.template.md`
  **Tests:** Update context-loader tests for new task type

- [ ] `124-research-findings-loader.md` — Load research findings as context for implementation tasks (wave: 2, depends: 123)

  **Changes to `context-loader.ts`:**
  - Add `loadResearchFindings(aiDir: string): Promise<string[]>` — scans `.ai/research/*.md` for findings files
  - Add optional `researchFindings?: string[]` to `LoadedContext` (array of raw markdown content)
  - When loading context for non-research tasks, check if `.ai/research/` has findings and include them
  - Add `research: number` to `ContextBreakdown`
  - Only include findings relevant to the current task (match by keywords in task goal vs findings filenames)

  **Changes to task template format (documentation, no code change):**
  - Tasks can reference specific findings: `## Research Context\n- .ai/research/auth-findings.md`
  - If `## Research Context` section exists in task, only load those specific findings
  - If no section, load all findings (backward compatible)

  **Scope:** `packages/cli/src/core/context-loader.ts`, `packages/cli/src/types/index.ts`
  **Tests:** Update context-loader tests — findings loading, keyword matching, explicit reference loading

- [ ] `125-research-skill.md` — Add built-in researcher skill for AI guidance during research tasks (wave: 1)

  **New file `templates/.ai/skills/SKILL-researcher.md`:**
  ```yaml
  ---
  name: aidf-architect
  description: Research and investigation skill for structured findings
  version: 1.0.0
  tags: [research, analysis, investigation]
  ---
  ```
  Content sections:
  - **Research Protocol**: verify before asserting, date claims, prefer current sources, honestly report uncertainty
  - **Source Hierarchy**: official docs (HIGH) > multiple sources agreeing (MEDIUM) > single unverified (LOW)
  - **Output Format**: mandatory sections (Summary, Recommendations, Comparison, Pitfalls, References)
  - **Anti-Patterns**: avoid padding ("I couldn't find X" > fabricating), avoid presenting training data as fact
  - **Verification Checklist**: all domains investigated, negative claims verified, URLs provided, confidence assigned

  **Scope:** `templates/.ai/skills/SKILL-researcher.md`
  **Tests:** Verify skill loads without security warnings via existing skill-loader tests

### Phase 4: Smart Wave Execution

Upgrade ParallelExecutor with explicit dependency declarations, inter-wave verification, and richer result propagation.

- [ ] `126-explicit-task-dependencies.md` — Support `creates/needs` declarations in task files for richer dependency detection (wave: 2, depends: 120)

  **Changes to task file parsing in `context-loader.ts`:**
  - Parse new optional sections in task files:
    ```markdown
    ## Creates
    - `src/auth/jwt.ts`
    - `src/auth/middleware.ts`

    ## Needs
    - `src/config/database.ts`
    - `.ai/research/auth-findings.md`
    ```
  - Add to `ParsedTask`:
    ```typescript
    creates?: string[];  // Files/artifacts this task produces
    needs?: string[];    // Files/artifacts this task requires
    ```

  **Changes to `parallel-executor.ts`:**
  - `detectDependencies()` enhanced: in addition to scope overlap, check if task A `creates` something that task B `needs`
  - Dependency reason now distinguishes: "scope overlap" vs "A creates X which B needs"
  - `buildExecutionOrder()` uses `needs/creates` for topological sort when available, falls back to scope overlap

  **Scope:** `packages/cli/src/core/context-loader.ts`, `packages/cli/src/core/parallel-executor.ts`, `packages/cli/src/types/index.ts`
  **Tests:** Update parallel-executor tests — creates/needs detection, mixed dependency types, topological ordering

- [ ] `127-inter-wave-verification.md` — Add verification step between waves to catch failures early (wave: 3, depends: 122, 126)

  **Changes to `parallel-executor.ts`:**
  - After each wave completes, run inter-wave verification:
    1. **File existence check**: verify all `creates` files from completed tasks exist on disk
    2. **Validation check**: run pre-commit validation commands if any code files were modified
    3. **Summary check**: verify all tasks in the wave produced summaries
  - If verification fails: log detailed report, mark wave as partially failed
  - New option: `interWaveVerification: boolean` (default: true)
  - Verification results included in `PlanWaveResult`

  **Changes to `PlanExecutorOptions`:**
  - Add `interWaveVerification?: boolean`

  **Types to add:**
  ```typescript
  export interface WaveVerificationResult {
    passed: boolean;
    missingFiles: string[];     // Expected creates that don't exist
    validationErrors: string[]; // Pre-commit failures
    missingSummaries: string[]; // Tasks without summaries
  }
  ```

  **Scope:** `packages/cli/src/core/parallel-executor.ts`, `packages/cli/src/core/plan-executor.ts`, `packages/cli/src/types/index.ts`
  **Tests:** Verify file existence checks, validation between waves, graceful handling of missing summaries

### Phase 5: Dedicated Integration & E2E Tests

- [ ] `165-v120-moat-deepening-tests.md` — Integration and E2E tests for all three feature areas. **Context freshness** (8 tests): TaskSummary generation, markdown rendering, prompt rendering, save/load roundtrip, wave accumulation, context with summaries, context size estimation, summary cap. **Research pipeline** (6 tests): research task type parsing, findings loading, keyword matching, explicit reference, research skill loading, scope enforcement. **Inter-wave verification** (6 tests): file existence check pass/fail, creates/needs dependency detection, mixed dependency types, validation between waves, missing summary handling. **20+ test cases total.**

## Dependencies

```
120 ──────┬──> 121 ──> 122
          │
          ├──> 126 ──> 127
          │
123 ──────┼──> 124
          │
125 ──────┘
```

- **120** (summaries), **123** (research type), **125** (research skill) can all start in parallel (wave 1)
- **121** (context + summaries) depends on 120
- **122** (fresh context waves) depends on 120 + 121
- **124** (findings loader) depends on 123
- **126** (explicit dependencies) depends on 120 (needs summary infrastructure)
- **127** (inter-wave verification) depends on 122 + 126

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Summary generation quality — AI output parsing is unreliable | High | Medium | Conservative extraction (only clear patterns), fallback to file-diff-based summary |
| Context size bloat from accumulated summaries | Medium | Medium | Hard cap: max 5 summaries injected (most recent waves), each summary max 30 lines |
| Research findings irrelevant to task — keyword matching too broad | Medium | Low | Explicit `## Research Context` in task files takes precedence over auto-matching |
| Inter-wave verification false positives — validation fails on intermediate state | Medium | Medium | Only run full validation on final wave, light checks (file existence) on intermediate |
| `creates/needs` adoption friction — users don't fill these in | High | Low | These are optional enhancements, scope overlap detection still works as fallback |

## Success Criteria

- [ ] Wave 2 tasks in a plan execution receive compressed summaries from wave 1 tasks as context
- [ ] Context utilization per wave stays under 50% (measured by `estimateContextSize()`)
- [ ] `aidf run .ai/tasks/research-auth.md` produces `.ai/research/auth-findings.md` with required sections
- [ ] Subsequent implementation task loads relevant research findings automatically
- [ ] Inter-wave verification catches missing `creates` files and reports clearly
- [ ] All existing tests pass, new features have >80% test coverage
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm build` clean

## Notes

- Context freshness is AIDF's unique competitive advantage over GSD: we support it across all 4 providers (claude-cli, cursor-cli, anthropic-api, openai-api), not just Claude Code's Task() tool.
- The summary system is the linchpin — it enables both context freshness (Phase 2) and smart waves (Phase 4). Getting the format right is critical.
- Research findings are stored as plain markdown in `.ai/research/` — version controlled, human-readable, AI-consumable. No proprietary format.
- The `creates/needs` mechanism is intentionally optional. Most users will rely on scope overlap detection. Power users get richer dependency graphs.
