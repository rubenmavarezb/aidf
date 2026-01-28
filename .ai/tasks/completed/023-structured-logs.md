# TASK: Logs estructurados (JSON)

## Goal
Implementar logging estructurado para integración con herramientas externas.

## Scope

### Allowed
- packages/cli/src/utils/logger.ts
- packages/cli/src/core/**
- packages/cli/src/commands/**

### Forbidden
- .env*

## Requirements
1. Opción --log-format json|text
2. Cada evento como objeto JSON con timestamp
3. Niveles: debug, info, warn, error
4. Contexto estructurado (task, iteration, files)
5. Output a archivo con --log-file
6. Rotación de logs opcional

## Definition of Done
- [ ] `--log-format json` produce JSON válido
- [ ] `--log-file` escribe a archivo
- [ ] Logs parseables por jq
- [ ] Tests para structured logging

## Status: 🔵 Ready
