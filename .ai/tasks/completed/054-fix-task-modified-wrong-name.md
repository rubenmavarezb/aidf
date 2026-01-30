# TASK: Fix "Task modified" muestra tarea anterior en vez de la actual

## Goal
Cuando el executor avanza a una nueva tarea, el log "Task modified: XXX" muestra el nombre de la tarea ANTERIOR en vez de la tarea actual. Esto confunde al usuario porque parece que sigue trabajando en el task anterior.


## Status: BLOCKED

### Execution Log
- **Started:** 2026-01-29T22:05:29.156Z
- **Iterations:** 3
- **Blocked at:** 2026-01-29T22:35:59.784Z

### Blocking Issue
```
Max iterations (3) reached
```

### Files Modified
_None_

---
@developer: Review and provide guidance, then run `aidf run --resume /Users/ruben/Documentos/aidf/.ai/tasks/054-fix-task-modified-wrong-name.md`

## Task Type
bugfix

## Suggested Roles
- developer

## Auto-Mode Compatible
✅ **SÍ** - Bug determinístico en lógica del executor.

## Scope

### Allowed
- `packages/cli/src/core/executor.ts`
- `packages/cli/src/core/executor.test.ts`

### Forbidden
- `templates/**`
- `docs/**`
- `packages/cli/src/core/providers/**`

## Requirements

### 1. Diagnosticar el bug

En la foto del usuario se ve:
```
i Executing task: 002-node-resolver.md        ← Nueva tarea
i Loaded context for task: Create `node/...`
i Role: developer
i Scope: ...
! Running with --dangerously-skip-permissions...
i
=== Iteration 1 ===
i Task modified: 001-graphql-schema.md        ← ¡Tarea anterior!
```

El problema es probablemente que:
- El executor detecta archivos modificados vía `git status`
- El task file anterior (`001-graphql-schema.md`) fue modificado en la iteración anterior (cuando se escribió el status COMPLETED)
- Al inicio de la nueva tarea, `git status` todavía muestra ese archivo como modificado (no commiteado o recién commiteado)
- El log "Task modified" reporta CUALQUIER archivo .md modificado, no específicamente el task actual

### 2. Implementar el fix

Opciones:

**Opción A (recomendada):** Filtrar el mensaje "Task modified" para solo mostrar el task ACTUAL, no archivos de tasks anteriores.

**Opción B:** Hacer `git add` del task file anterior después de escribir su status, antes de iniciar el siguiente task.

**Opción C:** Cambiar el mensaje para que sea más claro — "Files changed: XXX" en vez de "Task modified: XXX", para que no confunda con el nombre de la tarea en ejecución.

### 3. Verificar el flujo

El fix debe asegurar que:
- Al inicio de una nueva tarea, no se muestran archivos de la tarea anterior
- Si el task ACTUAL se modifica (porque el AI edita el .md), se muestre correctamente
- Los archivos modificados por el AI se reportan como "Files modified" o similar

### 4. Tests

- Test: Al ejecutar task B después de task A, no se muestra "Task modified: A"
- Test: Si el AI modifica el task file actual, se muestra correctamente
- Test: El conteo de files modified no incluye task files anteriores

## Definition of Done
- [ ] "Task modified" ya no muestra el nombre de la tarea anterior
- [ ] El mensaje es claro sobre qué archivos se modificaron
- [ ] Tests verifican el comportamiento correcto
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` pasan

## Notes
- El bug se reproduce cuando se ejecutan múltiples tasks en secuencia (e.g., `aidf run --all` o parallel executor)
- Revisar cómo `executor.ts` detecta archivos modificados — probablemente usa `git status --porcelain`
- El fix no debe cambiar cómo se trackean los archivos modificados por el AI, solo cómo se reportan
- Considerar si hacer `git add` del task file al escribir su status resolvería el problema de forma más limpia
