// packages/cli/src/utils/notifications.ts

import { basename } from 'path';
import type {
  NotificationsConfig,
  NotificationEvent,
  NotificationEventType,
  ExecutorResult,
} from '../types/index.js';
import type { Logger } from './logger.js';

export class NotificationService {
  private config: NotificationsConfig | undefined;
  private logger: Logger | undefined;

  constructor(config: NotificationsConfig | undefined, logger?: Logger) {
    this.config = config;
    this.logger = logger;
  }

  isEnabled(): boolean {
    if (!this.config) return false;
    return !!(
      this.config.desktop?.enabled ||
      this.config.slack?.enabled ||
      this.config.discord?.enabled ||
      this.config.email?.enabled ||
      this.config.webhook?.enabled
    );
  }

  async notify(event: NotificationEvent): Promise<void> {
    if (!this.isEnabled()) return;
    if (!this.shouldNotify(event.type)) return;

    const channels: Promise<void>[] = [];

    if (this.config!.desktop?.enabled) {
      channels.push(this.sendDesktop(event));
    }
    if (this.config!.slack?.enabled) {
      channels.push(this.sendSlack(event));
    }
    if (this.config!.discord?.enabled) {
      channels.push(this.sendDiscord(event));
    }
    if (this.config!.email?.enabled) {
      channels.push(this.sendEmail(event));
    }
    if (this.config!.webhook?.enabled) {
      channels.push(this.sendWebhook(event));
    }

    const results = await Promise.allSettled(channels);
    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger?.debug(`Notification channel failed: ${result.reason}`);
      }
    }
  }

  async notifyResult(result: ExecutorResult): Promise<void> {
    if (!this.isEnabled()) return;

    const eventType: NotificationEventType =
      result.status === 'completed'
        ? 'completed'
        : result.status === 'blocked'
          ? 'blocked'
          : 'failed';

    const event: NotificationEvent = {
      type: eventType,
      taskPath: result.taskPath,
      taskName: basename(result.taskPath),
      iterations: result.iterations,
      filesModified: result.filesModified,
      error: result.error,
      errorCategory: result.errorCategory,
      errorCode: result.errorCode,
      blockedReason: result.blockedReason,
      timestamp: new Date(),
    };

    await this.notify(event);
  }

  private shouldNotify(type: NotificationEventType): boolean {
    const level = this.config?.level ?? 'all';
    switch (level) {
      case 'all':
        return true;
      case 'errors':
        return type === 'failed' || type === 'blocked';
      case 'blocked':
        return type === 'blocked';
      default:
        return true;
    }
  }

  private formatTitle(event: NotificationEvent): string {
    const prefix = 'AIDF';
    switch (event.type) {
      case 'completed':
        return `${prefix}: Task Completed`;
      case 'blocked':
        return `${prefix}: Task Blocked`;
      case 'failed':
        return `${prefix}: Task Failed`;
    }
  }

  private formatMessage(event: NotificationEvent): string {
    const lines = [`Task: ${event.taskName}`, `Iterations: ${event.iterations}`];

    if (event.filesModified.length > 0) {
      lines.push(`Files modified: ${event.filesModified.length}`);
    }
    if (event.errorCategory) {
      const prefix = `[${event.errorCategory.toUpperCase()}]`;
      lines.push(`${prefix} ${event.error ?? 'Unknown error'}`);
    } else if (event.error) {
      lines.push(`Error: ${event.error}`);
    }
    if (event.blockedReason) {
      lines.push(`Blocked: ${event.blockedReason}`);
    }

    return lines.join('\n');
  }

  private async sendDesktop(event: NotificationEvent): Promise<void> {
    try {
      const notifier = await import('node-notifier');
      await new Promise<void>((resolve, reject) => {
        notifier.default.notify(
          {
            title: this.formatTitle(event),
            message: this.formatMessage(event),
            sound: true,
          },
          (err: Error | null) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    } catch (error) {
      this.logger?.debug(`Desktop notification failed: ${error}`);
    }
  }

  private async sendSlack(event: NotificationEvent): Promise<void> {
    const webhookUrl = this.config!.slack!.webhook_url;
    if (!webhookUrl) return;

    try {
      const color =
        event.type === 'completed'
          ? '#36a64f'
          : event.type === 'blocked'
            ? '#ff9900'
            : '#ff0000';

      const fields = [
        { type: 'mrkdwn', text: `*Task:*\n${event.taskName}` },
        { type: 'mrkdwn', text: `*Iterations:*\n${event.iterations}` },
        { type: 'mrkdwn', text: `*Files:*\n${event.filesModified.length}` },
      ];

      if (event.error) {
        fields.push({ type: 'mrkdwn', text: `*Error:*\n${event.error.slice(0, 200)}` });
      }
      if (event.blockedReason) {
        fields.push({ type: 'mrkdwn', text: `*Blocked:*\n${event.blockedReason.slice(0, 200)}` });
      }

      const payload = {
        attachments: [
          {
            color,
            blocks: [
              {
                type: 'header',
                text: {
                  type: 'plain_text',
                  text: this.formatTitle(event),
                },
              },
              {
                type: 'section',
                fields,
              },
            ],
          },
        ],
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Slack webhook returned ${response.status}`);
      }
    } catch (error) {
      this.logger?.debug(`Slack notification failed: ${error}`);
    }
  }

  private async sendDiscord(event: NotificationEvent): Promise<void> {
    const webhookUrl = this.config!.discord!.webhook_url;
    if (!webhookUrl) return;

    try {
      const color =
        event.type === 'completed'
          ? 0x36a64f
          : event.type === 'blocked'
            ? 0xff9900
            : 0xff0000;

      const fields = [
        { name: 'Task', value: event.taskName, inline: true },
        { name: 'Iterations', value: String(event.iterations), inline: true },
        { name: 'Files Modified', value: String(event.filesModified.length), inline: true },
      ];

      if (event.error) {
        fields.push({ name: 'Error', value: event.error.slice(0, 200), inline: false });
      }
      if (event.blockedReason) {
        fields.push({ name: 'Blocked Reason', value: event.blockedReason.slice(0, 200), inline: false });
      }

      const payload = {
        embeds: [
          {
            title: this.formatTitle(event),
            color,
            fields,
            timestamp: event.timestamp.toISOString(),
          },
        ],
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Discord webhook returned ${response.status}`);
      }
    } catch (error) {
      this.logger?.debug(`Discord notification failed: ${error}`);
    }
  }

  private async sendEmail(event: NotificationEvent): Promise<void> {
    const emailConfig = this.config!.email!;
    if (!emailConfig.smtp_host) return;

    try {
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.default.createTransport({
        host: emailConfig.smtp_host,
        port: emailConfig.smtp_port,
        auth: {
          user: emailConfig.smtp_user,
          pass: emailConfig.smtp_pass,
        },
      });

      const statusEmoji =
        event.type === 'completed' ? '&#9989;' : event.type === 'blocked' ? '&#9888;' : '&#10060;';

      const html = `
        <h2>${statusEmoji} ${this.formatTitle(event)}</h2>
        <table>
          <tr><td><strong>Task:</strong></td><td>${event.taskName}</td></tr>
          <tr><td><strong>Status:</strong></td><td>${event.type}</td></tr>
          <tr><td><strong>Iterations:</strong></td><td>${event.iterations}</td></tr>
          <tr><td><strong>Files Modified:</strong></td><td>${event.filesModified.length}</td></tr>
          ${event.error ? `<tr><td><strong>Error:</strong></td><td>${event.error}</td></tr>` : ''}
          ${event.blockedReason ? `<tr><td><strong>Blocked:</strong></td><td>${event.blockedReason}</td></tr>` : ''}
        </table>
        <p><em>Sent by AIDF Notification System</em></p>
      `;

      await transporter.sendMail({
        from: emailConfig.from,
        to: emailConfig.to,
        subject: this.formatTitle(event),
        html,
      });
    } catch (error) {
      this.logger?.debug(`Email notification failed: ${error}`);
    }
  }

  private async sendWebhook(event: NotificationEvent): Promise<void> {
    const webhookConfig = this.config!.webhook!;
    if (!webhookConfig.url) return;

    try {
      const payload = {
        type: event.type,
        task: event.taskName,
        taskPath: event.taskPath,
        iterations: event.iterations,
        filesModified: event.filesModified.length,
        error: event.error ?? null,
        blockedReason: event.blockedReason ?? null,
        timestamp: event.timestamp.toISOString(),
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...webhookConfig.headers,
      };

      const response = await fetch(webhookConfig.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Webhook returned ${response.status}`);
      }
    } catch (error) {
      this.logger?.debug(`Webhook notification failed: ${error}`);
    }
  }
}
