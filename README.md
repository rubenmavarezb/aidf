# AIDF - AI-Integrated Development Framework

[![CI](https://github.com/rubenmavarezb/aidf/actions/workflows/test.yml/badge.svg)](https://github.com/rubenmavarezb/aidf/actions/workflows/test.yml)
[![npm version](https://img.shields.io/npm/v/aidf.svg)](https://www.npmjs.com/package/aidf)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

**Structure your AI context. Automate your development tasks.**

**[Documentation](https://rubenmavarezb.github.io/aidf/)** | **[npm](https://www.npmjs.com/package/aidf)** | **[GitHub](https://github.com/rubenmavarezb/aidf)**

---

## Two Ways to Use AIDF

### 1. Context — Give any AI assistant structured project knowledge

No automation required. Just run `aidf init` and get a `.ai/` folder with structured context that any AI tool can read.

- Works with **Claude Code**, **Cursor**, **GitHub Copilot**, or any LLM
- Defines project architecture, conventions, and boundaries in `AGENTS.md`
- Provides specialized roles (developer, architect, tester, reviewer, documenter)
- Portable [Agent Skills](https://agentskills.io) for composable AI capabilities
- Scoped task templates keep AI focused on what matters

### 2. Automation — Execute scoped tasks autonomously

Run `aidf run` and let AI execute tasks in an iterative loop with built-in safety.

- Iterative execution with scope enforcement and validation
- Auto-commit after each iteration, auto-PR on completion
- Live progress bar with elapsed time, token tracking, and ETA
- Parallel task execution with dependency detection
- Watch mode for CI/CD pipelines
- Resume blocked tasks with preserved context
- Desktop, Slack, Discord, and email notifications

---

## Quick Start

```bash
npm install -g aidf

cd your-project
aidf init            # Create .ai/ folder with context and templates
aidf init --smart    # Create .ai/ folder + AI-customized AGENTS.md
aidf task create     # Create a task interactively
aidf run             # Execute the first pending task
```

## CLI Commands

| Command | Description | Key Flags |
|---------|-------------|-----------|
| `aidf init` | Initialize `.ai/` folder with templates | `--yes`, `--force`, `--smart` |
| `aidf init --smart` | Initialize with AI-powered project analysis | `--yes`, `--force` |
| `aidf run [tasks...]` | Execute tasks autonomously | `--parallel`, `--resume`, `--auto-pr`, `--quiet`, `--dry-run` |
| `aidf task create` | Create a task interactively | `--template <name>` |
| `aidf task list` | List all tasks with status | `--all` |
| `aidf task status [task]` | Show task details | |
| `aidf watch` | Auto-execute on new/modified tasks | `--debounce <ms>`, `--daemon` |
| `aidf status` | Project dashboard with stats | `--json` |
| `aidf hooks install` | Install git hooks | `--husky`, `--pre-commit`, `--force` |
| `aidf hooks uninstall` | Remove AIDF git hooks | |
| `aidf skills list` | List discovered skills | |
| `aidf skills init <name>` | Create a new skill | `--global` |
| `aidf skills validate` | Validate skills | |
| `aidf skills add <path>` | Add an external skill | |
| `aidf mcp serve` | Start MCP server on stdio | |
| `aidf mcp install` | Generate MCP config for Claude Desktop/Cursor | |

All commands support `--log-format <text|json>`, `--log-file <path>`, and `--log-rotate`.

## How It Works

```
aidf init → .ai/ folder → aidf task create → aidf run → AI executes → validates → commits
```

AIDF uses 5 layers of context that travel with your project:

| Layer | Purpose | Location |
|-------|---------|----------|
| **AGENTS.md** | Project overview, architecture, conventions, boundaries | `.ai/AGENTS.md` |
| **Roles** | Specialized AI personas with defined expertise | `.ai/roles/*.md` |
| **Skills** | Portable, composable capabilities ([agentskills.io](https://agentskills.io)) | `.ai/skills/*/SKILL.md` |
| **Tasks** | Scoped, executable prompts with clear boundaries | `.ai/tasks/*.md` |
| **Plans** | Multi-task initiatives grouping related work | `.ai/plans/*.md` |

The execution loop works iteratively: the AI reads context, makes changes, validates against scope rules, runs validation commands (lint, typecheck, test), and commits — repeating until all Definition of Done criteria are met or the task is blocked.

## Task Example

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

## Configuration

Create `.ai/config.yml` to customize behavior:

```yaml
version: 1

provider:
  type: claude-cli          # claude-cli | cursor-cli | anthropic-api | openai-api
  model: claude-sonnet-4-20250514  # model for API providers

execution:
  max_iterations: 50        # max iterations per task
  max_consecutive_failures: 3
  timeout_per_iteration: 300 # seconds

permissions:
  scope_enforcement: strict  # strict | ask | permissive
  auto_commit: true
  auto_push: false
  auto_pr: false

validation:
  pre_commit:
    - pnpm lint
    - pnpm typecheck
  pre_push:
    - pnpm test
  pre_pr:
    - pnpm test

git:
  commit_prefix: "aidf:"
  branch_prefix: "aidf/"

notifications:
  level: all               # all | errors | blocked
  desktop:
    enabled: true
  slack:
    enabled: false
    webhook_url: ""
  discord:
    enabled: false
    webhook_url: ""
```

## AI Providers

| Provider | How it works | Setup | Token Tracking |
|----------|-------------|-------|----------------|
| **claude-cli** (default) | Spawns Claude Code CLI | Install [Claude Code](https://claude.ai/code) | No |
| **cursor-cli** | Spawns Cursor Agent CLI | Install [Cursor CLI](https://cursor.com/cli) | No |
| **anthropic-api** | Direct API with tool calling | Set `ANTHROPIC_API_KEY` | Yes |
| **openai-api** | OpenAI API with tool calling | Set `OPENAI_API_KEY` | Yes |

API providers (anthropic-api, openai-api) include built-in file operation tools: read/write files, list directory contents, run commands, and signal task completion or blocking.

## MCP Integration

AIDF includes a built-in MCP (Model Context Protocol) server that exposes your project's AIDF context as tools and resources for any MCP-compatible client.

```bash
aidf mcp serve              # Start MCP server on stdio
aidf mcp install            # Show config for Claude Desktop / Cursor
```

**Tools:** `aidf_list_tasks`, `aidf_get_context`, `aidf_validate`, `aidf_create_task`, `aidf_analyze_project`
**Resources:** `aidf://agents`, `aidf://config`, `aidf://tasks/{name}`, `aidf://roles/{name}`

## Project Structure

```
.ai/
├── AGENTS.md              # Project context (architecture, conventions, boundaries)
├── ROLES.md               # Role selection guide
├── config.yml             # CLI configuration
│
├── prompts/               # Smart init prompt templates
│
├── roles/                 # AI personas
│   ├── architect.md
│   ├── developer.md
│   ├── tester.md
│   ├── reviewer.md
│   └── documenter.md
│
├── skills/                # Agent Skills (agentskills.io)
│   ├── aidf-architect/
│   ├── aidf-developer/
│   ├── aidf-tester/
│   ├── aidf-reviewer/
│   ├── aidf-documenter/
│   └── aidf-task-templates/
│
├── templates/             # Reusable templates
│   ├── TASK.template.md
│   ├── PLAN.template.md
│   └── tasks/             # Task type templates
│       ├── bug-fix.template.md
│       ├── new-feature.template.md
│       ├── refactor.template.md
│       ├── test-coverage.template.md
│       ├── documentation.template.md
│       └── dependency-update.template.md
│
├── tasks/                 # Active tasks
│   └── 001-my-task.md
│
└── plans/                 # Multi-task initiatives
    └── my-plan/
```

## Features

- **Live progress bar** — Iteration count, percentage, elapsed time, token usage, ETA
- **Parallel execution** — Run multiple tasks concurrently with `--parallel` and `--concurrency <n>`
- **Watch mode** — Monitor `.ai/tasks/` for new or modified tasks and auto-execute
- **Scope enforcement** — Strict, ask, or permissive modes to control out-of-scope changes
- **Auto-commit & auto-PR** — Commit after each iteration, create PR on completion
- **Resume blocked tasks** — Preserve context and retry with `--resume`
- **Git hooks** — Pre-commit (scope validation), commit-msg (conventional commits), pre-push (validation commands)
- **Agent Skills** — Portable, composable [agentskills.io](https://agentskills.io) capabilities with 6 built-in skills
- **Notifications** — Desktop, Slack, Discord, and email alerts for completed/failed/blocked tasks
- **Task templates** — Bug fix, new feature, refactor, test coverage, documentation, dependency update
- **Structured logging** — Text or JSON format, file output with optional rotation
- **Dry run mode** — Simulate execution without making changes
- **Multiple providers** — Claude CLI, Anthropic API, OpenAI API with token tracking
- **Smart init** (`aidf init --smart`) — AI analyzes your project and generates customized AGENTS.md and config.yml
- **MCP server** — Expose AIDF as tools and resources for any MCP-compatible client (Claude Desktop, Cursor)
- **Zod config validation** — config.yml validated at load time with descriptive errors
- **Real timeout enforcement** — Promise.race() prevents provider hangs
- **Enhanced security** — Path traversal protection, eval/backtick blocking, block_suspicious default true

## Troubleshooting

**`aidf run` fails with "No .ai directory found"**
Run `aidf init` first to create the `.ai/` folder.

**Task is blocked and won't continue**
Use `aidf run --resume .ai/tasks/blocked-task.md` after fixing the blocking issue.

**Provider not available**
Check that Claude Code is installed (`claude --version`) or that your API key is set (`ANTHROPIC_API_KEY` or `OPENAI_API_KEY`).

**Scope violation errors**
The task's `Scope > Forbidden` paths are being modified. Either update the scope or fix the AI's approach. Set `scope_enforcement: permissive` in config to allow all changes with warnings only.

**Watch mode not detecting tasks**
Ensure task files are in `.ai/tasks/` and have the `.md` extension. Check `--debounce` setting if changes are firing too quickly.

**Git hooks not running**
Run `aidf hooks install` again. If using Husky, add `--husky` flag. Check that `.git/hooks/` files are executable.

## Documentation

Full documentation available at **[rubenmavarezb.github.io/aidf](https://rubenmavarezb.github.io/aidf/)** (English, Español, Português, Français).

- [Core Concepts](./docs/concepts.md) — Understanding AIDF principles
- [Setup Guide](./docs/setup.md) — Integrating AIDF into your project
- [Writing AGENTS.md](./docs/agents-file.md) — Creating effective context documents
- [Defining Roles](./docs/roles.md) — Creating specialized AI personas
- [Task Design](./docs/tasks.md) — Writing effective task prompts
- [Best Practices](./docs/best-practices.md) — Patterns that work
- [Agent Skills](./docs/skills.md) — Portable agentskills.io capabilities
- [Integrations](./docs/integrations.md) — Claude Code, Cursor, GitHub Copilot
- [Git Hooks](./docs/hooks.md) — Scope validation, commit format, push checks
- [Notifications](./docs/notifications.md) — Desktop, Slack, Discord, email, webhooks

## License

MIT
