---
title: Arquitectura
description: Cómo se comporta un agente de IA al usar AIDF — carga de contexto, ciclo de ejecución, proveedores y ciclo de vida de tareas.
---

Esta página explica cómo se comporta un agente de IA cuando usa AIDF — desde la carga del contexto hasta la resolución de la tarea.

---

## Visión General

Un agente potenciado por AIDF opera en tres fases: **carga de contexto**, **ejecución iterativa** y **resolución de tarea**.

```mermaid
flowchart LR
    A[Cargar Contexto] --> B[Ciclo de Ejecución]
    B --> C[Resolver Tarea]

    style A fill:#e8f4fd,stroke:#2196f3
    style B fill:#fff3e0,stroke:#ff9800
    style C fill:#e8f5e9,stroke:#4caf50
```

---

## Composición del Contexto

Antes de ejecutar cualquier cosa, el agente ensambla un prompt por capas desde la carpeta `.ai/`. Cada capa agrega especificidad:

```mermaid
flowchart TD
    AGENTS["AGENTS.md\n─────────────────\nVisión del proyecto\nArquitectura\nConvenciones\nLímites"]
    ROLE["Definición de Rol\n─────────────────\nExperiencia\nResponsabilidades\nRestricciones\nCriterios de calidad"]
    TASK["Definición de Tarea\n─────────────────\nObjetivo\nRutas permitidas / prohibidas\nRequisitos\nDefinición de Hecho"]
    SKILLS["Skills\n─────────────────\nCapacidades portátiles\nEstándar agentskills.io\nAsociados por glob"]
    PROMPT["Prompt Ensamblado"]

    AGENTS --> PROMPT
    ROLE --> PROMPT
    TASK --> PROMPT
    SKILLS --> PROMPT

    style AGENTS fill:#e3f2fd,stroke:#1565c0
    style ROLE fill:#f3e5f5,stroke:#7b1fa2
    style TASK fill:#fff8e1,stroke:#f9a825
    style SKILLS fill:#e8f5e9,stroke:#2e7d32
    style PROMPT fill:#fce4ec,stroke:#c62828
```

El contexto es aditivo — solo necesitas AGENTS.md como mínimo. Los roles, tareas y skills son capas opcionales.

---

## Ciclo de Ejecución

Este es el comportamiento central. El executor (`core/executor.ts`) ejecuta un ciclo iterativo donde cada iteración pasa por la construcción del prompt, ejecución de la IA, verificación de alcance, validación y commit.

```mermaid
flowchart TD
    START(["aidf run --task tarea.md"]) --> LOAD["Cargar contexto\n(AGENTS.md + rol + tarea + skills)"]
    LOAD --> BUILD["Construir prompt de iteración"]
    BUILD --> EXECUTE["Enviar al proveedor de IA"]

    EXECUTE --> RESPONSE["La IA genera\ncambios de código"]

    RESPONSE --> SCOPE{"ScopeGuard\nverificar archivos"}

    SCOPE -->|"Archivos dentro del alcance"| VALIDATE["Ejecutar validación\n(lint, typecheck, tests)"]
    SCOPE -->|"Fuera de alcance + strict"| REJECT["Rechazar cambios"]
    SCOPE -->|"Fuera de alcance + ask"| ASK["Preguntar al usuario"]

    ASK -->|Aprobado| VALIDATE
    ASK -->|Rechazado| REJECT

    REJECT --> ITER_CHECK

    VALIDATE -->|Pasa| COMMIT["Auto-commit\n(si está habilitado)"]
    VALIDATE -->|Falla| ITER_CHECK

    COMMIT --> COMPLETION{"¿Señal de\ncompletitud?"}

    COMPLETION -->|"TASK_COMPLETE / DONE"| DONE_OK["Actualizar tarea:\nCOMPLETED"]
    COMPLETION -->|"TASK_BLOCKED"| DONE_BLOCKED["Actualizar tarea:\nBLOCKED"]
    COMPLETION -->|"No terminado"| ITER_CHECK{"¿Máximo de\niteraciones?"}

    ITER_CHECK -->|No| BUILD
    ITER_CHECK -->|Sí| DONE_FAIL["Actualizar tarea:\nFAILED"]

    DONE_OK --> END(["Fin"])
    DONE_BLOCKED --> END
    DONE_FAIL --> END

    style START fill:#e3f2fd,stroke:#1565c0
    style EXECUTE fill:#fff3e0,stroke:#ff9800
    style SCOPE fill:#fff8e1,stroke:#f9a825
    style VALIDATE fill:#f3e5f5,stroke:#7b1fa2
    style COMMIT fill:#e8f5e9,stroke:#2e7d32
    style DONE_OK fill:#c8e6c9,stroke:#2e7d32
    style DONE_BLOCKED fill:#ffe0b2,stroke:#e65100
    style DONE_FAIL fill:#ffcdd2,stroke:#c62828
    style END fill:#e3f2fd,stroke:#1565c0
```

### Puntos de decisión clave

- **ScopeGuard** — Valida cada archivo modificado contra las rutas permitidas/prohibidas de la tarea. El comportamiento depende del modo `scope_enforcement` (`strict`, `ask` o `permissive`).
- **Validación** — Ejecuta los comandos listados en `config.yml` bajo `validation.pre_commit` (típicamente lint, typecheck).
- **Detección de completitud** — La IA señala que terminó emitiendo `<TASK_COMPLETE>` o `<DONE>`. Si no puede continuar, emite `<TASK_BLOCKED>` con una razón.
- **Límite de iteraciones** — Previene ejecuciones desbocadas. Configurable vía `execution.max_iterations`.

---

## Arquitectura de Proveedores

AIDF soporta cuatro proveedores. Todos implementan la misma interfaz (`execute(prompt, options)`) pero funcionan de forma diferente internamente:

```mermaid
flowchart TD
    EXEC["Executor"] --> FACTORY["Provider Factory\ncreateProvider(type)"]

    FACTORY --> CLI_GROUP["Proveedores CLI"]
    FACTORY --> API_GROUP["Proveedores API"]

    CLI_GROUP --> CLAUDE_CLI["claude-cli\n─────────────\nEjecuta: claude --print\nTransmite stdout\nSin tracking de tokens"]
    CLI_GROUP --> CURSOR_CLI["cursor-cli\n─────────────\nEjecuta: agent --print\nTransmite stdout\nSin tracking de tokens"]

    API_GROUP --> ANTHROPIC["anthropic-api\n─────────────\nAnthropic SDK\nTool calling\nCon tracking de tokens"]
    API_GROUP --> OPENAI["openai-api\n─────────────\nOpenAI SDK\nTool calling\nCon tracking de tokens"]

    ANTHROPIC --> TOOLS["Herramientas integradas\n─────────────\nread_file\nwrite_file\nlist_files\nrun_command\ntask_complete\ntask_blocked"]
    OPENAI --> TOOLS

    style EXEC fill:#e3f2fd,stroke:#1565c0
    style FACTORY fill:#f3e5f5,stroke:#7b1fa2
    style CLI_GROUP fill:#fff8e1,stroke:#f9a825
    style API_GROUP fill:#e8f5e9,stroke:#2e7d32
    style TOOLS fill:#fce4ec,stroke:#c62828
```

**Los proveedores CLI** delegan todas las operaciones de archivos al tooling propio de la IA (Claude Code o Cursor). El executor solo ve el output final y los cambios de archivos en disco.

**Los proveedores API** usan tool calling — la IA solicita operaciones de archivos (leer, escribir, listar, ejecutar comandos) a través de una interfaz estructurada de herramientas definida en `providers/tool-handler.ts`.

---

## Ejecución Paralela

Al ejecutar múltiples tareas, el `ParallelExecutor` analiza la superposición de alcances para determinar cuáles pueden ejecutarse concurrentemente:

```mermaid
flowchart TD
    TASKS["Múltiples tareas"] --> ANALYZE["Analizar superposición\nde alcances"]

    ANALYZE --> INDEPENDENT["Sin superposición\n→ Ejecutar en paralelo"]
    ANALYZE --> CONFLICT["Conflicto de alcance\n→ Serializar"]

    INDEPENDENT --> T1["Tarea A\nsrc/auth/**"]
    INDEPENDENT --> T2["Tarea B\nsrc/ui/**"]

    CONFLICT --> T3["Tarea C\nsrc/core/**"]
    T3 --> T4["Tarea D\nsrc/core/utils/**"]

    T1 --> MERGE["Recopilar resultados"]
    T2 --> MERGE
    T4 --> MERGE

    style TASKS fill:#e3f2fd,stroke:#1565c0
    style ANALYZE fill:#fff8e1,stroke:#f9a825
    style INDEPENDENT fill:#e8f5e9,stroke:#2e7d32
    style CONFLICT fill:#ffcdd2,stroke:#c62828
```

Las tareas que tocan archivos diferentes se ejecutan simultáneamente. Las tareas con alcances superpuestos se ejecutan una tras otra para evitar conflictos.

---

## Ciclo de Vida de una Tarea

Un archivo de tarea (`.ai/tasks/*.md`) pasa por estados definidos:

```mermaid
stateDiagram-v2
    [*] --> PENDING : Tarea creada
    PENDING --> IN_PROGRESS : aidf run
    IN_PROGRESS --> COMPLETED : Todos los criterios cumplidos
    IN_PROGRESS --> BLOCKED : IA señala TASK_BLOCKED
    IN_PROGRESS --> FAILED : Máx iteraciones / fallos
    BLOCKED --> IN_PROGRESS : Re-ejecutar tras resolver
    FAILED --> IN_PROGRESS : Re-ejecutar tras corregir
    COMPLETED --> [*]
```

El executor escribe una sección `## Status` en el archivo de tarea con logs de ejecución, archivos modificados y el resultado final.
