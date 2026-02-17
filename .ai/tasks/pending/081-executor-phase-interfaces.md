# TASK: Define phase interfaces and shared context type

## Goal

Define the phase interfaces (`ExecutorPhase`, `PhaseContext`, `PreFlightResult`, `ExecutionLoopResult`, `PostFlightInput`) that phases will use to communicate. Create the `packages/cli/src/core/phases/` directory with a types file and barrel export. These type definitions establish the contracts that the PreFlight, Execution, and PostFlight phases will implement.

## Task Type

refactor

## Suggested Roles

- developer

## Auto-Mode Compatible

YES

## Scope

### Allowed

- `packages/cli/src/core/phases/types.ts` (create)
- `packages/cli/src/core/phases/index.ts` (create)
- `packages/cli/src/core/phases/types.test.ts` (create)

### Forbidden

- `packages/cli/src/core/executor.ts` (read-only)
- `packages/cli/src/types/index.ts` (read-only, imports only)
- `packages/cli/src/commands/` (do not touch)

## Requirements

1. Create `packages/cli/src/core/phases/types.ts` with the following type definitions:

   ```typescript
   export interface PhaseContext {
     config: AidfConfig;
     options: ExecutorOptions;
     state: ExecutorState;
     cwd: string;
     taskPath: string;
     deps: ExecutorDependencies;
   }

   export interface PreFlightResult {
     context: LoadedContext;
     scopeGuard: ScopeGuard;
     validator: Validator;
     provider: Provider;
     blockedStatus: BlockedStatus | null;
     skipPermissions: boolean;
   }

   export interface ExecutionLoopResult {
     completedNormally: boolean;
     terminationReason?: 'completed' | 'blocked' | 'max_iterations' | 'max_failures' | 'dry_run';
     lastError?: string;
   }

   export interface PostFlightInput {
     preFlightResult: PreFlightResult;
     executionResult: ExecutionLoopResult;
   }

   export interface ExecutorPhase<TInput, TOutput> {
     name: string;
     execute(ctx: PhaseContext, input: TInput): Promise<TOutput>;
   }
   ```

   Import the referenced types (`AidfConfig`, `ExecutorOptions`, `ExecutorState`, `ExecutorDependencies`, `LoadedContext`, `ScopeGuard`, `Validator`, `Provider`, `BlockedStatus`) from `../../types/index.ts` and other relevant source files as needed.

2. Create `packages/cli/src/core/phases/index.ts` as a barrel export file that re-exports all types from `types.ts`. This file will later also export the concrete phase classes.

3. Create `packages/cli/src/core/phases/types.test.ts` as a type-check-only test file that imports and uses all the types to verify they compile correctly. This ensures the type definitions do not have errors. The test should:
   - Import all interfaces from `./types`
   - Create mock objects that satisfy each interface
   - Use `expect(true).toBe(true)` assertions (the real test is that the file compiles)

## Definition of Done

- [ ] `packages/cli/src/core/phases/types.ts` exists with all 5 interfaces defined
- [ ] `packages/cli/src/core/phases/index.ts` exists and re-exports all types
- [ ] `packages/cli/src/core/phases/types.test.ts` exists and compiles successfully
- [ ] All type imports resolve correctly (no missing references)
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes (including the new type test file)
- [ ] `pnpm lint` passes

## Notes

- Part of PLAN-v080-executor-refactor.md (Phase 1)
- Can be done in parallel with task 080 (dependencies interface)
- The `ExecutorDependencies` type referenced here is defined in task 080; if implementing in parallel, use a forward reference or import from types/index.ts
- These interfaces define the contracts that tasks 082, 083, and 084 will implement
- The `PhaseContext.state` is a mutable reference (not a copy) — phases share and mutate the same state object
