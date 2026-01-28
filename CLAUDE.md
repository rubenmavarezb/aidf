# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is AIDF

AIDF (AI-Integrated Development Framework) is a **documentation framework** for structured AI-assisted software development. It provides patterns, templates, and conventions that enable effective collaboration between developers and AI assistants.

**Important:** This is NOT a software library. There are no build commands, tests, or dependencies. It consists entirely of Markdown documentation and templates.

## Repository Structure

```text
docs/           # Core documentation explaining AIDF concepts
templates/.ai/  # Ready-to-use template folder (copy to new projects)
  ├── AGENTS.template.md    # Master context document template
  ├── ROLES.md              # Role selection guide
  ├── roles/                # 5 built-in role definitions
  ├── templates/            # Task and plan templates
  ├── tasks/                # Folder for active tasks
  └── plans/                # Folder for larger initiatives
examples/       # Real-world project templates (Next.js, Node API, React lib)
```

## Core Concepts

AIDF uses 4 layers of context:

1. **AGENTS.md** - Single source of truth about the project (overview, architecture, conventions, boundaries)
2. **Roles** - Specialized personas (architect, developer, tester, reviewer, documenter)
3. **Tasks** - Executable prompts with goal, scope, requirements, and definition of done
4. **Plans** - Multi-task initiatives grouping related work

## Working with This Repository

When editing AIDF documentation:

- Templates use `.template.md` suffix
- Role files define: Identity, Expertise, Responsibilities, Constraints, Quality Criteria, Examples
- Task files define: Goal, Type, Scope (allowed/forbidden paths), Requirements, Definition of Done
- The `examples/` directory contains README files showing how to customize AGENTS.md for different project types

## Key Principles

- Context travels with the project via AGENTS.md
- Scoped tasks define what CAN and CANNOT be modified
- Definition of Done uses verifiable criteria, not subjective assessments
- Small focused tasks beat large vague ones
