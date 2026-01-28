# TASK: Resume de tasks bloqueados

## Goal
Implementar funcionalidad completa de --resume para tasks bloqueados.

## Scope

### Allowed
- packages/cli/src/commands/run.ts
- packages/cli/src/core/executor.ts
- packages/cli/src/core/context-loader.ts

### Forbidden
- .env*

## Requirements
1. Detectar estado BLOCKED en task file
2. Cargar contexto previo (archivos modificados, iteración)
3. Incluir blocking issue en el prompt
4. Limpiar estado BLOCKED al completar
5. Historial de intentos en el task file

## Definition of Done
- [ ] `aidf run --resume task.md` funciona
- [ ] Resume desde el estado guardado
- [ ] Tests para resume functionality
- [ ] Documentación actualizada

## Status: 🔵 Ready
