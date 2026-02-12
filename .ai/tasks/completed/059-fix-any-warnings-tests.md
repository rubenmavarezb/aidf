# TASK: Replace explicit `any` types in test files with proper types

## Goal

Reduce the 89 `@typescript-eslint/no-explicit-any` lint warnings in test files by replacing `any` with proper types or `unknown`.

## Task Type

refactor

## Suggested Roles

- developer

## Auto-Mode Compatible

YES - Mechanical type replacements.

## Scope

### Allowed

- `packages/cli/src/**/*.test.ts`

### Forbidden

- `packages/cli/src/**/*.ts` (non-test source files)
- `templates/**`
- `docs/**`

## Requirements

1. Replace `as any` casts with proper types where the actual type is known
2. Use `unknown` + type narrowing where the exact type isn't important
3. For mock functions, use `vi.fn()` typed generics instead of casting to `any`
4. Do NOT change test behavior — only type annotations

Files with warnings (by count):
- `tool-handler.test.ts` — 28 warnings
- `status.test.ts` — 15 warnings
- `openai-api.test.ts` — 16 warnings
- `anthropic-api.test.ts` — 12 warnings
- `hooks.test.ts` — 8 warnings
- `parallel-executor.test.ts` — 6 warnings
- `watch.test.ts` — 2 warnings
- `logger.ts` — 1 warning

## Definition of Done

- [ ] `pnpm lint` reports significantly fewer warnings (target: <20)
- [ ] Zero new lint errors
- [ ] `pnpm test` — all tests pass
- [ ] No test behavior changed

## Notes

- Prioritize files with the most warnings first
- Some `any` may be legitimately needed for mocking — document with `// eslint-disable-next-line` + comment if truly unavoidable
- Don't spend time on diminishing returns — reducing from 89 to <20 is a good target
