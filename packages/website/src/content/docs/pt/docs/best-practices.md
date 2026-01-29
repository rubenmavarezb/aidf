---
title: Boas Práticas
description: Padrões e anti-padrões aprendidos com desenvolvimento assistido por IA no mundo real com AIDF.
---

Padrões e anti-padrões aprendidos com desenvolvimento assistido por IA no mundo real.

---

## Gerenciamento de Contexto

### Faça: Carregue o Contexto Antecipadamente

Forneça o contexto do projeto à IA no início da sessão, não aos poucos.

**Ruim:**
```
Você: "Add a button"
IA: *Cria um botão genérico*
Você: "Actually, we use TypeScript"
IA: *Reescreve com tipos*
Você: "And we have specific naming conventions"
IA: *Reescreve novamente*
```

**Bom:**
```
Você: *Fornece AGENTS.md + role + task*
IA: *Cria o botão seguindo todas as convenções na primeira vez*
```

### Faça: Mantenha o AGENTS.md Atualizado

Trate o AGENTS.md como documentação viva. Atualize quando:

- Você estabelecer novos padrões
- Você tomar decisões arquiteturais
- Você aprender com erros da IA
- As convenções do projeto evoluírem

### Não Faça: Assuma que a IA Lembra

Mesmo em sessões longas, o contexto da IA pode se perder. Para tarefas importantes:

- Referencie seções específicas do AGENTS.md
- Reafirme restrições críticas
- Verifique o entendimento antes da execução

---

## Design de Tasks

### Faça: Seja Explícito Sobre o Escopo

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

### Faça: Forneça Exemplos

Quando você tem expectativas específicas:

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

### Não Faça: Deixe Espaço para Interpretação

**Ruim:**
```markdown
## Requirements
Make it look nice and work well.
```

**Bom:**
```markdown
## Requirements
- Follow design tokens in `src/tokens/`
- Support hover, active, focus, and disabled states
- Minimum touch target: 44x44px
- Color contrast: WCAG AA (4.5:1 for text)
```

### Não Faça: Sobrecarregue Tasks

**Ruim:**
```markdown
## Goal
Build the entire checkout flow including cart, shipping, payment, and confirmation.
```

**Bom:**
```markdown
## Goal
Create the CartSummary component displaying line items with quantities and totals.
```

---

## Garantia de Qualidade

### Faça: Defina Conclusão Verificável

Cada item da "Definition of Done" deve ser verificável:

```markdown
## Definition of Done
- [ ] `pnpm lint` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes
- [ ] Component has Storybook story
- [ ] All props are documented with JSDoc
```

### Faça: Exija Testes

Se seu projeto tem padrões de teste, aplique-os:

```markdown
## Definition of Done
- [ ] Unit tests exist for: render, props, events
- [ ] Accessibility test with `expectNoA11yViolations`
- [ ] Coverage meets 80% threshold
```

### Não Faça: Pule a Revisão

A saída da IA deve sempre ser revisada. Automatize verificações, mas a revisão humana identifica:

- Erros de lógica que passam nos testes
- Violações de convenção que não são detectadas pelo linter
- Desvios de arquitetura
- Problemas de segurança

---

## Uso de Roles

### Faça: Combine o Role com a Tarefa

| Tarefa | Melhor Role |
|--------|-------------|
| "Build new component" | developer |
| "Design new feature" | architect |
| "Add test coverage" | tester |
| "Review this PR" | reviewer |
| "Write documentation" | documenter |

### Faça: Use as Restrições do Role

Roles têm restrições embutidas. O role tester não modifica código de implementação. O role reviewer sugere mas não reescreve.

### Não Faça: Misture Responsabilidades

**Ruim:**
```markdown
## Goal
Write tests and fix any bugs you find.
```

Isso mistura os roles tester e developer. Divida em:

1. Task: Escrever testes (role tester)
2. Task: Corrigir bugs encontrados nos testes (role developer)

---

## Padrões de Iteração

### Faça: Comece Pequeno, Itere

1. Crie a implementação básica
2. Adicione testes
3. Refine com base no feedback
4. Repita

### Faça: Defina Checkpoints em Trabalhos Complexos

Para tarefas grandes, defina checkpoints:

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

### Não Faça: Deixe a IA Rodar Sem Limites

Defina limites e pontos de parada claros. A IA vai continuar "melhorando" para sempre se você permitir.

---

## Tratamento de Erros

### Faça: Espere e Trate Falhas

A IA cometerá erros. Seu fluxo de trabalho deve:

1. Capturar erros através de verificações automatizadas
2. Fornecer feedback claro
3. Permitir iteração

### Faça: Aprenda com as Falhas

Quando a IA comete o mesmo erro consistentemente:

1. Adicione o padrão correto ao AGENTS.md
2. Adicione um "Don't" ao role relevante
3. Adicione validação à Definition of Done

### Não Faça: Culpe a Ferramenta

Se a IA continua cometendo o mesmo erro, o contexto provavelmente não está claro. Melhore o AGENTS.md em vez de lutar contra a ferramenta.

---

## Segurança

### Faça: Defina Caminhos Proibidos

Sempre proteja:

```markdown
### Forbidden
- .env*
- **/credentials*
- **/secrets*
- .github/workflows/** (CI/CD)
```

### Faça: Revise Código Sensível à Segurança

Nunca permita que código gerado por IA que toca autenticação, pagamentos ou dados de usuários passe sem revisão.

### Não Faça: Inclua Segredos no Contexto

Nunca coloque chaves de API, senhas ou tokens no AGENTS.md ou nas tasks.

---

## Padrões de Equipe

### Faça: Compartilhe o AGENTS.md

O AGENTS.md deve ser commitado no controle de versão. É documentação que ajuda:

- Novos membros da equipe a entender o projeto
- Assistentes de IA a entender convenções
- O seu eu futuro a lembrar das decisões

### Faça: Padronize Templates de Tasks

Use templates de task consistentes em toda a equipe:

- Mesma estrutura
- Mesmo formato de Definition of Done
- Mesmas convenções de escopo

### Não Faça: Crie Convenções Pessoais

Se um desenvolvedor usa padrões diferentes do que o AGENTS.md descreve, a IA fica confusa. Mantenha as convenções consistentes.

---

## Performance

### Faça: Cache de Contexto

Se sua ferramenta de IA suporta, faça cache do AGENTS.md e das definições de role. Reenviá-los a cada mensagem desperdiça tokens e tempo.

### Faça: Use o Nível de Detalhe Apropriado

- Para tarefas simples: A definição da task pode ser suficiente
- Para tarefas complexas: AGENTS.md completo + role + task

### Não Faça: Especifique Demais Tarefas Simples

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

Isso é excessivo. Para tarefas triviais, um prompt simples é suficiente.

---

## Evolução

### Faça: Comece Simples

Comece com:

1. AGENTS.md básico
2. Um ou dois roles
3. Template de task simples

Adicione complexidade conforme aprende o que seu projeto precisa.

### Faça: Meça a Eficácia

Acompanhe:

- Tempo desde a criação até a conclusão da task
- Número de iterações necessárias
- Tipos de erros que passam despercebidos
- Problemas específicos da IA

### Não Faça: Engenharia Excessiva no Início

Você não precisa de 15 roles e 50 páginas de AGENTS.md no primeiro dia. Construa o que precisa, quando precisa.

---

## Checklist Resumo

Antes de executar uma task:

- [ ] O AGENTS.md está atualizado
- [ ] O role apropriado está selecionado
- [ ] A task tem um objetivo claro
- [ ] O escopo está explicitamente definido
- [ ] Os requisitos são específicos
- [ ] A Definition of Done é verificável
- [ ] A revisão humana está planejada
