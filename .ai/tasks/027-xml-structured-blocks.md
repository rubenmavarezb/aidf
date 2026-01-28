# TASK: 027 - Agregar Bloques XML Estructurados a Templates

## Goal

Introducir bloques XML/tags estructurados (`<task_analysis>`, `<completion_check>`, etc.) en los templates para guiar el proceso de pensamiento de la IA de forma consistente.

## Task Type

refactor

## Suggested Roles

- architect
- documenter

## Scope

### Allowed

- `templates/.ai/AGENTS.template.md`
- `templates/.ai/templates/task.template.md`
- `templates/.ai/templates/TASK.template.md`
- `templates/.ai/roles/*.md`

### Forbidden

- `examples/*`
- `docs/*`

## Requirements

### Bloques a Introducir

1. **`<task_analysis>`** - Análisis obligatorio antes de implementar
2. **`<completion_check>`** - Verificación antes de marcar completo
3. **`<implementation_plan>`** - Plan de implementación estructurado
4. **`<pr_analysis>`** - Análisis de pull requests (para reviewer)
5. **`<design_rationale>`** - Justificación de decisiones (para architect)

### Formato de Cada Bloque

```markdown
## Required Analysis Format

Before implementing, wrap your analysis in:

<task_analysis>
- What files need to change?
- What patterns exist in those files?
- What tests need to be written?
- What could go wrong?
</task_analysis>
```

### Dónde Agregar Cada Bloque

| Bloque | Archivo | Sección |
|--------|---------|---------|
| `<task_analysis>` | task.template.md | Antes de Requirements |
| `<completion_check>` | task.template.md | Después de Definition of Done |
| `<implementation_plan>` | roles/developer.md | Response Format |
| `<pr_analysis>` | roles/reviewer.md | Response Format |
| `<design_rationale>` | roles/architect.md | Response Format |

### Instrucciones de Uso

Cada bloque debe incluir:
1. Cuándo usarlo (trigger)
2. Qué debe contener (campos requeridos)
3. Ejemplo de uso correcto

## Definition of Done

- [ ] `<task_analysis>` definido en task.template.md
- [ ] `<completion_check>` definido en task.template.md con checklist
- [ ] `<implementation_plan>` agregado a developer.md
- [ ] `<pr_analysis>` agregado a reviewer.md
- [ ] `<design_rationale>` agregado a architect.md
- [ ] Cada bloque tiene instrucciones de cuándo y cómo usarlo
- [ ] Cada bloque tiene ejemplo de uso correcto
- [ ] AGENTS.template.md referencia los bloques disponibles

## Notes

- Inspirado en `<commit_analysis>` y `<pr_analysis>` de Claude Code
- Los bloques estructuran el pensamiento sin restringir creatividad
- Facilitan la revisión del proceso de la IA
