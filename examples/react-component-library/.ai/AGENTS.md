# AGENTS.md

> React Component Library - AI assistant context document.

---

## Identity

This project is a React component library using Atomic Design, TypeScript, Vitest, and Storybook.

IMPORTANT: This document defines the single source of truth for AI assistants working on this project.

---

## Project Overview

A React component library organized by Atomic Design principles (atoms, molecules, organisms, blocks, layouts) with TypeScript strict mode, design tokens, and Storybook documentation.

**Key characteristics:**

- Atomic Design pattern (atoms, molecules, organisms, blocks, layouts)
- All components use `forwardRef` with `displayName`
- CSS with BEM-like naming and `pt-` prefix
- Design tokens via CSS custom properties

**Target users:**

- Frontend developers consuming the library
- Designers referencing Storybook documentation

---

## Architecture

### Directory Structure

```
packages/
├── ui-react/src/
│   ├── atoms/              # Basic building blocks (Button, Icon, Input)
│   ├── molecules/          # Composed atoms (Card, Badge, Rating)
│   ├── organisms/          # Complex features (ProductCard, Filter)
│   ├── blocks/             # Page sections (Header, Footer)
│   └── layouts/            # Page structures
├── tokens/                 # Design tokens (colors, spacing, typography)
apps/
└── storybook/              # Storybook documentation app
    └── stories/            # Story files
```

---

## Technology Stack

| Category | Technology | Version | Notes |
|----------|------------|---------|-------|
| Library | React | 18.x | With forwardRef pattern |
| Language | TypeScript | 5.x | Strict mode |
| Styling | CSS | - | BEM-like with `pt-` prefix, design tokens |
| Testing | Vitest | Latest | Unit + a11y |
| Docs | Storybook | 7.x | Component documentation |
| Build | Rollup | 4.x | Library bundling |
| Package Manager | pnpm | 8.x | Monorepo with workspaces |

---

## Commands

### Development

| Command | Description | When to Run |
|---------|-------------|-------------|
| `pnpm install` | Install all workspace dependencies | After cloning, after pulling changes that modify `package.json` |
| `pnpm dev` | Start Storybook dev server | When developing or previewing components |
| `pnpm tokens:build` | Build design tokens package | After modifying token definitions in `packages/tokens` |

### Quality Checks

CRITICAL: These MUST pass before marking any task complete.

| Command | Description | When to Run |
|---------|-------------|-------------|
| `pnpm lint` | Run ESLint across all packages | Before every commit, after code changes |
| `pnpm typecheck` | Run TypeScript compiler checks | Before every commit, after code changes |
| `pnpm test` | Run Vitest unit and a11y tests | Before every commit, after code changes |
| `pnpm test:coverage` | Run tests with coverage report | Before merging, to verify coverage threshold |
| `pnpm quality:fast` | Run lint + typecheck + test in sequence | Quick full quality gate check |

### Build & Deploy

| Command | Description | When to Run |
|---------|-------------|-------------|
| `pnpm build` | Build all packages for production | Before publishing, to verify build output |
| `pnpm build:storybook` | Build static Storybook site | Before deploying documentation |
| `pnpm publish:lib` | Publish library to npm registry | After version bump and build verification |

### Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| `Module not found` after pulling | New dependencies added by another developer | `pnpm install` |
| Storybook fails to start | Outdated cache or missing dependencies | `rm -rf node_modules/.cache && pnpm dev` |
| Token values not updating | Tokens package not rebuilt after changes | `pnpm tokens:build` then restart dev server |
| a11y test failures | Missing ARIA attributes or roles | Check component for accessibility, add required `aria-*` attributes |
| CSS styles not applied | Missing `pt-` prefix or wrong BEM naming | Verify class names follow `.pt-ComponentName__element--modifier` pattern |
| Coverage below threshold | Insufficient tests for new or modified components | Add missing test cases, check with `pnpm test:coverage` |

### Command Sequences

**Initial Setup**

```bash
pnpm install              # Install all workspace dependencies
pnpm tokens:build         # Build design tokens
pnpm dev                  # Start Storybook for development
```

**Pre-Commit Verification**

```bash
pnpm quality:fast         # Run lint + typecheck + test in one step
pnpm build                # Verify production build
```

**Create New Component**

```bash
# After creating component files following the structure:
pnpm typecheck            # Verify types
pnpm test                 # Run tests including a11y
pnpm dev                  # Preview in Storybook
pnpm test:coverage        # Verify coverage threshold
```

**After Token Changes**

```bash
pnpm tokens:build         # Rebuild token package
pnpm typecheck            # Verify token types
pnpm test                 # Ensure no visual regressions
pnpm build                # Verify full build
```

**Prepare for Publishing**

```bash
pnpm quality:fast         # Full quality gate
pnpm build                # Production build
pnpm test:coverage        # Verify coverage meets threshold
pnpm publish:lib          # Publish to npm
```

---

## Conventions

IMPORTANT: Match these patterns EXACTLY when writing new code. Deviations will be rejected.

### File Naming

| Type | Pattern | Example | Wrong |
|------|---------|---------|-------|
| Component file | PascalCase | `Button.tsx` | `button.tsx` |
| Types file | PascalCase + `.types` | `Button.types.ts` | `button-types.ts` |
| CSS file | kebab-case | `button.css` | `Button.css` |
| Test file | PascalCase + `.test` | `Button.test.tsx` | `button.spec.tsx` |
| Constants file | PascalCase + `.constants` | `Button.constants.ts` | `buttonConstants.ts` |

### Component Structure

Every component follows this structure:

```
ComponentName/
├── ComponentName.tsx         # forwardRef component
├── ComponentName.types.ts    # TypeScript interfaces
├── ComponentName.constants.ts # Class mappings
├── component-name.css        # Styles with pt- prefix
├── ComponentName.test.tsx    # Vitest tests
└── index.ts                  # Exports
```

### Code Style

#### Component Declaration

```tsx
// ✅ CORRECT - forwardRef with displayName and typed props
import { forwardRef } from 'react';
import type { ButtonProps } from './Button.types';

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button ref={ref} className={getClassName(variant, size)} {...props}>
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

// ❌ WRONG - No forwardRef, no displayName, inline types
export function Button({ children, variant }: { children: React.ReactNode; variant: string }) {
  return <button className={variant}>{children}</button>;
}
```

Why: forwardRef enables parent ref access required by composition patterns. displayName ensures readable component names in React DevTools and error messages.

#### Props Interface Pattern

```typescript
// ✅ CORRECT - Extends native HTML element, explicit variants
// Button.types.ts
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'tertiary';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

// ❌ WRONG - Loose types, no HTML attribute extension
export interface ButtonProps {
  children: React.ReactNode;
  variant: string;
  size: string;
  onClick: () => void;
  className: string;
  disabled: boolean;
}
```

Why: Extending HTML attributes ensures all native props (aria-*, data-*, event handlers) are supported without manual declaration. Union types for variants prevent invalid values.

#### CSS Conventions

```css
/* ✅ CORRECT - Prefixed class, BEM-like naming, uses tokens */
.pt-Button {
  padding: var(--spacing-sm) var(--spacing-md);
  font-family: var(--font-family-base);
  border-radius: var(--radius-md);
}

.pt-Button--primary {
  background-color: var(--color-primary);
  color: var(--color-on-primary);
}

.pt-Button__icon--leading {
  margin-right: var(--spacing-xs);
}

/* ❌ WRONG - No prefix, hardcoded values, no BEM */
.button {
  padding: 8px 16px;
  font-family: Arial, sans-serif;
  border-radius: 4px;
  background-color: #3b82f6;
  color: white;
}
```

Why: The `pt-` prefix prevents class name collisions when consumed by host apps. Design tokens ensure all components stay in sync when themes change.

#### Export Pattern

```typescript
// ✅ CORRECT - Barrel export from index.ts, named exports only
// Button/index.ts
export { Button } from './Button';
export type { ButtonProps } from './Button.types';

// atoms/index.ts
export { Button } from './Button';
export { Input } from './Input';
export { Icon } from './Icon';

// ❌ WRONG - Default exports, re-exporting internals
// Button/index.ts
export { default } from './Button';
export { BUTTON_VARIANTS } from './Button.constants';  // internal detail
```

Why: Named exports enable tree-shaking and prevent consumers from importing internal implementation details like constants or class mappings.

#### Test Pattern

```tsx
// ✅ CORRECT - Testing Library with a11y check, tests behavior not implementation
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expectNoA11yViolations } from '../test-utils';
import { Button } from './Button';

describe('Button', () => {
  it('renders children text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('forwards ref to button element', () => {
    const ref = { current: null };
    render(<Button ref={ref}>Test</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<Button>Accessible</Button>);
    await expectNoA11yViolations(container);
  });
});

// ❌ WRONG - Testing implementation details, no a11y test
import { render } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('has correct class', () => {
    const { container } = render(<Button variant="primary">Test</Button>);
    expect(container.firstChild).toHaveClass('pt-Button--primary');
  });
});
```

Why: Testing behavior (roles, text, interactions) produces resilient tests. Testing class names or DOM structure breaks when implementation changes without user-facing impact.

---

## Boundaries

### Never Modify

- `packages/tokens/` (without design approval)
- Other developers' component internals
- Shared test utilities without discussion

### Requires Discussion

- New component category (new atom, molecule, etc.)
- Design token additions or changes
- Accessibility pattern changes
- Build configuration changes

---

IMPORTANT: Update this document when patterns change or decisions are made.
