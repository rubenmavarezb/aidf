# TASK: Publicar a npm

## Goal
Preparar y publicar el paquete @aidf/cli a npm.

## Scope

### Allowed
- package.json
- packages/cli/package.json
- packages/cli/README.md
- README.md

### Forbidden
- src/**
- .env*

## Requirements
1. Verificar que package.json tiene la configuración correcta para npm
2. Agregar campos: repository, bugs, homepage, keywords
3. Crear README específico para npm en packages/cli/
4. Configurar files/exports correctamente
5. Agregar prepublishOnly script
6. Publicar versión 0.1.0

## Definition of Done
- [ ] `npm publish --dry-run` exitoso
- [ ] README en packages/cli/ con instrucciones de uso
- [ ] Package publicado en npmjs.com
- [ ] `npx @aidf/cli --version` funciona

## Status: 🔵 Ready
