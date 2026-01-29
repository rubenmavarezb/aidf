---
title: Intégrations
description: Utilisez AIDF avec Claude Code, Cursor, GitHub Copilot ou tout LLM — aucun CLI requis.
---

Ce guide explique comment utiliser AIDF avec les outils de codage IA populaires **sans** nécessiter le CLI AIDF.

## Vue d'Ensemble

AIDF est agnostique en termes d'outils. La valeur principale réside dans le **contexte structuré** (AGENTS.md, rôles, tâches), pas dans le CLI. Vous pouvez utiliser AIDF avec :

- Claude Code
- Cursor
- GitHub Copilot
- Tout LLM avec accès aux fichiers

---

## Intégration Claude Code

### Configuration

1. Copiez le dossier `.ai/` dans votre projet (depuis `templates/.ai/`)
2. Personnalisez `AGENTS.md` avec les détails de votre projet
3. Créez des tâches dans `.ai/tasks/`

### Utilisation

**Option A : Prompt unique avec contexte complet**

```bash
claude
> Read .ai/AGENTS.md, then .ai/roles/developer.md, then execute .ai/tasks/001-feature.md
```

**Option B : Référencer les fichiers directement**

```bash
claude
> @.ai/AGENTS.md @.ai/roles/developer.md @.ai/tasks/001-feature.md
> Execute this task following the context and role.
```

**Option C : Ajouter au CLAUDE.md**

```markdown
# CLAUDE.md

## Project Context
See .ai/AGENTS.md for full project context.

## Task Execution
When asked to execute a task:
1. Read .ai/AGENTS.md for project context
2. Read the role file specified in the task
3. Follow the task's Scope restrictions
4. Signal completion with <TASK_COMPLETE> when Definition of Done is met
```

### Boucle Autonome (style Ralph)

Pour une exécution autonome similaire à la technique Ralph :

```bash
# Terminal
while true; do
  cat .ai/tasks/current-task.md | claude --print
  # Check for completion signal
  # Update task status
  sleep 1
done
```

Ou utilisez la boucle intégrée de Claude Code :

```bash
claude
> Read .ai/AGENTS.md and .ai/tasks/001-feature.md.
> Execute autonomously until all Definition of Done criteria are met.
> Only modify files in the Allowed scope.
> Output <TASK_COMPLETE> when done or <BLOCKED: reason> if stuck.
```

---

## Intégration Cursor

### Configuration

1. Copiez le dossier `.ai/` dans votre projet
2. Créez `.cursor/rules/aidf.mdc` :

```markdown
# AIDF Integration

## Context Loading
When working on this project:
- Read `.ai/AGENTS.md` for project overview, architecture, and conventions
- This is your primary source of truth for how the project works

## Task Execution
When asked to execute a task file:
1. Read the task file completely
2. Load the suggested role from `.ai/roles/{role}.md`
3. **STRICTLY** follow the Scope section:
   - Only modify files matching `Allowed` patterns
   - Never modify files matching `Forbidden` patterns
4. Check each item in `Definition of Done` before completing
5. Add `## Status: COMPLETED` to the task file when done

## Role Behavior
When a role file is loaded, adopt:
- The **Identity** as your persona
- The **Constraints** as hard rules
- The **Quality Criteria** as success metrics
```

### Utilisation dans Cursor

**Composer :**
```
Execute the task in .ai/tasks/001-feature.md
```

**Mode Agent :**
```
@.ai/AGENTS.md @.ai/tasks/001-feature.md

Execute this task following AIDF conventions.
Stay within scope and signal <TASK_COMPLETE> when done.
```

### Paramètres Cursor (optionnel)

Ajoutez dans `.cursor/settings.json` :

```json
{
  "workspaceContext": {
    "alwaysInclude": [".ai/AGENTS.md"]
  }
}
```

---

## Intégration GitHub Copilot

### Configuration

1. Copiez le dossier `.ai/` dans votre projet
2. Créez `.github/copilot-instructions.md` :

```markdown
# Project Context

This project uses AIDF (AI-Integrated Development Framework).

## Key Files
- `.ai/AGENTS.md` - Project overview, architecture, conventions
- `.ai/roles/` - Specialized role definitions
- `.ai/tasks/` - Task definitions with scope and requirements

## When Modifying Code
1. Check if there's a relevant task in `.ai/tasks/`
2. Follow the conventions in `.ai/AGENTS.md`
3. Respect the scope defined in task files

## Code Style
See the Conventions section in `.ai/AGENTS.md`
```

---

## Intégration LLM Générique (API)

Pour tout LLM via API, construisez les prompts en concaténant :

```python
def build_aidf_prompt(task_path: str) -> str:
    agents = read_file('.ai/AGENTS.md')
    task = read_file(task_path)

    # Extract role from task
    role_name = extract_role(task)  # e.g., "developer"
    role = read_file(f'.ai/roles/{role_name}.md')

    return f"""
# Project Context
{agents}

# Your Role
{role}

# Task to Execute
{task}

# Instructions
1. Follow the project conventions
2. Stay within the Allowed scope
3. Never modify Forbidden files
4. Complete all Definition of Done items
5. Output <TASK_COMPLETE> when finished
"""
```

---

## Bonnes Pratiques

### 1. Toujours Charger AGENTS.md en Premier

Le contexte du projet devrait être chargé avant toute exécution de tâche. Cela garantit que l'IA comprend :
- L'architecture du projet
- Les conventions de code
- Les standards de qualité
- Les limites (ce qu'il ne faut PAS faire)

### 2. Utiliser la Portée comme Contraintes Strictes

```markdown
## Scope

### Allowed
- `src/components/**`

### Forbidden
- `.env*`
- `src/config/**`
```

Dites explicitement à l'IA : "Vous ne DEVEZ PAS modifier les fichiers en dehors de la portée Allowed."

### 3. Definition of Done = Critères de Sortie

Ne laissez pas l'IA décider quand c'est "terminé". La Definition of Done fournit des critères objectifs :

```markdown
## Definition of Done
- [ ] Component renders without errors
- [ ] Tests pass (`pnpm test`)
- [ ] TypeScript compiles (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
```

### 4. Utiliser les Rôles pour les Tâches Spécialisées

Différentes tâches nécessitent différentes expertises :

| Type de Tâche | Rôle |
|---------------|------|
| Nouvelle fonctionnalité | developer |
| Conception système | architect |
| Investigation de bug | developer + tester |
| Revue de code | reviewer |
| Documentation | documenter |

### 5. Signaler la Complétion Explicitement

Entraînez l'IA à émettre des signaux clairs :

- `<TASK_COMPLETE>` - Tous les éléments de Definition of Done sont remplis
- `<BLOCKED: reason>` - Impossible de continuer, nécessite une intervention humaine
- `<SCOPE_VIOLATION: file>` - Tentative de modification d'un fichier interdit

---

## Modèles de Prompts

### Exécution Rapide de Tâche

```
Read .ai/AGENTS.md for context.
Execute .ai/tasks/{task}.md as the {role} role.
Output <TASK_COMPLETE> when Definition of Done is met.
```

### Exécution Approfondie de Tâche

```
# Context Loading
1. Read .ai/AGENTS.md completely
2. Read .ai/roles/{role}.md for your role definition

# Task Execution
3. Read .ai/tasks/{task}.md
4. Analyze the requirements and scope
5. Implement the changes
6. Verify each Definition of Done item
7. Output <TASK_COMPLETE> or <BLOCKED: reason>

# Constraints
- ONLY modify files in Allowed scope
- NEVER modify files in Forbidden scope
- Follow all conventions from AGENTS.md
```

### Prompt de Boucle Autonome

```
You are executing tasks autonomously using AIDF.

Current iteration: {n}
Task: .ai/tasks/{task}.md

Instructions:
1. Read the task and understand requirements
2. Make incremental progress
3. After each change, verify against Definition of Done
4. If ALL criteria met: output <TASK_COMPLETE>
5. If blocked: output <BLOCKED: specific reason>
6. If need to modify file outside scope: output <SCOPE_VIOLATION: path>

Previous output (if any):
{previous_output}

Begin execution.
```

---

## Dépannage

### L'IA ignore les restrictions de portée

Ajoutez des avertissements explicites :
```
WARNING: Modifying files outside the Allowed scope will cause task failure.
The following files are FORBIDDEN: {list}
```

### L'IA ne complète pas tous les éléments de Definition of Done

Ajoutez une étape de vérification de checklist :
```
Before outputting <TASK_COMPLETE>, verify EACH item:
- [ ] Item 1: {status}
- [ ] Item 2: {status}
Only output <TASK_COMPLETE> if ALL items are checked.
```

### L'IA hallucine la structure du projet

Chargez toujours AGENTS.md en premier, qui contient la vraie structure du répertoire.

### Fenêtre de contexte trop petite

Priorisez l'ordre de chargement :
1. AGENTS.md (requis)
2. Fichier de tâche (requis)
3. Fichier de rôle (optionnel, peut être résumé)
4. Fichier de plan (optionnel, uniquement s'il existe)
