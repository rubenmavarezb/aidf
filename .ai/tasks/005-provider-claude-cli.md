# TASK: Implementar Provider Claude CLI

## Goal
Crear el provider que ejecuta prompts usando el CLI de Claude Code (`claude`), similar a la técnica Ralph.

## Status: ✅ COMPLETED

- **Completed:** 2026-01-27
- **Agent:** Claude Code (main session)
- **Tests:** 15 passed
- **Files Created:** providers/types.ts, providers/claude-cli.ts, providers/claude-cli.test.ts, providers/index.ts

## Task Type
component

## Suggested Roles
- developer

## Auto-Mode Compatible
⚠️ **PARCIAL** - El código se puede generar en auto-mode, pero requiere testing manual con Claude CLI real.

## Scope

### Allowed
- `packages/cli/src/core/providers/claude-cli.ts`
- `packages/cli/src/core/providers/claude-cli.test.ts`
- `packages/cli/src/core/providers/types.ts`
- `packages/cli/src/types/index.ts`

### Forbidden
- `templates/**`
- Cualquier archivo fuera de `packages/cli/`

## Requirements

### 1. Interface del provider en `providers/types.ts`

```typescript
// packages/cli/src/core/providers/types.ts

export interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  filesChanged: string[];
  iterationComplete: boolean;
  completionSignal?: string;  // e.g., "<TASK_COMPLETE>"
}

export interface ProviderOptions {
  model?: string;
  timeout?: number;
  maxTokens?: number;
  dangerouslySkipPermissions?: boolean;
}

export interface Provider {
  name: string;
  execute(prompt: string, options?: ProviderOptions): Promise<ExecutionResult>;
  isAvailable(): Promise<boolean>;
}
```

### 2. Implementar `claude-cli.ts`

```typescript
// packages/cli/src/core/providers/claude-cli.ts

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import type { Provider, ExecutionResult, ProviderOptions } from './types.js';

/**
 * Detecta archivos cambiados comparando antes/después
 * Simplificado: usa git status
 */
async function detectChangedFiles(cwd: string): Promise<string[]> {
  return new Promise((resolve) => {
    const proc = spawn('git', ['status', '--porcelain'], { cwd });
    let output = '';

    proc.stdout?.on('data', (data) => {
      output += data.toString();
    });

    proc.on('close', () => {
      const files = output
        .split('\n')
        .filter(line => line.trim())
        .map(line => line.slice(3).trim());  // Remove status prefix
      resolve(files);
    });

    proc.on('error', () => resolve([]));
  });
}

/**
 * Provider que usa Claude Code CLI
 */
export class ClaudeCliProvider implements Provider {
  name = 'claude-cli';
  private cwd: string;

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd;
  }

  /**
   * Verifica si claude CLI está disponible
   */
  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn('claude', ['--version'], { shell: true });

      proc.on('close', (code) => {
        resolve(code === 0);
      });

      proc.on('error', () => {
        resolve(false);
      });
    });
  }

  /**
   * Ejecuta un prompt con Claude CLI
   */
  async execute(prompt: string, options: ProviderOptions = {}): Promise<ExecutionResult> {
    const {
      timeout = 600000,  // 10 min default
      dangerouslySkipPermissions = false,
    } = options;

    // Capturar estado inicial de archivos
    const filesBefore = await detectChangedFiles(this.cwd);

    return new Promise((resolve) => {
      const args: string[] = [
        '--print',  // Non-interactive, print output
      ];

      if (dangerouslySkipPermissions) {
        args.push('--dangerously-skip-permissions');
      }

      // Claude CLI lee de stdin
      const proc = spawn('claude', args, {
        cwd: this.cwd,
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        // Opcional: stream a console para feedback
        process.stdout.write(chunk);
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      // Enviar prompt via stdin
      proc.stdin?.write(prompt);
      proc.stdin?.end();

      const timeoutId = setTimeout(() => {
        proc.kill('SIGTERM');
        resolve({
          success: false,
          output: stdout,
          error: `Execution timed out after ${timeout}ms`,
          filesChanged: [],
          iterationComplete: false,
        });
      }, timeout);

      proc.on('close', async (code) => {
        clearTimeout(timeoutId);

        // Detectar archivos cambiados
        const filesAfter = await detectChangedFiles(this.cwd);
        const filesChanged = filesAfter.filter(f => !filesBefore.includes(f));

        // Detectar señal de completado
        const completionSignal = this.detectCompletionSignal(stdout);

        resolve({
          success: code === 0,
          output: stdout,
          error: stderr || undefined,
          filesChanged,
          iterationComplete: completionSignal !== undefined,
          completionSignal,
        });
      });

      proc.on('error', (error) => {
        clearTimeout(timeoutId);
        resolve({
          success: false,
          output: '',
          error: `Failed to execute claude: ${error.message}`,
          filesChanged: [],
          iterationComplete: false,
        });
      });
    });
  }

  /**
   * Detecta señales de completado en el output
   */
  private detectCompletionSignal(output: string): string | undefined {
    const signals = [
      '<TASK_COMPLETE>',
      '<DONE>',
      '## Task Complete',
      '✅ All done',
      'Definition of Done: All criteria met',
    ];

    for (const signal of signals) {
      if (output.includes(signal)) {
        return signal;
      }
    }

    return undefined;
  }
}

/**
 * Factory function
 */
export function createClaudeCliProvider(cwd?: string): Provider {
  return new ClaudeCliProvider(cwd);
}
```

### 3. Prompt builder helper

```typescript
// Añadir a claude-cli.ts o crear prompt-builder.ts

/**
 * Construye el prompt completo para una iteración
 */
export function buildIterationPrompt(context: {
  agents: string;
  role: string;
  task: string;
  plan?: string;
  previousOutput?: string;
  iteration: number;
}): string {
  let prompt = '';

  // Header con instrucciones del loop
  prompt += `# AIDF Autonomous Execution - Iteration ${context.iteration}\n\n`;
  prompt += `You are executing a task autonomously. Follow the context below.\n\n`;

  // Contexto del proyecto
  prompt += `## Project Context (AGENTS.md)\n\n`;
  prompt += context.agents;
  prompt += '\n\n';

  // Rol
  prompt += `## Your Role\n\n`;
  prompt += context.role;
  prompt += '\n\n';

  // Task
  prompt += `## Current Task\n\n`;
  prompt += context.task;
  prompt += '\n\n';

  // Plan si existe
  if (context.plan) {
    prompt += `## Implementation Plan\n\n`;
    prompt += context.plan;
    prompt += '\n\n';
  }

  // Output previo si existe (para continuación)
  if (context.previousOutput) {
    prompt += `## Previous Iteration Output\n\n`;
    prompt += '```\n';
    prompt += context.previousOutput.slice(-2000);  // Últimos 2000 chars
    prompt += '\n```\n\n';
  }

  // Instrucciones de ejecución
  prompt += `## Execution Instructions\n\n`;
  prompt += `1. Read the task requirements carefully\n`;
  prompt += `2. Check the Definition of Done criteria\n`;
  prompt += `3. Make necessary code changes\n`;
  prompt += `4. Stay within the allowed scope\n`;
  prompt += `5. When ALL Definition of Done criteria are met, output: <TASK_COMPLETE>\n`;
  prompt += `6. If you encounter a blocker, output: <BLOCKED: reason>\n\n`;

  prompt += `**IMPORTANT:** Only modify files within the allowed scope. `;
  prompt += `Do NOT modify files in the forbidden scope.\n`;

  return prompt;
}
```

### 4. Tests en `claude-cli.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClaudeCliProvider, buildIterationPrompt } from './claude-cli.js';

// Mock child_process para tests sin Claude real
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

describe('ClaudeCliProvider', () => {
  describe('isAvailable', () => {
    it('should return true when claude CLI exists', async () => {
      // Test with mock
    });
  });

  describe('detectCompletionSignal', () => {
    const provider = new ClaudeCliProvider();

    it('should detect <TASK_COMPLETE>', () => {
      // Access private method via any
      const signal = (provider as any).detectCompletionSignal(
        'Some output\n<TASK_COMPLETE>\nMore output'
      );
      expect(signal).toBe('<TASK_COMPLETE>');
    });

    it('should return undefined when no signal', () => {
      const signal = (provider as any).detectCompletionSignal(
        'Normal output without completion'
      );
      expect(signal).toBeUndefined();
    });
  });
});

describe('buildIterationPrompt', () => {
  it('should include all context sections', () => {
    const prompt = buildIterationPrompt({
      agents: '# Project Overview\nTest project',
      role: '# Role: Developer\nYou are a developer',
      task: '# Task\nImplement feature X',
      iteration: 1,
    });

    expect(prompt).toContain('AIDF Autonomous Execution');
    expect(prompt).toContain('Iteration 1');
    expect(prompt).toContain('Test project');
    expect(prompt).toContain('Developer');
    expect(prompt).toContain('feature X');
    expect(prompt).toContain('<TASK_COMPLETE>');
  });

  it('should include plan when provided', () => {
    const prompt = buildIterationPrompt({
      agents: 'agents',
      role: 'role',
      task: 'task',
      plan: '# Implementation Plan\n1. Step one',
      iteration: 2,
    });

    expect(prompt).toContain('Implementation Plan');
    expect(prompt).toContain('Step one');
  });

  it('should truncate long previous output', () => {
    const longOutput = 'x'.repeat(5000);
    const prompt = buildIterationPrompt({
      agents: 'agents',
      role: 'role',
      task: 'task',
      previousOutput: longOutput,
      iteration: 3,
    });

    expect(prompt).toContain('Previous Iteration Output');
    // Should be truncated to ~2000 chars
    expect(prompt.match(/x/g)?.length).toBeLessThan(3000);
  });
});
```

## Definition of Done
- [ ] `ClaudeCliProvider` implementa interface `Provider`
- [ ] `isAvailable()` detecta si claude CLI está instalado
- [ ] `execute()` envía prompt via stdin y captura output
- [ ] Detecta archivos cambiados usando git status
- [ ] Detecta señales de completado en output
- [ ] `buildIterationPrompt` construye prompt estructurado
- [ ] Maneja timeout correctamente
- [ ] Tests unitarios pasan (con mocks)
- [ ] TypeScript compila sin errores

## Notes
- Claude CLI se llama `claude` y acepta input via stdin con `--print`
- El flag `--dangerously-skip-permissions` es necesario para ejecución autónoma
- Detectar cambios via git es más confiable que filesystem watching
- Las señales de completado pueden ser personalizadas en el futuro
- El prompt builder es crucial para la calidad del output
