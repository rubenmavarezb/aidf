---
title: Design de Tasks
description: Aprenda a projetar tarefas bem estruturadas — a unidade atômica de trabalho no AIDF — com objetivos claros, escopo e critérios de conclusão verificáveis.
---

Tasks são a unidade atômica de trabalho no AIDF. Uma task bem projetada fornece à IA tudo o que ela precisa para executar de forma autônoma e produzir resultados consistentes.

---

## Anatomia de uma Task

```markdown
# TASK

## Goal
[One clear sentence - what must be accomplished]

## Task Type
[component | refactor | test | docs | architecture | bugfix]

## Suggested Roles
- [primary role]
- [secondary role if needed]

## Scope

### Allowed
- [paths that may be modified]

### Forbidden
- [paths that must NOT be modified]

## Requirements
[Detailed specifications]

## Definition of Done
- [ ] [Verifiable criterion 1]
- [ ] [Verifiable criterion 2]
- [ ] [Quality gate, e.g., "pnpm test passes"]

## Notes
[Additional context, warnings, tips]
```

---

## Detalhamento por Seção

### Goal

O goal é uma **única frase** que responde: "O que será verdade quando esta tarefa estiver completa?"

**Goals Ruins:**

```markdown
## Goal
Work on the button component and make it better.
```
- Vago
- Sem estado claro de conclusão
- "Better" é subjetivo

**Goals Bons:**

```markdown
## Goal
Create a Button component with primary, secondary, and tertiary variants that supports icons and loading states.
```
- Entrega específica
- Escopo claro
- Conclusão mensurável

### Task Type

Categorizar tarefas ajuda a IA a entender a natureza do trabalho:

| Tipo | Descrição | Roles Típicos |
|------|-----------|---------------|
| `component` | Criar novo componente de UI | developer, tester |
| `refactor` | Reestruturar código existente | architect, developer |
| `test` | Adicionar ou melhorar testes | tester |
| `docs` | Trabalho de documentação | documenter |
| `architecture` | Design de sistemas, ferramentas | architect |
| `bugfix` | Corrigir bug específico | developer |

### Scope

**Isso é crítico.** O escopo define os limites do que a IA pode modificar.

```markdown
## Scope

### Allowed
- src/components/Button/**
- src/components/index.ts (to add export)
- tests/components/Button.test.tsx

### Forbidden
- src/core/**
- src/utils/** (use existing utils, don't modify)
- Any configuration files
- package.json
```

**Regras:**

1. Se não está em `Allowed`, é proibido
2. Seja o mais específico possível
3. Use padrões glob para diretórios: `src/components/Button/**`
4. Liste explicitamente arquivos individuais quando necessário

### Requirements

É aqui que você fornece especificações detalhadas. Seja explícito sobre:

**Para Componentes:**

```markdown
## Requirements

### Props API

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'primary' \| 'secondary' \| 'tertiary'` | `'primary'` | Visual style |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Button size |
| `loading` | `boolean` | `false` | Shows loading spinner |
| `disabled` | `boolean` | `false` | Disables interaction |
| `leadingIcon` | `ReactNode` | - | Icon before text |
| `trailingIcon` | `ReactNode` | - | Icon after text |

### Behavior

- When `loading` is true, show spinner and disable button
- Forward all standard button HTML attributes
- Support `as` prop for polymorphism (render as `<a>` for links)

### Styling

- Use CSS custom properties from design tokens
- Support all interactive states (hover, active, focus, disabled)
- Follow BEM-like naming: `.pt-Button`, `.pt-Button--primary`
```

**Para Refatoração:**

```markdown
## Requirements

### Current State
[Describe what exists now]

### Target State
[Describe what should exist after]

### Constraints
- No API changes (internal refactor only)
- Must maintain backward compatibility
- Performance must not degrade
```

**Para Correção de Bugs:**

```markdown
## Requirements

### Bug Description
[What is happening]

### Expected Behavior
[What should happen]

### Reproduction Steps
1. [Step 1]
2. [Step 2]
3. [Step 3]

### Root Cause (if known)
[Analysis of why this happens]
```

### Definition of Done

Cada critério deve ser **verificável**. Se você não pode checá-lo, ele não deveria estar aqui.

**Critérios Ruins:**

```markdown
## Definition of Done
- Code is clean
- Component works correctly
- Good test coverage
```

**Critérios Bons:**

```markdown
## Definition of Done
- [ ] Component renders without errors
- [ ] All props from the API table are implemented
- [ ] TypeScript compilation passes (`pnpm typecheck`)
- [ ] ESLint passes with no warnings (`pnpm lint`)
- [ ] Tests exist for: default render, all variants, all sizes, loading state, disabled state
- [ ] Tests pass (`pnpm test`)
- [ ] No accessibility violations (test with `expectNoA11yViolations`)
- [ ] Storybook story exists with controls for all props
```

### Notes

Use esta seção para:

- Avisos sobre armadilhas
- Referências a código relacionado
- Decisões que foram tomadas
- Contexto que não se encaixa em outro lugar

```markdown
## Notes

- The existing `Icon` component should be used for loading spinner
- Follow the pattern established in `src/components/Badge/` for structure
- Design tokens for colors are in `src/tokens/colors.css`
- Accessibility: Ensure button is focusable and announces loading state
```

---

## Templates de Task por Tipo

### Task de Componente

```markdown
# TASK

## Goal
Create the [ComponentName] component with [key features].

## Task Type
component

## Suggested Roles
- developer
- tester

## Scope
### Allowed
- src/components/[ComponentName]/**
- src/components/index.ts
- stories/[ComponentName].stories.tsx

### Forbidden
- src/core/**
- src/tokens/**

## Requirements

### File Structure
Create:
- [ComponentName].tsx
- [ComponentName].types.ts
- [ComponentName].constants.ts
- [component-name].css
- [ComponentName].test.tsx
- index.ts

### Props API
[Table of props]

### Behavior
[Behavioral specifications]

### Styling
[CSS requirements]

## Definition of Done
- [ ] All files created following project structure
- [ ] All props implemented and typed
- [ ] CSS uses design tokens only
- [ ] Tests cover: render, props, interactions, a11y
- [ ] `pnpm quality:fast` passes
- [ ] Storybook story with all variants

## Notes
[Additional context]
```

### Task de Refatoração

```markdown
# TASK

## Goal
Refactor [area] to [improvement].

## Task Type
refactor

## Suggested Roles
- architect
- developer

## Scope
### Allowed
- [specific paths]

### Forbidden
- [paths to protect]

## Requirements

### Current State
[What exists now and its problems]

### Target State
[What should exist after]

### Migration Strategy
[How to get from current to target]

### Constraints
- No API changes
- No functionality changes
- Tests must continue passing

## Definition of Done
- [ ] All changes within scope
- [ ] No API changes (same exports, same props)
- [ ] All existing tests pass
- [ ] `pnpm quality:fast` passes
- [ ] No performance regression

## Notes
[Context about why this refactor]
```

### Task de Teste

```markdown
# TASK

## Goal
Improve test coverage for [area] to [target]%.

## Task Type
test

## Suggested Roles
- tester

## Scope
### Allowed
- tests/**
- src/**/*.test.tsx

### Forbidden
- Any non-test files

## Requirements

### Current Coverage
[Current metrics]

### Target Coverage
[Target metrics]

### Required Test Cases
- [ ] [Test case 1]
- [ ] [Test case 2]
- [ ] [Edge case 1]

### Testing Patterns
[Reference to test utilities, patterns to follow]

## Definition of Done
- [ ] Coverage meets target
- [ ] All new tests pass
- [ ] No flaky tests introduced
- [ ] Tests follow project patterns
- [ ] `pnpm test` passes

## Notes
[Any special testing considerations]
```

---

## Anti-Padrões

### Escopo Vago

```markdown
## Scope
### Allowed
- src/
```

Isso permite modificação de qualquer coisa em `src/`. Seja específico.

### Done Não Mensurável

```markdown
## Definition of Done
- Code is good quality
```

O que é "good quality"? Substitua por verificações específicas.

### Contexto Ausente

```markdown
## Requirements
Build a form.
```

Quais campos? Qual validação? Qual comportamento de envio? Forneça detalhes.

### Tasks Sobrecarregadas

```markdown
## Goal
Build the authentication system including login, registration, password reset, OAuth integration, and user profile management.
```

Isso é demais. Divida em múltiplas tarefas focadas.

---

## Dicas

### Uma Task, Um Propósito

Uma task deve ter um propósito claro. Se você se pega escrevendo "e" múltiplas vezes no goal, divida.

### Inclua Referências a Arquivos

```markdown
## Notes
- Follow the pattern in `src/components/Button/` for structure
- Use utilities from `src/utils/form-validation.ts`
- Reference design at `docs/designs/login-form.png`
```

### Especifique o Formato de Saída

Quando o formato de saída importa:

```markdown
## Requirements

### Output Format
The component must export:
\`\`\`typescript
export { LoginForm } from "./LoginForm";
export type { LoginFormProps } from "./LoginForm.types";
\`\`\`
```

### Vincule Tasks Relacionadas

```markdown
## Notes
- Depends on: Task #003 (design tokens must exist first)
- Blocks: Task #007 (auth flow needs this form)
```

---

## Tasks Bloqueadas e Retomada

Quando a execução de uma task encontra um bloqueio que requer intervenção humana, o AIDF marca automaticamente a task como `BLOCKED` e salva o estado de execução no arquivo da task.

### Formato do Status Bloqueado

Quando uma task é bloqueada, o AIDF adiciona uma seção de status ao arquivo da task:

```markdown
## Status: BLOCKED

### Execution Log
- **Started:** 2024-01-01T10:00:00.000Z
- **Iterations:** 5
- **Blocked at:** 2024-01-01T11:00:00.000Z

### Blocking Issue
\`\`\`
Missing API key configuration. The task requires an API key to be set in the environment, but it was not found.
\`\`\`

### Files Modified
- \`src/api/client.ts\`
- \`src/config/settings.ts\`

---
@developer: Review and provide guidance, then run \`aidf run --resume task.md\`
```

### Retomando uma Task Bloqueada

Após resolver o problema de bloqueio ou fornecer orientação, você pode retomar a task usando a flag `--resume`:

```bash
aidf run --resume .ai/tasks/my-task.md
```

Ou deixe o AIDF selecionar automaticamente entre as tasks bloqueadas:

```bash
aidf run --resume
```

**O que acontece ao retomar:**

1. O AIDF carrega o estado de execução anterior (contagem de iterações, arquivos modificados, problema de bloqueio)
2. A execução continua a partir da próxima iteração após o bloqueio
3. O problema de bloqueio é incluído no contexto do prompt para que a IA entenda o que estava errado
4. Os arquivos modificados anteriormente são rastreados e preservados
5. O histórico de tentativas de retomada é registrado no arquivo da task

### Histórico de Tentativas de Retomada

O AIDF rastreia tentativas de retomada no arquivo da task:

```markdown
### Resume Attempt History
- **Resumed at:** 2024-01-01T12:00:00.000Z
- **Previous attempt:** Iteration 5, blocked at 2024-01-01T11:00:00.000Z
- **Completed at:** 2024-01-01T13:00:00.000Z
- **Status:** completed
- **Iterations in this attempt:** 3
```

### Conclusão da Task Após Retomada

Quando uma task é concluída após ser retomada, o status BLOCKED é substituído por um status de conclusão e histórico de execução:

```markdown
## Execution History

### Original Block
- **Started:** 2024-01-01T10:00:00.000Z
- **Blocked at:** 2024-01-01T11:00:00.000Z
- **Iterations before block:** 5
- **Blocking issue:** Missing API key configuration...

### Resume and Completion
- **Resumed at:** 2024-01-01T12:00:00.000Z
- **Completed at:** 2024-01-01T13:00:00.000Z
- **Total iterations:** 8
- **Files modified:** 5 files

---

## Status: COMPLETED
```

### Boas Práticas para Retomada

1. **Revise o problema de bloqueio** - Entenda o que deu errado antes de retomar
2. **Resolva o bloqueio** - Corrija o problema ou forneça orientação clara no arquivo da task
3. **Verifique o contexto** - Confirme que os arquivos modificados na tentativa anterior ainda são relevantes
4. **Use o histórico de retomada** - Revise tentativas anteriores para entender padrões

### Quando Tasks São Bloqueadas

Tasks são automaticamente marcadas como BLOCKED quando:

- A IA sinaliza explicitamente `<BLOCKED: reason>` em sua saída
- O número máximo de iterações é atingido
- O número máximo de falhas consecutivas é atingido
- Erros críticos ocorrem que impedem a continuação

### Tratamento de Erros

Se você tentar retomar uma task que não está bloqueada:

```bash
$ aidf run --resume .ai/tasks/normal-task.md
Error: Task is not blocked. Cannot use --resume on a task that is not in BLOCKED status.
```

Apenas tasks com `## Status: BLOCKED` podem ser retomadas.
