# TASK: Reportar uso de tokens y context al usuario

## Goal
Mostrar al usuario cuánto context se cargó (en caracteres/tokens estimados) y cuántos tokens consumió cada iteración y el total de la ejecución. El context es dinero — el usuario necesita visibilidad.

## Status: ❌ FAILED

### Execution Log
- **Started:** 2026-01-29T23:31:42.576Z
- **Failed at:** 2026-01-29T23:32:53.662Z
- **Iterations:** 1

### Error
```
error: pathspec 'docs/architecture.md' did not match any file(s) known to git

```

### Files Modified
_None_

## Task Type
component

## Suggested Roles
- developer

## Auto-Mode Compatible
✅ **SÍ** - Lógica de conteo y display.

## Scope

### Allowed
- `packages/cli/src/core/executor.ts`
- `packages/cli/src/core/executor.test.ts`
- `packages/cli/src/core/context-loader.ts`
- `packages/cli/src/core/providers/claude-cli.ts`
- `packages/cli/src/core/providers/types.ts`
- `packages/cli/src/types/index.ts`
- `packages/cli/src/utils/logger.ts`

### Forbidden
- `templates/**`
- `docs/**`

## Requirements

### 1. Estimar tamaño del context cargado

En `context-loader.ts` o en el executor después de `loadContext()`, calcular:
- Tamaño total del prompt en caracteres
- Estimación de tokens (chars / 4 como aproximación, o usar tokenizer si disponible)
- Desglose: AGENTS.md, role, task, plan, skills (cada uno cuánto aporta)

Loggear al usuario después de cargar context:

```
i Context loaded: ~12,450 tokens
  AGENTS.md:  4,200 tokens (34%)
  Role:       1,100 tokens (9%)
  Skills:     3,800 tokens (30%)
  Task:         950 tokens (8%)
  Plan:       2,400 tokens (19%)
```

### 2. Reportar tokens por iteración

Para API providers (anthropic-api, openai-api) que ya retornan token usage en `ExecutionResult`:
- Mostrar input/output tokens por iteración
- Mostrar costo estimado (basado en pricing del modelo)

Para CLI providers (claude-cli, cursor-cli):
- Mostrar longitud del prompt enviado (caracteres → tokens estimados)
- Notar que el token tracking exacto no está disponible para CLI providers

### 3. Resumen final de ejecución

Al terminar el task, mostrar un resumen:

```
┌─────────────────────────────────────┐
│ Task Completed                      │
├─────────────────────────────────────┤
│ Task: 001-graphql-schema.md         │
│ Iterations: 3                       │
│ Files: 18                           │
│ Context: ~12,450 tokens             │
│ Total tokens: ~45,200               │
│   Input:  ~38,000                   │
│   Output: ~7,200                    │
│ Est. cost: ~$0.15                   │
└─────────────────────────────────────┘
```

### 4. Extender ExecutorResult

En `types/index.ts`, agregar campos al `ExecutorResult`:

```typescript
export interface TokenUsage {
  contextTokens: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  estimatedCost?: number;
  breakdown?: {
    agents: number;
    role: number;
    task: number;
    plan: number;
    skills: number;
  };
}
```

Agregar `tokenUsage?: TokenUsage` a `ExecutorResult`.

## Definition of Done
- [ ] Context size estimado y mostrado al usuario después de loadContext
- [ ] Desglose por capa (AGENTS, role, skills, task, plan)
- [ ] Token usage por iteración para API providers
- [ ] Resumen final con tokens totales y costo estimado
- [ ] `TokenUsage` interface en types
- [ ] Tests cubren estimación y reporting
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` pasan

## Notes
- Estimación simple: 1 token ≈ 4 caracteres para inglés/español
- Para API providers, usar los valores reales de `usage` que retorna la API
- Para CLI providers, solo estimaciones basadas en longitud del prompt
- Pricing reference (Claude Sonnet): ~$3/MTok input, ~$15/MTok output
- No bloquear ejecución si el cálculo falla — es informativo
