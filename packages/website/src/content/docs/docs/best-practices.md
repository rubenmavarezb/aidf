---
title: Best Practices
description: Patterns and anti-patterns learned from real-world AI-assisted development with AIDF.
---

Patterns and anti-patterns learned from real-world AI-assisted development.

---

## Context Management

### Do: Front-Load Context

Give AI project context at the start of a session, not piecemeal.

**Bad:**
```
You: "Add a button"
AI: *Creates generic button*
You: "Actually, we use TypeScript"
AI: *Rewrites with types*
You: "And we have specific naming conventions"
AI: *Rewrites again*
```

**Good:**
```
You: *Provides AGENTS.md + role + task*
AI: *Creates button following all conventions first time*
```

### Do: Keep AGENTS.md Updated

Treat AGENTS.md as living documentation. Update it when:

- You establish new patterns
- You make architectural decisions
- You learn from AI mistakes
- Project conventions evolve

### Don't: Assume AI Remembers

Even in long sessions, AI context can drift. For important tasks:

- Reference specific sections of AGENTS.md
- Re-state critical constraints
- Verify understanding before execution

---

## Task Design

### Do: Be Explicit About Scope

```markdown
## Scope

### Allowed
- src/components/Button/**
- src/components/index.ts (add export only)

### Forbidden
- src/core/**
- src/utils/**
- Any *.config.* files
```

### Do: Provide Examples

When you have specific expectations:

```markdown
## Requirements

### Example Usage

\`\`\`tsx
// Basic
<Button variant="primary">Click me</Button>

// With icon
<Button leadingIcon={<PlusIcon />}>Add Item</Button>

// As link
<Button as="a" href="/home">Go Home</Button>
\`\`\`
```

### Don't: Leave Room for Interpretation

**Bad:**
```markdown
## Requirements
Make it look nice and work well.
```

**Good:**
```markdown
## Requirements
- Follow design tokens in `src/tokens/`
- Support hover, active, focus, and disabled states
- Minimum touch target: 44x44px
- Color contrast: WCAG AA (4.5:1 for text)
```

### Don't: Overload Tasks

**Bad:**
```markdown
## Goal
Build the entire checkout flow including cart, shipping, payment, and confirmation.
```

**Good:**
```markdown
## Goal
Create the CartSummary component displaying line items with quantities and totals.
```

---

## Quality Assurance

### Do: Define Verifiable Completion

Every "Definition of Done" item should be checkable:

```markdown
## Definition of Done
- [ ] `pnpm lint` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes
- [ ] Component has Storybook story
- [ ] All props are documented with JSDoc
```

### Do: Require Tests

If your project has testing standards, enforce them:

```markdown
## Definition of Done
- [ ] Unit tests exist for: render, props, events
- [ ] Accessibility test with `expectNoA11yViolations`
- [ ] Coverage meets 80% threshold
```

### Don't: Skip Review

AI output should always be reviewed. Automate checks, but human review catches:

- Logic errors that pass tests
- Convention violations that aren't linted
- Architecture drift
- Security issues

---

## Role Usage

### Do: Match Role to Task

| Task | Best Role |
|------|-----------|
| "Build new component" | developer |
| "Design new feature" | architect |
| "Add test coverage" | tester |
| "Review this PR" | reviewer |
| "Write documentation" | documenter |

### Do: Use Role Constraints

Roles have built-in constraints. The tester role doesn't modify implementation code. The reviewer role suggests but doesn't rewrite.

### Don't: Mix Responsibilities

**Bad:**
```markdown
## Goal
Write tests and fix any bugs you find.
```

This mixes tester and developer roles. Split into:

1. Task: Write tests (tester role)
2. Task: Fix bugs found by tests (developer role)

---

## Iteration Patterns

### Do: Start Small, Iterate

1. Create basic implementation
2. Add tests
3. Refine based on feedback
4. Repeat

### Do: Checkpoint Complex Work

For large tasks, define checkpoints:

```markdown
## Checkpoints

### Checkpoint 1: Structure
- [ ] All files created
- [ ] Basic component renders

### Checkpoint 2: Functionality
- [ ] All props work
- [ ] Events fire correctly

### Checkpoint 3: Quality
- [ ] Tests pass
- [ ] Lint passes
- [ ] A11y passes
```

### Don't: Let AI Run Unbounded

Set clear boundaries and stopping points. AI will keep "improving" forever if you let it.

---

## Error Handling

### Do: Expect and Handle Failures

AI will make mistakes. Your workflow should:

1. Catch errors through automated checks
2. Provide clear feedback
3. Allow iteration

### Do: Learn from Failures

When AI consistently makes a mistake:

1. Add the correct pattern to AGENTS.md
2. Add a "Don't" to the relevant role
3. Add validation to Definition of Done

### Don't: Blame the Tool

If AI keeps making the same mistake, the context is probably unclear. Improve AGENTS.md rather than fighting the tool.

---

## Security

### Do: Define Forbidden Paths

Always protect:

```markdown
### Forbidden
- .env*
- **/credentials*
- **/secrets*
- .github/workflows/** (CI/CD)
```

### Do: Review Security-Sensitive Code

Never let AI-generated code touching auth, payments, or user data go unreviewed.

### Don't: Include Secrets in Context

Never put API keys, passwords, or tokens in AGENTS.md or tasks.

---

## Team Patterns

### Do: Share AGENTS.md

AGENTS.md should be committed to version control. It's documentation that helps:

- New team members understand the project
- AI assistants understand conventions
- Future you remember decisions

### Do: Standardize Task Templates

Use consistent task templates across the team:

- Same structure
- Same Definition of Done format
- Same scope conventions

### Don't: Create Personal Conventions

If one developer uses different patterns than AGENTS.md describes, AI gets confused. Keep conventions consistent.

---

## Performance

### Do: Cache Context

If your AI tool supports it, cache AGENTS.md and role definitions. Re-sending them every message wastes tokens and time.

### Do: Use Appropriate Detail Level

- For simple tasks: Task definition may be enough
- For complex tasks: Full AGENTS.md + role + task

### Don't: Over-Specify Simple Tasks

```markdown
# TASK

## Goal
Fix typo in README.md: "teh" → "the"

## Task Type
docs

## Scope
### Allowed
- README.md

### Forbidden
- Everything else

## Requirements
Find "teh" and replace with "the".

## Definition of Done
- [ ] Typo is fixed
- [ ] No other changes made
```

This is overkill. For trivial tasks, a simple prompt is fine.

---

## Evolution

### Do: Start Simple

Begin with:

1. Basic AGENTS.md
2. One or two roles
3. Simple task template

Add complexity as you learn what your project needs.

### Do: Measure Effectiveness

Track:

- Time from task creation to completion
- Number of iterations needed
- Types of errors that slip through
- AI-specific issues

### Don't: Over-Engineer Early

You don't need 15 roles and 50 pages of AGENTS.md on day one. Build what you need, when you need it.

---

## Summary Checklist

Before executing a task:

- [ ] AGENTS.md is up to date
- [ ] Appropriate role is selected
- [ ] Task has clear goal
- [ ] Scope is explicitly defined
- [ ] Requirements are specific
- [ ] Definition of Done is verifiable
- [ ] Human review is planned
