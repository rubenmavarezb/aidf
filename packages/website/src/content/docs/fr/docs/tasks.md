---
title: Conception de Tâches
description: Apprenez à concevoir des tâches bien structurées — l'unité atomique de travail dans AIDF — avec des objectifs clairs, une portée définie et des critères de complétion vérifiables.
---

Les tâches sont l'unité atomique de travail dans AIDF. Une tâche bien conçue donne à l'IA tout ce dont elle a besoin pour s'exécuter de manière autonome et produire des résultats cohérents.

---

## Anatomie d'une Tâche

```markdown
# TASK

## Goal
[One clear sentence - what must be accomplished]

## Task Type
[component | refactor | test | docs | architecture | bugfix]

## Suggested Roles
- [primary role]
- [secondary role if needed]

## Scope

### Allowed
- [paths that may be modified]

### Forbidden
- [paths that must NOT be modified]

## Requirements
[Detailed specifications]

## Definition of Done
- [ ] [Verifiable criterion 1]
- [ ] [Verifiable criterion 2]
- [ ] [Quality gate, e.g., "pnpm test passes"]

## Notes
[Additional context, warnings, tips]
```

---

## Analyse Détaillée des Sections

### Goal

L'objectif est une **phrase unique** qui répond à : "Qu'est-ce qui sera vrai lorsque cette tâche sera terminée ?"

**Mauvais Objectifs :**

```markdown
## Goal
Work on the button component and make it better.
```
- Vague
- Pas d'état de complétion clair
- "Better" est subjectif

**Bons Objectifs :**

```markdown
## Goal
Create a Button component with primary, secondary, and tertiary variants that supports icons and loading states.
```
- Livrable spécifique
- Portée claire
- Complétion mesurable

### Task Type

Catégoriser les tâches aide l'IA à comprendre la nature du travail :

| Type | Description | Rôles Typiques |
|------|-------------|----------------|
| `component` | Créer un nouveau composant UI | developer, tester |
| `refactor` | Restructurer du code existant | architect, developer |
| `test` | Ajouter ou améliorer des tests | tester |
| `docs` | Travail de documentation | documenter |
| `architecture` | Conception système, outillage | architect |
| `bugfix` | Corriger un bug spécifique | developer |

### Scope

**C'est essentiel.** La portée définit les limites de ce que l'IA peut toucher.

```markdown
## Scope

### Allowed
- src/components/Button/**
- src/components/index.ts (to add export)
- tests/components/Button.test.tsx

### Forbidden
- src/core/**
- src/utils/** (use existing utils, don't modify)
- Any configuration files
- package.json
```

**Règles :**

1. Si ce n'est pas dans `Allowed`, c'est interdit
2. Soyez aussi spécifique que possible
3. Utilisez des patterns glob pour les répertoires : `src/components/Button/**`
4. Listez explicitement les fichiers individuels si nécessaire

### Requirements

C'est ici que vous fournissez les spécifications détaillées. Soyez explicite sur :

**Pour les Composants :**

```markdown
## Requirements

### Props API

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'primary' \| 'secondary' \| 'tertiary'` | `'primary'` | Visual style |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Button size |
| `loading` | `boolean` | `false` | Shows loading spinner |
| `disabled` | `boolean` | `false` | Disables interaction |
| `leadingIcon` | `ReactNode` | - | Icon before text |
| `trailingIcon` | `ReactNode` | - | Icon after text |

### Behavior

- When `loading` is true, show spinner and disable button
- Forward all standard button HTML attributes
- Support `as` prop for polymorphism (render as `<a>` for links)

### Styling

- Use CSS custom properties from design tokens
- Support all interactive states (hover, active, focus, disabled)
- Follow BEM-like naming: `.pt-Button`, `.pt-Button--primary`
```

**Pour le Refactoring :**

```markdown
## Requirements

### Current State
[Describe what exists now]

### Target State
[Describe what should exist after]

### Constraints
- No API changes (internal refactor only)
- Must maintain backward compatibility
- Performance must not degrade
```

**Pour les Corrections de Bugs :**

```markdown
## Requirements

### Bug Description
[What is happening]

### Expected Behavior
[What should happen]

### Reproduction Steps
1. [Step 1]
2. [Step 2]
3. [Step 3]

### Root Cause (if known)
[Analysis of why this happens]
```

### Definition of Done

Chaque critère doit être **vérifiable**. Si vous ne pouvez pas le vérifier, il ne devrait pas être ici.

**Mauvais Critères :**

```markdown
## Definition of Done
- Code is clean
- Component works correctly
- Good test coverage
```

**Bons Critères :**

```markdown
## Definition of Done
- [ ] Component renders without errors
- [ ] All props from the API table are implemented
- [ ] TypeScript compilation passes (`pnpm typecheck`)
- [ ] ESLint passes with no warnings (`pnpm lint`)
- [ ] Tests exist for: default render, all variants, all sizes, loading state, disabled state
- [ ] Tests pass (`pnpm test`)
- [ ] No accessibility violations (test with `expectNoA11yViolations`)
- [ ] Storybook story exists with controls for all props
```

### Notes

Utilisez cette section pour :

- Les avertissements sur les pièges
- Les références au code lié
- Les décisions qui ont été prises
- Le contexte qui ne rentre pas ailleurs

```markdown
## Notes

- The existing `Icon` component should be used for loading spinner
- Follow the pattern established in `src/components/Badge/` for structure
- Design tokens for colors are in `src/tokens/colors.css`
- Accessibility: Ensure button is focusable and announces loading state
```

---

## Modèles de Tâches par Type

### Tâche de Composant

```markdown
# TASK

## Goal
Create the [ComponentName] component with [key features].

## Task Type
component

## Suggested Roles
- developer
- tester

## Scope
### Allowed
- src/components/[ComponentName]/**
- src/components/index.ts
- stories/[ComponentName].stories.tsx

### Forbidden
- src/core/**
- src/tokens/**

## Requirements

### File Structure
Create:
- [ComponentName].tsx
- [ComponentName].types.ts
- [ComponentName].constants.ts
- [component-name].css
- [ComponentName].test.tsx
- index.ts

### Props API
[Table of props]

### Behavior
[Behavioral specifications]

### Styling
[CSS requirements]

## Definition of Done
- [ ] All files created following project structure
- [ ] All props implemented and typed
- [ ] CSS uses design tokens only
- [ ] Tests cover: render, props, interactions, a11y
- [ ] `pnpm quality:fast` passes
- [ ] Storybook story with all variants

## Notes
[Additional context]
```

### Tâche de Refactoring

```markdown
# TASK

## Goal
Refactor [area] to [improvement].

## Task Type
refactor

## Suggested Roles
- architect
- developer

## Scope
### Allowed
- [specific paths]

### Forbidden
- [paths to protect]

## Requirements

### Current State
[What exists now and its problems]

### Target State
[What should exist after]

### Migration Strategy
[How to get from current to target]

### Constraints
- No API changes
- No functionality changes
- Tests must continue passing

## Definition of Done
- [ ] All changes within scope
- [ ] No API changes (same exports, same props)
- [ ] All existing tests pass
- [ ] `pnpm quality:fast` passes
- [ ] No performance regression

## Notes
[Context about why this refactor]
```

### Tâche de Test

```markdown
# TASK

## Goal
Improve test coverage for [area] to [target]%.

## Task Type
test

## Suggested Roles
- tester

## Scope
### Allowed
- tests/**
- src/**/*.test.tsx

### Forbidden
- Any non-test files

## Requirements

### Current Coverage
[Current metrics]

### Target Coverage
[Target metrics]

### Required Test Cases
- [ ] [Test case 1]
- [ ] [Test case 2]
- [ ] [Edge case 1]

### Testing Patterns
[Reference to test utilities, patterns to follow]

## Definition of Done
- [ ] Coverage meets target
- [ ] All new tests pass
- [ ] No flaky tests introduced
- [ ] Tests follow project patterns
- [ ] `pnpm test` passes

## Notes
[Any special testing considerations]
```

---

## Anti-Patterns

### Portée Vague

```markdown
## Scope
### Allowed
- src/
```

Cela permet la modification de tout dans `src/`. Soyez spécifique.

### Terminé Non Mesurable

```markdown
## Definition of Done
- Code is good quality
```

Qu'est-ce que la "bonne qualité" ? Remplacez par des vérifications spécifiques.

### Contexte Manquant

```markdown
## Requirements
Build a form.
```

Quels champs ? Quelle validation ? Quel comportement de soumission ? Fournissez des détails.

### Tâches Surchargées

```markdown
## Goal
Build the authentication system including login, registration, password reset, OAuth integration, and user profile management.
```

C'est trop. Divisez en plusieurs tâches ciblées.

---

## Conseils

### Une Tâche, Un Objectif

Une tâche devrait avoir un seul objectif clair. Si vous vous retrouvez à écrire "et" plusieurs fois dans l'objectif, divisez-la.

### Incluez des Références de Fichiers

```markdown
## Notes
- Follow the pattern in `src/components/Button/` for structure
- Use utilities from `src/utils/form-validation.ts`
- Reference design at `docs/designs/login-form.png`
```

### Spécifiez le Format de Sortie

Lorsque le format de sortie est important :

```markdown
## Requirements

### Output Format
The component must export:
\`\`\`typescript
export { LoginForm } from "./LoginForm";
export type { LoginFormProps } from "./LoginForm.types";
\`\`\`
```

### Liez les Tâches Associées

```markdown
## Notes
- Depends on: Task #003 (design tokens must exist first)
- Blocks: Task #007 (auth flow needs this form)
```

---

## Tâches Bloquées et Reprise

Lorsque l'exécution d'une tâche rencontre un bloqueur nécessitant une intervention humaine, AIDF marque automatiquement la tâche comme `BLOCKED` et sauvegarde l'état d'exécution dans le fichier de tâche.

### Format du Statut Bloqué

Quand une tâche est bloquée, AIDF ajoute une section de statut au fichier de tâche :

```markdown
## Status: BLOCKED

### Execution Log
- **Started:** 2024-01-01T10:00:00.000Z
- **Iterations:** 5
- **Blocked at:** 2024-01-01T11:00:00.000Z

### Blocking Issue
\`\`\`
Missing API key configuration. The task requires an API key to be set in the environment, but it was not found.
\`\`\`

### Files Modified
- \`src/api/client.ts\`
- \`src/config/settings.ts\`

---
@developer: Review and provide guidance, then run \`aidf run --resume task.md\`
```

### Reprendre une Tâche Bloquée

Après avoir résolu le problème bloquant ou fourni des indications, vous pouvez reprendre la tâche en utilisant le flag `--resume` :

```bash
aidf run --resume .ai/tasks/my-task.md
```

Ou laissez AIDF sélectionner automatiquement parmi les tâches bloquées :

```bash
aidf run --resume
```

**Ce qui se passe lors de la reprise :**

1. AIDF charge l'état d'exécution précédent (nombre d'itérations, fichiers modifiés, problème bloquant)
2. L'exécution continue à partir de l'itération suivant le blocage
3. Le problème bloquant est inclus dans le contexte du prompt pour que l'IA comprenne ce qui n'allait pas
4. Les fichiers précédemment modifiés sont suivis et préservés
5. L'historique des tentatives de reprise est enregistré dans le fichier de tâche

### Historique des Tentatives de Reprise

AIDF suit les tentatives de reprise dans le fichier de tâche :

```markdown
### Resume Attempt History
- **Resumed at:** 2024-01-01T12:00:00.000Z
- **Previous attempt:** Iteration 5, blocked at 2024-01-01T11:00:00.000Z
- **Completed at:** 2024-01-01T13:00:00.000Z
- **Status:** completed
- **Iterations in this attempt:** 3
```

### Complétion de Tâche après Reprise

Lorsqu'une tâche se termine après avoir été reprise, le statut BLOCKED est remplacé par un statut de complétion et un historique d'exécution :

```markdown
## Execution History

### Original Block
- **Started:** 2024-01-01T10:00:00.000Z
- **Blocked at:** 2024-01-01T11:00:00.000Z
- **Iterations before block:** 5
- **Blocking issue:** Missing API key configuration...

### Resume and Completion
- **Resumed at:** 2024-01-01T12:00:00.000Z
- **Completed at:** 2024-01-01T13:00:00.000Z
- **Total iterations:** 8
- **Files modified:** 5 files

---

## Status: COMPLETED
```

### Bonnes Pratiques pour la Reprise

1. **Examinez le problème bloquant** - Comprenez ce qui n'a pas fonctionné avant de reprendre
2. **Résolvez le bloqueur** - Corrigez le problème ou fournissez des indications claires dans le fichier de tâche
3. **Vérifiez le contexte** - Vérifiez que les fichiers modifiés lors de la tentative précédente sont toujours pertinents
4. **Utilisez l'historique de reprise** - Consultez les tentatives de reprise précédentes pour comprendre les tendances

### Quand les Tâches sont Bloquées

Les tâches sont automatiquement marquées comme BLOCKED quand :

- L'IA signale explicitement `<BLOCKED: reason>` dans sa sortie
- Le nombre maximum d'itérations est atteint
- Le nombre maximum d'échecs consécutifs est atteint
- Des erreurs critiques empêchent la continuation

### Gestion des Erreurs

Si vous essayez de reprendre une tâche qui n'est pas bloquée :

```bash
$ aidf run --resume .ai/tasks/normal-task.md
Error: Task is not blocked. Cannot use --resume on a task that is not in BLOCKED status.
```

Seules les tâches avec `## Status: BLOCKED` peuvent être reprises.
