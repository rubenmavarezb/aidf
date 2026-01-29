# TASK: Fix live status y feedback al usuario durante ejecución

## Goal
Corregir el sistema de live status que no está dando feedback visual al usuario durante la ejecución. El usuario no ve progreso mientras el AI trabaja — la terminal se queda en silencio.


## Status: BLOCKED

### Execution Log
- **Started:** 2026-01-29T21:22:30.259Z
- **Iterations:** 3
- **Blocked at:** 2026-01-29T21:37:30.336Z

### Blocking Issue
```
Max iterations (3) reached
```

### Files Modified
_None_

---
@developer: Review and provide guidance, then run `aidf run --resume /Users/ruben/Documentos/aidf/.ai/tasks/052-fix-live-status-feedback.md`

## Task Type
bugfix

## Suggested Roles
- developer

## Auto-Mode Compatible
✅ **SÍ** - Debug y fix de lógica existente.

## Scope

### Allowed
- `packages/cli/src/utils/live-status.ts`
- `packages/cli/src/utils/live-status.test.ts`
- `packages/cli/src/core/executor.ts`
- `packages/cli/src/core/executor.test.ts`
- `packages/cli/src/core/providers/claude-cli.ts`
- `packages/cli/src/core/providers/claude-cli.test.ts`
- `packages/cli/src/core/providers/cursor-cli.ts`
- `packages/cli/src/utils/progress-bar.ts`

### Forbidden
- `templates/**`
- `docs/**`

## Requirements

### 1. Diagnosticar por qué no hay feedback

Investigar el flujo completo de live status:
- `executor.ts` crea el status y llama `onPhase` callbacks
- `live-status.ts` renderiza spinner + timer + fase actual
- Los providers emiten output vía `onOutput` callback

Posibles causas:
- El spinner no se está inicializando correctamente
- El `onPhase` callback no se está pasando al executor
- El heartbeat/timer no está tickeando
- El output del provider está sobrescribiendo el status line
- El provider no está emitiendo eventos de progreso

### 2. Asegurar feedback mínimo visible

El usuario DEBE ver al menos:
- `⠋ Executing AI — Iteration 1/3 — 0 files — 0:00` (spinner animado con timer)
- Actualización cuando cambia la fase (Executing → Checking scope → Validating → Committing)
- Actualización cuando se detectan archivos modificados

### 3. Verificar integración con CLI providers

Para `claude-cli` y `cursor-cli`:
- El subprocess stdout debe fluir al terminal (o al menos indicar que está trabajando)
- Si `--print` mode no produce output parcial, el spinner debe ser el feedback
- Verificar que `onOutput` callback funciona con el subprocess

### 4. Agregar fallback de heartbeat

Si el spinner no puede funcionar (e.g., no-TTY, pipe mode), al menos loggear:
- `i Iteration 1 started...`
- `i Iteration 1 completed (45s, 5 files modified)`

## Definition of Done
- [ ] El usuario ve feedback visual durante toda la ejecución
- [ ] Spinner animado con timer funciona en terminal interactiva
- [ ] Fases se actualizan correctamente (Executing → Checking → Validating → Committing)
- [ ] Fallback de texto para entornos no-TTY
- [ ] Tests verifican que los callbacks se invocan correctamente
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` pasan

## Notes
- El live status usa `process.stderr` para no interferir con stdout del provider
- El heartbeat approach fue implementado en commit `1b5cf3b` — revisar si funciona
- En la foto del usuario se ve que SÍ hay output de log (`i Executing task`, `i Loaded context`) pero NO hay spinner/timer entre iteraciones
- Puede ser que el live status se limpia al inicio de cada iteración y no se re-renderiza
