# TASK: 026 - Agregar Ejemplos de Interacción a Roles

## Goal

Agregar secciones de "Interaction Examples" a todos los roles, mostrando diálogos concretos de cómo debe comportarse la IA en situaciones típicas (buenos y malos ejemplos).

## Task Type

docs

## Suggested Roles

- documenter
- developer

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

### Nueva Sección: Interaction Examples

Agregar después de "Examples" una sección que muestre:

1. **Diálogos User/Assistant** - Interacciones típicas
2. **GOOD response** - Cómo debe responder
3. **BAD response** - Errores comunes a evitar

### Formato Requerido

```markdown
## Interaction Examples

### Scenario: [Situación típica]

User: "[Petición típica del usuario]"

**GOOD response:**
1. [Paso que toma primero]
2. [Verificación que hace]
3. [Acción final]

**BAD response:**
1. [Error común]
   - [Por qué está mal]
```

### Ejemplos por Rol

**Developer:**
- Scenario: Implementar nueva feature
- Scenario: Corregir un bug
- Scenario: Refactorizar código

**Architect:**
- Scenario: Diseñar nuevo sistema
- Scenario: Evaluar trade-offs
- Scenario: Planear migración

**Tester:**
- Scenario: Escribir tests para feature
- Scenario: Aumentar cobertura
- Scenario: Test de edge cases

**Reviewer:**
- Scenario: Revisar PR
- Scenario: Identificar problemas
- Scenario: Sugerir mejoras

**Documenter:**
- Scenario: Documentar API
- Scenario: Escribir README
- Scenario: Documentar decisión arquitectónica

## Definition of Done

- [ ] Cada rol tiene sección "Interaction Examples"
- [ ] Cada rol tiene mínimo 2 scenarios
- [ ] Cada scenario tiene GOOD y BAD response
- [ ] Los ejemplos son específicos al rol (no genéricos)
- [ ] Los ejemplos muestran el proceso de pensamiento, no solo el resultado
- [ ] Los BAD responses explican por qué están mal

## Notes

- Inspirado en ejemplos de Claude Code: `user: 2+2 / assistant: 4`
- Los ejemplos deben ser realistas y aplicables
- Mantener consistencia de formato entre todos los roles
