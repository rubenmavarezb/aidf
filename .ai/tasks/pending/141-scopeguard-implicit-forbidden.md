# TASK: Extend ScopeGuard with implicit secret file patterns

## Goal

Add a set of implicit forbidden file patterns to ScopeGuard that are always active regardless of the task's `scope.forbidden` configuration. These represent files that should never be written by an AI agent (`.env`, `.key`, `.pem`, `credentials.json`, etc.).

## Task Type

feature

## Suggested Roles

- developer

## Auto-Mode Compatible

YES

## Scope

### Allowed

- `packages/cli/src/core/safety.ts`
- `packages/cli/src/types/index.ts`

### Forbidden

- `packages/cli/src/core/executor.ts` (read-only)
- `packages/cli/src/commands/` (read-only)

## Requirements

1. Add the following implicit forbidden patterns constant (export for testing):

```typescript
export const IMPLICIT_FORBIDDEN_FILES: string[] = [
  '.env',
  '.env.*',
  '**/.env',
  '**/.env.*',
  '*.pem',
  '*.key',
  '*.p12',
  '*.pfx',
  '*.jks',
  '**/*.pem',
  '**/*.key',
  '**/id_rsa',
  '**/id_ed25519',
  '**/id_ecdsa',
  'credentials.json',
  '**/credentials.json',
  '**/service-account*.json',
  '**/.gcloud/**',
  '**/.aws/credentials',
  '**/.aws/config',
  '**/.ssh/*',
  '**/.npmrc',
  '**/.pypirc',
  '**/.docker/config.json',
  '**/secrets.yml',
  '**/secrets.yaml',
  '**/vault.yml',
  '**/vault.yaml',
  '**/.htpasswd',
  '**/token.json',
];
```

2. In `checkFileChange()`, before checking `scope.forbidden`, check against `IMPLICIT_FORBIDDEN_FILES`.

3. Behavior per scope enforcement mode:
   - `strict`: always block writes to these files.
   - `ask`: prompt user before writing to these files.
   - `permissive`: log a warning but allow (with prominent warning).

4. Add `allowImplicitForbidden?: string[]` field to `TaskScope` in `types/index.ts` so tasks can explicitly opt in to writing specific secret files (e.g., a task that generates `.env.example`).

5. Edge case: `.env.example`, `.env.sample`, `.env.template` files should NOT be blocked. Add exception for files ending in `.example`, `.sample`, `.template`.

6. Export `IMPLICIT_FORBIDDEN_FILES` for use in tests.

## Definition of Done

- [ ] `IMPLICIT_FORBIDDEN_FILES` constant added and exported from `safety.ts`
- [ ] `checkFileChange()` checks against implicit forbidden patterns before task-specific forbidden
- [ ] `strict` mode blocks writes to implicit forbidden files
- [ ] `ask` mode prompts user for implicit forbidden files
- [ ] `permissive` mode logs warning but allows
- [ ] `.example`, `.sample`, `.template` suffixed files are exempted
- [ ] `allowImplicitForbidden` field added to `TaskScope` in `types/index.ts`
- [ ] `allowImplicitForbidden` correctly overrides the implicit block for specified files
- [ ] All existing ScopeGuard tests pass without modification
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes

## Notes

- Part of PLAN-v080-secrets-hardening.md
- Depends on TASK-137 (for the IMPLICIT_FORBIDDEN_FILES concept)
