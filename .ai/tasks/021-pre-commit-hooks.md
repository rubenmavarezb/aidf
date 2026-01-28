# TASK: Pre-commit hooks integration

## Goal
Integrar AIDF con pre-commit hooks para validación automática.

## Scope

### Allowed
- packages/cli/src/commands/**
- templates/**
- docs/**

### Forbidden
- .env*

## Requirements
1. Comando `aidf hooks install`
2. Hook pre-commit: validar scope de cambios
3. Hook commit-msg: validar formato
4. Hook pre-push: ejecutar validaciones
5. Integración con husky
6. Integración con pre-commit (Python)

## Definition of Done
- [ ] `aidf hooks install` configura hooks
- [ ] Hooks validan cambios contra scope
- [ ] Documentación de setup
- [ ] Ejemplo con husky

## Status: 🔵 Ready
