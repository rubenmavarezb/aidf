# TASK

## Goal

<Update [dependency name] from [current version] to [new version]. What will be updated when this task is complete?>

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
