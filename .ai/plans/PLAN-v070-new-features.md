# PLAN: v0.7.0 — New Features (Skill, Smart Init, MCP)

## Overview

Three new capabilities that expand AIDF's reach: a portable skill for the skills.sh ecosystem, intelligent project analysis during init, and an MCP server that integrates AIDF into any MCP-compatible AI client.

## Goals

- Publish an AIDF skill on skills.sh for community adoption
- Transform `aidf init` from generic templates to project-aware configuration
- Expose AIDF capabilities as MCP tools/resources for Claude Desktop, Cursor, etc.

## Non-Goals

- VS Code extension (blocked, deferred)
- Breaking changes to existing CLI commands
- Changing the execution model or provider interface

## Tasks

### Phase 1: AIDF Skill for skills.sh

- [ ] `072-aidf-skill.md` — Create `SKILL.md` following agentskills.io standard. The skill teaches any AI agent how to work with AIDF projects: .ai/ structure, task file format (Goal, Scope, DoD), scope enforcement rules, completion signals (`<TASK_COMPLETE>`, `<DONE>`), config.yml conventions, role selection. Include practical examples. Register on skills.sh.

### Phase 2: Smart Init (auto-update templates)

- [ ] `073-smart-init-detection.md` — Add project analysis module in `core/project-analyzer.ts`: detect package manager (npm/pnpm/yarn/bun), framework (Next.js, Express, Fastify, React, Vue, etc.), test runner (vitest, jest, mocha), linter (eslint, biome), TypeScript presence, monorepo structure. Return a `ProjectProfile` object.
- [ ] `074-smart-init-prompt.md` — Create master prompt template that instructs the AI provider to: analyze the project profile, complete AGENTS.md with real architecture/conventions/boundaries, generate appropriate roles, set config.yml validation commands to actual project scripts, define sensible scope patterns. Store as `templates/.ai/prompts/smart-init.md`.
- [ ] `075-smart-init-command.md` — Extend `aidf init` with `--smart` flag (or post-init prompt). Flow: run project analysis → show detected profile → ask user confirmation → call provider with master prompt → show diff of proposed changes → apply on approval. Requires a configured provider (claude-cli or API).

### Phase 3: MCP Server

- [ ] `076-mcp-server-core.md` — Create `packages/mcp-server/` (or `src/mcp/` within CLI). Implement MCP server using `@modelcontextprotocol/sdk`. Transport: stdio. Expose tools: `aidf_list_tasks` (list tasks with status), `aidf_get_context` (load AGENTS.md + role + skills), `aidf_run_task` (execute a task with scope enforcement), `aidf_validate` (run validation commands), `aidf_create_task` (create task from description).
- [ ] `077-mcp-server-resources.md` — Expose MCP resources: `aidf://agents` (AGENTS.md content), `aidf://config` (parsed config.yml), `aidf://tasks/{id}` (task file content), `aidf://roles/{name}` (role definition). These provide read-only context to MCP clients.
- [ ] `078-mcp-server-command.md` — Add `aidf mcp serve` command to CLI. Starts the MCP server on stdio. Add `aidf mcp install` helper that generates the MCP config JSON for Claude Desktop / Cursor (writes to clipboard or stdout). Document setup in README.

## Dependencies

- 072 is independent (can start immediately).
- 074 depends on 073 (prompt needs ProjectProfile shape).
- 075 depends on 073 + 074.
- 076 is independent of Phase 1 and 2.
- 077 depends on 076 (needs server infrastructure).
- 078 depends on 076 + 077.

## Risks

- **Smart Init**: AI output quality varies — need good prompt engineering and validation of generated AGENTS.md structure. Consider fallback to manual mode if provider not available.
- **MCP Server**: MCP spec is still evolving — pin SDK version. stdio transport is simple but limits to single-client use.
- **Skill**: skills.sh acceptance criteria unknown — validate format before submitting.

## Success Criteria

- AIDF skill published and discoverable on skills.sh
- `aidf init --smart` produces project-specific AGENTS.md and config.yml for at least 3 project types (Next.js, Node API, React lib)
- MCP server starts via `aidf mcp serve` and responds to tool calls from Claude Desktop
- All new code has tests, existing 298+ tests still green
