import type { ExecutorPhase, PhaseContext, PreFlightResult } from './types.js';
import type { LoadedContext, BlockedStatus } from '../../types/index.js';
import { loadContext, estimateContextSize } from '../context-loader.js';
import { resolveConfig, detectPlaintextSecrets } from '../../utils/config.js';

export class PreFlightPhase implements ExecutorPhase<void, PreFlightResult> {
  name = 'PreFlight';

  async execute(ctx: PhaseContext): Promise<PreFlightResult> {
    // 1. Resolve config
    ctx.config = this.resolveAndValidateConfig(ctx);

    // 2. Detect plaintext secrets
    this.detectSecrets(ctx);

    // 3. Load context
    const context = await this.loadAndLogContext(ctx);

    // 4. Restore resume state
    const blockedStatus = this.restoreResumeState(ctx, context);

    // 5. Log context info
    this.logContextInfo(ctx, context);

    // 6. Estimate and log context size
    this.logContextSize(ctx, context);

    // 7. Check security warnings
    const skipPermissions = this.checkSecurityWarnings(ctx);

    // 8. Create scope guard
    const scopeGuard = ctx.deps.createScopeGuard(
      context.task.scope,
      ctx.options.scopeEnforcement
    );

    // 9. Create validator
    const validator = ctx.deps.createValidator(ctx.config.validation, ctx.cwd);

    // 10. Record resume attempt if resuming
    if (ctx.options.resume && blockedStatus) {
      try {
        await this.recordResumeAttempt(ctx, blockedStatus);
      } catch {
        // Ignore errors when updating task file (e.g., in tests)
      }
    }

    return {
      context,
      scopeGuard,
      validator,
      provider: ctx.deps.createProvider(
        ctx.config.provider?.type ?? 'claude-cli',
        ctx.cwd
      ),
      blockedStatus,
      skipPermissions,
    };
  }

  private resolveAndValidateConfig(ctx: PhaseContext): typeof ctx.config {
    try {
      return resolveConfig(ctx.config);
    } catch (error) {
      throw new PreFlightError(
        error instanceof Error ? error.message : 'Config resolution failed'
      );
    }
  }

  private detectSecrets(ctx: PhaseContext): void {
    try {
      const secretWarnings = detectPlaintextSecrets(
        ctx.config as unknown as Record<string, unknown>
      );
      for (const warning of secretWarnings) {
        ctx.deps.logger.warn(warning);
      }
    } catch {
      // Secret detection is best-effort, don't fail execution
    }
  }

  private async loadAndLogContext(ctx: PhaseContext): Promise<LoadedContext> {
    return loadContext(ctx.taskPath, ctx.config.skills);
  }

  private restoreResumeState(
    ctx: PhaseContext,
    context: LoadedContext
  ): BlockedStatus | null {
    if (!ctx.options.resume) {
      return null;
    }

    if (!context.task.blockedStatus) {
      throw new Error(
        'Task is not blocked. Cannot resume a task that is not in BLOCKED status.'
      );
    }

    const blockedStatus = context.task.blockedStatus;
    ctx.state.iteration = blockedStatus.previousIteration;
    ctx.state.filesModified = [...blockedStatus.filesModified];

    ctx.deps.logger.setContext({
      task: ctx.taskPath,
      iteration: blockedStatus.previousIteration,
      files: blockedStatus.filesModified,
    });

    ctx.deps.logger.info(
      `Resuming blocked task from iteration ${blockedStatus.previousIteration}`
    );
    ctx.deps.logger.info(
      `Previous blocking issue: ${blockedStatus.blockingIssue.slice(0, 100)}...`
    );

    return blockedStatus;
  }

  private logContextInfo(ctx: PhaseContext, context: LoadedContext): void {
    ctx.deps.logger.setContext({ task: ctx.taskPath, iteration: 0 });
    ctx.deps.logger.info(`Loaded context for task: ${context.task.goal}`);
    ctx.deps.logger.info(`Role: ${context.role.name}`);
    ctx.deps.logger.info(`Scope: ${context.task.scope.allowed.join(', ')}`);
  }

  private logContextSize(ctx: PhaseContext, context: LoadedContext): void {
    try {
      const contextSize = estimateContextSize(context);
      ctx.state.contextTokens = contextSize.total;
      ctx.state.contextBreakdown = contextSize.breakdown;

      const b = contextSize.breakdown;
      const pct = (v: number) =>
        contextSize.total > 0
          ? Math.round((v / contextSize.total) * 100)
          : 0;

      ctx.deps.logger.info(
        `Context loaded: ~${contextSize.total.toLocaleString()} tokens`
      );
      ctx.deps.logger.info(
        `  AGENTS.md:  ${b.agents.toLocaleString()} tokens (${pct(b.agents)}%)`
      );
      ctx.deps.logger.info(
        `  Role:       ${b.role.toLocaleString()} tokens (${pct(b.role)}%)`
      );
      if (b.skills > 0) {
        ctx.deps.logger.info(
          `  Skills:     ${b.skills.toLocaleString()} tokens (${pct(b.skills)}%)`
        );
      }
      ctx.deps.logger.info(
        `  Task:       ${b.task.toLocaleString()} tokens (${pct(b.task)}%)`
      );
      if (b.plan > 0) {
        ctx.deps.logger.info(
          `  Plan:       ${b.plan.toLocaleString()} tokens (${pct(b.plan)}%)`
        );
      }
    } catch {
      // Context size estimation is informational — don't fail execution
    }
  }

  private checkSecurityWarnings(ctx: PhaseContext): boolean {
    const skipPermissions = ctx.config.security?.skip_permissions ?? true;
    const warnOnSkip = ctx.config.security?.warn_on_skip ?? true;

    if (skipPermissions && warnOnSkip) {
      ctx.deps.logger.warn(
        'Running with --dangerously-skip-permissions. The AI agent has unrestricted access to your filesystem and commands. Set security.skip_permissions: false in config.yml to require permission prompts.'
      );
    }

    return skipPermissions;
  }

  private async recordResumeAttempt(
    ctx: PhaseContext,
    blockedStatus: BlockedStatus
  ): Promise<void> {
    const fs = ctx.deps.fs ?? (await import('fs/promises'));
    const existingContent = await fs.readFile(ctx.taskPath, 'utf-8');

    const resumeAttempt = `- **Resumed at:** ${new Date().toISOString()}
- **Previous attempt:** Iteration ${blockedStatus.previousIteration}, blocked at ${blockedStatus.blockedAt}`;

    if (existingContent.includes('### Resume Attempt History')) {
      const updatedContent = existingContent.replace(
        /(### Resume Attempt History\n)/,
        `$1${resumeAttempt}\n\n`
      );
      await fs.writeFile(ctx.taskPath, updatedContent);
    } else {
      const historySection = `\n### Resume Attempt History\n${resumeAttempt}\n`;
      const updatedContent = existingContent.replace(
        /(---\n@developer:)/,
        `${historySection}$1`
      );
      await fs.writeFile(ctx.taskPath, updatedContent);
    }

    ctx.deps.logger.info(`Recorded resume attempt in task file`);
  }
}

export class PreFlightError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PreFlightError';
  }
}
