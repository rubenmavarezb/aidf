---
title: Git Hooks
description: Valida el cumplimiento de alcance, formato de mensajes de commit y ejecuta comprobaciones de calidad automáticamente con git hooks de AIDF.
---

AIDF incluye git hooks que validan tu flujo de trabajo automáticamente en el momento del commit y push.

## Qué Hacen los Hooks

| Hook | Propósito |
|------|-----------|
| `pre-commit` | Valida archivos en staging contra los alcances de tareas activas (rutas prohibidas) |
| `commit-msg` | Valida el formato de mensaje de commit convencional |
| `pre-push` | Ejecuta comandos de validación configurados (lint, typecheck, tests) |

## Inicio Rápido

```bash
# Install hooks (auto-detects husky if present)
aidf hooks install

# Remove hooks
aidf hooks uninstall
```

## Métodos de Instalación

### Git Hooks Directos

Si tu proyecto no usa husky ni pre-commit, AIDF instala los hooks directamente en `.git/hooks/`:

```bash
aidf hooks install
```

Esto crea scripts ejecutables en `.git/hooks/pre-commit`, `.git/hooks/commit-msg` y `.git/hooks/pre-push`.

Usa `--force` para sobrescribir hooks existentes:

```bash
aidf hooks install --force
```

### Integración con Husky

AIDF detecta automáticamente [husky](https://typicode.github.io/husky/) verificando:

- Un directorio `.husky/`
- `husky` en las dependencias de `package.json`
- Un script `prepare` que contenga `husky`

Cuando se detecta husky, los hooks se instalan en `.husky/` en lugar de `.git/hooks/`.

También puedes forzar el modo husky:

```bash
aidf hooks install --husky
```

#### Configurar husky desde cero

Si tu proyecto aún no tiene husky:

```bash
npm install --save-dev husky
npx husky init
aidf hooks install --husky
```

#### Ejemplo: husky + lint-staged + AIDF

Una configuración común combina husky, lint-staged y hooks de AIDF:

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

`.husky/pre-commit`:
```sh
npx lint-staged
# AIDF - scope and format validation
npx aidf-hook-pre-commit
```

Cuando AIDF detecta hooks existentes, agrega su validación en lugar de reemplazar el archivo.

### Framework pre-commit (Python)

Para proyectos que usan el framework [pre-commit](https://pre-commit.com/):

```bash
aidf hooks install --pre-commit
```

Esto genera un `.pre-commit-config.yaml` (o se agrega a uno existente):

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

Luego actívalo con:

```bash
pre-commit install
```

## Detalles de los Hooks

### pre-commit: Validación de Alcance

El hook pre-commit lee todos los archivos de tareas activas (no completadas) en `.ai/tasks/` y verifica los archivos en staging contra sus patrones de rutas prohibidas.

El comportamiento depende de la configuración `scopeEnforcement` en `.ai/config.yml`:

| Modo | Comportamiento |
|------|---------------|
| `strict` | Bloquea el commit si algún archivo en staging coincide con un patrón prohibido |
| `ask` | Muestra una advertencia pero permite el commit |
| `permissive` | Omite la validación por completo |

### commit-msg: Validación de Formato

Valida que los mensajes de commit sigan [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope?): description
```

Tipos válidos: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

Ejemplos:
```
feat: add user authentication
fix(api): resolve timeout issue
docs: update README
refactor(auth): simplify token validation
```

Los commits de merge y revert se permiten sin validación.

El hook también advierte (pero no bloquea) si el encabezado excede los 72 caracteres.

### pre-push: Comandos de Validación

Ejecuta los comandos de validación de `.ai/config.yml` antes de hacer push:

```yaml
validation:
  lint: npm run lint
  typecheck: npm run typecheck
  test: npm run test
```

Si algún comando falla, el push se bloquea.

## Desinstalación

```bash
aidf hooks uninstall
```

Esto elimina solo los hooks generados por AIDF. Si AIDF se agregó a un hook de husky existente, solo se elimina el bloque de AIDF.
