# PLAN: AIDF CLI - Roadmap

## Fase 1: MVP ✅ COMPLETADA

| Task | Status | Fecha |
|------|--------|-------|
| 001-setup-monorepo | ✅ | 2026-01-27 |
| 002-context-loader | ✅ | 2026-01-27 |
| 003-safety-layer | ✅ | 2026-01-27 |
| 004-validator | ✅ | 2026-01-27 |
| 005-provider-claude-cli | ✅ | 2026-01-27 |
| 006-provider-api-direct | ✅ | 2026-01-27 |
| 007-executor-loop | ✅ | 2026-01-27 |
| 008-command-run | ✅ | 2026-01-27 |
| 009-command-init | ✅ | 2026-01-27 |
| 010-command-task | ✅ | 2026-01-27 |

**Total tests:** 244 passing

---

## Fase 2: Polish & Release ✅ COMPLETADA

| Task | Auto-Mode | Dependencias | Prioridad | Status |
|------|-----------|--------------|-----------|--------|
| 011-ci-cd-github-actions | ✅ SÍ | ninguna | Alta | ✅ Done |
| 012-publish-npm | ⚠️ MANUAL | 011 | Alta | ✅ Done |
| 013-improve-readme | ✅ SÍ | ninguna | Alta | ✅ Done |
| 014-more-templates | ✅ SÍ | ninguna | Media | ✅ Done |

---

## Fase 3: Features ✅ COMPLETADA

| Task | Auto-Mode | Dependencias | Prioridad | Status |
|------|-----------|--------------|-----------|--------|
| 015-command-status | ✅ SÍ | ninguna | Alta | ✅ Done |
| 016-command-watch | ⚠️ PARCIAL | ninguna | Media | ✅ Done |
| 017-resume-blocked | ✅ SÍ | ninguna | Alta | ✅ Done |
| 018-parallel-tasks | ⚠️ PARCIAL | ninguna | Media | ✅ Done |

---

## Fase 4: Integraciones ✅ COMPLETADA

| Task | Auto-Mode | Dependencias | Prioridad | Status |
|------|-----------|--------------|-----------|--------|
| 019-vscode-extension | ⚠️ PARCIAL | ninguna | Media | ⛔ Cancelled |
| 020-github-action | ✅ SÍ | 011 | Media | ✅ Done |
| 021-pre-commit-hooks | ✅ SÍ | ninguna | Baja | ✅ Done |

---

## Fase 5: UX Improvements ✅ COMPLETADA

| Task | Auto-Mode | Dependencias | Prioridad | Status |
|------|-----------|--------------|-----------|--------|
| 022-progress-bar | ✅ SÍ | ninguna | Media | ✅ Done |
| 023-structured-logs | ✅ SÍ | ninguna | Baja | ✅ Done |
| 024-notifications | ⚠️ PARCIAL | ninguna | Baja | ✅ Done |

---

## Fase 6: Framework Documentation Enhancement

| Task | Auto-Mode | Dependencias | Prioridad | Status |
|------|-----------|--------------|-----------|--------|
| 025-agents-production-structure | ✅ SÍ | ninguna | Alta | ✅ Done |
| 026-roles-interaction-examples | ✅ SÍ | ninguna | Alta | ✅ Done |
| 027-xml-structured-blocks | ✅ SÍ | ninguna | Media | ✅ Done |
| 028-task-numbered-workflows | ✅ SÍ | ninguna | Media | ✅ Done |
| 029-roles-behavior-rules | ✅ SÍ | ninguna | Alta | ✅ Done |
| 030-quality-gates-enforcement | ✅ SÍ | ninguna | Alta | ✅ Done |
| 031-commands-with-context | ✅ SÍ | ninguna | Media | ✅ Done |
| 032-conventions-with-examples | ✅ SÍ | ninguna | Media | ✅ Done |

---

## Diagrama de Dependencias

```
Fase 2 (Release)
┌─────────────────┐     ┌─────────────────┐
│ 011-ci-cd       │────▶│ 012-publish-npm │
└─────────────────┘     └─────────────────┘
        │
        ▼
┌─────────────────┐
│ 020-github-action│
└─────────────────┘

Fase 3 (Features) - Independientes
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ 015-status      │  │ 016-watch       │  │ 017-resume      │  │ 018-parallel    │
└─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────┘
```

---

## Orden Recomendado

### Sprint 1: Release
1. 011-ci-cd-github-actions
2. 013-improve-readme
3. 012-publish-npm

### Sprint 2: Features Core
4. 015-command-status
5. 017-resume-blocked
6. 014-more-templates

### Sprint 3: Features Avanzadas
7. 016-command-watch
8. 018-parallel-tasks
9. 022-progress-bar

### Sprint 4: Integraciones
10. 020-github-action
11. 019-vscode-extension
12. 021-pre-commit-hooks

### Sprint 5: Polish
13. 023-structured-logs
14. 024-notifications

---

## Checklist de Progreso

### Fase 2: Polish & Release
- [x] 011-ci-cd-github-actions (2026-01-28)
- [x] 012-publish-npm (2026-01-28)
- [x] 013-improve-readme (2026-01-28)
- [x] 014-more-templates (2026-01-28)

### Fase 3: Features
- [x] 015-command-status (2026-01-28)
- [x] 016-command-watch (2026-01-28)
- [x] 017-resume-blocked (2026-01-28)
- [x] 018-parallel-tasks (2026-01-28)

### Fase 4: Integraciones
- [x] ~~019-vscode-extension~~ (Cancelled)
- [x] 020-github-action (2026-01-28)
- [x] 021-pre-commit-hooks (2026-01-28)

### Fase 5: UX
- [x] 022-progress-bar (2026-01-28)
- [x] 023-structured-logs (2026-01-28)
- [x] 024-notifications (2026-01-28)

### Fase 6: Framework Documentation Enhancement
- [x] 025-agents-production-structure (2026-01-28)
- [x] 026-roles-interaction-examples (2026-01-28)
- [x] 027-xml-structured-blocks (2026-01-28)
- [x] 028-task-numbered-workflows (2026-01-28)
- [x] 029-roles-behavior-rules (2026-01-28)
- [x] 030-quality-gates-enforcement (2026-01-28)
- [x] 031-commands-with-context (2026-01-28)
- [x] 032-conventions-with-examples (2026-01-28)
