---
title: Conceitos Fundamentais
description: Entenda o problema que o AIDF resolve e seus componentes principais — AGENTS.md, Roles, Tasks e Plans.
---

## O Problema que o AIDF Resolve

Assistentes de IA são poderosos, mas cegos ao contexto. Eles não conhecem:

- A arquitetura do seu projeto
- Suas convenções de código
- Sua estrutura de arquivos
- O que devem e não devem modificar
- Quando uma tarefa está realmente "pronta"

Isso leva a:

- Código inconsistente que não segue seus padrões
- Alterações em lugares que não deveriam ser modificados
- Um "pronto" que exige extensa revisão humana
- Explicações repetidas do mesmo contexto

O AIDF resolve isso fornecendo **contexto estruturado** que acompanha seu projeto.

---

## Componentes Principais

### 1. AGENTS.md - O Contexto Mestre

Este é a fonte única de verdade sobre seu projeto para assistentes de IA. Ele contém:

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

**Insight principal**: Escreva o AGENTS.md como se estivesse integrando um novo desenvolvedor que trabalhará de forma autônoma.

### 2. Roles - Personas Especializadas

Em vez de assistência genérica de IA, o AIDF define roles com expertise específica:

| Role | Foco | Exemplos de Tarefas |
|------|------|---------------------|
| Architect | Design de sistemas, padrões | Projetar nova funcionalidade, planejar refatoração |
| Developer | Implementação | Construir componente, corrigir bug |
| Tester | Garantia de qualidade | Escrever testes, melhorar cobertura |
| Reviewer | Qualidade de código | Revisar PR, sugerir melhorias |
| Documenter | Documentação | Escrever docs, adicionar comentários |

Cada role possui:

- **Expertise**: O que conhece profundamente
- **Responsibilities**: O que faz
- **Constraints**: O que evita
- **Quality criteria**: Como avaliar seu trabalho

### 3. Tasks - Prompts Executáveis

Tasks são prompts estruturados que contêm tudo o que é necessário para a execução:

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

### 4. Plans - Iniciativas Multi-Tarefa

Para trabalhos maiores, plans agrupam tarefas relacionadas:

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

## O Modelo de Execução

```
┌─────────────────────────────────────────────────────────┐
│                     AGENTS.md                           │
│              (Contexto do projeto)                      │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    Role Definition                       │
│         (Conhecimento especializado + restrições)        │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    Task Definition                       │
│       (Objetivo específico + escopo + critérios)         │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                     AI Execution                         │
│              (Segue todas as três camadas)               │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                      Validation                          │
│           (Verificação da Definition of Done)            │
└─────────────────────────────────────────────────────────┘
```

---

## Camadas de Contexto

O AIDF utiliza **contexto em camadas** onde cada camada adiciona especificidade:

### Camada 1: Contexto do Projeto (AGENTS.md)

- Sempre se aplica
- Define regras globais
- Estabelece convenções base

### Camada 2: Contexto do Role (roles/*.md)

- Se aplica quando o role é ativado
- Adiciona conhecimento especializado
- Restringe o foco

### Camada 3: Contexto da Task (tasks/*.md)

- Se aplica a uma tarefa específica
- Define o escopo exato
- Estabelece critérios de conclusão

**Exemplo de fluxo**:

```
AGENTS.md diz: "Use TypeScript strict mode"
     +
roles/tester.md diz: "Always test accessibility"
     +
tasks/add-button.md diz: "Only modify src/atoms/Button/"
     =
A IA sabe exatamente o que fazer, como fazer e onde fazer
```

---

## Controle de Escopo

Uma das funcionalidades mais importantes do AIDF é o **escopo explícito**:

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

Isso previne:

- Alterações acidentais em código crítico
- Expansão do escopo além da tarefa
- "Melhorias" bem-intencionadas em outros lugares

**Regra**: Se não está em Allowed, é proibido por padrão.

---

## Definition of Done

Toda tarefa deve ter critérios de conclusão verificáveis:

### Ruim (Vago)

```markdown
## Definition of Done
- Component works correctly
- Code is clean
```

### Bom (Verificável)

```markdown
## Definition of Done
- [ ] Component renders without errors
- [ ] All props are typed (no `any`)
- [ ] Unit tests cover: render, props, events
- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] Storybook story exists with all variants
```

A IA deve ser capaz de verificar cada critério de forma programática ou por observação clara.

---

## Próximos Passos

- [Guia de Configuração](/aidf/pt/docs/setup/) - Integre o AIDF ao seu projeto
- [Escrevendo o AGENTS.md](/aidf/pt/docs/agents-file/) - Crie seu documento de contexto
- [Definindo Roles](/aidf/pt/docs/roles/) - Configure personas especializadas
