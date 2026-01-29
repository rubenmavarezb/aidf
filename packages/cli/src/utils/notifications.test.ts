import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NotificationService } from './notifications.js';
import type {
  NotificationsConfig,
  NotificationEvent,
  ExecutorResult,
} from '../types/index.js';

// Mock node-notifier
vi.mock('node-notifier', () => ({
  default: {
    notify: vi.fn((_opts: unknown, cb: (err: Error | null) => void) => cb(null)),
  },
}));

// Mock nodemailer
const mockSendMail = vi.fn().mockResolvedValue({ messageId: 'test-id' });
vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: mockSendMail,
    })),
  },
}));

function makeEvent(type: 'completed' | 'blocked' | 'failed'): NotificationEvent {
  return {
    type,
    taskPath: '.ai/tasks/test-task.md',
    taskName: 'test-task.md',
    iterations: 5,
    filesModified: ['src/foo.ts', 'src/bar.ts'],
    error: type === 'failed' ? 'Something went wrong' : undefined,
    blockedReason: type === 'blocked' ? 'Max iterations reached' : undefined,
    timestamp: new Date('2025-01-15T12:00:00Z'),
  };
}

function makeResult(status: 'completed' | 'blocked' | 'failed'): ExecutorResult {
  return {
    success: status === 'completed',
    status,
    iterations: 3,
    filesModified: ['src/index.ts'],
    error: status === 'failed' ? 'Test error' : undefined,
    blockedReason: status === 'blocked' ? 'Blocked reason' : undefined,
    taskPath: '.ai/tasks/example.md',
  };
}

describe('NotificationService', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', mockFetch);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('isEnabled', () => {
    it('returns false with no config', () => {
      const svc = new NotificationService(undefined);
      expect(svc.isEnabled()).toBe(false);
    });

    it('returns false when no channels are enabled', () => {
      const config: NotificationsConfig = {
        level: 'all',
        desktop: { enabled: false },
        slack: { enabled: false, webhook_url: '' },
      };
      const svc = new NotificationService(config);
      expect(svc.isEnabled()).toBe(false);
    });

    it('returns true when desktop is enabled', () => {
      const config: NotificationsConfig = {
        level: 'all',
        desktop: { enabled: true },
      };
      const svc = new NotificationService(config);
      expect(svc.isEnabled()).toBe(true);
    });

    it('returns true when slack is enabled', () => {
      const config: NotificationsConfig = {
        level: 'all',
        slack: { enabled: true, webhook_url: 'https://hooks.slack.com/test' },
      };
      const svc = new NotificationService(config);
      expect(svc.isEnabled()).toBe(true);
    });

    it('returns true when discord is enabled', () => {
      const config: NotificationsConfig = {
        level: 'all',
        discord: { enabled: true, webhook_url: 'https://discord.com/api/webhooks/test' },
      };
      const svc = new NotificationService(config);
      expect(svc.isEnabled()).toBe(true);
    });

    it('returns true when webhook is enabled', () => {
      const config: NotificationsConfig = {
        level: 'all',
        webhook: { enabled: true, url: 'https://example.com/hook' },
      };
      const svc = new NotificationService(config);
      expect(svc.isEnabled()).toBe(true);
    });

    it('returns true when email is enabled', () => {
      const config: NotificationsConfig = {
        level: 'all',
        email: {
          enabled: true,
          smtp_host: 'smtp.example.com',
          smtp_port: 587,
          smtp_user: 'user',
          smtp_pass: 'pass',
          from: 'from@example.com',
          to: 'to@example.com',
        },
      };
      const svc = new NotificationService(config);
      expect(svc.isEnabled()).toBe(true);
    });
  });

  describe('level filtering', () => {
    it('level=all sends for all event types', async () => {
      const config: NotificationsConfig = {
        level: 'all',
        slack: { enabled: true, webhook_url: 'https://hooks.slack.com/test' },
      };
      const svc = new NotificationService(config);

      await svc.notify(makeEvent('completed'));
      await svc.notify(makeEvent('blocked'));
      await svc.notify(makeEvent('failed'));

      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('level=errors sends only for failed and blocked', async () => {
      const config: NotificationsConfig = {
        level: 'errors',
        slack: { enabled: true, webhook_url: 'https://hooks.slack.com/test' },
      };
      const svc = new NotificationService(config);

      await svc.notify(makeEvent('completed'));
      await svc.notify(makeEvent('blocked'));
      await svc.notify(makeEvent('failed'));

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('level=blocked sends only for blocked', async () => {
      const config: NotificationsConfig = {
        level: 'blocked',
        slack: { enabled: true, webhook_url: 'https://hooks.slack.com/test' },
      };
      const svc = new NotificationService(config);

      await svc.notify(makeEvent('completed'));
      await svc.notify(makeEvent('blocked'));
      await svc.notify(makeEvent('failed'));

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('slack channel', () => {
    it('sends POST to webhook URL with correct payload', async () => {
      const config: NotificationsConfig = {
        level: 'all',
        slack: { enabled: true, webhook_url: 'https://hooks.slack.com/services/T00/B00/xxx' },
      };
      const svc = new NotificationService(config);

      await svc.notify(makeEvent('completed'));

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://hooks.slack.com/services/T00/B00/xxx');
      expect(options.method).toBe('POST');
      expect(options.headers['Content-Type']).toBe('application/json');

      const body = JSON.parse(options.body);
      expect(body.attachments).toBeDefined();
      expect(body.attachments[0].blocks[0].text.text).toContain('Completed');
    });

    it('skips when webhook_url is empty', async () => {
      const config: NotificationsConfig = {
        level: 'all',
        slack: { enabled: true, webhook_url: '' },
      };
      const svc = new NotificationService(config);

      await svc.notify(makeEvent('completed'));
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('discord channel', () => {
    it('sends POST to webhook URL with embeds', async () => {
      const config: NotificationsConfig = {
        level: 'all',
        discord: { enabled: true, webhook_url: 'https://discord.com/api/webhooks/123/abc' },
      };
      const svc = new NotificationService(config);

      await svc.notify(makeEvent('failed'));

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://discord.com/api/webhooks/123/abc');

      const body = JSON.parse(options.body);
      expect(body.embeds).toBeDefined();
      expect(body.embeds[0].title).toContain('Failed');
      expect(body.embeds[0].color).toBe(0xff0000);
      expect(body.embeds[0].fields).toBeDefined();
      expect(body.embeds[0].timestamp).toBeDefined();
    });
  });

  describe('desktop channel', () => {
    it('calls node-notifier with title and message', async () => {
      const config: NotificationsConfig = {
        level: 'all',
        desktop: { enabled: true },
      };
      const svc = new NotificationService(config);

      await svc.notify(makeEvent('completed'));

      const notifier = await import('node-notifier');
      expect(notifier.default.notify).toHaveBeenCalledTimes(1);
      const call = (notifier.default.notify as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0].title).toContain('Completed');
      expect(call[0].sound).toBe(true);
    });
  });

  describe('email channel', () => {
    it('calls nodemailer createTransport and sendMail', async () => {
      const config: NotificationsConfig = {
        level: 'all',
        email: {
          enabled: true,
          smtp_host: 'smtp.example.com',
          smtp_port: 587,
          smtp_user: 'user',
          smtp_pass: 'pass',
          from: 'aidf@example.com',
          to: 'dev@example.com',
        },
      };
      const svc = new NotificationService(config);

      await svc.notify(makeEvent('blocked'));

      const nodemailer = await import('nodemailer');
      expect(nodemailer.default.createTransport).toHaveBeenCalledWith({
        host: 'smtp.example.com',
        port: 587,
        auth: { user: 'user', pass: 'pass' },
      });
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.from).toBe('aidf@example.com');
      expect(mailOptions.to).toBe('dev@example.com');
      expect(mailOptions.subject).toContain('Blocked');
      expect(mailOptions.html).toContain('test-task.md');
    });

    it('skips when smtp_host is empty', async () => {
      const config: NotificationsConfig = {
        level: 'all',
        email: {
          enabled: true,
          smtp_host: '',
          smtp_port: 587,
          smtp_user: '',
          smtp_pass: '',
          from: '',
          to: '',
        },
      };
      const svc = new NotificationService(config);

      await svc.notify(makeEvent('completed'));
      expect(mockSendMail).not.toHaveBeenCalled();
    });
  });

  describe('webhook channel', () => {
    it('sends POST to URL with clean JSON payload', async () => {
      const config: NotificationsConfig = {
        level: 'all',
        webhook: { enabled: true, url: 'https://n8n.example.com/webhook/aidf' },
      };
      const svc = new NotificationService(config);

      await svc.notify(makeEvent('completed'));

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://n8n.example.com/webhook/aidf');
      expect(options.method).toBe('POST');
      expect(options.headers['Content-Type']).toBe('application/json');

      const body = JSON.parse(options.body);
      expect(body.type).toBe('completed');
      expect(body.task).toBe('test-task.md');
      expect(body.iterations).toBe(5);
      expect(body.filesModified).toBe(2);
      expect(body.error).toBeNull();
      expect(body.blockedReason).toBeNull();
      expect(body.timestamp).toBeDefined();
    });

    it('includes custom headers when provided', async () => {
      const config: NotificationsConfig = {
        level: 'all',
        webhook: {
          enabled: true,
          url: 'https://n8n.example.com/webhook/aidf',
          headers: { 'Authorization': 'Bearer my-token' },
        },
      };
      const svc = new NotificationService(config);

      await svc.notify(makeEvent('completed'));

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers['Authorization']).toBe('Bearer my-token');
      expect(options.headers['Content-Type']).toBe('application/json');
    });

    it('includes error and blockedReason when present', async () => {
      const config: NotificationsConfig = {
        level: 'all',
        webhook: { enabled: true, url: 'https://example.com/hook' },
      };
      const svc = new NotificationService(config);

      await svc.notify(makeEvent('failed'));

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.type).toBe('failed');
      expect(body.error).toBe('Something went wrong');
    });

    it('skips when url is empty', async () => {
      const config: NotificationsConfig = {
        level: 'all',
        webhook: { enabled: true, url: '' },
      };
      const svc = new NotificationService(config);

      await svc.notify(makeEvent('completed'));
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('does not throw when slack webhook fails', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      const config: NotificationsConfig = {
        level: 'all',
        slack: { enabled: true, webhook_url: 'https://hooks.slack.com/test' },
      };
      const svc = new NotificationService(config);

      // Should not throw
      await expect(svc.notify(makeEvent('completed'))).resolves.toBeUndefined();
    });

    it('does not throw when fetch rejects', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const config: NotificationsConfig = {
        level: 'all',
        discord: { enabled: true, webhook_url: 'https://discord.com/api/webhooks/test' },
      };
      const svc = new NotificationService(config);

      await expect(svc.notify(makeEvent('completed'))).resolves.toBeUndefined();
    });

    it('does not throw when node-notifier errors', async () => {
      const notifier = await import('node-notifier');
      (notifier.default.notify as ReturnType<typeof vi.fn>).mockImplementationOnce(
        (_opts: unknown, cb: (err: Error | null) => void) => cb(new Error('Notifier error'))
      );

      const config: NotificationsConfig = {
        level: 'all',
        desktop: { enabled: true },
      };
      const svc = new NotificationService(config);

      await expect(svc.notify(makeEvent('completed'))).resolves.toBeUndefined();
    });
  });

  describe('multiple channels', () => {
    it('fires all enabled channels in parallel', async () => {
      const config: NotificationsConfig = {
        level: 'all',
        desktop: { enabled: true },
        slack: { enabled: true, webhook_url: 'https://hooks.slack.com/test' },
        discord: { enabled: true, webhook_url: 'https://discord.com/api/webhooks/test' },
        webhook: { enabled: true, url: 'https://n8n.example.com/webhook/aidf' },
        email: {
          enabled: true,
          smtp_host: 'smtp.example.com',
          smtp_port: 587,
          smtp_user: 'user',
          smtp_pass: 'pass',
          from: 'from@test.com',
          to: 'to@test.com',
        },
      };
      const svc = new NotificationService(config);

      await svc.notify(makeEvent('completed'));

      // Slack + Discord + Webhook = 3 fetch calls
      expect(mockFetch).toHaveBeenCalledTimes(3);

      // Desktop
      const notifier = await import('node-notifier');
      expect(notifier.default.notify).toHaveBeenCalled();

      // Email
      expect(mockSendMail).toHaveBeenCalled();
    });
  });

  describe('notifyResult', () => {
    it('converts completed ExecutorResult to notification event', async () => {
      const config: NotificationsConfig = {
        level: 'all',
        slack: { enabled: true, webhook_url: 'https://hooks.slack.com/test' },
      };
      const svc = new NotificationService(config);

      await svc.notifyResult(makeResult('completed'));

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.attachments[0].blocks[0].text.text).toContain('Completed');
    });

    it('converts blocked ExecutorResult to notification event', async () => {
      const config: NotificationsConfig = {
        level: 'all',
        slack: { enabled: true, webhook_url: 'https://hooks.slack.com/test' },
      };
      const svc = new NotificationService(config);

      await svc.notifyResult(makeResult('blocked'));

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.attachments[0].blocks[0].text.text).toContain('Blocked');
    });

    it('converts failed ExecutorResult to notification event', async () => {
      const config: NotificationsConfig = {
        level: 'all',
        slack: { enabled: true, webhook_url: 'https://hooks.slack.com/test' },
      };
      const svc = new NotificationService(config);

      await svc.notifyResult(makeResult('failed'));

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.attachments[0].blocks[0].text.text).toContain('Failed');
    });

    it('does nothing when not enabled', async () => {
      const svc = new NotificationService(undefined);

      await svc.notifyResult(makeResult('completed'));
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
