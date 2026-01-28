# TASK: 025 - Mejorar AGENTS.template.md con Estructura de Producción

## Goal

Refactorizar AGENTS.template.md para usar patrones probados de system prompts de producción (Claude Code, GPT-4o), incluyendo instrucciones enfatizadas, bloques estructurados y repetición de reglas críticas.

## Task Type

refactor

## Suggested Roles

- architect
- documenter

## Scope

### Allowed

- `templates/.ai/AGENTS.template.md`

### Forbidden

- `templates/.ai/roles/*`
- `templates/.ai/templates/*`
- `examples/*`

## Requirements

### Cambios Estructurales

1. **Agregar sección Identity** al inicio que defina el contexto del proyecto
2. **Agregar bloque `<env>`** para variables de entorno y configuración técnica
3. **Restructurar Commands** con columna "When to Run"
4. **Mejorar Conventions** con tablas de patrones correctos/incorrectos
5. **Reforzar Boundaries** con énfasis NEVER/ALWAYS/CRITICAL

### Patrones de Énfasis a Usar

- `IMPORTANT:` para instrucciones que no deben ignorarse
- `CRITICAL:` para instrucciones que invalidan el trabajo si se ignoran
- `NEVER` en mayúsculas para prohibiciones absolutas
- `ALWAYS` en mayúsculas para obligaciones absolutas
- `MUST` para requisitos no negociables

### Secciones Nuevas a Agregar

1. **Quality Gates** - comandos que DEBEN pasar antes de completar cualquier tarea
2. **Pre-Flight Checklist** - verificaciones antes de empezar trabajo

### Ejemplo de Formato Mejorado

```markdown
## Boundaries

### NEVER Do (will reject the work)

- **NEVER** modify files in `src/core/` without explicit approval
- **NEVER** add new dependencies to package.json

CRITICAL: Violating these boundaries invalidates ALL work done.
```

## Definition of Done

- [ ] AGENTS.template.md tiene sección Identity al inicio
- [ ] Existe bloque `<env>` con formato de variables
- [ ] Commands tiene columna "When to Run"
- [ ] Conventions incluye ejemplos correctos/incorrectos con código
- [ ] Boundaries usa formato NEVER/ALWAYS con énfasis
- [ ] Existe sección Quality Gates con comandos obligatorios
- [ ] Palabras IMPORTANT, CRITICAL, NEVER, ALWAYS, MUST aparecen donde corresponde
- [ ] El template sigue siendo genérico (con placeholders) pero más estructurado

## Notes

- Referencia: System prompt de Claude Code v0.2.9
- Referencia: System prompt de GPT-4o
- Mantener compatibilidad con ejemplos existentes en `examples/`

## Status: ✅ COMPLETED

- **Completed:** 2026-01-28
- **Agent:** Claude Code (session 013-improve-readme)
- **PR:** #2
