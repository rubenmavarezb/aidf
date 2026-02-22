// packages/cli/src/core/executor.ts

import { simpleGit, SimpleGit } from 'simple-git';
import type {
  ExecutorOptions,
  ExecutorState,
  ExecutorResult,
  ExecutionReport,
  AidfConfig,
  ExecutorDependencies,
} from '../types/index.js';
import { createProvider, type Provider } from './providers/index.js';
import { ScopeGuard } from './safety.js';
import { Validator } from './validator.js';
import { Logger } from '../utils/logger.js';
import { NotificationService } from '../utils/notifications.js';
import { findAndLoadConfig } from '../utils/config.js';
import { moveTaskFile } from '../utils/files.js';
import { PreFlightPhase, PreFlightError } from './phases/preflight.js';
import { ExecutionPhase } from './phases/execution.js';
import { PostFlightPhase } from './phases/postflight.js';
import type { PhaseContext } from './phases/types.js';
import { AidfError } from './errors.js';
import { MetricsCollector } from './metrics-collector.js';
import { ReportWriter } from './report-writer.js';
import { lookupCostRates } from '../utils/cost.js';

export class Executor {
  private options: ExecutorOptions;
  private config: AidfConfig;
  private cwd: string;
  private provider: Provider;
  private git: SimpleGit;
  private state: ExecutorState;
  private logger: Logger;
  private notificationService: NotificationService;
  private deps: ExecutorDependencies;

  constructor(
    config: AidfConfig,
    options: Partial<ExecutorOptions> = {},
    cwd: string = process.cwd(),
    deps?: Partial<ExecutorDependencies>
  ) {
    this.config = config;
    this.cwd = cwd;

    // Merge options with defaults (filter out undefined values from options)
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

    // Initialize logger (use provided logger or create default)
    this.logger = deps?.logger ?? options.logger ?? new Logger({ verbose: this.options.verbose });

    // Build dependencies (use injected or create defaults)
    this.deps = {
      git: deps?.git ?? simpleGit(cwd),
      fs: deps?.fs ?? undefined as unknown as typeof import('fs/promises'),
      createScopeGuard: deps?.createScopeGuard ?? ((scope, mode) => new ScopeGuard(scope, mode)),
      createValidator: deps?.createValidator ?? ((validationConfig, validatorCwd) => new Validator(validationConfig, validatorCwd)),
      createProvider: deps?.createProvider ?? createProvider,
      notificationService: deps?.notificationService ?? new NotificationService(config.notifications, this.logger),
      logger: this.logger,
      moveTaskFile: deps?.moveTaskFile ?? moveTaskFile,
    };

    this.git = this.deps.git;
    this.notificationService = this.deps.notificationService;

    // Create provider
    this.provider = this.deps.createProvider(
      config.provider?.type ?? 'claude-cli',
      cwd
    );

    // Initial state
    this.state = {
      status: 'idle',
      iteration: 0,
      filesModified: [],
      validationResults: [],
    };
  }

  async run(taskPath: string): Promise<ExecutorResult> {
    this.state.status = 'running';
    this.state.startedAt = new Date();
    this.state.iteration = 0;

    this.logger.setContext({ task: taskPath, iteration: 0 });

    // Create metrics collector
    const costRates = lookupCostRates(
      this.config.provider?.model,
      this.config.provider?.type ?? 'claude-cli',
      this.config.cost
    );
    const metrics = new MetricsCollector({
      taskPath,
      provider: {
        type: this.config.provider?.type ?? 'claude-cli',
        model: this.config.provider?.model,
      },
      cwd: this.cwd,
      maxIterations: this.options.maxIterations,
      scopeMode: this.options.scopeEnforcement,
      costRates,
    });

    const ctx: PhaseContext = {
      config: this.config,
      options: this.options,
      state: this.state,
      cwd: this.cwd,
      taskPath,
      deps: this.deps,
      metrics,
    };

    try {
      // Phase 1: PreFlight
      metrics.startPhase('contextLoading');
      const preFlight = new PreFlightPhase();
      const preFlightResult = await preFlight.execute(ctx);
      metrics.endPhase('contextLoading');

      // Set context info from preflight
      if (ctx.state.contextTokens) {
        metrics.setContextTokens(ctx.state.contextTokens, ctx.state.contextBreakdown);
      }
      metrics.setTaskMetadata({
        taskGoal: preFlightResult.context.task.goal,
        taskType: preFlightResult.context.task.taskType,
        roleName: preFlightResult.context.role.name,
      });

      // Update config if it was resolved during preflight
      this.config = ctx.config;

      // Phase 2: Execution Loop
      const executionPhase = new ExecutionPhase();
      const executionResult = await executionPhase.execute(ctx, preFlightResult);

      // Phase 3: PostFlight
      const postFlight = new PostFlightPhase();
      const result = await postFlight.execute(ctx, { preFlightResult, executionResult });

      // Persist report
      result.report = this.persistReport(ctx, metrics, result);

      return result;
    } catch (error) {
      if (error instanceof PreFlightError) {
        this.logger.error(`Failed to resolve config: ${error.message}`);
        this.state.status = 'failed';
        this.state.lastError = error.message;
        this.state.completedAt = new Date();
        metrics.recordError(error);
        const result: ExecutorResult = {
          success: false,
          status: 'failed',
          iterations: 0,
          filesModified: [],
          error: this.state.lastError,
          taskPath,
        };
        result.report = this.persistReport(ctx, metrics, result);
        return result;
      }

      this.state.status = 'failed';
      this.state.lastError = error instanceof Error ? error.message : 'Unknown error';
      metrics.recordError(error instanceof Error ? error : String(error));

      // Run postflight for failed state
      const postFlight = new PostFlightPhase();
      const postFlightResult = await postFlight.execute(ctx, {
        preFlightResult: null,
        executionResult: {
          completedNormally: false,
          terminationReason: undefined,
          lastError: this.state.lastError,
        },
      });

      // Populate error category if we have a typed error
      if (error instanceof AidfError) {
        postFlightResult.errorCategory = error.category;
        postFlightResult.errorCode = error.code;
        postFlightResult.errorDetails = error.context;
      }

      postFlightResult.report = this.persistReport(ctx, metrics, postFlightResult);
      return postFlightResult;
    }
  }

  private persistReport(
    ctx: PhaseContext,
    metrics: MetricsCollector,
    result: ExecutorResult
  ): ExecutionReport | undefined {
    try {
      // Sync status from result
      const statusMap: Record<string, 'completed' | 'blocked' | 'failed'> = {
        completed: 'completed',
        blocked: 'blocked',
        failed: 'failed',
      };
      const reportStatus = statusMap[result.status] ?? 'failed';
      metrics.setStatus(reportStatus);
      if (result.blockedReason) {
        metrics.setBlockedReason(result.blockedReason);
      }

      // Record file changes
      for (const file of result.filesModified) {
        metrics.recordFileChange(file, 'modified');
      }

      const report = metrics.toReport();
      const writer = new ReportWriter({ cwd: this.cwd });
      const reportPath = writer.write(report);
      this.logger.info(`Report saved: ${reportPath}`);
      return report;
    } catch (err) {
      this.logger.debug(`Failed to save report: ${err instanceof Error ? err.message : err}`);
      return undefined;
    }
  }

  pause(): void {
    if (this.state.status === 'running') {
      this.state.status = 'paused';
    }
  }

  resume(): void {
    if (this.state.status === 'paused') {
      this.state.status = 'running';
    }
  }

  getState(): ExecutorState {
    return { ...this.state };
  }
}

/**
 * Factory function
 */
export async function executeTask(
  taskPath: string,
  options?: Partial<ExecutorOptions>,
  deps?: Partial<ExecutorDependencies>
): Promise<ExecutorResult> {
  const config = await findAndLoadConfig();
  const executor = new Executor(config, options, process.cwd(), deps);
  return executor.run(taskPath);
}
