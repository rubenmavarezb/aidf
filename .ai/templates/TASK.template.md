# TASK

## Goal

<One clear sentence describing what must be accomplished. What will be true when this task is complete?>

## Pre-Flight Checklist

Before starting, verify:
- [ ] I have read AGENTS.md completely
- [ ] I understand the existing patterns
- [ ] I know the quality check commands
- [ ] I understand the scope boundaries

## Task Type

<Select one: component | refactor | test | docs | architecture | bugfix>

## Suggested Roles

- <primary role>
- <secondary role if needed>

## Scope

### Allowed

- <paths that may be modified>
- <specific files if applicable>

### Forbidden

- <paths that must NOT be modified>
- <sensitive areas to protect>

## Required Analysis

Before implementing, analyze the task:

<task_analysis>
- What files need to change?
- What patterns exist in those files?
- What tests need to be written?
- What could go wrong?
- Are there similar implementations to reference?
</task_analysis>

## Requirements

<Detailed specifications for the task. Include:>

- <Functional requirements>
- <Technical constraints>
- <Expected behavior>
- <API/interface definitions if applicable>

## Execution Steps

FOLLOW THESE STEPS IN ORDER:

### Step 1: Research (do NOT write code yet)
1. Read AGENTS.md completely
2. Read all files in Scope/Allowed
3. Identify existing patterns to follow
4. List all files that will be created/modified

### Step 2: Plan
1. Document changes for each file
2. Identify test cases needed
3. Verify approach follows conventions

### Step 3: Implement
1. Make changes following existing patterns
2. Write tests alongside code
3. Update imports/exports as needed

### Step 4: Verify
1. Run: `[lint_command]`
2. Run: `[typecheck_command]`
3. Run: `[test_command]`
4. ALL must pass before proceeding

## Definition of Done

- [ ] <Verifiable criterion 1>
- [ ] <Verifiable criterion 2>
- [ ] <Quality gate: e.g., "lint passes">
- [ ] <Quality gate: e.g., "tests pass">
- [ ] <Quality gate: e.g., "typecheck passes">

## Completion Verification

CRITICAL: Complete this section before marking the task done.

<completion_check>
### Files Modified
- [ ] path/to/file1.ts
- [ ] path/to/file2.ts

### Quality Gate Results
| Check | Status | Output Summary |
|-------|--------|----------------|
| Lint | PASS/FAIL | [summary] |
| Types | PASS/FAIL | [summary] |
| Tests | PASS/FAIL | [X/X passed] |
| Build | PASS/FAIL | [summary] |

### Final Status
- All quality gates passed: YES/NO
- All DoD items verified: YES/NO
- Ready to mark complete: YES/NO
</completion_check>

## Notes

- <Additional context>
- <Warnings or gotchas>
- <References to related code>
- <Design decisions made>
