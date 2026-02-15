---
name: aidf
description: Teaches AI agents how to work with AIDF (AI-Integrated Development Framework) projects — structure, task format, scope enforcement, completion signals, and conventions.
version: 1.0.0
author: AIDF
tags: aidf, framework, context, tasks, scope, conventions
globs: .ai/**
---

# AIDF — AI-Integrated Development Framework

This skill teaches you how to work within an AIDF-managed project. AIDF provides structured, layered context so AI assistants produce consistent, scoped, high-quality work.

## Project Structure

AIDF projects contain a `.ai/` directory at the project root:

```
.ai/
├── AGENTS.md          # Layer 1: Project identity, architecture, conventions, boundaries
├── config.yml         # Framework configuration (provider, validation, permissions)
├── ROLES.md           # Quick reference for available roles
├── roles/             # Layer 2: Role definitions (developer, architect, tester, etc.)
│   ├── developer.md
│   ├── architect.md
│   ├── tester.md
│   ├── reviewer.md
│   └── documenter.md
├── skills/            # Layer 3: Portable skill definitions (SKILL.md per agentskills.io)
├── tasks/             # Layer 4: Scoped task specifications
│   ├── pending/       # Tasks waiting to be executed
│   ├── completed/     # Successfully completed tasks
│   └── blocked/       # Tasks that need human input
├── plans/             # Layer 5: Multi-task initiatives
└── templates/         # Task and plan templates
```

## Context Layers

AIDF uses 5 layers of context that combine to form precise execution instructions:

1. **AGENTS.md** (Global) — Project overview, architecture, conventions, quality gates, boundaries
2. **Roles** (Expertise) — Specialized AI personas with defined responsibilities and constraints
3. **Skills** (Capabilities) — Portable, composable instructions following agentskills.io standard
4. **Tasks** (Scope) — Exact scope (allowed/forbidden files), requirements, definition of done
5. **Plans** (Coordination) — Multi-task initiatives with sequencing and dependencies

**How they combine:** Project conventions (Layer 1) + role expertise (Layer 2) + skill context (Layer 3) + task scope (Layer 4) = precise execution instructions.

## Task File Format

Task files are Markdown documents with specific sections. Here is the expected structure:

```markdown
# Task: [Short descriptive title]

## Goal
[Clear statement of what needs to be accomplished]

## Task Type
[component | refactor | test | docs | architecture | bugfix]

## Suggested Roles
- [role-name]

## Scope

### Allowed
- `src/components/**`
- `src/utils/helpers.ts`

### Forbidden
- `src/config/**`
- `.env*`

### Ask Before
- `package.json`

## Requirements
[Detailed requirements for the task]

## Definition of Done
- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] [Criterion 3]

## Notes
[Optional additional context]
```

### Key Rules for Tasks

- **Scope enforcement**: Only modify files listed under `### Allowed`. Never touch files under `### Forbidden`. Ask the user before modifying files under `### Ask Before`.
- **Definition of Done**: Every checkbox must be satisfied before marking the task complete.
- **Task Type**: Determines the approach — `component` (new feature), `refactor` (restructure), `test` (add tests), `docs` (documentation), `architecture` (design), `bugfix` (fix issue).

## Scope Enforcement

AIDF enforces three scope modes:

| Mode | Behavior |
|------|----------|
| `strict` | Block all changes outside allowed paths. Task fails on violation. |
| `ask` | Prompt the user before any out-of-scope change. |
| `permissive` | Allow with warnings. |

**When working on a task, always check the scope before modifying any file.**

## Completion Signals

When a task is complete, signal it with one of these markers in your output:

- `<TASK_COMPLETE>` — Primary completion signal
- `<DONE>` — Alternative completion signal

The executor detects these signals and marks the task as completed.

If you cannot complete a task, signal it with:

- `<TASK_BLOCKED>reason</TASK_BLOCKED>` — Indicates the task needs human input

## Configuration (config.yml)

The `.ai/config.yml` file controls AIDF behavior:

```yaml
version: 1
provider:
  type: claude-cli    # claude-cli | cursor-cli | anthropic-api | openai-api
  model: claude-sonnet-4-5-20250929  # optional
execution:
  max_iterations: 50
  max_consecutive_failures: 3
  timeout_per_iteration: 300
permissions:
  scope_enforcement: strict  # strict | ask | permissive
  auto_commit: true
  auto_push: false
validation:
  pre_commit: [npm run lint, npm run typecheck]
  pre_push: [npm run test]
  pre_pr: [npm run build]
git:
  commit_prefix: "aidf:"
  branch_prefix: "aidf/"
skills:
  enabled: true
  directories: []    # extra directories to scan for skills
```

## Working with Roles

Before starting a task, check the `## Suggested Roles` section. Load the corresponding role file from `.ai/roles/`. Each role defines:

- **Identity**: Who you are and your expertise level
- **Expertise**: Your areas of knowledge
- **Responsibilities**: What you are accountable for
- **Constraints**: What you must never do
- **Quality Criteria**: Standards your work must meet

## Quality Gates

Before marking any task complete:

1. Run all validation commands from `config.yml` (`pre_commit` hooks)
2. Ensure all `Definition of Done` checkboxes are satisfied
3. Verify no files outside scope were modified
4. Check that code follows conventions defined in `AGENTS.md`

## Behavior Rules

### ALWAYS
- Read AGENTS.md before starting any work
- Check task scope before modifying files
- Follow conventions defined in AGENTS.md exactly
- Run quality gates before marking complete
- Signal completion with `<TASK_COMPLETE>` or `<DONE>`

### NEVER
- Modify files outside the task scope
- Skip quality gates
- Ignore role constraints
- Add dependencies without approval
- Commit sensitive values (API keys, passwords)
