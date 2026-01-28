# aidf

AI-Integrated Development Framework CLI - Autonomous task execution with AI assistants.

[![CI](https://github.com/rubenmavarezb/aidf/actions/workflows/test.yml/badge.svg)](https://github.com/rubenmavarezb/aidf/actions/workflows/test.yml)
[![npm version](https://img.shields.io/npm/v/aidf.svg)](https://www.npmjs.com/package/aidf)

## Installation

```bash
npm install -g aidf
```

## Quick Start

```bash
# Initialize AIDF in your project
aidf init

# Create a new task
aidf task new

# Run a task autonomously
aidf run .ai/tasks/my-task.md

# Check project status
aidf status
```

## Commands

| Command | Description |
|---------|-------------|
| `aidf init` | Initialize AIDF in current project |
| `aidf task new` | Create a new task interactively |
| `aidf task list` | List all tasks |
| `aidf run <task>` | Execute a task autonomously |
| `aidf run --resume` | Resume a blocked task |
| `aidf status` | Show project dashboard |

## How It Works

1. **Context**: AIDF loads your project context from `.ai/AGENTS.md`
2. **Roles**: Specialized AI personas (developer, tester, architect, etc.)
3. **Tasks**: Scoped, executable prompts with clear boundaries
4. **Execution**: Iterative loop with validation and auto-commit

## Configuration

Create `.ai/config.yml`:

```yaml
version: 1
provider:
  type: claude-cli  # or anthropic-api, openai-api
execution:
  max_iterations: 50
  max_consecutive_failures: 3
permissions:
  auto_commit: true
  auto_push: false
```

## Providers

- **claude-cli** (default): Uses Claude Code CLI
- **anthropic-api**: Direct Anthropic API with tool calling
- **openai-api**: OpenAI API with tool calling

## Documentation

Full documentation: [github.com/rubenmavarezb/aidf](https://github.com/rubenmavarezb/aidf)

## License

MIT
