# TASK: Final cleanup, documentation update, and end-to-end verification

## Goal

Perform final cleanup of the refactored executor: remove dead code, unused imports, and commented-out blocks. Update the project's CLAUDE.md to reflect the new phase-based architecture. Ensure the barrel exports are clean. Verify everything works end-to-end with all validation commands.

## Task Type

refactor

## Suggested Roles

- developer

## Auto-Mode Compatible

YES

## Scope

### Allowed

- `packages/cli/src/core/executor.ts` (cleanup only)
- `packages/cli/src/core/phases/index.ts` (ensure clean exports)
- `CLAUDE.md` (project root — update architecture sections)

### Forbidden

- `packages/cli/src/core/phases/preflight.ts` (read-only)
- `packages/cli/src/core/phases/execution.ts` (read-only)
- `packages/cli/src/core/phases/postflight.ts` (read-only)
- `packages/cli/src/commands/` (do not touch)
- `packages/cli/src/core/executor.test.ts` (do not touch)

## Requirements

1. **Clean up `packages/cli/src/core/executor.ts`**:
   - Remove any dead code left over from the refactor
   - Remove unused imports (modules no longer directly used after extraction)
   - Remove any commented-out blocks
   - Verify the file is under 150 lines (down from ~987)

2. **Ensure clean barrel exports in `packages/cli/src/core/phases/index.ts`**:
   - Export all phase classes: `PreFlightPhase`, `ExecutionPhase`, `PostFlightPhase`
   - Export all types: `PhaseContext`, `PreFlightResult`, `ExecutionLoopResult`, `PostFlightInput`, `ExecutorPhase`
   - No unused exports, no circular dependencies

3. **Update `CLAUDE.md` (project root)** — Modify the "Architecture" section:
   - Update the "Execution Flow" to reflect the new phase-based structure:
     ```
     ### Execution Flow
     aidf run -> PreFlightPhase (config, context, scope, validator) ->
       ExecutionPhase (iteration loop: prompt -> provider -> scope -> validate -> commit) ->
       PostFlightPhase (status update, file movement, push, notifications, summary)
     ```
   - Update the "Repository Structure" file listing to include `packages/cli/src/core/phases/`:
     ```
     │   ├── core/
     │   │   ├── executor.ts              # Slim orchestrator (~150 lines)
     │   │   ├── parallel-executor.ts     # Multi-task parallel execution
     │   │   ├── phases/
     │   │   │   ├── types.ts             # Phase interfaces and shared context
     │   │   │   ├── preflight.ts         # PreFlightPhase (config, context, security)
     │   │   │   ├── execution.ts         # ExecutionPhase (iteration loop)
     │   │   │   ├── postflight.ts        # PostFlightPhase (status, notifications)
     │   │   │   └── index.ts             # Barrel exports
     │   │   ├── context-loader.ts        # Loads .ai/ folder context
     │   │   ...
     ```
   - Update the "5 Layers of Context" or "Key Patterns" sections if relevant
   - Update the executor description: "The executor (`core/executor.ts`) is a slim orchestrator (~150 lines) that delegates to three phases"

4. **Run all verification commands**:
   - `pnpm test` — all tests must pass (298+ existing + new phase tests)
   - `pnpm lint` — no lint errors
   - `pnpm typecheck` — no type errors
   - `pnpm build` — builds successfully
   - Manual smoke test if possible: `npx aidf run .ai/tasks/some-test-task.md --dry-run` works correctly

## Definition of Done

- [ ] `executor.ts` is under 150 lines with no dead code
- [ ] `phases/index.ts` has clean, complete barrel exports
- [ ] `CLAUDE.md` architecture sections are updated to reflect phases
- [ ] `CLAUDE.md` file listing includes `packages/cli/src/core/phases/`
- [ ] `pnpm test` passes (all tests including new phase tests)
- [ ] `pnpm lint` passes with no errors
- [ ] `pnpm typecheck` passes with no type errors
- [ ] `pnpm build` passes successfully
- [ ] No circular dependency issues

## Notes

- Part of PLAN-v080-executor-refactor.md (Phase 4)
- Depends on all previous tasks (080-087) — this is the final task
- This is primarily a cleanup and verification task, not a logic change
- The CLAUDE.md update ensures future AI agents understand the new architecture
- If any verification step fails, the issue likely originates in an earlier task — fix it there, not here
