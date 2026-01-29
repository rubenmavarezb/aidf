---
title: Guía de Configuración
description: Guía paso a paso para integrar AIDF en tu proyecto con roles, tareas y plantillas.
---

## Requisitos Previos

- Un proyecto existente (cualquier lenguaje/framework)
- Comprensión básica de la arquitectura de tu proyecto
- Acceso a un asistente de IA (Claude, GPT-4, Cursor, etc.)

---

## Paso 1: Crear la Estructura

Crea la carpeta `.ai` en la raíz de tu proyecto:

```bash
mkdir -p .ai/roles .ai/tasks .ai/plans .ai/templates
```

O copia desde AIDF:

```bash
cp -r /path/to/aidf/templates/.ai /your/project/
```

Tu estructura debería verse así:

```
your-project/
├── .ai/
│   ├── AGENTS.md           # You'll create this
│   ├── ROLES.md            # Role selection guide
│   ├── roles/              # AI personas
│   ├── tasks/              # Task prompts
│   ├── plans/              # Multi-task initiatives
│   └── templates/          # Reusable templates
├── src/
└── ...
```

---

## Paso 2: Crear AGENTS.md

Este es el archivo más importante. Le da a la IA contexto completo sobre tu proyecto.

Comienza con esta estructura:

```markdown
# AGENTS.md

## Project Overview

[What this project is, its purpose, who uses it]

## Architecture

### Structure
[Folder organization, key directories]

### Patterns
[Design patterns used: MVC, Atomic Design, etc.]

### Key Files
[Important files AI should know about]

## Technology Stack

- **Language**: [TypeScript, Python, etc.]
- **Framework**: [React, Django, etc.]
- **Build**: [Vite, Webpack, etc.]
- **Testing**: [Jest, Vitest, pytest, etc.]

## Conventions

### Naming
[File naming, variable naming, component naming]

### Code Style
[Formatting rules, linting configuration]

### File Structure
[How files within a module/component are organized]

## Quality Standards

### Testing
[Coverage requirements, what to test]

### Type Safety
[TypeScript strictness, type requirements]

### Documentation
[JSDoc, docstrings, README requirements]

## Boundaries

### Never Modify
[Critical files that should not be touched]

### Requires Approval
[Files that need human review before changes]

## Commands

[Common commands AI should know]

- `npm install` - Install dependencies
- `npm run dev` - Start development server
- `npm test` - Run tests
- `npm run lint` - Check code style
```

Consulta [Escribir AGENTS.md](/aidf/es/docs/agents-file/) para una guía detallada.

---

## Paso 3: Seleccionar Roles

Revisa los roles en `.ai/roles/` y conserva solo los relevantes para tu proyecto:

| Rol | Conservar Si... |
|-----|-----------------|
| `architect.md` | Haces diseño de sistemas, refactorización |
| `developer.md` | Escribes funcionalidades, corriges bugs |
| `tester.md` | Escribes tests, mejoras cobertura |
| `reviewer.md` | Quieres revisión de código por IA |
| `documenter.md` | Escribes documentación |

Personaliza cada rol para las particularidades de tu proyecto.

---

## Paso 4: Configurar Plantillas

Edita `.ai/templates/TASK.template.md` para que coincida con tu flujo de trabajo:

```markdown
# TASK

## Goal
<One clear sentence describing what must be done>

## Task Type
<component | refactor | test | docs | architecture>

## Suggested Roles
- <primary role>
- <secondary role if needed>

## Scope

### Allowed
- <paths that may be modified>

### Forbidden
- <paths that must not be touched>

## Requirements
<Detailed specifications>

## Definition of Done
- [ ] <Verifiable criterion>
- [ ] <Your standard quality check, e.g., "npm test passes">

## Notes
<Additional context, warnings, tips>
```

---

## Paso 5: Agregar a .gitignore (Opcional)

Decide qué rastrear:

```gitignore
# Track everything (recommended)
# .ai/ is committed

# Or ignore active tasks
.ai/tasks/*.active.md

# Or ignore plans in progress
.ai/plans/*/WIP-*
```

Recomendación: **Haz commit de todo**. La carpeta `.ai` es documentación que ayuda a futuros contribuidores (humanos e IA).

---

## Paso 6: Crear Tu Primera Tarea

```bash
cp .ai/templates/TASK.template.md .ai/tasks/$(date +%Y-%m-%d)-my-first-task.md
```

Edita el archivo de tarea con tus requisitos.

---

## Paso 7: Ejecutar

### Opción A: Contexto Completo (Recomendado para tareas complejas)

Proporciona a la IA:

1. Contenido de AGENTS.md
2. Definición del rol relevante
3. Definición de la tarea

```
[Paste AGENTS.md]

[Paste role definition]

[Paste task]
```

### Opción B: Solo la Tarea (Para tareas simples)

Si la IA ya ha visto AGENTS.md en la sesión:

```
[Paste task only]
```

### Opción C: Referencia (Si la IA tiene acceso a archivos)

```
Read .ai/AGENTS.md, .ai/roles/developer.md, and .ai/tasks/my-task.md, then execute the task.
```

---

## Lista de Verificación

Después de la configuración, verifica:

- [ ] La carpeta `.ai/` existe con la estructura correcta
- [ ] `AGENTS.md` describe tu proyecto con precisión
- [ ] Al menos un rol está personalizado
- [ ] La plantilla de tareas coincide con tus estándares de calidad
- [ ] Puedes crear y ejecutar una tarea de prueba simple

---

## Integración con Herramientas

### Cursor

Cursor lee automáticamente los archivos del proyecto. Referencia `.ai/AGENTS.md` en tus prompts o agrégalo al contexto de Cursor.

### Claude (vía API o Consola)

Pega el contexto relevante al inicio de las conversaciones, o usa la función de Proyectos para persistir el contexto.

### VS Code + Extensiones

Usa la configuración del workspace para referenciar archivos de `.ai/` en las configuraciones de extensiones de IA.

### CI/CD

Agrega validación de que las tareas cumplen la Definición de Hecho:

```yaml
# Example: Verify no forbidden paths were modified
- name: Check scope compliance
  run: |
    # Script to verify changes are within allowed scope
```

---

## Próximos Pasos

- [Escribir AGENTS.md](/aidf/es/docs/agents-file/) - Profundiza en documentos de contexto
- [Definir Roles](/aidf/es/docs/roles/) - Personaliza personas de IA
- [Diseño de Tareas](/aidf/es/docs/tasks/) - Escribe tareas efectivas
- [Mejores Prácticas](/aidf/es/docs/best-practices/) - Patrones que funcionan
