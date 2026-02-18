import type {
  ExecutorPhase,
  PhaseContext,
  PostFlightInput,
} from './types.js';
import type {
  ExecutorResult,
  BlockedStatus,
  TokenUsageSummary,
} from '../../types/index.js';

export class PostFlightPhase
  implements ExecutorPhase<PostFlightInput, ExecutorResult>
{
  name = 'PostFlight';

  async execute(
    ctx: PhaseContext,
    input: PostFlightInput
  ): Promise<ExecutorResult> {
    const { executionResult, preFlightResult } = input;
    const blockedStatus = preFlightResult?.blockedStatus ?? null;

    // Handle termination reasons
    if (executionResult.terminationReason === 'max_iterations') {
      ctx.state.status = 'blocked';
      ctx.state.lastError = executionResult.lastError;

      try {
        await this.updateTaskWithBlockedStatus(
          ctx,
          ctx.taskPath,
          executionResult.lastError!
        );
      } catch {
        // Ignore errors when updating task file
      }

      if (ctx.options.resume && blockedStatus) {
        try {
          await this.updateResumeAttemptHistory(
            ctx,
            blockedStatus,
            'blocked_again'
          );
        } catch {
          // Ignore errors when updating task file
        }
      }
    }

    if (executionResult.terminationReason === 'max_failures') {
      ctx.state.status = 'blocked';
      ctx.state.lastError = executionResult.lastError;

      try {
        await this.updateTaskWithBlockedStatus(
          ctx,
          ctx.taskPath,
          executionResult.lastError!
        );
      } catch {
        // Ignore errors when updating task file
      }

      if (ctx.options.resume && blockedStatus) {
        try {
          await this.updateResumeAttemptHistory(
            ctx,
            blockedStatus,
            'blocked_again'
          );
        } catch {
          // Ignore errors when updating task file
        }
      }
    }

    if (executionResult.terminationReason === 'blocked') {
      // Already set by ExecutionPhase, just update the task file
      try {
        await this.updateTaskWithBlockedStatus(
          ctx,
          ctx.taskPath,
          ctx.state.lastError!
        );
      } catch {
        // Ignore errors when updating task file
      }
    }

    // Handle completed state — clear blocked status if resuming
    if (
      executionResult.terminationReason === 'completed' &&
      ctx.options.resume &&
      blockedStatus
    ) {
      try {
        await this.clearBlockedStatus(ctx, ctx.taskPath, blockedStatus);
      } catch {
        // Ignore errors when updating task file
      }
    }

    ctx.state.completedAt = new Date();

    // Write final status to task file for terminal states
    if (ctx.state.status === 'completed' || ctx.state.status === 'failed') {
      try {
        await this.updateTaskStatus(ctx, ctx.taskPath, ctx.state.status);
      } catch {
        // Ignore errors when updating task file
      }

      // Move task file to appropriate status folder
      if (ctx.state.status === 'completed') {
        try {
          const newPath = ctx.deps.moveTaskFile(ctx.taskPath, 'completed');
          if (newPath !== ctx.taskPath) {
            this.log(ctx, `Moved task file to completed/`);
            await this.stageTaskFileChanges(ctx, ctx.taskPath, newPath);
          } else {
            await this.stageTaskFileChanges(ctx, ctx.taskPath);
          }
        } catch {
          // Task file movement is best-effort
        }
      } else {
        // Failed status: stage the task file update
        try {
          await this.stageTaskFileChanges(ctx, ctx.taskPath);
        } catch {
          // Staging is best-effort
        }
      }
    }

    // Move blocked tasks to blocked/ folder
    if (ctx.state.status === 'blocked') {
      try {
        const newPath = ctx.deps.moveTaskFile(ctx.taskPath, 'blocked');
        if (newPath !== ctx.taskPath) {
          this.log(ctx, `Moved task file to blocked/`);
          await this.stageTaskFileChanges(ctx, ctx.taskPath, newPath);
        } else {
          await this.stageTaskFileChanges(ctx, ctx.taskPath);
        }
      } catch {
        // Task file movement is best-effort
      }
    }

    // Push if autoPush is enabled
    if (ctx.options.autoPush && ctx.state.status === 'completed') {
      await ctx.deps.git.push();
      this.log(ctx, 'Pushed changes to remote');
    }

    // Build token usage summary
    const tokenUsageSummary = this.buildTokenUsageSummary(ctx);

    const executorResult: ExecutorResult = {
      success: ctx.state.status === 'completed',
      status: ctx.state.status,
      iterations: ctx.state.iteration,
      filesModified: ctx.state.filesModified,
      error: ctx.state.lastError,
      blockedReason:
        ctx.state.status === 'blocked' ? ctx.state.lastError : undefined,
      taskPath: ctx.taskPath,
      tokenUsage: tokenUsageSummary,
    };

    // Log final summary
    try {
      this.logExecutionSummary(ctx, executorResult);
    } catch {
      // Summary logging is informational
    }

    try {
      await ctx.deps.notificationService.notifyResult(executorResult);
    } catch {
      // Notification errors should never affect execution
    }

    return executorResult;
  }

  private log(ctx: PhaseContext, message: string): void {
    if (ctx.options.verbose) {
      ctx.deps.logger.debug(`[aidf] ${message}`);
    } else {
      ctx.deps.logger.info(message);
    }
  }

  buildTokenUsageSummary(ctx: PhaseContext): TokenUsageSummary | undefined {
    const contextTokens = ctx.state.contextTokens ?? 0;
    const inputTokens = ctx.state.tokenUsage?.inputTokens ?? 0;
    const outputTokens = ctx.state.tokenUsage?.outputTokens ?? 0;

    if (contextTokens === 0 && inputTokens === 0 && outputTokens === 0) {
      return undefined;
    }

    const totalTokens = inputTokens + outputTokens;
    const estimatedCost =
      inputTokens > 0 || outputTokens > 0
        ? (inputTokens / 1_000_000) * 3 + (outputTokens / 1_000_000) * 15
        : undefined;

    return {
      contextTokens,
      totalInputTokens: inputTokens,
      totalOutputTokens: outputTokens,
      totalTokens,
      estimatedCost,
      breakdown: ctx.state.contextBreakdown,
      inputTokens,
      outputTokens,
    };
  }

  logExecutionSummary(ctx: PhaseContext, result: ExecutorResult): void {
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

    const title = result.success
      ? 'Task Completed'
      : result.status === 'blocked'
        ? 'Task Blocked'
        : 'Task Failed';
    ctx.deps.logger.box(title, lines.join('\n'));
  }

  private async stageTaskFileChanges(
    ctx: PhaseContext,
    oldPath: string,
    newPath?: string
  ): Promise<void> {
    try {
      if (newPath && newPath !== oldPath) {
        await ctx.deps.git.add([newPath]);
        await ctx.deps.git.raw([
          'rm',
          '--cached',
          '--ignore-unmatch',
          oldPath,
        ]);
      } else {
        await ctx.deps.git.add([oldPath]);
      }
    } catch {
      // Staging is best-effort
    }
  }

  private async updateTaskWithBlockedStatus(
    ctx: PhaseContext,
    taskPath: string,
    reason: string
  ): Promise<void> {
    const fs = ctx.deps.fs ?? (await import('fs/promises'));
    const existingContent = await fs.readFile(taskPath, 'utf-8');

    const blockedSection = `

## Status: BLOCKED

### Execution Log
- **Started:** ${ctx.state.startedAt?.toISOString()}
- **Iterations:** ${ctx.state.iteration}
- **Blocked at:** ${new Date().toISOString()}

### Blocking Issue
\`\`\`
${reason}
\`\`\`

### Files Modified
${ctx.state.filesModified.map((f) => `- \`${f}\``).join('\n') || '_None_'}

---
@developer: Review and provide guidance, then run \`aidf run --resume ${taskPath}\`
`;

    const updatedContent = existingContent.includes('## Status:')
      ? existingContent.replace(
          /## Status:[\s\S]*?(?=\n## |$)/,
          blockedSection.trim()
        )
      : existingContent.replace(
          /(## Goal\n[^\n]+\n)/,
          `$1${blockedSection}`
        );

    await fs.writeFile(taskPath, updatedContent);
    this.log(ctx, `Updated task file with BLOCKED status`);
  }

  private async updateTaskStatus(
    ctx: PhaseContext,
    taskPath: string,
    status: 'completed' | 'failed'
  ): Promise<void> {
    const fs = ctx.deps.fs ?? (await import('fs/promises'));
    const existingContent = await fs.readFile(taskPath, 'utf-8');

    let statusSection: string;

    const tokenLine = ctx.state.tokenUsage
      ? `\n- **Tokens used:** ${(ctx.state.tokenUsage.inputTokens + ctx.state.tokenUsage.outputTokens).toLocaleString()} (input: ${ctx.state.tokenUsage.inputTokens.toLocaleString()} / output: ${ctx.state.tokenUsage.outputTokens.toLocaleString()})`
      : '';

    if (status === 'completed') {
      statusSection = `## Status: ✅ COMPLETED

### Execution Log
- **Started:** ${ctx.state.startedAt?.toISOString()}
- **Completed:** ${ctx.state.completedAt?.toISOString()}
- **Iterations:** ${ctx.state.iteration}
- **Files modified:** ${ctx.state.filesModified.length}${tokenLine}

### Files Modified
${ctx.state.filesModified.map((f) => `- \`${f}\``).join('\n') || '_None_'}`;
    } else {
      statusSection = `## Status: ❌ FAILED

### Execution Log
- **Started:** ${ctx.state.startedAt?.toISOString()}
- **Failed at:** ${ctx.state.completedAt?.toISOString()}
- **Iterations:** ${ctx.state.iteration}${tokenLine}

### Error
\`\`\`
${ctx.state.lastError || 'Unknown error'}
\`\`\`

### Files Modified
${ctx.state.filesModified.map((f) => `- \`${f}\``).join('\n') || '_None_'}`;
    }

    const updatedContent = existingContent.includes('## Status:')
      ? existingContent.replace(
          /## Status:[\s\S]*?(?=\n## (?!#)|$)/,
          statusSection
        )
      : existingContent.replace(
          /(## Goal\n[^\n]+\n)/,
          `$1\n${statusSection}\n`
        );

    await fs.writeFile(taskPath, updatedContent);
    this.log(ctx, `Updated task file with ${status.toUpperCase()} status`);
  }

  private async clearBlockedStatus(
    ctx: PhaseContext,
    taskPath: string,
    blockedStatus: BlockedStatus
  ): Promise<void> {
    const fs = ctx.deps.fs ?? (await import('fs/promises'));
    const existingContent = await fs.readFile(taskPath, 'utf-8');

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
- **Total iterations:** ${ctx.state.iteration}
- **Files modified:** ${ctx.state.filesModified.length} files

---

## Status: ✅ COMPLETED
`;

    const updatedContent = existingContent.replace(
      /## Status:[\s\S]*?(?=\n## |$)/,
      executionHistory.trim()
    );

    await fs.writeFile(taskPath, updatedContent);
    this.log(ctx, `Cleared BLOCKED status and marked task as COMPLETED`);
  }

  private async updateResumeAttemptHistory(
    ctx: PhaseContext,
    blockedStatus: BlockedStatus,
    status: 'completed' | 'blocked_again'
  ): Promise<void> {
    const fs = ctx.deps.fs ?? (await import('fs/promises'));
    const existingContent = await fs.readFile(ctx.taskPath, 'utf-8');

    if (!existingContent.includes('### Resume Attempt History')) {
      return;
    }

    const completedAt = new Date().toISOString();
    const iterations =
      ctx.state.iteration - blockedStatus.previousIteration;

    const updatePattern = new RegExp(
      `(### Resume Attempt History\\n[\\s\\S]*?Resumed at:.*?\\n.*?Previous attempt:.*?\\n)`,
      'i'
    );

    const replacement = `$1- **Completed at:** ${completedAt}
- **Status:** ${status}
- **Iterations in this attempt:** ${iterations}
`;

    const updatedContent = existingContent.replace(updatePattern, replacement);
    await fs.writeFile(ctx.taskPath, updatedContent);

    this.log(ctx, `Updated resume attempt history with status: ${status}`);
  }
}
