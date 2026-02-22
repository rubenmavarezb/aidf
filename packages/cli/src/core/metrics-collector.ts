import type {
  ExecutionReport,
  CostRates,
  PhaseTimings,
  IterationTokens,
  IterationCost,
  IterationTiming,
  IterationMetrics,
  ValidationRun,
  CIEnvironment,
  ContextBreakdown,
} from '../types/index.js';

/**
 * Options for constructing a MetricsCollector.
 * Passed at the start of Executor.run() with run metadata.
 */
export interface MetricsCollectorOptions {
  taskPath: string;
  taskGoal?: string;
  taskType?: string;
  roleName?: string;
  provider: { type: string; model?: string };
  cwd: string;
  maxIterations: number;
  scopeMode?: string;
  costRates?: CostRates;
  aidfVersion?: string;
}

interface ActivePhase {
  name: string;
  startTime: number;
}

/**
 * Passive metrics collector for execution runs.
 *
 * Accumulates timing, token, validation, scope, and file change data
 * throughout an execution run. No I/O is performed — the final report
 * is assembled via toReport() and persistence is handled externally.
 */
export class MetricsCollector {
  readonly runId: string;
  private options: MetricsCollectorOptions;
  private readonly startTime: number;
  private readonly startedAt: string;

  // Phase timing
  private readonly phaseAccumulator: Map<string, number> = new Map();
  private readonly activePhases: Map<string, ActivePhase> = new Map();

  // Iteration data
  private readonly iterationTimings: IterationTiming[] = [];
  private readonly iterationTokens: IterationTokens[] = [];
  private readonly iterationCosts: IterationCost[] = [];
  private iterationCount = 0;

  // Token totals
  private totalInputTokens = 0;
  private totalOutputTokens = 0;
  private contextTokens: number | undefined;
  private contextBreakdown: ContextBreakdown | undefined;
  private tokensEstimated = false;

  // Validation
  private readonly validationRuns: ValidationRun[] = [];

  // Scope
  private scopeViolationCount = 0;
  private readonly blockedFiles: string[] = [];

  // Files
  private readonly modifiedFiles: Set<string> = new Set();
  private readonly createdFiles: Set<string> = new Set();
  private readonly deletedFiles: Set<string> = new Set();

  // Status
  private status: 'completed' | 'blocked' | 'failed' = 'completed';
  private consecutiveFailures = 0;
  private errorMessage: string | undefined;
  private blockedReason: string | undefined;

  constructor(options: MetricsCollectorOptions) {
    this.runId = crypto.randomUUID();
    this.options = options;
    this.startTime = performance.now();
    this.startedAt = new Date().toISOString();
  }

  /**
   * Update task metadata after preflight has loaded context.
   */
  setTaskMetadata(meta: { taskGoal?: string; taskType?: string; roleName?: string }): void {
    if (meta.taskGoal) this.options.taskGoal = meta.taskGoal;
    if (meta.taskType) this.options.taskType = meta.taskType;
    if (meta.roleName) this.options.roleName = meta.roleName;
  }

  /**
   * Mark the start of a named phase. Phases can be nested.
   */
  startPhase(name: string): void {
    this.activePhases.set(name, {
      name,
      startTime: performance.now(),
    });
  }

  /**
   * Mark the end of a named phase. Accumulates duration if the phase
   * is started multiple times (e.g., across iterations).
   */
  endPhase(name: string): number {
    const active = this.activePhases.get(name);
    if (!active) {
      return 0;
    }

    const durationMs = performance.now() - active.startTime;
    const accumulated = this.phaseAccumulator.get(name) ?? 0;
    this.phaseAccumulator.set(name, accumulated + durationMs);
    this.activePhases.delete(name);

    return durationMs;
  }

  /**
   * Record metrics for a completed iteration.
   */
  recordIteration(metrics: IterationMetrics): void {
    this.iterationCount = Math.max(this.iterationCount, metrics.iteration);

    this.iterationTimings.push({
      iteration: metrics.iteration,
      durationMs: metrics.durationMs,
      phases: metrics.phases,
    });

    this.iterationTokens.push({
      iteration: metrics.iteration,
      input: metrics.input,
      output: metrics.output,
    });

    this.totalInputTokens += metrics.input;
    this.totalOutputTokens += metrics.output;

    if (metrics.cost !== undefined) {
      this.iterationCosts.push({
        iteration: metrics.iteration,
        cost: metrics.cost,
      });
    }

    if (metrics.filesChanged) {
      for (const file of metrics.filesChanged) {
        this.modifiedFiles.add(file);
      }
    }
  }

  /**
   * Record token usage for a specific iteration.
   */
  recordTokenUsage(iteration: number, input: number, output: number): void {
    this.iterationTokens.push({ iteration, input, output });
    this.totalInputTokens += input;
    this.totalOutputTokens += output;
  }

  /**
   * Record a validation run result.
   */
  recordValidation(result: ValidationRun): void {
    this.validationRuns.push(result);
  }

  /**
   * Record scope violation(s) for one or more files.
   */
  recordScopeViolation(files: string[]): void {
    this.scopeViolationCount += files.length;
    for (const file of files) {
      if (!this.blockedFiles.includes(file)) {
        this.blockedFiles.push(file);
      }
    }
  }

  /**
   * Record a file change event.
   */
  recordFileChange(path: string, type: 'modified' | 'created' | 'deleted'): void {
    switch (type) {
      case 'modified':
        this.modifiedFiles.add(path);
        break;
      case 'created':
        this.createdFiles.add(path);
        break;
      case 'deleted':
        this.deletedFiles.add(path);
        break;
    }
  }

  /**
   * Record an error. Sets status to 'failed' unless already 'blocked'.
   */
  recordError(error: Error | string): void {
    this.errorMessage = error instanceof Error ? error.message : error;
    if (this.status !== 'blocked') {
      this.status = 'failed';
    }
  }

  /**
   * Set the final execution status.
   */
  setStatus(status: 'completed' | 'blocked' | 'failed'): void {
    this.status = status;
  }

  /**
   * Set the blocked reason (when status is 'blocked').
   */
  setBlockedReason(reason: string): void {
    this.blockedReason = reason;
    this.status = 'blocked';
  }

  /**
   * Set consecutive failure count.
   */
  setConsecutiveFailures(count: number): void {
    this.consecutiveFailures = count;
  }

  /**
   * Set context token count and optional breakdown.
   */
  setContextTokens(count: number, breakdown?: ContextBreakdown): void {
    this.contextTokens = count;
    this.contextBreakdown = breakdown;
  }

  /**
   * Mark token counts as estimated (e.g., from CLI providers without exact counts).
   */
  setTokensEstimated(estimated: boolean): void {
    this.tokensEstimated = estimated;
  }

  /**
   * Detect CI environment from process.env.
   */
  private detectCIEnvironment(): CIEnvironment {
    const env = process.env;
    const ci = !!(env.CI || env.CONTINUOUS_INTEGRATION || env.GITHUB_ACTIONS || env.GITLAB_CI || env.CIRCLECI);

    if (!ci) {
      return { ci: false };
    }

    let ciProvider: string | undefined;
    let ciBuildId: string | undefined;
    let ciBranch: string | undefined;
    let ciCommit: string | undefined;

    if (env.GITHUB_ACTIONS) {
      ciProvider = 'github-actions';
      ciBuildId = env.GITHUB_RUN_ID;
      ciBranch = env.GITHUB_REF_NAME;
      ciCommit = env.GITHUB_SHA;
    } else if (env.GITLAB_CI) {
      ciProvider = 'gitlab-ci';
      ciBuildId = env.CI_PIPELINE_ID;
      ciBranch = env.CI_COMMIT_BRANCH;
      ciCommit = env.CI_COMMIT_SHA;
    } else if (env.CIRCLECI) {
      ciProvider = 'circleci';
      ciBuildId = env.CIRCLE_BUILD_NUM;
      ciBranch = env.CIRCLE_BRANCH;
      ciCommit = env.CIRCLE_SHA1;
    }

    return { ci, ciProvider, ciBuildId, ciBranch, ciCommit };
  }

  /**
   * Compute estimated cost from token usage and cost rates.
   */
  private computeCost(): ExecutionReport['cost'] | undefined {
    const rates = this.options.costRates;
    if (!rates) {
      return undefined;
    }

    const inputCost = (this.totalInputTokens / 1_000_000) * rates.inputPer1M;
    const outputCost = (this.totalOutputTokens / 1_000_000) * rates.outputPer1M;
    const estimatedTotal = inputCost + outputCost;

    return {
      estimatedTotal,
      currency: 'USD',
      rates,
      perIteration: this.iterationCosts.length > 0 ? this.iterationCosts : undefined,
    };
  }

  /**
   * Build phase timings from the accumulator.
   */
  private buildPhaseTimings(): PhaseTimings | undefined {
    if (this.phaseAccumulator.size === 0) {
      return undefined;
    }

    const timings: PhaseTimings = {};
    for (const [phase, ms] of this.phaseAccumulator) {
      timings[phase] = Math.round(ms * 100) / 100;
    }
    return timings;
  }

  /**
   * Assemble the final execution report from all accumulated data.
   */
  toReport(): ExecutionReport {
    const completedAt = new Date().toISOString();
    const totalDurationMs = performance.now() - this.startTime;
    const ciEnv = this.detectCIEnvironment();

    const totalTokens = this.totalInputTokens + this.totalOutputTokens;
    const modified = [...this.modifiedFiles];
    const created = [...this.createdFiles];
    const deleted = [...this.deletedFiles];

    const failedValidations = this.validationRuns.filter(r => !r.passed).length;

    const report: ExecutionReport = {
      runId: this.runId,
      timestamp: completedAt,
      taskPath: this.options.taskPath,
      taskGoal: this.options.taskGoal,
      taskType: this.options.taskType,
      roleName: this.options.roleName,
      provider: this.options.provider,
      cwd: this.options.cwd,
      aidfVersion: this.options.aidfVersion,
      status: this.status,
      iterations: this.iterationCount,
      maxIterations: this.options.maxIterations,
      consecutiveFailures: this.consecutiveFailures > 0 ? this.consecutiveFailures : undefined,
      error: this.errorMessage,
      blockedReason: this.blockedReason,
      tokens: totalTokens > 0 ? {
        contextTokens: this.contextTokens,
        totalInput: this.totalInputTokens,
        totalOutput: this.totalOutputTokens,
        totalTokens,
        estimated: this.tokensEstimated || undefined,
        perIteration: this.iterationTokens.length > 0 ? this.iterationTokens : undefined,
        breakdown: this.contextBreakdown,
      } : undefined,
      cost: this.computeCost(),
      timing: {
        startedAt: this.startedAt,
        completedAt,
        totalDurationMs: Math.round(totalDurationMs * 100) / 100,
        phases: this.buildPhaseTimings(),
        perIteration: this.iterationTimings.length > 0 ? this.iterationTimings : undefined,
      },
      files: {
        modified,
        created,
        deleted,
        totalCount: modified.length + created.length + deleted.length,
      },
      validation: this.validationRuns.length > 0 ? {
        runs: this.validationRuns,
        totalRuns: this.validationRuns.length,
        failures: failedValidations,
      } : undefined,
      scope: this.options.scopeMode ? {
        mode: this.options.scopeMode,
        violations: this.scopeViolationCount,
        blockedFiles: this.blockedFiles,
      } : undefined,
      environment: {
        nodeVersion: process.version,
        os: `${process.platform}-${process.arch}`,
        ...ciEnv,
      },
    };

    return report;
  }
}
