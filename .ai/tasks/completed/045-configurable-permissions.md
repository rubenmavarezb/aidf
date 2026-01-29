# TASK: Hacer configurable dangerouslySkipPermissions

## Goal
Permitir que los usuarios controlen el flag `--dangerously-skip-permissions` de Claude CLI en lugar de estar siempre activo. Actualmente hardcodeado en `true` en `executor.ts`, lo que otorga al AI acceso total sin restricciones al filesystem y comandos del sistema.

## Status: ✅ COMPLETED

### Execution Log
- **Started:** 2026-01-29T16:55:20.825Z
- **Completed:** 2026-01-29T17:03:34.804Z
- **Iterations:** 2
- **Files modified:** 0

### Files Modified
_None_

## Task Type
component

## Suggested Roles
- developer

## Auto-Mode Compatible
✅ **SÍ** - Cambios determinísticos en configuración y lógica del executor.

## Scope

### Allowed
- `packages/cli/src/types/index.ts`
- `packages/cli/src/core/executor.ts`
- `packages/cli/src/core/executor.test.ts`
- `packages/cli/src/core/providers/claude-cli.ts`
- `packages/cli/src/core/providers/claude-cli.test.ts`
- `packages/cli/src/commands/init.ts`

### Forbidden
- `templates/**`
- `docs/**`
- `examples/**`

## Requirements

### 1. Extender `AidfConfig` en `types/index.ts`

Agregar nueva sección de seguridad a la configuración:

```typescript
export interface SecurityConfig {
  /** Whether to skip Claude CLI permission prompts. Default: true for backward compat */
  skip_permissions?: boolean;
  /** Show a warning when skip_permissions is true. Default: true */
  warn_on_skip?: boolean;
}
```

Agregar a `AidfConfig`:
```typescript
security?: SecurityConfig;
```

### 2. Modificar `executor.ts`

- Leer `this.config.security?.skip_permissions` (default: `true` para backward compatibility)
- Si `skip_permissions` es `false`, NO pasar el flag `--dangerously-skip-permissions` a Claude CLI
- Si `warn_on_skip` es `true` (default) y `skip_permissions` es `true`, emitir un warning al inicio de la ejecución

### 3. Modificar `claude-cli.ts`

- El flag `--dangerously-skip-permissions` debe ser condicional basado en la configuración pasada
- Ajustar los args del subprocess según la config

### 4. Actualizar `init.ts`

Agregar sección `security` al config.yml generado por `aidf init`:

```yaml
security:
  skip_permissions: true    # Set to false for safer execution (AI will ask for permission)
  warn_on_skip: true        # Warn when running with skip_permissions: true
```

### 5. Tests

- Test: config con `skip_permissions: false` no incluye el flag
- Test: config con `skip_permissions: true` (o default) incluye el flag
- Test: warning se emite cuando `warn_on_skip: true` y `skip_permissions: true`

## Definition of Done
- [ ] `SecurityConfig` interface definida en types
- [ ] Executor respeta `skip_permissions` config
- [ ] Claude CLI provider condiciona el flag según config
- [ ] `aidf init` genera sección `security` en config.yml
- [ ] Warning visible cuando `skip_permissions: true`
- [ ] Tests unitarios cubren todos los escenarios
- [ ] TypeScript compila sin errores
- [ ] Backward compatible: proyectos sin `security` config funcionan como antes

## Notes
- El default DEBE ser `true` para no romper proyectos existentes
- El warning debe ser claro: "Running with --dangerously-skip-permissions. The AI agent has unrestricted access to your filesystem and commands. Set security.skip_permissions: false in config.yml to require permission prompts."
- Este cambio solo afecta al provider `claude-cli`; los API providers ya tienen su propio sistema de tools controlado
