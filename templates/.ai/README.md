# .ai/ — AIDF Configuration

This directory contains the **AIDF (AI Development Framework)** configuration for this project.

**Framework documentation:** https://rubenmavarezb.github.io/aidf/docs/concepts/

## What is AIDF?

AIDF is a structured context framework for AI-assisted development. It provides layered context so AI assistants understand project conventions, role expertise, and task boundaries — the same way a new human developer would be onboarded.

## How It Works

AIDF uses five nested context layers:

```
Layer 1 (Global)    →  AGENTS.md        →  Project conventions, architecture, boundaries
Layer 2 (Role)      →  roles/*.md       →  Specialized expertise and behavior rules
Layer 3 (Skill)     →  skills/*.md      →  Portable skill definitions and instructions
Layer 4 (Task)      →  tasks/*.md       →  Exact scope, requirements, definition of done
Layer 5 (Plan)      →  plans/*.md       →  Multi-task initiatives and sequencing
```

**Combined:** Project conventions + role expertise + skill context + task scope = precise execution instructions.

## Directory Contents

| File / Directory | Purpose |
|---|---|
| `config.yml` | AIDF configuration (provider, behavior, validation, security, skills) |
| `AGENTS.md` | **Start here.** Master context — project identity, architecture, conventions, quality gates |
| `ROLES.md` | Quick reference for selecting the right AI role |
| `roles/` | Role definitions: developer, architect, tester, reviewer, documenter |
| `skills/` | Skill definitions for AI agents (one per role + task templates) |
| `tasks/` | Task specifications with scoped allowed/forbidden file paths |
| `plans/` | Multi-task initiative plans |
| `templates/` | Templates for creating new tasks and plans |

## Quick Start for AI Assistants

1. Read `AGENTS.md` completely (Layer 1 — global context)
2. Check `ROLES.md` to identify which role applies
3. Read the assigned role in `roles/` (Layer 2 — role expertise)
4. Read the task specification in `tasks/` if one exists (Layer 4 — task scope)
5. Follow all conventions, quality gates, and boundaries defined in Layer 1
