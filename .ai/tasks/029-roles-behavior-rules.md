# TASK: 029 - Mejorar Roles con Behavior Rules

## Goal

Reestructurar los archivos de roles para incluir secciones de "Behavior Rules" con listas explícitas de ALWAYS/NEVER, y mejorar el formato de respuesta esperado.

## Task Type

refactor

## Suggested Roles

- architect
- documenter

## Scope

### Allowed

- `templates/.ai/roles/architect.md`
- `templates/.ai/roles/developer.md`
- `templates/.ai/roles/tester.md`
- `templates/.ai/roles/reviewer.md`
- `templates/.ai/roles/documenter.md`

### Forbidden

- `templates/.ai/AGENTS.template.md`
- `templates/.ai/templates/*`
- `examples/*`

## Requirements

### Nueva Sección: Behavior Rules

Reemplazar/mejorar "Constraints" con formato más enfático:

```markdown
## Behavior Rules

### ALWAYS

- **ALWAYS** read existing code before writing new code
- **ALWAYS** match existing patterns exactly
- **ALWAYS** run quality checks before marking complete
- **ALWAYS** write tests for new functionality

### NEVER

- **NEVER** add dependencies without approval
- **NEVER** skip tests
- **NEVER** ignore lint/type errors
- **NEVER** modify files outside task scope

CRITICAL: Violating NEVER rules invalidates all work done.
```

### Nueva Sección: Response Format

Definir estructura esperada de respuestas:

```markdown
## Response Format

When responding to tasks, structure your response as:

### For Implementation Tasks

<implementation_plan>
1. Files to modify: [list]
2. Pattern to follow: [reference existing file]
3. Tests to write: [list]
</implementation_plan>

[Implementation code]

<completion_check>
- Lint: [PASS/FAIL]
- Types: [PASS/FAIL]
- Tests: [PASS/FAIL - X/X]
</completion_check>
```

### Mejoras por Rol

**Developer:**
- Response Format para implementación
- Checklist de verificación de patrones

**Architect:**
- Response Format para diseño
- Template de trade-off analysis

**Tester:**
- Response Format para test plans
- Categorías de tests requeridos

**Reviewer:**
- Response Format para code review
- Checklist de revisión

**Documenter:**
- Response Format para documentación
- Estructura de documentos

### Sección Identity Mejorada

```markdown
## Identity

You are a [role]. You [primary function].

IMPORTANT: You [key constraint]. You do NOT [anti-pattern].
```

## Definition of Done

- [ ] Todos los roles tienen sección "Behavior Rules" con ALWAYS/NEVER
- [ ] Todos los roles tienen sección "Response Format" estructurada
- [ ] Cada rol tiene mínimo 4 ALWAYS y 4 NEVER rules
- [ ] Identity section usa formato con IMPORTANT
- [ ] Constraints section está integrada en Behavior Rules
- [ ] Cada Response Format incluye bloques XML relevantes
- [ ] CRITICAL aparece para reglas que invalidan trabajo

## Notes

- Inspirado en estructura de Claude Code system prompt
- Mantener especificidad por rol (no reglas genéricas)
- Las reglas deben ser verificables, no subjetivas
