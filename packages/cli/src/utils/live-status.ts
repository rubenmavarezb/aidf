import chalk from 'chalk';

export interface PhaseEvent {
  phase: string;
  iteration: number;
  totalIterations: number;
  filesModified: number;
}

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

/**
 * Live status indicator that shows a spinning status line during execution.
 * Handles interleaving with AI output by clearing/redrawing around chunks.
 */
export class LiveStatus {
  private timer: ReturnType<typeof setInterval> | null = null;
  private frameIndex = 0;
  private phase = '';
  private iteration = 0;
  private totalIterations: number;
  private filesModified = 0;
  private startTime: number;
  private quiet: boolean;
  private lastLineLength = 0;
  private active = false;
  private hasOutputSinceRender = false;

  constructor(totalIterations: number, quiet: boolean = false) {
    this.totalIterations = totalIterations;
    this.startTime = Date.now();
    this.quiet = quiet;
  }

  /**
   * Start the live status indicator
   */
  start(): void {
    if (this.quiet || !process.stdout.isTTY) return;
    this.active = true;
    this.timer = setInterval(() => this.render(), 80);
  }

  /**
   * Update the current phase displayed
   */
  setPhase(event: PhaseEvent): void {
    this.phase = event.phase;
    this.iteration = event.iteration;
    this.totalIterations = event.totalIterations;
    this.filesModified = event.filesModified;
    if (this.active) this.render();
  }

  /**
   * Handle output from the AI provider.
   * Clears the status line, writes the output, marks for redraw.
   */
  handleOutput(chunk: string): void {
    if (!this.active || !process.stdout.isTTY) {
      process.stdout.write(chunk);
      return;
    }

    this.clearLine();
    process.stdout.write(chunk);
    this.hasOutputSinceRender = true;
  }

  /**
   * Show a completion line for the current phase
   */
  phaseComplete(message: string): void {
    if (this.quiet) return;
    if (!process.stdout.isTTY) {
      console.log(message);
      return;
    }

    this.clearLine();
    const elapsed = this.formatElapsed();
    console.log(`${chalk.green('✓')} ${message} ${chalk.gray(`⏱ ${elapsed}`)}`);
    this.lastLineLength = 0;
  }

  /**
   * Show a failure line for the current phase
   */
  phaseFailed(message: string): void {
    if (this.quiet) return;
    if (!process.stdout.isTTY) {
      console.log(message);
      return;
    }

    this.clearLine();
    const elapsed = this.formatElapsed();
    console.log(`${chalk.red('✗')} ${message} ${chalk.gray(`⏱ ${elapsed}`)}`);
    this.lastLineLength = 0;
  }

  /**
   * Stop the live status entirely
   */
  complete(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.active) {
      this.clearLine();
    }
    this.active = false;
  }

  private render(): void {
    if (!process.stdout.isTTY || this.quiet || !this.active) return;

    // If there was output since last render, ensure we're on a new line
    if (this.hasOutputSinceRender) {
      this.hasOutputSinceRender = false;
      this.lastLineLength = 0;
    }

    this.frameIndex = (this.frameIndex + 1) % SPINNER_FRAMES.length;

    const spinner = chalk.cyan(SPINNER_FRAMES[this.frameIndex]);
    const elapsed = this.formatElapsed();
    const iter = chalk.bold(`Iteration ${this.iteration}/${this.totalIterations}`);
    const phase = this.phase ? chalk.yellow(this.phase) : '';
    const files = chalk.gray(`${this.filesModified} file${this.filesModified !== 1 ? 's' : ''}`);
    const time = chalk.gray(`⏱ ${elapsed}`);

    const line = `${spinner} ${iter} · ${phase} · ${files} · ${time}`;

    this.clearLine();
    process.stdout.write(line);

    // Store visible length (without ANSI codes) for clearing
    this.lastLineLength = this.stripAnsi(line).length;
  }

  private clearLine(): void {
    if (process.stdout.isTTY && this.lastLineLength > 0) {
      process.stdout.write('\r' + ' '.repeat(this.lastLineLength) + '\r');
    } else if (process.stdout.isTTY) {
      process.stdout.write('\r');
    }
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

  private stripAnsi(str: string): string {
    // eslint-disable-next-line no-control-regex
    return str.replace(/\x1b\[[0-9;]*m/g, '');
  }
}
