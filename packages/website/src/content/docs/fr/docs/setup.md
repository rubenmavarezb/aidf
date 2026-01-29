---
title: Guide de Configuration
description: Guide étape par étape pour intégrer AIDF dans votre projet avec des rôles, des tâches et des modèles.
---

## Prérequis

- Un projet existant (tout langage/framework)
- Une compréhension de base de l'architecture de votre projet
- Accès à un assistant IA (Claude, GPT-4, Cursor, etc.)

---

## Étape 1 : Créer la Structure

Créez le dossier `.ai` à la racine de votre projet :

```bash
mkdir -p .ai/roles .ai/tasks .ai/plans .ai/templates
```

Ou copiez depuis AIDF :

```bash
cp -r /path/to/aidf/templates/.ai /your/project/
```

Votre structure devrait ressembler à :

```
your-project/
├── .ai/
│   ├── AGENTS.md           # You'll create this
│   ├── ROLES.md            # Role selection guide
│   ├── roles/              # AI personas
│   ├── tasks/              # Task prompts
│   ├── plans/              # Multi-task initiatives
│   └── templates/          # Reusable templates
├── src/
└── ...
```

---

## Étape 2 : Créer AGENTS.md

C'est le fichier le plus important. Il donne à l'IA un contexte complet sur votre projet.

Commencez avec cette structure :

```markdown
# AGENTS.md

## Project Overview

[What this project is, its purpose, who uses it]

## Architecture

### Structure
[Folder organization, key directories]

### Patterns
[Design patterns used: MVC, Atomic Design, etc.]

### Key Files
[Important files AI should know about]

## Technology Stack

- **Language**: [TypeScript, Python, etc.]
- **Framework**: [React, Django, etc.]
- **Build**: [Vite, Webpack, etc.]
- **Testing**: [Jest, Vitest, pytest, etc.]

## Conventions

### Naming
[File naming, variable naming, component naming]

### Code Style
[Formatting rules, linting configuration]

### File Structure
[How files within a module/component are organized]

## Quality Standards

### Testing
[Coverage requirements, what to test]

### Type Safety
[TypeScript strictness, type requirements]

### Documentation
[JSDoc, docstrings, README requirements]

## Boundaries

### Never Modify
[Critical files that should not be touched]

### Requires Approval
[Files that need human review before changes]

## Commands

[Common commands AI should know]

- `npm install` - Install dependencies
- `npm run dev` - Start development server
- `npm test` - Run tests
- `npm run lint` - Check code style
```

Consultez [Rédiger AGENTS.md](/aidf/fr/docs/agents-file/) pour un guide détaillé.

---

## Étape 3 : Sélectionner les Rôles

Examinez les rôles dans `.ai/roles/` et ne conservez que ceux pertinents pour votre projet :

| Rôle | Conserver Si... |
|------|-----------------|
| `architect.md` | Vous faites de la conception système, du refactoring |
| `developer.md` | Vous écrivez des fonctionnalités, corrigez des bugs |
| `tester.md` | Vous écrivez des tests, améliorez la couverture |
| `reviewer.md` | Vous souhaitez une revue de code par l'IA |
| `documenter.md` | Vous rédigez de la documentation |

Personnalisez chaque rôle selon les spécificités de votre projet.

---

## Étape 4 : Configurer les Modèles

Modifiez `.ai/templates/TASK.template.md` pour correspondre à votre workflow :

```markdown
# TASK

## Goal
<One clear sentence describing what must be done>

## Task Type
<component | refactor | test | docs | architecture>

## Suggested Roles
- <primary role>
- <secondary role if needed>

## Scope

### Allowed
- <paths that may be modified>

### Forbidden
- <paths that must not be touched>

## Requirements
<Detailed specifications>

## Definition of Done
- [ ] <Verifiable criterion>
- [ ] <Your standard quality check, e.g., "npm test passes">

## Notes
<Additional context, warnings, tips>
```

---

## Étape 5 : Ajouter au .gitignore (Optionnel)

Décidez ce que vous souhaitez suivre :

```gitignore
# Track everything (recommended)
# .ai/ is committed

# Or ignore active tasks
.ai/tasks/*.active.md

# Or ignore plans in progress
.ai/plans/*/WIP-*
```

Recommandation : **Committez tout**. Le dossier `.ai` est une documentation qui aide les futurs contributeurs (humains et IA).

---

## Étape 6 : Créer Votre Première Tâche

```bash
cp .ai/templates/TASK.template.md .ai/tasks/$(date +%Y-%m-%d)-my-first-task.md
```

Modifiez le fichier de tâche avec vos exigences.

---

## Étape 7 : Exécuter

### Option A : Contexte Complet (Recommandé pour les tâches complexes)

Fournissez à l'IA :

1. Le contenu d'AGENTS.md
2. La définition du rôle pertinent
3. La définition de la tâche

```
[Paste AGENTS.md]

[Paste role definition]

[Paste task]
```

### Option B : Tâche Seule (Pour les tâches simples)

Si l'IA a déjà vu AGENTS.md dans la session :

```
[Paste task only]
```

### Option C : Référence (Si l'IA a accès aux fichiers)

```
Read .ai/AGENTS.md, .ai/roles/developer.md, and .ai/tasks/my-task.md, then execute the task.
```

---

## Liste de Vérification

Après la configuration, vérifiez :

- [ ] Le dossier `.ai/` existe avec la bonne structure
- [ ] `AGENTS.md` décrit précisément votre projet
- [ ] Au moins un rôle est personnalisé
- [ ] Le modèle de tâche correspond à vos standards de qualité
- [ ] Vous pouvez créer et exécuter une tâche de test simple

---

## Intégration avec les Outils

### Cursor

Cursor lit automatiquement les fichiers du projet. Référencez `.ai/AGENTS.md` dans vos prompts ou ajoutez-le au contexte de Cursor.

### Claude (via API ou Console)

Collez le contexte pertinent au début des conversations, ou utilisez la fonctionnalité Projects pour persister le contexte.

### VS Code + Extensions

Utilisez les paramètres du workspace pour référencer les fichiers `.ai/` dans les configurations des extensions IA.

### CI/CD

Ajoutez une validation pour que les tâches respectent la Definition of Done :

```yaml
# Example: Verify no forbidden paths were modified
- name: Check scope compliance
  run: |
    # Script to verify changes are within allowed scope
```

---

## Prochaines Étapes

- [Rédiger AGENTS.md](/aidf/fr/docs/agents-file/) - Plongée approfondie dans les documents de contexte
- [Définir les Rôles](/aidf/fr/docs/roles/) - Personnaliser les personas IA
- [Conception de Tâches](/aidf/fr/docs/tasks/) - Écrire des tâches efficaces
- [Bonnes Pratiques](/aidf/fr/docs/best-practices/) - Patterns qui fonctionnent
