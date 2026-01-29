---
title: Git Hooks
description: Validez la conformité de portée, le format des messages de commit et exécutez les vérifications de qualité automatiquement avec les git hooks AIDF.
---

AIDF inclut des git hooks qui valident automatiquement votre workflow au moment du commit et du push.

## Ce que Font les Hooks

| Hook | Objectif |
|------|----------|
| `pre-commit` | Valide les fichiers staged par rapport aux portées des tâches actives (chemins interdits) |
| `commit-msg` | Valide le format de message de commit conventionnel |
| `pre-push` | Exécute les commandes de validation configurées (lint, typecheck, tests) |

## Démarrage Rapide

```bash
# Install hooks (auto-detects husky if present)
aidf hooks install

# Remove hooks
aidf hooks uninstall
```

## Méthodes d'Installation

### Git Hooks Directs

Si votre projet n'utilise pas husky ou pre-commit, AIDF installe les hooks directement dans `.git/hooks/` :

```bash
aidf hooks install
```

Cela crée des scripts exécutables dans `.git/hooks/pre-commit`, `.git/hooks/commit-msg` et `.git/hooks/pre-push`.

Utilisez `--force` pour écraser les hooks existants :

```bash
aidf hooks install --force
```

### Intégration Husky

AIDF détecte automatiquement [husky](https://typicode.github.io/husky/) en vérifiant :

- Un répertoire `.husky/`
- `husky` dans les dépendances de `package.json`
- Un script `prepare` contenant `husky`

Lorsque husky est détecté, les hooks sont installés dans `.husky/` au lieu de `.git/hooks/`.

Vous pouvez également forcer le mode husky :

```bash
aidf hooks install --husky
```

#### Configurer husky depuis zéro

Si votre projet n'a pas encore husky :

```bash
npm install --save-dev husky
npx husky init
aidf hooks install --husky
```

#### Exemple : husky + lint-staged + AIDF

Une configuration courante combine husky, lint-staged et les hooks AIDF :

```json
// package.json
{
  "scripts": {
    "prepare": "husky"
  },
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md}": ["prettier --write"]
  }
}
```

`.husky/pre-commit` :
```sh
npx lint-staged
# AIDF - scope and format validation
npx aidf-hook-pre-commit
```

Lorsque AIDF détecte des hooks existants, il ajoute sa validation à la suite plutôt que de remplacer le fichier.

### Framework pre-commit (Python)

Pour les projets utilisant le framework [pre-commit](https://pre-commit.com/) :

```bash
aidf hooks install --pre-commit
```

Cela génère un `.pre-commit-config.yaml` (ou s'ajoute à un fichier existant) :

```yaml
repos:
  - repo: local
    hooks:
      - id: aidf-scope-check
        name: AIDF Scope Validation
        entry: npx aidf-hook-pre-commit
        language: system
        always_run: true
      - id: aidf-commit-msg
        name: AIDF Commit Message Format
        entry: npx aidf-hook-commit-msg
        language: system
        stages: [commit-msg]
```

Puis activez avec :

```bash
pre-commit install
```

## Détails des Hooks

### pre-commit : Validation de Portée

Le hook pre-commit lit tous les fichiers de tâches actives (non terminées) dans `.ai/tasks/` et vérifie les fichiers staged par rapport à leurs patterns de chemins interdits.

Le comportement dépend du paramètre `scopeEnforcement` dans `.ai/config.yml` :

| Mode | Comportement |
|------|-------------|
| `strict` | Bloque le commit si un fichier staged correspond à un pattern interdit |
| `ask` | Affiche un avertissement mais autorise le commit |
| `permissive` | Ignore complètement la validation |

### commit-msg : Validation du Format

Valide que les messages de commit suivent les [Conventional Commits](https://www.conventionalcommits.org/) :

```
type(scope?): description
```

Types valides : `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

Exemples :
```
feat: add user authentication
fix(api): resolve timeout issue
docs: update README
refactor(auth): simplify token validation
```

Les commits de merge et de revert sont autorisés sans validation.

Le hook avertit également (mais ne bloque pas) si l'en-tête dépasse 72 caractères.

### pre-push : Commandes de Validation

Exécute les commandes de validation depuis `.ai/config.yml` avant le push :

```yaml
validation:
  lint: npm run lint
  typecheck: npm run typecheck
  test: npm run test
```

Si une commande échoue, le push est bloqué.

## Désinstallation

```bash
aidf hooks uninstall
```

Cela supprime uniquement les hooks générés par AIDF. Si AIDF a été ajouté à un hook husky existant, seul le bloc AIDF est supprimé.
