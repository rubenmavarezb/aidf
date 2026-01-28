# TASK

## Goal

<Refactor [area/component] to [improvement goal]. What will be improved when this task is complete?>

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
