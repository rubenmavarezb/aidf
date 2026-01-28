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

**Total tests:** 116 passing

---

## Fase 2: Polish & Release

| Task | Auto-Mode | Dependencias | Prioridad |
|------|-----------|--------------|-----------|
| 011-ci-cd-github-actions | ✅ SÍ | ninguna | Alta |
| 012-publish-npm | ⚠️ MANUAL | 011 | Alta |
| 013-improve-readme | ✅ SÍ | ninguna | Alta |
| 014-more-templates | ✅ SÍ | ninguna | Media |

---

## Fase 3: Features

| Task | Auto-Mode | Dependencias | Prioridad |
|------|-----------|--------------|-----------|
| 015-command-status | ✅ SÍ | ninguna | Alta |
| 016-command-watch | ⚠️ PARCIAL | ninguna | Media |
| 017-resume-blocked | ✅ SÍ | ninguna | Alta |
| 018-parallel-tasks | ⚠️ PARCIAL | ninguna | Media |

---

## Fase 4: Integraciones

| Task | Auto-Mode | Dependencias | Prioridad |
|------|-----------|--------------|-----------|
| 019-vscode-extension | ⚠️ PARCIAL | ninguna | Media |
| 020-github-action | ✅ SÍ | 011 | Media |
| 021-pre-commit-hooks | ✅ SÍ | ninguna | Baja |

---

## Fase 5: UX Improvements

| Task | Auto-Mode | Dependencias | Prioridad |
|------|-----------|--------------|-----------|
| 022-progress-bar | ✅ SÍ | ninguna | Media |
| 023-structured-logs | ✅ SÍ | ninguna | Baja |
| 024-notifications | ⚠️ PARCIAL | ninguna | Baja |

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
- [ ] 011-ci-cd-github-actions
- [ ] 012-publish-npm
- [ ] 013-improve-readme
- [ ] 014-more-templates

### Fase 3: Features
- [ ] 015-command-status
- [ ] 016-command-watch
- [ ] 017-resume-blocked
- [ ] 018-parallel-tasks

### Fase 4: Integraciones
- [ ] 019-vscode-extension
- [ ] 020-github-action
- [ ] 021-pre-commit-hooks

### Fase 5: UX
- [ ] 022-progress-bar
- [ ] 023-structured-logs
- [ ] 024-notifications
