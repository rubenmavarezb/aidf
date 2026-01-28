// packages/cli/src/utils/logger.ts

import chalk from 'chalk';
import ora, { Ora } from 'ora';
import { createWriteStream, mkdirSync, WriteStream } from 'fs';
import { dirname } from 'path';
import type { LogContext, StructuredLogEntry } from '../types/index.js';

export type LogFormat = 'text' | 'json';

export interface LoggerOptions {
  verbose?: boolean;
  quiet?: boolean;
  logFormat?: LogFormat;
  logFile?: string;
  logRotate?: boolean;
  prefix?: string;
  prefixColor?: string;
}

export class Logger {
  private verbose: boolean;
  private quiet: boolean;
  private spinner: Ora | null = null;
  private logFormat: LogFormat;
  private logFile: string | null;
  private logStream: WriteStream | null = null;
  private context: LogContext = {};
  private prefix: string | null;
  private prefixColor: string | null;

  constructor(options: boolean | LoggerOptions = false) {
    if (typeof options === 'boolean') {
      // Backward compatibility: boolean means verbose
      this.verbose = options;
      this.quiet = false;
      this.logFormat = 'text';
      this.logFile = null;
      this.prefix = null;
      this.prefixColor = null;
    } else {
      this.verbose = options.verbose ?? false;
      this.quiet = options.quiet ?? false;
      this.logFormat = options.logFormat ?? 'text';
      this.logFile = options.logFile ?? null;
      this.prefix = options.prefix ?? null;
      this.prefixColor = options.prefixColor ?? null;

      if (this.logFile) {
        this.initializeLogFile(this.logFile, options.logRotate ?? false);
      }
    }
  }

  /**
   * Set context for subsequent log entries
   */
  setContext(context: LogContext): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * Clear context
   */
  clearContext(): void {
    this.context = {};
  }

  /**
   * Close log file stream if open
   */
  async close(): Promise<void> {
    if (this.logStream) {
      return new Promise((resolve, reject) => {
        this.logStream!.end(() => {
          this.logStream = null;
          resolve();
        });
        this.logStream!.on('error', reject);
      });
    }
  }

  info(message: string): void {
    this.log('info', message);
  }

  success(message: string): void {
    this.log('success', message);
  }

  warn(message: string): void {
    this.log('warn', message);
  }

  error(message: string): void {
    this.log('error', message);
  }

  debug(message: string): void {
    if (!this.verbose) return;
    const timestamped = this.withTimestamp(message);
    this.log('debug', timestamped);
  }

  private withTimestamp(message: string): string {
    const now = new Date();
    const timestamp = now.toISOString().replace('T', ' ').substring(0, 23);
    return `[${timestamp}] ${message}`;
  }

  /**
   * Internal logging method that handles both text and JSON formats
   */
  private log(level: 'debug' | 'info' | 'warn' | 'error' | 'success', message: string): void {
    if (this.logFormat === 'json') {
      const entry: StructuredLogEntry = {
        timestamp: new Date().toISOString(),
        level,
        message: this.prefix ? `[${this.prefix}] ${message}` : message,
        context: Object.keys(this.context).length > 0 ? { ...this.context } : undefined,
      };

      const jsonLine = JSON.stringify(entry) + '\n';

      if (this.logStream) {
        this.logStream.write(jsonLine);
      }
      if (!this.logStream && !this.quiet) {
        process.stdout.write(jsonLine);
      }
    } else {
      // Text format
      const output = this.formatTextLog(level, message);

      if (this.logStream) {
        this.logStream.write(output + '\n');
      }
      if (!this.logStream && !this.quiet) {
        if (level === 'error') {
          console.error(output);
        } else {
          console.log(output);
        }
      }
    }
  }

  /**
   * Format log message for text output
   */
  private formatTextLog(level: 'debug' | 'info' | 'warn' | 'error' | 'success', message: string): string {
    const prefixStr = this.prefix
      ? (this.prefixColor ? (chalk as any)[this.prefixColor](`[${this.prefix}]`) : chalk.cyan(`[${this.prefix}]`)) + ' '
      : '';

    switch (level) {
      case 'info':
        return prefixStr + chalk.blue('i') + ' ' + message;
      case 'success':
        return prefixStr + chalk.green('✓') + ' ' + message;
      case 'warn':
        return prefixStr + chalk.yellow('!') + ' ' + message;
      case 'error':
        return prefixStr + chalk.red('✗') + ' ' + message;
      case 'debug':
        return prefixStr + chalk.gray('  [debug]') + ' ' + message;
      default:
        return prefixStr + message;
    }
  }

  /**
   * Initialize log file with optional rotation
   */
  private initializeLogFile(filePath: string, rotate: boolean): void {
    try {
      let finalPath = filePath;

      if (rotate) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const ext = filePath.includes('.') ? filePath.substring(filePath.lastIndexOf('.')) : '.log';
        const base = filePath.includes('.') ? filePath.substring(0, filePath.lastIndexOf('.')) : filePath;
        finalPath = `${base}-${timestamp}${ext}`;
      }

      // Ensure directory exists
      const dir = dirname(finalPath);
      mkdirSync(dir, { recursive: true });

      // Create write stream in append mode
      this.logStream = createWriteStream(finalPath, { flags: 'a' });

      // Handle stream errors
      this.logStream.on('error', (err) => {
        console.error(`Failed to write to log file: ${err.message}`);
        this.logStream = null;
        this.logFile = null;
      });
    } catch (error) {
      console.error(`Failed to create log file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.logStream = null;
      this.logFile = null;
    }
  }

  startSpinner(message: string): void {
    if (this.logFormat === 'json') {
      // In JSON mode, emit a structured event instead of spinner
      if (!this.quiet) {
        this.log('info', `[spinner:start] ${message}`);
      }
    } else {
      if (!this.quiet) {
        this.spinner = ora(message).start();
      }
    }
  }

  updateSpinner(message: string): void {
    if (this.logFormat === 'json') {
      // In JSON mode, emit a structured event instead of spinner
      if (!this.quiet) {
        this.log('info', `[spinner:update] ${message}`);
      }
    } else {
      if (this.spinner && !this.quiet) {
        this.spinner.text = message;
      }
    }
  }

  stopSpinner(success: boolean = true, message?: string): void {
    if (this.logFormat === 'json') {
      // In JSON mode, emit a structured event instead of spinner
      if (!this.quiet) {
        const status = success ? 'success' : 'error';
        const msg = message || (success ? 'Completed' : 'Failed');
        this.log(status, `[spinner:stop] ${msg}`);
      }
    } else {
      if (this.spinner && !this.quiet) {
        if (success) {
          this.spinner.succeed(message);
        } else {
          this.spinner.fail(message);
        }
        this.spinner = null;
      }
    }
  }

  box(title: string, content: string): void {
    if (this.quiet) {
      return;
    }

    if (this.logFormat === 'json') {
      // In JSON mode, emit structured box content
      const lines = content.split('\n');
      this.log('info', `[box:${title}]`);
      for (const line of lines) {
        if (line.trim()) {
          this.log('info', `  ${line}`);
        }
      }
    } else {
      const lines = content.split('\n');
      const maxLen = Math.max(title.length, ...lines.map(l => l.length));
      const border = '─'.repeat(maxLen + 2);

      const output = [
        '',
        chalk.gray(`┌${border}┐`),
        chalk.gray('│ ') + chalk.bold(title.padEnd(maxLen)) + chalk.gray(' │'),
        chalk.gray(`├${border}┤`),
        ...lines.map(line => chalk.gray('│ ') + line.padEnd(maxLen) + chalk.gray(' │')),
        chalk.gray(`└${border}┘`),
        '',
      ].join('\n');

      if (this.logStream) {
        this.logStream.write(output + '\n');
      } else {
        console.log(output);
      }
    }
  }
}

export const logger = new Logger();
