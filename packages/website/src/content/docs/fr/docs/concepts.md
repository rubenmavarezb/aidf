---
title: Concepts Fondamentaux
description: Comprenez le problème que résout AIDF et ses composants principaux — AGENTS.md, Rôles, Tâches et Plans.
---

## Le Problème que Résout AIDF

Les assistants IA sont puissants mais aveugles au contexte. Ils ne connaissent pas :

- L'architecture de votre projet
- Vos conventions de code
- Votre structure de fichiers
- Ce qu'ils doivent ou ne doivent pas toucher
- Quand une tâche est vraiment "terminée"

Cela entraîne :

- Du code incohérent qui ne correspond pas à vos standards
- Des modifications dans des endroits qui ne devraient pas être modifiés
- Un "terminé" qui nécessite une révision humaine approfondie
- Des explications répétitives du même contexte

AIDF résout ce problème en fournissant un **contexte structuré** qui accompagne votre projet.

---

## Composants Principaux

### 1. AGENTS.md - Le Contexte Maître

C'est la source unique de vérité sur votre projet pour les assistants IA. Il contient :

```markdown
# Project Context

## Overview
What this project is and does.

## Architecture
How the code is organized.

## Conventions
Coding standards, naming patterns, file structures.

## Technology Stack
Languages, frameworks, tools.

## Quality Standards
Testing requirements, linting rules, type safety.

## What NOT to Do
Explicit boundaries and restrictions.
```

**Point clé** : Rédigez AGENTS.md comme si vous intégriez un nouveau développeur qui travaillera de manière autonome.

### 2. Rôles - Des Personas Spécialisées

Au lieu d'une assistance IA générique, AIDF définit des rôles avec une expertise spécifique :

| Rôle | Focus | Exemples de Tâches |
|------|-------|---------------------|
| Architect | Conception système, patterns | Concevoir une nouvelle fonctionnalité, planifier un refactoring |
| Developer | Implémentation | Construire un composant, corriger un bug |
| Tester | Assurance qualité | Écrire des tests, améliorer la couverture |
| Reviewer | Qualité du code | Revoir une PR, suggérer des améliorations |
| Documenter | Documentation | Rédiger la documentation, ajouter des commentaires |

Chaque rôle possède :

- **Expertise** : Ce qu'il connaît en profondeur
- **Responsabilités** : Ce qu'il fait
- **Contraintes** : Ce qu'il évite
- **Critères de qualité** : Comment évaluer son travail

### 3. Tâches - Des Prompts Exécutables

Les tâches sont des prompts structurés qui contiennent tout le nécessaire pour l'exécution :

```markdown
# TASK

## Goal
One clear sentence.

## Task Type
component | refactor | test | docs | architecture

## Suggested Roles
- developer
- tester

## Scope
### Allowed
- src/components/Button/**

### Forbidden
- src/core/**
- Any configuration files

## Requirements
Detailed specifications...

## Definition of Done
- [ ] Verifiable criterion 1
- [ ] Verifiable criterion 2
- [ ] `npm test` passes
```

### 4. Plans - Initiatives Multi-Tâches

Pour des travaux plus importants, les plans regroupent des tâches liées :

```
plans/
└── new-auth-system/
    ├── README.md           # Overview and sequencing
    └── tasks/
        ├── 001-design-schema.md
        ├── 002-implement-api.md
        ├── 003-build-ui.md
        └── 004-write-tests.md
```

---

## Le Modèle d'Exécution

```
┌─────────────────────────────────────────────────────────┐
│                     AGENTS.md                           │
│              (Contexte du projet)                       │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                  Définition du Rôle                      │
│         (Connaissances spécialisées + contraintes)       │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                 Définition de la Tâche                   │
│       (Objectif précis + portée + critères de fin)       │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    Exécution par l'IA                    │
│              (Suit les trois couches)                    │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                      Validation                          │
│            (Vérification Definition of Done)             │
└─────────────────────────────────────────────────────────┘
```

---

## Couches de Contexte

AIDF utilise un **contexte en couches** où chaque couche ajoute de la spécificité :

### Couche 1 : Contexte Projet (AGENTS.md)

- S'applique toujours
- Définit les règles globales
- Établit les conventions de base

### Couche 2 : Contexte de Rôle (roles/*.md)

- S'applique lorsque le rôle est activé
- Ajoute des connaissances spécialisées
- Restreint le focus

### Couche 3 : Contexte de Tâche (tasks/*.md)

- S'applique à une tâche spécifique
- Définit la portée exacte
- Fixe les critères de complétion

**Exemple de flux** :

```
AGENTS.md says: "Use TypeScript strict mode"
     +
roles/tester.md says: "Always test accessibility"
     +
tasks/add-button.md says: "Only modify src/atoms/Button/"
     =
L'IA sait exactement quoi faire, comment le faire et où le faire
```

---

## Contrôle de Portée

L'une des fonctionnalités les plus importantes d'AIDF est la **portée explicite** :

```markdown
## Scope

### Allowed
- src/components/NewFeature/**
- src/utils/helpers.ts

### Forbidden
- src/core/**
- Any *.config.* files
- package.json
```

Cela empêche :

- Les modifications accidentelles du code critique
- Le dépassement de portée au-delà de la tâche
- Les "améliorations" bien intentionnées ailleurs

**Règle** : Si ce n'est pas dans Allowed, c'est interdit par défaut.

---

## Définition de Terminé

Chaque tâche doit avoir des critères de complétion vérifiables :

### Mauvais (Vague)

```markdown
## Definition of Done
- Component works correctly
- Code is clean
```

### Bon (Vérifiable)

```markdown
## Definition of Done
- [ ] Component renders without errors
- [ ] All props are typed (no `any`)
- [ ] Unit tests cover: render, props, events
- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] Storybook story exists with all variants
```

L'IA devrait pouvoir vérifier chaque critère de manière programmatique ou par observation claire.

---

## Prochaines Étapes

- [Guide de Configuration](/aidf/fr/docs/setup/) - Intégrer AIDF dans votre projet
- [Rédiger AGENTS.md](/aidf/fr/docs/agents-file/) - Créer votre document de contexte
- [Définir les Rôles](/aidf/fr/docs/roles/) - Configurer des personas spécialisées
