---
title: Setup Guide
description: Step-by-step guide to integrate AIDF into your project with roles, tasks, and templates.
---

## Prerequisites

- An existing project (any language/framework)
- Basic understanding of your project's architecture
- Access to an AI assistant (Claude, GPT-4, Cursor, etc.)

---

## Step 1: Create the Structure

Create the `.ai` folder in your project root:

```bash
mkdir -p .ai/roles .ai/tasks .ai/plans .ai/templates
```

Or copy from AIDF:

```bash
cp -r /path/to/aidf/templates/.ai /your/project/
```

Your structure should look like:

```
your-project/
├── .ai/
│   ├── AGENTS.md           # You'll create this
│   ├── ROLES.md            # Role selection guide
│   ├── roles/              # AI personas
│   ├── tasks/              # Task prompts
│   ├── plans/              # Multi-task initiatives
│   └── templates/          # Reusable templates
├── src/
└── ...
```

---

## Step 2: Create AGENTS.md

This is the most important file. It gives AI complete context about your project.

Start with this structure:

```markdown
# AGENTS.md

## Project Overview

[What this project is, its purpose, who uses it]

## Architecture

### Structure
[Folder organization, key directories]

### Patterns
[Design patterns used: MVC, Atomic Design, etc.]

### Key Files
[Important files AI should know about]

## Technology Stack

- **Language**: [TypeScript, Python, etc.]
- **Framework**: [React, Django, etc.]
- **Build**: [Vite, Webpack, etc.]
- **Testing**: [Jest, Vitest, pytest, etc.]

## Conventions

### Naming
[File naming, variable naming, component naming]

### Code Style
[Formatting rules, linting configuration]

### File Structure
[How files within a module/component are organized]

## Quality Standards

### Testing
[Coverage requirements, what to test]

### Type Safety
[TypeScript strictness, type requirements]

### Documentation
[JSDoc, docstrings, README requirements]

## Boundaries

### Never Modify
[Critical files that should not be touched]

### Requires Approval
[Files that need human review before changes]

## Commands

[Common commands AI should know]

- `npm install` - Install dependencies
- `npm run dev` - Start development server
- `npm test` - Run tests
- `npm run lint` - Check code style
```

See [Writing AGENTS.md](/aidf/docs/agents-file/) for detailed guidance.

---

## Step 3: Select Roles

Review the roles in `.ai/roles/` and keep only those relevant to your project:

| Role | Keep If... |
|------|------------|
| `architect.md` | You do system design, refactoring |
| `developer.md` | You write features, fix bugs |
| `tester.md` | You write tests, improve coverage |
| `reviewer.md` | You want AI code review |
| `documenter.md` | You write documentation |

Customize each role for your project's specifics.

---

## Step 4: Configure Templates

Edit `.ai/templates/TASK.template.md` to match your workflow:

```markdown
# TASK

## Goal
<One clear sentence describing what must be done>

## Task Type
<component | refactor | test | docs | architecture>

## Suggested Roles
- <primary role>
- <secondary role if needed>

## Scope

### Allowed
- <paths that may be modified>

### Forbidden
- <paths that must not be touched>

## Requirements
<Detailed specifications>

## Definition of Done
- [ ] <Verifiable criterion>
- [ ] <Your standard quality check, e.g., "npm test passes">

## Notes
<Additional context, warnings, tips>
```

---

## Step 5: Add to .gitignore (Optional)

Decide what to track:

```gitignore
# Track everything (recommended)
# .ai/ is committed

# Or ignore active tasks
.ai/tasks/*.active.md

# Or ignore plans in progress
.ai/plans/*/WIP-*
```

Recommendation: **Commit everything**. The `.ai` folder is documentation that helps future contributors (human and AI).

---

## Step 6: Create Your First Task

```bash
cp .ai/templates/TASK.template.md .ai/tasks/$(date +%Y-%m-%d)-my-first-task.md
```

Edit the task file with your requirements.

---

## Step 7: Execute

### Option A: Full Context (Recommended for complex tasks)

Provide AI with:

1. AGENTS.md content
2. Relevant role definition
3. Task definition

```
[Paste AGENTS.md]

[Paste role definition]

[Paste task]
```

### Option B: Task Only (For simple tasks)

If AI has already seen AGENTS.md in the session:

```
[Paste task only]
```

### Option C: Reference (If AI has file access)

```
Read .ai/AGENTS.md, .ai/roles/developer.md, and .ai/tasks/my-task.md, then execute the task.
```

---

## Validation Checklist

After setup, verify:

- [ ] `.ai/` folder exists with correct structure
- [ ] `AGENTS.md` accurately describes your project
- [ ] At least one role is customized
- [ ] Task template matches your quality standards
- [ ] You can create and execute a simple test task

---

## Integration with Tools

### Cursor

Cursor automatically reads project files. Reference `.ai/AGENTS.md` in your prompts or add it to Cursor's context.

### Claude (via API or Console)

Paste relevant context at the start of conversations, or use Projects feature to persist context.

### VS Code + Extensions

Use workspace settings to reference `.ai/` files in AI extension configurations.

### CI/CD

Add validation that tasks meet Definition of Done:

```yaml
# Example: Verify no forbidden paths were modified
- name: Check scope compliance
  run: |
    # Script to verify changes are within allowed scope
```

---

## Next Steps

- [Writing AGENTS.md](/aidf/docs/agents-file/) - Deep dive into context documents
- [Defining Roles](/aidf/docs/roles/) - Customize AI personas
- [Task Design](/aidf/docs/tasks/) - Write effective tasks
- [Best Practices](/aidf/docs/best-practices/) - Patterns that work
