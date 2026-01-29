---
title: Agent Skills
description: Consuma definições portáteis de skills do ecossistema agentskills.io, compartilhe skills entre projetos e publique as suas próprias.
---

O AIDF integra o padrão [Agent Skills](https://agentskills.io), permitindo que você consuma definições portáteis de skills do ecossistema e publique as suas próprias.

Skills são arquivos SKILL.md autocontidos que fornecem instruções, expertise e restrições para a IA durante a execução de tarefas. Elas são injetadas no prompt como contexto adicional junto com o role e a tarefa.

---

## Por que Skills?

### Sem Skills

```
Seu agente de IA só conhece o que está no AGENTS.md + role + tarefa.
Adicionar nova expertise significa editar roles ou escrever descrições de tarefas mais longas.
```

### Com Skills

```
Coloque um SKILL.md em .ai/skills/ e a IA ganha novas capacidades instantaneamente.
Compartilhe skills entre projetos. Use skills publicadas pela comunidade.
```

Skills fornecem:

- **Portabilidade**: A mesma skill funciona em qualquer agente que suporte o padrão (34+ agentes compatíveis)
- **Composabilidade**: Combine múltiplas skills para uma única execução de tarefa
- **Separação**: Skills são separadas dos roles — roles definem _quem_, skills definem _o que_ a IA pode fazer
- **Ecossistema**: Consuma skills da comunidade ou publique as suas próprias

---

## Formato do SKILL.md

Cada skill é um diretório contendo um arquivo `SKILL.md` com frontmatter YAML e conteúdo em markdown:

```
.ai/skills/
  └── my-skill/
      └── SKILL.md
```

### Estrutura

```markdown
---
name: my-skill
description: A brief description of what this skill does
version: 1.0.0
author: Your Name
tags: tag1, tag2, tag3
globs: src/**/*.ts, tests/**
---

# My Skill

## Instructions

Detailed instructions for the AI when this skill is active.

## When to Use

Describe when this skill should be activated.

## Behavior Rules

### ALWAYS
- Rule 1
- Rule 2

### NEVER
- Rule 1
- Rule 2
```

### Campos do Frontmatter

| Campo | Obrigatório | Descrição |
|-------|-------------|-----------|
| `name` | Sim | Identificador único da skill |
| `description` | Sim | Descrição breve (exibida em `aidf skills list`) |
| `version` | Não | Versão semântica |
| `author` | Não | Autor da skill |
| `tags` | Não | Tags separadas por vírgula para categorização |
| `globs` | Não | Padrões de arquivo separados por vírgula aos quais a skill se relaciona |

---

## Descoberta de Skills

O AIDF descobre skills de três locais, em ordem:

| Prioridade | Local | Rótulo de origem | Descrição |
|------------|-------|-------------------|-----------|
| 1 | `.ai/skills/` | `project` | Skills específicas do projeto |
| 2 | `~/.aidf/skills/` | `global` | Skills do usuário compartilhadas entre projetos |
| 3 | Diretórios de configuração | `config` | Caminhos extras definidos em `config.yml` |

Todas as skills descobertas são carregadas e injetadas no prompt de execução automaticamente.

---

## Configuração

Adicione a seção `skills` ao `.ai/config.yml`:

```yaml
skills:
  enabled: true              # default: true (omit section to enable)
  directories:               # additional directories to scan for skills
    - /path/to/shared/skills
    - ../other-project/.ai/skills
```

Para desabilitar skills completamente:

```yaml
skills:
  enabled: false
```

Se a seção `skills` for omitida, as skills são habilitadas por padrão e o AIDF irá escanear os diretórios padrão (`.ai/skills/` e `~/.aidf/skills/`).

---

## Comandos CLI

### Listar skills

```bash
aidf skills list
```

Mostra todas as skills descobertas com sua origem (project/global/config), descrição e tags.

### Criar uma nova skill

```bash
aidf skills init my-skill           # creates .ai/skills/my-skill/SKILL.md
aidf skills init my-skill --global  # creates ~/.aidf/skills/my-skill/SKILL.md
```

Gera um template de SKILL.md pronto para edição.

### Validar skills

```bash
aidf skills validate              # validate all discovered skills
aidf skills validate my-skill     # validate a specific skill by name
```

Verifica os campos do frontmatter, a estrutura do conteúdo e reporta erros.

### Adicionar uma skill externa

```bash
aidf skills add /path/to/skill-directory
```

Copia uma skill para o diretório `.ai/skills/` do projeto após validá-la.

---

## Como as Skills São Injetadas

Durante a execução, as skills são injetadas no prompt como XML seguindo o formato do agentskills.io:

```xml
<available_skills>
<skill name="my-skill">
<description>A brief description</description>
<tags>tag1, tag2</tags>
<instructions>
# My Skill
...full markdown content...
</instructions>
</skill>
</available_skills>
```

Este bloco XML é posicionado no prompt após a seção Implementation Plan e antes das Execution Instructions.

---

## Skills Integradas

O AIDF vem com 6 skills integradas que espelham os roles integrados:

| Skill | Descrição |
|-------|-----------|
| `aidf-architect` | Design de sistemas, padrões, análise de trade-offs |
| `aidf-developer` | Implementação de código limpo, correspondência de padrões |
| `aidf-tester` | Cobertura de testes, casos extremos, confiabilidade |
| `aidf-reviewer` | Revisão de código, qualidade, feedback construtivo |
| `aidf-documenter` | Escrita técnica, documentação de API, guias |
| `aidf-task-templates` | Templates de tarefas estruturadas para todos os 6 tipos de tarefa |

Essas skills estão incluídas no diretório `templates/.ai/skills/` e são copiadas para o seu projeto quando você executa `aidf init`.

---

## Exemplos

### Adicionando uma skill personalizada

```bash
# Create the skill
aidf skills init eslint-expert

# Edit the SKILL.md
# Then validate it
aidf skills validate eslint-expert
```

### Compartilhando skills globalmente

```bash
# Create a global skill available in all projects
aidf skills init code-security --global

# It lives at ~/.aidf/skills/code-security/SKILL.md
```

### Usando diretórios extras

Se sua equipe mantém um repositório compartilhado de skills:

```yaml
# .ai/config.yml
skills:
  directories:
    - ../shared-aidf-skills
```

### Desabilitando skills para uma execução

As skills são carregadas automaticamente quando disponíveis. Para desabilitar:

```yaml
# .ai/config.yml
skills:
  enabled: false
```
