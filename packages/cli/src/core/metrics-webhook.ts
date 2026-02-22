import type { WebhookConfig, ExecutionReport } from '../types/index.js';
import type { Logger } from '../utils/logger.js';

function getBackoffDelay(attempt: number): number {
  const baseDelay = Math.min(100 * Math.pow(2, attempt), 10000);
  const jitter = baseDelay * 0.1 * Math.random();
  return baseDelay + jitter;
}

function expandEnvVariables(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (match, key) => {
    return process.env[key] ?? match;
  });
}

export class MetricsWebhook {
  private config: WebhookConfig;
  private logger?: Logger;

  constructor(config: WebhookConfig, logger?: Logger) {
    this.config = config;
    this.logger = logger;
  }

  private shouldSend(report: ExecutionReport): boolean {
    if (!this.config.enabled) return false;
    if (!this.config.events || this.config.events.length === 0) return true;
    return this.config.events.includes(report.status);
  }

  private preparePayload(report: ExecutionReport): Partial<ExecutionReport> {
    if (this.config.include_iterations === false) {
      const { tokens, timing, ...rest } = report;
      return {
        ...rest,
        tokens: tokens ? { ...tokens, perIteration: undefined } : undefined,
        timing: { ...timing, perIteration: undefined },
      };
    }
    return report;
  }

  private prepareHeaders(report: ExecutionReport): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-AIDF-Event': report.status,
      'X-AIDF-Run-ID': report.runId,
    };
    if (this.config.headers) {
      for (const [key, value] of Object.entries(this.config.headers)) {
        headers[key] = expandEnvVariables(value);
      }
    }
    return headers;
  }

  async send(report: ExecutionReport): Promise<void> {
    if (!this.shouldSend(report)) return;

    const maxRetries = this.config.retry ?? 2;
    const timeout = this.config.timeout ?? 10000;
    const payload = this.preparePayload(report);
    const headers = this.prepareHeaders(report);

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(this.config.url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Webhook returned ${response.status}: ${response.statusText}`);
        }

        this.logger?.debug(`Metrics webhook sent successfully (run: ${report.runId.slice(0, 8)})`);
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < maxRetries) {
          const delay = getBackoffDelay(attempt);
          this.logger?.debug(`Webhook attempt ${attempt + 1} failed, retrying in ${Math.round(delay)}ms`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    this.logger?.warn(`Metrics webhook failed after ${maxRetries + 1} attempts: ${lastError?.message}`);
  }
}
