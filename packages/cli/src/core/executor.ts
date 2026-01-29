// packages/cli/src/core/executor.ts

import { simpleGit, SimpleGit } from 'simple-git';
import type {
  ExecutorOptions,
  ExecutorState,
  ExecutorResult,
  AidfConfig,
  LoadedContext,
  BlockedStatus,
} from '../types/index.js';
import { loadContext } from './context-loader.js';
import { createProvider, type Provider } from './providers/index.js';
import { buildIterationPrompt } from './providers/claude-cli.js';
import { ScopeGuard } from './safety.js';
import { Validator } from './validator.js';
import { Logger } from '../utils/logger.js';
import { NotificationService } from '../utils/notifications.js';

export class Executor {
  private options: ExecutorOptions;
  private config: AidfConfig;
  private cwd: string;
  private provider: Provider;
  private git: SimpleGit;
  private state: ExecutorState;
  private logger: Logger;
  private notificationService: NotificationService;

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

    // Initialize logger (use provided logger or create default)
    this.logger = options.logger ?? new Logger({ verbose: this.options.verbose });

    // Initialize notification service
    this.notificationService = new NotificationService(config.notifications, this.logger);
  }

  /**
   * Ejecuta una task
   */
  async run(taskPath: string): Promise<ExecutorResult> {
    this.state.status = 'running';
    this.state.startedAt = new Date();
    this.state.iteration = 0;

    // Set initial context
    this.logger.setContext({ task: taskPath, iteration: 0 });

    let consecutiveFailures = 0;
    let context: LoadedContext;
    let blockedStatus = null;

    try {
      // Cargar contexto
      context = await loadContext(taskPath, this.config.skills);
      
      // Si estamos resumiendo, cargar estado bloqueado
      if (this.options.resume) {
        if (!context.task.blockedStatus) {
          throw new Error('Task is not blocked. Cannot resume a task that is not in BLOCKED status.');
        }
        blockedStatus = context.task.blockedStatus;
        this.state.iteration = blockedStatus.previousIteration;
        this.state.filesModified = [...blockedStatus.filesModified];
        this.logger.setContext({
          task: taskPath,
          iteration: blockedStatus.previousIteration,
          files: blockedStatus.filesModified,
        });
        this.log(`Resuming blocked task from iteration ${blockedStatus.previousIteration}`);
        this.log(`Previous blocking issue: ${blockedStatus.blockingIssue.slice(0, 100)}...`);
        
        // Registrar intento de resume
        try {
          await this.recordResumeAttempt(taskPath, blockedStatus);
        } catch {
          // Ignore errors when updating task file (e.g., in tests)
        }
      }

      this.logger.setContext({ task: taskPath, iteration: 0 });
      this.log(`Loaded context for task: ${context.task.goal}`);
      this.log(`Role: ${context.role.name}`);
      this.log(`Scope: ${context.task.scope.allowed.join(', ')}`);

      // Security warning for skip_permissions
      const skipPermissions = this.config.security?.skip_permissions ?? true;
      const warnOnSkip = this.config.security?.warn_on_skip ?? true;
      if (skipPermissions && warnOnSkip) {
        this.logger.warn(
          'Running with --dangerously-skip-permissions. The AI agent has unrestricted access to your filesystem and commands. Set security.skip_permissions: false in config.yml to require permission prompts.'
        );
      }

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
        this.logger.setContext({
          task: taskPath,
          iteration: this.state.iteration,
          files: this.state.filesModified,
        });
        this.log(`\n=== Iteration ${this.state.iteration} ===`);

        // Construir prompt con contexto de bloqueo si existe
        const prompt = buildIterationPrompt({
          agents: context.agents.raw,
          role: context.role.raw,
          task: context.task.raw,
          plan: context.plan,
          skills: context.skills,
          iteration: this.state.iteration,
          blockingContext: blockedStatus ? {
            previousIteration: blockedStatus.previousIteration,
            blockingIssue: blockedStatus.blockingIssue,
            filesModified: blockedStatus.filesModified,
          } : undefined,
        });

        // Ejecutar provider
        if (this.options.dryRun) {
          this.log('[DRY RUN] Would execute prompt...');
          break;
        }

        this.emitPhase('Executing AI');

        // For claude-cli, conditionally skip permissions based on security config
        // For API providers, this flag is ignored anyway
        const result = await this.provider.execute(prompt, {
          timeout: this.options.timeoutPerIteration * 1000,
          dangerouslySkipPermissions: skipPermissions,
          onOutput: this.options.onOutput,
        });

        // Accumulate token usage from this iteration
        if (result.tokenUsage) {
          if (!this.state.tokenUsage) {
            this.state.tokenUsage = { inputTokens: 0, outputTokens: 0 };
          }
          this.state.tokenUsage.inputTokens += result.tokenUsage.inputTokens;
          this.state.tokenUsage.outputTokens += result.tokenUsage.outputTokens;
        }

        this.emitPhase('Checking scope');

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

        this.emitPhase('Validating');

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
          this.emitPhase('Committing');
          await this.commitChanges(result.filesChanged, context.task.goal);
          this.state.filesModified.push(...result.filesChanged);
        }

        // Reset consecutive failures on success
        consecutiveFailures = 0;

        // Notificar callback (pass a copy to prevent mutation issues)
        this.options.onIteration?.({ ...this.state });

        // Verificar completado
        if (result.iterationComplete) {
          this.logger.setContext({
            task: taskPath,
            iteration: this.state.iteration,
            files: this.state.filesModified,
            status: 'completed',
          });
          this.log(`Task complete: ${result.completionSignal}`);
          this.state.status = 'completed';
          
          // Limpiar estado BLOCKED si estaba resumiendo
          if (this.options.resume && blockedStatus) {
            try {
              await this.clearBlockedStatus(taskPath, blockedStatus);
            } catch {
              // Ignore errors when updating task file (e.g., in tests)
            }
          }
          
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

        try {
          await this.updateTaskWithBlockedStatus(taskPath, this.state.lastError);
        } catch {
          // Ignore errors when updating task file
        }

        // Si estaba resumiendo, actualizar historial
        if (this.options.resume && blockedStatus) {
          try {
            await this.updateResumeAttemptHistory(taskPath, blockedStatus, 'blocked_again');
          } catch {
            // Ignore errors when updating task file
          }
        }
      }

      // Verificar si terminamos por failures consecutivos
      if (
        this.state.status === 'running' &&
        consecutiveFailures >= this.options.maxConsecutiveFailures
      ) {
        this.state.status = 'blocked';
        this.state.lastError = `Max consecutive failures (${this.options.maxConsecutiveFailures}) reached`;

        try {
          await this.updateTaskWithBlockedStatus(taskPath, this.state.lastError);
        } catch {
          // Ignore errors when updating task file
        }

        // Si estaba resumiendo, actualizar historial
        if (this.options.resume && blockedStatus) {
          try {
            await this.updateResumeAttemptHistory(taskPath, blockedStatus, 'blocked_again');
          } catch {
            // Ignore errors when updating task file
          }
        }
      }

    } catch (error) {
      this.state.status = 'failed';
      this.state.lastError = error instanceof Error ? error.message : 'Unknown error';
    }

    this.state.completedAt = new Date();

    // Write final status to task file for terminal states (completed/failed)
    if (this.state.status === 'completed' || this.state.status === 'failed') {
      try {
        await this.updateTaskStatus(taskPath, this.state.status);
      } catch {
        // Ignore errors when updating task file (e.g., in tests)
      }
    }

    // Push si autoPush está habilitado
    if (this.options.autoPush && this.state.status === 'completed') {
      await this.git.push();
      this.log('Pushed changes to remote');
    }

    const executorResult: ExecutorResult = {
      success: this.state.status === 'completed',
      status: this.state.status,
      iterations: this.state.iteration,
      filesModified: this.state.filesModified,
      error: this.state.lastError,
      blockedReason: this.state.status === 'blocked' ? this.state.lastError : undefined,
      taskPath,
      tokenUsage: this.state.tokenUsage,
    };

    try {
      await this.notificationService.notifyResult(executorResult);
    } catch {
      // Notification errors should never affect execution
    }

    return executorResult;
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

  private emitPhase(phase: string): void {
    this.options.onPhase?.({
      phase,
      iteration: this.state.iteration,
      totalIterations: this.options.maxIterations,
      filesModified: this.state.filesModified.length,
    });
  }

  private log(message: string): void {
    if (this.options.verbose) {
      this.logger.debug(`[aidf] ${message}`);
    } else {
      this.logger.info(message);
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

  /**
   * Registra un intento de resume en el task file
   */
  private async recordResumeAttempt(
    taskPath: string,
    blockedStatus: BlockedStatus
  ): Promise<void> {
    const fs = await import('fs/promises');
    const existingContent = await fs.readFile(taskPath, 'utf-8');

    const resumeAttempt = `- **Resumed at:** ${new Date().toISOString()}
- **Previous attempt:** Iteration ${blockedStatus.previousIteration}, blocked at ${blockedStatus.blockedAt}`;

    // Buscar sección de Resume Attempt History o crearla
    if (existingContent.includes('### Resume Attempt History')) {
      // Agregar al historial existente
      const updatedContent = existingContent.replace(
        /(### Resume Attempt History\n)/,
        `$1${resumeAttempt}\n\n`
      );
      await fs.writeFile(taskPath, updatedContent);
    } else {
      // Crear nueva sección antes del cierre de Status
      const historySection = `\n### Resume Attempt History\n${resumeAttempt}\n`;
      const updatedContent = existingContent.replace(
        /(---\n@developer:)/,
        `${historySection}$1`
      );
      await fs.writeFile(taskPath, updatedContent);
    }

    this.log(`Recorded resume attempt in task file`);
  }

  /**
   * Actualiza el historial de intentos de resume
   */
  private async updateResumeAttemptHistory(
    taskPath: string,
    blockedStatus: BlockedStatus,
    status: 'completed' | 'blocked_again'
  ): Promise<void> {
    const fs = await import('fs/promises');
    const existingContent = await fs.readFile(taskPath, 'utf-8');

    if (!existingContent.includes('### Resume Attempt History')) {
      return; // No hay historial para actualizar
    }

    // Actualizar el último intento con el estado final
    const completedAt = new Date().toISOString();
    const iterations = this.state.iteration - blockedStatus.previousIteration;
    
    const updatePattern = new RegExp(
      `(### Resume Attempt History\\n[\\s\\S]*?Resumed at:.*?\\n.*?Previous attempt:.*?\\n)`,
      'i'
    );
    
    const replacement = `$1- **Completed at:** ${completedAt}
- **Status:** ${status}
- **Iterations in this attempt:** ${iterations}
`;

    const updatedContent = existingContent.replace(updatePattern, replacement);
    await fs.writeFile(taskPath, updatedContent);
    
    this.log(`Updated resume attempt history with status: ${status}`);
  }

  /**
   * Writes the final task status (COMPLETED/FAILED) to the task markdown file
   */
  private async updateTaskStatus(
    taskPath: string,
    status: 'completed' | 'failed'
  ): Promise<void> {
    const fs = await import('fs/promises');
    const existingContent = await fs.readFile(taskPath, 'utf-8');

    let statusSection: string;

    const tokenLine = this.state.tokenUsage
      ? `\n- **Tokens used:** ${(this.state.tokenUsage.inputTokens + this.state.tokenUsage.outputTokens).toLocaleString()} (input: ${this.state.tokenUsage.inputTokens.toLocaleString()} / output: ${this.state.tokenUsage.outputTokens.toLocaleString()})`
      : '';

    if (status === 'completed') {
      statusSection = `## Status: ✅ COMPLETED

### Execution Log
- **Started:** ${this.state.startedAt?.toISOString()}
- **Completed:** ${this.state.completedAt?.toISOString()}
- **Iterations:** ${this.state.iteration}
- **Files modified:** ${this.state.filesModified.length}${tokenLine}

### Files Modified
${this.state.filesModified.map(f => `- \`${f}\``).join('\n') || '_None_'}`;
    } else {
      statusSection = `## Status: ❌ FAILED

### Execution Log
- **Started:** ${this.state.startedAt?.toISOString()}
- **Failed at:** ${this.state.completedAt?.toISOString()}
- **Iterations:** ${this.state.iteration}${tokenLine}

### Error
\`\`\`
${this.state.lastError || 'Unknown error'}
\`\`\`

### Files Modified
${this.state.filesModified.map(f => `- \`${f}\``).join('\n') || '_None_'}`;
    }

    // Replace existing Status section or insert after Goal
    const updatedContent = existingContent.includes('## Status:')
      ? existingContent.replace(/## Status:[\s\S]*?(?=\n## (?!#)|$)/, statusSection)
      : existingContent.replace(
          /(## Goal\n[^\n]+\n)/,
          `$1\n${statusSection}\n`
        );

    await fs.writeFile(taskPath, updatedContent);
    this.log(`Updated task file with ${status.toUpperCase()} status`);
  }

  /**
   * Limpia el estado BLOCKED del task file cuando la tarea se completa
   */
  private async clearBlockedStatus(
    taskPath: string,
    blockedStatus: BlockedStatus
  ): Promise<void> {
    const fs = await import('fs/promises');
    const existingContent = await fs.readFile(taskPath, 'utf-8');

    // Crear sección de historial de ejecución preservando información importante
    const executionHistory = `

## Execution History

### Original Block
- **Started:** ${blockedStatus.startedAt}
- **Blocked at:** ${blockedStatus.blockedAt}
- **Iterations before block:** ${blockedStatus.previousIteration}
- **Blocking issue:** ${blockedStatus.blockingIssue.slice(0, 200)}${blockedStatus.blockingIssue.length > 200 ? '...' : ''}

### Resume and Completion
- **Resumed at:** ${blockedStatus.attemptHistory?.[0]?.resumedAt || 'N/A'}
- **Completed at:** ${new Date().toISOString()}
- **Total iterations:** ${this.state.iteration}
- **Files modified:** ${this.state.filesModified.length} files

---

## Status: ✅ COMPLETED
`;

    // Reemplazar sección BLOCKED con historial y status COMPLETED
    const updatedContent = existingContent.replace(
      /## Status:[\s\S]*?(?=\n## |$)/,
      executionHistory.trim()
    );

    await fs.writeFile(taskPath, updatedContent);
    this.log(`Cleared BLOCKED status and marked task as COMPLETED`);
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
    notifications: {
      level: 'all',
      desktop: { enabled: false },
      slack: { enabled: false, webhook_url: '' },
      discord: { enabled: false, webhook_url: '' },
      webhook: { enabled: false, url: '' },
      email: {
        enabled: false,
        smtp_host: '',
        smtp_port: 587,
        smtp_user: '',
        smtp_pass: '',
        from: '',
        to: '',
      },
    },
  };
}
