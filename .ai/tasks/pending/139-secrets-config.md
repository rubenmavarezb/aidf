# TASK: Add `SecretsConfig` to `AidfConfig` and wire up config loading

## Goal

Wire the `SecretsConfig` type (added in TASK-137) into `AidfConfig` and update the config loading/resolution logic so that secrets configuration is read from `config.yml` and validated.

## Task Type

feature

## Suggested Roles

- developer

## Auto-Mode Compatible

YES

## Scope

### Allowed

- `packages/cli/src/types/index.ts`
- `packages/cli/src/utils/config.ts`

### Forbidden

- `packages/cli/src/core/executor.ts` (read-only)
- `packages/cli/src/commands/` (read-only)

## Requirements

1. Add `secrets?: SecretsConfig` field to the `AidfConfig` interface in `types/index.ts`.

2. Add `secrets?: SecretsConfig` to the `SecurityConfig` interface (keep both top-level and nested for flexibility; top-level takes precedence).

3. Update `resolveConfig()` in `utils/config.ts` to:
   - Resolve env vars in `secrets.patterns` and `secrets.allowed_files`
   - Validate that `secrets.mode` is one of `warn | block | redact`
   - Validate that custom patterns are valid regexes (wrap in try/catch)

4. Default config when `secrets` is not specified: `{ mode: 'warn' }`.

5. Support the following config YAML structure:

```yaml
secrets:
  mode: block                        # warn | block | redact
  entropy_detection: false           # default: false
  entropy_threshold: 4.5             # bits per character
  patterns:                          # additional custom patterns
    - 'CUSTOM_[A-Z0-9]{32}'
  allowed_files:                     # files that may contain secrets
    - 'tests/fixtures/**'
    - '**/*.test.ts'
  allowed_patterns:                  # string patterns to ignore
    - 'sk_test_'                     # Stripe test keys are OK
```

## Definition of Done

- [ ] `secrets?: SecretsConfig` added to `AidfConfig` interface
- [ ] `secrets?: SecretsConfig` added to `SecurityConfig` interface
- [ ] `resolveConfig()` resolves env vars in secrets config fields
- [ ] Validation: `secrets.mode` must be `warn | block | redact`
- [ ] Validation: custom patterns are valid regexes
- [ ] Default config is `{ mode: 'warn' }` when `secrets` is not specified
- [ ] Backward compatible: projects without `secrets:` in config.yml behave identically
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes (existing config tests still pass)

## Notes

- Part of PLAN-v080-secrets-hardening.md
- Depends on TASK-137 (types must be defined first)
- Can run in parallel with TASK-138 (entropy detection)
