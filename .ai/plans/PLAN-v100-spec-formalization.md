# PLAN: v1.0.0 — AIDF Spec Formalization

## Status: DRAFT

## Overview

AIDF currently works as a framework with implicit conventions — task files are parsed with regex, plans have no data model, roles have no frontmatter, and the `.ai/` folder structure is documented only through templates and code behavior. This makes AIDF fragile to consume from external tools (like DitLoop, VS Code extensions, or future IDE integrations) because the "spec" lives inside TypeScript parsing code, not in a portable, versionable format.

This plan formalizes AIDF into a **versioned spec** that any tool can implement without depending on the AIDF CLI. The spec consists of:

1. **An `@aidf/spec` package** (lightweight NPM package with types + schemas, no CLI deps — ships first to unblock external consumers)
2. **A documented Context Bundle format** (the standard prompt text injected into AI tools — critical for any tool that launches AI CLIs)
3. **YAML frontmatter** in tasks and plans (machine-parseable metadata + human-readable markdown body)
4. **JSON Schemas** for every AIDF file type (tasks, roles, plans, config, AGENTS.md)
5. **A `ParsedPlan` data model** (plans are currently raw strings with no structured parsing)
6. **A complete task status lifecycle** (`planned → in_progress → completed | blocked | cancelled`)
7. **Task dependency support** (`depends_on` field linking tasks)
8. **Migration tooling** (`aidf migrate` to convert existing `.ai/` folders to the new format)
9. **`.ai/` folder discovery rules** (documented spec for how tools find and identify AIDF projects)
10. **Template variable syntax standardization** (`{{variable}}` Handlebars-style, replacing `[PLACEHOLDER]`)

The guiding principle: **AIDF remains a standalone CLI framework.** Any project can `npm i -g aidf && aidf init` and use it without any IDE, without DitLoop, without anything else. The spec formalization makes AIDF *also* consumable by external tools, but the CLI experience stays the same.

## Goals

- Publish `@aidf/spec` as a standalone NPM package with types and schemas (first deliverable — unblocks external consumers immediately).
- Document and export a Context Bundle format for AI prompt injection (critical for any tool that launches AI CLIs).
- Define a versioned AIDF Spec (v1) with JSON Schemas for all file types.
- Migrate task files from section-only markdown to YAML frontmatter + markdown body.
- Migrate plan files to YAML frontmatter with structured phase/task references.
- Add a `ParsedPlan` interface and plan parser to the context loader.
- Formalize the task status lifecycle with explicit states and transitions.
- Add `depends_on` and `priority` fields to tasks.
- Standardize template variable syntax to `{{variable}}` (Handlebars-style, replacing `[PLACEHOLDER]`).
- Define `.ai/` folder discovery rules (root-only, detection heuristics, required marker files).
- Provide `aidf migrate` command for existing projects.
- Maintain backward compatibility: the CLI must still parse old-format files during a transition period.

## Non-Goals

- Changing how the executor loop works — that's covered by PLAN-v080-executor-refactor.
- Adding UI/IDE features to AIDF CLI — that's DitLoop's domain.
- Implementing event hooks or lifecycle callbacks — that can come in a future version after the spec is stable.
- Forcing all existing AIDF users to migrate immediately — old format works during v1.0.x with deprecation warnings.
- Building a schema registry or online spec hosting — just files in the repo for now.

## Tasks

### Phase 1: @aidf/spec Package + Context Bundle (Unblocks External Consumers)

The `@aidf/spec` package and Context Bundle format ship **first** — before schemas, before frontmatter migration. This gives external consumers (like DitLoop) something to import immediately while the rest of the spec evolves.

- [ ] `163-create-spec-package-types-only.md` — Create the `@aidf/spec` NPM package with TypeScript types extracted from the CLI. Initially contains only types (no JSON Schemas yet — those come in Phase 2). Zero runtime dependencies.

  **Files to create:**
  - `packages/spec/package.json` — Name: `@aidf/spec`, version: `0.1.0`, zero runtime deps
  - `packages/spec/src/index.ts` — Re-exports all type interfaces
  - `packages/spec/src/types/task.ts` — `TaskFrontmatter`, `TaskStatus`, `TaskPriority`, `TaskScope` (extended with `constraints?: string[]`), `ParsedTask`
  - `packages/spec/src/types/plan.ts` — `PlanFrontmatter`, `PlanPhase`, `PlanStatus`, `ParsedPlan`
  - `packages/spec/src/types/role.ts` — `ParsedRole`
  - `packages/spec/src/types/agents.ts` — `ParsedAgents`
  - `packages/spec/src/types/config.ts` — `AidfConfig`, `ProviderConfig`, `ExecutionConfig`, `PermissionsConfig`, etc.
  - `packages/spec/src/types/skill.ts` — `SkillMetadata`, `LoadedSkill`
  - `packages/spec/src/types/context.ts` — `LoadedContext`, `ContextBundleOptions`
  - `packages/spec/tsconfig.json` — Strict, declaration: true, declarationMap: true
  - `packages/spec/tsup.config.ts` — ESM + CJS dual output

  **New types to define (not in CLI today):**
  ```typescript
  // Task status lifecycle
  type TaskStatus = 'planned' | 'in_progress' | 'completed' | 'blocked' | 'failed' | 'cancelled';
  type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
  type PlanStatus = 'draft' | 'active' | 'completed' | 'cancelled';

  // Task frontmatter (new — will be used by parser in Phase 3)
  interface TaskFrontmatter {
    id: string;
    title: string;
    type: 'component' | 'refactor' | 'test' | 'docs' | 'architecture' | 'bugfix';
    status: TaskStatus;
    priority?: TaskPriority;          // default: 'medium'
    version?: string;                 // links to plan version
    phase?: number;                   // phase within plan
    depends_on?: string[];            // task IDs
    roles?: string[];                 // role names
    scope?: TaskScope;                // TaskScope extended: { allowed, forbidden, ask_before, constraints }
    tags?: string[];
    created?: string;                 // ISO date
  }

  // Plan frontmatter (new)
  interface PlanFrontmatter {
    title: string;
    version: string;
    status: PlanStatus;
    phases?: PlanPhase[];
    created?: string;
  }
  interface PlanPhase {
    name: string;
    tasks: string[];
  }

  // ParsedPlan (new — plans are raw strings today)
  interface ParsedPlan {
    filePath: string;
    frontmatter: PlanFrontmatter;
    overview: string;
    goals: string[];
    nonGoals?: string[];
    risks?: string[];
    successCriteria: string[];
    raw: string;
  }
  ```

  **Files to modify:**
  - Root `pnpm-workspace.yaml` — Add `packages/spec`
  - `packages/cli/package.json` — Add `@aidf/spec: workspace:*` as dependency
  - `packages/cli/src/types/index.ts` — Import shared types from `@aidf/spec`, re-export for full backward compat. Existing code that imports from `types/index.ts` keeps working unchanged.

  **Testing requirements:**
  - Package builds successfully with `tsup`
  - All types are importable from `@aidf/spec`
  - CLI still compiles and all 613+ tests pass after types migration
  - Zero runtime dependencies verified (`npm pack --dry-run` shows no deps)
  - Types are correctly available in both ESM and CJS consumers

- [ ] `164-define-context-bundle-format.md` — Document the Context Bundle format and implement `buildContextBundle()`. This is the standard prompt text that any tool (AIDF CLI, DitLoop, future consumers) injects into AI tools when launching them with AIDF context. Ships as P0 because DitLoop TUI needs it immediately for its "Launch AI CLI" feature.

  **Context Bundle structure:**
  ```markdown
  # AI Development Context
  > Auto-generated by AIDF v{{version}}. Do not edit manually.

  ## Role: {{role.name}}
  {{role.identity}}

  ### Expertise
  {{role.expertise as bullets}}

  ### Constraints
  {{role.constraints as bullets}}

  ## Task: {{task.id}} — {{task.title}}

  ### Goal
  {{task.goal}}

  ### Scope
  **Allowed:** {{task.scope.allowed}}
  **Forbidden:** {{task.scope.forbidden}}

  ### Requirements
  {{task.requirements}}

  ### Definition of Done
  {{task.definitionOfDone as checklist}}

  ## Plan Context: {{plan.title}} (v{{plan.version}})
  **Current phase:** {{phase.name}}
  **Completed tasks:** {{list}}
  **Remaining tasks:** {{list}}

  ## Project Context
  {{agents.projectOverview}}

  ### Architecture
  {{agents.architecture}}

  ### Conventions
  {{agents.conventions}}

  ### Boundaries
  {{agents.boundaries}}

  ## Skills
  {{active skills content}}
  ```

  **Files to create:**
  - `spec/v1/context-bundle.md` — Format documentation with all sections, which are required vs optional, and examples
  - `packages/cli/src/core/context-builder.ts` — Extract prompt building logic from providers into a standalone, testable module:
    ```typescript
    export function buildContextBundle(context: LoadedContext, options?: ContextBundleOptions): string
    export function buildIterationPrompt(context: LoadedContext, iteration: number, previousOutput?: string): string
    ```
  - `packages/spec/src/types/context.ts` — Add `ContextBundleOptions` type:
    ```typescript
    interface ContextBundleOptions {
      includeSkills?: boolean;    // default: true
      includePlan?: boolean;      // default: true
      maxLength?: number;         // optional token/char cap
      format?: 'markdown' | 'xml'; // default: 'markdown'
    }
    ```

  **Files to modify:**
  - `packages/cli/src/core/providers/claude-cli.ts` — Replace inline `buildIterationPrompt()` with import from context-builder
  - `packages/cli/src/core/providers/cursor-cli.ts` — Same
  - `packages/cli/src/core/providers/anthropic-api.ts` — Use `buildContextBundle()` for system message construction
  - `packages/cli/src/core/providers/openai-api.ts` — Same

  **Testing requirements:**
  - `buildContextBundle()` produces correct output for a full context
  - `buildContextBundle()` handles missing optional sections (no plan, no skills)
  - `buildIterationPrompt()` produces correct output for iteration 1 vs subsequent
  - All providers produce the same context for the same input (regression test)
  - Output matches the documented Context Bundle format

- [ ] `165-define-discovery-rules.md` — Define the `.ai/` folder discovery rules. Any tool that wants to detect AIDF projects needs to know: where to look, what constitutes a valid `.ai/` folder, and what the marker files are.

  **Discovery rules:**
  1. **Location**: `.ai/` folder MUST be at the root of the repository (same level as `.git/`). Nested `.ai/` folders are not supported.
  2. **Detection heuristic**: A directory is an AIDF project if it contains `.ai/AGENTS.md` OR `.ai/config.yml` (either is sufficient).
  3. **Marker file priority**: If both exist, `AGENTS.md` is the primary marker. If only `config.yml` exists, the project is "config-only" (no roles/tasks, just execution settings).
  4. **Multiple `.ai/` in parent directories**: Walk up from cwd, use the first `.ai/` found (same as current `findAiDir()` behavior). Do NOT merge `.ai/` folders from parent directories.
  5. **Monorepo handling**: Each workspace/package can have its own `.ai/` folder. There is no "root .ai/" that governs all sub-packages (unlike `.git/` which is repo-wide).

  **Files to create:**
  - `spec/v1/discovery.md` — Discovery rules documentation
  - Add discovery rules to `spec/v1/README.md` (task 169)

  **Files to modify:**
  - `packages/spec/src/types/discovery.ts` — Add types:
    ```typescript
    interface AidfProjectInfo {
      aiDir: string;            // absolute path to .ai/
      projectRoot: string;      // parent of .ai/
      hasAgents: boolean;       // AGENTS.md exists
      hasConfig: boolean;       // config.yml exists
      hasRoles: boolean;        // roles/ directory exists
      hasTasks: boolean;        // tasks/ directory exists
      hasPlans: boolean;        // plans/ directory exists
      hasSkills: boolean;       // skills/ directory exists
    }
    ```

  **Testing requirements:**
  - Discovery rules documented with examples
  - `AidfProjectInfo` type covers all detection cases

### Phase 2: Spec Definition (JSON Schemas)

- [ ] `166-define-task-frontmatter-schema.md` — Define the YAML frontmatter schema for task files. Create `spec/v1/task.schema.json` with JSON Schema draft-2020-12. Uses the `TaskFrontmatter` type defined in task 163.

  **Frontmatter fields:**
  ```yaml
  ---
  id: "080"                    # string, unique within project
  title: "Extract PreFlight"   # string, human-readable name
  type: refactor               # enum: component | refactor | test | docs | architecture | bugfix
  status: planned              # enum: planned | in_progress | completed | blocked | cancelled
  priority: medium             # enum: low | medium | high | critical (default: medium)
  version: "0.8.0"             # semver string, optional — links to plan version
  phase: 1                     # integer, optional — phase within plan
  depends_on: []               # array of task ID strings
  roles: [developer]           # array of role names
  scope:
    allowed: [packages/cli/src/core/executor.ts]
    forbidden: [packages/cli/src/commands/]
    ask_before: []             # optional
    constraints: []            # semantic scope for AI — e.g. "do not change public API signatures"
  tags: [executor, refactor]   # array of strings, optional
  created: "2026-02-17"        # ISO date string, optional
  ---
  ```

  **Body sections (after frontmatter, documented but not schema-enforced):**
  - `## Goal` (required)
  - `## Requirements` (required)
  - `## Definition of Done` (required, checklist format)
  - `## Notes` (optional)
  - `## Status` (written by executor, not by humans)

  **Files to create:**
  - `spec/v1/task.schema.json` — JSON Schema
  - `packages/spec/src/schemas/task.schema.json` — Copy for package distribution

  **Testing requirements:**
  - Schema validates a correct frontmatter block
  - Schema rejects missing required fields (`id`, `title`, `type`, `status`)
  - Schema rejects invalid enum values
  - Schema accepts optional fields being absent

- [ ] `167-define-plan-frontmatter-schema.md` — Define the YAML frontmatter schema for plan files. Create `spec/v1/plan.schema.json`. Uses the `PlanFrontmatter` type defined in task 163.

  **Frontmatter fields:**
  ```yaml
  ---
  title: "Executor Refactor"
  version: "0.8.0"
  status: draft                # enum: draft | active | completed | cancelled
  phases:
    - name: "Analysis"
      tasks: ["080", "081"]
    - name: "Core Extraction"
      tasks: ["082", "083", "084"]
  created: "2026-02-17"
  ---
  ```

  **Body sections:**
  - `## Overview` (required)
  - `## Goals` (required)
  - `## Non-Goals` (optional)
  - `## Tasks` (required — detailed task descriptions organized by phase)
  - `## Dependencies` (optional)
  - `## Risks` (optional)
  - `## Success Criteria` (required)

  **Files to create:**
  - `spec/v1/plan.schema.json`
  - `packages/spec/src/schemas/plan.schema.json`

  **Testing requirements:**
  - Schema validates correct plan frontmatter
  - Schema rejects plans without `title` or `version`
  - Phases array validates structure (name + tasks)

- [ ] `168-define-role-schema.md` — Define JSON Schema for role files. Roles keep their current section-based format (no frontmatter migration needed — roles are simple and stable), but document the expected structure formally.

  **Files to create:**
  - `spec/v1/role.schema.json` — Documents required sections: `## Identity`, `## Expertise`, `## Responsibilities`, `## Constraints`, `## Quality Criteria`; optional: `## Output Format`
  - `packages/spec/src/schemas/role.schema.json`
  - No type changes needed — `ParsedRole` is already well-defined

  **Testing requirements:**
  - Schema validates a correct role file structure
  - Schema documents optional vs required sections

- [ ] `169-define-config-schema.md` — Export the existing Zod schema as JSON Schema. The Zod schema in `utils/config.ts` is the source of truth; generate a JSON Schema from it for external consumers.

  **Files to create:**
  - `spec/v1/config.schema.json` — Generated from Zod schema using `zod-to-json-schema`
  - `packages/spec/src/schemas/config.schema.json`
  - Add `zod-to-json-schema` as a dev dependency
  - Create a build script `scripts/generate-config-schema.ts` that reads the Zod schema and writes the JSON Schema file

  **Testing requirements:**
  - Generated schema validates the example config.yml from templates
  - Generated schema rejects invalid provider types
  - Schema stays in sync with Zod (CI check)

- [ ] `170-define-agents-schema.md` — Define JSON Schema for AGENTS.md structure. Documents required and optional sections.

  **Files to create:**
  - `spec/v1/agents.schema.json` — Documents required sections (`## Project Overview`, `## Architecture`, `## Technology Stack`, `## Conventions`, `## Quality Standards`, `## Boundaries`, `## Commands`) and their subsection structure
  - `packages/spec/src/schemas/agents.schema.json`
  - Fix the template/parser mismatch: AGENTS.template.md has `### NEVER Do` but parser looks for `### Never Do` and `### Never Modify Without Approval`. Align both to the same naming.

  **Testing requirements:**
  - Schema validates the distributed AGENTS.template.md
  - Document the template/parser mismatch fix

- [ ] `171-spec-readme.md` — Create the spec overview document that ties everything together.

  **Files to create:**
  - `spec/v1/README.md` — The AIDF Spec v1 document covering:
    - `.ai/` folder discovery rules (from task 165)
    - `.ai/` folder structure (required/optional files)
    - File format for each type (task, plan, role, AGENTS.md, config.yml, SKILL.md)
    - Links to each JSON Schema
    - Task status lifecycle state machine
    - Context Bundle format reference (from task 164)
    - Template variable syntax (`{{variable}}`)
    - Versioning policy (spec version independent of CLI version)
  - `spec/v1/CHANGELOG.md` — Initial entry for v1.0.0

  **Testing requirements:**
  - All JSON Schema files referenced in README exist
  - All example snippets in README are valid against their schemas

### Phase 3: Parser Migration (Frontmatter Support)

- [ ] `172-implement-frontmatter-parser.md` — Create a generic YAML frontmatter parser utility that extracts frontmatter from markdown files. This replaces the need for a full YAML library — use the same line-by-line approach as skill-loader but generalized.

  **Files to create:**
  - `packages/cli/src/utils/frontmatter.ts` — Exports:
    ```typescript
    interface ParsedFrontmatter<T> {
      frontmatter: T;
      body: string;     // markdown after the closing ---
      raw: string;      // original full content
    }
    function parseFrontmatter<T>(content: string, schema?: ZodSchema<T>): ParsedFrontmatter<T>
    ```
  - Handles: string values, number values, arrays (both inline `[a, b]` and multiline `- a\n- b`), nested objects (scope.allowed), boolean values, quoted strings, ISO dates
  - If schema is provided, validate frontmatter against it (Zod). If not, return raw key-value pairs.
  - If no frontmatter block found (`---` delimiters), return `frontmatter: null` and full content as `body` — this enables backward compatibility.

  **Testing requirements:**
  - Parses standard YAML frontmatter correctly
  - Handles nested objects (scope.allowed, scope.forbidden)
  - Handles arrays (depends_on, roles, tags)
  - Returns null frontmatter when no `---` block present
  - Validates against Zod schema when provided
  - Rejects malformed frontmatter gracefully (returns null, logs warning)

- [ ] `173-migrate-task-parser.md` — Update `context-loader.ts` to support both old format (section-only) and new format (frontmatter + sections). The parser should auto-detect which format is used.

  **Detection logic:**
  ```
  if file starts with "---\n" → parse as frontmatter format
  else → parse as legacy section format (existing code)
  ```

  **Files to modify:**
  - `packages/cli/src/core/context-loader.ts` — Modify `parseTask()`:
    1. Try frontmatter parsing first
    2. If frontmatter found, map `TaskFrontmatter` fields to `ParsedTask` fields
    3. Extract body sections (`## Goal`, `## Requirements`, `## Definition of Done`) from the body after frontmatter
    4. If no frontmatter, fall back to existing section-based parsing (full backward compat)
    5. Log a deprecation warning when legacy format is detected: "Task file uses legacy format. Run `aidf migrate` to upgrade."
  - Types already defined in `@aidf/spec` (task 163) — import from there

  **Testing requirements:**
  - New format tasks parse correctly with all frontmatter fields
  - Old format tasks still parse correctly (backward compat)
  - Mixed project (some old, some new format) works
  - Deprecation warning logged for old format
  - Missing optional frontmatter fields default correctly
  - `ParsedTask` has all new fields available

- [ ] `174-implement-plan-parser.md` — Add plan parsing to context-loader. Plans currently load as raw strings from `IMPLEMENTATION_PLAN.md`. Add structured parsing with frontmatter support and update the loader to scan the `plans/` directory.

  **Files to modify:**
  - `packages/cli/src/core/context-loader.ts` — Add `parsePlan(filePath: string): ParsedPlan` method:
    1. Parse frontmatter (title, version, status, phases)
    2. Extract body sections (Overview, Goals, Non-Goals, Risks, Success Criteria)
    3. Return `ParsedPlan` object (type from `@aidf/spec`)
  - `packages/cli/src/core/context-loader.ts` — Modify `loadPlanIfExists()`:
    1. First check for `plans/` directory and find the active plan (`status: active` in frontmatter)
    2. Fall back to `IMPLEMENTATION_PLAN.md` for backward compat
    3. Parse the found plan file with `parsePlan()`
  - Update `LoadedContext.plan` from `string | undefined` to `ParsedPlan | undefined`

  **Breaking change note:** Any code that reads `context.plan` as a string will need updating. Search for all usages and update them. The `raw` field on `ParsedPlan` provides the full text for providers that just need the string.

  **Testing requirements:**
  - Plans with frontmatter parse correctly
  - Plans without frontmatter fall back to raw string behavior
  - `loadPlanIfExists()` scans `plans/` directory and finds active plan
  - Multiple plans in `plans/` — only the active one is loaded
  - No plans in `plans/` + no `IMPLEMENTATION_PLAN.md` → returns undefined

- [ ] `175-update-executor-for-parsed-plans.md` — Update executor and providers to handle the new `ParsedPlan` type instead of raw string.

  **Files to modify:**
  - `packages/cli/src/core/executor.ts` — Update any reference to `context.plan` (was string, now ParsedPlan)
  - `packages/cli/src/core/providers/claude-cli.ts` — Update `buildIterationPrompt()` to use `plan.raw` or structured fields
  - `packages/cli/src/core/providers/anthropic-api.ts` — Same
  - `packages/cli/src/core/providers/openai-api.ts` — Same

  **Testing requirements:**
  - Executor works with new ParsedPlan
  - Executor works when plan is undefined
  - Prompt building uses plan context correctly

### Phase 4: Task Lifecycle & Dependencies

- [ ] `176-implement-task-status-lifecycle.md` — Formalize the task status lifecycle. Currently the executor writes `## Status: COMPLETED/BLOCKED/FAILED` into task files after execution. Add support for the full lifecycle and use frontmatter status when available.

  **Status lifecycle:**
  ```
  planned ──→ in_progress ──→ completed
     │             │
     │             ├──→ blocked ──→ in_progress (resume)
     │             │
     │             └──→ cancelled
     │
     └──→ cancelled
  ```

  **Files to modify:**
  - `packages/cli/src/core/executor.ts` — When starting a task:
    1. Read task frontmatter status
    2. If `planned`, update to `in_progress` (write frontmatter)
    3. On completion, update to `completed`
    4. On blocked, update to `blocked`
    5. On failure, update to `failed`
  - `packages/cli/src/utils/frontmatter.ts` — Add `updateFrontmatterField(filePath, field, value)` utility to modify a single frontmatter field in-place without rewriting the whole file

  **Testing requirements:**
  - Status transitions are correct for each outcome
  - Frontmatter status is updated in-place
  - Legacy files (no frontmatter) still get the `## Status:` section appended
  - Invalid transitions are rejected (e.g., `completed → in_progress`)

- [ ] `177-implement-task-dependencies.md` — Add dependency resolution support. When a task has `depends_on: ["080", "081"]`, verify those tasks are completed before allowing execution.

  **Files to modify:**
  - `packages/cli/src/core/context-loader.ts` — Add `loadTaskIndex(aiDir: string): Map<string, { status: TaskStatus, filePath: string }>` that scans all task files (pending, completed, blocked) and builds an index by ID
  - `packages/cli/src/core/executor.ts` — Before executing a task, check its `depends_on` list against the task index. If any dependency is not `completed`, report which tasks are blocking and exit with a clear message
  - `packages/cli/src/commands/run.ts` — Surface dependency errors to the user: "Task 082 depends on tasks 080, 081 which are not completed yet"

  **Testing requirements:**
  - Task with all deps completed → executes normally
  - Task with incomplete deps → blocks with clear message
  - Task with no deps → executes normally
  - Circular dependency detection (A depends on B, B depends on A) → error
  - Missing dependency (depends on task that doesn't exist) → warning, not error

- [ ] `178-implement-task-priority.md` — Add priority support for task ordering. Priority is informational in single-task execution but affects ordering in `aidf status` display and parallel execution.

  **Files to modify:**
  - `packages/cli/src/commands/status.ts` — Sort tasks by priority (critical first) then by ID
  - `packages/cli/src/core/parallel-executor.ts` — When selecting next task to execute, prefer higher priority tasks

  **Testing requirements:**
  - Priority parsed from frontmatter correctly
  - Default priority is `medium` when absent
  - Status command shows tasks sorted by priority
  - Parallel executor respects priority ordering

### Phase 5: Migration Tooling & Template Syntax

- [ ] `179-implement-migrate-command.md` — Add `aidf migrate` command that converts existing `.ai/` folders from the old section-only format to the new frontmatter format.

  **Migration steps:**
  1. Scan all task files in `tasks/` (including `pending/`, `completed/`, `blocked/`)
  2. For each task file without frontmatter:
     a. Extract metadata from sections (goal → title, task type → type, suggested roles → roles, scope → scope)
     b. Generate an ID from the filename (e.g., `080-extract-preflight.md` → id: `"080"`)
     c. Infer status from directory (`pending/` → planned, `completed/` → completed, `blocked/` → blocked)
     d. Write frontmatter block at the top of the file
     e. Keep all existing sections intact below the frontmatter
  3. Scan plan files in `plans/`
  4. For each plan without frontmatter:
     a. Extract title from `# PLAN:` heading
     b. Extract version from title
     c. Infer status from directory (`completed/` → completed, else → draft)
     d. Extract phase/task structure from `### Phase N:` sections
     e. Write frontmatter block
  5. Report migration summary: N tasks migrated, M plans migrated, K files skipped (already have frontmatter)

  **Files to create:**
  - `packages/cli/src/commands/migrate.ts` — The `aidf migrate` command
  - Register in `packages/cli/src/index.ts` command list

  **Flags:**
  - `--dry-run` — Show what would change without modifying files
  - `--backup` — Create `.bak` copies before modifying (default: true)

  **Testing requirements:**
  - Migration converts section-only tasks to frontmatter format
  - Migration converts plan files
  - Already-migrated files are skipped
  - `--dry-run` doesn't modify any files
  - `--backup` creates `.bak` files
  - Migrated files still parse correctly with the new parser
  - Migrated files still parse correctly with the old parser (frontmatter is invisible to section regex)

- [ ] `180-update-task-create-command.md` — Update the `aidf task create` command to generate tasks in the new frontmatter format by default.

  **Files to modify:**
  - `packages/cli/src/commands/task.ts` — Update `createTask()` to:
    1. Generate frontmatter block with id (auto-incremented), title, type, status: planned, priority, roles, scope
    2. Generate body sections (Goal, Requirements, Definition of Done)
    3. Use the task type templates as before but wrap with frontmatter

  **Files to modify (templates):**
  - `templates/.ai/templates/TASK.template.md` — Add frontmatter block
  - `templates/.ai/templates/tasks/*.template.md` — Add frontmatter blocks to all 6 type-specific templates

  **Testing requirements:**
  - `aidf task create` generates frontmatter format
  - Auto-generated ID is unique (scans existing tasks)
  - All task type templates include frontmatter
  - Created tasks parse correctly with the new parser

- [ ] `181-standardize-template-syntax.md` — Migrate all template files from `[PLACEHOLDER]` syntax to `{{variable}}` Handlebars-style syntax. This is the de facto standard used by Handlebars, Mustache, Jekyll, Hugo, and DitLoop. Small change, big interop win.

  **Files to modify:**
  - `templates/.ai/AGENTS.template.md` — Replace all `[PLACEHOLDER_NAME]` with `{{placeholder_name}}` (lowercase snake_case)
  - `templates/.ai/templates/TASK.template.md` — Same
  - `templates/.ai/templates/tasks/*.template.md` — Same for all 6 type-specific templates
  - `templates/.ai/templates/PLAN.template.md` — Same
  - `templates/.ai/AGENTS.template.md` — Also fix `### NEVER Do` / `### Never Modify Without Approval` naming to match parser expectations
  - `packages/cli/src/commands/init.ts` — If any template rendering logic references `[PLACEHOLDER]`, update to `{{variable}}`
  - `packages/cli/src/commands/task.ts` — Same for task creation

  **Standard variable names:**
  ```
  {{project_name}}, {{project_description}}, {{tech_stack}}
  {{task_name}}, {{task_goal}}, {{task_type}}, {{task_priority}}
  {{role_name}}, {{role_description}}
  {{plan_name}}, {{plan_version}}
  {{allowed_paths}}, {{forbidden_paths}}
  {{version}}, {{date}}
  ```

  **Testing requirements:**
  - All templates use `{{variable}}` syntax consistently
  - No `[PLACEHOLDER]` remains in any template
  - `aidf init` still works with updated templates
  - `aidf task create` still works with updated templates
  - Document the standard variable names in `spec/v1/README.md`

### Phase 6: Tests & Validation

- [ ] `182-test-json-schemas.md` — Validate all JSON Schemas against real AIDF files and edge cases.

  **Files to create:**
  - `packages/spec/src/__tests__/schemas.test.ts` — Tests:
    - All JSON Schemas are valid JSON Schema draft-2020-12
    - Each schema validates its corresponding template/example file
    - Each schema rejects known-invalid inputs
    - Config JSON Schema matches Zod schema behavior (generate test cases from both, compare results)

  **Testing requirements:**
  - Use `ajv` or similar for JSON Schema validation in tests
  - At least 5 valid + 5 invalid inputs per schema
  - Cross-validate config schema (Zod output vs JSON Schema output) for 20+ test cases

- [ ] `183-test-frontmatter-parser.md` — Comprehensive tests for the frontmatter parser.

  **Files to create:**
  - `packages/cli/src/utils/__tests__/frontmatter.test.ts` — Tests:
    - Basic key-value parsing
    - Nested objects (scope: { allowed: [...] })
    - Arrays (inline and multiline)
    - Quoted strings with special characters
    - Empty frontmatter
    - No frontmatter (returns null)
    - Malformed frontmatter (missing closing `---`)
    - Zod schema validation pass and fail
    - `updateFrontmatterField()` modifies single field in-place
    - Unicode content handling
    - Large frontmatter blocks (50+ fields)

- [ ] `184-test-migration-command.md` — Integration tests for the migrate command.

  **Files to create:**
  - `packages/cli/src/commands/__tests__/migrate.test.ts` — Tests:
    - Full migration of a mock `.ai/` folder with tasks in old format
    - Plan migration
    - Idempotency (migrating already-migrated files = no-op)
    - `--dry-run` produces correct report without modifications
    - `--backup` creates .bak files
    - Migrated files round-trip: write → parse → verify all fields preserved
    - Error handling: read-only files, corrupt files, missing directories

- [ ] `185-test-task-lifecycle.md` — Tests for the task status lifecycle and dependency resolution.

  **Files to create:**
  - `packages/cli/src/core/__tests__/task-lifecycle.test.ts` — Tests:
    - All valid status transitions
    - Invalid transitions rejected
    - Frontmatter status updated in-place
    - Dependency resolution: all deps met → proceed
    - Dependency resolution: unmet deps → block with message
    - Circular dependency detection
    - Missing dependency → warning
    - Task index builds correctly from mixed directories
    - Priority sorting in status command

- [ ] `186-test-context-builder.md` — Tests for the centralized context builder.

  **Files to create:**
  - `packages/cli/src/core/__tests__/context-builder.test.ts` — Tests:
    - Full context bundle matches documented format
    - Bundle with missing plan
    - Bundle with missing skills
    - Bundle with all optional fields present
    - Iteration prompt for iteration 1 vs iteration N
    - `maxLength` option truncates correctly
    - Plan context section uses structured fields (phase, completed tasks)
    - All providers produce identical context (regression test)

### Phase 7: Documentation

- [ ] `187-update-templates.md` — Update all distributed templates to the new frontmatter format. (Template syntax `{{variable}}` migration is handled in task 181.)

  **Files to modify:**
  - `templates/.ai/templates/TASK.template.md` — Add frontmatter block with `{{variable}}` placeholders
  - `templates/.ai/templates/tasks/bug-fix.template.md` — Add frontmatter (type: bugfix)
  - `templates/.ai/templates/tasks/new-feature.template.md` — Add frontmatter (type: component)
  - `templates/.ai/templates/tasks/refactor.template.md` — Add frontmatter (type: refactor)
  - `templates/.ai/templates/tasks/test-coverage.template.md` — Add frontmatter (type: test)
  - `templates/.ai/templates/tasks/documentation.template.md` — Add frontmatter (type: docs)
  - `templates/.ai/templates/tasks/dependency-update.template.md` — Add frontmatter (type: component)
  - `templates/.ai/templates/PLAN.template.md` — Add frontmatter block

  **Testing requirements:**
  - All updated templates parse correctly with new parser
  - All updated templates still parse correctly with old parser (backward compat)
  - `aidf init` produces valid files from updated templates

- [ ] `188-update-docs.md` — Update documentation to reflect the spec.

  **Files to modify:**
  - `docs/concepts/tasks.md` — Document frontmatter format, status lifecycle, dependencies, priority
  - `docs/concepts/plans.md` — Document plan frontmatter, ParsedPlan model
  - `docs/setup/configuration.md` — Reference the JSON Schema for config validation
  - `docs/integrations/` — Add a new doc on "Building AIDF-compatible tools" referencing the spec, discovery rules, context bundle format, and `@aidf/spec` package
  - `README.md` — Mention the spec, `@aidf/spec` package, and `.ai/` folder standard

  **Testing requirements:**
  - All code examples in docs are valid
  - Links to spec files are correct

## Dependencies

```
Phase 1 (ships first — unblocks external consumers):
163 (spec package) ──→ 164 (context bundle uses spec types)
163, 165 are independent, can run in parallel

Phase 2 (schemas — can run in parallel with Phase 1):
166 ─┐
167 ─┤
168 ─┼──→ 171 (spec README needs all schemas)
169 ─┤
170 ─┘

Phase 3 (parser migration):
163 ──→ 172 (frontmatter parser needs types from spec)
172 ──→ 173 (task parser needs frontmatter utility)
172 ──→ 174 (plan parser needs frontmatter utility)
173, 174 ──→ 175 (executor update needs both parsers)

Phase 4 (lifecycle — can parallelize):
173 ──→ 176 (lifecycle needs new task parser)
173 ──→ 177 (dependencies need task index with IDs)
173 ──→ 178 (priority needs frontmatter field)

Phase 5 (migration + templates):
173 ──→ 179 (migrate needs parser to know old vs new format)
166 ──→ 180 (task create needs frontmatter schema)
181 is independent (template syntax change)

Phase 6 (tests — can parallelize):
166-170 ──→ 182 (schema tests need schemas)
172 ──→ 183 (frontmatter tests need parser)
179 ──→ 184 (migration tests need migrate command)
176, 177 ──→ 185 (lifecycle tests need lifecycle impl)
164 ──→ 186 (context builder tests need context builder)

Phase 7 (docs — last):
All implementation ──→ 187 (templates updated last)
All implementation ──→ 188 (docs updated last)
```

**Parallelism opportunities:**
- Phase 1 (163, 165) and Phase 2 (166-171) can run concurrently
- Phase 4 tasks 176-178 can be parallelized (independent features after parser migration)
- Phase 6 test tasks 182-186 can be parallelized
- Phase 5 task 181 (template syntax) is fully independent — can run anytime

**Synchronization point with DitLoop:**
After Phase 1 ships (tasks 163-165), DitLoop can `npm install @aidf/spec` and start importing types + context bundle format. The two tracks then proceed independently until Phase 3-4, when DitLoop's context injection starts consuming the formalized bundle.

## Risks

- **Breaking change in `LoadedContext.plan`**: Changing from `string | undefined` to `ParsedPlan | undefined` breaks any code reading `context.plan` as a string. Mitigation: `ParsedPlan.raw` provides the string. Search all usages and update them. Add a deprecation period where both work.

- **YAML frontmatter parsing complexity**: A hand-rolled YAML parser (like the current skill frontmatter parser) may not handle all edge cases (multiline strings, special characters, nested arrays). Mitigation: use a minimal but proven approach — support only the subset of YAML needed for frontmatter (flat keys, simple arrays, one-level nesting for scope). Document the supported subset.

- **Migration breaks existing task files**: If the migration command has a bug, it could corrupt task files. Mitigation: `--backup` is on by default, `--dry-run` is available, and the parser supports both formats so un-migrated files still work.

- **Scope creep**: This plan is 26 tasks across 7 phases. Risk of blocking v0.8.0 work. Mitigation: Phase 1 ships fast (types + context bundle, no parser changes) and unblocks DitLoop immediately. v0.8.0 plans are fully independent and can proceed in parallel.

- **`@aidf/spec` package maintenance**: A separate package means coordinating versions between `@aidf/spec` and `aidf` CLI. Mitigation: both are in the same monorepo, same CI pipeline, same release process. Use `workspace:*` dependency.

- **Over-engineering the spec for one consumer**: DitLoop is currently the only external consumer. Mitigation: the spec formalizes what AIDF already does implicitly — it's good hygiene regardless of DitLoop. Keep the spec minimal (only document what exists, don't invent new features for the spec alone).

- **Template syntax migration (`[PLACEHOLDER]` → `{{variable}}`)**: Small risk of breaking `aidf init` if placeholder replacement logic is hardcoded. Mitigation: update init command and task create command in the same task (181), test thoroughly.

## Success Criteria

- `@aidf/spec` publishes to NPM with zero runtime dependencies and all types importable.
- `buildContextBundle()` produces output matching the documented Context Bundle format.
- All JSON Schemas in `spec/v1/` validate their corresponding template files without errors.
- Task files with YAML frontmatter parse correctly into `ParsedTask` with all new fields (id, priority, depends_on, status, tags).
- Plan files with frontmatter parse into `ParsedPlan` with structured phases and task references.
- Legacy task/plan files (no frontmatter) still parse correctly with deprecation warning.
- `aidf migrate` converts an existing `.ai/` folder with 50+ tasks without data loss.
- Task dependency resolution blocks execution when deps are unmet, with a clear error message.
- Task status lifecycle transitions are enforced (no invalid transitions).
- All templates use `{{variable}}` syntax consistently, no `[PLACEHOLDER]` remains.
- `.ai/` folder discovery rules are documented and match current `findAiDir()` behavior.
- All existing 613+ tests remain green after all changes.
- External tool can parse AIDF files using only `@aidf/spec` schemas without importing CLI code.
