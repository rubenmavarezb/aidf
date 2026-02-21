# PLAN: v1.0.x — Fix `aidf task create` editor hang

## Status: PENDING

## Overview

`aidf task create` hangs indefinitely after template selection. The root cause is the `type: 'editor'` inquirer prompt for the "Requirements" field (line 388 of `task.ts`). Inquirer's editor type spawns an external editor process (vim/nano via `$EDITOR`), which silently fails or blocks in environments where no editor is configured, the TTY can't be handed off, or the user doesn't realize an editor was opened. This is a critical UX bug — it makes `task create` unusable in many terminal contexts.

The fix replaces the fragile `editor` prompt with a robust multi-step input flow, adds test coverage for the command (currently at 0%), and improves the overall interactive experience.

## Goals

- Eliminate the `editor` prompt hang in `aidf task create`
- Replace with a reliable input mechanism that still supports multi-line requirements
- Add test coverage for the `task create` command (currently no `task.test.ts` exists)
- Preserve template defaults — structured templates like `dependency-update` should still pre-fill requirements

## Non-Goals

- Redesigning the full `task create` flow
- Adding a TUI/visual editor
- Changing other commands that use inquirer

## Tasks

### Phase 1: Fix the editor hang

- [ ] `090-replace-editor-prompt.md` — Replace `type: 'editor'` with a reliable input flow for requirements (wave: 1)

  **Problem:**
  Line 384-388 in `packages/cli/src/commands/task.ts`:
  ```typescript
  {
    type: 'editor',
    name: 'requirements',
    message: 'Requirements (opens editor):',
    default: templateDefaults.requirements || '- Requirement 1\n- Requirement 2',
  }
  ```
  This is the **only** `type: 'editor'` usage in the entire codebase. It fails silently when `$EDITOR` is not set or the editor can't attach to the TTY.

  **Solution:**
  Replace the single `editor` prompt with a two-step approach:

  1. If template provides structured requirements (contains `###` subsections, like `dependency-update`), show them pre-filled and ask the user to confirm or customize:
     ```typescript
     {
       type: 'confirm',
       name: 'useTemplateRequirements',
       message: 'Use template requirements as-is?',
       default: true,
       when: () => templateDefaults.requirements?.includes('###'),
     }
     ```
  2. For custom/simple requirements, use a loop of `input` prompts that collects requirements one at a time until the user submits an empty line:
     ```typescript
     // Collect requirements one by one
     const requirements: string[] = [];
     let adding = true;
     while (adding) {
       const { req } = await inquirer.prompt([{
         type: 'input',
         name: 'req',
         message: requirements.length === 0
           ? 'Add a requirement (empty to finish):'
           : 'Add another requirement (empty to finish):',
       }]);
       if (req.trim()) {
         requirements.push(req.trim());
       } else {
         adding = false;
       }
     }
     ```
  3. If the user provides zero requirements AND template has defaults, fall back to template defaults.
  4. If zero requirements and no template, use a sensible default: `['Implementation complete']`.

  **Changes to `packages/cli/src/commands/task.ts`:**
  - Remove the `editor` prompt from the `inquirer.prompt()` chain (line 384-388)
  - Split `promptForTask()` into two phases:
    - Phase A: the existing `inquirer.prompt()` for goal, taskType, roles, paths, definitionOfDone (everything except requirements)
    - Phase B: the new requirements collection logic (confirm template OR input loop)
  - Merge results into `TaskAnswers`
  - Update `TaskAnswers.requirements` type from `string` to `string` (no change, but the content is now `- item\n- item` format built from the array)

  **Edge cases to handle:**
  - Template with structured requirements (has `###` subsections): offer confirm, don't loop
  - Template with simple requirements (just bullet points): pre-fill the loop with existing items shown as context
  - No template: start fresh loop
  - User enters only whitespace: treat as empty (finish loop)

  **Scope:**
  - Allowed: `packages/cli/src/commands/task.ts`
  - Forbidden: `packages/cli/src/core/**`, `packages/cli/src/types/**`

  **Definition of Done:**
  - [ ] `type: 'editor'` removed from task.ts
  - [ ] Requirements collected via input loop or template confirmation
  - [ ] `aidf task create` completes without hanging on all 6 templates
  - [ ] `aidf task create` completes without hanging with "None (from scratch)"
  - [ ] Template defaults (including structured ones like dependency-update) are preserved
  - [ ] `pnpm lint` and `pnpm typecheck` pass

### Phase 2: Add test coverage

- [ ] `091-task-command-tests.md` — Create `task.test.ts` with tests for create, list, and status subcommands (wave: 2, depends: 090)

  **New file `packages/cli/src/commands/task.test.ts`:**

  Mock setup (follow pattern from `init.test.ts`):
  ```typescript
  vi.mock('inquirer', () => ({
    default: { prompt: vi.fn() },
  }));
  ```

  **Tests to write:**

  `describe('task create')`:
  - Test: creates task file in `pending/` directory with correct content
  - Test: uses template defaults when template is selected
  - Test: handles "None (from scratch)" template selection
  - Test: collects requirements via input loop (simulates multiple inputs then empty)
  - Test: uses template requirements when user confirms structured template
  - Test: generates sequential task numbers (scans existing files)
  - Test: generates correct slug from goal text
  - Test: fails gracefully when no AIDF project found
  - Test: fails when specified template name doesn't exist

  `describe('task list')`:
  - Test: lists pending tasks from `pending/` subfolder
  - Test: lists blocked tasks from `blocked/` subfolder
  - Test: excludes completed tasks by default
  - Test: includes completed tasks with `--all` flag
  - Test: handles empty task directories
  - Test: detects status from file content (backward compat, root tasks/)

  `describe('task status')`:
  - Test: shows task details for specific task path
  - Test: shows summary when no task specified
  - Test: fails gracefully for non-existent task

  **Scope:**
  - Allowed: `packages/cli/src/commands/task.test.ts`
  - Forbidden: `packages/cli/src/core/**`, `packages/cli/src/commands/task.ts` (no changes to source in this task)

  **Definition of Done:**
  - [ ] `task.test.ts` exists with 15+ tests
  - [ ] All tests pass (`pnpm test`)
  - [ ] Tests mock inquirer and fs correctly (no real file I/O)
  - [ ] Tests cover the new requirements input flow (not the old editor prompt)

## Dependencies

```
090 ──> 091
```

- **090** (fix) has no prerequisites — can start immediately
- **091** (tests) depends on 090 — tests should validate the new behavior

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Input loop UX feels clunky vs editor for long requirements | Medium | Low | Template confirmation path avoids the loop for structured templates; users can always edit the .md file after creation |
| Mocking inquirer's sequential `.prompt()` calls in tests is complex | Medium | Low | Use `vi.fn().mockResolvedValueOnce()` chaining; follow init.test.ts pattern |
| Breaking the `filter` function on definitionOfDone prompt | Low | Medium | Keep that prompt unchanged; only modify requirements |

## Success Criteria

- [ ] `aidf task create` completes end-to-end without hanging (all templates + from scratch)
- [ ] Structured templates (dependency-update) show their requirements and let user confirm
- [ ] Simple templates pre-fill with bullet points
- [ ] Task file output is identical format to before (markdown with `## Requirements` section)
- [ ] 15+ tests in `task.test.ts`, all passing
- [ ] `pnpm test`, `pnpm lint`, `pnpm typecheck` all green

## Notes

- This is the **only** usage of `type: 'editor'` in the codebase. No other commands are affected.
- Inquirer v9.3.0 delegates editor launching to `@inquirer/external-editor`, which depends on `$EDITOR` / `$VISUAL` environment variables. Many terminal environments (especially integrated terminals in IDEs, CI, or remote SSH) don't have these set.
- The dependency-update template has a very structured requirements section with 7 subsections. The confirm-or-customize flow handles this gracefully without forcing the user through a line-by-line input loop.
- Future improvement: if demand exists, add `--editor` flag that explicitly opts into the external editor flow for power users who know their `$EDITOR` is configured.
