// packages/cli/src/core/executor.ts

import { simpleGit, SimpleGit } from 'simple-git';
import type {
  ExecutorOptions,
  ExecutorState,
  ExecutorResult,
  AidfConfig,
  LoadedContext,
} from '../types/index.js';
import { loadContext } from './context-loader.js';
import { createProvider, type Provider } from './providers/index.js';
import { buildIterationPrompt } from './providers/claude-cli.js';
import { ScopeGuard } from './safety.js';
import { Validator } from './validator.js';

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

    // Merge options con defaults (filter out undefined values from options)
    const filteredOptions = Object.fromEntries(
      Object.entries(options).filter(([_, v]) => v !== undefined)
    );
    this.options = {
      maxIterations: config.execution?.max_iterations ?? 50,
      maxConsecutiveFailures: config.execution?.max_consecutive_failures ?? 3,
      timeoutPerIteration: config.execution?.timeout_per_iteration ?? 300,
      scopeEnforcement: config.permissions?.scope_enforcement ?? 'ask',
      autoCommit: config.permissions?.auto_commit ?? true,
      autoPush: config.permissions?.auto_push ?? false,
      dryRun: false,
      verbose: false,
      ...filteredOptions,
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

        // For claude-cli, always skip its built-in permissions since we have our own ScopeGuard
        // For API providers, this flag is ignored anyway
        const result = await this.provider.execute(prompt, {
          timeout: this.options.timeoutPerIteration * 1000,
          dangerouslySkipPermissions: true,
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

        // Notificar callback (pass a copy to prevent mutation issues)
        this.options.onIteration?.({ ...this.state });

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
            try {
              await this.updateTaskWithBlockedStatus(taskPath, result.error);
            } catch {
              // Ignore errors when updating task file (e.g., in tests)
            }
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

## Status: BLOCKED

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
