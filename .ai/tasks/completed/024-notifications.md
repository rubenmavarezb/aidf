# TASK: Sistema de notificaciones

## Goal
Notificar al usuario cuando tasks completan o se bloquean.

## Scope

### Allowed
- packages/cli/src/utils/**
- packages/cli/src/core/executor.ts
- packages/cli/src/commands/**

### Forbidden
- .env*

## Requirements
1. Notificación desktop nativa (macOS/Windows/Linux)
2. Integración Slack webhook
3. Integración Discord webhook
4. Email via SMTP (opcional)
5. Configuración en .ai/config.yml
6. Diferentes niveles (all, errors, blocked)

## Definition of Done
- [ ] Notificación desktop al completar
- [ ] Slack webhook funcional
- [ ] Configuración documentada
- [ ] Tests para notification system

## Status: 🔵 Ready
