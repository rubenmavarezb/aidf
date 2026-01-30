# AGENTS.md

> Master context document for AI assistants working on the AIDF project.

---

## Identity

This project is **AIDF** (AI-Integrated Development Framework) — a task runner for AI agents that guarantees work stays within defined boundaries. It combines a documentation framework (Markdown templates for structured AI-assisted development) with a CLI tool published to npm as `aidf`.

IMPORTANT: This document defines the single source of truth for AI assistants working on this project. All conventions, boundaries, and quality standards defined here MUST be followed.

CRITICAL: Violating boundaries or skipping quality gates invalidates ALL work done.

---

## Pre-Flight Checklist

Before starting ANY work, verify:

- [ ] Read the entire AGENTS.md document
- [ ] Understand the task scope (Allowed/Forbidden paths)
- [ ] Identify which role to use (if specified)
- [ ] Review relevant conventions for the work type
- [ ] Check quality gates requirements
- [ ] Run `pnpm install` if dependencies changed

IMPORTANT: Skipping this checklist leads to rejected work.

---

## Project Overview

AIDF is a CLI tool and documentation framework for AI-assisted software development. It orchestrates AI agent execution with structured context, scope enforcement, and validation.

**Key characteristics:**

- Task runner that wraps AI providers (Claude CLI, Cursor CLI, Anthropic API, OpenAI API)
- 5-layer context system: AGENTS.md → Roles → Skills → Tasks → Plans
- Scope enforcement via ScopeGuard — validates file changes against task-defined boundaries
- Validation gates — runs lint, typecheck, test before allowing task completion
- Agent Skills integration — portable SKILL.md files following the agentskills.io standard

**Target users:**

- Developers using AI coding assistants who need structured, repeatable workflows
- Teams wanting scope enforcement and quality gates on AI-generated code
- CI/CD pipelines running AI tasks with `aidf run`

---

## Architecture

### Directory Structure

```
aidf/
├── .ai/                    # AIDF dogfooding (this project uses itself)
│   ├── AGENTS.md           # This file
│   ├── config.yml          # Project AIDF config
│   ├── roles/              # 5 built-in roles
│   ├── skills/             # 6 built-in skills
│   ├── templates/          # Task and plan templates
│   ├── tasks/              # Completed, pending, blocked tasks
│   └── plans/              # Multi-task plans
├── .github/                # CI workflows (test, release) + GitHub Action
├── docs/                   # Documentation (concepts, setup, skills, etc.)
├── templates/.ai/          # Template folder distributed with npm package
│   ├── AGENTS.template.md
│   ├── ROLES.md
│   ├── roles/              # 5 role definitions
│   ├── skills/             # 6 skill definitions
│   ├── templates/          # 6 task type templates + plan template
│   ├── tasks/
│   └── plans/
├── examples/               # AGENTS.md examples (nextjs, node-api, react-lib)
├── packages/
│   └── cli/                # The CLI tool (npm package "aidf")
│       └── src/
│           ├── index.ts           # CLI entry point (Commander)
│           ├── types/index.ts     # All TypeScript interfaces
│           ├── commands/          # init, run, task, status, watch, hooks, skills
│           ├── core/
│           │   ├── executor.ts          # Main execution loop
│           │   ├── parallel-executor.ts # Multi-task parallel execution
│           │   ├── context-loader.ts    # Loads .ai/ folder context
│           │   ├── skill-loader.ts      # Skill discovery, validation, XML generation
│           │   ├── safety.ts            # ScopeGuard (allowed/forbidden paths)
│           │   ├── validator.ts         # Runs validation commands
│           │   ├── watcher.ts           # File change monitoring
│           │   └── providers/
│           │       ├── index.ts         # Provider factory
│           │       ├── types.ts         # Provider interface, ExecutionResult
│           │       ├── claude-cli.ts    # Spawns `claude --print`
│           │       ├── cursor-cli.ts    # Spawns `agent --print`
│           │       ├── anthropic-api.ts # Direct Anthropic API
│           │       ├── openai-api.ts    # Direct OpenAI API
│           │       └── tool-handler.ts  # File operation tools for API providers
│           └── utils/
│               ├── logger.ts            # Structured logging
│               ├── live-status.ts       # Real-time spinner + timer
│               ├── progress-bar.ts      # Progress bar
│               ├── notifications.ts     # Desktop, Slack, Discord, email
│               └── files.ts             # File utilities
├── CLAUDE.md               # Claude Code instructions (synced with this file)
└── package.json            # Root monorepo config (pnpm workspaces)
```

### Execution Flow

```
aidf run → load context (AGENTS.md + role + skills + task) → build prompt → provider.execute()
  → check scope (ScopeGuard) → validate (lint/typecheck/test) → commit → repeat until done
```

### Key Patterns

**Provider Interface**

All providers implement `{ name, execute(prompt, options), isAvailable() }` from `providers/types.ts`. CLI providers spawn subprocesses; API providers use tool calling with built-in file operation tools.

**Scope Enforcement**

`ScopeGuard` in `safety.ts` validates file changes against task scope (allowed/forbidden paths). Three modes: strict (block), ask (prompt user), permissive (warn only).

**Context Loading**

`ContextLoader` reads `.ai/` folder: AGENTS.md, role file, task file, plan file, and skills. Skills are loaded via `SkillLoader` and injected as `<available_skills>` XML in the prompt.

**Completion Detection**

Executor detects `<TASK_COMPLETE>`, `<DONE>`, or `<TASK_BLOCKED>` signals in AI output. Writes status back to the task .md file.

### Key Files

| File | Purpose |
|------|---------|
| `packages/cli/src/core/executor.ts` | Central execution loop — iterations, scope check, validation, commit |
| `packages/cli/src/core/context-loader.ts` | Loads all .ai/ context into a single `LoadedContext` object |
| `packages/cli/src/core/skill-loader.ts` | Skill discovery, parsing, validation, XML generation |
| `packages/cli/src/core/safety.ts` | ScopeGuard — file change validation against task scope |
| `packages/cli/src/core/providers/claude-cli.ts` | Claude CLI provider + `buildIterationPrompt()` |
| `packages/cli/src/core/providers/tool-handler.ts` | File operation tools for API providers |
| `packages/cli/src/types/index.ts` | All TypeScript interfaces |
| `packages/cli/src/index.ts` | CLI entry point — all commands registered here |

---

## Technology Stack

| Category | Technology | Version | Notes |
|----------|------------|---------|-------|
| Language | TypeScript | 5.x | Strict mode, ESM only |
| Runtime | Node.js | 18+ | ESM modules |
| Build | tsup | 8.x | ESM format, generates `.d.ts` |
| Testing | Vitest | 3.x | ESM, colocated test files |
| CLI | Commander | 13.x | Command parsing |
| Package Manager | pnpm | 9.x | Workspaces monorepo |
| Linting | ESLint | 9.x | Flat config |
| CI/CD | GitHub Actions | - | Test on PR, release on tag |

---

## Environment

<env>
Language: TypeScript 5.x (ESM only)
Runtime: Node.js 18+
Package Manager: pnpm 9.x
Monorepo: pnpm workspaces
</env>

### Configuration Files

| File | Purpose | Notes |
|------|---------|-------|
| `packages/cli/tsconfig.json` | TypeScript config | Strict, ESM, NodeNext |
| `packages/cli/tsup.config.ts` | Build config | Copies templates/ into dist |
| `packages/cli/eslint.config.js` | Lint config | Flat config format |
| `pnpm-workspace.yaml` | Monorepo workspaces | `packages/*` |

---

## Conventions

IMPORTANT: Match these patterns EXACTLY when writing new code. Deviations will be rejected.

### File Naming

| Type | Pattern | Example | Wrong |
|------|---------|---------|-------|
| Source | `kebab-case.ts` | `skill-loader.ts` | `skillLoader.ts` |
| Tests | `*.test.ts` colocated | `safety.test.ts` | `__tests__/safety.ts` |
| Commands | `kebab-case.ts` | `commands/skills.ts` | `commands/Skills.ts` |
| Types | Central `types/index.ts` | `types/index.ts` | `types/skill.ts` |

### Code Style

#### Module Pattern

```typescript
// ✅ CORRECT - ESM imports, named exports, .js extension
import { readFile } from 'fs/promises';
import type { SkillMetadata } from '../types/index.js';

export function parseSkillFrontmatter(content: string): SkillMetadata | null {
  // ...
}

export class SkillLoader {
  // ...
}

// ❌ WRONG - CJS require, default export, no .js extension
const fs = require('fs');
export default class SkillLoader { ... }
```

Why: The project is ESM-only. All imports must use `.js` extension for TypeScript files.

#### Import Order

```typescript
// ✅ CORRECT
import { readFile } from 'fs/promises';          // 1. Node built-ins
import { existsSync } from 'fs';                 // 1. Node built-ins
import { Command } from 'commander';             // 2. External packages
import chalk from 'chalk';                        // 2. External packages
import type { AidfConfig } from '../types/index.js';  // 3. Internal (type imports)
import { SkillLoader } from '../core/skill-loader.js'; // 4. Internal (value imports)
```

#### Type Definitions

```typescript
// ✅ CORRECT - All types in types/index.ts, exported interfaces
export interface SkillMetadata {
  name: string;
  description: string;
  version?: string;
}

// ❌ WRONG - Types scattered across files, inline object types
```

Why: Single source of truth for types. All interfaces in `types/index.ts`.

#### Error Handling

```typescript
// ✅ CORRECT - Try/catch with graceful fallback for optional features
try {
  const skills = await skillLoader.loadAll();
  if (skills.length > 0) { context.skills = skills; }
} catch { /* Skills are optional, don't fail context loading */ }

// ✅ CORRECT - Explicit error for required operations
if (!existsSync(taskPath)) {
  throw new Error(`Task file not found: ${taskPath}`);
}
```

Why: Optional features (skills, notifications) must not break core execution. Required features fail loud.

### Testing Pattern

```typescript
// ✅ CORRECT - Colocated tests, describe blocks, vitest
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ScopeGuard } from './safety.js';

describe('ScopeGuard', () => {
  it('should block files in forbidden scope', () => {
    const guard = new ScopeGuard(scope, 'strict');
    const result = guard.validate(changes);
    expect(result.action).toBe('BLOCK');
  });
});
```

- Tests colocated with source: `foo.ts` → `foo.test.ts`
- Use `vi.mock()` for external dependencies
- Test behavior, not implementation details

---

## Quality Standards

IMPORTANT: These standards apply to ALL code in this project.

### Testing

- All new functionality must have tests
- Test happy path, edge cases, and error conditions
- Current: 19 test files, 298+ tests

### Type Safety

- All code must be fully typed
- No `any` types unless absolutely necessary (and documented why)
- ESM-only — no CJS `require()` calls

---

## Quality Gates

CRITICAL: Before ANY task can be marked complete, ALL of these MUST pass.

### Required Checks

| Check | Command | Expected Result |
|-------|---------|-----------------|
| Lint | `pnpm lint` | Zero errors |
| Types | `pnpm typecheck` | Zero errors |
| Tests | `pnpm test` | All tests pass |
| Build | `pnpm build` | Builds successfully |

### Verification Process

1. Run ALL commands in the table above
2. If ANY fails, task is NOT complete
3. Fix issues and re-run ALL checks
4. Only mark complete when ALL pass

IMPORTANT: Partial passes are not acceptable. ALL gates must pass.

---

## Boundaries

### NEVER Do (will reject the work)

- **NEVER** modify files outside the task scope
- **NEVER** add new dependencies without explicit approval
- **NEVER** skip quality gates
- **NEVER** use CJS `require()` — this is an ESM-only project
- **NEVER** commit sensitive values (API keys, passwords, tokens)
- **NEVER** modify `templates/` when working on CLI core (and vice versa)

CRITICAL: Violating these boundaries invalidates ALL work done.

### ALWAYS Do

- **ALWAYS** check scope before modifying files
- **ALWAYS** run quality gates before marking complete
- **ALWAYS** follow existing patterns exactly
- **ALWAYS** write tests for new functionality
- **ALWAYS** use `.js` extension in ESM imports
- **ALWAYS** add new types to `types/index.ts`

### Requires Discussion

- Adding new npm dependencies
- Changing the provider interface
- Modifying the execution flow in executor.ts
- Changing the config.yml schema (backward compatibility)

IMPORTANT: When in doubt, ask before modifying.

---

## Commands

### Development

| Command | Description | When to Run |
|---------|-------------|-------------|
| `pnpm install` | Install all dependencies | After cloning or pulling changes |
| `pnpm dev` | Watch mode for CLI development | During development |
| `pnpm build` | Build all packages (tsup) | Before testing the built CLI |

### Quality Checks

CRITICAL: These MUST pass before marking any task complete.

| Command | Description | When to Run |
|---------|-------------|-------------|
| `pnpm lint` | ESLint across all packages | Before every commit |
| `pnpm typecheck` | TypeScript type checking | Before every commit |
| `pnpm test` | Vitest — all test suites | Before every commit |
| `pnpm build` | Build to dist/ | Before every commit |

### Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| `ERR_MODULE_NOT_FOUND` | Missing `.js` extension in import | Add `.js` to the import path |
| `require is not defined in ES module scope` | Using CJS `require()` | Change to ESM `import` |
| `Cannot find module '../types/index'` | Missing `.js` extension | Use `'../types/index.js'` |
| Pre-existing TS error in `status.ts:299` | ProviderConfig conversion issue | Known issue, not blocking |

### Command Sequences

**Pre-Commit Verification**

```bash
pnpm lint         # Check lint errors
pnpm typecheck    # Check type errors
pnpm test         # Run all tests
pnpm build        # Verify build succeeds
```

**Start New Feature**

```bash
git checkout -b feat/feature-name   # Create branch
pnpm install                        # Ensure deps are fresh
# ... implement ...
pnpm lint && pnpm typecheck && pnpm test && pnpm build  # Verify all gates
```

---

## Task Management

Tasks live in `.ai/tasks/` organized by status:

| Directory | Purpose |
|-----------|---------|
| `.ai/tasks/pending/` | Tasks ready to execute |
| `.ai/tasks/completed/` | Finished tasks with status logs |
| `.ai/tasks/blocked/` | Tasks blocked by dependencies or issues |

Task numbering is sequential (currently at 049). Next task: 050.

---

## Structured Blocks

Roles and tasks use XML-style blocks to structure AI thinking:

| Block | Used By | Purpose |
|-------|---------|---------|
| `<task_analysis>` | All roles | Analyze before implementing |
| `<completion_check>` | All roles | Verify before marking complete |
| `<implementation_plan>` | Developer | Plan code changes |
| `<design_rationale>` | Architect | Document design decisions |
| `<test_plan>` | Tester | Plan test cases |
| `<pr_analysis>` | Reviewer | Analyze PR changes |
| `<documentation_plan>` | Documenter | Plan documentation |

---

IMPORTANT: Update this document when patterns change, decisions are made, or new conventions are established. This document must remain accurate and current.
