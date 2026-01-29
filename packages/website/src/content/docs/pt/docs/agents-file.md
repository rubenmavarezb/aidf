---
title: Escrevendo o AGENTS.md
description: Aprofunde-se na criação do arquivo AGENTS.md — a base do AIDF que transforma um assistente de IA genérico em um membro da equipe com conhecimento.
---

O arquivo `AGENTS.md` é a base do AIDF. É o único documento que transforma um assistente de IA genérico em um membro da equipe com conhecimento.

---

## Filosofia

Escreva o AGENTS.md como se estivesse integrando um desenvolvedor sênior que trabalhará de forma **autônoma**. Ele precisa saber:

- O que o projeto faz
- Como o código é organizado
- Quais padrões seguir
- Quais erros evitar
- Como verificar seu trabalho

---

## Estrutura

### 1. Visão Geral do Projeto

Comece com a visão geral:

```markdown
## Project Overview

[Project Name] is a [type of project] that [primary purpose].

**Key characteristics:**
- [Characteristic 1]
- [Characteristic 2]

**Target users:**
- [User type 1]
- [User type 2]
```

**Exemplo:**

```markdown
## Project Overview

Commerce Kit is a React component library for e-commerce applications.

**Key characteristics:**
- Atomic Design architecture (atoms → molecules → organisms)
- Framework-agnostic (works with Next.js, Remix, Vite)
- Fully typed with TypeScript
- Accessible by default (WCAG 2.1 AA)

**Target users:**
- Frontend developers building e-commerce sites
- Design systems teams
```

### 2. Arquitetura

Descreva como o código é organizado:

```markdown
## Architecture

### Directory Structure

\`\`\`
src/
├── atoms/          # Basic building blocks
├── molecules/      # Composed components
├── organisms/      # Complex features
├── hooks/          # Shared React hooks
├── utils/          # Pure utility functions
└── types/          # Shared TypeScript types
\`\`\`

### Key Patterns

**[Pattern Name]**
[Description of pattern and when to use it]

**[Pattern Name]**
[Description]
```

### 3. Stack Tecnológica

Seja específico sobre versões e configurações:

```markdown
## Technology Stack

| Category | Technology | Version | Notes |
|----------|------------|---------|-------|
| Language | TypeScript | 5.x | Strict mode enabled |
| Framework | React | 18.x | Hooks only, no classes |
| Build | tsup | 8.x | ESM + CJS output |
| Testing | Vitest | 3.x | With Testing Library |
| Styling | CSS | - | Custom properties, BEM-like |
```

### 4. Convenções

Isso é crítico. Seja explícito sobre nomenclatura e estrutura:

```markdown
## Conventions

### File Naming

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `Button.tsx` |
| Styles | kebab-case | `button.css` |
| Tests | PascalCase + .test | `Button.test.tsx` |
| Types | PascalCase + .types | `Button.types.ts` |
| Constants | PascalCase + .constants | `Button.constants.ts` |

### Component Structure

Every component folder contains:

\`\`\`
ComponentName/
├── ComponentName.tsx         # Component implementation
├── ComponentName.types.ts    # TypeScript interfaces
├── ComponentName.constants.ts # Constants and mappings
├── component-name.css        # Styles
├── ComponentName.test.tsx    # Unit tests
└── index.ts                  # Public exports
\`\`\`

### CSS Conventions

- Prefix all classes with `pt-` (project prefix)
- Use BEM-like naming: `.pt-Component__element--modifier`
- Use CSS custom properties for all values
- No hardcoded colors, spacing, or typography
```

### 5. Padrões de Qualidade

Defina o que significa "bom":

```markdown
## Quality Standards

### Testing

- Minimum 80% code coverage
- Every component must test:
  - Default render
  - All props/variants
  - User interactions
  - Accessibility (no a11y violations)
  - Ref forwarding

### Type Safety

- No `any` types (except in tests)
- All props must be typed
- Export types alongside components
- Use `strict: true` in tsconfig

### Code Style

- ESLint must pass with zero warnings
- Prettier formatting required
- No console.log in production code
```

### 6. Limites

Declare explicitamente o que NÃO deve ser feito:

```markdown
## Boundaries

### Never Modify Without Approval

- `package.json` (dependency changes)
- `tsconfig.json` (compiler settings)
- `.github/` (CI/CD workflows)
- `src/core/` (critical shared code)

### Never Do

- Add external UI libraries (Material-UI, Chakra, etc.)
- Use CSS-in-JS (styled-components, emotion)
- Create class components
- Use `any` type in production code
- Commit console.log statements
- Skip writing tests

### Requires Discussion

- New design tokens
- New shared utilities
- Changes to component API
- New dependencies
```

### 7. Referência de Comandos

Liste os comandos que a IA deve usar:

```markdown
## Commands

### Development

\`\`\`bash
pnpm install          # Install dependencies
pnpm dev              # Start dev server
pnpm storybook        # Start Storybook
\`\`\`

### Quality

\`\`\`bash
pnpm lint             # Check code style
pnpm typecheck        # Check types
pnpm test             # Run tests
pnpm quality:fast     # All checks (lint + typecheck + test)
\`\`\`

### Build

\`\`\`bash
pnpm build            # Build for production
pnpm storybook:build  # Build Storybook
\`\`\`
```

---

## Seções Avançadas

### Padrões de API de Componentes

Se você tem padrões específicos para APIs de componentes:

```markdown
## Component API Patterns

### Props Design

1. **Extend HTML attributes**
   \`\`\`typescript
   interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
     variant?: 'primary' | 'secondary';
   }
   \`\`\`

2. **Use discriminated unions for variants**
   \`\`\`typescript
   type ButtonProps =
     | { as?: 'button' } & ButtonHTMLAttributes<HTMLButtonElement>
     | { as: 'a' } & AnchorHTMLAttributes<HTMLAnchorElement>;
   \`\`\`

3. **Always forward refs**
   \`\`\`typescript
   export const Button = forwardRef<HTMLButtonElement, ButtonProps>(...);
   \`\`\`
```

### Tratamento de Erros

```markdown
## Error Handling

- Use Error Boundaries for component errors
- Log errors to [logging service]
- Never swallow errors silently
- Provide user-friendly error messages
```

### Considerações de Performance

```markdown
## Performance

- Memoize expensive computations with useMemo
- Memoize callbacks with useCallback only when passed to memoized children
- Avoid inline object/array creation in render
- Use React.lazy for code splitting at route level
```

---

## Dicas

### Seja Específico, Não Genérico

**Ruim:**
```markdown
Follow best practices for React development.
```

**Bom:**
```markdown
Use functional components with hooks. Never use class components.
Memoize with useMemo only for expensive computations (>10ms).
```

### Inclua Exemplos

**Ruim:**
```markdown
Name files correctly.
```

**Bom:**
```markdown
Name files correctly:
- Component: `UserProfile.tsx`
- Styles: `user-profile.css`
- Test: `UserProfile.test.tsx`
```

### Declare o Óbvio

Se algo é importante, declare explicitamente mesmo que pareça óbvio:

```markdown
### Import Order

1. React imports
2. External libraries
3. Internal absolute imports
4. Relative imports
5. Style imports

Always leave a blank line between groups.
```

---

## Manutenção

O AGENTS.md deve evoluir com seu projeto:

- **Atualize quando padrões mudarem**
- **Adicione aprendizados de revisões de código**
- **Documente decisões e suas justificativas**
- **Remova informações desatualizadas**

Pense nele como documentação viva que melhora a colaboração com IA ao longo do tempo.
