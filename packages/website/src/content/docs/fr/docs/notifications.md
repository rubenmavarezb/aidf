---
title: Notifications
description: Recevez des notifications via Desktop, Slack, Discord, Email ou Webhooks lorsque les tâches AIDF se terminent, échouent ou sont bloquées.
---

AIDF peut vous notifier lorsque des tâches se terminent, échouent ou sont bloquées. C'est utile pour les tâches de longue durée ou le mode watch, lorsque vous ne surveillez pas le terminal.

## Canaux Supportés

| Canal | Fonctionnement | Prérequis |
|-------|---------------|-----------|
| **Desktop** | Notification au niveau de l'OS (macOS/Windows/Linux) | `node-notifier` (inclus) |
| **Slack** | Publie via un Incoming Webhook | Workspace Slack + URL de webhook |
| **Discord** | Publie via un webhook de canal | Serveur Discord + URL de webhook |
| **Email** | Envoie via SMTP | Identifiants de serveur SMTP |
| **Webhook** | POST JSON vers n'importe quelle URL | N'importe quel endpoint HTTP (n8n, Zapier, personnalisé) |

---

## Configuration

Ajoutez la section `notifications` à `.ai/config.yml` :

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

Vous n'avez besoin d'activer que les canaux que vous souhaitez. Tous les canaux sont désactivés par défaut.

---

## Niveaux de Notification

Le paramètre `level` contrôle quels événements déclenchent des notifications :

| Niveau | Completed | Blocked | Failed |
|--------|-----------|---------|--------|
| `all` | Oui | Oui | Oui |
| `errors` | Non | Oui | Oui |
| `blocked` | Non | Oui | Non |

- **`all`** -- Recevez une notification pour chaque résultat de tâche. Bon pour le monitoring.
- **`errors`** -- Seulement informé des problèmes. Bon pour la production/CI.
- **`blocked`** -- Uniquement lorsqu'une intervention humaine est nécessaire. Bruit minimal.

---

## Configuration des Canaux

### Desktop

Aucune configuration nécessaire au-delà de l'activation :

```yaml
notifications:
  level: all
  desktop:
    enabled: true
```

Utilise le système de notifications de votre OS (Centre de Notifications sur macOS, libnotify sur Linux, notifications toast sur Windows). Émet un son à la réception.

### Slack

1. Allez sur [Slack API: Incoming Webhooks](https://api.slack.com/messaging/webhooks)
2. Créez une nouvelle application (ou utilisez-en une existante) dans votre workspace
3. Activez **Incoming Webhooks** dans les paramètres de l'application
4. Cliquez sur **Add New Webhook to Workspace** et sélectionnez un canal
5. Copiez l'URL du webhook

```yaml
notifications:
  level: all
  slack:
    enabled: true
    webhook_url: "<your-slack-webhook-url>"
```

Les messages sont publiés avec des pièces jointes colorées :
- Vert (`#36a64f`) pour terminé
- Orange (`#ff9900`) pour bloqué
- Rouge (`#ff0000`) pour échoué

### Discord

1. Ouvrez les paramètres de votre serveur Discord
2. Allez dans **Integrations** > **Webhooks**
3. Cliquez sur **New Webhook**
4. Choisissez le canal et copiez l'URL du webhook

```yaml
notifications:
  level: all
  discord:
    enabled: true
    webhook_url: "https://discord.com/api/webhooks/1234567890/abcdefghijklmnop"
```

Les messages sont publiés sous forme d'embeds riches avec le même code couleur que Slack.

### Email

Nécessite des identifiants SMTP. Exemple avec Gmail :

1. Activez l'authentification à deux facteurs sur votre compte Google
2. Allez sur [Google App Passwords](https://myaccount.google.com/apppasswords)
3. Générez un mot de passe d'application pour "Mail"
4. Utilisez ce mot de passe dans la configuration

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

Les autres fournisseurs SMTP fonctionnent de la même manière -- utilisez simplement leur hôte et leur port.

Les emails sont envoyés en HTML avec un tableau de statut affichant le nom de la tâche, les itérations, les fichiers modifiés et tout message d'erreur ou raison de blocage.

### Webhook (Générique)

Envoie un payload JSON propre via HTTP POST vers n'importe quelle URL. Fonctionne avec n8n, Zapier, Make ou tout endpoint personnalisé.

```yaml
notifications:
  level: all
  webhook:
    enabled: true
    url: "https://your-n8n.com/webhook/aidf"
```

Si votre endpoint nécessite une authentification, ajoutez des en-têtes personnalisés :

```yaml
notifications:
  level: all
  webhook:
    enabled: true
    url: "https://your-n8n.com/webhook/aidf"
    headers:
      Authorization: "Bearer your-token"
```

Le payload est un objet JSON plat :

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

C'est le canal le plus simple à intégrer. Pas de formatage spécifique à un fournisseur -- juste des données brutes que vous pouvez router comme vous le souhaitez.

---

## Quand les Notifications se Déclenchent

Les notifications sont envoyées automatiquement à la fin de l'exécution de la tâche dans les deux modes :

- **`aidf run`** -- Après la fin de la tâche (terminée, échouée ou bloquée)
- **`aidf watch`** -- Après la fin de chaque tâche dans la file d'attente watch

Si plusieurs canaux sont activés, ils se déclenchent tous en parallèle. Un échec dans un canal n'affecte ni les autres canaux ni l'exécution de la tâche elle-même.

---

## Contenu des Messages

Chaque notification inclut :

| Champ | Description |
|-------|-------------|
| **Task** | Nom de fichier de la tâche (ex. `001-add-login.md`) |
| **Status** | Completed, Blocked ou Failed |
| **Iterations** | Nombre d'itérations exécutées par l'exécuteur |
| **Files Modified** | Nombre de fichiers modifiés |
| **Error** | Message d'erreur (si échoué), tronqué à 200 caractères |
| **Blocked Reason** | Pourquoi une intervention humaine est nécessaire (si bloqué), tronqué à 200 caractères |

---

## Exemple : Configuration Minimale

Notifications desktop uniquement, pour les erreurs et les tâches bloquées :

```yaml
notifications:
  level: errors
  desktop:
    enabled: true
```

## Exemple : Slack + Discord pour Tout

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

## Exemple : Email Uniquement en Cas de Blocage

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

## Exemple : n8n / Zapier via Webhook Générique

```yaml
notifications:
  level: all
  webhook:
    enabled: true
    url: "https://your-n8n.com/webhook/aidf-notifications"
```

---

## Zoom Chat via Webhook Générique

Zoom Team Chat prend en charge les webhooks entrants via l'[application Incoming Webhook](https://marketplace.zoom.us/apps/eH_dLuquRd-VYcOsNGy-hQ) sur le Zoom Marketplace. Vous pouvez utiliser le canal webhook générique avec un en-tête Bearer token :

```yaml
notifications:
  level: all
  webhook:
    enabled: true
    url: "https://integrations.zoom.us/chat/webhooks/incomingwebhook/your-endpoint"
    headers:
      Authorization: "Bearer your-zoom-token"
```

Consultez la [documentation Incoming Webhook Chatbot de Zoom](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0067640) pour les détails de configuration.

---

## Dépannage

**Les notifications ne s'envoient pas**
- Vérifiez que le canal est `enabled: true` dans la configuration
- Vérifiez que le `level` correspond au type d'événement (ex. `level: blocked` ne se déclenchera pas sur `completed`)
- Exécutez avec `--verbose` pour voir les logs de débogage des échecs de notification

**Le webhook Slack/Discord renvoie 404**
- Vérifiez que l'URL du webhook est correcte et n'a pas été révoquée
- Vérifiez que le format de l'URL du webhook est correct et n'a pas été révoqué

**L'email n'arrive pas**
- Vérifiez le dossier spam
- Vérifiez les identifiants SMTP (hôte, port, utilisateur, mot de passe)
- Pour Gmail, assurez-vous d'utiliser un mot de passe d'application, pas votre mot de passe de compte
- Vérifiez que `smtp_port` est correct (587 pour TLS, 465 pour SSL)

**Les notifications desktop ne s'affichent pas**
- Sur macOS, vérifiez Réglages Système > Notifications pour vous assurer que votre application terminal a la permission
- Sur Linux, assurez-vous que `libnotify` est installé (`sudo apt install libnotify-bin`)
