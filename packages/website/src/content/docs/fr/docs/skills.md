---
title: Agent Skills
description: Consommez des définitions de skills portables depuis l'écosystème agentskills.io, partagez des skills entre projets et publiez les vôtres.
---

AIDF intègre le standard [Agent Skills](https://agentskills.io), vous permettant de consommer des définitions de skills portables depuis l'écosystème et de publier les vôtres.

Les skills sont des fichiers SKILL.md autonomes qui fournissent des instructions, de l'expertise et des contraintes à l'IA pendant l'exécution des tâches. Ils sont injectés dans le prompt comme contexte supplémentaire aux côtés du rôle et de la tâche.

---

## Pourquoi des Skills ?

### Sans Skills

```
Votre agent IA ne connaît que ce qui se trouve dans AGENTS.md + rôle + tâche.
Ajouter de nouvelles expertises signifie modifier les rôles ou écrire des descriptions de tâches plus longues.
```

### Avec des Skills

```
Déposez un SKILL.md dans .ai/skills/ et l'IA acquiert de nouvelles capacités instantanément.
Partagez des skills entre projets. Utilisez des skills publiés par la communauté.
```

Les skills apportent :

- **Portabilité** : Le même skill fonctionne dans n'importe quel agent compatible avec le standard (34+ agents compatibles)
- **Composabilité** : Combinez plusieurs skills pour une seule exécution de tâche
- **Séparation** : Les skills sont séparés des rôles — les rôles définissent _qui_, les skills définissent _ce que_ l'IA peut faire
- **Écosystème** : Consommez des skills de la communauté ou publiez les vôtres

---

## Format SKILL.md

Chaque skill est un répertoire contenant un fichier `SKILL.md` avec un frontmatter YAML et du contenu markdown :

```
.ai/skills/
  └── my-skill/
      └── SKILL.md
```

### Structure

```markdown
---
name: my-skill
description: A brief description of what this skill does
version: 1.0.0
author: Your Name
tags: tag1, tag2, tag3
globs: src/**/*.ts, tests/**
---

# My Skill

## Instructions

Detailed instructions for the AI when this skill is active.

## When to Use

Describe when this skill should be activated.

## Behavior Rules

### ALWAYS
- Rule 1
- Rule 2

### NEVER
- Rule 1
- Rule 2
```

### Champs du Frontmatter

| Champ | Requis | Description |
|-------|--------|-------------|
| `name` | Oui | Identifiant unique du skill |
| `description` | Oui | Brève description (affichée dans `aidf skills list`) |
| `version` | Non | Version sémantique |
| `author` | Non | Auteur du skill |
| `tags` | Non | Tags séparés par des virgules pour la catégorisation |
| `globs` | Non | Patterns de fichiers séparés par des virgules auxquels le skill se rapporte |

---

## Découverte des Skills

AIDF découvre les skills depuis trois emplacements, dans l'ordre :

| Priorité | Emplacement | Label source | Description |
|----------|-------------|--------------|-------------|
| 1 | `.ai/skills/` | `project` | Skills spécifiques au projet |
| 2 | `~/.aidf/skills/` | `global` | Skills utilisateur partagés entre les projets |
| 3 | Répertoires de configuration | `config` | Chemins supplémentaires définis dans `config.yml` |

Tous les skills découverts sont chargés et injectés automatiquement dans le prompt d'exécution.

---

## Configuration

Ajoutez la section `skills` à `.ai/config.yml` :

```yaml
skills:
  enabled: true              # default: true (omit section to enable)
  directories:               # additional directories to scan for skills
    - /path/to/shared/skills
    - ../other-project/.ai/skills
```

Pour désactiver entièrement les skills :

```yaml
skills:
  enabled: false
```

Si la section `skills` est omise, les skills sont activés par défaut et AIDF analysera les répertoires standards (`.ai/skills/` et `~/.aidf/skills/`).

---

## Commandes CLI

### Lister les skills

```bash
aidf skills list
```

Affiche tous les skills découverts avec leur source (project/global/config), leur description et leurs tags.

### Créer un nouveau skill

```bash
aidf skills init my-skill           # creates .ai/skills/my-skill/SKILL.md
aidf skills init my-skill --global  # creates ~/.aidf/skills/my-skill/SKILL.md
```

Génère un modèle SKILL.md prêt à être édité.

### Valider les skills

```bash
aidf skills validate              # validate all discovered skills
aidf skills validate my-skill     # validate a specific skill by name
```

Vérifie les champs du frontmatter, la structure du contenu et signale les erreurs.

### Ajouter un skill externe

```bash
aidf skills add /path/to/skill-directory
```

Copie un skill dans le répertoire `.ai/skills/` du projet après validation.

---

## Comment les Skills Sont Injectés

Pendant l'exécution, les skills sont injectés dans le prompt en XML suivant le format agentskills.io :

```xml
<available_skills>
<skill name="my-skill">
<description>A brief description</description>
<tags>tag1, tag2</tags>
<instructions>
# My Skill
...full markdown content...
</instructions>
</skill>
</available_skills>
```

Ce bloc XML est placé dans le prompt après la section Plan d'Implémentation et avant les Instructions d'Exécution.

---

## Skills Intégrés

AIDF est livré avec 6 skills intégrés qui correspondent aux rôles intégrés :

| Skill | Description |
|-------|-------------|
| `aidf-architect` | Conception système, patterns, analyse des compromis |
| `aidf-developer` | Implémentation de code propre, correspondance de patterns |
| `aidf-tester` | Couverture de tests, cas limites, fiabilité |
| `aidf-reviewer` | Revue de code, qualité, retour constructif |
| `aidf-documenter` | Rédaction technique, documentation API, guides |
| `aidf-task-templates` | Modèles de tâches structurés pour les 6 types de tâches |

Ceux-ci sont inclus dans le répertoire `templates/.ai/skills/` et sont copiés dans votre projet lorsque vous exécutez `aidf init`.

---

## Exemples

### Ajouter un skill personnalisé

```bash
# Create the skill
aidf skills init eslint-expert

# Edit the SKILL.md
# Then validate it
aidf skills validate eslint-expert
```

### Partager des skills globalement

```bash
# Create a global skill available in all projects
aidf skills init code-security --global

# It lives at ~/.aidf/skills/code-security/SKILL.md
```

### Utiliser des répertoires supplémentaires

Si votre équipe maintient un dépôt de skills partagé :

```yaml
# .ai/config.yml
skills:
  directories:
    - ../shared-aidf-skills
```

### Désactiver les skills pour une exécution

Les skills sont automatiquement chargés lorsqu'ils sont disponibles. Pour les désactiver :

```yaml
# .ai/config.yml
skills:
  enabled: false
```
