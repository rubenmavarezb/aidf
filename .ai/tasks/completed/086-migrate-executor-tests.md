# TASK: Migrate executor tests to use dependency injection

## Goal

Refactor `executor.test.ts` to use dependency injection instead of module-level `vi.mock()` calls. Replace all top-level mocks with a `createMockDeps()` helper that returns a fully mocked `ExecutorDependencies` object. This improves test clarity, reliability, and makes tests easier to maintain.

## Task Type

test

## Suggested Roles

- tester

## Auto-Mode Compatible

YES

## Scope

### Allowed

- `packages/cli/src/core/executor.test.ts`

### Forbidden

- `packages/cli/src/core/executor.ts` (read-only)
- `packages/cli/src/core/phases/` (read-only)
- `packages/cli/src/commands/` (do not touch)

## Requirements

1. Remove all top-level `vi.mock()` calls from `executor.test.ts` for:
   - `context-loader.js`
   - `providers/index.js`
   - `providers/claude-cli.js`
   - `validator.js`
   - `simple-git`
   - `utils/files.js`

2. Create a `createMockDeps()` helper function within the test file:
   ```typescript
   function createMockDeps(overrides?: Partial<ExecutorDependencies>): ExecutorDependencies {
     return {
       git: {
         checkout: vi.fn(),
         add: vi.fn(),
         commit: vi.fn(),
         push: vi.fn(),
         raw: vi.fn(),
       } as unknown as SimpleGit,
       fs: {
         readFile: vi.fn(),
         writeFile: vi.fn(),
       } as unknown as typeof import('fs/promises'),
       createScopeGuard: vi.fn((scope, mode) => new ScopeGuard(scope, mode)),
       createValidator: vi.fn((config, cwd) => ({
         preCommit: vi.fn().mockResolvedValue({
           phase: 'pre_commit',
           passed: true,
           results: [],
           totalDuration: 0,
         }),
       })),
       createProvider: vi.fn(() => ({
         name: 'mock',
         execute: vi.fn(),
         isAvailable: vi.fn().mockResolvedValue(true),
       })),
       notificationService: {
         notifyResult: vi.fn(),
       } as unknown as NotificationService,
       logger: new Logger({ verbose: false }),
       ...overrides,
     };
   }
   ```

3. Update each test to pass `createMockDeps()` as the 4th argument to `new Executor(config, options, cwd, deps)`.

4. Update mock setup within each test or `beforeEach` to configure behavior on the `deps` object instead of top-level mocks. For example:
   - Instead of `mockCreateProvider.mockReturnValue(mockProvider)`, use `deps.createProvider = vi.fn(() => mockProvider)` or pass it as an override to `createMockDeps({ createProvider: vi.fn(() => mockProvider) })`.

5. Keep the same test structure: all `describe` blocks and test names must remain the same so the test count stays identical.

6. If `vi.mock()` is still needed for the `executeTask` factory function tests (since `executeTask` is a standalone function that internally creates an Executor), that is acceptable, but document why.

7. Verify all 50+ tests pass after migration.

## Definition of Done

- [ ] No `vi.mock()` calls for core dependencies remain in `executor.test.ts` (exception: `executeTask` factory if needed)
- [ ] `createMockDeps()` helper is defined and used by all tests
- [ ] All tests pass `deps` as the 4th argument to `new Executor()`
- [ ] Same test count: all `describe` blocks and test names are preserved
- [ ] All 50+ tests pass
- [ ] `pnpm test` passes (full suite)
- [ ] `pnpm test -- --coverage` shows maintained or improved coverage
- [ ] `pnpm lint` passes

## Notes

- Part of PLAN-v080-executor-refactor.md (Phase 3)
- Depends on task 085 (rewire executor) — the new structure must be in place
- This is the test migration step; the tests were untouched during task 085 to validate backward compatibility
- Now we improve the test internals to use DI, making them more readable and reliable
- Be careful to replicate the exact mock behavior of the original `vi.mock()` calls — subtle differences can cause test failures
- The `createMockDeps` helper with `overrides` parameter allows per-test customization
