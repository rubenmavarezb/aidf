# TASK: GitHub Action para AIDF

## Goal
Crear GitHub Action reutilizable para ejecutar AIDF en CI/CD.

## Scope

### Allowed
- .github/actions/aidf/**
- action.yml

### Forbidden
- packages/cli/src/**

## Requirements
1. Action que ejecuta tasks automáticamente
2. Input: task path, provider, max iterations
3. Output: status, files changed, PR URL
4. Soporte para secrets (API keys)
5. Auto-crear PR con cambios
6. Comentar en issues con resultado
7. Ejemplo de workflow

## Definition of Done
- [ ] action.yml válido
- [ ] Ejemplo en .github/workflows/
- [ ] Documentación de inputs/outputs
- [ ] Publicar en GitHub Marketplace

## Status: 🔵 Ready
