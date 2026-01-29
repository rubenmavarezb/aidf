---
title: Notificações
description: Receba notificações via Desktop, Slack, Discord, Email ou Webhooks quando tasks do AIDF são concluídas, falham ou ficam bloqueadas.
---

O AIDF pode notificá-lo quando tasks são concluídas, falham ou ficam bloqueadas. Isso é útil para tasks de longa duração ou modo watch, quando você pode não estar observando o terminal.

## Canais Suportados

| Canal | Como funciona | Requisitos |
|-------|---------------|------------|
| **Desktop** | Notificação a nível de SO (macOS/Windows/Linux) | `node-notifier` (incluído) |
| **Slack** | Publica em um Incoming Webhook | Workspace do Slack + URL do webhook |
| **Discord** | Publica em um webhook de canal | Servidor Discord + URL do webhook |
| **Email** | Envia via SMTP | Credenciais do servidor SMTP |
| **Webhook** | POST JSON para qualquer URL | Qualquer endpoint HTTP (n8n, Zapier, personalizado) |

---

## Configuração

Adicione a seção `notifications` ao `.ai/config.yml`:

```yaml
notifications:
  level: all               # all | errors | blocked
  desktop:
    enabled: true
  slack:
    enabled: true
    webhook_url: "<your-slack-webhook-url>"
  discord:
    enabled: true
    webhook_url: "https://discord.com/api/webhooks/123456/abcdef"
  email:
    enabled: true
    smtp_host: "smtp.gmail.com"
    smtp_port: 587
    smtp_user: "you@gmail.com"
    smtp_pass: "app-password"
    from: "you@gmail.com"
    to: "you@gmail.com"
  webhook:
    enabled: true
    url: "https://your-n8n.com/webhook/aidf"
    headers:                          # optional
      Authorization: "Bearer token"
```

Você só precisa habilitar os canais que deseja. Todos os canais estão desabilitados por padrão.

---

## Níveis de Notificação

A configuração `level` controla quais eventos disparam notificações:

| Nível | Completed | Blocked | Failed |
|-------|-----------|---------|--------|
| `all` | Sim | Sim | Sim |
| `errors` | Não | Sim | Sim |
| `blocked` | Não | Sim | Não |

- **`all`** -- Receba notificações sobre todo resultado de task. Bom para monitoramento.
- **`errors`** -- Apenas saiba dos problemas. Bom para produção/CI.
- **`blocked`** -- Apenas quando input humano é necessário. Ruído mínimo.

---

## Configuração dos Canais

### Desktop

Nenhuma configuração necessária além de habilitá-lo:

```yaml
notifications:
  level: all
  desktop:
    enabled: true
```

Usa o sistema de notificações do seu SO (Central de Notificações no macOS, libnotify no Linux, notificações toast no Windows). Reproduz um som ao entregar.

### Slack

1. Acesse [Slack API: Incoming Webhooks](https://api.slack.com/messaging/webhooks)
2. Crie um novo app (ou use um existente) no seu workspace
3. Habilite **Incoming Webhooks** nas configurações do app
4. Clique em **Add New Webhook to Workspace** e selecione um canal
5. Copie a URL do webhook

```yaml
notifications:
  level: all
  slack:
    enabled: true
    webhook_url: "<your-slack-webhook-url>"
```

As mensagens são publicadas com anexos codificados por cores:
- Verde (`#36a64f`) para concluído
- Laranja (`#ff9900`) para bloqueado
- Vermelho (`#ff0000`) para falha

### Discord

1. Abra as configurações do seu servidor Discord
2. Vá em **Integrations** > **Webhooks**
3. Clique em **New Webhook**
4. Escolha o canal e copie a URL do webhook

```yaml
notifications:
  level: all
  discord:
    enabled: true
    webhook_url: "https://discord.com/api/webhooks/1234567890/abcdefghijklmnop"
```

As mensagens são publicadas como embeds ricos com a mesma codificação de cores do Slack.

### Email

Requer credenciais SMTP. Exemplo com Gmail:

1. Habilite a Autenticação em 2 Fatores na sua conta Google
2. Acesse [Google App Passwords](https://myaccount.google.com/apppasswords)
3. Gere uma senha de aplicativo para "Mail"
4. Use essa senha na configuração

```yaml
notifications:
  level: all
  email:
    enabled: true
    smtp_host: "smtp.gmail.com"
    smtp_port: 587
    smtp_user: "you@gmail.com"
    smtp_pass: "xxxx xxxx xxxx xxxx"   # App password, not your real password
    from: "you@gmail.com"
    to: "you@gmail.com"
```

Outros provedores SMTP funcionam da mesma forma -- basta usar o host e porta deles.

Os emails são enviados como HTML com uma tabela de status mostrando nome da task, iterações, arquivos modificados e qualquer razão de erro ou bloqueio.

### Webhook (Genérico)

Envia um payload JSON limpo via HTTP POST para qualquer URL. Funciona com n8n, Zapier, Make ou qualquer endpoint personalizado.

```yaml
notifications:
  level: all
  webhook:
    enabled: true
    url: "https://your-n8n.com/webhook/aidf"
```

Se seu endpoint requer autenticação, adicione headers personalizados:

```yaml
notifications:
  level: all
  webhook:
    enabled: true
    url: "https://your-n8n.com/webhook/aidf"
    headers:
      Authorization: "Bearer your-token"
```

O payload é um objeto JSON plano:

```json
{
  "type": "completed",
  "task": "001-add-login.md",
  "taskPath": ".ai/tasks/001-add-login.md",
  "iterations": 5,
  "filesModified": 3,
  "error": null,
  "blockedReason": null,
  "timestamp": "2026-01-29T12:00:00.000Z"
}
```

Este é o canal mais simples de integrar. Sem formatação específica de fornecedor -- apenas dados brutos que você pode rotear como quiser.

---

## Quando as Notificações São Disparadas

As notificações são enviadas automaticamente ao final da execução da task em ambos os modos:

- **`aidf run`** -- Após a task terminar (concluída, falha ou bloqueada)
- **`aidf watch`** -- Após cada task na fila de watch terminar

Se múltiplos canais estão habilitados, todos disparam em paralelo. Uma falha em um canal não afeta os outros nem a execução da task em si.

---

## Conteúdo da Mensagem

Toda notificação inclui:

| Campo | Descrição |
|-------|-----------|
| **Task** | Nome do arquivo da task (ex: `001-add-login.md`) |
| **Status** | Completed, Blocked ou Failed |
| **Iterations** | Quantas iterações o executor executou |
| **Files Modified** | Número de arquivos alterados |
| **Error** | Mensagem de erro (se falhou), truncada em 200 caracteres |
| **Blocked Reason** | Por que input humano é necessário (se bloqueado), truncado em 200 caracteres |

---

## Exemplo: Configuração Mínima

Notificações desktop apenas, para erros e tasks bloqueadas:

```yaml
notifications:
  level: errors
  desktop:
    enabled: true
```

## Exemplo: Slack + Discord para Tudo

```yaml
notifications:
  level: all
  slack:
    enabled: true
    webhook_url: "<your-slack-webhook-url>"
  discord:
    enabled: true
    webhook_url: "https://discord.com/api/webhooks/..."
```

## Exemplo: Email Apenas Quando Bloqueado

```yaml
notifications:
  level: blocked
  email:
    enabled: true
    smtp_host: "smtp.gmail.com"
    smtp_port: 587
    smtp_user: "you@gmail.com"
    smtp_pass: "xxxx xxxx xxxx xxxx"
    from: "aidf@yourteam.com"
    to: "dev@yourteam.com"
```

## Exemplo: n8n / Zapier via Webhook Genérico

```yaml
notifications:
  level: all
  webhook:
    enabled: true
    url: "https://your-n8n.com/webhook/aidf-notifications"
```

---

## Zoom Chat via Webhook Genérico

O Zoom Team Chat suporta incoming webhooks através do [app Incoming Webhook](https://marketplace.zoom.us/apps/eH_dLuquRd-VYcOsNGy-hQ) no Zoom Marketplace. Você pode usar o canal de webhook genérico com um header Bearer token:

```yaml
notifications:
  level: all
  webhook:
    enabled: true
    url: "https://integrations.zoom.us/chat/webhooks/incomingwebhook/your-endpoint"
    headers:
      Authorization: "Bearer your-zoom-token"
```

Veja a [documentação de Incoming Webhook Chatbot do Zoom](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0067640) para detalhes de configuração.

---

## Solução de Problemas

**Notificações não estão sendo enviadas**
- Verifique se o canal está `enabled: true` na configuração
- Verifique se o `level` corresponde ao tipo de evento (ex: `level: blocked` não dispara para `completed`)
- Execute com `--verbose` para ver logs de debug de falhas de notificação

**Webhook do Slack/Discord retorna 404**
- Verifique se a URL do webhook está correta e não foi revogada
- Verifique se o formato da URL do webhook está correto e não foi revogado

**Email não está chegando**
- Verifique a pasta de spam
- Verifique as credenciais SMTP (host, porta, usuário, senha)
- Para Gmail, certifique-se de estar usando uma Senha de Aplicativo, não a senha da sua conta
- Verifique se `smtp_port` está correto (587 para TLS, 465 para SSL)

**Notificações desktop não estão aparecendo**
- No macOS, verifique Ajustes do Sistema > Notificações para garantir que seu app de terminal tem permissão
- No Linux, certifique-se de que `libnotify` está instalado (`sudo apt install libnotify-bin`)
