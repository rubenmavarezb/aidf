// packages/cli/src/core/executor.ts

import { simpleGit, SimpleGit } from 'simple-git';
import type {
  ExecutorOptions,
  ExecutorState,
  ExecutorResult,
  AidfConfig,
  LoadedContext,
  BlockedStatus,
  TokenUsageSummary,
} from '../types/index.js';
import { loadContext, estimateContextSize } from './context-loader.js';
import { createProvider, type Provider } from './providers/index.js';
import { buildIterationPrompt, buildContinuationPrompt } from './providers/claude-cli.js';
import { ScopeGuard } from './safety.js';
import { Validator } from './validator.js';
import { Logger } from '../utils/logger.js';
import { NotificationService } from '../utils/notifications.js';
import { resolveConfig, detectPlaintextSecrets } from '../utils/config.js';
import { moveTaskFile } from '../utils/files.js';

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

    // Resolve env var references in config before using it
    try {
      this.config = resolveConfig(this.config);
    } catch (error) {
      this.logger.error(
        `Failed to resolve config: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      this.state.status = 'failed';
      this.state.lastError = error instanceof Error ? error.message : 'Config resolution failed';
      this.state.completedAt = new Date();
      return {
        success: false,
        status: 'failed',
        iterations: 0,
        filesModified: [],
        error: this.state.lastError,
        taskPath,
      };
    }

    // Warn about possible plaintext secrets in config
    try {
      const secretWarnings = detectPlaintextSecrets(this.config as unknown as Record<string, unknown>);
      for (const warning of secretWarnings) {
        this.logger.warn(warning);
      }
    } catch {
      // Secret detection is best-effort, don't fail execution
    }

    let consecutiveFailures = 0;
    let context: LoadedContext;
    let blockedStatus = null;
    let lastValidationError: string | undefined;
    let previousOutput: string | undefined;
    let conversationState: unknown;

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

      // Estimate and log context size
      try {
        const contextSize = estimateContextSize(context);
        this.state.contextTokens = contextSize.total;
        this.state.contextBreakdown = contextSize.breakdown;

        const b = contextSize.breakdown;
        const pct = (v: number) => contextSize.total > 0 ? Math.round((v / contextSize.total) * 100) : 0;
        this.logger.info(`Context loaded: ~${contextSize.total.toLocaleString()} tokens`);
        this.logger.info(`  AGENTS.md:  ${b.agents.toLocaleString()} tokens (${pct(b.agents)}%)`);
        this.logger.info(`  Role:       ${b.role.toLocaleString()} tokens (${pct(b.role)}%)`);
        if (b.skills > 0) {
          this.logger.info(`  Skills:     ${b.skills.toLocaleString()} tokens (${pct(b.skills)}%)`);
        }
        this.logger.info(`  Task:       ${b.task.toLocaleString()} tokens (${pct(b.task)}%)`);
        if (b.plan > 0) {
          this.logger.info(`  Plan:       ${b.plan.toLocaleString()} tokens (${pct(b.plan)}%)`);
        }
      } catch {
        // Context size estimation is informational — don't fail execution
      }

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

        // Emit iteration start so live status can show feedback
        this.emitPhase('Starting iteration');

        // Determine if we should use session continuation
        const useContinuation = this.state.iteration > 1
          && (this.config.execution?.session_continuation !== false)
          && conversationState !== undefined;

        // Construir prompt con contexto de bloqueo si existe
        const prompt = useContinuation
          ? buildContinuationPrompt({
              previousOutput,
              previousValidationError: lastValidationError,
              iteration: this.state.iteration,
            })
          : buildIterationPrompt({
              agents: context.agents.raw,
              role: context.role.raw,
              task: context.task.raw,
              plan: context.plan,
              skills: context.skills,
              iteration: this.state.iteration,
              previousValidationError: lastValidationError,
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

        if (useContinuation && this.state.contextTokens) {
          this.logger.info(`Session continuation: ~${this.state.contextTokens.toLocaleString()} static tokens saved`);
        }

        // For claude-cli, conditionally skip permissions based on security config
        // For API providers, this flag is ignored anyway
        let result = await this.provider.execute(prompt, {
          timeout: this.options.timeoutPerIteration * 1000,
          dangerouslySkipPermissions: skipPermissions,
          onOutput: this.options.onOutput,
          sessionContinuation: useContinuation,
          conversationState: useContinuation ? conversationState : undefined,
        });

        // Fallback: if continuation failed, retry with full prompt
        if (useContinuation && !result.success && !result.iterationComplete) {
          this.log('Session continuation failed, retrying with full prompt');
          conversationState = undefined;
          const fullPrompt = buildIterationPrompt({
            agents: context.agents.raw,
            role: context.role.raw,
            task: context.task.raw,
            plan: context.plan,
            skills: context.skills,
            iteration: this.state.iteration,
            previousValidationError: lastValidationError,
            blockingContext: blockedStatus ? {
              previousIteration: blockedStatus.previousIteration,
              blockingIssue: blockedStatus.blockingIssue,
              filesModified: blockedStatus.filesModified,
            } : undefined,
          });
          result = await this.provider.execute(fullPrompt, {
            timeout: this.options.timeoutPerIteration * 1000,
            dangerouslySkipPermissions: skipPermissions,
            onOutput: this.options.onOutput,
          });
        }

        // Track state for next iteration
        previousOutput = result.output;
        conversationState = result.conversationState ?? (useContinuation ? conversationState : true);

        // Accumulate token usage from this iteration
        if (result.tokenUsage) {
          if (!this.state.tokenUsage) {
            this.state.tokenUsage = { inputTokens: 0, outputTokens: 0 };
          }
          this.state.tokenUsage.inputTokens += result.tokenUsage.inputTokens;
          this.state.tokenUsage.outputTokens += result.tokenUsage.outputTokens;

          this.logger.info(
            `Iteration ${this.state.iteration} tokens: input=${result.tokenUsage.inputTokens.toLocaleString()}, output=${result.tokenUsage.outputTokens.toLocaleString()}`
          );
        }

        // Capture completion signal BEFORE scope/validation checks so it's
        // never lost by a `continue` in those blocks.
        const hasCompletionSignal = result.iterationComplete;

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

            if (hasCompletionSignal) {
              // AI signaled completion but also touched files outside scope.
              // The out-of-scope files have been reverted. If only forbidden
              // files were changed, accept the completion (the task itself is
              // done, the AI just touched extra files). If allowed files were
              // also changed and committed, break as complete.
              this.log(`AI signaled completion but had scope violations. Violations reverted — accepting completion.`);
              this.state.status = 'completed';
              break;
            }

            consecutiveFailures++;
            this.emitPhase('Scope violation');
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
          const validationReport = Validator.formatReport(validation);
          this.log(`Validation failed: ${validationReport}`);

          if (hasCompletionSignal) {
            // AI signaled completion but validation failed — save error for next prompt
            this.log(`AI signaled completion but validation failed. Retrying with feedback.`);
            lastValidationError = validationReport;
          }

          consecutiveFailures++;
          this.emitPhase('Validation failed');
          continue;
        }

        // Validation passed — clear any previous validation error
        lastValidationError = undefined;

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
        if (hasCompletionSignal) {
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

      // Move task file to appropriate status folder
      if (this.state.status === 'completed') {
        try {
          const newPath = moveTaskFile(taskPath, 'completed');
          if (newPath !== taskPath) {
            this.log(`Moved task file to completed/`);
            // Stage the moved task file so it doesn't appear as a modified file
            // when the next task starts (prevents "Task modified: <previous-task>")
            await this.stageTaskFileChanges(taskPath, newPath);
          } else {
            await this.stageTaskFileChanges(taskPath);
          }
        } catch {
          // Task file movement is best-effort
        }
      } else {
        // Failed status: stage the task file update
        try {
          await this.stageTaskFileChanges(taskPath);
        } catch {
          // Staging is best-effort
        }
      }
    }

    // Move blocked tasks to blocked/ folder
    if (this.state.status === 'blocked') {
      try {
        const newPath = moveTaskFile(taskPath, 'blocked');
        if (newPath !== taskPath) {
          this.log(`Moved task file to blocked/`);
          await this.stageTaskFileChanges(taskPath, newPath);
        } else {
          await this.stageTaskFileChanges(taskPath);
        }
      } catch {
        // Task file movement is best-effort
      }
    }

    // Push si autoPush está habilitado
    if (this.options.autoPush && this.state.status === 'completed') {
      await this.git.push();
      this.log('Pushed changes to remote');
    }

    // Build token usage summary
    const tokenUsageSummary = this.buildTokenUsageSummary();

    const executorResult: ExecutorResult = {
      success: this.state.status === 'completed',
      status: this.state.status,
      iterations: this.state.iteration,
      filesModified: this.state.filesModified,
      error: this.state.lastError,
      blockedReason: this.state.status === 'blocked' ? this.state.lastError : undefined,
      taskPath,
      tokenUsage: tokenUsageSummary,
    };

    // Log final summary
    try {
      this.logExecutionSummary(executorResult);
    } catch {
      // Summary logging is informational — don't fail execution
    }

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

  /**
   * Builds a TokenUsageSummary from accumulated state
   */
  private buildTokenUsageSummary(): TokenUsageSummary | undefined {
    const contextTokens = this.state.contextTokens ?? 0;
    const inputTokens = this.state.tokenUsage?.inputTokens ?? 0;
    const outputTokens = this.state.tokenUsage?.outputTokens ?? 0;

    if (contextTokens === 0 && inputTokens === 0 && outputTokens === 0) {
      return undefined;
    }

    const totalTokens = inputTokens + outputTokens;

    // Estimate cost: Claude Sonnet pricing ~$3/MTok input, ~$15/MTok output
    const estimatedCost = inputTokens > 0 || outputTokens > 0
      ? (inputTokens / 1_000_000) * 3 + (outputTokens / 1_000_000) * 15
      : undefined;

    return {
      contextTokens,
      totalInputTokens: inputTokens,
      totalOutputTokens: outputTokens,
      totalTokens,
      estimatedCost,
      breakdown: this.state.contextBreakdown,
      inputTokens,
      outputTokens,
    };
  }

  /**
   * Logs a final execution summary box
   */
  private logExecutionSummary(result: ExecutorResult): void {
    const taskName = result.taskPath.split('/').pop() ?? result.taskPath;
    const lines: string[] = [];

    lines.push(`Task: ${taskName}`);
    lines.push(`Iterations: ${result.iterations}`);
    lines.push(`Files: ${result.filesModified.length}`);

    if (result.tokenUsage) {
      const tu = result.tokenUsage;
      lines.push(`Context: ~${tu.contextTokens.toLocaleString()} tokens`);

      if (tu.totalInputTokens > 0 || tu.totalOutputTokens > 0) {
        lines.push(`Total tokens: ~${tu.totalTokens.toLocaleString()}`);
        lines.push(`  Input:  ~${tu.totalInputTokens.toLocaleString()}`);
        lines.push(`  Output: ~${tu.totalOutputTokens.toLocaleString()}`);
      }

      if (tu.estimatedCost !== undefined) {
        lines.push(`Est. cost: ~$${tu.estimatedCost.toFixed(2)}`);
      }
    }

    const title = result.success ? 'Task Completed' : (result.status === 'blocked' ? 'Task Blocked' : 'Task Failed');
    this.logger.box(title, lines.join('\n'));
  }

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

  /**
   * Stages task file changes so they don't appear as modified when the next
   * task starts. This prevents the watcher from logging
   * "Task modified: <previous-task>" while a new task is executing.
   */
  private async stageTaskFileChanges(oldPath: string, newPath?: string): Promise<void> {
    try {
      if (newPath && newPath !== oldPath) {
        // File was moved: stage both the removal and the new file
        await this.git.add([newPath]);
        await this.git.raw(['rm', '--cached', '--ignore-unmatch', oldPath]);
      } else {
        await this.git.add([oldPath]);
      }
    } catch {
      // Staging is best-effort — don't fail execution
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
