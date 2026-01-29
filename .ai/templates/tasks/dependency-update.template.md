# TASK

## Goal

<Update [dependency name] from [current version] to [new version]. What will be updated when this task is complete?>

## Pre-Flight Checklist

Before starting, verify:
- [ ] I have read AGENTS.md completely
- [ ] I understand the existing patterns
- [ ] I know the quality check commands
- [ ] I understand the scope boundaries

## Task Type

architecture

## Suggested Roles

- developer
- architect

## Scope

### Allowed

- <package.json>
- <package-lock.json | yarn.lock | pnpm-lock.yaml>
- <src/path/to/files/using/dependency>
- <tests/path/to/affected/tests>
- <configuration files if needed>

### Forbidden

- <Unrelated code>
- <Other dependencies unless necessary>

## Requirements

### Dependency Details

**Package:** <package-name>
**Current Version:** <current-version>
**Target Version:** <new-version>
**Update Type:** <patch | minor | major>

### Reason for Update

<Why is this update needed?>

- <Reason 1: e.g., Security fix>
- <Reason 2: e.g., New features needed>
- <Reason 3: e.g., Bug fixes>

### Breaking Changes

<If major version update, list breaking changes:>

- <Breaking change 1>
- <Breaking change 2>
- <Breaking change 3>

### Migration Steps

<How to migrate to the new version:>

1. <Step 1: e.g., Update package.json>
2. <Step 2: e.g., Run install command>
3. <Step 3: e.g., Update imports/usage>
4. <Step 4: e.g., Fix breaking changes>
5. <Step 5: e.g., Update tests>

### Code Changes Required

<What code needs to be updated?>

- <File 1: e.g., Update import paths>
- <File 2: e.g., Update API usage>
- <File 3: e.g., Update configuration>

### Testing Strategy

<How will you verify the update works?>

- [ ] <Test 1: e.g., Run existing test suite>
- [ ] <Test 2: e.g., Test affected features manually>
- [ ] <Test 3: e.g., Check for deprecation warnings>
- [ ] <Test 4: e.g., Verify no runtime errors>

### Rollback Plan

<How to rollback if issues occur?>

1. <Step 1>
2. <Step 2>
3. <Step 3>

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
1. Update package files (package.json, lock files)
2. Install new version
3. Review breaking changes documentation
4. Update code to address breaking changes
5. Update tests for API changes
6. Verify no deprecation warnings

### Step 4: Verify
1. Run: `[lint_command]`
2. Run: `[typecheck_command]`
3. Run: `[test_command]`
4. ALL must pass before proceeding

## Definition of Done

- [ ] Dependency version updated in package files
- [ ] All breaking changes addressed
- [ ] Code updated to use new API
- [ ] All tests pass
- [ ] No deprecation warnings
- [ ] Application runs without errors
- [ ] Lint passes
- [ ] Typecheck passes (if applicable)
- [ ] Documentation updated if API changed
- [ ] Changes reviewed

## Notes

- <Changelog or release notes URL>
- <Known issues with new version>
- <Dependencies that also need updating>
- <Areas of code most affected>
- <Performance considerations>
