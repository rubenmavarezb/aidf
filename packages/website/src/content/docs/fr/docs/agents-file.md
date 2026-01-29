---
title: Rédiger AGENTS.md
description: Plongée approfondie dans la création du fichier AGENTS.md — la fondation d'AIDF qui transforme un assistant IA générique en un membre d'équipe compétent.
---

Le fichier `AGENTS.md` est la fondation d'AIDF. C'est le document unique qui transforme un assistant IA générique en un membre d'équipe compétent.

---

## Philosophie

Rédigez AGENTS.md comme si vous intégriez un développeur senior qui travaillera de manière **autonome**. Il doit savoir :

- Ce que fait le projet
- Comment le code est organisé
- Quels patterns suivre
- Quelles erreurs éviter
- Comment vérifier son travail

---

## Structure

### 1. Vue d'Ensemble du Projet

Commencez par la vue d'ensemble :

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

**Exemple :**

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

### 2. Architecture

Décrivez comment le code est organisé :

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

### 3. Stack Technologique

Soyez précis sur les versions et les configurations :

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

### 4. Conventions

C'est essentiel. Soyez explicite sur le nommage et la structure :

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

### 5. Standards de Qualité

Définissez ce que signifie "bon" :

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

Indiquez explicitement ce qui ne doit PAS être fait :

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

### 7. Référence des Commandes

Listez les commandes que l'IA doit utiliser :

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

## Sections Avancées

### Patterns d'API de Composants

Si vous avez des patterns spécifiques pour les API de composants :

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

### Gestion des Erreurs

```markdown
## Error Handling

- Use Error Boundaries for component errors
- Log errors to [logging service]
- Never swallow errors silently
- Provide user-friendly error messages
```

### Considérations de Performance

```markdown
## Performance

- Memoize expensive computations with useMemo
- Memoize callbacks with useCallback only when passed to memoized children
- Avoid inline object/array creation in render
- Use React.lazy for code splitting at route level
```

---

## Conseils

### Soyez Spécifique, Pas Générique

**Mauvais :**
```markdown
Follow best practices for React development.
```

**Bon :**
```markdown
Use functional components with hooks. Never use class components.
Memoize with useMemo only for expensive computations (>10ms).
```

### Incluez des Exemples

**Mauvais :**
```markdown
Name files correctly.
```

**Bon :**
```markdown
Name files correctly:
- Component: `UserProfile.tsx`
- Styles: `user-profile.css`
- Test: `UserProfile.test.tsx`
```

### Dites l'Évident

Si quelque chose est important, dites-le explicitement même si cela semble évident :

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

## Maintenance

AGENTS.md devrait évoluer avec votre projet :

- **Mettez à jour lorsque les patterns changent**
- **Ajoutez les leçons tirées des revues de code**
- **Documentez les décisions et leur justification**
- **Supprimez les informations obsolètes**

Considérez-le comme une documentation vivante qui améliore la collaboration avec l'IA au fil du temps.
