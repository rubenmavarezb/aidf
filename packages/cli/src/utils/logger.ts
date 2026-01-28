// packages/cli/src/utils/logger.ts

import chalk from 'chalk';
import ora, { Ora } from 'ora';

export class Logger {
  private verbose: boolean;
  private spinner: Ora | null = null;

  constructor(verbose: boolean = false) {
    this.verbose = verbose;
  }

  info(message: string): void {
    console.log(chalk.blue('i'), message);
  }

  success(message: string): void {
    console.log(chalk.green('✓'), message);
  }

  warn(message: string): void {
    console.log(chalk.yellow('!'), message);
  }

  error(message: string): void {
    console.error(chalk.red('✗'), message);
  }

  debug(message: string): void {
    if (this.verbose) {
      console.log(chalk.gray('  [debug]'), message);
    }
  }

  startSpinner(message: string): void {
    this.spinner = ora(message).start();
  }

  updateSpinner(message: string): void {
    if (this.spinner) {
      this.spinner.text = message;
    }
  }

  stopSpinner(success: boolean = true, message?: string): void {
    if (this.spinner) {
      if (success) {
        this.spinner.succeed(message);
      } else {
        this.spinner.fail(message);
      }
      this.spinner = null;
    }
  }

  box(title: string, content: string): void {
    const lines = content.split('\n');
    const maxLen = Math.max(title.length, ...lines.map(l => l.length));
    const border = '─'.repeat(maxLen + 2);

    console.log('');
    console.log(chalk.gray(`┌${border}┐`));
    console.log(chalk.gray('│ ') + chalk.bold(title.padEnd(maxLen)) + chalk.gray(' │'));
    console.log(chalk.gray(`├${border}┤`));
    for (const line of lines) {
      console.log(chalk.gray('│ ') + line.padEnd(maxLen) + chalk.gray(' │'));
    }
    console.log(chalk.gray(`└${border}┘`));
    console.log('');
  }
}

export const logger = new Logger();
