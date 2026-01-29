---
title: Bonnes Pratiques
description: Patterns et anti-patterns tirés de l'expérience réelle du développement assisté par IA avec AIDF.
---

Patterns et anti-patterns tirés de l'expérience réelle du développement assisté par IA.

---

## Gestion du Contexte

### Faire : Charger le Contexte en Amont

Donnez à l'IA le contexte du projet au début d'une session, pas au compte-gouttes.

**Mauvais :**
```
Vous : "Add a button"
IA : *Crée un bouton générique*
Vous : "Actually, we use TypeScript"
IA : *Réécrit avec des types*
Vous : "And we have specific naming conventions"
IA : *Réécrit encore*
```

**Bon :**
```
Vous : *Fournit AGENTS.md + rôle + tâche*
IA : *Crée le bouton en respectant toutes les conventions dès la première fois*
```

### Faire : Garder AGENTS.md à Jour

Traitez AGENTS.md comme une documentation vivante. Mettez-le à jour lorsque :

- Vous établissez de nouveaux patterns
- Vous prenez des décisions architecturales
- Vous apprenez des erreurs de l'IA
- Les conventions du projet évoluent

### Ne Pas Faire : Supposer que l'IA se Souvient

Même dans les longues sessions, le contexte de l'IA peut dériver. Pour les tâches importantes :

- Référencez des sections spécifiques d'AGENTS.md
- Reformulez les contraintes critiques
- Vérifiez la compréhension avant l'exécution

---

## Conception des Tâches

### Faire : Être Explicite sur la Portée

```markdown
## Scope

### Allowed
- src/components/Button/**
- src/components/index.ts (add export only)

### Forbidden
- src/core/**
- src/utils/**
- Any *.config.* files
```

### Faire : Fournir des Exemples

Lorsque vous avez des attentes spécifiques :

```markdown
## Requirements

### Example Usage

\`\`\`tsx
// Basic
<Button variant="primary">Click me</Button>

// With icon
<Button leadingIcon={<PlusIcon />}>Add Item</Button>

// As link
<Button as="a" href="/home">Go Home</Button>
\`\`\`
```

### Ne Pas Faire : Laisser Place à l'Interprétation

**Mauvais :**
```markdown
## Requirements
Make it look nice and work well.
```

**Bon :**
```markdown
## Requirements
- Follow design tokens in `src/tokens/`
- Support hover, active, focus, and disabled states
- Minimum touch target: 44x44px
- Color contrast: WCAG AA (4.5:1 for text)
```

### Ne Pas Faire : Surcharger les Tâches

**Mauvais :**
```markdown
## Goal
Build the entire checkout flow including cart, shipping, payment, and confirmation.
```

**Bon :**
```markdown
## Goal
Create the CartSummary component displaying line items with quantities and totals.
```

---

## Assurance Qualité

### Faire : Définir une Complétion Vérifiable

Chaque élément de la "Definition of Done" devrait être vérifiable :

```markdown
## Definition of Done
- [ ] `pnpm lint` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes
- [ ] Component has Storybook story
- [ ] All props are documented with JSDoc
```

### Faire : Exiger des Tests

Si votre projet a des standards de test, appliquez-les :

```markdown
## Definition of Done
- [ ] Unit tests exist for: render, props, events
- [ ] Accessibility test with `expectNoA11yViolations`
- [ ] Coverage meets 80% threshold
```

### Ne Pas Faire : Sauter la Revue

La sortie de l'IA devrait toujours être revue. Automatisez les vérifications, mais la revue humaine détecte :

- Les erreurs logiques qui passent les tests
- Les violations de conventions qui ne sont pas lintées
- La dérive architecturale
- Les problèmes de sécurité

---

## Utilisation des Rôles

### Faire : Associer le Rôle à la Tâche

| Tâche | Meilleur Rôle |
|-------|---------------|
| "Build new component" | developer |
| "Design new feature" | architect |
| "Add test coverage" | tester |
| "Review this PR" | reviewer |
| "Write documentation" | documenter |

### Faire : Utiliser les Contraintes des Rôles

Les rôles ont des contraintes intégrées. Le rôle tester ne modifie pas le code d'implémentation. Le rôle reviewer suggère mais ne réécrit pas.

### Ne Pas Faire : Mélanger les Responsabilités

**Mauvais :**
```markdown
## Goal
Write tests and fix any bugs you find.
```

Cela mélange les rôles tester et developer. Divisez en :

1. Tâche : Écrire des tests (rôle tester)
2. Tâche : Corriger les bugs trouvés par les tests (rôle developer)

---

## Patterns d'Itération

### Faire : Commencer Petit, Itérer

1. Créer l'implémentation de base
2. Ajouter les tests
3. Affiner en fonction des retours
4. Répéter

### Faire : Définir des Points de Contrôle pour les Travaux Complexes

Pour les tâches importantes, définissez des points de contrôle :

```markdown
## Checkpoints

### Checkpoint 1: Structure
- [ ] All files created
- [ ] Basic component renders

### Checkpoint 2: Functionality
- [ ] All props work
- [ ] Events fire correctly

### Checkpoint 3: Quality
- [ ] Tests pass
- [ ] Lint passes
- [ ] A11y passes
```

### Ne Pas Faire : Laisser l'IA sans Limites

Fixez des limites claires et des points d'arrêt. L'IA continuera à "améliorer" indéfiniment si vous la laissez faire.

---

## Gestion des Erreurs

### Faire : Anticiper et Gérer les Échecs

L'IA fera des erreurs. Votre workflow devrait :

1. Détecter les erreurs via des vérifications automatisées
2. Fournir un retour clair
3. Permettre l'itération

### Faire : Apprendre des Échecs

Lorsque l'IA fait systématiquement la même erreur :

1. Ajoutez le bon pattern dans AGENTS.md
2. Ajoutez un "Don't" au rôle concerné
3. Ajoutez une validation à la Definition of Done

### Ne Pas Faire : Blâmer l'Outil

Si l'IA continue de faire la même erreur, le contexte est probablement peu clair. Améliorez AGENTS.md plutôt que de combattre l'outil.

---

## Sécurité

### Faire : Définir les Chemins Interdits

Protégez toujours :

```markdown
### Forbidden
- .env*
- **/credentials*
- **/secrets*
- .github/workflows/** (CI/CD)
```

### Faire : Revoir le Code Sensible à la Sécurité

Ne laissez jamais du code généré par l'IA touchant l'authentification, les paiements ou les données utilisateur sans revue.

### Ne Pas Faire : Inclure des Secrets dans le Contexte

Ne mettez jamais de clés API, de mots de passe ou de tokens dans AGENTS.md ou les tâches.

---

## Patterns d'Équipe

### Faire : Partager AGENTS.md

AGENTS.md devrait être commité dans le contrôle de version. C'est de la documentation qui aide :

- Les nouveaux membres de l'équipe à comprendre le projet
- Les assistants IA à comprendre les conventions
- Votre futur vous à se souvenir des décisions

### Faire : Standardiser les Modèles de Tâches

Utilisez des modèles de tâches cohérents dans toute l'équipe :

- Même structure
- Même format de Definition of Done
- Mêmes conventions de portée

### Ne Pas Faire : Créer des Conventions Personnelles

Si un développeur utilise des patterns différents de ceux décrits dans AGENTS.md, l'IA est désorientée. Gardez les conventions cohérentes.

---

## Performance

### Faire : Mettre en Cache le Contexte

Si votre outil IA le supporte, mettez en cache AGENTS.md et les définitions de rôles. Les renvoyer à chaque message gaspille des tokens et du temps.

### Faire : Utiliser le Niveau de Détail Approprié

- Pour les tâches simples : La définition de la tâche peut suffire
- Pour les tâches complexes : AGENTS.md complet + rôle + tâche

### Ne Pas Faire : Sur-Spécifier les Tâches Simples

```markdown
# TASK

## Goal
Fix typo in README.md: "teh" → "the"

## Task Type
docs

## Scope
### Allowed
- README.md

### Forbidden
- Everything else

## Requirements
Find "teh" and replace with "the".

## Definition of Done
- [ ] Typo is fixed
- [ ] No other changes made
```

C'est excessif. Pour les tâches triviales, un simple prompt suffit.

---

## Évolution

### Faire : Commencer Simple

Commencez avec :

1. Un AGENTS.md basique
2. Un ou deux rôles
3. Un modèle de tâche simple

Ajoutez de la complexité au fur et à mesure que vous apprenez ce dont votre projet a besoin.

### Faire : Mesurer l'Efficacité

Suivez :

- Le temps entre la création de la tâche et sa complétion
- Le nombre d'itérations nécessaires
- Les types d'erreurs qui passent entre les mailles
- Les problèmes spécifiques à l'IA

### Ne Pas Faire : Sur-Concevoir Trop Tôt

Vous n'avez pas besoin de 15 rôles et 50 pages d'AGENTS.md dès le premier jour. Construisez ce dont vous avez besoin, quand vous en avez besoin.

---

## Checklist Récapitulatif

Avant d'exécuter une tâche :

- [ ] AGENTS.md est à jour
- [ ] Le rôle approprié est sélectionné
- [ ] La tâche a un objectif clair
- [ ] La portée est explicitement définie
- [ ] Les exigences sont spécifiques
- [ ] La Definition of Done est vérifiable
- [ ] La revue humaine est prévue
