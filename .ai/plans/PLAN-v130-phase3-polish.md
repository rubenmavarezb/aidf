# PLAN: v1.3.0 — Phase 3: Polish (Model Profiles + Codebase Mapping + Verification Loop)

## Overview

Phase 3 adds the finishing touches that turn AIDF from a powerful tool into a polished product: intelligent model selection for cost optimization, brownfield project onboarding via codebase analysis, and post-execution verification that catches gaps before the user has to. These features increase trust, reduce cost, and lower the barrier to adopting AIDF on existing projects.

## Goals

- Implement model profiles (quality/balanced/budget) that automatically assign optimal models per execution phase
- Add `aidf map` command for brownfield codebase analysis that generates AGENTS.md from an existing project
- Create a verification loop that validates task completion against Definition of Done using a separate AI pass
- All features integrate with Phase 1 (STATE.md) and Phase 2 (summaries, research) infrastructure

## Non-Goals

- Adding new AI providers
- Changing the core execution loop
- Building a web UI or dashboard
- Real-time collaboration features
- Plugin/extension system

## Tasks

### Phase 1: Model Profiles — Smart Cost Optimization

Model profiles let users trade quality for speed/cost. A single config option selects which model handles planning, execution, and verification.

- [ ] `130-model-profile-types.md` — Define model profile types and configuration (wave: 1)

  **Types to add in `types/index.ts`:**
  ```typescript
  export type ModelProfileName = 'quality' | 'balanced' | 'budget' | 'custom';

  export interface ModelProfile {
    name: ModelProfileName;
    planner: string;    // Model for research/planning tasks
    executor: string;   // Model for implementation tasks
    verifier: string;   // Model for verification tasks
  }

  export interface ModelProfileConfig {
    profile?: ModelProfileName;
    custom?: {
      planner?: string;
      executor?: string;
      verifier?: string;
    };
  }
  ```

  **Built-in profiles (constants, not config):**
  ```typescript
  export const MODEL_PROFILES: Record<Exclude<ModelProfileName, 'custom'>, ModelProfile> = {
    quality: {
      name: 'quality',
      planner: 'claude-opus-4-6',
      executor: 'claude-opus-4-6',
      verifier: 'claude-sonnet-4-6',
    },
    balanced: {
      name: 'balanced',
      planner: 'claude-opus-4-6',
      executor: 'claude-sonnet-4-6',
      verifier: 'claude-sonnet-4-6',
    },
    budget: {
      name: 'budget',
      planner: 'claude-sonnet-4-6',
      executor: 'claude-sonnet-4-6',
      verifier: 'claude-haiku-4-5-20251001',
    },
  };
  ```

  **Changes to `AidfConfig`:**
  - Add `models?: ModelProfileConfig` to `AidfConfig`
  - Config example:
    ```yaml
    models:
      profile: balanced
      # OR custom:
      #   planner: claude-opus-4-6
      #   executor: claude-sonnet-4-6
      #   verifier: claude-haiku-4-5-20251001
    ```

  **Scope:** `packages/cli/src/types/index.ts`
  **Tests:** Type compilation tests

- [ ] `131-model-profile-resolver.md` — Implement model resolution logic that selects model based on task type and profile (wave: 2, depends: 130)

  **New file `packages/cli/src/core/model-resolver.ts`:**
  - `ModelResolver` class:
    - `constructor(config: ModelProfileConfig)`
    - `resolveModel(taskType: ParsedTask['taskType'], phase?: 'plan' | 'execute' | 'verify'): string`
      - Research tasks → planner model
      - Implementation tasks (component, refactor, bugfix) → executor model
      - Test/docs tasks → executor model (lower token usage)
      - Verification phase → verifier model
      - Custom profile overrides take precedence
    - `getProfile(): ModelProfile` — returns resolved profile
    - `estimateCostMultiplier(): number` — relative cost vs balanced (for display)

  **Changes to `phases/preflight.ts`:**
  - Resolve model from profile based on task type
  - Pass resolved model to provider creation
  - Log which model/profile is being used

  **Changes to `ProviderConfig`:**
  - `model` field now has a default source: profile-based resolution
  - Explicit `model` in config still takes precedence (backward compatible)

  **Scope:** `packages/cli/src/core/model-resolver.ts`, `packages/cli/src/core/phases/preflight.ts`, `packages/cli/src/types/index.ts`
  **Tests:** `packages/cli/src/core/model-resolver.test.ts` — profile resolution, task type mapping, custom override, explicit model precedence

- [ ] `132-model-profile-cli.md` — Add `--profile` flag to CLI commands and profile display (wave: 3, depends: 131)

  **Changes to `commands/run.ts`:**
  - Add `--profile <name>` option (quality | balanced | budget)
  - CLI flag overrides config.yml `models.profile`
  - Display active profile in execution summary

  **Changes to `commands/quick.ts`:**
  - Add `--profile` option
  - Quick mode defaults to `budget` profile (fast, cheap)

  **Changes to `commands/plan.ts`:**
  - Add `--profile` option
  - Display profile in wave-by-wave progress

  **Changes to `commands/status.ts`:**
  - Show active model profile in status output

  **Scope:** `packages/cli/src/commands/run.ts`, `packages/cli/src/commands/quick.ts`, `packages/cli/src/commands/plan.ts`, `packages/cli/src/commands/status.ts`
  **Tests:** Update command tests for new flag

### Phase 2: Codebase Mapping — Brownfield Onboarding

`aidf map` analyzes an existing codebase and generates a draft AGENTS.md, reducing the manual effort to adopt AIDF on an existing project from hours to minutes.

- [ ] `133-codebase-analyzer.md` — Implement codebase analysis engine (wave: 1)

  **New file `packages/cli/src/core/codebase-analyzer.ts`:**
  - `CodebaseAnalyzer` class:
    - `constructor(projectRoot: string)`
    - `analyze(): Promise<CodebaseAnalysis>`
    - Analysis dimensions:
      1. **Stack detection**: scan `package.json`, `Cargo.toml`, `go.mod`, `requirements.txt`, `Gemfile`, etc. for language/framework
      2. **Architecture detection**: scan directory structure for patterns (MVC, clean architecture, monorepo, microservices)
      3. **Convention detection**: analyze existing code for patterns (import style, naming conventions, test patterns, linting config)
      4. **Boundary detection**: identify sensitive paths (`.env*`, `**/migrations/**`, `**/config/**`, CI files)
      5. **Command detection**: scan `package.json` scripts, `Makefile`, `Taskfile`, CI config for dev/build/test commands
    - Uses file system scanning only — no AI calls during analysis
    - Returns structured `CodebaseAnalysis` object

  **Types to add:**
  ```typescript
  export interface CodebaseAnalysis {
    languages: DetectedLanguage[];
    frameworks: DetectedFramework[];
    architecture: ArchitecturePattern;
    conventions: DetectedConventions;
    boundaries: DetectedBoundaries;
    commands: DetectedCommands;
    projectType: 'frontend' | 'backend' | 'fullstack' | 'library' | 'cli' | 'monorepo';
  }

  export interface DetectedLanguage {
    name: string;
    percentage: number;    // of total files
    configFiles: string[]; // tsconfig.json, etc.
  }

  export interface DetectedFramework {
    name: string;
    version: string;
    confidence: 'high' | 'medium' | 'low';
  }

  export interface ArchitecturePattern {
    pattern: string;       // "layered", "clean", "mvc", "monorepo", "flat"
    confidence: 'high' | 'medium' | 'low';
    evidence: string[];    // Why we think this
  }

  export interface DetectedConventions {
    importStyle: 'relative' | 'absolute' | 'mixed';
    testPattern: string;          // "colocated", "separate __tests__", "test/"
    namingConvention: string;     // "camelCase", "snake_case", "kebab-case"
    linter?: string;              // "eslint", "biome", etc.
    formatter?: string;           // "prettier", "biome", etc.
  }

  export interface DetectedBoundaries {
    sensitiveFiles: string[];     // .env, secrets, credentials
    configFiles: string[];        // CI, deployment configs
    generatedFiles: string[];     // dist/, build/, node_modules/
    migrationFiles: string[];     // Database migrations
  }

  export interface DetectedCommands {
    dev: string[];
    build: string[];
    test: string[];
    lint: string[];
    typecheck: string[];
  }
  ```

  **Scope:** `packages/cli/src/core/codebase-analyzer.ts`, `packages/cli/src/types/index.ts`
  **Tests:** `packages/cli/src/core/codebase-analyzer.test.ts` — test with mock file structures for each project type

- [ ] `134-agents-generator.md` — Generate AGENTS.md from CodebaseAnalysis (wave: 2, depends: 133)

  **New file `packages/cli/src/core/agents-generator.ts`:**
  - `AgentsGenerator` class:
    - `constructor(analysis: CodebaseAnalysis)`
    - `generate(): string` — produces full AGENTS.md markdown
    - Sections mapped from analysis:
      - `## Project Overview` — from detected type, languages, frameworks
      - `## Architecture` — from architecture pattern + evidence
      - `## Technology Stack` — from languages, frameworks, versions
      - `## Conventions` — from detected conventions
      - `## Quality Standards` — from detected linter/formatter, test patterns
      - `## Boundaries` — from sensitive/generated/migration files
      - `## Commands` — from detected commands
    - Output is a **draft** with `<!-- TODO: ... -->` markers for sections needing human review
    - Includes confidence indicators: high-confidence sections are filled in, low-confidence sections have placeholders

  **Scope:** `packages/cli/src/core/agents-generator.ts`
  **Tests:** `packages/cli/src/core/agents-generator.test.ts` — verify output for different project types

- [ ] `135-map-command.md` — Add `aidf map` CLI command (wave: 3, depends: 133, 134)

  **New file `packages/cli/src/commands/map.ts`:**
  - `aidf map` — analyzes current directory, generates AGENTS.md draft
    - If `.ai/` doesn't exist: creates it with the generated AGENTS.md + default templates
    - If `.ai/AGENTS.md` exists: generates to `.ai/AGENTS.draft.md` to avoid overwriting
    - `--output <path>` — custom output path
    - `--format json` — output analysis as JSON instead of AGENTS.md
    - `--dry-run` — show analysis without writing files
  - Shows analysis progress with spinner (stack detection → architecture → conventions → boundaries → commands)
  - Prints summary: "Detected: TypeScript + React + Next.js | Architecture: App Router | Tests: colocated with Vitest"
  - Suggests next steps: "Review .ai/AGENTS.md and customize, then run `aidf init` to set up config"

  **Changes to `index.ts`:**
  - Register `createMapCommand()`

  **Scope:** `packages/cli/src/commands/map.ts`, `packages/cli/src/index.ts`
  **Tests:** `packages/cli/src/commands/map.test.ts`

### Phase 3: Verification Loop — Trust but Verify

A post-execution verification pass that uses a separate AI call (verifier model) to check whether the task's Definition of Done was actually met.

- [ ] `136-verifier.md` — Implement post-execution verification engine (wave: 2, depends: 130)

  **New file `packages/cli/src/core/verifier.ts`:**
  - `Verifier` class:
    - `constructor(options: VerifierOptions)`
    - `verify(taskPath: string, result: ExecutorResult): Promise<VerificationResult>`
    - Verification process:
      1. Load the task file and extract Definition of Done checklist
      2. Load the files modified by the executor
      3. Build a verification prompt: "Given this task's Definition of Done and the files that were modified, assess whether each criterion was met"
      4. Call the verifier model (from model profile) with the prompt
      5. Parse the AI's structured response into `VerificationResult`
    - Verification prompt asks for:
      - Per-criterion status: `met` | `partially_met` | `not_met` | `cannot_verify`
      - Evidence for each assessment
      - Overall verdict: `passed` | `human_needed` | `gaps_found`
    - Anti-pattern scanning (non-AI, regex-based):
      - Check for `TODO` / `FIXME` / `HACK` in modified files
      - Check for empty function bodies
      - Check for `console.log` / `debugger` statements
      - Check for commented-out code blocks

  **Types to add:**
  ```typescript
  export interface VerifierOptions {
    model?: string;           // Override verifier model
    provider?: string;        // Provider to use for verification
    antiPatternScan?: boolean; // Enable regex-based checks (default: true)
    skipAiVerification?: boolean; // Only run anti-pattern scan
  }

  export interface VerificationResult {
    verdict: 'passed' | 'human_needed' | 'gaps_found';
    criteria: CriterionCheck[];
    antiPatterns: AntiPatternMatch[];
    summary: string;
  }

  export interface CriterionCheck {
    criterion: string;
    status: 'met' | 'partially_met' | 'not_met' | 'cannot_verify';
    evidence: string;
  }

  export interface AntiPatternMatch {
    pattern: string;      // "TODO", "empty function", etc.
    file: string;
    line: number;
    context: string;      // Surrounding code
  }
  ```

  **Scope:** `packages/cli/src/core/verifier.ts`, `packages/cli/src/types/index.ts`
  **Tests:** `packages/cli/src/core/verifier.test.ts` — anti-pattern detection, prompt building, result parsing, verdict determination

- [ ] `137-verification-integration.md` — Integrate verification into executor pipeline and CLI (wave: 3, depends: 136)

  **Changes to `phases/postflight.ts`:**
  - After successful task completion (before status file update), optionally run verification
  - If verification verdict is `gaps_found`: set status to `needs_review` instead of `completed`
  - If `human_needed`: set status to `completed` with verification notes appended
  - If `passed`: set status to `completed` (normal flow)
  - Verification results included in `ExecutorResult`

  **Changes to `ExecutorResult`:**
  - Add `verification?: VerificationResult`

  **Changes to `ExecutorStatus`:**
  - Add `'needs_review'` to union type

  **Changes to `commands/run.ts`:**
  - Add `--verify` flag (default: false) — enables post-execution verification
  - Add `--verify-only` flag — runs verification on an already-completed task without re-executing
  - Display verification results in execution summary
  - Show anti-pattern warnings prominently

  **Config support:**
  - Add to `AidfConfig`:
    ```yaml
    verification:
      enabled: false        # default: off (opt-in)
      anti_patterns: true   # regex-based checks always on when verification enabled
      ai_verification: true # AI-based DoD checking
    ```

  **Changes to STATE.md integration:**
  - Tasks with `gaps_found` create a blocker in STATE.md automatically

  **Scope:** `packages/cli/src/core/phases/postflight.ts`, `packages/cli/src/commands/run.ts`, `packages/cli/src/types/index.ts`
  **Tests:** Update postflight tests, run command tests

- [ ] `138-verify-command.md` — Add standalone `aidf verify` command (wave: 3, depends: 136)

  **New file `packages/cli/src/commands/verify.ts`:**
  - `aidf verify <taskPath>` — runs verification on a task (must have been executed at least once)
    - Reads task file for DoD
    - Reads git log to find files modified by the task
    - Runs anti-pattern scan + AI verification
    - Prints detailed report: per-criterion status, anti-patterns found, overall verdict
  - `aidf verify --scan-only <taskPath>` — only anti-pattern scan, no AI call
  - `aidf verify --all` — verify all completed tasks in `.ai/tasks/completed/`

  **Changes to `index.ts`:**
  - Register `createVerifyCommand()`

  **Scope:** `packages/cli/src/commands/verify.ts`, `packages/cli/src/index.ts`
  **Tests:** `packages/cli/src/commands/verify.test.ts`

## Dependencies

```
130 ──────┬──> 131 ──> 132
          │
133 ──────┼──> 134 ──> 135
          │
130 ──────┼──> 136 ──┬──> 137
          │          └──> 138
          └──────────────────┘
```

- **130** (model profile types) and **133** (codebase analyzer) can start in parallel (wave 1)
- **131** (model resolver) depends on 130
- **132** (CLI integration) depends on 131
- **134** (agents generator) depends on 133
- **135** (map command) depends on 133 + 134
- **136** (verifier) depends on 130 (uses model profiles for verifier model)
- **137** (verification integration) depends on 136
- **138** (verify command) depends on 136

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Model profile models become outdated as new models release | High | Low | Profiles are constants in code, easy to update; `custom` profile always available |
| Codebase analyzer misdetects architecture/conventions | Medium | Medium | Low-confidence results get `<!-- TODO -->` markers; never overwrites existing AGENTS.md |
| AI verification hallucinating "met" for criteria not actually met | Medium | High | Anti-pattern scan is deterministic fallback; `human_needed` is the safe default for ambiguous cases |
| Verification adds significant cost (extra AI call per task) | Medium | Medium | Off by default (`--verify` opt-in); budget profile uses Haiku for verification |
| `aidf map` output too generic to be useful | Medium | Medium | Focus on concrete outputs (detected commands, boundaries) over generic descriptions |

## Success Criteria

- [ ] `aidf run --profile budget` uses Sonnet for execution, saving ~60% vs Opus
- [ ] `aidf map` on a Next.js project correctly detects: TypeScript, React, Next.js, App Router pattern, colocated tests
- [ ] Generated AGENTS.md has >70% of sections filled with project-specific content (not generic placeholders)
- [ ] `aidf verify <task>` catches at least: TODO comments, empty functions, console.log in modified files
- [ ] AI verification correctly assesses 3/3 simple Definition of Done criteria on a test task
- [ ] `--verify-only` works on previously completed tasks without re-execution
- [ ] All existing tests pass, new features have >80% test coverage
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm build` clean

## Notes

- Model profiles solve a real problem: users currently have to manually specify model in config, and most don't know which model is best for which task. Profiles make this a one-word decision.
- Codebase mapping is the onboarding accelerator. The #1 friction point for AIDF adoption is writing AGENTS.md from scratch. `aidf map` reduces this from hours to minutes + review.
- Verification is intentionally opt-in. Not every task needs AI-powered verification. But for critical tasks (architecture changes, security fixes), it's invaluable. The anti-pattern scan is lightweight enough to consider enabling by default in a future version.
- The verifier uses a separate model from the executor on purpose — same model reviewing its own work is less effective than a fresh perspective. This mirrors the GSD pattern of distinct planner/executor/verifier roles.
