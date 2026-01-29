---
title: Guia de Configuração
description: Guia passo a passo para integrar o AIDF ao seu projeto com roles, tasks e templates.
---

## Pré-requisitos

- Um projeto existente (qualquer linguagem/framework)
- Conhecimento básico da arquitetura do seu projeto
- Acesso a um assistente de IA (Claude, GPT-4, Cursor, etc.)

---

## Passo 1: Criar a Estrutura

Crie a pasta `.ai` na raiz do seu projeto:

```bash
mkdir -p .ai/roles .ai/tasks .ai/plans .ai/templates
```

Ou copie do AIDF:

```bash
cp -r /path/to/aidf/templates/.ai /your/project/
```

Sua estrutura deve ficar assim:

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

## Passo 2: Criar o AGENTS.md

Este é o arquivo mais importante. Ele fornece à IA o contexto completo sobre seu projeto.

Comece com esta estrutura:

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

Veja [Escrevendo o AGENTS.md](/aidf/pt/docs/agents-file/) para orientações detalhadas.

---

## Passo 3: Selecionar Roles

Revise os roles em `.ai/roles/` e mantenha apenas os relevantes para seu projeto:

| Role | Manter Se... |
|------|--------------|
| `architect.md` | Você faz design de sistemas, refatoração |
| `developer.md` | Você escreve funcionalidades, corrige bugs |
| `tester.md` | Você escreve testes, melhora cobertura |
| `reviewer.md` | Você quer revisão de código por IA |
| `documenter.md` | Você escreve documentação |

Personalize cada role para as especificidades do seu projeto.

---

## Passo 4: Configurar Templates

Edite `.ai/templates/TASK.template.md` para adequar ao seu fluxo de trabalho:

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

## Passo 5: Adicionar ao .gitignore (Opcional)

Decida o que rastrear:

```gitignore
# Track everything (recommended)
# .ai/ is committed

# Or ignore active tasks
.ai/tasks/*.active.md

# Or ignore plans in progress
.ai/plans/*/WIP-*
```

Recomendação: **Faça commit de tudo**. A pasta `.ai` é documentação que ajuda futuros contribuidores (humanos e IA).

---

## Passo 6: Criar Sua Primeira Task

```bash
cp .ai/templates/TASK.template.md .ai/tasks/$(date +%Y-%m-%d)-my-first-task.md
```

Edite o arquivo da tarefa com seus requisitos.

---

## Passo 7: Executar

### Opção A: Contexto Completo (Recomendado para tarefas complexas)

Forneça à IA:

1. Conteúdo do AGENTS.md
2. Definição do role relevante
3. Definição da task

```
[Paste AGENTS.md]

[Paste role definition]

[Paste task]
```

### Opção B: Apenas a Task (Para tarefas simples)

Se a IA já viu o AGENTS.md na sessão:

```
[Paste task only]
```

### Opção C: Referência (Se a IA tem acesso a arquivos)

```
Read .ai/AGENTS.md, .ai/roles/developer.md, and .ai/tasks/my-task.md, then execute the task.
```

---

## Checklist de Validação

Após a configuração, verifique:

- [ ] A pasta `.ai/` existe com a estrutura correta
- [ ] O `AGENTS.md` descreve seu projeto com precisão
- [ ] Pelo menos um role está personalizado
- [ ] O template de task corresponde aos seus padrões de qualidade
- [ ] Você consegue criar e executar uma tarefa de teste simples

---

## Integração com Ferramentas

### Cursor

O Cursor lê automaticamente os arquivos do projeto. Referencie `.ai/AGENTS.md` nos seus prompts ou adicione-o ao contexto do Cursor.

### Claude (via API ou Console)

Cole o contexto relevante no início das conversas, ou use o recurso Projects para persistir o contexto.

### VS Code + Extensões

Use as configurações do workspace para referenciar os arquivos `.ai/` nas configurações de extensões de IA.

### CI/CD

Adicione validação de que as tasks atendem a Definition of Done:

```yaml
# Example: Verify no forbidden paths were modified
- name: Check scope compliance
  run: |
    # Script to verify changes are within allowed scope
```

---

## Próximos Passos

- [Escrevendo o AGENTS.md](/aidf/pt/docs/agents-file/) - Aprofunde-se nos documentos de contexto
- [Definindo Roles](/aidf/pt/docs/roles/) - Personalize personas de IA
- [Design de Tasks](/aidf/pt/docs/tasks/) - Escreva tarefas eficazes
- [Boas Práticas](/aidf/pt/docs/best-practices/) - Padrões que funcionam
