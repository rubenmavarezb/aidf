---
title: Git Hooks
description: Valide conformidade de escopo, formato de mensagens de commit e execute verificações de qualidade automaticamente com git hooks do AIDF.
---

O AIDF inclui git hooks que validam seu fluxo de trabalho automaticamente no momento do commit e do push.

## O que os Hooks Fazem

| Hook | Propósito |
|------|-----------|
| `pre-commit` | Valida arquivos staged contra escopos de tasks ativas (caminhos proibidos) |
| `commit-msg` | Valida formato de mensagem de commit convencional |
| `pre-push` | Executa comandos de validação configurados (lint, typecheck, testes) |

## Início Rápido

```bash
# Install hooks (auto-detects husky if present)
aidf hooks install

# Remove hooks
aidf hooks uninstall
```

## Métodos de Instalação

### Git Hooks Diretos

Se seu projeto não usa husky ou pre-commit, o AIDF instala hooks diretamente em `.git/hooks/`:

```bash
aidf hooks install
```

Isso cria scripts executáveis em `.git/hooks/pre-commit`, `.git/hooks/commit-msg` e `.git/hooks/pre-push`.

Use `--force` para sobrescrever hooks existentes:

```bash
aidf hooks install --force
```

### Integração com Husky

O AIDF detecta automaticamente o [husky](https://typicode.github.io/husky/) verificando:

- Um diretório `.husky/`
- `husky` nas dependências do `package.json`
- Um script `prepare` contendo `husky`

Quando o husky é detectado, os hooks são instalados em `.husky/` em vez de `.git/hooks/`.

Você também pode forçar o modo husky:

```bash
aidf hooks install --husky
```

#### Configurando husky do zero

Se seu projeto ainda não tem husky:

```bash
npm install --save-dev husky
npx husky init
aidf hooks install --husky
```

#### Exemplo: husky + lint-staged + AIDF

Uma configuração comum combina husky, lint-staged e hooks do AIDF:

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

Quando o AIDF detecta hooks existentes, ele adiciona sua validação ao final em vez de substituir o arquivo.

### Framework pre-commit (Python)

Para projetos que usam o framework [pre-commit](https://pre-commit.com/):

```bash
aidf hooks install --pre-commit
```

Isso gera um `.pre-commit-config.yaml` (ou adiciona a um existente):

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

Em seguida, ative com:

```bash
pre-commit install
```

## Detalhes dos Hooks

### pre-commit: Validação de Escopo

O hook pre-commit lê todos os arquivos de task ativos (não concluídos) em `.ai/tasks/` e verifica os arquivos staged contra seus padrões de caminhos proibidos.

O comportamento depende da configuração `scopeEnforcement` em `.ai/config.yml`:

| Modo | Comportamento |
|------|---------------|
| `strict` | Bloqueia o commit se algum arquivo staged corresponder a um padrão proibido |
| `ask` | Mostra um aviso mas permite o commit |
| `permissive` | Pula a validação completamente |

### commit-msg: Validação de Formato

Valida que as mensagens de commit seguem o [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope?): description
```

Tipos válidos: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

Exemplos:
```
feat: add user authentication
fix(api): resolve timeout issue
docs: update README
refactor(auth): simplify token validation
```

Commits de merge e revert são permitidos sem validação.

O hook também avisa (mas não bloqueia) se o cabeçalho exceder 72 caracteres.

### pre-push: Comandos de Validação

Executa comandos de validação do `.ai/config.yml` antes de fazer push:

```yaml
validation:
  lint: npm run lint
  typecheck: npm run typecheck
  test: npm run test
```

Se algum comando falhar, o push é bloqueado.

## Desinstalação

```bash
aidf hooks uninstall
```

Isso remove apenas hooks gerados pelo AIDF. Se o AIDF foi adicionado a um hook husky existente, apenas o bloco do AIDF é removido.
