---
title: Core Concepts
description: Understand the problem AIDF solves and its core components — AGENTS.md, Roles, Tasks, and Plans.
---

## The Problem AIDF Solves

AI assistants are powerful but context-blind. They don't know:

- Your project's architecture
- Your coding conventions
- Your file structure
- What they should and shouldn't touch
- When a task is truly "done"

This leads to:

- Inconsistent code that doesn't match your patterns
- Changes in places that shouldn't be modified
- "Done" that requires extensive human revision
- Repeated explanations of the same context

AIDF solves this by providing **structured context** that travels with your project.

---

## Core Components

### 1. AGENTS.md - The Master Context

This is the single source of truth about your project for AI assistants. It contains:

```markdown
# Project Context

## Overview
What this project is and does.

## Architecture
How the code is organized.

## Conventions
Coding standards, naming patterns, file structures.

## Technology Stack
Languages, frameworks, tools.

## Quality Standards
Testing requirements, linting rules, type safety.

## What NOT to Do
Explicit boundaries and restrictions.
```

**Key insight**: Write AGENTS.md as if onboarding a new developer who will work autonomously.

### 2. Roles - Specialized Personas

Instead of generic AI assistance, AIDF defines roles with specific expertise:

| Role | Focus | Example Tasks |
|------|-------|---------------|
| Architect | System design, patterns | Design new feature, plan refactor |
| Developer | Implementation | Build component, fix bug |
| Tester | Quality assurance | Write tests, improve coverage |
| Reviewer | Code quality | Review PR, suggest improvements |
| Documenter | Documentation | Write docs, add comments |

Each role has:

- **Expertise**: What they know deeply
- **Responsibilities**: What they do
- **Constraints**: What they avoid
- **Quality criteria**: How to judge their work

### 3. Tasks - Executable Prompts

Tasks are structured prompts that contain everything needed for execution:

```markdown
# TASK

## Goal
One clear sentence.

## Task Type
component | refactor | test | docs | architecture

## Suggested Roles
- developer
- tester

## Scope
### Allowed
- src/components/Button/**

### Forbidden
- src/core/**
- Any configuration files

## Requirements
Detailed specifications...

## Definition of Done
- [ ] Verifiable criterion 1
- [ ] Verifiable criterion 2
- [ ] `npm test` passes
```

### 4. Plans - Multi-Task Initiatives

For larger work, plans group related tasks:

```
plans/
└── new-auth-system/
    ├── README.md           # Overview and sequencing
    └── tasks/
        ├── 001-design-schema.md
        ├── 002-implement-api.md
        ├── 003-build-ui.md
        └── 004-write-tests.md
```

---

## The Execution Model

```
┌─────────────────────────────────────────────────────────┐
│                     AGENTS.md                           │
│              (Project-wide context)                     │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    Role Definition                       │
│           (Specialized knowledge + constraints)          │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    Task Definition                       │
│         (Specific goal + scope + done criteria)          │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                     AI Execution                         │
│              (Follows all three layers)                  │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                      Validation                          │
│              (Definition of Done check)                  │
└─────────────────────────────────────────────────────────┘
```

---

## Context Layering

AIDF uses **layered context** where each layer adds specificity:

### Layer 1: Project Context (AGENTS.md)

- Always applies
- Defines global rules
- Sets baseline conventions

### Layer 2: Role Context (roles/*.md)

- Applies when role is activated
- Adds specialized knowledge
- Narrows focus

### Layer 3: Task Context (tasks/*.md)

- Applies to specific task
- Defines exact scope
- Sets completion criteria

**Example flow**:

```
AGENTS.md says: "Use TypeScript strict mode"
     +
roles/tester.md says: "Always test accessibility"
     +
tasks/add-button.md says: "Only modify src/atoms/Button/"
     =
AI knows exactly what to do, how to do it, and where to do it
```

---

## Scope Control

One of AIDF's most important features is **explicit scope**:

```markdown
## Scope

### Allowed
- src/components/NewFeature/**
- src/utils/helpers.ts

### Forbidden
- src/core/**
- Any *.config.* files
- package.json
```

This prevents:

- Accidental changes to critical code
- Scope creep beyond the task
- Well-intentioned "improvements" elsewhere

**Rule**: If it's not in Allowed, it's forbidden by default.

---

## Definition of Done

Every task must have verifiable completion criteria:

### Bad (Vague)

```markdown
## Definition of Done
- Component works correctly
- Code is clean
```

### Good (Verifiable)

```markdown
## Definition of Done
- [ ] Component renders without errors
- [ ] All props are typed (no `any`)
- [ ] Unit tests cover: render, props, events
- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] Storybook story exists with all variants
```

The AI should be able to check each criterion programmatically or through clear observation.

---

## Next Steps

- [Setup Guide](/aidf/docs/setup/) - Integrate AIDF into your project
- [Writing AGENTS.md](/aidf/docs/agents-file/) - Create your context document
- [Defining Roles](/aidf/docs/roles/) - Set up specialized personas
