# PLAN: v0.8.0 — Executor Refactoring

## Status: DRAFT

## Overview

The `Executor` class (`packages/cli/src/core/executor.ts`) has grown into a 987-line monolith. The `run()` method alone is ~500 lines handling config resolution, context loading, secret detection, security warnings, scope enforcement, validation, git operations, task file status updates, file movement, notifications, and the iteration loop itself. This makes it difficult to test individual phases in isolation, extend behavior (e.g., adding new pre/post hooks), and reason about execution flow.

This plan refactors the Executor into three well-defined phases (PreFlight, Execution, PostFlight) and introduces dependency injection so that external dependencies (SimpleGit, fs, Validator, ScopeGuard, NotificationService) are provided via a constructor options object rather than being instantiated internally. This enables proper unit testing without relying on module-level `vi.mock()` calls and makes the system more composable.

## Goals

- Decompose `Executor.run()` into three distinct phases: PreFlight (config resolution, context loading, security checks), Execution (the iteration loop with scope/validation/commit), and PostFlight (status updates, file movement, push, notifications, summary)
- Introduce a `ExecutorDependencies` interface so the Executor receives its collaborators via constructor injection instead of creating them internally
- Define phase interfaces (`ExecutorPhase`) with clear input/output contracts so each phase can be tested and extended independently
- Create concrete phase classes (`PreFlightPhase`, `ExecutionPhase`, `PostFlightPhase`) that encapsulate the logic currently inlined in `run()`
- Migrate all 50+ existing tests to work with the new structure, ensuring zero regression
- Maintain full backward compatibility of the public API (`Executor` constructor, `run()`, `getState()`, `pause()`, `resume()`, `executeTask()`)

## Non-Goals

- Changing the Provider interface or adding new providers
- Modifying the CLI commands layer (`src/commands/`)
- Changing the task file format or context loading logic
- Altering the parallel executor (`parallel-executor.ts`) beyond updating its Executor instantiation
- Performance optimization of the execution loop

## Tasks

### Phase 1: Define interfaces and dependency injection

- [ ] `080-executor-dependencies-interface.md` — Define the `ExecutorDependencies` interface and refactor the `Executor` constructor to accept injected dependencies.

  **Files to modify:**
  - `packages/cli/src/types/index.ts` — Add the `ExecutorDependencies` interface:
    ```typescript
    export interface ExecutorDependencies {
      git: SimpleGit;
      fs: typeof import('fs/promises');
      createScopeGuard: (scope: TaskScope, mode: ScopeMode) => ScopeGuard;
      createValidator: (config: ValidationConfig, cwd: string) => Validator;
      createProvider: (type: ProviderType, cwd: string, apiKey?: string) => Provider;
      notificationService: NotificationService;
      logger: Logger;
    }
    ```
  - `packages/cli/src/core/executor.ts` — Change the constructor signature from `constructor(config, options, cwd)` to `constructor(config, options, cwd, deps?)`. When `deps` is not provided, create the default dependencies internally (preserving backward compatibility). Store `this.deps` and use it throughout the class instead of direct imports/instantiation. Specifically:
    - Replace `this.git = simpleGit(cwd)` with `this.deps.git`
    - Replace `this.provider = createProvider(...)` with `this.deps.createProvider(...)`
    - Replace `new Validator(...)` calls with `this.deps.createValidator(...)`
    - Replace `new ScopeGuard(...)` calls with `this.deps.createScopeGuard(...)`
    - Replace `new NotificationService(...)` with `this.deps.notificationService`
    - Replace dynamic `import('fs/promises')` calls with `this.deps.fs`
    - Replace `this.logger = options.logger ?? new Logger(...)` with `this.deps.logger`

  **Testing requirements:**
  - Add new test in `executor.test.ts`: verify that when `deps` is provided, the executor uses the injected dependencies instead of creating its own
  - Add test: verify that when `deps` is omitted, default dependencies are created (backward compatibility)
  - Existing tests must continue to pass without modification (the `deps` parameter is optional)

- [ ] `081-executor-phase-interfaces.md` — Define the phase interfaces and shared context type that phases will use to communicate.

  **Files to create:**
  - `packages/cli/src/core/phases/types.ts` — Define:
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

  **Files to modify:**
  - `packages/cli/src/core/phases/index.ts` — Create barrel export for all phase types

  **Testing requirements:**
  - No runtime tests needed (type-only file), but add a type-check-only test file `packages/cli/src/core/phases/types.test.ts` that imports and uses the types to verify they compile correctly (ensures type definitions don't have errors)

### Phase 2: Extract phases from executor

- [ ] `082-preflight-phase.md` — Extract the PreFlight logic from `Executor.run()` into a `PreFlightPhase` class.

  **Files to create:**
  - `packages/cli/src/core/phases/preflight.ts` — Implement `PreFlightPhase` class that implements `ExecutorPhase<void, PreFlightResult>`. Extract the following logic from `Executor.run()` (lines 91-198 of the current file):
    1. `resolveConfig()` call and error handling (lines 91-108)
    2. `detectPlaintextSecrets()` warning emission (lines 111-118)
    3. `loadContext()` call (line 129)
    4. Resume state restoration from `blockedStatus` (lines 132-153)
    5. Context size estimation and logging (lines 161-180)
    6. Security warning for `skip_permissions` (lines 183-189)
    7. `ScopeGuard` creation (lines 192-195)
    8. `Validator` creation (line 198)

    The phase should return a `PreFlightResult` object containing all the objects needed by the execution loop.

    Methods to implement:
    - `execute(ctx: PhaseContext): Promise<PreFlightResult>`
    - `private resolveAndValidateConfig(ctx: PhaseContext): AidfConfig`
    - `private loadAndLogContext(ctx: PhaseContext): Promise<LoadedContext>`
    - `private restoreResumeState(ctx: PhaseContext, context: LoadedContext): BlockedStatus | null`
    - `private logContextSize(ctx: PhaseContext, context: LoadedContext): void`
    - `private checkSecurityWarnings(ctx: PhaseContext): boolean` (returns `skipPermissions`)

  - `packages/cli/src/core/phases/preflight.test.ts` — Tests for `PreFlightPhase`:
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
    All tests should inject mock dependencies via `PhaseContext.deps` instead of using `vi.mock()`

- [ ] `083-execution-phase.md` — Extract the iteration loop from `Executor.run()` into an `ExecutionPhase` class.

  **Files to create:**
  - `packages/cli/src/core/phases/execution.ts` — Implement `ExecutionPhase` class that implements `ExecutorPhase<PreFlightResult, ExecutionLoopResult>`. Extract the following logic from `Executor.run()` (lines 201-448):
    1. The `while` loop with its three termination conditions (line 201-205)
    2. Prompt building logic with continuation detection (lines 218-242)
    3. Provider execution with timeout (lines 244-268)
    4. Continuation fallback logic (lines 271-296)
    5. Token usage accumulation (lines 303-313)
    6. Provider-level failure handling including BLOCKED detection (lines 317-335)
    7. Scope violation checking and file reversion (lines 342-384)
    8. Validation execution and failure feedback (lines 386-405)
    9. Auto-commit logic (lines 411-415)
    10. Completion signal detection and blocked status cleanup (lines 424-444)

    Key private methods to extract:
    - `executeIteration(ctx, preFlightResult, iterState): Promise<IterationOutcome>`
    - `buildPrompt(ctx, preFlightResult, iterState): string`
    - `handleProviderResult(ctx, result, iterState): ProviderResultAction`
    - `checkScope(ctx, scopeGuard, filesChanged, hasCompletionSignal): ScopeCheckResult`
    - `runValidation(ctx, validator, hasCompletionSignal): ValidationCheckResult`
    - `commitIfNeeded(ctx, filesChanged, taskGoal): Promise<void>`

    The `iterState` is a mutable object tracking per-loop state:
    ```typescript
    interface IterationState {
      consecutiveFailures: number;
      lastValidationError?: string;
      previousOutput?: string;
      conversationState?: unknown;
      blockedStatus: BlockedStatus | null;
    }
    ```

  - `packages/cli/src/core/phases/execution.test.ts` — Tests for `ExecutionPhase`:
    - Test: completes when provider returns completion signal
    - Test: stops after max iterations
    - Test: stops after max consecutive failures
    - Test: handles dry run mode (breaks immediately)
    - Test: handles BLOCKED signal from provider
    - Test: blocks forbidden file changes in strict mode
    - Test: asks user for out-of-scope files in ask mode
    - Test: accepts user approval for out-of-scope files
    - Test: retries when completion signal + validation fails
    - Test: includes validation error in next prompt
    - Test: clears validation error after successful validation
    - Test: uses continuation prompt on iteration 2+
    - Test: falls back to full prompt when continuation fails
    - Test: passes conversationState between iterations
    - Test: disables continuation when session_continuation is false
    - Test: timeout enforcement on provider execution
    - Test: accumulates token usage across iterations
    - Test: commits changes when autoCommit is enabled
    - Test: reverts changes on scope violation
    - Test: accepts completion despite scope violation when signal detected
    All tests should use injected mock dependencies

- [ ] `084-postflight-phase.md` — Extract the PostFlight logic from `Executor.run()` into a `PostFlightPhase` class.

  **Files to create:**
  - `packages/cli/src/core/phases/postflight.ts` — Implement `PostFlightPhase` class that implements `ExecutorPhase<PostFlightInput, ExecutorResult>`. Extract the following logic from `Executor.run()` (lines 451-587):
    1. Max iterations reached check and task status update (lines 452-473)
    2. Max consecutive failures check and task status update (lines 476-497)
    3. Task status file writing for completed/failed (lines 507-536)
    4. Task file movement to completed/blocked/failed folders (lines 514-552)
    5. Git staging of task file changes (lines 521-535, 541-552)
    6. Auto-push logic (lines 555-558)
    7. Token usage summary building (line 561)
    8. ExecutorResult construction (lines 563-572)
    9. Execution summary logging (lines 575-579)
    10. Notification dispatch (lines 581-585)

    Also extract these private methods from `Executor` into the phase class:
    - `updateTaskWithBlockedStatus()` (lines 768-807)
    - `updateTaskStatus()` (lines 881-932)
    - `clearBlockedStatus()` (lines 937-974)
    - `recordResumeAttempt()` (lines 812-841)
    - `updateResumeAttemptHistory()` (lines 846-876)
    - `stageTaskFileChanges()` (lines 740-752)
    - `buildTokenUsageSummary()` (lines 620-646)
    - `logExecutionSummary()` (lines 651-676)

  - `packages/cli/src/core/phases/postflight.test.ts` — Tests for `PostFlightPhase`:
    - Test: writes COMPLETED status to task file
    - Test: writes FAILED status to task file
    - Test: writes BLOCKED status to task file
    - Test: moves task file to completed/ folder on success
    - Test: moves task file to blocked/ folder on block
    - Test: stages task file changes in git
    - Test: stages moved task file and removes old path
    - Test: handles moveTaskFile throwing (graceful fallback)
    - Test: handles stageTaskFileChanges throwing (graceful fallback)
    - Test: pushes to remote when autoPush is enabled
    - Test: builds token usage summary correctly
    - Test: builds token usage summary with estimated cost
    - Test: logs execution summary box with correct title
    - Test: dispatches notification on completion
    - Test: dispatches notification on failure
    - Test: records resume attempt in task file
    - Test: updates resume attempt history
    - Test: clears blocked status on resumed task completion
    All tests should use injected mock dependencies (especially `deps.fs` and `deps.git`)

### Phase 3: Rewire executor and migrate tests

- [ ] `085-rewire-executor.md` — Rewire `Executor.run()` to delegate to the three phase classes, replacing the inlined logic.

  **Files to modify:**
  - `packages/cli/src/core/executor.ts` — The new `run()` method should be approximately:
    ```typescript
    async run(taskPath: string): Promise<ExecutorResult> {
      this.state.status = 'running';
      this.state.startedAt = new Date();
      this.state.iteration = 0;
      this.logger.setContext({ task: taskPath, iteration: 0 });

      const ctx: PhaseContext = {
        config: this.config,
        options: this.options,
        state: this.state,
        cwd: this.cwd,
        taskPath,
        deps: this.deps,
      };

      try {
        // Phase 1: PreFlight
        const preFlight = new PreFlightPhase();
        const preFlightResult = await preFlight.execute(ctx);

        // Phase 2: Execution Loop
        const executionPhase = new ExecutionPhase();
        const executionResult = await executionPhase.execute(ctx, preFlightResult);

        // Phase 3: PostFlight
        const postFlight = new PostFlightPhase();
        return await postFlight.execute(ctx, { preFlightResult, executionResult });
      } catch (error) {
        this.state.status = 'failed';
        this.state.lastError = error instanceof Error ? error.message : 'Unknown error';
        this.state.completedAt = new Date();

        // Still run postflight for failed state
        const postFlight = new PostFlightPhase();
        return await postFlight.execute(ctx, {
          preFlightResult: null,
          executionResult: { completedNormally: false, terminationReason: 'failed', lastError: this.state.lastError },
        });
      }
    }
    ```

    Remove all private methods that were extracted to phase classes:
    - `revertChanges()` -> `ExecutionPhase`
    - `commitChanges()` -> `ExecutionPhase`
    - `executeWithTimeout()` -> `ExecutionPhase`
    - `updateTaskWithBlockedStatus()` -> `PostFlightPhase`
    - `updateTaskStatus()` -> `PostFlightPhase`
    - `clearBlockedStatus()` -> `PostFlightPhase`
    - `recordResumeAttempt()` -> extracted (called from PreFlight or PostFlight)
    - `updateResumeAttemptHistory()` -> `PostFlightPhase`
    - `stageTaskFileChanges()` -> `PostFlightPhase`
    - `buildTokenUsageSummary()` -> `PostFlightPhase`
    - `logExecutionSummary()` -> `PostFlightPhase`

    Keep these methods on `Executor` (they are part of the public/semi-public API):
    - `pause()`, `resume()`, `getState()`
    - `emitPhase()` (used by ExecutionPhase via `ctx.options.onPhase`)
    - `log()` (used everywhere via `ctx.deps.logger`)

  - `packages/cli/src/core/phases/index.ts` — Export all phase classes

  **Testing requirements:**
  - All existing tests in `executor.test.ts` must continue to pass without modification
  - Run the full test suite (`pnpm test`) to verify no regressions

- [ ] `086-migrate-executor-tests.md` — Refactor `executor.test.ts` to use dependency injection instead of module-level `vi.mock()` calls, improving test clarity and reliability.

  **Files to modify:**
  - `packages/cli/src/core/executor.test.ts` — Refactor approach:
    1. Remove all top-level `vi.mock()` calls for `context-loader.js`, `providers/index.js`, `providers/claude-cli.js`, `validator.js`, `simple-git`, `utils/files.js`
    2. Instead, create a `createMockDeps()` helper function that returns a fully mocked `ExecutorDependencies` object:
       ```typescript
       function createMockDeps(overrides?: Partial<ExecutorDependencies>): ExecutorDependencies {
         return {
           git: { checkout: vi.fn(), add: vi.fn(), commit: vi.fn(), push: vi.fn(), raw: vi.fn() } as unknown as SimpleGit,
           fs: { readFile: vi.fn(), writeFile: vi.fn() } as unknown as typeof import('fs/promises'),
           createScopeGuard: vi.fn((scope, mode) => new ScopeGuard(scope, mode)),
           createValidator: vi.fn((config, cwd) => ({ preCommit: vi.fn().mockResolvedValue({ phase: 'pre_commit', passed: true, results: [], totalDuration: 0 }) })),
           createProvider: vi.fn(() => ({ name: 'mock', execute: vi.fn(), isAvailable: vi.fn().mockResolvedValue(true) })),
           notificationService: { notifyResult: vi.fn() } as unknown as NotificationService,
           logger: new Logger({ verbose: false }),
           ...overrides,
         };
       }
       ```
    3. Update each test to pass `createMockDeps()` as the 4th argument to `new Executor(config, options, cwd, deps)`
    4. Update mock setup to configure behavior on `deps.createProvider()` return value instead of the top-level mock
    5. Keep the same test structure (describe blocks, test names) so the test count remains the same
    6. Verify all 50+ tests pass

  **Testing requirements:**
  - Run `pnpm test` to verify all tests pass
  - Run `pnpm test -- --coverage` to verify coverage is maintained or improved
  - Verify no `vi.mock()` calls remain in executor.test.ts (except for `fs` if needed for the `executeTask` factory function tests)

- [ ] `087-update-parallel-executor.md` — Update `ParallelExecutor` to pass dependencies to the `Executor` instances it creates.

  **Files to modify:**
  - `packages/cli/src/core/parallel-executor.ts` — Update the `Executor` instantiation to optionally accept and forward `ExecutorDependencies`. This is a minimal change: the parallel executor should accept an optional `deps` in its own options and pass it through when creating child Executor instances. If not provided, Executor will use its own defaults (no behavior change).

  **Testing requirements:**
  - Existing parallel executor tests must pass without modification
  - Add one test: verify that when `deps` is provided in `ParallelExecutorOptions`, it is forwarded to child Executor instances

### Phase 4: Cleanup and documentation

- [ ] `088-cleanup-and-docs.md` — Final cleanup, update CLAUDE.md architecture section, and verify everything works end-to-end.

  **Files to modify:**
  - `packages/cli/src/core/executor.ts` — Remove any dead code, unused imports, or commented-out blocks left over from the refactor. Ensure the file is under 150 lines (down from ~987).
  - `CLAUDE.md` (project root) — Update the "Architecture" and "Execution Flow" sections to reflect the new phase-based structure:
    ```
    ### Execution Flow
    aidf run -> PreFlightPhase (config, context, scope, validator) ->
      ExecutionPhase (iteration loop: prompt -> provider -> scope -> validate -> commit) ->
      PostFlightPhase (status update, file movement, push, notifications, summary)
    ```
    Update the file listing to include `packages/cli/src/core/phases/`
  - `packages/cli/src/core/phases/index.ts` — Ensure clean barrel exports

  **Testing requirements:**
  - Run `pnpm test` — all tests must pass (298+ existing + new phase tests)
  - Run `pnpm lint` — no lint errors
  - Run `pnpm typecheck` — no type errors
  - Run `pnpm build` — builds successfully
  - Manual smoke test: `npx aidf run .ai/tasks/some-test-task.md --dry-run` works correctly

## Dependencies

```
080 ──┐
      ├──> 082 ──┐
081 ──┤          │
      ├──> 083 ──┼──> 085 ──> 086 ──> 088
      │          │
      └──> 084 ──┘           087 ──┘
```

- **080** (dependencies interface) and **081** (phase interfaces) can be done in parallel
- **082** (preflight), **083** (execution), **084** (postflight) all depend on 080 + 081; they can be done in parallel with each other
- **085** (rewire) depends on 082 + 083 + 084 (all phases must exist before rewiring)
- **086** (migrate tests) depends on 085 (new structure must be in place)
- **087** (parallel executor) depends on 080 (needs the deps interface) but can be done in parallel with 082-086
- **088** (cleanup) depends on everything else

## Risks

- **Test regression**: The executor has 50+ tests with intricate mock setups. Migrating to DI-based testing could introduce subtle failures if mock behavior does not perfectly match the original `vi.mock()` behavior. Mitigate by keeping the old test file intact during Phase 2 development and only switching in Phase 3.
- **State mutation across phases**: The `ExecutorState` is currently mutated in-place throughout `run()`. Phases will share a reference to the same state object, which means ordering and mutation timing must be preserved exactly. Mitigate by keeping `PhaseContext.state` as a mutable reference (not a copy) and documenting which fields each phase is responsible for.
- **Backward compatibility**: The `Executor` constructor and `executeTask()` factory are public API. Any signature change must be backward compatible. Mitigate by making `deps` an optional parameter with sensible defaults.
- **Phase boundary decisions**: Some logic straddles phase boundaries (e.g., `recordResumeAttempt` is called during PreFlight but writes to a file, which feels like PostFlight). Mitigate by documenting the responsibility of each phase clearly and accepting that some operations will need to reference utilities from other phases.
- **Circular imports**: Phase files will import from `types/index.ts` and may need access to `ScopeGuard`, `Validator`, etc. Mitigate by ensuring phases import only interfaces/types and receive concrete instances via dependency injection.

## Success Criteria

- `Executor.run()` is reduced from ~500 lines to ~30 lines (delegation to three phases)
- The total line count of `executor.ts` is under 150 lines (down from ~987)
- All 298+ existing tests pass without modification during the transition (Phase 3 task 085)
- After migration (Phase 3 task 086), `executor.test.ts` has zero `vi.mock()` calls for core dependencies
- New phase test files (`preflight.test.ts`, `execution.test.ts`, `postflight.test.ts`) provide focused unit tests for each phase
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` all pass cleanly
- The `executeTask()` factory function continues to work without changes
- The `ParallelExecutor` continues to work without changes to its external behavior
