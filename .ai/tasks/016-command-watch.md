# TASK: Comando aidf watch

## Goal
Implementar modo watch para ejecución continua de tasks.

## Scope

### Allowed
- packages/cli/src/commands/**
- packages/cli/src/core/**
- packages/cli/src/index.ts

### Forbidden
- .env*

## Requirements
1. Monitorear cambios en .ai/tasks/
2. Auto-ejecutar tasks nuevos o modificados
3. Modo daemon (background)
4. Notificaciones de completado/bloqueado
5. Hot-reload de config
6. Graceful shutdown con Ctrl+C

## Definition of Done
- [ ] `aidf watch` inicia modo continuo
- [ ] Detecta nuevos tasks automáticamente
- [ ] Se puede detener con Ctrl+C
- [ ] Tests para el watcher

## Status: 🔵 Ready
