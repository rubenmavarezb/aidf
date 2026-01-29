---
title: Conceptos Fundamentales
description: Comprende el problema que AIDF resuelve y sus componentes principales — AGENTS.md, Roles, Tareas y Planes.
---

## El Problema que AIDF Resuelve

Los asistentes de IA son poderosos pero ciegos al contexto. No conocen:

- La arquitectura de tu proyecto
- Tus convenciones de código
- Tu estructura de archivos
- Qué deberían y qué no deberían tocar
- Cuándo una tarea está realmente "hecha"

Esto genera:

- Código inconsistente que no sigue tus patrones
- Cambios en lugares que no deberían modificarse
- Un "hecho" que requiere revisión humana extensa
- Explicaciones repetidas del mismo contexto

AIDF resuelve esto proporcionando **contexto estructurado** que viaja con tu proyecto.

---

## Componentes Principales

### 1. AGENTS.md - El Contexto Maestro

Es la fuente única de verdad sobre tu proyecto para los asistentes de IA. Contiene:

```markdown
# Project Context

## Overview
What this project is and does.

## Architecture
How the code is organized.

## Conventions
Coding standards, naming patterns, file structures.

## Technology Stack
Languages, frameworks, tools.

## Quality Standards
Testing requirements, linting rules, type safety.

## What NOT to Do
Explicit boundaries and restrictions.
```

**Idea clave**: Escribe AGENTS.md como si estuvieras incorporando a un nuevo desarrollador que trabajará de forma autónoma.

### 2. Roles - Personas Especializadas

En lugar de asistencia genérica de IA, AIDF define roles con experiencia específica:

| Rol | Enfoque | Tareas de Ejemplo |
|-----|---------|-------------------|
| Architect | Diseño de sistemas, patrones | Diseñar nueva funcionalidad, planificar refactorización |
| Developer | Implementación | Construir componente, corregir bug |
| Tester | Aseguramiento de calidad | Escribir tests, mejorar cobertura |
| Reviewer | Calidad de código | Revisar PR, sugerir mejoras |
| Documenter | Documentación | Escribir docs, agregar comentarios |

Cada rol tiene:

- **Experiencia**: Lo que conoce en profundidad
- **Responsabilidades**: Lo que hace
- **Restricciones**: Lo que evita
- **Criterios de calidad**: Cómo juzgar su trabajo

### 3. Tareas - Prompts Ejecutables

Las tareas son prompts estructurados que contienen todo lo necesario para su ejecución:

```markdown
# TASK

## Goal
One clear sentence.

## Task Type
component | refactor | test | docs | architecture

## Suggested Roles
- developer
- tester

## Scope
### Allowed
- src/components/Button/**

### Forbidden
- src/core/**
- Any configuration files

## Requirements
Detailed specifications...

## Definition of Done
- [ ] Verifiable criterion 1
- [ ] Verifiable criterion 2
- [ ] `npm test` passes
```

### 4. Planes - Iniciativas Multi-Tarea

Para trabajos más grandes, los planes agrupan tareas relacionadas:

```
plans/
└── new-auth-system/
    ├── README.md           # Overview and sequencing
    └── tasks/
        ├── 001-design-schema.md
        ├── 002-implement-api.md
        ├── 003-build-ui.md
        └── 004-write-tests.md
```

---

## El Modelo de Ejecución

```
┌─────────────────────────────────────────────────────────┐
│                     AGENTS.md                           │
│              (Contexto del proyecto)                    │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    Definición de Rol                     │
│          (Conocimiento especializado + restricciones)    │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   Definición de Tarea                    │
│       (Objetivo específico + alcance + criterios)       │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                     Ejecución IA                        │
│              (Sigue las tres capas)                     │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                      Validación                         │
│          (Verificación de Definición de Hecho)          │
└─────────────────────────────────────────────────────────┘
```

---

## Capas de Contexto

AIDF utiliza **contexto por capas** donde cada capa añade especificidad:

### Capa 1: Contexto del Proyecto (AGENTS.md)

- Se aplica siempre
- Define reglas globales
- Establece convenciones base

### Capa 2: Contexto del Rol (roles/*.md)

- Se aplica cuando el rol está activado
- Añade conocimiento especializado
- Enfoca el alcance

### Capa 3: Contexto de la Tarea (tasks/*.md)

- Se aplica a una tarea específica
- Define el alcance exacto
- Establece criterios de completitud

**Ejemplo de flujo**:

```
AGENTS.md dice: "Use TypeScript strict mode"
     +
roles/tester.md dice: "Always test accessibility"
     +
tasks/add-button.md dice: "Only modify src/atoms/Button/"
     =
La IA sabe exactamente qué hacer, cómo hacerlo y dónde hacerlo
```

---

## Control de Alcance

Una de las características más importantes de AIDF es el **alcance explícito**:

```markdown
## Scope

### Allowed
- src/components/NewFeature/**
- src/utils/helpers.ts

### Forbidden
- src/core/**
- Any *.config.* files
- package.json
```

Esto previene:

- Cambios accidentales en código crítico
- Expansión del alcance más allá de la tarea
- "Mejoras" bienintencionadas en otros lugares

**Regla**: Si no está en Allowed, está prohibido por defecto.

---

## Definición de Hecho

Cada tarea debe tener criterios de completitud verificables:

### Malo (Vago)

```markdown
## Definition of Done
- Component works correctly
- Code is clean
```

### Bueno (Verificable)

```markdown
## Definition of Done
- [ ] Component renders without errors
- [ ] All props are typed (no `any`)
- [ ] Unit tests cover: render, props, events
- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] Storybook story exists with all variants
```

La IA debería poder verificar cada criterio de forma programática o mediante observación clara.

---

## Próximos Pasos

- [Guía de Configuración](/aidf/es/docs/setup/) - Integra AIDF en tu proyecto
- [Escribir AGENTS.md](/aidf/es/docs/agents-file/) - Crea tu documento de contexto
- [Definir Roles](/aidf/es/docs/roles/) - Configura personas especializadas
