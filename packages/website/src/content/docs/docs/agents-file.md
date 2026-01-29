---
title: Writing AGENTS.md
description: Deep dive into creating the AGENTS.md file — the foundation of AIDF that transforms a generic AI assistant into a knowledgeable team member.
---

The `AGENTS.md` file is the foundation of AIDF. It's the single document that transforms a generic AI assistant into a knowledgeable team member.

---

## Philosophy

Write AGENTS.md as if you're onboarding a senior developer who will work **autonomously**. They need to know:

- What the project does
- How the code is organized
- What patterns to follow
- What mistakes to avoid
- How to verify their work

---

## Structure

### 1. Project Overview

Start with the big picture:

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

**Example:**

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

Describe how code is organized:

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

### 3. Technology Stack

Be specific about versions and configurations:

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

This is critical. Be explicit about naming and structure:

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

### 5. Quality Standards

Define what "good" looks like:

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

### 6. Boundaries

Explicitly state what should NOT be done:

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

### 7. Commands Reference

List commands AI should use:

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

## Advanced Sections

### Component API Patterns

If you have specific patterns for component APIs:

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

### Error Handling

```markdown
## Error Handling

- Use Error Boundaries for component errors
- Log errors to [logging service]
- Never swallow errors silently
- Provide user-friendly error messages
```

### Performance Considerations

```markdown
## Performance

- Memoize expensive computations with useMemo
- Memoize callbacks with useCallback only when passed to memoized children
- Avoid inline object/array creation in render
- Use React.lazy for code splitting at route level
```

---

## Tips

### Be Specific, Not Generic

**Bad:**
```markdown
Follow best practices for React development.
```

**Good:**
```markdown
Use functional components with hooks. Never use class components.
Memoize with useMemo only for expensive computations (>10ms).
```

### Include Examples

**Bad:**
```markdown
Name files correctly.
```

**Good:**
```markdown
Name files correctly:
- Component: `UserProfile.tsx`
- Styles: `user-profile.css`
- Test: `UserProfile.test.tsx`
```

### State the Obvious

If something is important, state it explicitly even if it seems obvious:

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

AGENTS.md should evolve with your project:

- **Update when patterns change**
- **Add learnings from code reviews**
- **Document decisions and their rationale**
- **Remove outdated information**

Think of it as living documentation that improves AI collaboration over time.
