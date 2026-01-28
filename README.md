# AIDF - AI-Integrated Development Framework

A framework for structured, consistent, and safe AI-assisted software development.

## What is AIDF?

AIDF is a set of patterns, templates, and conventions that enable effective collaboration between developers and AI assistants. It treats AI as a **team member** that needs:

- **Context** - Understanding of the project
- **Roles** - Specialized personas for different tasks
- **Boundaries** - Clear scope to prevent mistakes
- **Validation** - Verifiable completion criteria

## Core Principles

### 1. Context is King

AI without context is just autocomplete. AIDF provides structured ways to give AI full project understanding through the `AGENTS.md` file.

### 2. Roles Over Generic Prompts

A "testing expert" produces better tests than a generic assistant. AIDF defines specialized roles with specific knowledge and constraints.

### 3. Scoped Tasks

Every task explicitly defines what can and cannot be modified. This prevents well-intentioned AI from making changes outside its mandate.

### 4. Verifiable Completion

"Done" isn't subjective. Every task has testable criteria that both humans and AI can validate.

### 5. Incremental Execution

Small, focused tasks beat large vague ones. AIDF encourages breaking work into atomic, executable prompts.

## Quick Start

```bash
# 1. Copy the .ai folder to your project
cp -r /path/to/aidf/templates/.ai /your/project/

# 2. Customize AGENTS.md for your project
# Edit .ai/AGENTS.md with your project's details

# 3. Select appropriate roles
# Keep only the roles relevant to your project in .ai/roles/

# 4. Create your first task
cp .ai/templates/TASK.template.md .ai/tasks/my-first-task.md
# Edit the task file with your requirements

# 5. Execute the task with your AI assistant
# Paste the task content as a prompt
```

## Structure

```
.ai/
├── AGENTS.md              # Master context document
├── ROLES.md               # Role selection guide
│
├── roles/                 # Specialized AI personas
│   ├── architect.md
│   ├── developer.md
│   ├── tester.md
│   ├── reviewer.md
│   └── documenter.md
│
├── templates/             # Reusable templates
│   ├── TASK.template.md
│   └── PLAN.template.md
│
├── tasks/                 # Active/completed tasks
│   └── {date}-{task-name}.md
│
└── plans/                 # Larger initiatives
    └── {plan-name}/
        ├── README.md
        └── tasks/
```

## Documentation

- [Core Concepts](./docs/concepts.md) - Understanding AIDF principles
- [Setup Guide](./docs/setup.md) - How to integrate AIDF into your project
- [Writing AGENTS.md](./docs/agents-file.md) - Creating effective context documents
- [Defining Roles](./docs/roles.md) - Creating specialized AI personas
- [Task Design](./docs/tasks.md) - Writing effective task prompts
- [Best Practices](./docs/best-practices.md) - Patterns that work
- [**Integrations Guide**](./docs/integrations.md) - Using AIDF with Claude Code, Cursor, and other tools

## Examples

- [React Component Library](./examples/react-component-library/) - UI library with Atomic Design
- [Next.js Application](./examples/nextjs-app/) - Full-stack web application
- [Node.js API](./examples/node-api/) - Backend REST API
- [Monorepo](./examples/monorepo/) - Multi-package repository

## Why AIDF?

### Without AIDF

```
Developer: "Add a login form"
AI: *Creates random structure, inconsistent with project*
Developer: *Spends time fixing and adapting*
```

### With AIDF

```
Developer: *Pastes task from .ai/tasks/add-login-form.md*
AI: *Follows project conventions, respects boundaries*
Developer: *Reviews and merges*
```

## Compatibility

AIDF works with any AI assistant that accepts text prompts:

- **Claude Code** - Full integration with autonomous execution ([guide](./docs/integrations.md#claude-code-integration))
- **Cursor** - Rules template included ([guide](./docs/integrations.md#cursor-integration))
- **GitHub Copilot** - Instructions template ([guide](./docs/integrations.md#github-copilot-integration))
- **Any LLM** - Prompt templates for API usage ([guide](./docs/integrations.md#generic-llm-integration-api))

## License

MIT - Use it, adapt it, improve it.

---

*"The best AI collaboration happens when AI understands not just what to do, but how your team does it."*
