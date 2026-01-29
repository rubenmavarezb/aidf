---
title: Preguntas Frecuentes
description: Preguntas frecuentes sobre AIDF — qué es, cómo funciona, configuración, arquitectura y solución de problemas.
---

## General

### ¿Qué es AIDF?

AIDF (AI-Integrated Development Framework) es dos cosas:

1. **Un framework de documentación** — Plantillas Markdown y convenciones que dan a los agentes de IA contexto estructurado sobre tu proyecto (arquitectura, roles, tareas, planes).
2. **Una herramienta CLI** (`aidf`) — Automatiza la ejecución de tareas con control de alcance, validación, auto-commit y notificaciones.

Puedes usar el framework de documentación por sí solo (solo la carpeta `.ai/` con archivos markdown) o combinarlo con el CLI para automatización completa.

### ¿Qué problema resuelve AIDF?

Cuando usas agentes de IA (Claude, Cursor, etc.) en un proyecto real, te encuentras con problemas recurrentes:

- **Sin contexto compartido** — La IA no conoce tus convenciones, arquitectura ni límites. Repites lo mismo en cada sesión.
- **Sin control de alcance** — La IA puede modificar archivos que no debería tocar, rompiendo partes no relacionadas del código.
- **Sin validación** — No hay verificación automática de que el resultado de la IA pase linting, tipado o tests antes de hacer commit.
- **Sin trazabilidad** — El trabajo de los agentes de IA no se rastrea. No hay registro de qué se intentó, qué funcionó y qué se bloqueó.
- **Sin descomposición de tareas** — El trabajo complejo necesita dividirse en unidades con alcance definido. Sin estructura, las sesiones con IA son dispersas.

AIDF resuelve todo esto proporcionando contexto persistente del proyecto, tareas con alcance definido, validación automatizada y un ciclo de ejecución estructurado.

### ¿En qué se diferencia AIDF de usar Claude o Cursor directamente?

Usar Claude o Cursor directamente es como contratar a alguien sin darle un brief del proyecto — es hábil pero no conoce tus convenciones, límites ni qué significa "terminado".

AIDF agrega la estructura que falta:

| Sin AIDF | Con AIDF |
|---|---|
| La IA empieza de cero cada sesión | La IA lee AGENTS.md, roles y definiciones de tareas |
| La IA puede editar cualquier archivo | ScopeGuard restringe cambios a rutas permitidas |
| Verificas lint/tests manualmente | La validación se ejecuta automáticamente después de cada iteración |
| Sin registro del trabajo de la IA | Los archivos de tarea rastrean el estado (COMPLETED/BLOCKED/FAILED) |
| Supervisas a la IA | El CLI ejecuta un ciclo de ejecución autónomo |

### ¿Necesito usar las cinco capas de contexto?

No. Las capas son aditivas:

- **Configuración mínima viable**: Solo un archivo `AGENTS.md`. Esto por sí solo le da a cualquier agente de IA contexto útil sobre tu proyecto.
- **Agrega roles** cuando quieras comportamiento especializado (ej: un "tester" que se enfoque en cobertura).
- **Agrega tareas** cuando quieras unidades de trabajo con alcance definido y criterios claros de completitud.
- **Agrega skills** cuando quieras capacidades portátiles y reutilizables entre proyectos.
- **Agrega planes** cuando necesites coordinar múltiples tareas relacionadas.

Empieza con poco y agrega capas según tus necesidades.

---

## Arquitectura

### ¿Cuáles son las 5 capas de contexto?

1. **AGENTS.md** — Fuente de verdad del proyecto (arquitectura, convenciones, límites)
2. **Roles** — Personas de IA especializadas (architect, developer, tester, reviewer, documenter)
3. **Skills** — Capacidades portátiles siguiendo el estándar [agentskills.io](https://agentskills.io)
4. **Tasks** — Prompts ejecutables con alcance definido, objetivo, rutas permitidas/prohibidas y Definición de Hecho
5. **Plans** — Iniciativas multi-tarea que agrupan trabajo relacionado

Cada capa agrega especificidad. AGENTS.md establece la base, un rol enfoca el trabajo, y una tarea define exactamente qué hacer y dónde.

### ¿Cómo funciona el ciclo de ejecución?

Cuando ejecutas `aidf run`, el CLI:

1. Carga el contexto de la carpeta `.ai/` (AGENTS.md + rol + tarea + skills)
2. Construye un prompt con todo el contexto
3. Lo envía al proveedor de IA configurado
4. Verifica los cambios de archivos contra las reglas de alcance (ScopeGuard)
5. Ejecuta los comandos de validación (lint, typecheck, tests)
6. Hace auto-commit si está habilitado
7. Detecta señales de completitud o bloqueo
8. Repite hasta que la tarea termine o se alcance el límite de iteraciones

### ¿Qué proveedores son compatibles?

| Proveedor | Cómo funciona | Seguimiento de tokens |
|---|---|---|
| `claude-cli` | Ejecuta subproceso `claude --print` | No |
| `cursor-cli` | Ejecuta subproceso `agent --print` | No |
| `anthropic-api` | API directa de Anthropic con tool calling | Sí |
| `openai-api` | API directa de OpenAI con tool calling | Sí |

Los proveedores CLI (`claude-cli`, `cursor-cli`) transmiten stdout desde un subproceso. Los proveedores API (`anthropic-api`, `openai-api`) usan tool calling con herramientas integradas de operación de archivos.

### ¿Qué hace el control de alcance?

Cada tarea define rutas de archivos permitidas y prohibidas. El ScopeGuard valida cada cambio de archivo contra estas reglas. Hay tres modos disponibles:

- **strict** — Rechaza cualquier cambio fuera de alcance inmediatamente
- **ask** — Pide aprobación al usuario para cambios fuera de alcance
- **permissive** — Permite todos los cambios pero registra advertencias

Esto evita que la IA haga cambios bienintencionados pero no deseados fuera de los límites de la tarea.

---

## Configuración y uso

### ¿Cómo instalo AIDF?

```bash
npm install -g aidf
```

Luego inicializa tu proyecto:

```bash
cd tu-proyecto
aidf init
```

Esto crea la carpeta `.ai/` con plantillas para AGENTS.md, roles, tareas y configuración.

### ¿Cómo configuro AIDF?

Edita `.ai/config.yml` en la raíz de tu proyecto:

```yaml
version: 1
provider:
  type: claude-cli     # claude-cli | cursor-cli | anthropic-api | openai-api
execution:
  max_iterations: 50
  max_consecutive_failures: 3
  timeout_per_iteration: 300
permissions:
  scope_enforcement: strict  # strict | ask | permissive
  auto_commit: true
validation:
  pre_commit: [pnpm lint, pnpm typecheck]
  pre_push: [pnpm test]
```

### ¿Cómo ejecuto una tarea?

```bash
aidf run --task tasks/mi-tarea.md
```

El CLI carga todo el contexto, ejecuta la tarea a través del proveedor configurado, valida el resultado y opcionalmente hace commit del resultado.

### ¿Puedo ejecutar múltiples tareas en paralelo?

Sí. El `ParallelExecutor` detecta dependencias de alcance entre tareas. Las tareas con alcances que no se superponen se ejecutan concurrentemente; las tareas con alcances en conflicto se serializan automáticamente.

---

## Skills

### ¿Qué son los skills?

Los skills son capacidades portátiles y componibles que siguen el estándar [agentskills.io](https://agentskills.io). Cada skill es un archivo `SKILL.md` con frontmatter YAML (name, description, version, tags) e instrucciones en markdown.

### ¿De dónde se descubren los skills?

El `SkillLoader` escanea tres ubicaciones:

1. **Skills del proyecto** — `.ai/skills/` en tu proyecto
2. **Skills globales** — Un directorio global compartido
3. **Directorios de configuración** — Rutas extra definidas en `.ai/config.yml` bajo `skills.directories`

### ¿Puedo desactivar los skills?

Sí. Configura `skills.enabled: false` en `.ai/config.yml`.

---

## Solución de problemas

### Mi tarea no se completó. ¿Por qué?

Razones comunes:

- **Límite de iteraciones alcanzado** — Aumenta `max_iterations` en config.yml
- **Fallos consecutivos** — La IA alcanzó el umbral de fallos. Revisa los errores de validación en la sección de estado de la tarea.
- **Bloqueado** — La IA detectó que no podía continuar y señaló `<TASK_BLOCKED>`. La razón se escribe en el archivo de tarea.
- **Timeout** — Una iteración excedió `timeout_per_iteration`.

Revisa el archivo `.md` de la tarea — el executor escribe una sección `## Status` con logs de ejecución.

### ¿Cómo depuro violaciones de alcance?

Ejecuta con `scope_enforcement: ask` en lugar de `strict`. Esto te permite ver exactamente qué archivos intentó modificar la IA fuera del alcance de la tarea, y aprobar o rechazar cada uno.

### La IA sigue haciendo cambios que no quiero

1. Haz tu `AGENTS.md` más específico sobre convenciones y límites
2. Agrega rutas `### Forbidden` explícitas en el alcance de la tarea
3. Usa el modo de control de alcance `strict`
4. Agrega ítems más específicos a la Definición de Hecho de la tarea
