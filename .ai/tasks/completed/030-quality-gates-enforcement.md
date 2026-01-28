# TASK: 030 - Agregar Quality Gates Obligatorios

## Goal

Implementar un sistema de "Quality Gates" en AIDF que defina verificaciones obligatorias que DEBEN pasar antes de que cualquier tarea pueda marcarse como completa.

## Task Type

architecture

## Suggested Roles

- architect
- documenter

## Scope

### Allowed

- `templates/.ai/AGENTS.template.md`
- `templates/.ai/templates/task.template.md`
- `templates/.ai/templates/TASK.template.md`
- `templates/.ai/templates/tasks/*.md`

### Forbidden

- `templates/.ai/roles/*` (se maneja en task 029)
- `examples/*`
- `docs/*`

## Requirements

### Nueva Sección en AGENTS.template.md: Quality Gates

```markdown
## Quality Gates

CRITICAL: Before ANY task can be marked complete, ALL of these must pass.

### Required Checks

| Check | Command | Expected Result |
|-------|---------|-----------------|
| Lint | `[lint_command]` | Zero errors, zero warnings |
| Types | `[typecheck_command]` | Zero errors |
| Tests | `[test_command]` | All tests pass |
| Build | `[build_command]` | Builds successfully |

### Verification Process

1. Run ALL commands in the table above
2. Capture output of each command
3. If ANY fails, task is NOT complete
4. Fix issues and re-run ALL checks
5. Only mark complete when ALL pass

IMPORTANT: Partial passes are not acceptable. ALL gates must pass.
```

### Integración en Task Templates

Agregar sección de verificación al final de cada task:

```markdown
## Completion Verification

CRITICAL: Complete this section before marking the task done.

<completion_verification>
### Quality Gate Results

| Check | Status | Output Summary |
|-------|--------|----------------|
| Lint | PASS/FAIL | [summary] |
| Types | PASS/FAIL | [summary] |
| Tests | PASS/FAIL | [X/X passed] |
| Build | PASS/FAIL | [summary] |

### Files Modified
- [ ] path/to/file1.ts
- [ ] path/to/file2.ts

### All Definition of Done Items
- [ ] [Copy from DoD above]

### Final Status
- All quality gates passed: YES/NO
- All DoD items verified: YES/NO
- Ready to mark complete: YES/NO
</completion_verification>
```

### Reglas de Enforcement

1. **No Exceptions** - Quality gates aplican a TODAS las tareas
2. **No Partial Credit** - Todos los gates deben pasar
3. **Document Failures** - Si un gate falla, documentar por qué
4. **Re-verify After Fixes** - Después de arreglar, correr TODO de nuevo

### Placeholder Commands

Definir placeholders estándar para proyectos:

```markdown
### Commands Configuration

Configure these in your project's AGENTS.md:

| Placeholder | Example Values |
|-------------|----------------|
| `[lint_command]` | `npm run lint`, `pnpm lint`, `eslint .` |
| `[typecheck_command]` | `npm run typecheck`, `tsc --noEmit` |
| `[test_command]` | `npm test`, `pytest`, `go test ./...` |
| `[build_command]` | `npm run build`, `cargo build` |
```

## Definition of Done

- [ ] AGENTS.template.md tiene sección "Quality Gates" completa
- [ ] Quality Gates incluye tabla de comandos con placeholders
- [ ] Quality Gates incluye "Verification Process" numerado
- [ ] task.template.md tiene sección "Completion Verification"
- [ ] Todos los task templates específicos tienen Completion Verification
- [ ] Usa palabras CRITICAL e IMPORTANT donde corresponde
- [ ] Incluye formato `<completion_verification>` con checklist
- [ ] Documenta que no hay excepciones a quality gates

## Notes

- Inspirado en las verificaciones obligatorias de Claude Code antes de commits
- Los quality gates deben ser ejecutables (no subjetivos)
- Permite proyectos sin todos los gates (ej: proyecto sin types)

## Status: ✅ COMPLETED

- **Completed:** 2026-01-28
- **Agent:** Claude Code (session 013-improve-readme)
- **PR:** #2
