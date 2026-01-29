---
title: Notificaciones
description: Recibe notificaciones por Escritorio, Slack, Discord, Email o Webhooks cuando las tareas de AIDF se completen, fallen o se bloqueen.
---

AIDF puede notificarte cuando las tareas se completan, fallan o se bloquean. Esto es útil para tareas de larga duración o modo watch, donde puede que no estés observando la terminal.

## Canales Soportados

| Canal | Cómo funciona | Requisitos |
|-------|---------------|------------|
| **Desktop** | Notificación a nivel de SO (macOS/Windows/Linux) | `node-notifier` (incluido) |
| **Slack** | Publica en un Incoming Webhook | Workspace de Slack + URL de webhook |
| **Discord** | Publica en un webhook de canal | Servidor de Discord + URL de webhook |
| **Email** | Envía vía SMTP | Credenciales de servidor SMTP |
| **Webhook** | POST JSON a cualquier URL | Cualquier endpoint HTTP (n8n, Zapier, personalizado) |

---

## Configuración

Agrega la sección `notifications` a `.ai/config.yml`:

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

Solo necesitas habilitar los canales que desees. Todos los canales están deshabilitados por defecto.

---

## Niveles de Notificación

La configuración `level` controla qué eventos disparan notificaciones:

| Nivel | Completed | Blocked | Failed |
|-------|-----------|---------|--------|
| `all` | Sí | Sí | Sí |
| `errors` | No | Sí | Sí |
| `blocked` | No | Sí | No |

- **`all`** — Recibe notificaciones de cada resultado de tarea. Bueno para monitoreo.
- **`errors`** — Solo te entera de problemas. Bueno para producción/CI.
- **`blocked`** — Solo cuando se necesita intervención humana. Mínimo ruido.

---

## Configuración de Canales

### Desktop

No requiere configuración más allá de habilitarlo:

```yaml
notifications:
  level: all
  desktop:
    enabled: true
```

Usa el sistema de notificaciones de tu SO (Centro de Notificaciones en macOS, libnotify en Linux, notificaciones toast en Windows). Reproduce un sonido al entregarse.

### Slack

1. Ve a [Slack API: Incoming Webhooks](https://api.slack.com/messaging/webhooks)
2. Crea una nueva app (o usa una existente) en tu workspace
3. Habilita **Incoming Webhooks** en la configuración de la app
4. Haz clic en **Add New Webhook to Workspace** y selecciona un canal
5. Copia la URL del webhook

```yaml
notifications:
  level: all
  slack:
    enabled: true
    webhook_url: "<your-slack-webhook-url>"
```

Los mensajes se publican con adjuntos codificados por color:
- Verde (`#36a64f`) para completado
- Naranja (`#ff9900`) para bloqueado
- Rojo (`#ff0000`) para fallido

### Discord

1. Abre la configuración de tu servidor de Discord
2. Ve a **Integrations** > **Webhooks**
3. Haz clic en **New Webhook**
4. Elige el canal y copia la URL del webhook

```yaml
notifications:
  level: all
  discord:
    enabled: true
    webhook_url: "https://discord.com/api/webhooks/1234567890/abcdefghijklmnop"
```

Los mensajes se publican como embeds enriquecidos con la misma codificación de colores que Slack.

### Email

Requiere credenciales SMTP. Ejemplo con Gmail:

1. Habilita la Autenticación de 2 Factores en tu cuenta de Google
2. Ve a [Google App Passwords](https://myaccount.google.com/apppasswords)
3. Genera una contraseña de aplicación para "Mail"
4. Usa esa contraseña en la configuración

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

Otros proveedores SMTP funcionan de la misma manera -- solo usa su host y puerto.

Los emails se envían como HTML con una tabla de estado que muestra nombre de tarea, iteraciones, archivos modificados y cualquier error o razón de bloqueo.

### Webhook (Genérico)

Envía un payload JSON limpio vía HTTP POST a cualquier URL. Funciona con n8n, Zapier, Make o cualquier endpoint personalizado.

```yaml
notifications:
  level: all
  webhook:
    enabled: true
    url: "https://your-n8n.com/webhook/aidf"
```

Si tu endpoint requiere autenticación, agrega headers personalizados:

```yaml
notifications:
  level: all
  webhook:
    enabled: true
    url: "https://your-n8n.com/webhook/aidf"
    headers:
      Authorization: "Bearer your-token"
```

El payload es un objeto JSON plano:

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

Este es el canal más simple de integrar. Sin formato específico de proveedor -- solo datos crudos que puedes enrutar como quieras.

---

## Cuándo se Disparan las Notificaciones

Las notificaciones se envían automáticamente al final de la ejecución de la tarea en ambos modos:

- **`aidf run`** -- Después de que la tarea termine (completada, fallida o bloqueada)
- **`aidf watch`** -- Después de que cada tarea en la cola de watch termine

Si múltiples canales están habilitados, todos se disparan en paralelo. Un fallo en un canal no afecta a los demás ni a la ejecución de la tarea en sí.

---

## Contenido del Mensaje

Cada notificación incluye:

| Campo | Descripción |
|-------|-------------|
| **Task** | Nombre de archivo de la tarea (ej., `001-add-login.md`) |
| **Status** | Completed, Blocked o Failed |
| **Iterations** | Cuántas iteraciones ejecutó el executor |
| **Files Modified** | Número de archivos modificados |
| **Error** | Mensaje de error (si falló), truncado a 200 caracteres |
| **Blocked Reason** | Por qué se necesita intervención humana (si bloqueado), truncado a 200 caracteres |

---

## Ejemplo: Configuración Mínima

Solo notificaciones de escritorio, para errores y tareas bloqueadas:

```yaml
notifications:
  level: errors
  desktop:
    enabled: true
```

## Ejemplo: Slack + Discord para Todo

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

## Ejemplo: Email Solo Cuando Está Bloqueado

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

## Ejemplo: n8n / Zapier vía Webhook Genérico

```yaml
notifications:
  level: all
  webhook:
    enabled: true
    url: "https://your-n8n.com/webhook/aidf-notifications"
```

---

## Zoom Chat vía Webhook Genérico

Zoom Team Chat soporta incoming webhooks a través de la [app Incoming Webhook](https://marketplace.zoom.us/apps/eH_dLuquRd-VYcOsNGy-hQ) en el Marketplace de Zoom. Puedes usar el canal de webhook genérico con un header Bearer token:

```yaml
notifications:
  level: all
  webhook:
    enabled: true
    url: "https://integrations.zoom.us/chat/webhooks/incomingwebhook/your-endpoint"
    headers:
      Authorization: "Bearer your-zoom-token"
```

Consulta la [documentación de Incoming Webhook Chatbot de Zoom](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0067640) para detalles de configuración.

---

## Solución de Problemas

**Las notificaciones no se envían**
- Verifica que el canal tenga `enabled: true` en la configuración
- Verifica que el `level` coincida con el tipo de evento (ej., `level: blocked` no se disparará en `completed`)
- Ejecuta con `--verbose` para ver logs de depuración de fallos de notificación

**El webhook de Slack/Discord devuelve 404**
- Verifica que la URL del webhook sea correcta y no haya sido revocada
- Verifica que el formato de la URL del webhook sea correcto y no haya sido revocada

**El email no llega**
- Revisa la carpeta de spam
- Verifica las credenciales SMTP (host, puerto, usuario, contraseña)
- Para Gmail, asegúrate de usar una App Password, no la contraseña de tu cuenta
- Verifica que `smtp_port` sea correcto (587 para TLS, 465 para SSL)

**Las notificaciones de escritorio no aparecen**
- En macOS, revisa Configuración del Sistema > Notificaciones para asegurarte de que tu app de terminal tiene permiso
- En Linux, asegúrate de que `libnotify` esté instalado (`sudo apt install libnotify-bin`)
