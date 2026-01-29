import chalk from 'chalk';

export interface PhaseEvent {
  phase: string;
  iteration: number;
  totalIterations: number;
  filesModified: number;
}

const HEARTBEAT_INTERVAL = 15_000; // 15 seconds

/**
 * Live status indicator that prints periodic heartbeat lines during execution.
 * Heartbeats are non-destructive — they print as regular log lines between
 * AI output, so they never conflict with streaming stdout.
 */
export class LiveStatus {
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private phase = '';
  private iteration = 0;
  private totalIterations: number;
  private filesModified = 0;
  private startTime: number;
  private quiet: boolean;
  private active = false;
  private lastOutputTime = 0;

  constructor(totalIterations: number, quiet: boolean = false) {
    this.totalIterations = totalIterations;
    this.startTime = Date.now();
    this.quiet = quiet;
  }

  /**
   * Start the live status indicator
   */
  start(): void {
    if (this.quiet) return;
    this.active = true;
    this.heartbeatTimer = setInterval(() => this.heartbeat(), HEARTBEAT_INTERVAL);
  }

  /**
   * Update the current phase displayed
   */
  setPhase(event: PhaseEvent): void {
    const previousPhase = this.phase;
    this.phase = event.phase;
    this.iteration = event.iteration;
    this.totalIterations = event.totalIterations;
    this.filesModified = event.filesModified;

    // Print phase transition (but not the first "Executing AI" — that's obvious)
    if (this.active && previousPhase && previousPhase !== event.phase) {
      this.printStatus('phase');
    }
  }

  /**
   * Handle output from the AI provider.
   * Just passes through — no terminal manipulation needed.
   */
  handleOutput(chunk: string): void {
    process.stdout.write(chunk);
    this.lastOutputTime = Date.now();
  }

  /**
   * Show a completion line for the current phase
   */
  phaseComplete(message: string): void {
    if (this.quiet) return;
    const elapsed = this.formatElapsed();
    console.log(`${chalk.green('✓')} ${message} ${chalk.gray(`⏱ ${elapsed}`)}`);
  }

  /**
   * Show a failure line for the current phase
   */
  phaseFailed(message: string): void {
    if (this.quiet) return;
    const elapsed = this.formatElapsed();
    console.log(`${chalk.red('✗')} ${message} ${chalk.gray(`⏱ ${elapsed}`)}`);
  }

  /**
   * Stop the live status entirely
   */
  complete(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.active = false;
  }

  /**
   * Periodic heartbeat — prints a status line if no AI output was received recently
   */
  private heartbeat(): void {
    if (this.quiet || !this.active) return;

    // Only print heartbeat if no AI output in the last 5 seconds
    // (avoids cluttering when the AI is actively streaming)
    const silentMs = Date.now() - this.lastOutputTime;
    if (this.lastOutputTime > 0 && silentMs < 5000) return;

    this.printStatus('heartbeat');
  }

  private printStatus(type: 'heartbeat' | 'phase'): void {
    const elapsed = this.formatElapsed();
    const iter = `Iteration ${this.iteration}/${this.totalIterations}`;
    const phase = this.phase || 'Starting';
    const files = `${this.filesModified} file${this.filesModified !== 1 ? 's' : ''}`;

    const prefix = type === 'heartbeat'
      ? chalk.gray('⋯')
      : chalk.cyan('▸');

    const line = `${prefix} ${chalk.gray(`${iter} · ${phase} · ${files} · ⏱ ${elapsed}`)}`;
    console.log(line);
  }

  private formatElapsed(): string {
    const ms = Date.now() - this.startTime;
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    if (m > 0) {
      return `${m}:${(s % 60).toString().padStart(2, '0')}`;
    }
    return `${s}s`;
  }
}
