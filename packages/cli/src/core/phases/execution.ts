import type { ExecutorPhase, PhaseContext, PreFlightResult, ExecutionLoopResult } from './types.js';
import type { ExecutionResult } from '../providers/types.js';
import { buildIterationPrompt, buildContinuationPrompt } from '../providers/claude-cli.js';
import { Validator } from '../validator.js';
import { TimeoutError, GitError } from '../errors.js';

interface IterationState {
  consecutiveFailures: number;
  lastValidationError?: string;
  previousOutput?: string;
  conversationState?: unknown;
  blockedStatus: import('../../types/index.js').BlockedStatus | null;
}

export class ExecutionPhase implements ExecutorPhase<PreFlightResult, ExecutionLoopResult> {
  name = 'Execution';

  async execute(ctx: PhaseContext, input: PreFlightResult): Promise<ExecutionLoopResult> {
    const { context, scopeGuard, validator, provider, blockedStatus, skipPermissions } = input;

    const iterState: IterationState = {
      consecutiveFailures: 0,
      blockedStatus,
    };

    while (
      ctx.state.iteration < ctx.options.maxIterations &&
      iterState.consecutiveFailures < ctx.options.maxConsecutiveFailures &&
      ctx.state.status === 'running'
    ) {
      ctx.state.iteration++;
      ctx.deps.logger.setContext({
        task: ctx.taskPath,
        iteration: ctx.state.iteration,
        files: ctx.state.filesModified,
      });
      this.log(ctx, `\n=== Iteration ${ctx.state.iteration} ===`);

      this.emitPhase(ctx, 'Starting iteration');

      // Determine if we should use session continuation
      const useContinuation =
        ctx.state.iteration > 1 &&
        ctx.config.execution?.session_continuation !== false &&
        iterState.conversationState !== undefined;

      // Build prompt
      const prompt = useContinuation
        ? buildContinuationPrompt({
            previousOutput: iterState.previousOutput,
            previousValidationError: iterState.lastValidationError,
            iteration: ctx.state.iteration,
          })
        : buildIterationPrompt({
            agents: context.agents.raw,
            role: context.role.raw,
            task: context.task.raw,
            plan: context.plan,
            skills: context.skills,
            iteration: ctx.state.iteration,
            previousValidationError: iterState.lastValidationError,
            blockingContext: blockedStatus
              ? {
                  previousIteration: blockedStatus.previousIteration,
                  blockingIssue: blockedStatus.blockingIssue,
                  filesModified: blockedStatus.filesModified,
                }
              : undefined,
          });

      // Dry run check
      if (ctx.options.dryRun) {
        this.log(ctx, '[DRY RUN] Would execute prompt...');
        return { completedNormally: false, terminationReason: 'dry_run' };
      }

      this.emitPhase(ctx, 'Executing AI');

      if (useContinuation && ctx.state.contextTokens) {
        ctx.deps.logger.info(
          `Session continuation: ~${ctx.state.contextTokens.toLocaleString()} static tokens saved`
        );
      }

      // Resolve conversation config
      const conversationConfig = ctx.config.execution?.conversation ?? (
        ctx.config.execution?.max_conversation_messages
          ? { max_messages: ctx.config.execution.max_conversation_messages }
          : undefined
      );

      // Execute provider with timeout
      const timeoutMs = ctx.options.timeoutPerIteration * 1000;
      let result = await this.executeWithTimeout(
        ctx,
        provider.execute(prompt, {
          timeout: timeoutMs,
          dangerouslySkipPermissions: skipPermissions,
          onOutput: ctx.options.onOutput,
          sessionContinuation: useContinuation,
          conversationState: useContinuation ? iterState.conversationState : undefined,
          conversationConfig,
        }),
        timeoutMs
      );

      // Fallback: if continuation failed, retry with full prompt
      if (useContinuation && !result.success && !result.iterationComplete) {
        this.log(ctx, 'Session continuation failed, retrying with full prompt');
        iterState.conversationState = undefined;
        const fullPrompt = buildIterationPrompt({
          agents: context.agents.raw,
          role: context.role.raw,
          task: context.task.raw,
          plan: context.plan,
          skills: context.skills,
          iteration: ctx.state.iteration,
          previousValidationError: iterState.lastValidationError,
          blockingContext: blockedStatus
            ? {
                previousIteration: blockedStatus.previousIteration,
                blockingIssue: blockedStatus.blockingIssue,
                filesModified: blockedStatus.filesModified,
              }
            : undefined,
        });
        result = await this.executeWithTimeout(
          ctx,
          provider.execute(fullPrompt, {
            timeout: timeoutMs,
            dangerouslySkipPermissions: skipPermissions,
            onOutput: ctx.options.onOutput,
          }),
          timeoutMs
        );
      }

      // Track state for next iteration
      iterState.previousOutput = result.output;
      iterState.conversationState =
        result.conversationState ??
        (useContinuation ? iterState.conversationState : true);

      // Accumulate token usage
      if (result.tokenUsage) {
        if (!ctx.state.tokenUsage) {
          ctx.state.tokenUsage = { inputTokens: 0, outputTokens: 0 };
        }
        ctx.state.tokenUsage.inputTokens += result.tokenUsage.inputTokens;
        ctx.state.tokenUsage.outputTokens += result.tokenUsage.outputTokens;

        ctx.deps.logger.info(
          `Iteration ${ctx.state.iteration} tokens: input=${result.tokenUsage.inputTokens.toLocaleString()}, output=${result.tokenUsage.outputTokens.toLocaleString()}`
        );
      }

      // Track conversation metrics
      if (result.conversationMetrics) {
        const cm = result.conversationMetrics;
        ctx.state.conversationMessageCount = cm.totalMessages;
        ctx.deps.logger.info(
          `Conversation: ${cm.preservedMessages} messages (~${cm.estimatedTokens.toLocaleString()} tokens)`
        );
        if (cm.evictedMessages > 0) {
          ctx.deps.logger.info(
            `Trimmed conversation: ${cm.evictedMessages} messages removed`
          );
        }
        const maxMessages = conversationConfig?.max_messages ?? 100;
        if (maxMessages > 0 && cm.totalMessages >= maxMessages * 0.8) {
          ctx.deps.logger.warn(
            `Conversation approaching limit (${cm.totalMessages}/${maxMessages} messages)`
          );
        }
      }

      // Handle provider-level failures
      if (
        !result.success &&
        !result.iterationComplete &&
        result.filesChanged.length === 0 &&
        result.error
      ) {
        // Check for BLOCKED signal
        if (result.error.includes('BLOCKED')) {
          ctx.state.status = 'blocked';
          ctx.state.lastError = result.error;
          return {
            completedNormally: false,
            terminationReason: 'blocked',
            lastError: result.error,
          };
        }

        // Handle by error category if available
        if (result.errorCategory) {
          const handled = this.handleCategorizedError(ctx, result, iterState);
          if (handled) {
            ctx.options.onIteration?.({ ...ctx.state });
            if (handled === 'abort') {
              return {
                completedNormally: false,
                terminationReason: 'max_failures',
                lastError: result.error,
              };
            }
            continue;
          }
        }

        this.log(ctx, `Provider execution failed: ${result.error}`);
        iterState.consecutiveFailures++;
        ctx.options.onIteration?.({ ...ctx.state });
        continue;
      }

      const hasCompletionSignal = result.iterationComplete;

      this.emitPhase(ctx, 'Checking scope');

      // Check scope violations
      if (result.filesChanged.length > 0) {
        const fileChanges = result.filesChanged.map((f) => ({
          path: f,
          type: 'modified' as const,
        }));

        const scopeDecision = scopeGuard.validate(fileChanges);

        if (scopeDecision.action === 'BLOCK') {
          this.log(ctx, `Scope violation: ${scopeDecision.reason}`);
          await this.revertChanges(ctx, scopeDecision.files);

          if (hasCompletionSignal) {
            this.log(
              ctx,
              `AI signaled completion but had scope violations. Violations reverted — accepting completion.`
            );
            ctx.state.status = 'completed';
            return { completedNormally: true, terminationReason: 'completed' };
          }

          iterState.consecutiveFailures++;
          this.emitPhase(ctx, 'Scope violation');
          continue;
        }

        if (scopeDecision.action === 'ASK_USER' && ctx.options.onAskUser) {
          const approved = await ctx.options.onAskUser(
            scopeDecision.reason,
            scopeDecision.files
          );
          if (!approved) {
            await this.revertChanges(ctx, scopeDecision.files);
            iterState.consecutiveFailures++;
            continue;
          }
          scopeGuard.approve(scopeDecision.files);
        }
      }

      this.emitPhase(ctx, 'Validating');

      // Validate changes
      const validation = await validator.preCommit();
      ctx.state.validationResults.push(validation);

      if (!validation.passed) {
        const validationReport = Validator.formatReport(validation);
        this.log(ctx, `Validation failed: ${validationReport}`);

        if (hasCompletionSignal) {
          this.log(
            ctx,
            `AI signaled completion but validation failed. Retrying with feedback.`
          );
          iterState.lastValidationError = validationReport;
        }

        iterState.consecutiveFailures++;
        this.emitPhase(ctx, 'Validation failed');
        continue;
      }

      // Validation passed — clear any previous validation error
      iterState.lastValidationError = undefined;

      // Commit if autoCommit is enabled
      if (ctx.options.autoCommit && result.filesChanged.length > 0) {
        this.emitPhase(ctx, 'Committing');
        await this.commitChanges(ctx, result.filesChanged, context.task.goal);
        ctx.state.filesModified.push(...result.filesChanged);
      }

      // Reset consecutive failures on success
      iterState.consecutiveFailures = 0;

      // Notify callback
      ctx.options.onIteration?.({ ...ctx.state });

      // Check completion
      if (hasCompletionSignal) {
        ctx.deps.logger.setContext({
          task: ctx.taskPath,
          iteration: ctx.state.iteration,
          files: ctx.state.filesModified,
          status: 'completed',
        });
        this.log(ctx, `Task complete: ${result.completionSignal}`);
        ctx.state.status = 'completed';
        return { completedNormally: true, terminationReason: 'completed' };
      }
    }

    // Determine termination reason
    if (
      ctx.state.status === 'running' &&
      ctx.state.iteration >= ctx.options.maxIterations
    ) {
      return {
        completedNormally: false,
        terminationReason: 'max_iterations',
        lastError: `Max iterations (${ctx.options.maxIterations}) reached`,
      };
    }

    if (
      ctx.state.status === 'running' &&
      iterState.consecutiveFailures >= ctx.options.maxConsecutiveFailures
    ) {
      return {
        completedNormally: false,
        terminationReason: 'max_failures',
        lastError: `Max consecutive failures (${ctx.options.maxConsecutiveFailures}) reached`,
      };
    }

    return { completedNormally: false };
  }

  private handleCategorizedError(
    ctx: PhaseContext,
    result: ExecutionResult,
    iterState: IterationState
  ): 'continue' | 'abort' | null {
    switch (result.errorCategory) {
      case 'config':
      case 'permission':
        // Fatal errors — abort immediately
        this.log(ctx, `Fatal error [${result.errorCategory}/${result.errorCode}]: ${result.error}`);
        ctx.state.status = 'failed';
        ctx.state.lastError = result.error;
        return 'abort';

      case 'timeout':
        // Retryable — increment failure counter
        this.log(ctx, `Timeout [${result.errorCode}]: ${result.error}`);
        iterState.consecutiveFailures++;
        return 'continue';

      case 'provider':
        if (result.errorCode === 'PROVIDER_RATE_LIMIT') {
          // Rate limit — do NOT increment failure counter, wait
          this.log(ctx, 'Rate limited, waiting 5s before retry...');
          return 'continue';
        }
        if (result.errorCode === 'PROVIDER_NOT_AVAILABLE') {
          // Provider unavailable — abort
          this.log(ctx, `Provider not available: ${result.error}`);
          ctx.state.status = 'failed';
          ctx.state.lastError = result.error;
          return 'abort';
        }
        // PROVIDER_CRASH, PROVIDER_API_ERROR — retry
        this.log(ctx, `Provider error [${result.errorCode}]: ${result.error}`);
        iterState.consecutiveFailures++;
        return 'continue';

      case 'git':
        if (result.errorCode === 'GIT_REVERT_FAILED') {
          // Corrupted state — abort
          this.log(ctx, `Git revert failed — state may be corrupted: ${result.error}`);
          ctx.state.status = 'failed';
          ctx.state.lastError = result.error;
          return 'abort';
        }
        // GIT_COMMIT_FAILED, GIT_PUSH_FAILED — retry, then warn
        this.log(ctx, `Git error [${result.errorCode}]: ${result.error}`);
        iterState.consecutiveFailures++;
        return 'continue';

      case 'scope':
        if (result.errorCode === 'SCOPE_USER_DENIED') {
          // User denied — abort
          this.log(ctx, `User denied scope change: ${result.error}`);
          ctx.state.status = 'failed';
          ctx.state.lastError = result.error;
          return 'abort';
        }
        // SCOPE_FORBIDDEN, SCOPE_OUTSIDE_ALLOWED — retry
        iterState.consecutiveFailures++;
        return 'continue';

      case 'validation':
        // Feed error back to AI — existing behavior
        iterState.consecutiveFailures++;
        return 'continue';

      default:
        return null;
    }
  }

  private emitPhase(ctx: PhaseContext, phase: string): void {
    ctx.options.onPhase?.({
      phase,
      iteration: ctx.state.iteration,
      totalIterations: ctx.options.maxIterations,
      filesModified: ctx.state.filesModified.length,
    });
  }

  private log(ctx: PhaseContext, message: string): void {
    if (ctx.options.verbose) {
      ctx.deps.logger.debug(`[aidf] ${message}`);
    } else {
      ctx.deps.logger.info(message);
    }
  }

  private async executeWithTimeout(
    ctx: PhaseContext,
    executionPromise: Promise<ExecutionResult>,
    timeoutMs: number
  ): Promise<ExecutionResult> {
    if (timeoutMs <= 0) {
      return executionPromise;
    }

    let timer: NodeJS.Timeout | undefined;

    const timeoutPromise = new Promise<ExecutionResult>((resolve) => {
      timer = setTimeout(() => {
        const err = TimeoutError.iteration(timeoutMs, ctx.state.iteration);
        ctx.deps.logger.warn(
          `Iteration ${ctx.state.iteration} timed out after ${Math.round(timeoutMs / 1000)}s`
        );
        resolve({
          success: false,
          output: '',
          error: err.message,
          errorCategory: err.category,
          errorCode: err.code,
          filesChanged: [],
          iterationComplete: false,
        });
      }, timeoutMs);
    });

    try {
      return await Promise.race([executionPromise, timeoutPromise]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  private async revertChanges(ctx: PhaseContext, files: string[]): Promise<void> {
    this.log(ctx, `Reverting changes to: ${files.join(', ')}`);
    try {
      await ctx.deps.git.checkout(['--', ...files]);
    } catch (error) {
      const rawError = error instanceof Error ? error.message : String(error);
      throw GitError.revertFailed(files, rawError);
    }
  }

  private async commitChanges(
    ctx: PhaseContext,
    files: string[],
    taskGoal: string
  ): Promise<void> {
    const prefix = ctx.config.git?.commit_prefix ?? 'aidf:';
    const message = `${prefix} ${taskGoal.slice(0, 50)}${taskGoal.length > 50 ? '...' : ''}`;

    try {
      await ctx.deps.git.add(files);
      await ctx.deps.git.commit(message);
      this.log(ctx, `Committed: ${message}`);
    } catch (error) {
      const rawError = error instanceof Error ? error.message : String(error);
      throw GitError.commitFailed(files, rawError);
    }
  }
}
