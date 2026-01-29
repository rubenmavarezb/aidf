# TASK

## Goal

<Implement [feature name] that [what it does]. What will be available when this task is complete?>

## Pre-Flight Checklist

Before starting, verify:
- [ ] I have read AGENTS.md completely
- [ ] I understand the existing patterns
- [ ] I know the quality check commands
- [ ] I understand the scope boundaries

## Task Type

<component | architecture>

## Suggested Roles

- developer
- architect
- tester

## Scope

### Allowed

- <src/path/to/new/feature>
- <src/components/[FeatureName]>
- <tests/path/to/feature/tests>
- <docs/path/to/feature/docs>

### Forbidden

- <paths that must NOT be modified>
- <existing components unless extending them>
- <core infrastructure unless necessary>

## Requirements

### Feature Overview

<High-level description of what this feature does and why it's needed.>

### Functional Requirements

- <Requirement 1: What the feature must do>
- <Requirement 2>
- <Requirement 3>

### API/Interface Design

<If applicable, describe the public API:>

| Prop/Method | Type | Description |
|-------------|------|-------------|
| <prop1> | `<type>` | <description> |
| <prop2> | `<type>` | <description> |

### User Experience

<How will users interact with this feature? Describe the UX flow.>

### Technical Constraints

- <Constraint 1>
- <Constraint 2>
- <Performance requirements>
- <Accessibility requirements>

### Acceptance Criteria

- [ ] <Criterion 1>
- [ ] <Criterion 2>
- [ ] <Criterion 3>

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
1. Research existing patterns
2. Design component/module structure
3. Implement core functionality
4. Add tests
5. Update documentation
6. Verify quality gates

### Step 4: Verify
1. Run: `[lint_command]`
2. Run: `[typecheck_command]`
3. Run: `[test_command]`
4. ALL must pass before proceeding

## Definition of Done

- [ ] Feature implemented according to requirements
- [ ] All acceptance criteria met
- [ ] Tests written and passing
- [ ] Documentation updated
- [ ] Code review completed
- [ ] Lint passes
- [ ] Typecheck passes
- [ ] Accessibility verified (if UI component)
- [ ] Performance requirements met

## Notes

- <Design references or mockups>
- <Related features or dependencies>
- <Technical decisions made>
- <Future enhancements or considerations>
