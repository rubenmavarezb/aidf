---
title: Agent Skills
description: Consume definiciones portables de skills del ecosistema agentskills.io, comparte skills entre proyectos y publica los tuyos.
---

AIDF integra el estandar [Agent Skills](https://agentskills.io), permitiendote consumir definiciones portables de skills del ecosistema y publicar las tuyas propias.

Los skills son archivos SKILL.md autocontenidos que proporcionan instrucciones, experiencia y restricciones a la IA durante la ejecucion de tareas. Se inyectan en el prompt como contexto adicional junto con el rol y la tarea.

---

## Por que Skills?

### Sin Skills

```
Tu agente de IA solo sabe lo que esta en AGENTS.md + rol + tarea.
Agregar nueva experiencia significa editar roles o escribir descripciones de tareas mas largas.
```

### Con Skills

```
Drop a SKILL.md into .ai/skills/ and the AI gains new capabilities instantly.
Share skills across projects. Use skills published by the community.
```

Los skills proporcionan:

- **Portabilidad**: El mismo skill funciona en cualquier agente que soporte el estandar (34+ agentes compatibles)
- **Composabilidad**: Combina multiples skills para una sola ejecucion de tarea
- **Separacion**: Los skills estan separados de los roles — los roles definen _quien_, los skills definen _que_ puede hacer la IA
- **Ecosistema**: Consume skills de la comunidad o publica los tuyos propios

---

## Formato SKILL.md

Cada skill es un directorio que contiene un archivo `SKILL.md` con frontmatter YAML y contenido en markdown:

```
.ai/skills/
  └── my-skill/
      └── SKILL.md
```

### Estructura

```markdown
---
name: my-skill
description: A brief description of what this skill does
version: 1.0.0
author: Your Name
tags: tag1, tag2, tag3
globs: src/**/*.ts, tests/**
---

# My Skill

## Instructions

Detailed instructions for the AI when this skill is active.

## When to Use

Describe when this skill should be activated.

## Behavior Rules

### ALWAYS
- Rule 1
- Rule 2

### NEVER
- Rule 1
- Rule 2
```

### Campos del Frontmatter

| Campo | Requerido | Descripcion |
|-------|-----------|-------------|
| `name` | Si | Identificador unico del skill |
| `description` | Si | Descripcion breve (mostrada en `aidf skills list`) |
| `version` | No | Version semantica |
| `author` | No | Autor del skill |
| `tags` | No | Etiquetas separadas por comas para categorizacion |
| `globs` | No | Patrones de archivos separados por comas relacionados con el skill |

---

## Descubrimiento de Skills

AIDF descubre skills desde tres ubicaciones, en orden:

| Prioridad | Ubicacion | Etiqueta de origen | Descripcion |
|-----------|-----------|-------------------|-------------|
| 1 | `.ai/skills/` | `project` | Skills especificos del proyecto |
| 2 | `~/.aidf/skills/` | `global` | Skills del usuario compartidos entre proyectos |
| 3 | Directorios de configuracion | `config` | Rutas adicionales definidas en `config.yml` |

Todos los skills descubiertos se cargan e inyectan automaticamente en el prompt de ejecucion.

---

## Configuracion

Agrega la seccion `skills` a `.ai/config.yml`:

```yaml
skills:
  enabled: true              # default: true (omit section to enable)
  directories:               # additional directories to scan for skills
    - /path/to/shared/skills
    - ../other-project/.ai/skills
```

Para deshabilitar los skills completamente:

```yaml
skills:
  enabled: false
```

Si se omite la seccion `skills`, los skills estan habilitados por defecto y AIDF escaneara los directorios estandar (`.ai/skills/` y `~/.aidf/skills/`).

---

## Comandos CLI

### Listar skills

```bash
aidf skills list
```

Muestra todos los skills descubiertos con su origen (project/global/config), descripcion y etiquetas.

### Crear un nuevo skill

```bash
aidf skills init my-skill           # creates .ai/skills/my-skill/SKILL.md
aidf skills init my-skill --global  # creates ~/.aidf/skills/my-skill/SKILL.md
```

Genera una plantilla SKILL.md lista para editar.

### Validar skills

```bash
aidf skills validate              # validate all discovered skills
aidf skills validate my-skill     # validate a specific skill by name
```

Verifica los campos del frontmatter, la estructura del contenido y reporta errores.

### Agregar un skill externo

```bash
aidf skills add /path/to/skill-directory
```

Copia un skill en el directorio `.ai/skills/` del proyecto despues de validarlo.

---

## Como se Inyectan los Skills

Durante la ejecucion, los skills se inyectan en el prompt como XML siguiendo el formato de agentskills.io:

```xml
<available_skills>
<skill name="my-skill">
<description>A brief description</description>
<tags>tag1, tag2</tags>
<instructions>
# My Skill
...full markdown content...
</instructions>
</skill>
</available_skills>
```

Este bloque XML se coloca en el prompt despues de la seccion del Plan de Implementacion y antes de las Instrucciones de Ejecucion.

---

## Skills Integrados

AIDF incluye 6 skills integrados que reflejan los roles integrados:

| Skill | Descripcion |
|-------|-------------|
| `aidf-architect` | Diseno de sistemas, patrones, analisis de trade-offs |
| `aidf-developer` | Implementacion de codigo limpio, coincidencia de patrones |
| `aidf-tester` | Cobertura de pruebas, casos limite, fiabilidad |
| `aidf-reviewer` | Revision de codigo, calidad, retroalimentacion constructiva |
| `aidf-documenter` | Escritura tecnica, documentacion de APIs, guias |
| `aidf-task-templates` | Plantillas de tareas estructuradas para los 6 tipos de tareas |

Estos se incluyen en el directorio `templates/.ai/skills/` y se copian a tu proyecto cuando ejecutas `aidf init`.

---

## Ejemplos

### Agregar un skill personalizado

```bash
# Create the skill
aidf skills init eslint-expert

# Edit the SKILL.md
# Then validate it
aidf skills validate eslint-expert
```

### Compartir skills globalmente

```bash
# Create a global skill available in all projects
aidf skills init code-security --global

# It lives at ~/.aidf/skills/code-security/SKILL.md
```

### Usar directorios adicionales

Si tu equipo mantiene un repositorio compartido de skills:

```yaml
# .ai/config.yml
skills:
  directories:
    - ../shared-aidf-skills
```

### Deshabilitar skills para una ejecucion

Los skills se cargan automaticamente cuando estan disponibles. Para deshabilitar:

```yaml
# .ai/config.yml
skills:
  enabled: false
```
