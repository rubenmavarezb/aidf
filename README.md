# AIDF - AI-Integrated Development Framework

[![CI](https://github.com/rubenmavarezb/aidf/actions/workflows/test.yml/badge.svg)](https://github.com/rubenmavarezb/aidf/actions/workflows/test.yml)
[![npm version](https://img.shields.io/npm/v/aidf.svg)](https://www.npmjs.com/package/aidf)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

A framework for structured, consistent, and safe AI-assisted software development. Define context, roles, and scoped tasks — then let AI execute autonomously.

## Quick Start

```bash
# Install the CLI
npm install -g aidf

# Initialize AIDF in your project
cd your-project
aidf init

# Create your first task
aidf task new

# Run it autonomously
aidf run .ai/tasks/001-my-task.md
```

## What is AIDF?

AIDF treats AI as a **team member** that needs structure to be effective:

| Layer | Purpose | File |
|-------|---------|------|
| **Context** | Project understanding | `.ai/AGENTS.md` |
| **Roles** | Specialized personas | `.ai/roles/*.md` |
| **Tasks** | Scoped, executable prompts | `.ai/tasks/*.md` |
| **Plans** | Multi-task initiatives | `.ai/plans/*.md` |

### Without AIDF

```
Developer: "Add a login form"
AI: Creates random structure, inconsistent with project
Developer: Spends time fixing and adapting
```

### With AIDF

```
Developer: aidf run .ai/tasks/add-login-form.md
AI: Follows project conventions, respects boundaries, auto-commits
Developer: Reviews and merges
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `aidf init` | Initialize `.ai/` folder with templates |
| `aidf task new` | Create a task interactively |
| `aidf task list` | List all tasks with status |
| `aidf run <task>` | Execute a task autonomously |
| `aidf run --resume` | Resume a blocked task |
| `aidf status` | Project dashboard with stats |

## Task Examples

### Bug Fix

```markdown
# TASK: Fix login timeout

## Goal
Fix the 30-second timeout on the login API endpoint.

## Task Type
bugfix

## Suggested Roles
- developer

## Scope
### Allowed
- src/api/auth/**
- src/config/timeouts.ts
- tests/api/auth.test.ts

### Forbidden
- src/api/users/**
- database migrations

## Requirements
- Increase timeout to 60 seconds
- Add retry logic with exponential backoff
- Log timeout events for monitoring

## Definition of Done
- [ ] Login no longer times out under normal conditions
- [ ] Retry logic implemented with 3 attempts
- [ ] Unit tests cover timeout and retry scenarios
- [ ] `pnpm test` passes
```

### New Feature

```markdown
# TASK: Add dark mode

## Goal
Implement dark mode toggle with system preference detection.

## Task Type
component

## Suggested Roles
- developer

## Scope
### Allowed
- src/components/ThemeToggle/**
- src/hooks/useTheme.ts
- src/styles/themes/**

### Forbidden
- src/api/**
- package.json

## Requirements
- Toggle component with sun/moon icons
- Persist preference in localStorage
- Detect system preference on first visit
- Smooth CSS transition between themes

## Definition of Done
- [ ] Toggle switches between light and dark
- [ ] Preference persists across sessions
- [ ] System preference detected on first visit
- [ ] No flash of wrong theme on page load
- [ ] `pnpm test` passes
```

### Refactor

```markdown
# TASK: Extract auth middleware

## Goal
Refactor inline auth checks into a reusable middleware.

## Task Type
refactor

## Suggested Roles
- architect
- developer

## Scope
### Allowed
- src/middleware/auth.ts (new)
- src/api/routes/*.ts
- tests/middleware/auth.test.ts (new)

### Forbidden
- src/database/**
- src/config/**

## Requirements
### Current State
Auth checks duplicated across 12 route handlers.

### Target State
Single `requireAuth()` middleware applied to protected routes.

### Constraints
- No API behavior changes
- All existing tests must pass

## Definition of Done
- [ ] Middleware extracts and validates JWT
- [ ] All 12 routes use the middleware
- [ ] No duplicated auth logic remains
- [ ] Existing tests pass unchanged
- [ ] `pnpm test` passes
```

## Configuration

Create `.ai/config.yml` to customize behavior:

```yaml
version: 1

provider:
  type: claude-cli          # claude-cli | anthropic-api | openai-api
  model: claude-sonnet-4-20250514  # model for API providers

execution:
  max_iterations: 50        # max iterations per task
  max_consecutive_failures: 3
  timeout_per_iteration: 300 # seconds

permissions:
  scope_enforcement: strict  # strict | ask | warn
  auto_commit: true          # commit after each iteration
  auto_push: false           # push after completion
  auto_pr: false             # create PR after completion

validation:
  pre_commit:
    - pnpm lint
    - pnpm typecheck
  pre_push:
    - pnpm test

git:
  commit_prefix: "aidf:"
  branch_prefix: "aidf/"
```

## AI Providers

| Provider | How it works | Setup |
|----------|-------------|-------|
| **claude-cli** (default) | Uses Claude Code CLI | Install [Claude Code](https://claude.ai/code) |
| **anthropic-api** | Direct API with tool calling | Set `ANTHROPIC_API_KEY` |
| **openai-api** | OpenAI API with tool calling | Set `OPENAI_API_KEY` |

## Project Structure

```
.ai/
├── AGENTS.md              # Project context (architecture, conventions, boundaries)
├── ROLES.md               # Role selection guide
├── config.yml             # CLI configuration
│
├── roles/                 # AI personas
│   ├── architect.md
│   ├── developer.md
│   ├── tester.md
│   ├── reviewer.md
│   └── documenter.md
│
├── templates/             # Reusable templates
│   ├── TASK.template.md
│   ├── PLAN.template.md
│   └── tasks/             # Task type templates
│       ├── new-feature.template.md
│       ├── bug-fix.template.md
│       ├── refactor.template.md
│       └── ...
│
├── tasks/                 # Active tasks
│   └── 001-my-task.md
│
└── plans/                 # Multi-task initiatives
    └── my-plan/
```

## Troubleshooting

**`aidf run` fails with "No .ai directory found"**
Run `aidf init` first to create the `.ai/` folder.

**Task is blocked and won't continue**
Use `aidf run --resume .ai/tasks/blocked-task.md` after fixing the blocking issue.

**Provider not available**
Check that Claude Code is installed (`claude --version`) or that your API key is set (`ANTHROPIC_API_KEY` or `OPENAI_API_KEY`).

**Scope violation errors**
The task's `Scope > Forbidden` paths are being modified. Either update the scope or fix the AI's approach.

## Documentation

- [Core Concepts](./docs/concepts.md) - Understanding AIDF principles
- [Setup Guide](./docs/setup.md) - Integrating AIDF into your project
- [Writing AGENTS.md](./docs/agents-file.md) - Creating effective context documents
- [Defining Roles](./docs/roles.md) - Creating specialized AI personas
- [Task Design](./docs/tasks.md) - Writing effective task prompts
- [Best Practices](./docs/best-practices.md) - Patterns that work
- [Integrations](./docs/integrations.md) - Claude Code, Cursor, GitHub Copilot

## Compatibility

AIDF works with any AI assistant:

- **[Claude Code](https://claude.ai/code)** - Full autonomous execution
- **Cursor** - Rules template included
- **GitHub Copilot** - Instructions template
- **Any LLM** - Prompt templates for API usage

## License

MIT
