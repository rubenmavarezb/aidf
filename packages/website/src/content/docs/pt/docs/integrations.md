---
title: Integrações
description: Use o AIDF com Claude Code, Cursor, GitHub Copilot ou qualquer LLM — sem necessidade do CLI.
---

Este guia explica como usar o AIDF com ferramentas populares de codificação com IA **sem** precisar do CLI do AIDF.

## Visão Geral

O AIDF é agnóstico de ferramentas. O valor principal está no **contexto estruturado** (AGENTS.md, roles, tasks), não no CLI. Você pode usar o AIDF com:

- Claude Code
- Cursor
- GitHub Copilot
- Qualquer LLM com acesso a arquivos

---

## Integração com Claude Code

### Configuração

1. Copie a pasta `.ai/` para seu projeto (de `templates/.ai/`)
2. Personalize o `AGENTS.md` com os detalhes do seu projeto
3. Crie tasks em `.ai/tasks/`

### Uso

**Opção A: Prompt único com contexto completo**

```bash
claude
> Read .ai/AGENTS.md, then .ai/roles/developer.md, then execute .ai/tasks/001-feature.md
```

**Opção B: Referenciar arquivos diretamente**

```bash
claude
> @.ai/AGENTS.md @.ai/roles/developer.md @.ai/tasks/001-feature.md
> Execute this task following the context and role.
```

**Opção C: Adicionar ao CLAUDE.md**

```markdown
# CLAUDE.md

## Project Context
See .ai/AGENTS.md for full project context.

## Task Execution
When asked to execute a task:
1. Read .ai/AGENTS.md for project context
2. Read the role file specified in the task
3. Follow the task's Scope restrictions
4. Signal completion with <TASK_COMPLETE> when Definition of Done is met
```

### Loop Autônomo (estilo Ralph)

Para execução autônoma similar à técnica Ralph:

```bash
# Terminal
while true; do
  cat .ai/tasks/current-task.md | claude --print
  # Check for completion signal
  # Update task status
  sleep 1
done
```

Ou use o loop nativo do Claude Code:

```bash
claude
> Read .ai/AGENTS.md and .ai/tasks/001-feature.md.
> Execute autonomously until all Definition of Done criteria are met.
> Only modify files in the Allowed scope.
> Output <TASK_COMPLETE> when done or <BLOCKED: reason> if stuck.
```

---

## Integração com Cursor

### Configuração

1. Copie a pasta `.ai/` para seu projeto
2. Crie `.cursor/rules/aidf.mdc`:

```markdown
# AIDF Integration

## Context Loading
When working on this project:
- Read `.ai/AGENTS.md` for project overview, architecture, and conventions
- This is your primary source of truth for how the project works

## Task Execution
When asked to execute a task file:
1. Read the task file completely
2. Load the suggested role from `.ai/roles/{role}.md`
3. **STRICTLY** follow the Scope section:
   - Only modify files matching `Allowed` patterns
   - Never modify files matching `Forbidden` patterns
4. Check each item in `Definition of Done` before completing
5. Add `## Status: COMPLETED` to the task file when done

## Role Behavior
When a role file is loaded, adopt:
- The **Identity** as your persona
- The **Constraints** as hard rules
- The **Quality Criteria** as success metrics
```

### Uso no Cursor

**Composer:**
```
Execute the task in .ai/tasks/001-feature.md
```

**Agent Mode:**
```
@.ai/AGENTS.md @.ai/tasks/001-feature.md

Execute this task following AIDF conventions.
Stay within scope and signal <TASK_COMPLETE> when done.
```

### Configurações do Cursor (opcional)

Adicione ao `.cursor/settings.json`:

```json
{
  "workspaceContext": {
    "alwaysInclude": [".ai/AGENTS.md"]
  }
}
```

---

## Integração com GitHub Copilot

### Configuração

1. Copie a pasta `.ai/` para seu projeto
2. Crie `.github/copilot-instructions.md`:

```markdown
# Project Context

This project uses AIDF (AI-Integrated Development Framework).

## Key Files
- `.ai/AGENTS.md` - Project overview, architecture, conventions
- `.ai/roles/` - Specialized role definitions
- `.ai/tasks/` - Task definitions with scope and requirements

## When Modifying Code
1. Check if there's a relevant task in `.ai/tasks/`
2. Follow the conventions in `.ai/AGENTS.md`
3. Respect the scope defined in task files

## Code Style
See the Conventions section in `.ai/AGENTS.md`
```

---

## Integração com LLM Genérico (API)

Para qualquer LLM via API, construa prompts concatenando:

```python
def build_aidf_prompt(task_path: str) -> str:
    agents = read_file('.ai/AGENTS.md')
    task = read_file(task_path)

    # Extract role from task
    role_name = extract_role(task)  # e.g., "developer"
    role = read_file(f'.ai/roles/{role_name}.md')

    return f"""
# Project Context
{agents}

# Your Role
{role}

# Task to Execute
{task}

# Instructions
1. Follow the project conventions
2. Stay within the Allowed scope
3. Never modify Forbidden files
4. Complete all Definition of Done items
5. Output <TASK_COMPLETE> when finished
"""
```

---

## Boas Práticas

### 1. Sempre Carregue o AGENTS.md Primeiro

O contexto do projeto deve ser carregado antes de qualquer execução de task. Isso garante que a IA entenda:
- Arquitetura do projeto
- Convenções de código
- Padrões de qualidade
- Limites (o que NÃO fazer)

### 2. Use o Escopo como Restrições Rígidas

```markdown
## Scope

### Allowed
- `src/components/**`

### Forbidden
- `.env*`
- `src/config/**`
```

Diga à IA explicitamente: "Você NÃO DEVE modificar arquivos fora do escopo Allowed."

### 3. Definition of Done = Critérios de Saída

Não deixe a IA decidir quando está "pronto". A Definition of Done fornece critérios objetivos:

```markdown
## Definition of Done
- [ ] Component renders without errors
- [ ] Tests pass (`pnpm test`)
- [ ] TypeScript compiles (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
```

### 4. Use Roles para Tarefas Especializadas

Tarefas diferentes precisam de expertise diferente:

| Tipo de Tarefa | Role |
|----------------|------|
| Nova funcionalidade | developer |
| Design de sistema | architect |
| Investigação de bug | developer + tester |
| Revisão de código | reviewer |
| Documentação | documenter |

### 5. Sinalize Conclusão Explicitamente

Treine a IA para emitir sinais claros:

- `<TASK_COMPLETE>` - Todos os itens da Definition of Done atendidos
- `<BLOCKED: reason>` - Não pode prosseguir, precisa de input humano
- `<SCOPE_VIOLATION: file>` - Tentou modificar arquivo proibido

---

## Templates de Prompt

### Execução Rápida de Task

```
Read .ai/AGENTS.md for context.
Execute .ai/tasks/{task}.md as the {role} role.
Output <TASK_COMPLETE> when Definition of Done is met.
```

### Execução Completa de Task

```
# Context Loading
1. Read .ai/AGENTS.md completely
2. Read .ai/roles/{role}.md for your role definition

# Task Execution
3. Read .ai/tasks/{task}.md
4. Analyze the requirements and scope
5. Implement the changes
6. Verify each Definition of Done item
7. Output <TASK_COMPLETE> or <BLOCKED: reason>

# Constraints
- ONLY modify files in Allowed scope
- NEVER modify files in Forbidden scope
- Follow all conventions from AGENTS.md
```

### Prompt de Loop Autônomo

```
You are executing tasks autonomously using AIDF.

Current iteration: {n}
Task: .ai/tasks/{task}.md

Instructions:
1. Read the task and understand requirements
2. Make incremental progress
3. After each change, verify against Definition of Done
4. If ALL criteria met: output <TASK_COMPLETE>
5. If blocked: output <BLOCKED: specific reason>
6. If need to modify file outside scope: output <SCOPE_VIOLATION: path>

Previous output (if any):
{previous_output}

Begin execution.
```

---

## Solução de Problemas

### A IA ignora restrições de escopo

Adicione avisos explícitos:
```
WARNING: Modifying files outside the Allowed scope will cause task failure.
The following files are FORBIDDEN: {list}
```

### A IA não completa todos os itens da Definition of Done

Adicione uma etapa de verificação de checklist:
```
Before outputting <TASK_COMPLETE>, verify EACH item:
- [ ] Item 1: {status}
- [ ] Item 2: {status}
Only output <TASK_COMPLETE> if ALL items are checked.
```

### A IA alucina a estrutura do projeto

Sempre carregue o AGENTS.md primeiro, que contém a estrutura real de diretórios.

### Janela de contexto muito pequena

Priorize a ordem de carregamento:
1. AGENTS.md (obrigatório)
2. Arquivo da task (obrigatório)
3. Arquivo do role (opcional, pode ser resumido)
4. Arquivo do plan (opcional, apenas se existir)
