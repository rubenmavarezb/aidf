// packages/cli/src/core/plan-executor.ts

import { basename } from 'path';
import chalk from 'chalk';
import type {
  ParsedPlan,
  PlanTask,
  PlanWave,
  PlanExecutionResult,
  ExecutorDependencies,
} from '../types/index.js';
import { executeTask } from './executor.js';
import { ParallelExecutor } from './parallel-executor.js';
import { PlanParser } from './plan-parser.js';
import { Logger } from '../utils/logger.js';

export interface PlanExecutorOptions {
  concurrency: number;
  continueOnError: boolean;
  dryRun: boolean;
  verbose: boolean;
  maxIterations?: number;
  provider?: string;
  deps?: Partial<ExecutorDependencies>;
}

export class PlanExecutor {
  private options: PlanExecutorOptions;
  private logger: Logger;

  constructor(options: PlanExecutorOptions) {
    this.options = options;
    this.logger = new Logger({ verbose: options.verbose });
  }

  async run(plan: ParsedPlan): Promise<PlanExecutionResult> {
    const result: PlanExecutionResult = {
      success: true,
      planPath: plan.planPath,
      totalTasks: plan.tasks.length,
      completedTasks: 0,
      failedTasks: 0,
      blockedTasks: 0,
      skippedTasks: 0,
    };

    // Count already-completed tasks
    const skippedCompleted = plan.tasks.filter((t: PlanTask) => t.completed).length;
    result.skippedTasks = skippedCompleted;

    const pendingWaves: PlanWave[] = plan.waves
      .map((wave: PlanWave): PlanWave => ({
        ...wave,
        tasks: wave.tasks.filter((t: PlanTask) => !t.completed),
      }))
      .filter((wave: PlanWave) => wave.tasks.length > 0);

    if (pendingWaves.length === 0) {
      this.logger.success('All tasks in this plan are already completed.');
      result.completedTasks = skippedCompleted;
      return result;
    }

    this.printPlanOverview(plan, pendingWaves);

    if (this.options.dryRun) {
      this.logger.info(chalk.yellow('\n[DRY RUN] No tasks will be executed.'));
      await this.logger.close();
      return result;
    }

    // Execute wave by wave
    for (const wave of pendingWaves) {
      this.logger.info(`\n${chalk.bold(`--- Wave ${wave.number} (${wave.tasks.length} task${wave.tasks.length > 1 ? 's' : ''}) ---`)}`);

      let waveSuccess: boolean;

      if (wave.tasks.length === 1) {
        waveSuccess = await this.executeSingleTask(wave.tasks[0].taskPath, plan.planPath, wave.tasks[0].lineNumber);
      } else {
        waveSuccess = await this.executeParallelWave(wave, plan.planPath);
      }

      if (waveSuccess) {
        result.completedTasks += wave.tasks.length;
      } else {
        result.failedTasks += wave.tasks.length;
        result.success = false;

        if (!this.options.continueOnError) {
          this.logger.error(`Wave ${wave.number} failed. Stopping execution (use --continue-on-error to override).`);
          break;
        }
      }
    }

    this.printSummary(result);
    await this.logger.close();
    return result;
  }

  private async executeSingleTask(taskPath: string, planPath: string, lineNumber: number): Promise<boolean> {
    const taskName = basename(taskPath, '.md');
    this.logger.info(`Executing: ${chalk.cyan(taskName)}`);

    try {
      const taskResult = await executeTask(taskPath, {
        dryRun: this.options.dryRun,
        verbose: this.options.verbose,
        maxIterations: this.options.maxIterations,
      }, this.options.deps);

      if (taskResult.success) {
        await PlanParser.markTaskCompleted(planPath, lineNumber);
        this.logger.success(`${taskName}: completed (${taskResult.iterations} iterations, ${taskResult.filesModified.length} files)`);
        return true;
      }

      if (taskResult.status === 'blocked') {
        this.logger.warn(`${taskName}: blocked — ${taskResult.blockedReason || 'unknown reason'}`);
      } else {
        this.logger.error(`${taskName}: failed — ${taskResult.error || 'unknown error'}`);
      }
      return false;
    } catch (error) {
      this.logger.error(`${taskName}: ${error instanceof Error ? error.message : 'unknown error'}`);
      return false;
    }
  }

  private async executeParallelWave(wave: PlanWave, planPath: string): Promise<boolean> {
    const taskPaths = wave.tasks.map((t: PlanTask) => t.taskPath);

    const parallel = new ParallelExecutor({
      concurrency: this.options.concurrency,
      dryRun: this.options.dryRun,
      verbose: this.options.verbose,
      quiet: false,
      maxIterations: this.options.maxIterations,
      deps: this.options.deps,
    });

    const parallelResult = await parallel.run(taskPaths);

    // Mark completed tasks in plan file
    for (const taskResult of parallelResult.tasks) {
      if (taskResult.result.success) {
        const planTask = wave.tasks.find((t: PlanTask) => t.taskPath === taskResult.taskPath);
        if (planTask) {
          await PlanParser.markTaskCompleted(planPath, planTask.lineNumber);
        }
      }
    }

    return parallelResult.success;
  }

  private printPlanOverview(plan: ParsedPlan, pendingWaves: PlanWave[]): void {
    const totalPending = pendingWaves.reduce((sum: number, w: PlanWave) => sum + w.tasks.length, 0);
    const totalCompleted = plan.tasks.length - totalPending;

    this.logger.box(plan.name, [
      plan.overview ? plan.overview.slice(0, 200) : '',
      '',
      `Total tasks: ${plan.tasks.length}`,
      `Already completed: ${totalCompleted}`,
      `Pending: ${totalPending}`,
      `Waves: ${pendingWaves.length}`,
      '',
      ...pendingWaves.map((w: PlanWave) => {
        const taskNames = w.tasks.map((t: PlanTask) => basename(t.filename, '.md')).join(', ');
        return `  Wave ${w.number}: ${taskNames}`;
      }),
    ].join('\n'));
  }

  private printSummary(result: PlanExecutionResult): void {
    const statusIcon = result.success ? chalk.green('COMPLETED') : chalk.red('INCOMPLETE');

    this.logger.info('');
    this.logger.box('Plan Execution Summary', [
      `Status: ${statusIcon}`,
      `Total Tasks: ${result.totalTasks}`,
      `  Completed: ${result.completedTasks}`,
      `  Failed:    ${result.failedTasks}`,
      `  Blocked:   ${result.blockedTasks}`,
      `  Skipped:   ${result.skippedTasks}`,
    ].join('\n'));
  }
}
