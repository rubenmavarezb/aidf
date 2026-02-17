# TASK: E2E tests for SkillLoader with real disk structures

## Goal

Test SkillLoader discovery, loading, security validation, and XML generation against complex real directory structures on disk. File: `packages/cli/src/__tests__/e2e/skill-loader-disk.e2e.test.ts`.

## Task Type

test

## Suggested Roles

- tester

## Auto-Mode Compatible

YES

## Scope

### Allowed

- `packages/cli/src/__tests__/e2e/skill-loader-disk.e2e.test.ts`

### Forbidden

- `packages/cli/src/core/skill-loader.ts` (read-only)
- `packages/cli/src/core/executor.ts` (read-only)
- `packages/cli/src/commands/**` (read-only)
- `packages/cli/src/utils/**` (read-only)

## Requirements

1. **Discover skills in nested directory structure** — Create `.ai/skills/skill-a/SKILL.md`, `.ai/skills/skill-b/SKILL.md`, `.ai/skills/not-a-skill/README.md`. Verify `discoverSkills()` returns exactly 2 skills (skill-a, skill-b).

2. **Load skills from multiple directories (project + config)** — Create skills in `.ai/skills/` and an extra directory. Pass extra directory via config. Verify both are discovered with correct `source` values (`project` vs `config`).

3. **Skill priority: project overrides config** — Create a skill with the same name in both `.ai/skills/my-skill/SKILL.md` and `extra/my-skill/SKILL.md`. Verify the project version takes priority (appears first or only once with `source: 'project'`).

4. **Large skill file handling** — Create a SKILL.md with 10,000 lines of content. Verify it loads without error and the full content is available.

5. **Skill with complex frontmatter** — Create a SKILL.md with multi-value tags (`tags: typescript, react, testing, ci-cd`), multi-value globs (`globs: src/**/*.ts, src/**/*.tsx, tests/**`). Verify all values are parsed as arrays.

6. **Security validation on real files** — Create a skill containing `ignore previous instructions`. Verify `loadAll()` with `block_suspicious: true` excludes it. Verify `loadAll()` with `block_suspicious: false` includes it with warnings.

7. **loadByName with real files** — Create 3 skills on disk. Call `loadByName('skill-b')`. Verify it returns exactly skill-b with correct content. Call `loadByName('nonexistent')`. Verify it returns null.

8. **Empty skills directory** — Create `.ai/skills/` with no subdirectories. Verify `discoverSkills()` returns `[]` without error.

9. **Skill with missing frontmatter fields** — Create a SKILL.md with `name` but no `description`. Verify it is skipped during discovery (not loaded).

10. **generateSkillsXml with real loaded skills** — Discover and load 3 skills from disk. Pass them to `generateSkillsXml()`. Verify the output contains all 3 `<skill>` elements with correct names, descriptions, tags, and instruction content. Verify XML special characters in skill content are properly escaped.

## Definition of Done

- [ ] All 10 test cases are implemented and passing
- [ ] Tests use E2E helpers from task 090 (`createTempProject`, `createSkillFixture`)
- [ ] Tests run against real SKILL.md files on disk, not mocked filesystem
- [ ] Skill discovery correctly finds SKILL.md files and ignores non-skill files
- [ ] Multi-directory loading correctly identifies source (project vs config)
- [ ] Priority/deduplication logic is verified with same-name skills from different sources
- [ ] Large file handling test verifies no memory or parsing issues with 10,000-line skills
- [ ] Security validation test verifies both blocking and warning behaviors
- [ ] XML generation test verifies correct structure, content, and escaping
- [ ] Each test creates its own temp directory and cleans up after itself
- [ ] `pnpm test` — all existing tests continue to pass

## Notes

- Part of PLAN-v080-e2e-tests.md
- Depends on task 090 (E2E test infrastructure)
- Independent of tasks 091-096
- SKILL.md files follow the agentskills.io standard with frontmatter (name, description, version, tags, globs) + markdown body
