# TASK: Implementar Executor Loop Principal

## Goal
Crear el motor de ejecución que orquesta el loop autónomo: carga contexto → ejecuta provider → valida → commit → repeat.

## Status: ✅ COMPLETED

- **Completed:** 2026-01-27
- **Agent:** Claude Code (parallel session)
- **Tests:** 18 passed
- **Files Created:** executor.ts, executor.test.ts

## Task Type
architecture

## Suggested Roles
- architect
- developer

## Auto-Mode Compatible
⚠️ **PARCIAL** - La estructura se puede generar en auto-mode, pero la integración requiere testing manual.

## Scope

### Allowed
- `packages/cli/src/core/executor.ts`
- `packages/cli/src/core/executor.test.ts`
- `packages/cli/src/types/index.ts`

### Forbidden
- `templates/**`
- Cualquier archivo fuera de `packages/cli/`

## Requirements

### 1. Tipos adicionales en `types/index.ts`

```typescript
export type ExecutorStatus =
  | 'idle'
  | 'running'
  | 'paused'
  | 'completed'
  | 'blocked'
  | 'failed';

export interface ExecutorState {
  status: ExecutorStatus;
  iteration: number;
  startedAt?: Date;
  completedAt?: Date;
  lastError?: string;
  filesModified: string[];
  validationResults: ValidationSummary[];
}

export interface ExecutorOptions {
  maxIterations: number;
  maxConsecutiveFailures: number;
  timeoutPerIteration: number;
  scopeEnforcement: ScopeMode;
  autoCommit: boolean;
  autoPush: boolean;
  dryRun: boolean;
  verbose: boolean;
  onIteration?: (state: ExecutorState) => void;
  onAskUser?: (question: string, files: string[]) => Promise<boolean>;
}

export interface ExecutorResult {
  success: boolean;
  status: ExecutorStatus;
  iterations: number;
  filesModified: string[];
  error?: string;
  blockedReason?: string;
  taskPath: string;
}
```

### 2. Implementar `executor.ts`

```typescript
// packages/cli/src/core/executor.ts

import { simpleGit, SimpleGit } from 'simple-git';
import type {
  ExecutorOptions,
  ExecutorState,
  ExecutorResult,
  ExecutorStatus,
  LoadedContext,
  AidfConfig,
} from '../types/index.js';
import { ContextLoader, loadContext } from './context-loader.js';
import { createProvider, type Provider, type ExecutionResult } from './providers/index.js';
import { buildIterationPrompt } from './providers/claude-cli.js';
import { ScopeGuard } from './safety.js';
import { Validator, type ValidationSummary } from './validator.js';

export class Executor {
  private options: ExecutorOptions;
  private config: AidfConfig;
  private cwd: string;
  private provider: Provider;
  private git: SimpleGit;
  private state: ExecutorState;

  constructor(
    config: AidfConfig,
    options: Partial<ExecutorOptions> = {},
    cwd: string = process.cwd()
  ) {
    this.config = config;
    this.cwd = cwd;
    this.git = simpleGit(cwd);

    // Merge options con defaults
    this.options = {
      maxIterations: config.execution?.max_iterations ?? 50,
      maxConsecutiveFailures: config.execution?.max_consecutive_failures ?? 3,
      timeoutPerIteration: config.execution?.timeout_per_iteration ?? 300,
      scopeEnforcement: config.permissions?.scope_enforcement ?? 'ask',
      autoCommit: config.permissions?.auto_commit ?? true,
      autoPush: config.permissions?.auto_push ?? false,
      dryRun: false,
      verbose: false,
      ...options,
    };

    // Crear provider
    this.provider = createProvider(
      config.provider?.type ?? 'claude-cli',
      cwd
    );

    // Estado inicial
    this.state = {
      status: 'idle',
      iteration: 0,
      filesModified: [],
      validationResults: [],
    };
  }

  /**
   * Ejecuta una task
   */
  async run(taskPath: string): Promise<ExecutorResult> {
    this.state.status = 'running';
    this.state.startedAt = new Date();
    this.state.iteration = 0;

    let consecutiveFailures = 0;
    let context: LoadedContext;

    try {
      // Cargar contexto
      context = await loadContext(taskPath);
      this.log(`Loaded context for task: ${context.task.goal}`);
      this.log(`Role: ${context.role.name}`);
      this.log(`Scope: ${context.task.scope.allowed.join(', ')}`);

      // Crear scope guard
      const scopeGuard = new ScopeGuard(
        context.task.scope,
        this.options.scopeEnforcement
      );

      // Crear validator
      const validator = new Validator(this.config.validation, this.cwd);

      // Loop principal
      while (
        this.state.iteration < this.options.maxIterations &&
        consecutiveFailures < this.options.maxConsecutiveFailures &&
        this.state.status === 'running'
      ) {
        this.state.iteration++;
        this.log(`\n=== Iteration ${this.state.iteration} ===`);

        // Construir prompt
        const prompt = buildIterationPrompt({
          agents: context.agents.raw,
          role: context.role.raw,
          task: context.task.raw,
          plan: context.plan,
          iteration: this.state.iteration,
        });

        // Ejecutar provider
        if (this.options.dryRun) {
          this.log('[DRY RUN] Would execute prompt...');
          break;
        }

        const result = await this.provider.execute(prompt, {
          timeout: this.options.timeoutPerIteration * 1000,
          dangerouslySkipPermissions: this.options.scopeEnforcement === 'permissive',
        });

        // Verificar scope violations
        if (result.filesChanged.length > 0) {
          const fileChanges = result.filesChanged.map(f => ({
            path: f,
            type: 'modified' as const,
          }));

          const scopeDecision = scopeGuard.validate(fileChanges);

          if (scopeDecision.action === 'BLOCK') {
            this.log(`Scope violation: ${scopeDecision.reason}`);
            await this.revertChanges(scopeDecision.files);
            consecutiveFailures++;
            continue;
          }

          if (scopeDecision.action === 'ASK_USER' && this.options.onAskUser) {
            const approved = await this.options.onAskUser(
              scopeDecision.reason,
              scopeDecision.files
            );
            if (!approved) {
              await this.revertChanges(scopeDecision.files);
              consecutiveFailures++;
              continue;
            }
            scopeGuard.approve(scopeDecision.files);
          }
        }

        // Validar cambios
        const validation = await validator.preCommit();
        this.state.validationResults.push(validation);

        if (!validation.passed) {
          this.log(`Validation failed: ${Validator.formatReport(validation)}`);
          consecutiveFailures++;
          continue;
        }

        // Commit si autoCommit está habilitado
        if (this.options.autoCommit && result.filesChanged.length > 0) {
          await this.commitChanges(result.filesChanged, context.task.goal);
          this.state.filesModified.push(...result.filesChanged);
        }

        // Reset consecutive failures on success
        consecutiveFailures = 0;

        // Notificar callback
        this.options.onIteration?.(this.state);

        // Verificar completado
        if (result.iterationComplete) {
          this.log(`Task complete: ${result.completionSignal}`);
          this.state.status = 'completed';
          break;
        }

        // Verificar bloqueado
        if (!result.success && result.error) {
          if (result.error.includes('BLOCKED')) {
            this.state.status = 'blocked';
            this.state.lastError = result.error;
            await this.updateTaskWithBlockedStatus(taskPath, result.error);
            break;
          }
        }
      }

      // Verificar si terminamos por límite de iteraciones
      if (
        this.state.status === 'running' &&
        this.state.iteration >= this.options.maxIterations
      ) {
        this.state.status = 'blocked';
        this.state.lastError = `Max iterations (${this.options.maxIterations}) reached`;
      }

      // Verificar si terminamos por failures consecutivos
      if (
        this.state.status === 'running' &&
        consecutiveFailures >= this.options.maxConsecutiveFailures
      ) {
        this.state.status = 'blocked';
        this.state.lastError = `Max consecutive failures (${this.options.maxConsecutiveFailures}) reached`;
      }

    } catch (error) {
      this.state.status = 'failed';
      this.state.lastError = error instanceof Error ? error.message : 'Unknown error';
    }

    this.state.completedAt = new Date();

    // Push si autoPush está habilitado
    if (this.options.autoPush && this.state.status === 'completed') {
      await this.git.push();
      this.log('Pushed changes to remote');
    }

    return {
      success: this.state.status === 'completed',
      status: this.state.status,
      iterations: this.state.iteration,
      filesModified: this.state.filesModified,
      error: this.state.lastError,
      blockedReason: this.state.status === 'blocked' ? this.state.lastError : undefined,
      taskPath,
    };
  }

  /**
   * Pausa la ejecución
   */
  pause(): void {
    if (this.state.status === 'running') {
      this.state.status = 'paused';
    }
  }

  /**
   * Reanuda la ejecución
   */
  resume(): void {
    if (this.state.status === 'paused') {
      this.state.status = 'running';
    }
  }

  /**
   * Obtiene el estado actual
   */
  getState(): ExecutorState {
    return { ...this.state };
  }

  // --- Helpers privados ---

  private log(message: string): void {
    if (this.options.verbose) {
      console.log(`[aidf] ${message}`);
    }
  }

  private async revertChanges(files: string[]): Promise<void> {
    this.log(`Reverting changes to: ${files.join(', ')}`);
    await this.git.checkout(['--', ...files]);
  }

  private async commitChanges(files: string[], taskGoal: string): Promise<void> {
    const prefix = this.config.git?.commit_prefix ?? 'aidf:';
    const message = `${prefix} ${taskGoal.slice(0, 50)}${taskGoal.length > 50 ? '...' : ''}`;

    await this.git.add(files);
    await this.git.commit(message);
    this.log(`Committed: ${message}`);
  }

  private async updateTaskWithBlockedStatus(
    taskPath: string,
    reason: string
  ): Promise<void> {
    const fs = await import('fs/promises');
    const existingContent = await fs.readFile(taskPath, 'utf-8');

    // Añadir sección de BLOCKED status
    const blockedSection = `

## Status: ⚠️ BLOCKED

### Execution Log
- **Started:** ${this.state.startedAt?.toISOString()}
- **Iterations:** ${this.state.iteration}
- **Blocked at:** ${new Date().toISOString()}

### Blocking Issue
\`\`\`
${reason}
\`\`\`

### Files Modified
${this.state.filesModified.map(f => `- \`${f}\``).join('\n') || '_None_'}

---
@developer: Review and provide guidance, then run \`aidf run --resume ${taskPath}\`
`;

    // Insertar después del Goal
    const updatedContent = existingContent.includes('## Status:')
      ? existingContent.replace(/## Status:[\s\S]*?(?=\n## |$)/, blockedSection.trim())
      : existingContent.replace(
          /(## Goal\n[^\n]+\n)/,
          `$1${blockedSection}`
        );

    await fs.writeFile(taskPath, updatedContent);
    this.log(`Updated task file with BLOCKED status`);
  }
}

/**
 * Factory function conveniente
 */
export async function executeTask(
  taskPath: string,
  options?: Partial<ExecutorOptions>
): Promise<ExecutorResult> {
  // Cargar config
  const configPath = await findConfigFile();
  const config = configPath ? await loadConfig(configPath) : getDefaultConfig();

  const executor = new Executor(config, options);
  return executor.run(taskPath);
}

// Helpers para config
async function findConfigFile(): Promise<string | null> {
  const fs = await import('fs');
  const path = await import('path');

  const possiblePaths = [
    '.ai/config.yml',
    '.ai/config.yaml',
    '.ai/config.json',
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(path.join(process.cwd(), p))) {
      return path.join(process.cwd(), p);
    }
  }
  return null;
}

async function loadConfig(configPath: string): Promise<AidfConfig> {
  const fs = await import('fs/promises');
  const yaml = await import('yaml');

  const content = await fs.readFile(configPath, 'utf-8');

  if (configPath.endsWith('.json')) {
    return JSON.parse(content);
  }
  return yaml.parse(content);
}

function getDefaultConfig(): AidfConfig {
  return {
    version: 1,
    provider: { type: 'claude-cli' },
    execution: {
      max_iterations: 50,
      max_consecutive_failures: 3,
      timeout_per_iteration: 300,
    },
    permissions: {
      scope_enforcement: 'ask',
      auto_commit: true,
      auto_push: false,
      auto_pr: false,
    },
    validation: {
      pre_commit: [],
      pre_push: [],
      pre_pr: [],
    },
    git: {
      commit_prefix: 'aidf:',
      branch_prefix: 'aidf/',
    },
  };
}
```

### 3. Tests en `executor.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Executor } from './executor.js';
import type { AidfConfig } from '../types/index.js';

// Mock dependencies
vi.mock('./context-loader.js');
vi.mock('./providers/index.js');
vi.mock('simple-git');

describe('Executor', () => {
  const mockConfig: AidfConfig = {
    version: 1,
    provider: { type: 'claude-cli' },
    execution: {
      max_iterations: 5,
      max_consecutive_failures: 2,
      timeout_per_iteration: 60,
    },
    permissions: {
      scope_enforcement: 'strict',
      auto_commit: false,
      auto_push: false,
      auto_pr: false,
    },
    validation: {
      pre_commit: [],
      pre_push: [],
      pre_pr: [],
    },
    git: {
      commit_prefix: 'test:',
      branch_prefix: 'test/',
    },
  };

  describe('run', () => {
    it('should complete when task_complete is signaled', async () => {
      // Test with mocks
    });

    it('should stop after max iterations', async () => {
      // Test max iterations
    });

    it('should stop after consecutive failures', async () => {
      // Test consecutive failures
    });
  });

  describe('scope enforcement', () => {
    it('should block forbidden file changes', async () => {
      // Test scope blocking
    });

    it('should ask user for files outside scope in ask mode', async () => {
      // Test ask mode
    });
  });

  describe('state management', () => {
    it('should track iteration count', async () => {
      // Test state
    });

    it('should record modified files', async () => {
      // Test files tracking
    });
  });
});
```

## Definition of Done
- [ ] `Executor` class implementada con loop principal
- [ ] Carga contexto (AGENTS.md, rol, task) correctamente
- [ ] Ejecuta provider y procesa resultados
- [ ] Scope enforcement integrado con ScopeGuard
- [ ] Validación pre-commit ejecuta antes de cada commit
- [ ] Auto-commit funciona con mensaje configurado
- [ ] Detecta y maneja estado BLOCKED
- [ ] Actualiza task file con status cuando se bloquea
- [ ] Respeta max_iterations y max_consecutive_failures
- [ ] `executeTask` factory function funciona
- [ ] Carga config de .ai/config.yml
- [ ] Tests unitarios con mocks pasan
- [ ] TypeScript compila sin errores

## Notes
- Este es el componente más crítico del MVP
- El loop debe ser robusto contra errores del provider
- El estado BLOCKED se documenta en el task file para el developer
- onIteration callback permite UI updates (spinner, progress)
- onAskUser callback permite interacción CLI para scope violations
- dry-run mode es útil para testing sin ejecutar realmente
