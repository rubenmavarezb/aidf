# Notifications

AIDF can notify you when tasks complete, fail, or get blocked. This is useful for long-running tasks or watch mode, where you may not be watching the terminal.

## Supported Channels

| Channel | How it works | Requirements |
|---------|-------------|--------------|
| **Desktop** | OS-level notification (macOS/Windows/Linux) | `node-notifier` (bundled) |
| **Slack** | Posts to an Incoming Webhook | Slack workspace + webhook URL |
| **Discord** | Posts to a channel webhook | Discord server + webhook URL |
| **Email** | Sends via SMTP | SMTP server credentials |
| **Webhook** | POST JSON to any URL | Any HTTP endpoint (n8n, Zapier, custom) |

---

## Configuration

Add the `notifications` section to `.ai/config.yml`:

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

You only need to enable the channels you want. All channels are disabled by default.

---

## Notification Levels

The `level` setting controls which events trigger notifications:

| Level | Completed | Blocked | Failed |
|-------|-----------|---------|--------|
| `all` | Yes | Yes | Yes |
| `errors` | No | Yes | Yes |
| `blocked` | No | Yes | No |

- **`all`** — Get notified on every task outcome. Good for monitoring.
- **`errors`** — Only hear about problems. Good for production/CI.
- **`blocked`** — Only when human input is needed. Minimal noise.

---

## Channel Setup

### Desktop

No setup needed beyond enabling it:

```yaml
notifications:
  level: all
  desktop:
    enabled: true
```

Uses your OS notification system (Notification Center on macOS, libnotify on Linux, Windows toast notifications). Plays a sound on delivery.

### Slack

1. Go to [Slack API: Incoming Webhooks](https://api.slack.com/messaging/webhooks)
2. Create a new app (or use an existing one) in your workspace
3. Enable **Incoming Webhooks** in the app settings
4. Click **Add New Webhook to Workspace** and select a channel
5. Copy the webhook URL

```yaml
notifications:
  level: all
  slack:
    enabled: true
    webhook_url: "<your-slack-webhook-url>"
```

Messages are posted with color-coded attachments:
- Green (`#36a64f`) for completed
- Orange (`#ff9900`) for blocked
- Red (`#ff0000`) for failed

### Discord

1. Open your Discord server settings
2. Go to **Integrations** > **Webhooks**
3. Click **New Webhook**
4. Choose the channel and copy the webhook URL

```yaml
notifications:
  level: all
  discord:
    enabled: true
    webhook_url: "https://discord.com/api/webhooks/1234567890/abcdefghijklmnop"
```

Messages are posted as rich embeds with the same color coding as Slack.

### Email

Requires SMTP credentials. Example with Gmail:

1. Enable 2-Factor Authentication on your Google account
2. Go to [Google App Passwords](https://myaccount.google.com/apppasswords)
3. Generate an app password for "Mail"
4. Use that password in the config

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

Other SMTP providers work the same way — just use their host and port.

Emails are sent as HTML with a status table showing task name, iterations, files modified, and any error or blocked reason.

### Webhook (Generic)

Sends a clean JSON payload via HTTP POST to any URL. Works with n8n, Zapier, Make, or any custom endpoint.

```yaml
notifications:
  level: all
  webhook:
    enabled: true
    url: "https://your-n8n.com/webhook/aidf"
```

If your endpoint requires authentication, add custom headers:

```yaml
notifications:
  level: all
  webhook:
    enabled: true
    url: "https://your-n8n.com/webhook/aidf"
    headers:
      Authorization: "Bearer your-token"
```

The payload is a flat JSON object:

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

This is the simplest channel to integrate with. No vendor-specific formatting — just raw data you can route however you want.

---

## When Notifications Fire

Notifications are sent automatically at the end of task execution in both modes:

- **`aidf run`** — After the task finishes (completed, failed, or blocked)
- **`aidf watch`** — After each task in the watch queue finishes

If multiple channels are enabled, they all fire in parallel. A failure in one channel does not affect the others or the task execution itself.

---

## Message Content

Every notification includes:

| Field | Description |
|-------|-------------|
| **Task** | File name of the task (e.g., `001-add-login.md`) |
| **Status** | Completed, Blocked, or Failed |
| **Iterations** | How many iterations the executor ran |
| **Files Modified** | Number of files changed |
| **Error** | Error message (if failed), truncated to 200 chars |
| **Blocked Reason** | Why human input is needed (if blocked), truncated to 200 chars |

---

## Example: Minimal Setup

Desktop notifications only, for errors and blocked tasks:

```yaml
notifications:
  level: errors
  desktop:
    enabled: true
```

## Example: Slack + Discord for Everything

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

## Example: Email Only When Blocked

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

## Example: n8n / Zapier via Generic Webhook

```yaml
notifications:
  level: all
  webhook:
    enabled: true
    url: "https://your-n8n.com/webhook/aidf-notifications"
```

---

## Zoom Chat via Generic Webhook

Zoom Team Chat supports incoming webhooks via the [Incoming Webhook app](https://marketplace.zoom.us/apps/eH_dLuquRd-VYcOsNGy-hQ) on the Zoom Marketplace. You can use the generic webhook channel with a Bearer token header:

```yaml
notifications:
  level: all
  webhook:
    enabled: true
    url: "https://integrations.zoom.us/chat/webhooks/incomingwebhook/your-endpoint"
    headers:
      Authorization: "Bearer your-zoom-token"
```

See [Zoom's Incoming Webhook Chatbot docs](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0067640) for setup details.

---

## Troubleshooting

**Notifications not sending**
- Check that the channel is `enabled: true` in config
- Check that the `level` matches the event type (e.g., `level: blocked` won't fire on `completed`)
- Run with `--verbose` to see debug logs for notification failures

**Slack/Discord webhook returns 404**
- Verify the webhook URL is correct and hasn't been revoked
- Verify the webhook URL format is correct and hasn't been revoked

**Email not arriving**
- Check spam folder
- Verify SMTP credentials (host, port, user, password)
- For Gmail, make sure you're using an App Password, not your account password
- Check that `smtp_port` is correct (587 for TLS, 465 for SSL)

**Desktop notifications not showing**
- On macOS, check System Settings > Notifications to ensure your terminal app has permission
- On Linux, ensure `libnotify` is installed (`sudo apt install libnotify-bin`)
