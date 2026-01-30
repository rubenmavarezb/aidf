# TASK

## Goal

<Fix [bug description]. What will work correctly when this task is complete?>

## Pre-Flight Checklist

Before starting, verify:
- [ ] I have read AGENTS.md completely
- [ ] I understand the existing patterns
- [ ] I know the quality check commands
- [ ] I understand the scope boundaries

## Task Type

bugfix

## Suggested Roles

- developer
- tester

## Scope

### Allowed

- <src/path/to/affected/files>
- <tests/path/to/test/files>
- <specific files that need modification>

### Forbidden

- <paths that must NOT be modified>
- <unrelated code areas>
- <configuration files unless necessary>

## Requirements

### Bug Description

<What is the current incorrect behavior? Describe the bug clearly.>

### Expected Behavior

<What should happen instead? Describe the correct behavior.>

### Reproduction Steps

1. <Step 1 to reproduce the bug>
2. <Step 2>
3. <Step 3>
4. <Observe the incorrect behavior>

### Root Cause Analysis

<If known, describe why this bug occurs. If unknown, leave for investigation.>

### Solution Approach

<How will you fix this? Describe the approach.>

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
1. Reproduce the bug
2. Identify root cause
3. Write failing test
4. Fix the bug
5. Verify test passes
6. Check for regressions

### Step 4: Verify
1. Run: `[lint_command]`
2. Run: `[typecheck_command]`
3. Run: `[test_command]`
4. ALL must pass before proceeding

## Definition of Done

- [ ] Bug is fixed and verified
- [ ] Reproduction steps no longer produce the bug
- [ ] Expected behavior is now correct
- [ ] Tests added/updated to prevent regression
- [ ] All existing tests still pass
- [ ] Code review completed
- [ ] Lint passes
- [ ] Typecheck passes (if applicable)

## Notes

- <Related issues or PRs>
- <Areas to be careful with>
- <Dependencies or blockers>
- <Additional context about the bug>
