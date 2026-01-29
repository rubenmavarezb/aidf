# Agent Skills

AIDF integrates the [Agent Skills](https://agentskills.io) standard, allowing you to consume portable skill definitions from the ecosystem and publish your own.

Skills are self-contained SKILL.md files that provide instructions, expertise, and constraints to the AI during task execution. They are injected into the prompt as additional context alongside the role and task.

---

## Why Skills?

### Without Skills

```
Your AI agent only knows what's in AGENTS.md + role + task.
Adding new expertise means editing roles or writing longer task descriptions.
```

### With Skills

```
Drop a SKILL.md into .ai/skills/ and the AI gains new capabilities instantly.
Share skills across projects. Use skills published by the community.
```

Skills provide:

- **Portability**: Same skill works in any agent that supports the standard (34+ compatible agents)
- **Composability**: Combine multiple skills for a single task execution
- **Separation**: Skills are separate from roles — roles define _who_, skills define _what_ the AI can do
- **Ecosystem**: Consume skills from the community or publish your own

---

## SKILL.md Format

Every skill is a directory containing a `SKILL.md` file with YAML frontmatter and markdown content:

```
.ai/skills/
  └── my-skill/
      └── SKILL.md
```

### Structure

```markdown
---
name: my-skill
description: A brief description of what this skill does
version: 1.0.0
author: Your Name
tags: tag1, tag2, tag3
globs: src/**/*.ts, tests/**
---

# My Skill

## Instructions

Detailed instructions for the AI when this skill is active.

## When to Use

Describe when this skill should be activated.

## Behavior Rules

### ALWAYS
- Rule 1
- Rule 2

### NEVER
- Rule 1
- Rule 2
```

### Frontmatter Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Unique skill identifier |
| `description` | Yes | Brief description (shown in `aidf skills list`) |
| `version` | No | Semantic version |
| `author` | No | Skill author |
| `tags` | No | Comma-separated tags for categorization |
| `globs` | No | Comma-separated file patterns the skill relates to |

---

## Skill Discovery

AIDF discovers skills from three locations, in order:

| Priority | Location | Source label | Description |
|----------|----------|-------------|-------------|
| 1 | `.ai/skills/` | `project` | Project-specific skills |
| 2 | `~/.aidf/skills/` | `global` | User-wide skills shared across projects |
| 3 | Config directories | `config` | Extra paths defined in `config.yml` |

All discovered skills are loaded and injected into the execution prompt automatically.

---

## Configuration

Add the `skills` section to `.ai/config.yml`:

```yaml
skills:
  enabled: true              # default: true (omit section to enable)
  directories:               # additional directories to scan for skills
    - /path/to/shared/skills
    - ../other-project/.ai/skills
```

To disable skills entirely:

```yaml
skills:
  enabled: false
```

If the `skills` section is omitted, skills are enabled by default and AIDF will scan the standard directories (`.ai/skills/` and `~/.aidf/skills/`).

---

## CLI Commands

### List skills

```bash
aidf skills list
```

Shows all discovered skills with their source (project/global/config), description, and tags.

### Create a new skill

```bash
aidf skills init my-skill           # creates .ai/skills/my-skill/SKILL.md
aidf skills init my-skill --global  # creates ~/.aidf/skills/my-skill/SKILL.md
```

Generates a SKILL.md template ready to edit.

### Validate skills

```bash
aidf skills validate              # validate all discovered skills
aidf skills validate my-skill     # validate a specific skill by name
```

Checks frontmatter fields, content structure, and reports errors.

### Add an external skill

```bash
aidf skills add /path/to/skill-directory
```

Copies a skill into the project's `.ai/skills/` directory after validating it.

---

## How Skills Are Injected

During execution, skills are injected into the prompt as XML following the agentskills.io format:

```xml
<available_skills>
<skill name="my-skill">
<description>A brief description</description>
<tags>tag1, tag2</tags>
<instructions>
# My Skill
...full markdown content...
</instructions>
</skill>
</available_skills>
```

This XML block is placed in the prompt after the Implementation Plan section and before the Execution Instructions.

---

## Built-in Skills

AIDF ships with 6 built-in skills that mirror the built-in roles:

| Skill | Description |
|-------|-------------|
| `aidf-architect` | System design, patterns, trade-off analysis |
| `aidf-developer` | Clean code implementation, pattern matching |
| `aidf-tester` | Test coverage, edge cases, reliability |
| `aidf-reviewer` | Code review, quality, constructive feedback |
| `aidf-documenter` | Technical writing, API docs, guides |
| `aidf-task-templates` | Structured task templates for all 6 task types |

These are included in the `templates/.ai/skills/` directory and are copied to your project when you run `aidf init`.

---

## Examples

### Adding a custom skill

```bash
# Create the skill
aidf skills init eslint-expert

# Edit the SKILL.md
# Then validate it
aidf skills validate eslint-expert
```

### Sharing skills globally

```bash
# Create a global skill available in all projects
aidf skills init code-security --global

# It lives at ~/.aidf/skills/code-security/SKILL.md
```

### Using extra directories

If your team maintains a shared skills repository:

```yaml
# .ai/config.yml
skills:
  directories:
    - ../shared-aidf-skills
```

### Disabling skills for a run

Skills are automatically loaded when available. To disable:

```yaml
# .ai/config.yml
skills:
  enabled: false
```
