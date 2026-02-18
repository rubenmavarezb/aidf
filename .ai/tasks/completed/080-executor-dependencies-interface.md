# TASK: Define ExecutorDependencies interface and refactor constructor

## Goal

Define an `ExecutorDependencies` interface that makes the Executor's external collaborators (SimpleGit, fs, Validator, ScopeGuard, NotificationService, Provider factory, Logger) injectable via the constructor. Refactor the `Executor` constructor to accept an optional `deps` parameter. When `deps` is not provided, create the default dependencies internally (preserving full backward compatibility). Replace all internal instantiation of these collaborators with usage of `this.deps`.

## Task Type

refactor

## Suggested Roles

- developer

## Auto-Mode Compatible

YES

## Scope

### Allowed

- `packages/cli/src/types/index.ts`
- `packages/cli/src/core/executor.ts`
- `packages/cli/src/core/executor.test.ts`

### Forbidden

- `packages/cli/src/commands/` (read-only)
- `packages/cli/src/core/phases/` (do not create yet)
- `packages/cli/src/core/parallel-executor.ts` (read-only for now)

## Requirements

1. Add the `ExecutorDependencies` interface to `packages/cli/src/types/index.ts`:
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

2. Change the `Executor` constructor signature from `constructor(config, options, cwd)` to `constructor(config, options, cwd, deps?)`. The `deps` parameter must be optional.

3. When `deps` is not provided, create default dependencies internally using the same logic currently in the constructor, preserving backward compatibility. Store everything as `this.deps`.

4. Replace all internal usages of directly instantiated dependencies with `this.deps`:
   - Replace `this.git = simpleGit(cwd)` with `this.deps.git`
   - Replace `this.provider = createProvider(...)` with `this.deps.createProvider(...)`
   - Replace `new Validator(...)` calls with `this.deps.createValidator(...)`
   - Replace `new ScopeGuard(...)` calls with `this.deps.createScopeGuard(...)`
   - Replace `new NotificationService(...)` with `this.deps.notificationService`
   - Replace dynamic `import('fs/promises')` calls with `this.deps.fs`
   - Replace `this.logger = options.logger ?? new Logger(...)` with `this.deps.logger`

5. Ensure the `executeTask()` factory function continues to work without any changes to its signature or behavior.

6. Add new tests to `executor.test.ts`:
   - Verify that when `deps` is provided, the executor uses the injected dependencies instead of creating its own
   - Verify that when `deps` is omitted, default dependencies are created (backward compatibility)

7. All existing tests in `executor.test.ts` must continue to pass without modification (the `deps` parameter is optional, so existing tests that do not pass it should behave identically).

## Definition of Done

- [ ] `ExecutorDependencies` interface is defined in `packages/cli/src/types/index.ts`
- [ ] `Executor` constructor accepts optional `deps` parameter
- [ ] Default dependencies are created when `deps` is omitted (backward compatible)
- [ ] All internal usages of collaborators go through `this.deps`
- [ ] `executeTask()` factory function works without changes
- [ ] New tests verify DI works when `deps` is provided
- [ ] New tests verify backward compatibility when `deps` is omitted
- [ ] All existing 50+ executor tests pass without modification
- [ ] `pnpm test` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes

## Notes

- Part of PLAN-v080-executor-refactor.md (Phase 1)
- This is a prerequisite for all subsequent tasks (082-088)
- Can be done in parallel with task 081 (phase interfaces)
- The key principle is backward compatibility: no existing code that creates an Executor should break
