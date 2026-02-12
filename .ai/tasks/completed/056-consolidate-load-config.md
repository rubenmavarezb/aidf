# TASK: Consolidate duplicated loadConfig into a single shared function

## Goal

Extract the 3 duplicate `loadConfig()` implementations (executor.ts, status.ts, watcher.ts) into a single shared function in `utils/config.ts` that all consumers import.

## Task Type

refactor

## Suggested Roles

- developer

## Auto-Mode Compatible

YES - Mechanical refactor, no design decisions.

## Scope

### Allowed

- `packages/cli/src/utils/config.ts`
- `packages/cli/src/utils/config.test.ts`
- `packages/cli/src/core/executor.ts`
- `packages/cli/src/commands/status.ts`
- `packages/cli/src/core/watcher.ts`

### Forbidden

- `templates/**`
- `docs/**`
- `packages/cli/src/commands/init.ts`

## Requirements

1. Create a single `loadConfigFromFile(configPath: string): Promise<AidfConfig>` in `utils/config.ts`
   - Reads YAML or JSON based on file extension
   - Applies `normalizeConfig()` before returning
   - Handles errors gracefully

2. Create `findAndLoadConfig(basePath?: string): Promise<AidfConfig>` in `utils/config.ts`
   - Searches for `config.yml`, `config.yaml`, `config.json` in `.ai/` directory
   - Falls back to `getDefaultConfig()` if no file found
   - Used by executor.ts and status.ts

3. Move `getDefaultConfig()` from executor.ts to `utils/config.ts` (export it)

4. Update all 3 consumers to use the shared functions:
   - `executor.ts`: replace `loadConfig()`, `findConfigFile()`, `getDefaultConfig()`
   - `status.ts`: replace `loadConfig()`
   - `watcher.ts`: replace `loadConfig()` method body

5. Delete the old local implementations

## Definition of Done

- [ ] Only one `loadConfig` implementation exists (in `utils/config.ts`)
- [ ] executor.ts, status.ts, watcher.ts all import from `utils/config.ts`
- [ ] No local `loadConfig` functions remain in consumer files
- [ ] `getDefaultConfig()` is exported from `utils/config.ts`
- [ ] `pnpm test` — all tests pass
- [ ] `pnpm lint` — no new errors
- [ ] `pnpm build` — succeeds

## Notes

- The 3 implementations are nearly identical — all parse YAML/JSON and return `AidfConfig`
- `normalizeConfig()` is already in `utils/config.ts`, so this is a natural home
- watcher.ts uses `this.config = ...` pattern, so it will call the function and assign
