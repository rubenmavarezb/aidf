---
title: Integrations
description: Use AIDF with Claude Code, Cursor, GitHub Copilot, or any LLM — no CLI required.
---

This guide explains how to use AIDF with popular AI coding tools **without** requiring the AIDF CLI.

## Overview

AIDF is tool-agnostic. The core value is the **structured context** (AGENTS.md, roles, tasks), not the CLI. You can use AIDF with:

- Claude Code
- Cursor
- GitHub Copilot
- Any LLM with file access

---

## Claude Code Integration

### Setup

1. Copy the `.ai/` folder to your project (from `templates/.ai/`)
2. Customize `AGENTS.md` with your project details
3. Create tasks in `.ai/tasks/`

### Usage

**Option A: Single prompt with full context**

```bash
claude
> Read .ai/AGENTS.md, then .ai/roles/developer.md, then execute .ai/tasks/001-feature.md
```

**Option B: Reference files directly**

```bash
claude
> @.ai/AGENTS.md @.ai/roles/developer.md @.ai/tasks/001-feature.md
> Execute this task following the context and role.
```

**Option C: Add to CLAUDE.md**

```markdown
# CLAUDE.md

## Project Context
See .ai/AGENTS.md for full project context.

## Task Execution
When asked to execute a task:
1. Read .ai/AGENTS.md for project context
2. Read the role file specified in the task
3. Follow the task's Scope restrictions
4. Signal completion with <TASK_COMPLETE> when Definition of Done is met
```

### Autonomous Loop (Ralph-style)

For autonomous execution similar to the Ralph technique:

```bash
# Terminal
while true; do
  cat .ai/tasks/current-task.md | claude --print
  # Check for completion signal
  # Update task status
  sleep 1
done
```

Or use Claude Code's built-in loop:

```bash
claude
> Read .ai/AGENTS.md and .ai/tasks/001-feature.md.
> Execute autonomously until all Definition of Done criteria are met.
> Only modify files in the Allowed scope.
> Output <TASK_COMPLETE> when done or <BLOCKED: reason> if stuck.
```

---

## Cursor Integration

### Setup

1. Copy `.ai/` folder to your project
2. Create `.cursor/rules/aidf.mdc`:

```markdown
# AIDF Integration

## Context Loading
When working on this project:
- Read `.ai/AGENTS.md` for project overview, architecture, and conventions
- This is your primary source of truth for how the project works

## Task Execution
When asked to execute a task file:
1. Read the task file completely
2. Load the suggested role from `.ai/roles/{role}.md`
3. **STRICTLY** follow the Scope section:
   - Only modify files matching `Allowed` patterns
   - Never modify files matching `Forbidden` patterns
4. Check each item in `Definition of Done` before completing
5. Add `## Status: COMPLETED` to the task file when done

## Role Behavior
When a role file is loaded, adopt:
- The **Identity** as your persona
- The **Constraints** as hard rules
- The **Quality Criteria** as success metrics
```

### Usage in Cursor

**Composer:**
```
Execute the task in .ai/tasks/001-feature.md
```

**Agent Mode:**
```
@.ai/AGENTS.md @.ai/tasks/001-feature.md

Execute this task following AIDF conventions.
Stay within scope and signal <TASK_COMPLETE> when done.
```

### Cursor Settings (optional)

Add to `.cursor/settings.json`:

```json
{
  "workspaceContext": {
    "alwaysInclude": [".ai/AGENTS.md"]
  }
}
```

---

## GitHub Copilot Integration

### Setup

1. Copy `.ai/` folder to your project
2. Create `.github/copilot-instructions.md`:

```markdown
# Project Context

This project uses AIDF (AI-Integrated Development Framework).

## Key Files
- `.ai/AGENTS.md` - Project overview, architecture, conventions
- `.ai/roles/` - Specialized role definitions
- `.ai/tasks/` - Task definitions with scope and requirements

## When Modifying Code
1. Check if there's a relevant task in `.ai/tasks/`
2. Follow the conventions in `.ai/AGENTS.md`
3. Respect the scope defined in task files

## Code Style
See the Conventions section in `.ai/AGENTS.md`
```

---

## Generic LLM Integration (API)

For any LLM via API, construct prompts by concatenating:

```python
def build_aidf_prompt(task_path: str) -> str:
    agents = read_file('.ai/AGENTS.md')
    task = read_file(task_path)

    # Extract role from task
    role_name = extract_role(task)  # e.g., "developer"
    role = read_file(f'.ai/roles/{role_name}.md')

    return f"""
# Project Context
{agents}

# Your Role
{role}

# Task to Execute
{task}

# Instructions
1. Follow the project conventions
2. Stay within the Allowed scope
3. Never modify Forbidden files
4. Complete all Definition of Done items
5. Output <TASK_COMPLETE> when finished
"""
```

---

## Best Practices

### 1. Always Load AGENTS.md First

The project context should be loaded before any task execution. This ensures the AI understands:
- Project architecture
- Coding conventions
- Quality standards
- Boundaries (what NOT to do)

### 2. Use Scope as Hard Constraints

```markdown
## Scope

### Allowed
- `src/components/**`

### Forbidden
- `.env*`
- `src/config/**`
```

Tell the AI explicitly: "You MUST NOT modify files outside the Allowed scope."

### 3. Definition of Done = Exit Criteria

Don't let the AI decide when it's "done". The Definition of Done provides objective criteria:

```markdown
## Definition of Done
- [ ] Component renders without errors
- [ ] Tests pass (`pnpm test`)
- [ ] TypeScript compiles (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
```

### 4. Use Roles for Specialized Tasks

Different tasks need different expertise:

| Task Type | Role |
|-----------|------|
| New feature | developer |
| System design | architect |
| Bug investigation | developer + tester |
| Code review | reviewer |
| Documentation | documenter |

### 5. Signal Completion Explicitly

Train the AI to output clear signals:

- `<TASK_COMPLETE>` - All Definition of Done items met
- `<BLOCKED: reason>` - Cannot proceed, needs human input
- `<SCOPE_VIOLATION: file>` - Attempted to modify forbidden file

---

## Prompt Templates

### Quick Task Execution

```
Read .ai/AGENTS.md for context.
Execute .ai/tasks/{task}.md as the {role} role.
Output <TASK_COMPLETE> when Definition of Done is met.
```

### Thorough Task Execution

```
# Context Loading
1. Read .ai/AGENTS.md completely
2. Read .ai/roles/{role}.md for your role definition

# Task Execution
3. Read .ai/tasks/{task}.md
4. Analyze the requirements and scope
5. Implement the changes
6. Verify each Definition of Done item
7. Output <TASK_COMPLETE> or <BLOCKED: reason>

# Constraints
- ONLY modify files in Allowed scope
- NEVER modify files in Forbidden scope
- Follow all conventions from AGENTS.md
```

### Autonomous Loop Prompt

```
You are executing tasks autonomously using AIDF.

Current iteration: {n}
Task: .ai/tasks/{task}.md

Instructions:
1. Read the task and understand requirements
2. Make incremental progress
3. After each change, verify against Definition of Done
4. If ALL criteria met: output <TASK_COMPLETE>
5. If blocked: output <BLOCKED: specific reason>
6. If need to modify file outside scope: output <SCOPE_VIOLATION: path>

Previous output (if any):
{previous_output}

Begin execution.
```

---

## Troubleshooting

### AI ignores scope restrictions

Add explicit warnings:
```
WARNING: Modifying files outside the Allowed scope will cause task failure.
The following files are FORBIDDEN: {list}
```

### AI doesn't complete all Definition of Done items

Add a checklist verification step:
```
Before outputting <TASK_COMPLETE>, verify EACH item:
- [ ] Item 1: {status}
- [ ] Item 2: {status}
Only output <TASK_COMPLETE> if ALL items are checked.
```

### AI hallucinates project structure

Always load AGENTS.md first, which contains the actual directory structure.

---

## MCP Integration

AIDF includes a built-in [MCP](https://modelcontextprotocol.io) (Model Context Protocol) server that exposes your project's context, tasks, and operations as tools and resources. This allows AI clients like Claude Desktop or Cursor to interact with AIDF without using the CLI directly.

### Starting the MCP Server

```bash
aidf mcp serve
```

This starts the server on stdio, ready to be connected by any MCP-compatible client.

### Installing for a Client

```bash
aidf mcp install                        # defaults to claude-desktop
aidf mcp install --target cursor        # generate config for Cursor
```

This prints the appropriate configuration JSON for the selected client.

### Available Tools

| Tool | Description |
|------|-------------|
| `aidf_list_tasks` | List all tasks in the project with their status |
| `aidf_get_context` | Load the full project context (AGENTS.md + roles + skills) |
| `aidf_validate` | Run validation commands (lint, typecheck, tests) |
| `aidf_create_task` | Create a new task from a description |
| `aidf_analyze_project` | Analyze the project and return detected stack info |

### Available Resources

| URI | Description |
|-----|-------------|
| `aidf://agents` | The project's AGENTS.md content |
| `aidf://config` | The resolved config.yml |
| `aidf://tasks/{name}` | A specific task file by name |
| `aidf://roles/{name}` | A specific role file by name |

### Example: Claude Desktop Setup

Add the following to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "aidf": {
      "command": "aidf",
      "args": ["mcp", "serve"],
      "cwd": "/path/to/your/project"
    }
  }
}
```

Or run `aidf mcp install` from your project directory to generate this automatically.

---

### Context window too small

Prioritize loading order:
1. AGENTS.md (required)
2. Task file (required)
3. Role file (optional, can summarize)
4. Plan file (optional, only if exists)
