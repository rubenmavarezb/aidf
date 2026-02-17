# TASK: Integration tests for ScopeGuard implicit forbidden files

## Goal

Write tests verifying that ScopeGuard correctly blocks writes to implicit forbidden files (`.env`, `.pem`, `.key`, `credentials.json`, etc.) across all scope enforcement modes, including the exception for `.example`/`.sample`/`.template` suffixes and the `allowImplicitForbidden` opt-in.

## Task Type

test

## Suggested Roles

- tester

## Auto-Mode Compatible

YES

## Scope

### Allowed

- `packages/cli/src/core/safety.test.ts` (extend)

### Forbidden

- `packages/cli/src/core/safety.ts` (read-only)

## Requirements

1. Test `.env` is blocked in strict mode even when not in `scope.forbidden`.

2. Test `.env.local` is blocked.

3. Test `*.pem`, `*.key` files are blocked.

4. Test `credentials.json` is blocked.

5. Test `id_rsa`, `id_ed25519` are blocked.

6. Test `.env.example` is NOT blocked (exception for example/sample/template files).

7. Test `.env.sample` and `.env.template` are NOT blocked.

8. Test `allowImplicitForbidden` opt-in allows writing to specific secret files.

9. Test `permissive` mode logs warning but allows writes to implicit forbidden files.

10. Test `ask` mode prompts user for implicit forbidden files.

11. Test that all patterns in `IMPLICIT_FORBIDDEN_FILES` are exercised (at least a representative subset).

## Definition of Done

- [ ] `.env` blocked in strict mode
- [ ] `.env.local` blocked
- [ ] `*.pem`, `*.key` blocked
- [ ] `credentials.json` blocked
- [ ] `id_rsa`, `id_ed25519` blocked
- [ ] `.env.example` NOT blocked
- [ ] `.env.sample`, `.env.template` NOT blocked
- [ ] `allowImplicitForbidden` opt-in tested
- [ ] `permissive` mode warning tested
- [ ] `ask` mode prompt tested
- [ ] All existing safety tests still pass
- [ ] `pnpm test` passes

## Notes

- Part of PLAN-v080-secrets-hardening.md
- Depends on TASK-141 (ScopeGuard implicit forbidden implementation)
