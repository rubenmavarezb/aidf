# TASK: Dedicated tests for v1.2.0 moat deepening (Context Freshness, Research Pipeline, Smart Waves)

## Goal

Add dedicated integration and E2E test tasks for the v1.2.0 plan (PLAN-v120-phase2-moat-deepening) covering context freshness between waves, the research-to-implementation findings pipeline, and inter-wave verification.

## Task Type

test

## Suggested Roles

- tester

## Auto-Mode Compatible

YES

## Scope

### Allowed

- `packages/cli/src/__tests__/e2e/context-freshness.e2e.test.ts`
- `packages/cli/src/__tests__/e2e/research-pipeline.e2e.test.ts`
- `packages/cli/src/__tests__/e2e/inter-wave-verification.e2e.test.ts`

### Forbidden

- `packages/cli/src/core/summary-generator.ts` (read-only)
- `packages/cli/src/core/context-loader.ts` (read-only)
- `packages/cli/src/core/parallel-executor.ts` (read-only)
- `packages/cli/src/core/plan-executor.ts` (read-only)

## Requirements

### Context Freshness E2E (context-freshness.e2e.test.ts)
1. Generate TaskSummary from mock ExecutorResult → verify all fields populated (filesModified, decisions, keyChanges)
2. Render summary as markdown → verify ≤30 lines, contains key sections
3. Render summaries for prompt injection → verify format is AI-consumable
4. Save/load roundtrip: save summary to `.ai/summaries/` → load all → verify content intact
5. Wave summary accumulation: wave 1 summaries → wave 2 gets them → wave 3 gets wave 1+2 summaries
6. Context with summaries: pass `previousSummaries` to ContextLoader → verify context includes `## Previous Results` section
7. Context size estimation: verify `estimateContextSize()` includes previousResults in breakdown
8. Summary cap: inject >5 summaries → verify only most recent are included (if cap implemented)

### Research Pipeline E2E (research-pipeline.e2e.test.ts)
9. Research task type parsing: create task with `type: research` → parse → verify `taskType === 'research'`
10. Research findings loading: create `.ai/research/auth-findings.md` on disk → use ContextLoader → verify findings loaded
11. Keyword matching: create findings file with "auth" in name → create implementation task with "auth" in goal → verify findings auto-loaded
12. Explicit reference: add `## Research Context\n- .ai/research/auth-findings.md` to task → verify only referenced findings loaded
13. Research skill loading: create `SKILL-researcher.md` on disk → verify SkillLoader discovers it without security warnings
14. Scope enforcement for research tasks: research task scope forbids `src/**` → create file in `src/` → verify BLOCK

### Inter-Wave Verification E2E (inter-wave-verification.e2e.test.ts)
15. File existence check: task declares `creates: ['src/auth.ts']` → file exists → verify passes
16. File existence check: task declares `creates: ['src/auth.ts']` → file missing → verify fails with `missingFiles`
17. `creates/needs` dependency detection: task A `creates: ['src/shared/utils.ts']`, task B `needs: ['src/shared/utils.ts']` → verify dependency detected
18. Mixed dependency types: scope overlap AND creates/needs → verify both detected
19. Validation between waves: configure `pre_commit: ['exit 1']` → verify inter-wave validation catches failure
20. Graceful handling: task has no summary after completion → verify `missingSummaries` reported but doesn't crash

## Definition of Done

- [ ] 20+ test cases implemented and passing
- [ ] Context freshness tested across wave transitions with real filesystem
- [ ] Research pipeline tested from findings creation to context loading
- [ ] Inter-wave verification tested for file existence, validation, and summary checks
- [ ] Each test uses `createTempProject()` from E2E helpers
- [ ] `pnpm test` — all existing tests continue to pass

## Notes

- Part of PLAN-v120-phase2-moat-deepening.md
- Depends on tasks 120-127 being implemented first
- Uses E2E test infrastructure from task 090
