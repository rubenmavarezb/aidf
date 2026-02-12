# PLAN: Tech Debt Cleanup — Config, Types & Code Quality

## Overview

Consolidate duplicated config loading, fix type errors, remove zombie types, and improve code quality. These are small, focused fixes addressing technical debt accumulated during rapid iteration.

## Goals

- Single source of truth for config loading
- Clean typecheck (zero errors)
- No zombie/orphan types
- Consistent code language (English)

## Non-Goals

- New features
- Refactoring the executor loop
- Changing the provider interface
- Adding new commands or skills

## Tasks

### Phase 1: Config consolidation

- [x] `056-consolidate-load-config.md` - Extract shared `loadConfig()` into `utils/config.ts`
- [x] `057-remove-detected-commands-type.md` - Replace `DetectedCommands` with `DetectedValidation`

### Phase 2: Type & lint cleanup

- [x] `058-fix-status-typecheck-error.md` - Fix pre-existing TS2352 in status.ts:300
- [x] `059-fix-any-warnings-tests.md` - Replace `any` with proper types in test files (89 → 0)

### Phase 3: Integration testing

- [x] `060-integration-test-init-to-execute.md` - E2E test: init generates config that executor can load

## Dependencies

- None. All tasks are independent (can run in any order).

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Shared loadConfig breaks a consumer | Low | Med | All 3 current consumers have identical logic |
| Removing DetectedCommands breaks init tests | Low | Low | init.test.ts will be updated in same task |

## Success Criteria

- [x] `pnpm typecheck` passes with zero errors
- [x] `pnpm lint` has fewer warnings than before (89 → 0)
- [x] Only one `loadConfig` implementation exists
- [x] `DetectedCommands` type no longer exists
- [x] Integration test validates init → load → executor pipeline
