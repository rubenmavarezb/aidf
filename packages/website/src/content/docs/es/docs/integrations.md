---
title: Integraciones
description: Usa AIDF con Claude Code, Cursor, GitHub Copilot o cualquier LLM — sin necesidad del CLI.
---

Esta guía explica cómo usar AIDF con herramientas de codificación con IA populares **sin** necesidad del CLI de AIDF.

## Descripción General

AIDF es agnóstico de herramientas. El valor principal está en el **contexto estructurado** (AGENTS.md, roles, tareas), no en el CLI. Puedes usar AIDF con:

- Claude Code
- Cursor
- GitHub Copilot
- Cualquier LLM con acceso a archivos

---

## Integración con Claude Code

### Configuración

1. Copia la carpeta `.ai/` a tu proyecto (desde `templates/.ai/`)
2. Personaliza `AGENTS.md` con los detalles de tu proyecto
3. Crea tareas en `.ai/tasks/`

### Uso

**Opción A: Prompt único con contexto completo**

```bash
claude
> Read .ai/AGENTS.md, then .ai/roles/developer.md, then execute .ai/tasks/001-feature.md
```

**Opción B: Referenciar archivos directamente**

```bash
claude
> @.ai/AGENTS.md @.ai/roles/developer.md @.ai/tasks/001-feature.md
> Execute this task following the context and role.
```

**Opción C: Agregar a CLAUDE.md**

```markdown
# CLAUDE.md

## Project Context
See .ai/AGENTS.md for full project context.

## Task Execution
When asked to execute a task:
1. Read .ai/AGENTS.md for project context
2. Read the role file specified in the task
3. Follow the task's Scope restrictions
4. Signal completion with <TASK_COMPLETE> when Definition of Done is met
```

### Bucle Autónomo (estilo Ralph)

Para ejecución autónoma similar a la técnica Ralph:

```bash
# Terminal
while true; do
  cat .ai/tasks/current-task.md | claude --print
  # Check for completion signal
  # Update task status
  sleep 1
done
```

O usa el bucle integrado de Claude Code:

```bash
claude
> Read .ai/AGENTS.md and .ai/tasks/001-feature.md.
> Execute autonomously until all Definition of Done criteria are met.
> Only modify files in the Allowed scope.
> Output <TASK_COMPLETE> when done or <BLOCKED: reason> if stuck.
```

---

## Integración con Cursor

### Configuración

1. Copia la carpeta `.ai/` a tu proyecto
2. Crea `.cursor/rules/aidf.mdc`:

```markdown
# AIDF Integration

## Context Loading
When working on this project:
- Read `.ai/AGENTS.md` for project overview, architecture, and conventions
- This is your primary source of truth for how the project works

## Task Execution
When asked to execute a task file:
1. Read the task file completely
2. Load the suggested role from `.ai/roles/{role}.md`
3. **STRICTLY** follow the Scope section:
   - Only modify files matching `Allowed` patterns
   - Never modify files matching `Forbidden` patterns
4. Check each item in `Definition of Done` before completing
5. Add `## Status: COMPLETED` to the task file when done

## Role Behavior
When a role file is loaded, adopt:
- The **Identity** as your persona
- The **Constraints** as hard rules
- The **Quality Criteria** as success metrics
```

### Uso en Cursor

**Composer:**
```
Execute the task in .ai/tasks/001-feature.md
```

**Agent Mode:**
```
@.ai/AGENTS.md @.ai/tasks/001-feature.md

Execute this task following AIDF conventions.
Stay within scope and signal <TASK_COMPLETE> when done.
```

### Configuración de Cursor (opcional)

Agrega a `.cursor/settings.json`:

```json
{
  "workspaceContext": {
    "alwaysInclude": [".ai/AGENTS.md"]
  }
}
```

---

## Integración con GitHub Copilot

### Configuración

1. Copia la carpeta `.ai/` a tu proyecto
2. Crea `.github/copilot-instructions.md`:

```markdown
# Project Context

This project uses AIDF (AI-Integrated Development Framework).

## Key Files
- `.ai/AGENTS.md` - Project overview, architecture, conventions
- `.ai/roles/` - Specialized role definitions
- `.ai/tasks/` - Task definitions with scope and requirements

## When Modifying Code
1. Check if there's a relevant task in `.ai/tasks/`
2. Follow the conventions in `.ai/AGENTS.md`
3. Respect the scope defined in task files

## Code Style
See the Conventions section in `.ai/AGENTS.md`
```

---

## Integración con LLM Genérico (API)

Para cualquier LLM vía API, construye los prompts concatenando:

```python
def build_aidf_prompt(task_path: str) -> str:
    agents = read_file('.ai/AGENTS.md')
    task = read_file(task_path)

    # Extract role from task
    role_name = extract_role(task)  # e.g., "developer"
    role = read_file(f'.ai/roles/{role_name}.md')

    return f"""
# Project Context
{agents}

# Your Role
{role}

# Task to Execute
{task}

# Instructions
1. Follow the project conventions
2. Stay within the Allowed scope
3. Never modify Forbidden files
4. Complete all Definition of Done items
5. Output <TASK_COMPLETE> when finished
"""
```

---

## Mejores Prácticas

### 1. Siempre Carga AGENTS.md Primero

El contexto del proyecto debería cargarse antes de cualquier ejecución de tarea. Esto asegura que la IA entienda:
- Arquitectura del proyecto
- Convenciones de código
- Estándares de calidad
- Límites (qué NO hacer)

### 2. Usa el Alcance como Restricciones Duras

```markdown
## Scope

### Allowed
- `src/components/**`

### Forbidden
- `.env*`
- `src/config/**`
```

Dile a la IA explícitamente: "NO DEBES modificar archivos fuera del alcance permitido."

### 3. Definición de Hecho = Criterios de Salida

No dejes que la IA decida cuándo ha "terminado". La Definición de Hecho proporciona criterios objetivos:

```markdown
## Definition of Done
- [ ] Component renders without errors
- [ ] Tests pass (`pnpm test`)
- [ ] TypeScript compiles (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
```

### 4. Usa Roles para Tareas Especializadas

Diferentes tareas necesitan diferente experiencia:

| Tipo de Tarea | Rol |
|---------------|-----|
| Nueva funcionalidad | developer |
| Diseño de sistemas | architect |
| Investigación de bugs | developer + tester |
| Revisión de código | reviewer |
| Documentación | documenter |

### 5. Señala la Completitud Explícitamente

Entrena a la IA para emitir señales claras:

- `<TASK_COMPLETE>` - Todos los elementos de Definición de Hecho cumplidos
- `<BLOCKED: reason>` - No puede continuar, necesita input humano
- `<SCOPE_VIOLATION: file>` - Intentó modificar un archivo prohibido

---

## Plantillas de Prompts

### Ejecución Rápida de Tarea

```
Read .ai/AGENTS.md for context.
Execute .ai/tasks/{task}.md as the {role} role.
Output <TASK_COMPLETE> when Definition of Done is met.
```

### Ejecución Exhaustiva de Tarea

```
# Context Loading
1. Read .ai/AGENTS.md completely
2. Read .ai/roles/{role}.md for your role definition

# Task Execution
3. Read .ai/tasks/{task}.md
4. Analyze the requirements and scope
5. Implement the changes
6. Verify each Definition of Done item
7. Output <TASK_COMPLETE> or <BLOCKED: reason>

# Constraints
- ONLY modify files in Allowed scope
- NEVER modify files in Forbidden scope
- Follow all conventions from AGENTS.md
```

### Prompt de Bucle Autónomo

```
You are executing tasks autonomously using AIDF.

Current iteration: {n}
Task: .ai/tasks/{task}.md

Instructions:
1. Read the task and understand requirements
2. Make incremental progress
3. After each change, verify against Definition of Done
4. If ALL criteria met: output <TASK_COMPLETE>
5. If blocked: output <BLOCKED: specific reason>
6. If need to modify file outside scope: output <SCOPE_VIOLATION: path>

Previous output (if any):
{previous_output}

Begin execution.
```

---

## Solución de Problemas

### La IA ignora las restricciones de alcance

Agrega advertencias explícitas:
```
WARNING: Modifying files outside the Allowed scope will cause task failure.
The following files are FORBIDDEN: {list}
```

### La IA no completa todos los elementos de Definición de Hecho

Agrega un paso de verificación de la lista:
```
Before outputting <TASK_COMPLETE>, verify EACH item:
- [ ] Item 1: {status}
- [ ] Item 2: {status}
Only output <TASK_COMPLETE> if ALL items are checked.
```

### La IA alucina la estructura del proyecto

Siempre carga AGENTS.md primero, que contiene la estructura de directorios real.

### Ventana de contexto demasiado pequeña

Prioriza el orden de carga:
1. AGENTS.md (obligatorio)
2. Archivo de tarea (obligatorio)
3. Archivo de rol (opcional, se puede resumir)
4. Archivo de plan (opcional, solo si existe)
