# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is AIDF

AIDF (AI-Integrated Development Framework) is two things:

1. **A documentation framework** — Markdown templates and conventions for structured AI-assisted development (context, roles, tasks, plans).
2. **A CLI tool** (`packages/cli`) — Published to npm as `aidf`. Automates task execution with scope enforcement, validation, auto-commit, and notifications.

## Repository Structure

```text
.ai/                  # This repo uses AIDF itself (tasks/, plans/)
.github/              # CI workflows (test, release) + GitHub Action definition
docs/                 # Core documentation (concepts, setup, roles, tasks, integrations, hooks)
templates/.ai/        # Template folder distributed with the CLI
  ├── AGENTS.template.md
  ├── ROLES.md
  ├── roles/          # 5 built-in roles (architect, developer, tester, reviewer, documenter)
  ├── templates/      # Task and plan templates (6 task types)
  ├── tasks/
  └── plans/
examples/             # AGENTS.md examples (nextjs-app, node-api, react-component-library)
packages/
  └── cli/            # The CLI tool (npm package "aidf")
      ├── src/
      │   ├── index.ts           # CLI entry point (Commander)
      │   ├── types/index.ts     # All TypeScript interfaces
      │   ├── commands/          # init, run, task, status, watch, hooks
      │   ├── core/
      │   │   ├── executor.ts          # Main execution loop
      │   │   ├── parallel-executor.ts # Multi-task parallel execution
      │   │   ├── context-loader.ts    # Loads .ai/ folder context
      │   │   ├── safety.ts            # ScopeGuard (allowed/forbidden paths)
      │   │   ├── validator.ts         # Runs validation commands
      │   │   ├── watcher.ts           # File change monitoring
      │   │   └── providers/
      │   │       ├── index.ts         # Provider factory + ProviderType union
      │   │       ├── types.ts         # Provider, ExecutionResult, ProviderOptions
      │   │       ├── claude-cli.ts    # Spawns `claude --print`
      │   │       ├── cursor-cli.ts    # Spawns `agent --print`
      │   │       ├── anthropic-api.ts # Direct Anthropic API with tool calling
      │   │       ├── openai-api.ts    # Direct OpenAI API with tool calling
      │   │       └── tool-handler.ts  # File operation tools for API providers
      │   └── utils/
      │       ├── logger.ts            # Structured logging (text/JSON, file output)
      │       ├── live-status.ts       # Real-time spinner + timer during execution
      │       ├── progress-bar.ts      # Progress bar (iteration/ETA/tokens)
      │       ├── notifications.ts     # Desktop, Slack, Discord, email
      │       └── files.ts            # File utilities
      ├── tsconfig.json
      ├── tsup.config.ts       # Build config (copies templates/ into dist)
      └── eslint.config.js
```

## Development Commands

```bash
pnpm install           # Install all dependencies (run from repo root)
pnpm build             # Build all packages (tsup compiles CLI to dist/)
pnpm test              # Run all tests (Vitest, 17 test files, 263+ tests)
pnpm lint              # ESLint across all packages
pnpm dev               # Watch mode for CLI development
```

From `packages/cli/` specifically:

```bash
npm run build          # tsup → dist/index.js
npm run test           # vitest
npm run typecheck      # tsc --noEmit
npm run lint           # eslint src
```

## Architecture

### 4 Layers of Context

1. **AGENTS.md** — Single source of truth (project overview, architecture, conventions, boundaries)
2. **Roles** — Specialized AI personas with defined expertise and constraints
3. **Tasks** — Scoped, executable prompts with goal, allowed/forbidden paths, and Definition of Done
4. **Plans** — Multi-task initiatives grouping related work

### Execution Flow

```
aidf run → load context (AGENTS.md + role + task) → build prompt → provider.execute() →
  → check scope (ScopeGuard) → validate (lint/typecheck/test) → commit → repeat until done
```

The executor (`core/executor.ts`) is the central loop. Each iteration:
1. Builds a prompt with full context via `buildIterationPrompt()` (in `claude-cli.ts`)
2. Calls the provider's `execute()` method
3. Checks file changes against scope rules (strict/ask/permissive)
4. Runs validation commands (pre_commit hooks from config.yml)
5. Auto-commits if enabled
6. Detects completion signals (`<TASK_COMPLETE>`, `<DONE>`, etc.) or blocked signals
7. Updates the task .md file with status (COMPLETED/BLOCKED/FAILED)

### Providers

| Provider | Binary/API | Token Tracking | Key Flag |
|----------|-----------|----------------|----------|
| `claude-cli` | `claude --print` | No | `--dangerously-skip-permissions` |
| `cursor-cli` | `agent --print` | No | None |
| `anthropic-api` | Anthropic SDK | Yes | Tool calling (file ops) |
| `openai-api` | OpenAI SDK | Yes | Tool calling (file ops) |

CLI providers spawn a subprocess and stream stdout. API providers use tool calling with built-in file operation tools (`read_file`, `write_file`, `list_files`, `run_command`, `task_complete`, `task_blocked`) defined in `providers/types.ts`.

Provider factory is in `providers/index.ts` — `createProvider(type, cwd, apiKey)`.

### Key Types (types/index.ts)

- `AidfConfig` — Full config.yml structure (provider, execution, permissions, validation, git, notifications)
- `ProviderConfig` — `{ type: 'claude-cli' | 'cursor-cli' | 'anthropic-api' | 'openai-api', model? }`
- `ExecutorOptions` — Max iterations, failures, timeout, scope mode, callbacks (`onIteration`, `onPhase`, `onOutput`, `onAskUser`)
- `ExecutorResult` — Success/failure, iterations, files modified, token usage, blocked reason
- `ParsedTask` — Goal, type, scope (allowed/forbidden), requirements, Definition of Done, blocked status
- `PhaseEvent` — Live status updates (phase, iteration, totalIterations, filesModified)

### Live Status (utils/live-status.ts)

During execution, a real-time status line shows:
- Animated spinner
- Current phase (Executing AI / Checking scope / Validating / Committing)
- Iteration count
- Files modified
- Elapsed timer (ticks every second)

The `onOutput` callback on providers allows the live status to clear/redraw around AI output chunks.

## Key Patterns

- **Provider interface**: All providers implement `{ name, execute(prompt, options), isAvailable() }` from `providers/types.ts`
- **Scope enforcement**: `ScopeGuard` in `safety.ts` validates file changes against task scope
- **Status updates**: Executor writes `## Status: COMPLETED/BLOCKED/FAILED` sections back to task .md files with execution logs
- **Notifications**: `NotificationService` dispatches to desktop/Slack/Discord/email based on config
- **Parallel execution**: `ParallelExecutor` detects scope dependencies between tasks and serializes conflicting ones

## Configuration

Projects use `.ai/config.yml`:

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
git:
  commit_prefix: "aidf:"
  branch_prefix: "aidf/"
notifications:
  level: all  # all | errors | blocked
```

## Testing

- Framework: **Vitest** (ESM, no setup files)
- Test files colocated with source: `*.test.ts` next to `*.ts`
- Mocking: `vi.mock('child_process')` for CLI providers, mock context loaders for executor tests
- Run: `pnpm test` from root or `npx vitest run` from `packages/cli/`

## Build & Distribution

- **Bundler**: tsup (ESM format, generates `.d.ts`)
- **Build hook**: Copies `templates/.ai/` into the npm package at build time
- **Binary**: `dist/index.js` with `#!/usr/bin/env node` shebang, mapped to `aidf` command
- **GitHub Action**: `action.yml` at repo root lets CI/CD pipelines run AIDF tasks

## Working with Templates

- Templates use `.template.md` suffix
- Role files define: Identity, Expertise, Responsibilities, Constraints, Quality Criteria
- Task files define: Goal, Type, Scope (allowed/forbidden), Requirements, Definition of Done
- `examples/` contains fully configured AGENTS.md for different project types (Next.js, Node API, React lib)
