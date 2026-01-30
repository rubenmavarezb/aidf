# AGENTS.md

> This is the master context document for AI assistants working on this project.
> Customize each section for your specific project.

---

## AIDF Framework

This project uses **AIDF v1.0** (AI Development Framework) to provide structured context for AI assistants.

### Context Layers

| Layer | Source | Purpose |
|-------|--------|---------|
| **Layer 1 — Global** | `AGENTS.md` (this file) | Project identity, architecture, conventions, quality gates, boundaries |
| **Layer 2 — Role** | `.ai/roles/*.md` | Specialized expertise and behavior rules |
| **Layer 3 — Skill** | `.ai/skills/*.md` | Portable skill definitions and instructions |
| **Layer 4 — Task** | `.ai/tasks/*.md` | Exact scope (allowed/forbidden files), requirements, definition of done |
| **Layer 5 — Plan** | `.ai/plans/*.md` | Multi-task initiatives and sequencing |

**How layers combine:** Project conventions (Layer 1) + role expertise (Layer 2) + skill context (Layer 3) + task scope (Layer 4) = precise execution instructions.

### Navigation Guide

- **Starting a task?** → Read this file first, then your role in `roles/`, then the task in `tasks/`
- **Choosing a role?** → See `ROLES.md` for the quick reference matrix
- **Creating a task?** → Use templates in `templates/`
- **Framework docs:** https://rubenmavarezb.github.io/aidf/docs/concepts/

---

## Identity

This project is [PROJECT_NAME], a [TYPE: web app | mobile app | API | library | CLI tool] that [PRIMARY_PURPOSE].

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
- [ ] Verify environment is set up correctly

IMPORTANT: Skipping this checklist leads to rejected work.

---

## Project Overview

[PROJECT_NAME] is a [TYPE: web app | mobile app | API | library | CLI tool] that [PRIMARY_PURPOSE].

**Key characteristics:**

- [Characteristic 1]
- [Characteristic 2]
- [Characteristic 3]

**Target users:**

- [User type 1]
- [User type 2]

---

## Architecture

### Directory Structure

```
[PROJECT_ROOT]/
├── src/                    # Source code
│   ├── [folder]/           # [Description]
│   ├── [folder]/           # [Description]
│   └── [folder]/           # [Description]
├── tests/                  # Test files
├── docs/                   # Documentation
└── [other]/                # [Description]
```

### Key Patterns

**[Pattern Name]**

[Description of the pattern and when/why it's used]

**[Pattern Name]**

[Description]

### Key Files

| File | Purpose |
|------|---------|
| `[path]` | [What it does] |
| `[path]` | [What it does] |

---

## Technology Stack

| Category | Technology | Version | Notes |
|----------|------------|---------|-------|
| Language | [Language] | [x.x] | [Notes] |
| Framework | [Framework] | [x.x] | [Notes] |
| Build | [Tool] | [x.x] | [Notes] |
| Testing | [Tool] | [x.x] | [Notes] |
| Styling | [Approach] | - | [Notes] |
| Database | [DB] | [x.x] | [Notes] |

---

## Environment

<env>
Language: [Language] [version]
Framework: [Framework] [version]
Package Manager: [package_manager]
Node Version: [version]
</env>

### Required Environment Variables

| Variable | Purpose | Example | Required |
|----------|---------|---------|----------|
| `[VAR_NAME]` | [Description] | `[example]` | Yes/No |

### Configuration Files

| File | Purpose | Notes |
|------|---------|-------|
| `[config_file]` | [Description] | [Notes] |

IMPORTANT: NEVER commit sensitive values. Use `.env.example` for documentation.

---

## Conventions

IMPORTANT: Match these patterns EXACTLY when writing new code. Deviations will be rejected.

### File Naming

| Type | Pattern | Example | Wrong |
|------|---------|---------|-------|
| Components | [Convention] | `[Example]` | `[Wrong example]` |
| Utilities | [Convention] | `[Example]` | `[Wrong example]` |
| Tests | [Convention] | `[Example]` | `[Wrong example]` |
| Styles | [Convention] | `[Example]` | `[Wrong example]` |
| Types | [Convention] | `[Example]` | `[Wrong example]` |

### Code Style

#### Component Pattern

```typescript
// ✅ CORRECT - Named export, function declaration
export function ComponentName({ prop }: Props) {
  return <div>...</div>;
}

// ❌ WRONG - Default export
export default function ComponentName() { ... }
```

Why: Named exports enable better tree-shaking and IDE support.

#### Import Order

```typescript
// ✅ CORRECT - Ordered imports
import { useState } from 'react';              // 1. External
import { Button } from '@/components/ui';     // 2. Internal absolute
import { formatDate } from '../utils';          // 3. Relative
import styles from './Component.module.css';   // 4. Styles

// ❌ WRONG - Mixed order
import styles from './styles';
import { formatDate } from '../utils';
import { useState } from 'react';
```

Why: Consistent import order prevents merge conflicts and improves readability.

#### Type Definitions

```typescript
// ✅ CORRECT - Interface in separate file or top of file
export interface ComponentProps {
  title: string;
  count?: number;
}

// ❌ WRONG - Inline object types
export function Component({ title, count }: { title: string; count?: number }) { ... }
```

Why: Separate type definitions improve reusability and maintainability.

#### Error Handling

```typescript
// ✅ CORRECT - Typed errors with context
class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`, 404);
  }
}

// ❌ WRONG - Generic throws with string messages
throw new Error('not found');
```

Why: Typed errors enable consistent handling, better debugging, and proper HTTP status codes.

#### Async Patterns

```typescript
// ✅ CORRECT - Async/await with explicit return type
async function fetchUser(id: string): Promise<User> {
  try {
    const user = await userRepository.findById(id);
    if (!user) throw new NotFoundError('User', id);
    return user;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new InternalError('Failed to fetch user', { cause: error });
  }
}

// ❌ WRONG - No return type, raw .then(), no error handling
function fetchUser(id) {
  return userRepository.findById(id).then(user => user);
}
```

Why: Explicit return types and structured error handling prevent silent failures and unhandled rejections.

### Component/Module Structure

```
[ModuleName]/
├── [file].ts           # [Purpose]
├── [file].ts           # [Purpose]
├── [file].test.ts      # [Purpose]
└── index.ts            # [Purpose]
```

---

## Quality Standards

IMPORTANT: These standards apply to ALL code in this project.

### Testing

- Minimum coverage: [X]%
- Required tests:
  - [Test type 1]
  - [Test type 2]
  - [Test type 3]

### Type Safety

- [Requirement 1]
- [Requirement 2]

MUST: All code must be fully typed. No `any` types allowed.

### Code Style

- Linting: [Tool] with [config]
- Formatting: [Tool]
- All code must pass: `[command]`

---

## Quality Gates

CRITICAL: Before ANY task can be marked complete, ALL of these MUST pass.

### Required Checks

| Check | Command | Expected Result |
|-------|---------|-----------------|
| Lint | `[lint_command]` | Zero errors, zero warnings |
| Types | `[typecheck_command]` | Zero errors |
| Tests | `[test_command]` | All tests pass |
| Build | `[build_command]` | Builds successfully |

### Verification Process

1. Run ALL commands in the table above
2. Capture output of each command
3. If ANY fails, task is NOT complete
4. Fix issues and re-run ALL checks
5. Only mark complete when ALL pass

IMPORTANT: Partial passes are not acceptable. ALL gates must pass.

MUST: Document any gate failures and how they were resolved.

---

## Boundaries

### NEVER Do (will reject the work)

- **NEVER** modify files in `[path]` without explicit approval
- **NEVER** add new dependencies to `package.json` without approval
- **NEVER** skip quality gates
- **NEVER** modify files outside the task scope
- **NEVER** commit sensitive values (API keys, passwords, tokens)

CRITICAL: Violating these boundaries invalidates ALL work done.

### ALWAYS Do

- **ALWAYS** check scope before modifying files
- **ALWAYS** run quality gates before marking complete
- **ALWAYS** follow conventions exactly
- **ALWAYS** write tests for new functionality
- **ALWAYS** verify environment variables are set correctly

### Requires Discussion

- [Action requiring discussion 1]
- [Action requiring discussion 2]

IMPORTANT: When in doubt, ask before modifying.

---

## Commands

### Development

| Command | Description | When to Run |
|---------|-------------|-------------|
| `[command]` | [Description] | [When: e.g., "Before starting new feature", "After pulling changes"] |
| `[command]` | [Description] | [When] |
| `[command]` | [Description] | [When] |

### Quality Checks

CRITICAL: These MUST pass before marking any task complete.

| Command | Description | When to Run |
|---------|-------------|-------------|
| `[lint_command]` | Run linter | Before every commit, after code changes |
| `[typecheck_command]` | Type checking | Before every commit, after code changes |
| `[test_command]` | Run tests | Before every commit, after code changes |
| `[build_command]` | Build project | Before every commit, after code changes |

### Build & Deploy

| Command | Description | When to Run |
|---------|-------------|-------------|
| `[command]` | [Description] | [When] |
| `[command]` | [Description] | [When] |

### Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| `[error message or symptom]` | [Why it happens] | `[command or action to fix]` |
| `[error message or symptom]` | [Why it happens] | `[command or action to fix]` |
| `[error message or symptom]` | [Why it happens] | `[command or action to fix]` |

### Command Sequences

**[Workflow Name: e.g., "Start New Feature"]**

```bash
[command 1]   # [Step description]
[command 2]   # [Step description]
[command 3]   # [Step description]
```

**[Workflow Name: e.g., "Pre-Commit Verification"]**

```bash
[command 1]   # [Step description]
[command 2]   # [Step description]
[command 3]   # [Step description]
```

**[Workflow Name: e.g., "Reset Development Environment"]**

```bash
[command 1]   # [Step description]
[command 2]   # [Step description]
```

---

## Structured Blocks

Roles and tasks use XML-style blocks to structure AI thinking. These are the available blocks:

| Block | Used By | Purpose |
|-------|---------|---------|
| `<task_analysis>` | All roles | Analyze before implementing |
| `<completion_check>` | All roles | Verify before marking complete |
| `<implementation_plan>` | Developer | Plan code changes |
| `<design_rationale>` | Architect | Document design decisions |
| `<test_plan>` | Tester | Plan test cases |
| `<pr_analysis>` | Reviewer | Analyze PR changes |
| `<documentation_plan>` | Documenter | Plan documentation |

See each role's "Response Format" section for detailed block templates.

---

## Additional Context

### [Section Name]

[Additional context specific to your project]

### [Section Name]

[Additional context]

---

IMPORTANT: Update this document when patterns change, decisions are made, or you learn from AI mistakes. This document must remain accurate and current.
