---
name: aidf-task-templates
description: Task template definitions for AIDF. Provides structured templates with scope, requirements, and Definition of Done for the AIDF codebase.
version: 1.1.0
author: AIDF
tags: templates, tasks, project-management, workflow, scope
globs: .ai/tasks/**, .ai/templates/**
---

# AIDF Task Templates

Structured templates for AI-assisted development tasks on the AIDF project. Each task has a goal, scope, requirements, and Definition of Done.

## Project Context

### Task Organization

```
.ai/tasks/
├── pending/     # Tasks ready to execute (aidf run picks from here)
├── completed/   # Finished tasks with status logs
└── blocked/     # Tasks blocked by dependencies or issues
```

- Task numbering is sequential: `045-configurable-permissions.md`
- Current highest: 049. Next task: 050.
- All tasks are Markdown files with structured sections.

### Common Scope Patterns for AIDF

| What you're changing | Allowed paths |
|---------------------|---------------|
| Core execution | `packages/cli/src/core/executor.ts`, `packages/cli/src/core/executor.test.ts` |
| New provider feature | `packages/cli/src/core/providers/*.ts` |
| New CLI command | `packages/cli/src/commands/*.ts`, `packages/cli/src/index.ts` |
| Type additions | `packages/cli/src/types/index.ts` |
| Skill loader changes | `packages/cli/src/core/skill-loader.ts` |
| Utility functions | `packages/cli/src/utils/*.ts` |
| Templates (distributed) | `templates/.ai/**` |
| Documentation | `docs/**`, `CLAUDE.md` |

Forbidden paths (almost always):
- `templates/**` when working on CLI core
- `.env*`, credentials
- `docs/**` when working on code (unless it's a docs task)

## Task Structure

```markdown
# TASK: [Name]

## Goal
[What needs to be accomplished]

## Task Type
[component|refactor|test|docs|architecture|bugfix]

## Suggested Roles
- [developer|tester|architect|reviewer|documenter]

## Auto-Mode Compatible
✅ **SÍ** - [Why it's safe for auto-mode]

## Scope

### Allowed
- `packages/cli/src/...`

### Forbidden
- `templates/**`
- `docs/**`

## Requirements
[Detailed requirements with TypeScript code snippets]

## Definition of Done
- [ ] [Criteria with quality gates]
- [ ] TypeScript compila sin errores
- [ ] Tests cubren happy path y edge cases

## Notes
- Backward compatibility considerations
- Design decisions and rationale
```

## Quality Gate Reminder

Every AIDF task Definition of Done should include:

- [ ] `pnpm lint` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes (all existing + new tests)
- [ ] `pnpm build` succeeds
- [ ] Backward compatible with existing configs
