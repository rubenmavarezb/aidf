# PLAN: AIDF CLI - Motor de Ejecución Autónomo

## Overview
Implementar el CLI de AIDF que automatiza el flujo de desarrollo con IA, combinando el sistema de contexto de AIDF con la técnica de ejecución en loop de Ralph Wiggum.

## Goals
- CLI funcional con comando `aidf run` como MVP
- Soporte para múltiples providers (Claude CLI, Anthropic API, OpenAI API)
- Scope enforcement para limitar cambios del agent
- Auto-commit y documentación de estados bloqueados

## Non-Goals
- IDE plugins (VS Code, JetBrains) - fase futura
- GitHub Actions integration - fase futura
- Dashboard web - fase futura

---

## Ejecución de Tasks

### 🔵 Fase 1: Setup (Puede ejecutarse primero, solo)

| Task | Auto-Mode | Dependencias | Notas |
|------|-----------|--------------|-------|
| `001-setup-monorepo.md` | ✅ SÍ | ninguna | **EJECUTAR PRIMERO** |

**Comando:**
```bash
# Ejecutar con Cursor en auto-mode o Claude Code
aidf run .ai/tasks/001-setup-monorepo.md
```

---

### 🟢 Fase 2: Core Components (Pueden ejecutarse EN PARALELO)

Después de completar Fase 1, estos 4 tasks son independientes y pueden ejecutarse en paralelo con diferentes agents:

| Task | Auto-Mode | Dependencias | Agent Sugerido |
|------|-----------|--------------|----------------|
| `002-context-loader.md` | ✅ SÍ | 001 | Agent 1 |
| `003-safety-layer.md` | ✅ SÍ | 001 | Agent 2 |
| `004-validator.md` | ✅ SÍ | 001 | Agent 3 |
| `005-provider-claude-cli.md` | ⚠️ PARCIAL | 001 | Agent 4 (manual testing) |

**Comandos para ejecución paralela:**
```bash
# Terminal 1
aidf run .ai/tasks/002-context-loader.md

# Terminal 2
aidf run .ai/tasks/003-safety-layer.md

# Terminal 3
aidf run .ai/tasks/004-validator.md

# Terminal 4 (requiere testing manual con Claude CLI)
aidf run .ai/tasks/005-provider-claude-cli.md
```

---

### 🟡 Fase 3: API Providers (Puede ejecutarse en paralelo con Fase 2)

| Task | Auto-Mode | Dependencias | Notas |
|------|-----------|--------------|-------|
| `006-provider-api-direct.md` | ✅ SÍ | 001, 005 (types) | Puede empezar cuando 005 define types |

---

### 🔴 Fase 4: Executor (Requiere Fase 2 completa)

| Task | Auto-Mode | Dependencias | Notas |
|------|-----------|--------------|-------|
| `007-executor-loop.md` | ⚠️ PARCIAL | 002, 003, 004, 005 | **CRÍTICO** - Núcleo del MVP |

**Este task integra todos los componentes anteriores. No puede ejecutarse hasta que Fase 2 esté completa.**

---

### 🟣 Fase 5: CLI Commands (Pueden ejecutarse en paralelo después de Fase 4)

| Task | Auto-Mode | Dependencias | Agent Sugerido |
|------|-----------|--------------|----------------|
| `008-command-run.md` | ✅ SÍ | 007 | Agent 1 |
| `009-command-init.md` | ✅ SÍ | 007 | Agent 2 |
| `010-command-task.md` | ✅ SÍ | 007 | Agent 3 |

---

## Diagrama de Dependencias

```
                    ┌─────────────────────┐
                    │ 001-setup-monorepo  │
                    └──────────┬──────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
         ▼                     ▼                     ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ 002-context     │  │ 003-safety      │  │ 004-validator   │
│ loader          │  │ layer           │  │                 │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                     │
         │    ┌───────────────┼───────────────┐    │
         │    │               │               │    │
         │    ▼               │               ▼    │
         │  ┌─────────────────┴─────────────────┐  │
         │  │ 005-provider-claude-cli           │  │
         │  └─────────────────┬─────────────────┘  │
         │                    │                    │
         │                    ▼                    │
         │  ┌─────────────────────────────────────┐│
         │  │ 006-provider-api-direct             ││
         │  └─────────────────┬───────────────────┘│
         │                    │                    │
         └────────────────────┼────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │ 007-executor-loop   │ ← CRÍTICO
                    └──────────┬──────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
         ▼                     ▼                     ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ 008-command-run │  │ 009-command-init│  │ 010-command-task│
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

---

## Resumen de Auto-Mode Compatibility

| Nivel | Tasks | Descripción |
|-------|-------|-------------|
| ✅ **Full Auto** | 001, 002, 003, 004, 006, 008, 009, 010 | Cursor auto-mode funciona sin intervención |
| ⚠️ **Parcial** | 005, 007 | Requiere testing manual o decisiones |

---

## Checklist de Progreso

### Fase 1: Setup
- [x] 001-setup-monorepo ✅ (2026-01-27)

### Fase 2: Core (paralelo)
- [x] 002-context-loader ✅ (2026-01-27, 16 tests)
- [x] 003-safety-layer ✅ (2026-01-27, 16 tests)
- [x] 004-validator ✅ (2026-01-27, 7 tests)
- [x] 005-provider-claude-cli ✅ (2026-01-27, 15 tests)

### Fase 3: Providers
- [x] 006-provider-api-direct ✅ (2026-01-27)

### Fase 4: Executor
- [x] 007-executor-loop ✅ (2026-01-27, 18 tests)

### Fase 5: Commands (paralelo)
- [x] 008-command-run ✅ (2026-01-27)
- [x] 009-command-init ✅ (2026-01-27)
- [x] 010-command-task ✅ (2026-01-27)

---

**Total tests:** 116 passing

---

## Notas de Implementación

1. **Para maximizar paralelismo:** Asigna Fase 2 tasks a 4 agents diferentes simultáneamente
2. **El cuello de botella es 007:** Todo converge en el executor, asegúrate de que Fase 2 esté sólida
3. **Testing de providers:** 005 requiere Claude CLI instalado, 006 requiere API keys
4. **Orden recomendado si solo tienes 1 agent:** 001 → 002 → 003 → 005 → 004 → 006 → 007 → 008 → 009 → 010

---

## Validación Final

Después de completar todos los tasks:

```bash
# 1. Build
cd packages/cli && pnpm build

# 2. Test en proyecto de prueba
mkdir test-project && cd test-project
npm init -y

# 3. Inicializar AIDF
npx @aidf/cli init

# 4. Crear task de prueba
npx @aidf/cli task create

# 5. Ejecutar (dry-run primero)
npx @aidf/cli run --dry-run

# 6. Ejecutar real con límite bajo
npx @aidf/cli run --max-iterations 3 --verbose
```
