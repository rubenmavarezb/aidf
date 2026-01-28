# TASK: Comando aidf status

## Goal
Implementar comando `aidf status` para ver dashboard del estado actual.

## Scope

### Allowed
- packages/cli/src/commands/**
- packages/cli/src/index.ts

### Forbidden
- .env*

## Requirements
1. Mostrar tasks pendientes, en progreso, completados, bloqueados
2. Mostrar última ejecución (fecha, duración, resultado)
3. Mostrar archivos modificados recientemente
4. Mostrar provider configurado
5. Formato tabla con colores
6. Opción --json para output estructurado

## Definition of Done
- [ ] `aidf status` muestra dashboard
- [ ] `aidf status --json` retorna JSON válido
- [ ] Tests para el comando
- [ ] Documentación actualizada

## Status: 🔵 Ready
