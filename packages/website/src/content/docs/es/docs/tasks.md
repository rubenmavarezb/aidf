---
title: Diseño de Tareas
description: Aprende a diseñar tareas bien estructuradas — la unidad atómica de trabajo en AIDF — con objetivos claros, alcance y criterios de completitud verificables.
---

Las tareas son la unidad atómica de trabajo en AIDF. Una tarea bien diseñada le da a la IA todo lo que necesita para ejecutar de forma autónoma y producir resultados consistentes.

---

## Anatomía de una Tarea

```markdown
# TASK

## Goal
[One clear sentence - what must be accomplished]

## Task Type
[component | refactor | test | docs | architecture | bugfix]

## Suggested Roles
- [primary role]
- [secondary role if needed]

## Scope

### Allowed
- [paths that may be modified]

### Forbidden
- [paths that must NOT be modified]

## Requirements
[Detailed specifications]

## Definition of Done
- [ ] [Verifiable criterion 1]
- [ ] [Verifiable criterion 2]
- [ ] [Quality gate, e.g., "pnpm test passes"]

## Notes
[Additional context, warnings, tips]
```

---

## Análisis por Sección

### Goal (Objetivo)

El objetivo es una **oración única** que responde: "¿Qué será verdad cuando esta tarea esté completa?"

**Malos Objetivos:**

```markdown
## Goal
Work on the button component and make it better.
```
- Vago
- Sin estado de completitud claro
- "Better" es subjetivo

**Buenos Objetivos:**

```markdown
## Goal
Create a Button component with primary, secondary, and tertiary variants that supports icons and loading states.
```
- Entregable específico
- Alcance claro
- Completitud medible

### Task Type (Tipo de Tarea)

Categorizar tareas ayuda a la IA a entender la naturaleza del trabajo:

| Tipo | Descripción | Roles Típicos |
|------|-------------|---------------|
| `component` | Crear nuevo componente UI | developer, tester |
| `refactor` | Reestructurar código existente | architect, developer |
| `test` | Agregar o mejorar tests | tester |
| `docs` | Trabajo de documentación | documenter |
| `architecture` | Diseño de sistemas, herramientas | architect |
| `bugfix` | Corregir un bug específico | developer |

### Scope (Alcance)

**Esto es crítico.** El alcance define los límites de lo que la IA puede tocar.

```markdown
## Scope

### Allowed
- src/components/Button/**
- src/components/index.ts (to add export)
- tests/components/Button.test.tsx

### Forbidden
- src/core/**
- src/utils/** (use existing utils, don't modify)
- Any configuration files
- package.json
```

**Reglas:**

1. Si no está en `Allowed`, está prohibido
2. Sé lo más específico posible
3. Usa patrones glob para directorios: `src/components/Button/**`
4. Lista explícitamente archivos individuales cuando sea necesario

### Requirements (Requisitos)

Aquí es donde proporcionas especificaciones detalladas. Sé explícito sobre:

**Para Componentes:**

```markdown
## Requirements

### Props API

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'primary' \| 'secondary' \| 'tertiary'` | `'primary'` | Visual style |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Button size |
| `loading` | `boolean` | `false` | Shows loading spinner |
| `disabled` | `boolean` | `false` | Disables interaction |
| `leadingIcon` | `ReactNode` | - | Icon before text |
| `trailingIcon` | `ReactNode` | - | Icon after text |

### Behavior

- When `loading` is true, show spinner and disable button
- Forward all standard button HTML attributes
- Support `as` prop for polymorphism (render as `<a>` for links)

### Styling

- Use CSS custom properties from design tokens
- Support all interactive states (hover, active, focus, disabled)
- Follow BEM-like naming: `.pt-Button`, `.pt-Button--primary`
```

**Para Refactorización:**

```markdown
## Requirements

### Current State
[Describe what exists now]

### Target State
[Describe what should exist after]

### Constraints
- No API changes (internal refactor only)
- Must maintain backward compatibility
- Performance must not degrade
```

**Para Corrección de Bugs:**

```markdown
## Requirements

### Bug Description
[What is happening]

### Expected Behavior
[What should happen]

### Reproduction Steps
1. [Step 1]
2. [Step 2]
3. [Step 3]

### Root Cause (if known)
[Analysis of why this happens]
```

### Definition of Done (Definición de Hecho)

Cada criterio debe ser **verificable**. Si no puedes comprobarlo, no debería estar aquí.

**Malos Criterios:**

```markdown
## Definition of Done
- Code is clean
- Component works correctly
- Good test coverage
```

**Buenos Criterios:**

```markdown
## Definition of Done
- [ ] Component renders without errors
- [ ] All props from the API table are implemented
- [ ] TypeScript compilation passes (`pnpm typecheck`)
- [ ] ESLint passes with no warnings (`pnpm lint`)
- [ ] Tests exist for: default render, all variants, all sizes, loading state, disabled state
- [ ] Tests pass (`pnpm test`)
- [ ] No accessibility violations (test with `expectNoA11yViolations`)
- [ ] Storybook story exists with controls for all props
```

### Notes (Notas)

Usa esta sección para:

- Advertencias sobre trampas
- Referencias a código relacionado
- Decisiones que se tomaron
- Contexto que no encaja en otro lugar

```markdown
## Notes

- The existing `Icon` component should be used for loading spinner
- Follow the pattern established in `src/components/Badge/` for structure
- Design tokens for colors are in `src/tokens/colors.css`
- Accessibility: Ensure button is focusable and announces loading state
```

---

## Plantillas de Tareas por Tipo

### Tarea de Componente

```markdown
# TASK

## Goal
Create the [ComponentName] component with [key features].

## Task Type
component

## Suggested Roles
- developer
- tester

## Scope
### Allowed
- src/components/[ComponentName]/**
- src/components/index.ts
- stories/[ComponentName].stories.tsx

### Forbidden
- src/core/**
- src/tokens/**

## Requirements

### File Structure
Create:
- [ComponentName].tsx
- [ComponentName].types.ts
- [ComponentName].constants.ts
- [component-name].css
- [ComponentName].test.tsx
- index.ts

### Props API
[Table of props]

### Behavior
[Behavioral specifications]

### Styling
[CSS requirements]

## Definition of Done
- [ ] All files created following project structure
- [ ] All props implemented and typed
- [ ] CSS uses design tokens only
- [ ] Tests cover: render, props, interactions, a11y
- [ ] `pnpm quality:fast` passes
- [ ] Storybook story with all variants

## Notes
[Additional context]
```

### Tarea de Refactorización

```markdown
# TASK

## Goal
Refactor [area] to [improvement].

## Task Type
refactor

## Suggested Roles
- architect
- developer

## Scope
### Allowed
- [specific paths]

### Forbidden
- [paths to protect]

## Requirements

### Current State
[What exists now and its problems]

### Target State
[What should exist after]

### Migration Strategy
[How to get from current to target]

### Constraints
- No API changes
- No functionality changes
- Tests must continue passing

## Definition of Done
- [ ] All changes within scope
- [ ] No API changes (same exports, same props)
- [ ] All existing tests pass
- [ ] `pnpm quality:fast` passes
- [ ] No performance regression

## Notes
[Context about why this refactor]
```

### Tarea de Tests

```markdown
# TASK

## Goal
Improve test coverage for [area] to [target]%.

## Task Type
test

## Suggested Roles
- tester

## Scope
### Allowed
- tests/**
- src/**/*.test.tsx

### Forbidden
- Any non-test files

## Requirements

### Current Coverage
[Current metrics]

### Target Coverage
[Target metrics]

### Required Test Cases
- [ ] [Test case 1]
- [ ] [Test case 2]
- [ ] [Edge case 1]

### Testing Patterns
[Reference to test utilities, patterns to follow]

## Definition of Done
- [ ] Coverage meets target
- [ ] All new tests pass
- [ ] No flaky tests introduced
- [ ] Tests follow project patterns
- [ ] `pnpm test` passes

## Notes
[Any special testing considerations]
```

---

## Anti-Patrones

### Alcance Vago

```markdown
## Scope
### Allowed
- src/
```

Esto permite la modificación de cualquier cosa en `src/`. Sé específico.

### Hecho No Medible

```markdown
## Definition of Done
- Code is good quality
```

¿Qué es "buena calidad"? Reemplázalo con comprobaciones específicas.

### Contexto Faltante

```markdown
## Requirements
Build a form.
```

¿Qué campos? ¿Qué validación? ¿Qué comportamiento de envío? Proporciona detalles.

### Tareas Sobrecargadas

```markdown
## Goal
Build the authentication system including login, registration, password reset, OAuth integration, and user profile management.
```

Esto es demasiado. Divídelo en múltiples tareas enfocadas.

---

## Consejos

### Una Tarea, Un Propósito

Una tarea debería tener un propósito claro. Si te encuentras escribiendo "y" múltiples veces en el objetivo, divídelo.

### Incluye Referencias a Archivos

```markdown
## Notes
- Follow the pattern in `src/components/Button/` for structure
- Use utilities from `src/utils/form-validation.ts`
- Reference design at `docs/designs/login-form.png`
```

### Especifica el Formato de Salida

Cuando el formato de salida importa:

```markdown
## Requirements

### Output Format
The component must export:
\`\`\`typescript
export { LoginForm } from "./LoginForm";
export type { LoginFormProps } from "./LoginForm.types";
\`\`\`
```

### Vincula Tareas Relacionadas

```markdown
## Notes
- Depends on: Task #003 (design tokens must exist first)
- Blocks: Task #007 (auth flow needs this form)
```

---

## Tareas Bloqueadas y Reanudación

Cuando la ejecución de una tarea encuentra un bloqueante que requiere intervención humana, AIDF automáticamente marca la tarea como `BLOCKED` y guarda el estado de ejecución en el archivo de tarea.

### Formato del Estado Bloqueado

Cuando una tarea está bloqueada, AIDF agrega una sección de estado al archivo de tarea:

```markdown
## Status: BLOCKED

### Execution Log
- **Started:** 2024-01-01T10:00:00.000Z
- **Iterations:** 5
- **Blocked at:** 2024-01-01T11:00:00.000Z

### Blocking Issue
\`\`\`
Missing API key configuration. The task requires an API key to be set in the environment, but it was not found.
\`\`\`

### Files Modified
- \`src/api/client.ts\`
- \`src/config/settings.ts\`

---
@developer: Review and provide guidance, then run \`aidf run --resume task.md\`
```

### Reanudar una Tarea Bloqueada

Después de abordar el problema de bloqueo o proporcionar orientación, puedes reanudar la tarea usando la bandera `--resume`:

```bash
aidf run --resume .ai/tasks/my-task.md
```

O deja que AIDF seleccione automáticamente de las tareas bloqueadas:

```bash
aidf run --resume
```

**Qué sucede al reanudar:**

1. AIDF carga el estado de ejecución previo (conteo de iteraciones, archivos modificados, problema de bloqueo)
2. La ejecución continúa desde la siguiente iteración después del bloqueo
3. El problema de bloqueo se incluye en el contexto del prompt para que la IA entienda qué salió mal
4. Los archivos modificados previamente se rastrean y preservan
5. El historial de intentos de reanudación se registra en el archivo de tarea

### Historial de Intentos de Reanudación

AIDF rastrea los intentos de reanudación en el archivo de tarea:

```markdown
### Resume Attempt History
- **Resumed at:** 2024-01-01T12:00:00.000Z
- **Previous attempt:** Iteration 5, blocked at 2024-01-01T11:00:00.000Z
- **Completed at:** 2024-01-01T13:00:00.000Z
- **Status:** completed
- **Iterations in this attempt:** 3
```

### Completitud de Tarea Después de Reanudar

Cuando una tarea se completa después de ser reanudada, el estado BLOCKED se reemplaza con un estado de completitud e historial de ejecución:

```markdown
## Execution History

### Original Block
- **Started:** 2024-01-01T10:00:00.000Z
- **Blocked at:** 2024-01-01T11:00:00.000Z
- **Iterations before block:** 5
- **Blocking issue:** Missing API key configuration...

### Resume and Completion
- **Resumed at:** 2024-01-01T12:00:00.000Z
- **Completed at:** 2024-01-01T13:00:00.000Z
- **Total iterations:** 8
- **Files modified:** 5 files

---

## Status: COMPLETED
```

### Mejores Prácticas para Reanudar

1. **Revisa el problema de bloqueo** - Entiende qué salió mal antes de reanudar
2. **Aborda el bloqueante** - Corrige el problema o proporciona orientación clara en el archivo de tarea
3. **Verifica el contexto** - Comprueba que los archivos modificados en el intento anterior siguen siendo relevantes
4. **Usa el historial de reanudación** - Revisa intentos de reanudación anteriores para entender patrones

### Cuándo las Tareas se Bloquean

Las tareas se marcan automáticamente como BLOCKED cuando:

- La IA señala explícitamente `<BLOCKED: reason>` en su salida
- Se alcanza el máximo de iteraciones
- Se alcanza el máximo de fallos consecutivos
- Ocurren errores críticos que impiden la continuación

### Manejo de Errores

Si intentas reanudar una tarea que no está bloqueada:

```bash
$ aidf run --resume .ai/tasks/normal-task.md
Error: Task is not blocked. Cannot use --resume on a task that is not in BLOCKED status.
```

Solo las tareas con `## Status: BLOCKED` pueden ser reanudadas.
