# TASK: Gestión automática de archivos de tasks (pending/completed/blocked)

## Goal
Cuando un task se completa, mover el archivo `.md` de `tasks/pending/` a `tasks/completed/`. Cuando se bloquea, mover a `tasks/blocked/`. El comando `watch` debe leer desde `tasks/pending/`. Actualmente el status se escribe en el archivo pero el archivo no se mueve entre carpetas.


## Status: BLOCKED

### Execution Log
- **Started:** 2026-01-29T21:37:30.342Z
- **Iterations:** 3
- **Blocked at:** 2026-01-29T22:05:29.154Z

### Blocking Issue
```
Max iterations (3) reached
```

### Files Modified
_None_

---
@developer: Review and provide guidance, then run `aidf run --resume /Users/ruben/Documentos/aidf/.ai/tasks/053-task-file-management.md`

## Task Type
component

## Suggested Roles
- developer

## Auto-Mode Compatible
✅ **SÍ** - Lógica de file management determinística.

## Scope

### Allowed
- `packages/cli/src/core/executor.ts`
- `packages/cli/src/core/executor.test.ts`
- `packages/cli/src/commands/run.ts`
- `packages/cli/src/commands/run.test.ts`
- `packages/cli/src/commands/watch.ts`
- `packages/cli/src/commands/watch.test.ts`
- `packages/cli/src/commands/task.ts`
- `packages/cli/src/commands/task.test.ts`
- `packages/cli/src/types/index.ts`
- `packages/cli/src/utils/files.ts`

### Forbidden
- `templates/**`
- `docs/**`

## Requirements

### 1. Mover task files al completar/bloquear

En el executor, después de escribir el status en el task file:

```typescript
// Después de detectar TASK_COMPLETE:
// 1. Escribir status en el archivo (ya existe)
// 2. Mover archivo de pending/ a completed/
moveTaskFile(taskPath, 'completed');

// Después de detectar TASK_BLOCKED:
// 1. Escribir status en el archivo (ya existe)
// 2. Mover archivo de pending/ a blocked/
moveTaskFile(taskPath, 'blocked');
```

Implementar `moveTaskFile()` en `utils/files.ts`:

```typescript
/**
 * Mueve un task file entre carpetas de estado.
 * Si el archivo no está en una carpeta reconocida (pending/completed/blocked),
 * no hacer nada (backward compatible).
 */
export function moveTaskFile(taskPath: string, targetStatus: 'pending' | 'completed' | 'blocked'): void;
```

Lógica:
- Detectar si el archivo está en `pending/`, `completed/`, o `blocked/`
- Si ya está en la carpeta destino, no hacer nada
- Si está en otra carpeta de status, moverlo
- Si no está en ninguna carpeta de status (e.g., directamente en `tasks/`), no mover (backward compat)
- Crear la carpeta destino si no existe

### 2. Actualizar comando `watch`

El comando `watch` debe observar `tasks/pending/` por defecto:
- Cuando aparece un nuevo archivo `.md` en `pending/`, ejecutarlo
- Ignorar archivos en `completed/` y `blocked/`
- Si se especifica un archivo explícito, ejecutar ese (override)

### 3. Actualizar comando `run`

Cuando se ejecuta `aidf run` sin argumento de task:
- Buscar tasks en `tasks/pending/` primero
- Si `pending/` está vacío, buscar en `tasks/` directamente (backward compat)
- Ejecutar el primer task pendiente (por orden numérico)

### 4. Actualizar comando `task list`

Mostrar tasks agrupados por estado:

```
Pending (3):
  045-configurable-permissions.md
  046-command-allowlist.md
  047-secrets-protection.md

Completed (31):
  001-cli-init.md
  002-context-loader.md
  ...

Blocked (1):
  019-vscode-extension.md
```

### 5. Backward Compatibility

- Si no existen subcarpetas (`pending/`, `completed/`, `blocked/`), leer directamente de `tasks/`
- No romper proyectos que tienen tasks directamente en `tasks/` sin subcarpetas
- El movimiento de archivos es best-effort — si falla, loggear warning pero no fallar

## Definition of Done
- [ ] Tasks completados se mueven a `completed/` automáticamente
- [ ] Tasks bloqueados se mueven a `blocked/` automáticamente
- [ ] `moveTaskFile()` implementada en utils/files.ts
- [ ] Comando `run` sin argumento busca en `pending/` primero
- [ ] Comando `watch` observa `pending/` por defecto
- [ ] Comando `task list` agrupa por estado
- [ ] Backward compatible con tasks sin subcarpetas
- [ ] Tests cubren movimiento, backward compat, carpeta no existente
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` pasan

## Notes
- Las carpetas `pending/`, `completed/`, `blocked/` ya existen en el proyecto AIDF (creadas manualmente)
- `aidf init` debería crear las 3 subcarpetas — verificar en init.ts
- El nombre del archivo no cambia al moverlo — solo la carpeta
- Si el task file está fuera de cualquier subfolder, no intentar moverlo
