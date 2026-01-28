# TASK: 031 - Mejorar Sección Commands con Contexto de Uso

## Goal

Refactorizar la sección Commands de AGENTS.template.md para incluir contexto de cuándo ejecutar cada comando, ejemplos de uso, y notas sobre errores comunes.

## Task Type

docs

## Suggested Roles

- documenter
- developer

## Scope

### Allowed

- `templates/.ai/AGENTS.template.md`
- `examples/nextjs-app/.ai/AGENTS.md`
- `examples/node-api/.ai/AGENTS.md`
- `examples/react-library/.ai/AGENTS.md`

### Forbidden

- `templates/.ai/roles/*`
- `templates/.ai/templates/*`

## Requirements

### Nuevo Formato de Commands

Cambiar de tabla simple a formato expandido:

```markdown
## Commands

IMPORTANT: Always use these exact commands. Do not guess or improvise.

### Development

| Command | When to Run | Notes |
|---------|-------------|-------|
| `pnpm install` | After clone, after package.json changes | Run from project root |
| `pnpm dev` | To start dev server | Runs on port 3000 by default |

### Quality Checks

| Command | When to Run | Expected Output |
|---------|-------------|-----------------|
| `pnpm lint` | Before ANY commit, after code changes | Zero errors, zero warnings |
| `pnpm typecheck` | Before ANY commit, after .ts/.tsx changes | Zero errors |
| `pnpm test` | Before marking task complete | All tests pass |

### Build & Deploy

| Command | When to Run | Notes |
|---------|-------------|-------|
| `pnpm build` | Before deploy, to verify production build | Must complete without errors |
```

### Agregar Sección: Command Troubleshooting

```markdown
### Common Issues

| Error | Cause | Solution |
|-------|-------|----------|
| `Module not found` | Dependencies not installed | Run `pnpm install` |
| `Type errors` | TypeScript version mismatch | Check tsconfig.json |
| `Port in use` | Another process using port | Kill process or change port |
```

### Agregar Sección: Command Chaining

```markdown
### Command Sequences

For common workflows, use these sequences:

**After pulling changes:**
```bash
pnpm install && pnpm typecheck && pnpm test
```

**Before committing:**
```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

**Quick verification:**
```bash
pnpm lint && pnpm test
```
```

### Actualizar Examples

Actualizar los AGENTS.md en `examples/` para usar el nuevo formato con comandos reales.

## Definition of Done

- [ ] AGENTS.template.md Commands tiene columna "When to Run"
- [ ] Commands dividido en categorías (Development, Quality, Build)
- [ ] Cada comando tiene contexto de cuándo usarlo
- [ ] Existe sección "Common Issues" con troubleshooting
- [ ] Existe sección "Command Sequences" para workflows
- [ ] examples/nextjs-app tiene comandos reales con nuevo formato
- [ ] examples/node-api tiene comandos reales con nuevo formato
- [ ] examples/react-library tiene comandos reales con nuevo formato
- [ ] IMPORTANT aparece al inicio de la sección

## Notes

- Inspirado en cómo Claude Code documenta comandos de git
- Los comandos deben ser copy-paste ready
- El troubleshooting previene errores comunes de la IA

## Status: ✅ COMPLETED

- **Completed:** 2026-01-28
- **Agent:** Claude Code (parallel session)
- **PR:** #2
