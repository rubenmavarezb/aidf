# TASK: Extract PreFlight logic into PreFlightPhase class

## Goal

Extract all pre-execution logic from `Executor.run()` into a dedicated `PreFlightPhase` class that implements `ExecutorPhase<void, PreFlightResult>`. This includes config resolution, secret detection, context loading, resume state restoration, context size logging, security warnings, ScopeGuard creation, and Validator creation. The phase receives a `PhaseContext` and returns a `PreFlightResult` containing everything the execution loop needs.

## Task Type

refactor

## Suggested Roles

- developer

## Auto-Mode Compatible

YES

## Scope

### Allowed

- `packages/cli/src/core/phases/preflight.ts` (create)
- `packages/cli/src/core/phases/preflight.test.ts` (create)
- `packages/cli/src/core/phases/index.ts` (update exports)

### Forbidden

- `packages/cli/src/core/executor.ts` (read-only — do not modify yet, that happens in task 085)
- `packages/cli/src/commands/` (do not touch)
- `packages/cli/src/core/parallel-executor.ts` (do not touch)

## Requirements

1. Create `packages/cli/src/core/phases/preflight.ts` implementing `PreFlightPhase`:

   ```typescript
   export class PreFlightPhase implements ExecutorPhase<void, PreFlightResult> {
     name = 'preflight';
     async execute(ctx: PhaseContext): Promise<PreFlightResult> { ... }
   }
   ```

2. Extract the following logic from `Executor.run()` (reference the current executor.ts line numbers from the plan):
   - **Config resolution** (lines ~91-108): Call `resolveConfig()` and handle errors. If config resolution fails, throw with a descriptive error.
   - **Secret detection** (lines ~111-118): Call `detectPlaintextSecrets()` and emit warnings via `ctx.deps.logger`.
   - **Context loading** (line ~129): Call `loadContext()` to load the `.ai/` folder context (AGENTS.md, role, task, skills).
   - **Resume state restoration** (lines ~132-153): If the task has a `blockedStatus`, restore previous iteration count and modified files. If resuming but the task is not blocked, throw an error.
   - **Context size estimation** (lines ~161-180): Estimate context size in tokens and log it.
   - **Security warning** (lines ~183-189): If `skip_permissions` is true and `warn_on_skip` is not false, emit a security warning. Return `skipPermissions` boolean.
   - **ScopeGuard creation** (lines ~192-195): Create a ScopeGuard using `ctx.deps.createScopeGuard(scope, mode)`.
   - **Validator creation** (line ~198): Create a Validator using `ctx.deps.createValidator(config, cwd)`.

3. Implement these private methods within the class:
   - `private resolveAndValidateConfig(ctx: PhaseContext): AidfConfig`
   - `private loadAndLogContext(ctx: PhaseContext): Promise<LoadedContext>`
   - `private restoreResumeState(ctx: PhaseContext, context: LoadedContext): BlockedStatus | null`
   - `private logContextSize(ctx: PhaseContext, context: LoadedContext): void`
   - `private checkSecurityWarnings(ctx: PhaseContext): boolean` (returns `skipPermissions`)

4. The phase must return a `PreFlightResult` object:
   ```typescript
   {
     context: LoadedContext,
     scopeGuard: ScopeGuard,
     validator: Validator,
     provider: Provider,
     blockedStatus: BlockedStatus | null,
     skipPermissions: boolean
   }
   ```

5. Update `packages/cli/src/core/phases/index.ts` to export `PreFlightPhase`.

6. Create `packages/cli/src/core/phases/preflight.test.ts` with the following tests (all using injected mock dependencies via `PhaseContext.deps`, NOT `vi.mock()`):
   - Test: config resolution failure returns proper error
   - Test: plaintext secrets are warned about
   - Test: context loads successfully and returns LoadedContext
   - Test: resume mode fails when task is not blocked
   - Test: resume mode restores previous iteration and files
   - Test: context size is estimated and logged
   - Test: security warning emitted when skip_permissions is true
   - Test: security warning suppressed when warn_on_skip is false
   - Test: ScopeGuard created with correct scope and mode
   - Test: Validator created with correct config and cwd

## Definition of Done

- [ ] `packages/cli/src/core/phases/preflight.ts` exists with `PreFlightPhase` class
- [ ] All pre-execution logic from `Executor.run()` is replicated in the phase class
- [ ] `PreFlightPhase.execute()` returns a complete `PreFlightResult`
- [ ] `packages/cli/src/core/phases/index.ts` exports `PreFlightPhase`
- [ ] `packages/cli/src/core/phases/preflight.test.ts` has 10+ tests covering all branches
- [ ] All tests use dependency injection (no `vi.mock()` for core deps)
- [ ] `pnpm test` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes

## Notes

- Part of PLAN-v080-executor-refactor.md (Phase 2)
- Depends on tasks 080 (ExecutorDependencies) and 081 (phase interfaces)
- Can be done in parallel with tasks 083 and 084
- Do NOT modify `executor.ts` yet — that happens in task 085 (rewire)
- The logic should be extracted faithfully; this is a mechanical extraction, not a rewrite
- Reference the current `executor.ts` source to identify the exact logic blocks to extract
