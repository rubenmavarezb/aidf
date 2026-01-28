# TASK: 032 - Mejorar Conventions con Ejemplos Correctos/Incorrectos

## Goal

Expandir la sección Conventions de AGENTS.template.md para incluir ejemplos de código correctos e incorrectos, con explicaciones de por qué cada patrón es preferido.

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

### Formato de Ejemplos Correctos/Incorrectos

```markdown
## Conventions

IMPORTANT: Match these patterns EXACTLY when writing new code.

### File Naming

| Type | Pattern | Example | Wrong |
|------|---------|---------|-------|
| Components | PascalCase | `UserCard.tsx` | `userCard.tsx`, `user-card.tsx` |
| Hooks | camelCase + use | `useAuth.ts` | `UseAuth.ts`, `auth.hook.ts` |
| Utils | camelCase | `formatDate.ts` | `format-date.ts`, `FormatDate.ts` |

### Code Patterns

#### Components

```typescript
// ✅ CORRECT - Named export, function declaration
export function UserCard({ name, email }: UserCardProps) {
  return <div>...</div>;
}

// ❌ WRONG - Default export
export default function UserCard() { ... }

// ❌ WRONG - Arrow function with FC
const UserCard: FC<Props> = () => { ... }
```

Why: Named exports enable better tree-shaking and IDE support.

#### Imports

```typescript
// ✅ CORRECT - Ordered imports
import { useState, useEffect } from 'react';     // 1. External
import { Button } from '@/components/ui';        // 2. Internal absolute
import { formatDate } from '../utils';           // 3. Relative
import styles from './Component.module.css';     // 4. Styles/assets

// ❌ WRONG - Mixed order, no grouping
import styles from './styles';
import { formatDate } from '../utils';
import { useState } from 'react';
import { Button } from '@/components/ui';
```

Why: Consistent import order makes files scannable and prevents merge conflicts.
```

### Secciones de Patterns a Cubrir

1. **File Naming** - Convenciones de nombres por tipo
2. **Component Structure** - Cómo estructurar componentes
3. **Import Order** - Orden de imports
4. **Type Definitions** - Dónde y cómo definir tipos
5. **Error Handling** - Patrones de manejo de errores
6. **Async Patterns** - async/await vs promises
7. **State Management** - Patrones de estado (si aplica)

### Formato de "Why"

Cada patrón debe incluir una línea de justificación:

```markdown
Why: [Una oración explicando el beneficio del patrón]
```

### Actualizar Examples

Los ejemplos en `examples/` deben tener patrones reales con código:

- `nextjs-app`: React/Next.js patterns
- `node-api`: Express/Node patterns
- `react-library`: Library patterns

## Definition of Done

- [ ] AGENTS.template.md Conventions tiene ejemplos ✅/❌
- [ ] Cada patrón tiene versión correcta e incorrecta
- [ ] Cada patrón tiene línea "Why:" con justificación
- [ ] File Naming tiene tabla con Pattern/Example/Wrong
- [ ] Mínimo 5 categorías de patterns cubiertas
- [ ] examples/nextjs-app tiene patterns React reales
- [ ] examples/node-api tiene patterns Node reales
- [ ] examples/react-library tiene patterns library reales
- [ ] IMPORTANT aparece al inicio de Conventions
- [ ] Código usa syntax highlighting correcto

## Notes

- Inspirado en ejemplos de código de Claude Code system prompt
- Los ejemplos deben ser copiables directamente
- El "Why" ayuda a la IA a entender, no solo memorizar
- Mantener ejemplos cortos (máximo 10 líneas por bloque)

## Status: ✅ COMPLETED

- **Completed:** 2026-01-28
- **Agent:** Claude Code (parallel session)
- **PR:** #2
