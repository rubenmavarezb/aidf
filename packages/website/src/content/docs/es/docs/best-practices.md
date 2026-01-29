---
title: Mejores Prácticas
description: Patrones y anti-patrones aprendidos del desarrollo asistido por IA en el mundo real con AIDF.
---

Patrones y anti-patrones aprendidos del desarrollo asistido por IA en el mundo real.

---

## Gestión del Contexto

### Haz: Carga el Contexto al Inicio

Dale a la IA el contexto del proyecto al inicio de una sesión, no de forma fragmentada.

**Malo:**
```
Tú: "Add a button"
IA: *Crea un botón genérico*
Tú: "Actually, we use TypeScript"
IA: *Reescribe con tipos*
Tú: "And we have specific naming conventions"
IA: *Reescribe de nuevo*
```

**Bueno:**
```
Tú: *Proporciona AGENTS.md + rol + tarea*
IA: *Crea el botón siguiendo todas las convenciones a la primera*
```

### Haz: Mantén AGENTS.md Actualizado

Trata AGENTS.md como documentación viva. Actualízalo cuando:

- Estableces nuevos patrones
- Tomas decisiones arquitectónicas
- Aprendes de errores de la IA
- Las convenciones del proyecto evolucionan

### No: Asumas que la IA Recuerda

Incluso en sesiones largas, el contexto de la IA puede desviarse. Para tareas importantes:

- Referencia secciones específicas de AGENTS.md
- Repite restricciones críticas
- Verifica la comprensión antes de ejecutar

---

## Diseño de Tareas

### Haz: Sé Explícito con el Alcance

```markdown
## Scope

### Allowed
- src/components/Button/**
- src/components/index.ts (add export only)

### Forbidden
- src/core/**
- src/utils/**
- Any *.config.* files
```

### Haz: Proporciona Ejemplos

Cuando tienes expectativas específicas:

```markdown
## Requirements

### Example Usage

\`\`\`tsx
// Basic
<Button variant="primary">Click me</Button>

// With icon
<Button leadingIcon={<PlusIcon />}>Add Item</Button>

// As link
<Button as="a" href="/home">Go Home</Button>
\`\`\`
```

### No: Dejes Margen para Interpretación

**Malo:**
```markdown
## Requirements
Make it look nice and work well.
```

**Bueno:**
```markdown
## Requirements
- Follow design tokens in `src/tokens/`
- Support hover, active, focus, and disabled states
- Minimum touch target: 44x44px
- Color contrast: WCAG AA (4.5:1 for text)
```

### No: Sobrecargues las Tareas

**Malo:**
```markdown
## Goal
Build the entire checkout flow including cart, shipping, payment, and confirmation.
```

**Bueno:**
```markdown
## Goal
Create the CartSummary component displaying line items with quantities and totals.
```

---

## Aseguramiento de Calidad

### Haz: Define Completitud Verificable

Cada elemento de "Definición de Hecho" debería ser comprobable:

```markdown
## Definition of Done
- [ ] `pnpm lint` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes
- [ ] Component has Storybook story
- [ ] All props are documented with JSDoc
```

### Haz: Requiere Tests

Si tu proyecto tiene estándares de testing, imponlos:

```markdown
## Definition of Done
- [ ] Unit tests exist for: render, props, events
- [ ] Accessibility test with `expectNoA11yViolations`
- [ ] Coverage meets 80% threshold
```

### No: Te Saltes la Revisión

El resultado de la IA siempre debería ser revisado. Automatiza las comprobaciones, pero la revisión humana detecta:

- Errores de lógica que pasan los tests
- Violaciones de convenciones que no se detectan con linters
- Deriva arquitectónica
- Problemas de seguridad

---

## Uso de Roles

### Haz: Asigna el Rol Adecuado a la Tarea

| Tarea | Mejor Rol |
|-------|-----------|
| "Build new component" | developer |
| "Design new feature" | architect |
| "Add test coverage" | tester |
| "Review this PR" | reviewer |
| "Write documentation" | documenter |

### Haz: Usa las Restricciones del Rol

Los roles tienen restricciones integradas. El rol tester no modifica código de implementación. El rol reviewer sugiere pero no reescribe.

### No: Mezcles Responsabilidades

**Malo:**
```markdown
## Goal
Write tests and fix any bugs you find.
```

Esto mezcla los roles tester y developer. Divídelo en:

1. Tarea: Escribir tests (rol tester)
2. Tarea: Corregir bugs encontrados por los tests (rol developer)

---

## Patrones de Iteración

### Haz: Empieza Pequeño, Itera

1. Crea la implementación básica
2. Agrega tests
3. Refina según feedback
4. Repite

### Haz: Establece Puntos de Control en Trabajo Complejo

Para tareas grandes, define puntos de control:

```markdown
## Checkpoints

### Checkpoint 1: Structure
- [ ] All files created
- [ ] Basic component renders

### Checkpoint 2: Functionality
- [ ] All props work
- [ ] Events fire correctly

### Checkpoint 3: Quality
- [ ] Tests pass
- [ ] Lint passes
- [ ] A11y passes
```

### No: Dejes que la IA Funcione sin Límites

Establece límites claros y puntos de parada. La IA seguirá "mejorando" indefinidamente si la dejas.

---

## Manejo de Errores

### Haz: Espera y Maneja Fallos

La IA cometerá errores. Tu flujo de trabajo debería:

1. Capturar errores mediante comprobaciones automatizadas
2. Proporcionar feedback claro
3. Permitir iteración

### Haz: Aprende de los Fallos

Cuando la IA comete consistentemente el mismo error:

1. Agrega el patrón correcto a AGENTS.md
2. Agrega un "No hagas" al rol relevante
3. Agrega validación a la Definición de Hecho

### No: Culpes a la Herramienta

Si la IA sigue cometiendo el mismo error, probablemente el contexto no es claro. Mejora AGENTS.md en lugar de luchar contra la herramienta.

---

## Seguridad

### Haz: Define Rutas Prohibidas

Protege siempre:

```markdown
### Forbidden
- .env*
- **/credentials*
- **/secrets*
- .github/workflows/** (CI/CD)
```

### Haz: Revisa Código Sensible en Seguridad

Nunca dejes que código generado por IA que toque auth, pagos o datos de usuario pase sin revisión.

### No: Incluyas Secretos en el Contexto

Nunca pongas claves API, contraseñas o tokens en AGENTS.md o en tareas.

---

## Patrones de Equipo

### Haz: Comparte AGENTS.md

AGENTS.md debería estar en control de versiones. Es documentación que ayuda a:

- Nuevos miembros del equipo a entender el proyecto
- Asistentes de IA a entender convenciones
- Tu yo futuro a recordar decisiones

### Haz: Estandariza las Plantillas de Tareas

Usa plantillas de tareas consistentes en todo el equipo:

- Misma estructura
- Mismo formato de Definición de Hecho
- Mismas convenciones de alcance

### No: Crees Convenciones Personales

Si un desarrollador usa patrones diferentes a los que describe AGENTS.md, la IA se confunde. Mantén las convenciones consistentes.

---

## Rendimiento

### Haz: Cachea el Contexto

Si tu herramienta de IA lo soporta, cachea AGENTS.md y las definiciones de roles. Reenviarlos en cada mensaje desperdicia tokens y tiempo.

### Haz: Usa el Nivel de Detalle Apropiado

- Para tareas simples: La definición de tarea puede ser suficiente
- Para tareas complejas: AGENTS.md completo + rol + tarea

### No: Sobre-Especifiques Tareas Simples

```markdown
# TASK

## Goal
Fix typo in README.md: "teh" → "the"

## Task Type
docs

## Scope
### Allowed
- README.md

### Forbidden
- Everything else

## Requirements
Find "teh" and replace with "the".

## Definition of Done
- [ ] Typo is fixed
- [ ] No other changes made
```

Esto es excesivo. Para tareas triviales, un prompt simple es suficiente.

---

## Evolución

### Haz: Empieza Simple

Comienza con:

1. AGENTS.md básico
2. Uno o dos roles
3. Plantilla de tarea simple

Agrega complejidad a medida que aprendas lo que tu proyecto necesita.

### Haz: Mide la Efectividad

Rastrea:

- Tiempo desde creación de tarea hasta completitud
- Número de iteraciones necesarias
- Tipos de errores que se escapan
- Problemas específicos de la IA

### No: Sobre-Ingenierices al Principio

No necesitas 15 roles y 50 páginas de AGENTS.md el primer día. Construye lo que necesites, cuando lo necesites.

---

## Lista de Verificación Resumen

Antes de ejecutar una tarea:

- [ ] AGENTS.md está actualizado
- [ ] El rol apropiado está seleccionado
- [ ] La tarea tiene un objetivo claro
- [ ] El alcance está explícitamente definido
- [ ] Los requisitos son específicos
- [ ] La Definición de Hecho es verificable
- [ ] La revisión humana está planificada
