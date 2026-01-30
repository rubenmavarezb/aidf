# TASK: AIDF Self-Awareness en Templates

## Goal
Que los templates generados por `aidf init` expliquen el framework AIDF al AI agent, para que entienda que está trabajando dentro de un sistema de capas con convenciones específicas — sin necesidad de que el usuario lo explique manualmente.

## Status: ✅ COMPLETED

### Execution Log
- **Started:** 2026-01-29T23:50:15.365Z
- **Completed:** 2026-01-29T23:53:20.405Z
- **Iterations:** 1
- **Files modified:** 0

### Files Modified
_None_

## Task Type
component

## Suggested Roles
- developer

## Auto-Mode Compatible
✅ **SÍ** - Cambios en templates y generación de archivos. Sin lógica compleja.

## Scope

### Allowed
- `templates/.ai/AGENTS.template.md`
- `templates/.ai/README.md` (crear)
- `packages/cli/src/commands/init.ts`
- `packages/cli/src/commands/init.test.ts`

### Forbidden
- `packages/cli/src/core/**`
- `packages/cli/src/types/**`
- `docs/**`
- `.ai/**`

## Requirements

### 1. Agregar `framework: aidf` y comentarios al config.yml generado

En `init.ts`, el config.yml generado debe incluir comentarios explicativos y el campo `framework`:

```yaml
# AIDF (AI Development Framework) Configuration
# Framework docs: https://rubenmavarezb.github.io/aidf/docs/concepts/
#
# AIDF provides structured, layered context for AI assistants:
#   Layer 1: AGENTS.md (global project context)
#   Layer 2: roles/*.md (specialized role definitions)
#   Layer 3: skills/*.md (portable skill definitions)
#   Layer 4: tasks/*.md (scoped task specifications)
#   Layer 5: plans/*.md (multi-task initiatives)
#
# For sensitive values, use environment variables:
#   api_key: ${ANTHROPIC_API_KEY}
#   webhook_url: ${AIDF_SLACK_WEBHOOK}
# Environment variables are resolved at runtime using ${VAR} or $VAR syntax.

framework: aidf
version: "1.0"
project:
  name: [project_name]
  ...
```

Nota: YAML.stringify no genera comentarios. Escribir el config.yml como string con template literal en lugar de YAML.stringify, o escribir los comentarios como header antes del YAML stringificado.

### 2. Crear `templates/.ai/README.md`

Nuevo archivo que se copia automáticamente con `aidf init` (ya está cubierto por `copyDir`):

```markdown
# .ai/ — AIDF Configuration

This directory contains the **AIDF (AI Development Framework)** configuration for this project.

**Framework documentation:** https://rubenmavarezb.github.io/aidf/docs/concepts/

## What is AIDF?

AIDF is a structured context framework for AI-assisted development. It provides layered context so AI assistants understand project conventions, role expertise, and task boundaries — the same way a new human developer would be onboarded.

## How It Works

AIDF uses five nested context layers:

```
Layer 1 (Global)    →  AGENTS.md        →  Project conventions, architecture, boundaries
Layer 2 (Role)      →  roles/*.md       →  Specialized expertise and behavior rules
Layer 3 (Skill)     →  skills/*.md      →  Portable skill definitions and instructions
Layer 4 (Task)      →  tasks/*.md       →  Exact scope, requirements, definition of done
Layer 5 (Plan)      →  plans/*.md       →  Multi-task initiatives and sequencing
```

**Combined:** Project conventions + role expertise + skill context + task scope = precise execution instructions.

## Directory Contents

| File / Directory | Purpose |
|---|---|
| `config.yml` | AIDF configuration (provider, behavior, validation, security, skills) |
| `AGENTS.md` | **Start here.** Master context — project identity, architecture, conventions, quality gates |
| `ROLES.md` | Quick reference for selecting the right AI role |
| `roles/` | Role definitions: developer, architect, tester, reviewer, documenter |
| `skills/` | Skill definitions for AI agents (one per role + task templates) |
| `tasks/` | Task specifications with scoped allowed/forbidden file paths |
| `plans/` | Multi-task initiative plans |
| `templates/` | Templates for creating new tasks and plans |

## Quick Start for AI Assistants

1. Read `AGENTS.md` completely (Layer 1 — global context)
2. Check `ROLES.md` to identify which role applies
3. Read the assigned role in `roles/` (Layer 2 — role expertise)
4. Read the task specification in `tasks/` if one exists (Layer 4 — task scope)
5. Follow all conventions, quality gates, and boundaries defined in Layer 1
```

### 3. Agregar sección "AIDF Framework" al inicio de `AGENTS.template.md`

Después del header y antes de "## Identity", agregar una sección que explique el framework:

```markdown
## AIDF Framework

This project uses **AIDF v1.0** (AI Development Framework) to provide structured context for AI assistants.

### Context Layers

| Layer | Source | Purpose |
|-------|--------|---------|
| **Layer 1 — Global** | `AGENTS.md` (this file) | Project identity, architecture, conventions, quality gates, boundaries |
| **Layer 2 — Role** | `.ai/roles/*.md` | Specialized expertise and behavior rules |
| **Layer 3 — Skill** | `.ai/skills/*.md` | Portable skill definitions and instructions |
| **Layer 4 — Task** | `.ai/tasks/*.md` | Exact scope (allowed/forbidden files), requirements, definition of done |
| **Layer 5 — Plan** | `.ai/plans/*.md` | Multi-task initiatives and sequencing |

**How layers combine:** Project conventions (Layer 1) + role expertise (Layer 2) + skill context (Layer 3) + task scope (Layer 4) = precise execution instructions.

### Navigation Guide

- **Starting a task?** → Read this file first, then your role in `roles/`, then the task in `tasks/`
- **Choosing a role?** → See `ROLES.md` for the quick reference matrix
- **Creating a task?** → Use templates in `templates/`
- **Framework docs:** https://rubenmavarezb.github.io/aidf/docs/concepts/
```

### 4. Actualizar `init.ts` para generar config con comentarios

El YAML.stringify actual no soporta comentarios. Opciones:

**Opción A (recomendada):** Escribir un header de comentarios antes del YAML stringificado:

```typescript
const configHeader = `# AIDF (AI Development Framework) Configuration
# Framework docs: https://rubenmavarezb.github.io/aidf/docs/concepts/
#
# AIDF provides structured, layered context for AI assistants:
#   Layer 1: AGENTS.md (global project context)
#   Layer 2: roles/*.md (specialized role definitions)
#   Layer 3: skills/*.md (portable skill definitions)
#   Layer 4: tasks/*.md (scoped task specifications)
#   Layer 5: plans/*.md (multi-task initiatives)
#
# For sensitive values, use environment variables:
#   api_key: ${ANTHROPIC_API_KEY}
#   webhook_url: ${AIDF_SLACK_WEBHOOK}

`;

const configContent = configHeader + YAML.stringify(config);
writeFileSync(configPath, configContent);
```

**Opción B:** Reemplazar YAML.stringify por un template literal completo. Más control pero más frágil.

Ir con opción A.

### 5. Agregar `framework: aidf` al config object

En `init.ts`, agregar `framework: 'aidf'` al objeto config antes de stringify:

```typescript
const config = {
  framework: 'aidf',
  version: '1.0',
  project: { ... },
  ...
};
```

### 6. Tests

- Test: config.yml generado contiene header con comentarios AIDF
- Test: config.yml contiene `framework: aidf`
- Test: README.md se copia correctamente al destino
- Test: AGENTS.md contiene sección "AIDF Framework"

## Definition of Done
- [ ] `config.yml` generado tiene header con comentarios explicativos del framework
- [ ] `config.yml` tiene campo `framework: aidf`
- [ ] `templates/.ai/README.md` creado con explicación del framework y quick start
- [ ] `AGENTS.template.md` tiene sección "AIDF Framework" con layers y navigation guide
- [ ] `aidf init` genera todos los archivos correctamente
- [ ] Tests cubren la generación del config y la presencia de README.md
- [ ] `pnpm lint` pasa
- [ ] `pnpm typecheck` pasa
- [ ] `pnpm test` pasa
- [ ] `pnpm build` pasa

## Notes
- El README.md no necesita lógica de template (no tiene placeholders) — se copia as-is
- Los comentarios YAML se pierden con YAML.stringify — usar header string + YAML.stringify
- El campo `framework: aidf` permite que herramientas futuras detecten proyectos AIDF
- La sección en AGENTS.template.md va DESPUÉS del header intro pero ANTES de "## Identity"
- La URL de docs apunta al sitio Astro: https://rubenmavarezb.github.io/aidf/docs/concepts/
