# Example: React Component Library

This example demonstrates AIDF applied to a React component library using Atomic Design.

## Reference Project

Based on **Pivotree Commerce Kit** - a production component library with:

- 96 components (atoms, molecules, organisms, blocks, layouts)
- TypeScript strict mode
- 91%+ test coverage
- Storybook documentation
- Design tokens system

## Key AIDF Files

### AGENTS.md Highlights

```markdown
## Architecture

### Atomic Design Pattern

Components are organized in layers of increasing complexity:

1. **Atoms**: Basic building blocks (Button, Icon, Input)
2. **Molecules**: Composed atoms (Card, Badge, Rating)
3. **Organisms**: Complex features (ProductCard, Filter)
4. **Blocks**: Page sections (Header, Footer)
5. **Layouts**: Page structures

### Component Structure

Every component follows this structure:

\`\`\`
ComponentName/
├── ComponentName.tsx         # forwardRef component
├── ComponentName.types.ts    # TypeScript interfaces
├── ComponentName.constants.ts # Class mappings
├── component-name.css        # Styles with pt- prefix
├── ComponentName.test.tsx    # Vitest tests
└── index.ts                  # Exports
\`\`\`

### CSS Conventions

- Prefix: `pt-` (project prefix)
- Naming: BEM-like (`.pt-Button__icon--leading`)
- Values: CSS custom properties only
- No hardcoded colors, spacing, or typography
```

### Role Customizations

The developer role was customized to include:

```markdown
## Constraints

- Always use forwardRef for components
- Always add displayName
- Never use CSS-in-JS
- Always use design tokens from packages/tokens
- Test accessibility with expectNoA11yViolations
```

### Task Example

```markdown
# TASK

## Goal
Create the Button atom with primary, secondary, and tertiary variants.

## Scope
### Allowed
- packages/ui-react/src/atoms/Button/**
- packages/ui-react/src/atoms/index.ts
- apps/storybook/stories/Atoms/Button.stories.tsx

### Forbidden
- packages/tokens/**
- Any other atoms

## Definition of Done
- [ ] Component renders with forwardRef
- [ ] All variants implemented (primary, secondary, tertiary)
- [ ] All sizes implemented (sm, md, lg)
- [ ] CSS uses only design tokens
- [ ] Tests pass with >80% coverage
- [ ] No a11y violations
- [ ] Storybook story with controls
- [ ] `pnpm quality:fast` passes
```

## Results

Using AIDF, the project achieved:

- **Consistency**: All 96 components follow identical patterns
- **Quality**: 91.94% test coverage maintained
- **Speed**: New components generated in minutes
- **Safety**: Scope boundaries prevented accidental changes

## Files to Study

See the full implementation at:
- [pivotree-commerce-kit/.ai/](../../) (if cloned alongside)
- AGENTS.md for complete project context
- roles/ for customized role definitions
- tasks/ for real task examples
