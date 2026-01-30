# TASK: Scope enforcement preventivo para API providers

## Goal
Implementar validación de scope ANTES de ejecutar operaciones de archivos en los API providers, en lugar del enfoque actual que detecta y revierte DESPUÉS. Para CLI providers, mantener el enfoque reactivo existente.

## Status: ✅ COMPLETED

### Execution Log
- **Started:** 2026-01-29T18:11:29.342Z
- **Completed:** 2026-01-29T18:15:47.910Z
- **Iterations:** 1
- **Files modified:** 0

### Files Modified
_None_

## Task Type
component

## Suggested Roles
- developer

## Auto-Mode Compatible
✅ **SÍ** - Lógica determinística de validación de paths.

## Scope

### Allowed
- `packages/cli/src/core/providers/tool-handler.ts`
- `packages/cli/src/core/providers/tool-handler.test.ts`
- `packages/cli/src/core/providers/types.ts`
- `packages/cli/src/core/safety.ts`
- `packages/cli/src/core/safety.test.ts`
- `packages/cli/src/types/index.ts`

### Forbidden
- `templates/**`
- `docs/**`
- `examples/**`

## Requirements

### 1. Extender tool-handler.ts con scope validation

El `ToolHandler` debe recibir el task scope y validar ANTES de ejecutar:

```typescript
class ToolHandler {
  private scope?: TaskScope;
  private scopeMode: ScopeMode;

  constructor(cwd: string, scope?: TaskScope, scopeMode?: ScopeMode) {
    // ...
  }

  private validateScope(filePath: string, operation: 'read' | 'write' | 'delete'): void {
    // Solo validar write/delete operations, read siempre permitido
    // Usar checkFileChange de safety.ts
    // Lanzar error descriptivo si blocked
  }
}
```

### 2. Interceptar en cada tool

- `write_file`: validar path ANTES de escribir
- `run_command`: (ya cubierto por task 046, pero asegurar integración)
- `list_files`: permitir siempre (read-only)
- `read_file`: permitir siempre (read-only)

### 3. Respuesta al AI cuando se bloquea

Cuando una operación se bloquea, retornar un `ToolResult` descriptivo:

```typescript
{
  output: `SCOPE VIOLATION: Cannot write to "${path}". This file is outside the allowed scope for this task.\n\nAllowed paths: ${scope.allowed.join(', ')}\nForbidden paths: ${scope.forbidden.join(', ')}\n\nPlease only modify files within the allowed scope.`,
  isError: true
}
```

Esto permite al AI corregir su comportamiento en la siguiente iteración.

### 4. Pasar scope al ToolHandler

Modificar la creación del `ToolHandler` en los API providers para recibir el scope del task actual:

- `anthropic-api.ts` y `openai-api.ts` deben pasar `TaskScope` al crear el `ToolHandler`
- El scope viene del `ParsedTask` en las `ProviderOptions`

### 5. Tests

- Test: write_file a path permitido funciona
- Test: write_file a path prohibido retorna error
- Test: write_file a path fuera de scope en modo strict retorna error
- Test: read_file siempre funciona (incluso fuera de scope)
- Test: list_files siempre funciona
- Test: error message incluye scope info útil para el AI
- Test: sin scope configurado, todo está permitido (backward compat)

## Definition of Done
- [ ] `ToolHandler` acepta scope y mode en constructor
- [ ] `write_file` valida scope antes de ejecutar
- [ ] Error messages descriptivos para el AI
- [ ] API providers pasan scope al ToolHandler
- [ ] Read operations no se bloquean
- [ ] Tests cubren allowed, forbidden, no-scope scenarios
- [ ] TypeScript compila sin errores
- [ ] Backward compatible: sin scope, todo funciona como antes
- [ ] CLI providers no se ven afectados (mantienen enfoque reactivo)

## Notes
- Este enfoque es COMPLEMENTARIO al ScopeGuard reactivo existente — no lo reemplaza
- Para CLI providers (claude-cli, cursor-cli), el scope se sigue validando post-ejecución con ScopeGuard porque no controlamos las operaciones individuales
- Para API providers, podemos interceptar cada tool call antes de ejecutarla
- El error message debe ser útil para el AI — incluir qué paths SÍ puede modificar
- Read operations no se bloquean porque el AI necesita leer contexto libremente
- `run_command` puede crear archivos indirectamente — la validación de scope para comandos se complementa con la validación de archivos post-ejecución
