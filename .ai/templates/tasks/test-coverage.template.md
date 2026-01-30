# TASK

## Goal

<Improve test coverage for [area/component] to [target]% coverage. What will be tested when this task is complete?>

## Pre-Flight Checklist

Before starting, verify:
- [ ] I have read AGENTS.md completely
- [ ] I understand the existing patterns
- [ ] I know the quality check commands
- [ ] I understand the scope boundaries

## Task Type

test

## Suggested Roles

- tester

## Scope

### Allowed

- <tests/path/to/test/files>
- <src/**/*.test.ts>
- <src/**/*.test.tsx>
- <src/**/*.spec.ts>
- <src/**/*.spec.tsx>
- <__tests__/**>

### Forbidden

- <Any non-test files>
- <Production code (unless fixing bugs found during testing)>
- <Configuration files>

## Requirements

### Current Coverage

<Describe current test coverage:>

- <Area 1>: <current coverage>%
- <Area 2>: <current coverage>%
- <Overall>: <current coverage>%

### Target Coverage

<Describe target coverage:>

- <Area 1>: <target coverage>%
- <Area 2>: <target coverage>%
- <Overall>: <target coverage>%

### Areas to Cover

<What specific areas need more tests?>

- [ ] <Area 1: e.g., Edge cases for function X>
- [ ] <Area 2: e.g., Error handling in component Y>
- [ ] <Area 3: e.g., Integration scenarios>
- [ ] <Area 4: e.g., Accessibility features>

### Required Test Cases

<Specific test cases to implement:>

- [ ] <Test case 1: e.g., "Component handles null props gracefully">
- [ ] <Test case 2: e.g., "Function throws error on invalid input">
- [ ] <Test case 3: e.g., "Integration test for user flow X">
- [ ] <Test case 4: e.g., "Accessibility: keyboard navigation works">

### Testing Patterns

<What testing patterns should be followed?>

- <Pattern 1: e.g., Use React Testing Library for components>
- <Pattern 2: e.g., Mock external dependencies>
- <Pattern 3: e.g., Test user interactions, not implementation>

### Test Utilities

<What test utilities or helpers are available?>

- <Utility 1: e.g., renderWithProviders>
- <Utility 2: e.g., createMockData>
- <Reference to test setup files>

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
1. Identify untested code paths
2. Prioritize by risk/importance
3. Write tests for happy path
4. Write tests for edge cases
5. Write tests for error cases
6. Verify coverage increase

### Step 4: Verify
1. Run: `[lint_command]`
2. Run: `[typecheck_command]`
3. Run: `[test_command]`
4. ALL must pass before proceeding

## Definition of Done

- [ ] Coverage meets or exceeds target percentage
- [ ] All new tests pass
- [ ] All existing tests still pass
- [ ] No flaky tests introduced
- [ ] Tests follow project testing patterns
- [ ] Tests are maintainable and readable
- [ ] Edge cases are covered
- [ ] Error cases are covered
- [ ] Test suite runs in acceptable time

## Notes

- <Special testing considerations>
- <Areas that are difficult to test and why>
- <Test data or fixtures needed>
- <References to testing documentation or guides>
