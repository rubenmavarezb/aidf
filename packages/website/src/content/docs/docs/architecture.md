---
title: Architecture
description: How an AI agent behaves when using AIDF — context loading, execution loop, providers, and task lifecycle.
---

This page explains how an AI agent behaves when it uses AIDF — from context loading to task completion.

---

## High-Level Overview

An AIDF-powered agent operates in three phases: **context loading**, **iterative execution**, and **task resolution**.

```mermaid
flowchart LR
    A[Load Context] --> B[Execute Loop]
    B --> C[Resolve Task]

    style A fill:#e8f4fd,stroke:#2196f3
    style B fill:#fff3e0,stroke:#ff9800
    style C fill:#e8f5e9,stroke:#4caf50
```

---

## Context Composition

Before executing anything, the agent assembles a layered prompt from the `.ai/` folder. Each layer adds specificity:

```mermaid
flowchart TD
    AGENTS["AGENTS.md\n─────────────────\nProject overview\nArchitecture\nConventions\nBoundaries"]
    ROLE["Role Definition\n─────────────────\nExpertise\nResponsibilities\nConstraints\nQuality criteria"]
    TASK["Task Definition\n─────────────────\nGoal\nAllowed / Forbidden paths\nRequirements\nDefinition of Done"]
    SKILLS["Skills\n─────────────────\nPortable capabilities\nagentskills.io standard\nGlob-matched to task"]
    PROMPT["Assembled Prompt"]

    AGENTS --> PROMPT
    ROLE --> PROMPT
    TASK --> PROMPT
    SKILLS --> PROMPT

    style AGENTS fill:#e3f2fd,stroke:#1565c0
    style ROLE fill:#f3e5f5,stroke:#7b1fa2
    style TASK fill:#fff8e1,stroke:#f9a825
    style SKILLS fill:#e8f5e9,stroke:#2e7d32
    style PROMPT fill:#fce4ec,stroke:#c62828
```

The context is additive — you only need AGENTS.md at minimum. Roles, tasks, and skills are optional layers.

---

## Execution Loop

This is the core behavior. The executor (`core/executor.ts`) runs an iterative loop, where each iteration goes through prompt building, AI execution, scope checking, validation, and commit.

```mermaid
flowchart TD
    START(["aidf run --task task.md"]) --> LOAD["Load context\n(AGENTS.md + role + task + skills)"]
    LOAD --> BUILD["Build iteration prompt"]
    BUILD --> EXECUTE["Send to AI provider"]

    EXECUTE --> RESPONSE["AI generates\ncode changes"]

    RESPONSE --> SCOPE{"ScopeGuard\ncheck files"}

    SCOPE -->|"All files in scope"| VALIDATE["Run validation\n(lint, typecheck, tests)"]
    SCOPE -->|"Out-of-scope + strict"| REJECT["Reject changes"]
    SCOPE -->|"Out-of-scope + ask"| ASK["Ask user"]

    ASK -->|Approved| VALIDATE
    ASK -->|Rejected| REJECT

    REJECT --> ITER_CHECK

    VALIDATE -->|Pass| COMMIT["Auto-commit\n(if enabled)"]
    VALIDATE -->|Fail| ITER_CHECK

    COMMIT --> COMPLETION{"Completion\nsignal?"}

    COMPLETION -->|"TASK_COMPLETE / DONE"| DONE_OK["Update task:\nCOMPLETED"]
    COMPLETION -->|"TASK_BLOCKED"| DONE_BLOCKED["Update task:\nBLOCKED"]
    COMPLETION -->|"Not done"| ITER_CHECK{"Max iterations\nreached?"}

    ITER_CHECK -->|No| BUILD
    ITER_CHECK -->|Yes| DONE_FAIL["Update task:\nFAILED"]

    DONE_OK --> END(["Done"])
    DONE_BLOCKED --> END
    DONE_FAIL --> END

    style START fill:#e3f2fd,stroke:#1565c0
    style EXECUTE fill:#fff3e0,stroke:#ff9800
    style SCOPE fill:#fff8e1,stroke:#f9a825
    style VALIDATE fill:#f3e5f5,stroke:#7b1fa2
    style COMMIT fill:#e8f5e9,stroke:#2e7d32
    style DONE_OK fill:#c8e6c9,stroke:#2e7d32
    style DONE_BLOCKED fill:#ffe0b2,stroke:#e65100
    style DONE_FAIL fill:#ffcdd2,stroke:#c62828
    style END fill:#e3f2fd,stroke:#1565c0
```

### Key decision points

- **ScopeGuard** — Validates every changed file against the task's allowed/forbidden paths. The behavior depends on the `scope_enforcement` mode (`strict`, `ask`, or `permissive`).
- **Validation** — Runs the commands listed in `config.yml` under `validation.pre_commit` (typically lint, typecheck).
- **Completion detection** — The AI signals it's done by outputting `<TASK_COMPLETE>` or `<DONE>`. If it can't proceed, it outputs `<TASK_BLOCKED>` with a reason.
- **Iteration limit** — Prevents runaway execution. Configurable via `execution.max_iterations`.

---

## Provider Architecture

AIDF supports four providers. They all implement the same interface (`execute(prompt, options)`) but work differently under the hood:

```mermaid
flowchart TD
    EXEC["Executor"] --> FACTORY["Provider Factory\ncreateProvider(type)"]

    FACTORY --> CLI_GROUP["CLI Providers"]
    FACTORY --> API_GROUP["API Providers"]

    CLI_GROUP --> CLAUDE_CLI["claude-cli\n─────────────\nSpawns: claude --print\nStreams stdout\nNo token tracking"]
    CLI_GROUP --> CURSOR_CLI["cursor-cli\n─────────────\nSpawns: agent --print\nStreams stdout\nNo token tracking"]

    API_GROUP --> ANTHROPIC["anthropic-api\n─────────────\nAnthropic SDK\nTool calling\nToken tracking"]
    API_GROUP --> OPENAI["openai-api\n─────────────\nOpenAI SDK\nTool calling\nToken tracking"]

    ANTHROPIC --> TOOLS["Built-in tools\n─────────────\nread_file\nwrite_file\nlist_files\nrun_command\ntask_complete\ntask_blocked"]
    OPENAI --> TOOLS

    style EXEC fill:#e3f2fd,stroke:#1565c0
    style FACTORY fill:#f3e5f5,stroke:#7b1fa2
    style CLI_GROUP fill:#fff8e1,stroke:#f9a825
    style API_GROUP fill:#e8f5e9,stroke:#2e7d32
    style TOOLS fill:#fce4ec,stroke:#c62828
```

**CLI providers** delegate all file operations to the AI's own tooling (Claude Code or Cursor). The executor only sees the final output and file changes on disk.

**API providers** use tool calling — the AI requests file operations (read, write, list, run commands) through a structured tool interface defined in `providers/tool-handler.ts`.

---

## Parallel Execution

When running multiple tasks, the `ParallelExecutor` analyzes scope overlap to determine which tasks can run concurrently:

```mermaid
flowchart TD
    TASKS["Multiple tasks"] --> ANALYZE["Analyze scope\noverlap"]

    ANALYZE --> INDEPENDENT["No overlap\n→ Run in parallel"]
    ANALYZE --> CONFLICT["Scope conflict\n→ Serialize"]

    INDEPENDENT --> T1["Task A\nsrc/auth/**"]
    INDEPENDENT --> T2["Task B\nsrc/ui/**"]

    CONFLICT --> T3["Task C\nsrc/core/**"]
    T3 --> T4["Task D\nsrc/core/utils/**"]

    T1 --> MERGE["Collect results"]
    T2 --> MERGE
    T4 --> MERGE

    style TASKS fill:#e3f2fd,stroke:#1565c0
    style ANALYZE fill:#fff8e1,stroke:#f9a825
    style INDEPENDENT fill:#e8f5e9,stroke:#2e7d32
    style CONFLICT fill:#ffcdd2,stroke:#c62828
```

Tasks touching different files run simultaneously. Tasks with overlapping scopes run one after another to prevent conflicts.

---

## Task Lifecycle

A task file (`.ai/tasks/*.md`) goes through defined states:

```mermaid
stateDiagram-v2
    [*] --> PENDING : Task created
    PENDING --> IN_PROGRESS : aidf run
    IN_PROGRESS --> COMPLETED : All DoD criteria met
    IN_PROGRESS --> BLOCKED : AI signals TASK_BLOCKED
    IN_PROGRESS --> FAILED : Max iterations / failures
    BLOCKED --> IN_PROGRESS : Re-run after resolving
    FAILED --> IN_PROGRESS : Re-run after fixing
    COMPLETED --> [*]
```

The executor writes a `## Status` section to the task file with execution logs, files modified, and the final outcome.
