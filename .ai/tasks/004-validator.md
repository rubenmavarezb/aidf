# TASK: Implementar Validator (Pre-commit/Push checks)

## Goal
Crear el módulo que ejecuta comandos de validación (lint, test, typecheck) y reporta resultados.

## Status: ✅ COMPLETED

- **Completed:** 2026-01-27
- **Agent:** Claude Code (parallel session 3)
- **Tests:** 7 passed
- **Files Created:** validator.ts, validator.test.ts

## Task Type
component

## Suggested Roles
- developer

## Auto-Mode Compatible
✅ **SÍ** - Cursor auto-mode funciona bien. Lógica clara de ejecución de comandos.

## Scope

### Allowed
- `packages/cli/src/core/validator.ts`
- `packages/cli/src/core/validator.test.ts`
- `packages/cli/src/types/index.ts`

### Forbidden
- `templates/**`
- Cualquier archivo fuera de `packages/cli/`

## Requirements

### 1. Tipos adicionales en `types/index.ts`

```typescript
export interface ValidationResult {
  command: string;
  passed: boolean;
  output: string;
  duration: number;  // milliseconds
  exitCode: number;
}

export interface ValidationSummary {
  phase: 'pre_commit' | 'pre_push' | 'pre_pr';
  passed: boolean;
  results: ValidationResult[];
  totalDuration: number;
}
```

### 2. Implementar `validator.ts`

```typescript
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
```

### 3. Tests en `validator.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { runCommand, runValidation, Validator } from './validator.js';

describe('runCommand', () => {
  it('should run successful command', async () => {
    const result = await runCommand('echo "hello"', process.cwd());
    expect(result.passed).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('hello');
  });

  it('should capture failed command', async () => {
    const result = await runCommand('exit 1', process.cwd());
    expect(result.passed).toBe(false);
    expect(result.exitCode).toBe(1);
  });

  it('should timeout long commands', async () => {
    const result = await runCommand('sleep 10', process.cwd(), 100);
    expect(result.passed).toBe(false);
    expect(result.output).toContain('timed out');
  });
});

describe('runValidation', () => {
  it('should stop on first failure by default', async () => {
    const results = await runValidation(
      ['exit 1', 'echo "never runs"'],
      'pre_commit',
      process.cwd()
    );
    expect(results.passed).toBe(false);
    expect(results.results).toHaveLength(1);
  });

  it('should continue when stopOnFirst is false', async () => {
    const results = await runValidation(
      ['exit 1', 'echo "runs"'],
      'pre_commit',
      process.cwd(),
      { stopOnFirst: false }
    );
    expect(results.passed).toBe(false);
    expect(results.results).toHaveLength(2);
  });
});

describe('Validator.formatReport', () => {
  it('should format passed summary', () => {
    const report = Validator.formatReport({
      phase: 'pre_commit',
      passed: true,
      results: [{
        command: 'pnpm lint',
        passed: true,
        output: 'All good',
        duration: 1234,
        exitCode: 0,
      }],
      totalDuration: 1234,
    });

    expect(report).toContain('✅');
    expect(report).toContain('PASSED');
    expect(report).toContain('pnpm lint');
  });

  it('should format failed summary with output', () => {
    const report = Validator.formatReport({
      phase: 'pre_commit',
      passed: false,
      results: [{
        command: 'pnpm lint',
        passed: false,
        output: 'Error: something wrong',
        duration: 500,
        exitCode: 1,
      }],
      totalDuration: 500,
    });

    expect(report).toContain('❌');
    expect(report).toContain('FAILED');
    expect(report).toContain('Error: something wrong');
  });
});
```

## Definition of Done
- [ ] `runCommand` ejecuta comandos y captura output/exitCode
- [ ] `runCommand` respeta timeout
- [ ] `runValidation` ejecuta lista de comandos
- [ ] `runValidation` soporta `stopOnFirst` option
- [ ] `Validator` class maneja config de validación
- [ ] `formatReport` genera markdown legible
- [ ] `detectValidationCommands` detecta scripts de package.json
- [ ] Tests unitarios pasan
- [ ] TypeScript compila sin errores

## Notes
- Usar `spawn` en vez de `exec` para mejor manejo de output streaming
- Timeout default de 5 minutos para comandos largos como tests
- Truncar output a 5000 caracteres para evitar reports gigantes
- El output se guarda para debugging pero puede ser verbose
