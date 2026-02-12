# TASK: Fix pre-existing typecheck error in status.ts

## Goal

Fix the TS2352 error at `status.ts:300` where `ProviderConfig` is cast to `Record<string, unknown>` without going through `unknown` first.

## Task Type

bugfix

## Suggested Roles

- developer

## Auto-Mode Compatible

YES - Single-line type fix.

## Scope

### Allowed

- `packages/cli/src/commands/status.ts`

### Forbidden

- `packages/cli/src/core/**`
- `templates/**`
- `docs/**`

## Requirements

1. Fix the cast at line ~300 in status.ts. The error is:
   ```
   error TS2352: Conversion of type 'ProviderConfig' to type 'Record<string, unknown>'
   may be a mistake because neither type sufficiently overlaps with the other.
   ```

2. The correct fix depends on context — either:
   - Use the `ProviderConfig` type directly instead of casting to `Record<string, unknown>`
   - Or add an intermediate `unknown` cast if a generic record is truly needed

3. Do NOT introduce new `any` types

## Definition of Done

- [ ] `npx tsc --noEmit` in `packages/cli/` reports **zero errors**
- [ ] No new `any` types introduced
- [ ] `pnpm test` — all tests pass

## Notes

- This error has existed since before the session continuation feature
- It's the only typecheck error remaining — fixing it means `pnpm typecheck` becomes a reliable quality gate
