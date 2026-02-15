# aidf

[![CI](https://github.com/rubenmavarezb/aidf/actions/workflows/test.yml/badge.svg)](https://github.com/rubenmavarezb/aidf/actions/workflows/test.yml)
[![npm version](https://img.shields.io/npm/v/aidf.svg)](https://www.npmjs.com/package/aidf)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

**Structure your AI context. Automate your development tasks.**

**[Documentation](https://rubenmavarezb.github.io/aidf/)** | **[GitHub](https://github.com/rubenmavarezb/aidf)**

## Installation

```bash
npm install -g aidf
```

## Quick Start

```bash
aidf init --smart    # Create .ai/ with AI-customized config
aidf task create     # Create a task interactively
aidf run             # Execute the first pending task
aidf status          # View project dashboard
```

## Two Use Cases

**Context** — Give any AI assistant structured project knowledge. Works with Claude Code, Cursor, Copilot, or any LLM. Just run `aidf init` — no automation required.

**Automation** — Execute scoped tasks autonomously with `aidf run`. Iterative AI execution loop with scope enforcement, validation, and auto-commit.

## Commands

| Command | Description | Key Flags |
|---------|-------------|-----------|
| `aidf init` | Initialize `.ai/` folder | `--yes`, `--force`, `--smart` |
| `aidf run [tasks...]` | Execute tasks autonomously | `--parallel`, `--resume`, `--auto-pr`, `--quiet`, `--dry-run` |
| `aidf task create` | Create a task interactively | `--template <name>` |
| `aidf task list` | List all tasks with status | `--all` |
| `aidf task status` | Show task details | |
| `aidf watch` | Auto-execute on new/modified tasks | `--debounce <ms>` |
| `aidf status` | Project dashboard | `--json` |
| `aidf hooks install` | Install git hooks | `--husky`, `--pre-commit` |
| `aidf hooks uninstall` | Remove AIDF git hooks | |
| `aidf skills list` | List discovered skills | |
| `aidf skills init <name>` | Create a new skill | `--global` |
| `aidf skills validate` | Validate skills | |
| `aidf skills add <path>` | Add an external skill | |
| `aidf mcp serve` | Start MCP server for AI clients | |
| `aidf mcp install` | Generate MCP config | `--target <client>` |

## Configuration

```yaml
version: 1
provider:
  type: claude-cli       # claude-cli | cursor-cli | anthropic-api | openai-api
  model: claude-sonnet-4-20250514
execution:
  max_iterations: 50
  max_consecutive_failures: 3
  timeout_per_iteration: 300
permissions:
  scope_enforcement: strict  # strict | ask | permissive
  auto_commit: true
  auto_push: false
  auto_pr: false
validation:
  pre_commit: [pnpm lint, pnpm typecheck]
  pre_push: [pnpm test]
git:
  commit_prefix: "aidf:"
  branch_prefix: "aidf/"
```

## Providers

| Provider | Setup | Token Tracking |
|----------|-------|----------------|
| **claude-cli** (default) | Install [Claude Code](https://claude.ai/code) | No |
| **cursor-cli** | Install [Cursor CLI](https://cursor.com/cli) | No |
| **anthropic-api** | Set `ANTHROPIC_API_KEY` | Yes |
| **openai-api** | Set `OPENAI_API_KEY` | Yes |

## Features

- Live progress bar with elapsed time, token tracking, and ETA
- Parallel task execution with dependency detection
- Watch mode for CI/CD pipelines
- Scope enforcement (strict, ask, permissive)
- Auto-commit and auto-PR creation
- Resume blocked tasks with preserved context
- Git hooks: pre-commit, commit-msg, pre-push
- Notifications: desktop, Slack, Discord, email
- Agent Skills: portable, composable [agentskills.io](https://agentskills.io) capabilities (6 built-in)
- Task templates: bug-fix, new-feature, refactor, test-coverage, documentation, dependency-update
- Structured logging (text/JSON) with file output and rotation
- Dry run mode
- Smart init — AI analyzes project and generates customized AGENTS.md and config.yml
- MCP server — Expose AIDF context as MCP tools and resources
- Zod config validation — catch config errors at load time
- Real timeout enforcement with Promise.race()
- Enhanced security: path traversal protection, eval/backtick blocking

## Documentation

Full documentation: **[rubenmavarezb.github.io/aidf](https://rubenmavarezb.github.io/aidf/)** (English, Español, Português, Français)

Source: [github.com/rubenmavarezb/aidf](https://github.com/rubenmavarezb/aidf)

## License

MIT
