# TASK: CI/CD con GitHub Actions

## Goal
Configurar GitHub Actions para CI/CD automatizado del proyecto AIDF.

## Scope

### Allowed
- .github/**
- package.json
- packages/cli/package.json

### Forbidden
- src/**
- .env*

## Requirements
1. Crear workflow para tests en cada PR
2. Crear workflow para build en cada push a main
3. Crear workflow para publicar a npm en tags/releases
4. Configurar cache de pnpm para builds más rápidos
5. Agregar badges al README

## Definition of Done
- [ ] `.github/workflows/test.yml` - tests en PRs
- [ ] `.github/workflows/release.yml` - publish a npm
- [ ] Badges de CI en README
- [ ] Workflow probado con un PR

## Status: 🔵 Ready
