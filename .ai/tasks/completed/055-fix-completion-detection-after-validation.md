# TASK: Fix detección de completion signal bloqueada por validation failure

## Goal
Cuando el AI emite `<TASK_COMPLETE>` pero la validation (pnpm typecheck/lint/test) falla, el executor ignora la completion signal y hace `continue`. En la siguiente iteración, el AI no sabe que validation falló y no re-emite `<TASK_COMPLETE>`, resultando en un falso BLOCKED por max iterations.

## Task Type
bugfix

## Suggested Roles
- developer

## Auto-Mode Compatible
✅ **SÍ** - Bug determinístico en el loop del executor.

## Scope

### Allowed
- `packages/cli/src/core/executor.ts`
- `packages/cli/src/core/executor.test.ts`
- `packages/cli/src/core/providers/claude-cli.ts`
- `packages/cli/src/core/providers/claude-cli.test.ts`
- `packages/cli/src/types/index.ts`

### Forbidden
- `templates/**`
- `docs/**`
- `packages/cli/src/commands/**`

## Requirements

### 1. Root Cause

En `executor.ts`, el loop principal tiene este flujo:

```
provider.execute() → scope check → validation → commit → check completion
```

Si validation falla (línea 270-274), hace `continue` y NUNCA llega al check de `result.iterationComplete` (línea 291). La completion signal se pierde.

Además, `buildIterationPrompt()` no incluye el resultado de la validación anterior, así que el AI no sabe qué falló.

### 2. Fix: Chequear completion signal antes de validation

Mover la detección de completion signal ANTES de validation. Si el AI emite `<TASK_COMPLETE>`:

**Opción A (recomendada):** Detectar completion signal inmediatamente después de scope check. Si hay signal + validation pasa → completar. Si hay signal + validation falla → loggear warning, pasar la validation failure al siguiente prompt como contexto.

```typescript
// Después de scope check, antes de validation:
const hasCompletionSignal = result.iterationComplete;

// Correr validation normalmente
const validation = await validator.preCommit();

if (!validation.passed) {
  if (hasCompletionSignal) {
    // El AI cree que terminó pero validation falló
    this.log(`AI signaled completion but validation failed. Retrying with feedback.`);
    this.state.lastValidationError = Validator.formatReport(validation);
  }
  consecutiveFailures++;
  continue;
}

// Si validation pasa Y hay completion signal → completar
if (hasCompletionSignal) {
  this.state.status = 'completed';
  break;
}
```

**Opción B:** Chequear completion signal en AMBOS lugares — antes y después de validation.

### 3. Incluir validation failure en el prompt de la siguiente iteración

Modificar `buildIterationPrompt()` para aceptar un parámetro opcional `previousValidationError`:

```typescript
interface PromptContext {
  // ... existing fields
  previousValidationError?: string;
}
```

En el prompt:
```
## Previous Iteration Feedback

⚠ Your previous iteration signaled <TASK_COMPLETE> but validation failed:
${previousValidationError}

Please fix the validation errors and signal <TASK_COMPLETE> again when done.
```

### 4. Pasar el error de validación al buildIterationPrompt

En el executor loop, guardar el error de validación:

```typescript
let lastValidationError: string | undefined;

// En el loop:
const prompt = buildIterationPrompt({
  // ... existing fields
  previousValidationError: lastValidationError,
});

// Después de validation:
if (!validation.passed) {
  lastValidationError = Validator.formatReport(validation);
  continue;
}
lastValidationError = undefined; // Reset on success
```

### 5. Tests

- Test: Completion signal detectada cuando validation pasa → status completed
- Test: Completion signal + validation failure → NO marca completed, guarda error, continúa
- Test: Siguiente iteración incluye validation error en el prompt
- Test: AI re-emite `<TASK_COMPLETE>` después de fix → completa normalmente
- Test: Sin completion signal + validation failure → comportamiento existente (continue)

## Definition of Done
- [ ] Completion signal se chequea independientemente de validation
- [ ] Validation failure se comunica al AI en la siguiente iteración
- [ ] Tests cubren los 4 escenarios (signal+pass, signal+fail, no-signal+pass, no-signal+fail)
- [ ] No regression: tasks sin completion signal funcionan igual
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` pasan

## Notes
- El bug se reproduce cuando hay un error pre-existente (como `status.ts:299` typecheck error) que hace fallar validation siempre
- Este fix es CRÍTICO — sin él, muchas tasks se marcan BLOCKED falsamente
- La validation failure feedback es importante: sin ella, el AI repite el mismo trabajo sin saber qué falló
- Considerar que el error pre-existente de `status.ts:299` podría resolverse como task separada para evitar false failures
