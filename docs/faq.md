# FAQ

## General

### What is AIDF?

AIDF (AI-Integrated Development Framework) is two things:

1. **A documentation framework** — Markdown templates and conventions that give AI agents structured context about your project (architecture, roles, tasks, plans).
2. **A CLI tool** (`aidf`) — Automates task execution with scope enforcement, validation, auto-commit, and notifications.

You can use the documentation framework on its own (just the `.ai/` folder with markdown files) or combine it with the CLI for full automation.

### What problem does AIDF solve?

When you use AI coding agents (Claude, Cursor, etc.) on a real project, you run into recurring issues:

- **No shared context** — The AI doesn't know your conventions, architecture, or boundaries. You repeat yourself every session.
- **No scoping** — The AI might modify files it shouldn't touch, breaking unrelated parts of the codebase.
- **No validation** — There's no automatic check that the AI's output passes linting, type-checking, or tests before it gets committed.
- **No traceability** — Work done by AI agents isn't tracked. There's no record of what was attempted, what succeeded, and what got blocked.
- **No task decomposition** — Complex work needs to be broken into scoped units. Without structure, you get unfocused AI sessions.

AIDF solves all of these by providing persistent project context, scoped tasks, automated validation, and a structured execution loop.

### How is AIDF different from using Claude or Cursor directly?

Using Claude or Cursor directly is like hiring a contractor with no project brief — they're skilled but don't know your conventions, boundaries, or what "done" means.

AIDF adds the missing structure:

| Without AIDF | With AIDF |
|---|---|
| AI starts fresh every session | AI reads AGENTS.md, roles, and task definitions |
| AI can edit any file | ScopeGuard restricts changes to allowed paths |
| You manually check lint/tests | Validation runs automatically after each iteration |
| No record of AI work | Task files track status (COMPLETED/BLOCKED/FAILED) |
| You babysit the AI | The CLI runs an autonomous execution loop |

### Do I need to use all five context layers?

No. The layers are additive:

- **Minimum viable setup**: Just an `AGENTS.md` file. This alone gives any AI agent useful project context.
- **Add roles** when you want specialized behavior (e.g., a "tester" persona that focuses on coverage).
- **Add tasks** when you want scoped, repeatable work units with clear completion criteria.
- **Add skills** when you want portable, reusable capabilities across projects.
- **Add plans** when you need to coordinate multiple related tasks.

Start small and add layers as your needs grow.

---

## Architecture

### What are the 5 context layers?

1. **AGENTS.md** — Project-wide source of truth (architecture, conventions, boundaries)
2. **Roles** — Specialized AI personas (architect, developer, tester, reviewer, documenter)
3. **Skills** — Portable capabilities following the [agentskills.io](https://agentskills.io) standard
4. **Tasks** — Scoped executable prompts with goal, allowed/forbidden paths, and Definition of Done
5. **Plans** — Multi-task initiatives grouping related work

Each layer adds specificity. AGENTS.md sets the baseline, a role narrows the focus, and a task defines exactly what to do and where.

### How does the execution loop work?

When you run `aidf run`, the CLI:

1. Loads context from the `.ai/` folder (AGENTS.md + role + task + skills)
2. Builds a prompt with all the context
3. Sends it to the configured AI provider
4. Checks file changes against scope rules (ScopeGuard)
5. Runs validation commands (lint, typecheck, tests)
6. Auto-commits if enabled
7. Detects completion or blocked signals
8. Repeats until the task is done or the iteration limit is reached

### What providers are supported?

| Provider | How it works | Token tracking |
|---|---|---|
| `claude-cli` | Spawns `claude --print` subprocess | No |
| `cursor-cli` | Spawns `agent --print` subprocess | No |
| `anthropic-api` | Direct Anthropic API with tool calling | Yes |
| `openai-api` | Direct OpenAI API with tool calling | Yes |

CLI providers (`claude-cli`, `cursor-cli`) stream stdout from a subprocess. API providers (`anthropic-api`, `openai-api`) use tool calling with built-in file operation tools.

### What does scope enforcement do?

Each task defines allowed and forbidden file paths. The ScopeGuard validates every file change against these rules. Three modes are available:

- **strict** — Reject any out-of-scope changes immediately
- **ask** — Prompt the user for approval on out-of-scope changes
- **permissive** — Allow all changes but log warnings

This prevents the AI from making well-intentioned but unwanted changes outside the task's boundaries.

---

## Setup & Usage

### How do I install AIDF?

```bash
npm install -g aidf
```

Then initialize your project:

```bash
cd your-project
aidf init
```

This creates the `.ai/` folder with templates for AGENTS.md, roles, tasks, and configuration.

### How do I configure AIDF?

Edit `.ai/config.yml` in your project root:

```yaml
version: 1
provider:
  type: claude-cli     # claude-cli | cursor-cli | anthropic-api | openai-api
execution:
  max_iterations: 50
  max_consecutive_failures: 3
  timeout_per_iteration: 300
permissions:
  scope_enforcement: strict  # strict | ask | permissive
  auto_commit: true
validation:
  pre_commit: [pnpm lint, pnpm typecheck]
  pre_push: [pnpm test]
```

### How do I run a task?

```bash
aidf run --task tasks/my-task.md
```

The CLI loads all context, executes the task through the configured provider, validates the output, and optionally commits the result.

### Can I run multiple tasks in parallel?

Yes. The `ParallelExecutor` detects scope dependencies between tasks. Tasks with non-overlapping scopes run concurrently; tasks with conflicting scopes are serialized automatically.

---

## Skills

### What are skills?

Skills are portable, composable capabilities that follow the [agentskills.io](https://agentskills.io) standard. Each skill is a `SKILL.md` file with YAML frontmatter (name, description, version, tags) and markdown instructions.

### Where are skills discovered from?

The `SkillLoader` scans three locations:

1. **Project skills** — `.ai/skills/` in your project
2. **Global skills** — A shared global directory
3. **Config directories** — Extra paths defined in `.ai/config.yml` under `skills.directories`

### Can I disable skills?

Yes. Set `skills.enabled: false` in `.ai/config.yml`.

---

## Troubleshooting

### My task didn't complete. Why?

Common reasons:

- **Iteration limit reached** — Increase `max_iterations` in config.yml
- **Consecutive failures** — The AI hit the failure threshold. Check validation errors in the task's status section.
- **Blocked** — The AI detected it couldn't proceed and signaled `<TASK_BLOCKED>`. The reason is written to the task file.
- **Timeout** — An iteration exceeded `timeout_per_iteration`.

Check the task `.md` file — the executor writes a `## Status` section with execution logs.

### How do I debug scope violations?

Run with `scope_enforcement: ask` instead of `strict`. This lets you see exactly which files the AI tried to modify outside the task's scope, and approve or reject each one.

### The AI keeps making changes I don't want

1. Make your `AGENTS.md` more specific about conventions and boundaries
2. Add explicit `### Forbidden` paths in the task scope
3. Use the `strict` scope enforcement mode
4. Add more specific items to the task's Definition of Done
