# TASK: Allowlist de comandos para run_command tool

## Goal
Implementar un sistema de allowlist/blocklist para el tool `run_command` de los API providers, evitando que el AI ejecute comandos destructivos o peligrosos sin restricción.

## Status: ✅ COMPLETED

### Execution Log
- **Started:** 2026-01-29T17:35:00.512Z
- **Completed:** 2026-01-29T17:48:18.146Z
- **Iterations:** 3
- **Files modified:** 0

### Files Modified
_None_

## Task Type
component

## Suggested Roles
- developer

## Auto-Mode Compatible
✅ **SÍ** - Lógica determinística de validación de comandos.

## Scope

### Allowed
- `packages/cli/src/types/index.ts`
- `packages/cli/src/core/providers/tool-handler.ts`
- `packages/cli/src/core/providers/tool-handler.test.ts`
- `packages/cli/src/commands/init.ts`

### Forbidden
- `templates/**`
- `docs/**`
- `examples/**`

## Requirements

### 1. Extender tipos en `types/index.ts`

```typescript
export interface CommandPolicy {
  /** Commands that are always allowed (e.g., ["pnpm test", "pnpm lint"]) */
  allowed?: string[];
  /** Commands or patterns that are always blocked (e.g., ["rm -rf", "sudo"]) */
  blocked?: string[];
  /** Block all commands not in the allowed list. Default: false */
  strict?: boolean;
}
```

Agregar a `SecurityConfig`:
```typescript
export interface SecurityConfig {
  skip_permissions?: boolean;
  warn_on_skip?: boolean;
  /** Command execution policy for API providers */
  commands?: CommandPolicy;
}
```

### 2. Implementar validación en `tool-handler.ts`

- Antes de ejecutar `run_command`, validar el comando contra la policy
- Blocklist por defecto (siempre activa, incluso sin config):
  - `rm -rf /` y variantes destructivas de rm en root
  - `sudo` (salvo configurado explícitamente en allowed)
  - `curl | sh`, `wget | sh` (pipe a shell)
  - `chmod 777`
  - `> /dev/sda` y similares
- Si `strict: true`, solo ejecutar comandos que estén en `allowed`
- Retornar error descriptivo al AI cuando un comando se bloquea

### 3. Actualizar `init.ts`

Agregar ejemplo en config.yml:

```yaml
security:
  commands:
    allowed: ["pnpm test", "pnpm lint", "pnpm typecheck", "pnpm build"]
    blocked: ["rm -rf /", "sudo"]
    strict: false          # Set to true to only allow listed commands
```

### 4. Tests

- Test: comandos en blocklist se rechazan
- Test: blocklist por defecto bloquea comandos peligrosos
- Test: modo `strict` solo permite allowed commands
- Test: modo no-strict permite comandos no listados (excepto blocked)
- Test: comandos permitidos se ejecutan normalmente
- Test: error message incluye razón del bloqueo

## Definition of Done
- [ ] `CommandPolicy` interface definida
- [ ] Validación de comandos implementada en tool-handler
- [ ] Blocklist por defecto activa sin configuración
- [ ] Modo strict funcional
- [ ] `aidf init` incluye sección de commands
- [ ] Tests cubren happy path, blocklist, strict mode
- [ ] TypeScript compila sin errores
- [ ] Backward compatible

## Notes
- La validación de comandos solo aplica a API providers (anthropic-api, openai-api) que usan `tool-handler.ts`
- Los CLI providers (claude-cli, cursor-cli) delegan la ejecución al propio Claude/Cursor, que tienen sus propios mecanismos de seguridad
- La blocklist por defecto debe ser conservadora — bloquear solo lo claramente destructivo
- La validación debe comparar el comando completo y también el ejecutable principal (primer token del comando)
- Considerar que los comandos pueden venir con paths absolutos o relativos
