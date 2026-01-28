// packages/cli/src/core/validator.ts

import { spawn } from 'child_process';
import type { ValidationResult, ValidationSummary, ValidationConfig } from '../types/index.js';

/**
 * Ejecuta un comando y captura output
 */
export async function runCommand(
  command: string,
  cwd: string,
  timeout: number = 300000  // 5 min default
): Promise<ValidationResult> {
  const startTime = Date.now();

  return new Promise((resolve) => {
    const [cmd, ...args] = command.split(' ');
    const proc = spawn(cmd, args, {
      cwd,
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    const timeoutId = setTimeout(() => {
      proc.kill('SIGTERM');
      resolve({
        command,
        passed: false,
        output: `Command timed out after ${timeout}ms\n${stdout}\n${stderr}`,
        duration: Date.now() - startTime,
        exitCode: -1,
      });
    }, timeout);

    proc.on('close', (code) => {
      clearTimeout(timeoutId);
      resolve({
        command,
        passed: code === 0,
        output: stdout + (stderr ? `\n--- stderr ---\n${stderr}` : ''),
        duration: Date.now() - startTime,
        exitCode: code ?? -1,
      });
    });

    proc.on('error', (error) => {
      clearTimeout(timeoutId);
      resolve({
        command,
        passed: false,
        output: `Failed to execute: ${error.message}`,
        duration: Date.now() - startTime,
        exitCode: -1,
      });
    });
  });
}

/**
 * Ejecuta una lista de comandos de validación
 */
export async function runValidation(
  commands: string[],
  phase: ValidationSummary['phase'],
  cwd: string,
  options: {
    stopOnFirst?: boolean;
    timeout?: number;
  } = {}
): Promise<ValidationSummary> {
  const { stopOnFirst = true, timeout = 300000 } = options;
  const results: ValidationResult[] = [];
  const startTime = Date.now();

  for (const command of commands) {
    const result = await runCommand(command, cwd, timeout);
    results.push(result);

    if (!result.passed && stopOnFirst) {
      break;
    }
  }

  return {
    phase,
    passed: results.every(r => r.passed),
    results,
    totalDuration: Date.now() - startTime,
  };
}

/**
 * Clase Validator para manejar validaciones de config
 */
export class Validator {
  private config: ValidationConfig;
  private cwd: string;

  constructor(config: ValidationConfig, cwd: string) {
    this.config = config;
    this.cwd = cwd;
  }

  /**
   * Ejecuta validaciones pre-commit
   */
  async preCommit(): Promise<ValidationSummary> {
    if (!this.config.pre_commit || this.config.pre_commit.length === 0) {
      return {
        phase: 'pre_commit',
        passed: true,
        results: [],
        totalDuration: 0,
      };
    }
    return runValidation(this.config.pre_commit, 'pre_commit', this.cwd);
  }

  /**
   * Ejecuta validaciones pre-push
   */
  async prePush(): Promise<ValidationSummary> {
    if (!this.config.pre_push || this.config.pre_push.length === 0) {
      return {
        phase: 'pre_push',
        passed: true,
        results: [],
        totalDuration: 0,
      };
    }
    return runValidation(this.config.pre_push, 'pre_push', this.cwd);
  }

  /**
   * Ejecuta validaciones pre-pr
   */
  async prePr(): Promise<ValidationSummary> {
    if (!this.config.pre_pr || this.config.pre_pr.length === 0) {
      return {
        phase: 'pre_pr',
        passed: true,
        results: [],
        totalDuration: 0,
      };
    }
    return runValidation(this.config.pre_pr, 'pre_pr', this.cwd, { stopOnFirst: false });
  }

  /**
   * Genera reporte markdown de validación
   */
  static formatReport(summary: ValidationSummary): string {
    const icon = summary.passed ? '✅' : '❌';
    let report = `## ${icon} Validation: ${summary.phase}\n\n`;
    report += `**Status:** ${summary.passed ? 'PASSED' : 'FAILED'}\n`;
    report += `**Duration:** ${(summary.totalDuration / 1000).toFixed(2)}s\n\n`;

    if (summary.results.length === 0) {
      report += '_No validation commands configured for this phase._\n';
      return report;
    }

    report += '### Results\n\n';

    for (const result of summary.results) {
      const resultIcon = result.passed ? '✅' : '❌';
      report += `#### ${resultIcon} \`${result.command}\`\n\n`;
      report += `- Exit code: ${result.exitCode}\n`;
      report += `- Duration: ${(result.duration / 1000).toFixed(2)}s\n`;

      if (!result.passed || result.output.trim()) {
        report += '\n<details>\n<summary>Output</summary>\n\n';
        report += '```\n';
        report += result.output.slice(0, 5000);  // Limitar output
        if (result.output.length > 5000) {
          report += '\n... (truncated)';
        }
        report += '\n```\n</details>\n\n';
      }
    }

    return report;
  }
}

/**
 * Detecta comandos de validación del proyecto automáticamente
 */
export async function detectValidationCommands(cwd: string): Promise<Partial<ValidationConfig>> {
  const fs = await import('fs/promises');
  const path = await import('path');

  const detected: Partial<ValidationConfig> = {
    pre_commit: [],
    pre_push: [],
    pre_pr: [],
  };

  // Detectar package.json scripts
  try {
    const pkgPath = path.join(cwd, 'package.json');
    const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));
    const scripts = pkg.scripts || {};

    // Pre-commit: lint, typecheck
    if (scripts.lint) detected.pre_commit!.push('pnpm lint');
    if (scripts.typecheck) detected.pre_commit!.push('pnpm typecheck');

    // Pre-push: test
    if (scripts.test) detected.pre_push!.push('pnpm test');

    // Pre-pr: build
    if (scripts.build) detected.pre_pr!.push('pnpm build');
  } catch {
    // No package.json or not readable
  }

  return detected;
}
