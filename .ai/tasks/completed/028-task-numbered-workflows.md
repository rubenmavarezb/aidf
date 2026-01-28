# TASK: 028 - Mejorar Task Templates con Flujos Numerados

## Goal

Refactorizar los templates de tareas para incluir flujos de trabajo numerados y prescriptivos, con pasos exactos que la IA debe seguir en orden.

## Task Type

refactor

## Suggested Roles

- architect
- documenter

## Scope

### Allowed

- `templates/.ai/templates/task.template.md`
- `templates/.ai/templates/TASK.template.md`
- `templates/.ai/templates/tasks/bug-fix.template.md`
- `templates/.ai/templates/tasks/new-feature.template.md`
- `templates/.ai/templates/tasks/refactor.template.md`
- `templates/.ai/templates/tasks/test-coverage.template.md`
- `templates/.ai/templates/tasks/documentation.template.md`
- `templates/.ai/templates/tasks/dependency-update.template.md`

### Forbidden

- `templates/.ai/roles/*`
- `templates/.ai/AGENTS.template.md`
- `examples/*`

## Requirements

### Nueva Sección: Execution Steps

Agregar sección con pasos numerados obligatorios:

```markdown
## Execution Steps

FOLLOW THESE STEPS IN ORDER:

### Step 1: Research (do NOT write code yet)
1. Read AGENTS.md completely
2. Read all files in Scope/Allowed
3. Identify existing patterns to follow
4. List all files that will be created/modified

### Step 2: Plan
1. Document changes for each file
2. Identify test cases needed
3. Verify approach follows conventions

### Step 3: Implement
1. Make changes following existing patterns
2. Write tests alongside code
3. Update imports/exports as needed

### Step 4: Verify
1. Run: `[lint_command]`
2. Run: `[typecheck_command]`
3. Run: `[test_command]`
4. ALL must pass before proceeding
```

### Flujos Específicos por Tipo de Task

**bug-fix.template.md:**
1. Reproduce the bug
2. Identify root cause
3. Write failing test
4. Fix the bug
5. Verify test passes
6. Check for regressions

**new-feature.template.md:**
1. Research existing patterns
2. Design component/module structure
3. Implement core functionality
4. Add tests
5. Update documentation
6. Verify quality gates

**refactor.template.md:**
1. Ensure tests exist for current behavior
2. Make incremental changes
3. Verify tests still pass after each change
4. Update affected imports
5. Remove dead code

**test-coverage.template.md:**
1. Identify untested code paths
2. Prioritize by risk/importance
3. Write tests for happy path
4. Write tests for edge cases
5. Write tests for error cases
6. Verify coverage increase

### Pre-Flight Checklist

Agregar al inicio de cada task:

```markdown
## Pre-Flight Checklist

Before starting, verify:
- [ ] I have read AGENTS.md completely
- [ ] I understand the existing patterns
- [ ] I know the quality check commands
- [ ] I understand the scope boundaries
```

## Definition of Done

- [ ] task.template.md tiene sección "Execution Steps" con 4 pasos
- [ ] task.template.md tiene "Pre-Flight Checklist"
- [ ] bug-fix.template.md tiene flujo específico para bugs
- [ ] new-feature.template.md tiene flujo para features
- [ ] refactor.template.md tiene flujo para refactors
- [ ] test-coverage.template.md tiene flujo para tests
- [ ] documentation.template.md tiene flujo para docs
- [ ] dependency-update.template.md tiene flujo para deps
- [ ] Todos los flujos usan formato "FOLLOW THESE STEPS IN ORDER"
- [ ] Cada paso es verificable (no ambiguo)

## Notes

- Inspirado en flujos de Claude Code para git commit y PR creation
- Los pasos deben ser lo suficientemente genéricos para aplicar a cualquier proyecto
- Mantener placeholders para comandos específicos del proyecto

## Status: ✅ COMPLETED

- **Completed:** 2026-01-28
- **Agent:** Claude Code (session 013-improve-readme)
- **PR:** #2
