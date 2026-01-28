# AIDF Git Hooks

AIDF includes git hooks that validate your workflow automatically at commit and push time.

## What the Hooks Do

| Hook | Purpose |
|------|---------|
| `pre-commit` | Validates staged files against active task scopes (forbidden paths) |
| `commit-msg` | Validates conventional commit message format |
| `pre-push` | Runs configured validation commands (lint, typecheck, tests) |

## Quick Start

```bash
# Install hooks (auto-detects husky if present)
aidf hooks install

# Remove hooks
aidf hooks uninstall
```

## Installation Methods

### Direct Git Hooks

If your project does not use husky or pre-commit, AIDF installs hooks directly into `.git/hooks/`:

```bash
aidf hooks install
```

This creates executable scripts in `.git/hooks/pre-commit`, `.git/hooks/commit-msg`, and `.git/hooks/pre-push`.

Use `--force` to overwrite existing hooks:

```bash
aidf hooks install --force
```

### Husky Integration

AIDF auto-detects [husky](https://typicode.github.io/husky/) by checking for:

- A `.husky/` directory
- `husky` in `package.json` dependencies
- A `prepare` script containing `husky`

When husky is detected, hooks are installed in `.husky/` instead of `.git/hooks/`.

You can also force husky mode:

```bash
aidf hooks install --husky
```

#### Setting up husky from scratch

If your project doesn't have husky yet:

```bash
npm install --save-dev husky
npx husky init
aidf hooks install --husky
```

#### Example: husky + lint-staged + AIDF

A common setup combines husky, lint-staged, and AIDF hooks:

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

When AIDF detects existing hooks, it appends its validation rather than replacing the file.

### pre-commit Framework (Python)

For projects using the [pre-commit](https://pre-commit.com/) framework:

```bash
aidf hooks install --pre-commit
```

This generates a `.pre-commit-config.yaml` (or appends to an existing one):

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

Then activate with:

```bash
pre-commit install
```

## Hook Details

### pre-commit: Scope Validation

The pre-commit hook reads all active (non-completed) task files in `.ai/tasks/` and checks staged files against their forbidden path patterns.

Behavior depends on the `scopeEnforcement` setting in `.ai/config.yml`:

| Mode | Behavior |
|------|----------|
| `strict` | Blocks commit if any staged file matches a forbidden pattern |
| `ask` | Shows a warning but allows the commit |
| `permissive` | Skips validation entirely |

### commit-msg: Format Validation

Validates that commit messages follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope?): description
```

Valid types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

Examples:
```
feat: add user authentication
fix(api): resolve timeout issue
docs: update README
refactor(auth): simplify token validation
```

Merge and revert commits are allowed without validation.

The hook also warns (but does not block) if the header exceeds 72 characters.

### pre-push: Validation Commands

Runs validation commands from `.ai/config.yml` before pushing:

```yaml
validation:
  lint: npm run lint
  typecheck: npm run typecheck
  test: npm run test
```

If any command fails, the push is blocked.

## Uninstalling

```bash
aidf hooks uninstall
```

This removes only AIDF-generated hooks. If AIDF was appended to an existing husky hook, only the AIDF block is removed.
