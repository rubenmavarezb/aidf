# TASK: Dedicated tests for v1.3.0 polish (Model Profiles, Codebase Mapping, Verification Loop)

## Goal

Add dedicated integration and E2E test tasks for the v1.3.0 plan (PLAN-v130-phase3-polish) covering model profile resolution, brownfield codebase mapping via `aidf map`, and the post-execution verification loop.

## Task Type

test

## Suggested Roles

- tester

## Auto-Mode Compatible

YES

## Scope

### Allowed

- `packages/cli/src/__tests__/e2e/model-profiles.e2e.test.ts`
- `packages/cli/src/__tests__/e2e/codebase-mapping.e2e.test.ts`
- `packages/cli/src/__tests__/e2e/verification-loop.e2e.test.ts`

### Forbidden

- `packages/cli/src/core/model-resolver.ts` (read-only)
- `packages/cli/src/core/codebase-analyzer.ts` (read-only)
- `packages/cli/src/core/agents-generator.ts` (read-only)
- `packages/cli/src/core/verifier.ts` (read-only)
- `packages/cli/src/commands/**` (read-only)

## Requirements

### Model Profiles E2E (model-profiles.e2e.test.ts)
1. Profile resolution: `quality` profile → research task → verify `claude-opus-4-6` selected
2. Profile resolution: `budget` profile → implementation task → verify `claude-sonnet-4-6` selected
3. Profile resolution: `budget` profile → verification phase → verify `claude-haiku-4-5-20251001` selected
4. Task type mapping: research → planner model, component/refactor/bugfix → executor model, test/docs → executor model
5. Custom profile override: custom config with specific models → verify custom models used
6. Explicit model precedence: config has both `profile: balanced` and `model: gpt-4o` → verify explicit model wins
7. Cost multiplier: `budget` profile has lower multiplier than `quality`
8. Config integration: write `models: { profile: balanced }` to config.yml → load config → verify profile parsed correctly

### Codebase Mapping E2E (codebase-mapping.e2e.test.ts)
9. TypeScript project detection: create `package.json` with typescript dep + `tsconfig.json` → analyze → verify TypeScript detected
10. React + Next.js detection: create `package.json` with react + next deps → analyze → verify both frameworks detected
11. Architecture detection: create `src/components/`, `src/pages/`, `src/api/` → verify architecture pattern detected
12. Convention detection: create `.eslintrc.js` + `.prettierrc` → verify linter/formatter detected
13. Boundary detection: create `.env`, `.env.local`, `migrations/` → verify sensitive/migration files detected
14. Command detection: create `package.json` with `scripts: { dev, build, test, lint }` → verify commands extracted
15. AGENTS.md generation: run full analysis → generate AGENTS.md → verify all sections present with project-specific content
16. Confidence markers: low-confidence sections have `<!-- TODO -->` markers
17. Monorepo detection: create `packages/a/package.json` + `packages/b/package.json` → verify `monorepo` project type

### Verification Loop E2E (verification-loop.e2e.test.ts)
18. Anti-pattern detection: create file with `TODO`, `FIXME`, `console.log` → verify all detected with file/line info
19. Anti-pattern detection: create file with `debugger` statement → verify detected
20. Anti-pattern: empty function body → verify detected
21. Clean file: create file with no anti-patterns → verify empty result
22. DoD extraction: create task file with Definition of Done checklist → extract criteria → verify all items captured
23. Verification prompt building: given task DoD + modified files → verify prompt includes both
24. Verdict determination: all criteria met + no anti-patterns → verify `passed`
25. Verdict determination: anti-patterns found → verify `gaps_found` with specific patterns listed

## Definition of Done

- [ ] 25+ test cases implemented and passing
- [ ] Model profile resolution tested for all built-in profiles and custom overrides
- [ ] Codebase mapping tested against realistic project structures on disk
- [ ] Verification loop tested for anti-pattern detection and DoD checking
- [ ] Each test uses `createTempProject()` from E2E helpers where applicable
- [ ] `pnpm test` — all existing tests continue to pass

## Notes

- Part of PLAN-v130-phase3-polish.md
- Depends on tasks 130-138 being implemented first
- Uses E2E test infrastructure from task 090
- Codebase mapping tests should create realistic project skeletons (package.json, tsconfig, etc.)
