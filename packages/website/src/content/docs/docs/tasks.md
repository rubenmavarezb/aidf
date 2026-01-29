---
title: Task Design
description: Learn how to design well-structured tasks — the atomic unit of work in AIDF — with clear goals, scope, and verifiable completion criteria.
---

Tasks are the atomic unit of work in AIDF. A well-designed task gives AI everything it needs to execute autonomously and produce consistent results.

---

## Task Anatomy

```markdown
# TASK

## Goal
[One clear sentence - what must be accomplished]

## Task Type
[component | refactor | test | docs | architecture | bugfix]

## Suggested Roles
- [primary role]
- [secondary role if needed]

## Scope

### Allowed
- [paths that may be modified]

### Forbidden
- [paths that must NOT be modified]

## Requirements
[Detailed specifications]

## Definition of Done
- [ ] [Verifiable criterion 1]
- [ ] [Verifiable criterion 2]
- [ ] [Quality gate, e.g., "pnpm test passes"]

## Notes
[Additional context, warnings, tips]
```

---

## Section Deep Dive

### Goal

The goal is a **single sentence** that answers: "What will be true when this task is complete?"

**Bad Goals:**

```markdown
## Goal
Work on the button component and make it better.
```
- Vague
- No clear completion state
- "Better" is subjective

**Good Goals:**

```markdown
## Goal
Create a Button component with primary, secondary, and tertiary variants that supports icons and loading states.
```
- Specific deliverable
- Clear scope
- Measurable completion

### Task Type

Categorizing tasks helps AI understand the nature of the work:

| Type | Description | Typical Roles |
|------|-------------|---------------|
| `component` | Create new UI component | developer, tester |
| `refactor` | Restructure existing code | architect, developer |
| `test` | Add or improve tests | tester |
| `docs` | Documentation work | documenter |
| `architecture` | System design, tooling | architect |
| `bugfix` | Fix specific bug | developer |

### Scope

**This is critical.** Scope defines the boundaries of what AI can touch.

```markdown
## Scope

### Allowed
- src/components/Button/**
- src/components/index.ts (to add export)
- tests/components/Button.test.tsx

### Forbidden
- src/core/**
- src/utils/** (use existing utils, don't modify)
- Any configuration files
- package.json
```

**Rules:**

1. If it's not in `Allowed`, it's forbidden
2. Be as specific as possible
3. Use glob patterns for directories: `src/components/Button/**`
4. Explicitly list single files when needed

### Requirements

This is where you provide detailed specifications. Be explicit about:

**For Components:**

```markdown
## Requirements

### Props API

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'primary' \| 'secondary' \| 'tertiary'` | `'primary'` | Visual style |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Button size |
| `loading` | `boolean` | `false` | Shows loading spinner |
| `disabled` | `boolean` | `false` | Disables interaction |
| `leadingIcon` | `ReactNode` | - | Icon before text |
| `trailingIcon` | `ReactNode` | - | Icon after text |

### Behavior

- When `loading` is true, show spinner and disable button
- Forward all standard button HTML attributes
- Support `as` prop for polymorphism (render as `<a>` for links)

### Styling

- Use CSS custom properties from design tokens
- Support all interactive states (hover, active, focus, disabled)
- Follow BEM-like naming: `.pt-Button`, `.pt-Button--primary`
```

**For Refactoring:**

```markdown
## Requirements

### Current State
[Describe what exists now]

### Target State
[Describe what should exist after]

### Constraints
- No API changes (internal refactor only)
- Must maintain backward compatibility
- Performance must not degrade
```

**For Bug Fixes:**

```markdown
## Requirements

### Bug Description
[What is happening]

### Expected Behavior
[What should happen]

### Reproduction Steps
1. [Step 1]
2. [Step 2]
3. [Step 3]

### Root Cause (if known)
[Analysis of why this happens]
```

### Definition of Done

Every criterion must be **verifiable**. If you can't check it, it shouldn't be here.

**Bad Criteria:**

```markdown
## Definition of Done
- Code is clean
- Component works correctly
- Good test coverage
```

**Good Criteria:**

```markdown
## Definition of Done
- [ ] Component renders without errors
- [ ] All props from the API table are implemented
- [ ] TypeScript compilation passes (`pnpm typecheck`)
- [ ] ESLint passes with no warnings (`pnpm lint`)
- [ ] Tests exist for: default render, all variants, all sizes, loading state, disabled state
- [ ] Tests pass (`pnpm test`)
- [ ] No accessibility violations (test with `expectNoA11yViolations`)
- [ ] Storybook story exists with controls for all props
```

### Notes

Use this section for:

- Warnings about gotchas
- References to related code
- Decisions that were made
- Context that doesn't fit elsewhere

```markdown
## Notes

- The existing `Icon` component should be used for loading spinner
- Follow the pattern established in `src/components/Badge/` for structure
- Design tokens for colors are in `src/tokens/colors.css`
- Accessibility: Ensure button is focusable and announces loading state
```

---

## Task Templates by Type

### Component Task

```markdown
# TASK

## Goal
Create the [ComponentName] component with [key features].

## Task Type
component

## Suggested Roles
- developer
- tester

## Scope
### Allowed
- src/components/[ComponentName]/**
- src/components/index.ts
- stories/[ComponentName].stories.tsx

### Forbidden
- src/core/**
- src/tokens/**

## Requirements

### File Structure
Create:
- [ComponentName].tsx
- [ComponentName].types.ts
- [ComponentName].constants.ts
- [component-name].css
- [ComponentName].test.tsx
- index.ts

### Props API
[Table of props]

### Behavior
[Behavioral specifications]

### Styling
[CSS requirements]

## Definition of Done
- [ ] All files created following project structure
- [ ] All props implemented and typed
- [ ] CSS uses design tokens only
- [ ] Tests cover: render, props, interactions, a11y
- [ ] `pnpm quality:fast` passes
- [ ] Storybook story with all variants

## Notes
[Additional context]
```

### Refactor Task

```markdown
# TASK

## Goal
Refactor [area] to [improvement].

## Task Type
refactor

## Suggested Roles
- architect
- developer

## Scope
### Allowed
- [specific paths]

### Forbidden
- [paths to protect]

## Requirements

### Current State
[What exists now and its problems]

### Target State
[What should exist after]

### Migration Strategy
[How to get from current to target]

### Constraints
- No API changes
- No functionality changes
- Tests must continue passing

## Definition of Done
- [ ] All changes within scope
- [ ] No API changes (same exports, same props)
- [ ] All existing tests pass
- [ ] `pnpm quality:fast` passes
- [ ] No performance regression

## Notes
[Context about why this refactor]
```

### Test Task

```markdown
# TASK

## Goal
Improve test coverage for [area] to [target]%.

## Task Type
test

## Suggested Roles
- tester

## Scope
### Allowed
- tests/**
- src/**/*.test.tsx

### Forbidden
- Any non-test files

## Requirements

### Current Coverage
[Current metrics]

### Target Coverage
[Target metrics]

### Required Test Cases
- [ ] [Test case 1]
- [ ] [Test case 2]
- [ ] [Edge case 1]

### Testing Patterns
[Reference to test utilities, patterns to follow]

## Definition of Done
- [ ] Coverage meets target
- [ ] All new tests pass
- [ ] No flaky tests introduced
- [ ] Tests follow project patterns
- [ ] `pnpm test` passes

## Notes
[Any special testing considerations]
```

---

## Anti-Patterns

### Vague Scope

```markdown
## Scope
### Allowed
- src/
```

This allows modification of anything in `src/`. Be specific.

### Unmeasurable Done

```markdown
## Definition of Done
- Code is good quality
```

What is "good quality"? Replace with specific checks.

### Missing Context

```markdown
## Requirements
Build a form.
```

What fields? What validation? What submission behavior? Provide details.

### Overloaded Tasks

```markdown
## Goal
Build the authentication system including login, registration, password reset, OAuth integration, and user profile management.
```

This is too much. Break into multiple focused tasks.

---

## Tips

### One Task, One Purpose

A task should have one clear purpose. If you find yourself writing "and" multiple times in the goal, split it.

### Include File References

```markdown
## Notes
- Follow the pattern in `src/components/Button/` for structure
- Use utilities from `src/utils/form-validation.ts`
- Reference design at `docs/designs/login-form.png`
```

### Specify Output Format

When the output format matters:

```markdown
## Requirements

### Output Format
The component must export:
\`\`\`typescript
export { LoginForm } from "./LoginForm";
export type { LoginFormProps } from "./LoginForm.types";
\`\`\`
```

### Link Related Tasks

```markdown
## Notes
- Depends on: Task #003 (design tokens must exist first)
- Blocks: Task #007 (auth flow needs this form)
```

---

## Blocked Tasks and Resuming

When a task execution encounters a blocker that requires human intervention, AIDF automatically marks the task as `BLOCKED` and saves the execution state in the task file.

### Blocked Status Format

When a task is blocked, AIDF adds a status section to the task file:

```markdown
## Status: BLOCKED

### Execution Log
- **Started:** 2024-01-01T10:00:00.000Z
- **Iterations:** 5
- **Blocked at:** 2024-01-01T11:00:00.000Z

### Blocking Issue
\`\`\`
Missing API key configuration. The task requires an API key to be set in the environment, but it was not found.
\`\`\`

### Files Modified
- \`src/api/client.ts\`
- \`src/config/settings.ts\`

---
@developer: Review and provide guidance, then run \`aidf run --resume task.md\`
```

### Resuming a Blocked Task

After addressing the blocking issue or providing guidance, you can resume the task using the `--resume` flag:

```bash
aidf run --resume .ai/tasks/my-task.md
```

Or let AIDF auto-select from blocked tasks:

```bash
aidf run --resume
```

**What happens when resuming:**

1. AIDF loads the previous execution state (iteration count, files modified, blocking issue)
2. Execution continues from the next iteration after the block
3. The blocking issue is included in the prompt context so the AI understands what was wrong
4. Previous files modified are tracked and preserved
5. Resume attempt history is recorded in the task file

### Resume Attempt History

AIDF tracks resume attempts in the task file:

```markdown
### Resume Attempt History
- **Resumed at:** 2024-01-01T12:00:00.000Z
- **Previous attempt:** Iteration 5, blocked at 2024-01-01T11:00:00.000Z
- **Completed at:** 2024-01-01T13:00:00.000Z
- **Status:** completed
- **Iterations in this attempt:** 3
```

### Task Completion After Resume

When a task completes after being resumed, the BLOCKED status is replaced with a completion status and execution history:

```markdown
## Execution History

### Original Block
- **Started:** 2024-01-01T10:00:00.000Z
- **Blocked at:** 2024-01-01T11:00:00.000Z
- **Iterations before block:** 5
- **Blocking issue:** Missing API key configuration...

### Resume and Completion
- **Resumed at:** 2024-01-01T12:00:00.000Z
- **Completed at:** 2024-01-01T13:00:00.000Z
- **Total iterations:** 8
- **Files modified:** 5 files

---

## Status: COMPLETED
```

### Best Practices for Resuming

1. **Review the blocking issue** - Understand what went wrong before resuming
2. **Address the blocker** - Fix the issue or provide clear guidance in the task file
3. **Verify context** - Check that files modified in the previous attempt are still relevant
4. **Use resume history** - Review previous resume attempts to understand patterns

### When Tasks Get Blocked

Tasks are automatically marked as BLOCKED when:

- The AI explicitly signals `<BLOCKED: reason>` in its output
- Maximum iterations are reached
- Maximum consecutive failures are reached
- Critical errors occur that prevent continuation

### Error Handling

If you try to resume a task that is not blocked:

```bash
$ aidf run --resume .ai/tasks/normal-task.md
Error: Task is not blocked. Cannot use --resume on a task that is not in BLOCKED status.
```

Only tasks with `## Status: BLOCKED` can be resumed.
