# TASK: Update config loading to throw ConfigError instances

## Goal

Update `packages/cli/src/utils/config.ts` (`resolveConfig`, `findAndLoadConfig`) to throw `ConfigError` instances instead of generic `Error`. Map: missing config file to `ConfigError.missing(path)`, YAML parse failure to `ConfigError.parseError(path, rawError)`, missing env var reference to `ConfigError.missingEnvVar(varName)`, invalid field value to `ConfigError.invalid(field, value, expected)`.

## Task Type

refactor

## Suggested Roles

- developer

## Auto-Mode Compatible

YES

## Scope

### Allowed

- `packages/cli/src/utils/config.ts`

### Forbidden

- `packages/cli/src/core/executor.ts` (read-only)
- `packages/cli/src/core/errors.ts` (read-only)
- `packages/cli/src/commands/` (read-only)

## Requirements

1. Import `ConfigError` from `core/errors.ts` in `config.ts`.

2. Map existing error paths in `resolveConfig` and `findAndLoadConfig`:
   - Missing config file (file not found): Throw `ConfigError.missing(configPath)` instead of generic `Error`
   - YAML parse failure (invalid YAML syntax): Throw `ConfigError.parseError(configPath, rawError)` instead of generic `Error`
   - Missing env var reference (config references `$ENV_VAR` that doesn't exist): Throw `ConfigError.missingEnvVar(varName)` instead of generic `Error`
   - Invalid field value (e.g., unknown provider type, invalid scope mode): Throw `ConfigError.invalid(field, value, expected)` instead of generic `Error`

3. Each `ConfigError` should have:
   - Descriptive `message` explaining what went wrong
   - Correct `code` (`CONFIG_MISSING`, `CONFIG_PARSE_ERROR`, `CONFIG_ENV_VAR_MISSING`, `CONFIG_INVALID`)
   - `retryable: false` (all config errors require human intervention)
   - `context` with relevant info (`configPath`, `field`, `envVar`, etc.)

4. Preserve the error behavior (still throw, not return) — callers that catch generic `Error` will still catch `ConfigError` since it extends `Error`.

## Definition of Done

- [ ] Missing config file throws `ConfigError.missing(path)` with code `CONFIG_MISSING`
- [ ] YAML parse failure throws `ConfigError.parseError(path, rawError)` with code `CONFIG_PARSE_ERROR`
- [ ] Missing env var throws `ConfigError.missingEnvVar(varName)` with code `CONFIG_ENV_VAR_MISSING`
- [ ] Invalid field value throws `ConfigError.invalid(field, value, expected)` with code `CONFIG_INVALID`
- [ ] All `ConfigError` instances have `retryable: false`
- [ ] Existing callers that catch generic `Error` still work (backward compatible)
- [ ] All existing tests pass (`pnpm test`)
- [ ] TypeScript compiles without errors (`pnpm typecheck`)

## Notes

- Part of PLAN-v080-error-categorization.md
- Depends on task 098 (needs `ConfigError` class from `core/errors.ts`)
- Can run in parallel with tasks 107, 108, 110
