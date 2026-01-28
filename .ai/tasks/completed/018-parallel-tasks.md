# TASK: Soporte para tasks en paralelo

## Goal
Permitir ejecutar múltiples tasks simultáneamente.

## Scope

### Allowed
- packages/cli/src/commands/**
- packages/cli/src/core/**

### Forbidden
- .env*

## Requirements
1. `aidf run --parallel task1.md task2.md`
2. Coordinación para evitar conflictos de archivos
3. Output multiplexado con prefijos por task
4. Resumen consolidado al final
5. Límite de concurrencia configurable
6. Detección de dependencias entre tasks

## Definition of Done
- [x] Múltiples tasks corren en paralelo
- [x] Output diferenciado por task
- [x] No hay conflictos de archivos
- [x] Tests para ejecución paralela

## Status: ✅ Completed
