# TASK

## Goal

<Refactor [area/component] to [improvement goal]. What will be improved when this task is complete?>

## Pre-Flight Checklist

Before starting, verify:
- [ ] I have read AGENTS.md completely
- [ ] I understand the existing patterns
- [ ] I know the quality check commands
- [ ] I understand the scope boundaries

## Task Type

refactor

## Suggested Roles

- architect
- developer

## Scope

### Allowed

- <src/path/to/refactor/area>
- <specific files to refactor>

### Forbidden

- <paths that must NOT be modified>
- <public APIs (unless explicitly changing them)>
- <unrelated code>

## Requirements

### Current State

<Describe what exists now and what problems it has:>

- <Problem 1>
- <Problem 2>
- <Problem 3>

### Target State

<Describe what should exist after refactoring:>

- <Improvement 1>
- <Improvement 2>
- <Improvement 3>

### Migration Strategy

<How will you get from current to target state?>

1. <Step 1>
2. <Step 2>
3. <Step 3>

### Constraints

- **No API changes** - Public interfaces must remain the same
- **No functionality changes** - Behavior must be identical
- **Backward compatibility** - Existing code using this must continue to work
- **Tests must continue passing** - All existing tests should pass without modification

### Refactoring Patterns

<Which patterns will be applied?>

- <Pattern 1: e.g., Extract function, Split component, etc.>
- <Pattern 2>
- <Pattern 3>

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
1. Ensure tests exist for current behavior
2. Make incremental changes
3. Verify tests still pass after each change
4. Update affected imports
5. Remove dead code

### Step 4: Verify
1. Run: `[lint_command]`
2. Run: `[typecheck_command]`
3. Run: `[test_command]`
4. ALL must pass before proceeding

## Definition of Done

- [ ] Refactoring complete within scope
- [ ] No API changes (same exports, same props/interfaces)
- [ ] All existing tests pass without modification
- [ ] No functionality changes (behavior is identical)
- [ ] Code quality improved (readability, maintainability)
- [ ] Lint passes
- [ ] Typecheck passes
- [ ] No performance regression
- [ ] Documentation updated if structure changed

## Notes

- <Why this refactor is needed>
- <Risks or gotchas to watch for>
- <Related code that might be affected>
- <References to design patterns or principles being applied>
