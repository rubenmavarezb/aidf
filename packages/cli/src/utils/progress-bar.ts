// packages/cli/src/utils/progress-bar.ts

import chalk from 'chalk';

export function formatTokens(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return `${count}`;
}

export class ProgressBar {
  private total: number;
  private current: number;
  private filesModified: number;
  private startTime: Date;
  private quiet: boolean;
  private lastRender: string = '';
  private tokensInput: number = 0;
  private tokensOutput: number = 0;

  constructor(total: number, quiet: boolean = false) {
    this.total = total;
    this.current = 0;
    this.filesModified = 0;
    this.startTime = new Date();
    this.quiet = quiet;
  }

  update(current: number, filesModified: number, iteration: number, tokenUsage?: { inputTokens: number; outputTokens: number }): void {
    if (this.quiet) {
      return;
    }

    this.current = Math.min(current, this.total);
    this.filesModified = filesModified;
    if (tokenUsage) {
      this.tokensInput = tokenUsage.inputTokens;
      this.tokensOutput = tokenUsage.outputTokens;
    }
    this.render(iteration);
  }

  complete(): void {
    if (this.quiet) {
      return;
    }

    // Clear the last line and move to next line
    if (this.lastRender && process.stdout.isTTY) {
      process.stdout.write('\r' + ' '.repeat(this.lastRender.length) + '\r');
    } else if (this.lastRender) {
      // For non-TTY, just add a newline
      process.stdout.write('\n');
    }
  }

  private render(iteration: number): void {
    if (!process.stdout.isTTY || this.quiet) {
      return;
    }

    const percentage = this.total > 0 ? Math.round((this.current / this.total) * 100) : 0;
    const elapsed = this.formatTime(Date.now() - this.startTime.getTime());
    const eta = this.calculateETA();
    const barWidth = 30;
    const filled = Math.round((percentage / 100) * barWidth);
    const empty = barWidth - filled;

    const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
    const iterationText = `Iteration ${iteration}/${this.total}`;
    const filesText = `${this.filesModified} file${this.filesModified !== 1 ? 's' : ''}`;
    const percentageText = `${percentage}%`;
    const elapsedText = `⏱ ${elapsed}`;

    const totalTokens = this.tokensInput + this.tokensOutput;
    const tokensText = totalTokens > 0 ? ` | 🔤 ${formatTokens(totalTokens)} tokens` : '';

    const line = `${iterationText} | ${bar} | ${percentageText} | ${filesText} | ${elapsedText}${tokensText} | ETA: ${eta}`;
    this.lastRender = line;

    process.stdout.write('\r' + line);
  }

  private calculateETA(): string {
    if (this.current === 0 || this.current >= this.total) {
      return '--:--';
    }

    const elapsed = Date.now() - this.startTime.getTime();
    const avgTimePerIteration = elapsed / this.current;
    const remaining = this.total - this.current;
    const etaMs = avgTimePerIteration * remaining;

    return this.formatTime(etaMs);
  }

  private formatTime(ms: number): string {
    const seconds = Math.round(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes > 0) {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${seconds}s`;
  }
}
