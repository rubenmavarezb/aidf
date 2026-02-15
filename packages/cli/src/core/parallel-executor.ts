// packages/cli/src/core/parallel-executor.ts

import { basename } from 'path';
import chalk from 'chalk';
import type {
  ParallelExecutorOptions,
  ParallelExecutionResult,
  ParallelTaskResult,
  TaskDependency,
  ExecutorState,
  ParsedTask,
} from '../types/index.js';
import { executeTask } from './executor.js';
import { ContextLoader } from './context-loader.js';
import { Logger } from '../utils/logger.js';
import { matchesPattern } from './safety.js';

const TASK_COLORS: string[] = [
  'cyan', 'magenta', 'yellow', 'green', 'blue', 'red',
];

/**
 * Executes multiple tasks in parallel with coordination.
 */
export class ParallelExecutor {
  private options: ParallelExecutorOptions;
  private logger: Logger;
  private activeFiles: Map<string, string> = new Map(); // file -> taskPath
  private results: ParallelTaskResult[] = [];
  private dependencies: TaskDependency[] = [];
  private fileConflicts: string[] = [];
  private conflictedTasks: Set<string> = new Set(); // tasks to retry due to runtime conflicts

  constructor(options: ParallelExecutorOptions) {
    this.options = options;
    this.logger = new Logger({
      verbose: options.verbose,
      quiet: options.quiet,
      logFormat: options.logFormat,
      logFile: options.logFile,
      logRotate: options.logRotate,
    });
  }

  /**
   * Executes the given tasks in parallel with concurrency control.
   */
  async run(taskPaths: string[]): Promise<ParallelExecutionResult> {
    // 1. Parse all tasks and detect dependencies
    const projectRoot = ContextLoader.findAiDir();
    if (!projectRoot) {
      throw new Error('No AIDF project found. Run `aidf init` first.');
    }

    const loader = new ContextLoader(projectRoot);
    const parsedTasks: Map<string, ParsedTask> = new Map();

    for (const taskPath of taskPaths) {
      const task = await loader.parseTask(taskPath);
      parsedTasks.set(taskPath, task);
    }

    // 2. Detect dependencies (overlapping scopes)
    this.dependencies = this.detectDependencies(taskPaths, parsedTasks);

    if (this.dependencies.length > 0) {
      this.logger.warn('Detected task dependencies (overlapping scopes):');
      for (const dep of this.dependencies) {
        const taskName = basename(dep.taskPath, '.md');
        const depNames = dep.dependsOn.map(d => basename(d, '.md')).join(', ');
        this.logger.warn(`  ${taskName} conflicts with: ${depNames} (${dep.reason})`);
      }
    }

    // 3. Build execution order respecting dependencies
    const executionOrder = this.buildExecutionOrder(taskPaths, this.dependencies);

    // 4. Execute with concurrency control
    this.logger.box('Parallel Execution', [
      `Tasks: ${taskPaths.length}`,
      `Concurrency: ${this.options.concurrency}`,
      `Dependencies detected: ${this.dependencies.length}`,
      '',
      ...taskPaths.map((tp, i) => {
        const name = basename(tp, '.md');
        const task = parsedTasks.get(tp)!;
        return `  ${i + 1}. ${name}: ${task.goal.slice(0, 60)}`;
      }),
    ].join('\n'));

    const startTime = Date.now();
    await this.executeWithConcurrency(executionOrder, parsedTasks);
    const totalTime = Date.now() - startTime;

    // 5. Build consolidated result
    const result = this.buildConsolidatedResult(taskPaths);

    // 6. Print summary
    this.printSummary(result, totalTime);

    await this.logger.close();
    return result;
  }

  /**
   * Detects dependencies between tasks by checking for overlapping allowed scopes.
   * Two tasks conflict if their allowed paths overlap (one task's allowed path
   * is a parent/child of another's).
   */
  private detectDependencies(
    taskPaths: string[],
    parsedTasks: Map<string, ParsedTask>
  ): TaskDependency[] {
    const dependencies: TaskDependency[] = [];

    for (let i = 0; i < taskPaths.length; i++) {
      const taskA = parsedTasks.get(taskPaths[i])!;
      const conflicts: string[] = [];
      const reasons: string[] = [];

      for (let j = 0; j < taskPaths.length; j++) {
        if (i === j) continue;
        const taskB = parsedTasks.get(taskPaths[j])!;

        // Check if any allowed path in A overlaps with any allowed path in B
        const overlap = this.findScopeOverlap(taskA.scope.allowed, taskB.scope.allowed);
        if (overlap) {
          conflicts.push(taskPaths[j]);
          reasons.push(overlap);
        }
      }

      if (conflicts.length > 0) {
        dependencies.push({
          taskPath: taskPaths[i],
          dependsOn: conflicts,
          reason: reasons.join('; '),
        });
      }
    }

    return dependencies;
  }

  /**
   * Checks if two sets of allowed paths overlap.
   */
  private findScopeOverlap(pathsA: string[], pathsB: string[]): string | null {
    for (const a of pathsA) {
      for (const b of pathsB) {
        // Normalize patterns by removing glob suffixes for comparison
        const baseA = a.replace(/\/?\*\*.*$/, '').replace(/\/\*$/, '');
        const baseB = b.replace(/\/?\*\*.*$/, '').replace(/\/\*$/, '');

        if (!baseA || !baseB) continue;

        // Check if one is a prefix of the other
        if (baseA.startsWith(baseB) || baseB.startsWith(baseA)) {
          return `${a} overlaps with ${b}`;
        }

        // Check via glob matching
        if (matchesPattern(baseA, [b]) || matchesPattern(baseB, [a])) {
          return `${a} overlaps with ${b}`;
        }
      }
    }
    return null;
  }

  /**
   * Builds execution order. Tasks with dependencies on each other
   * are serialized (later index runs after earlier), while independent
   * tasks can run in parallel.
   */
  private buildExecutionOrder(
    taskPaths: string[],
    dependencies: TaskDependency[]
  ): string[][] {
    // Build a set of conflicting pairs
    const conflictPairs = new Set<string>();
    for (const dep of dependencies) {
      for (const other of dep.dependsOn) {
        // Create a canonical pair key
        const pair = [dep.taskPath, other].sort().join('::');
        conflictPairs.add(pair);
      }
    }

    if (conflictPairs.size === 0) {
      // No dependencies: all tasks can run in a single batch
      return [taskPaths];
    }

    // Group tasks into waves where no two conflicting tasks are in the same wave
    const waves: string[][] = [];
    const assigned = new Set<string>();

    // Greedy wave assignment: assign tasks in order, putting them in the
    // earliest wave where they don't conflict with already-assigned tasks
    for (const task of taskPaths) {
      let placed = false;
      for (const wave of waves) {
        const hasConflict = wave.some(existing => {
          const pair = [task, existing].sort().join('::');
          return conflictPairs.has(pair);
        });
        if (!hasConflict) {
          wave.push(task);
          placed = true;
          break;
        }
      }
      if (!placed) {
        waves.push([task]);
      }
      assigned.add(task);
    }

    return waves;
  }

  /**
   * Executes task waves with concurrency control within each wave.
   * After each wave, retries tasks that experienced runtime file conflicts.
   */
  private async executeWithConcurrency(
    waves: string[][],
    parsedTasks: Map<string, ParsedTask>
  ): Promise<void> {
    const maxRetries = 1; // Retry conflicted tasks at most once

    for (let waveIdx = 0; waveIdx < waves.length; waveIdx++) {
      const wave = waves[waveIdx];

      if (waves.length > 1) {
        this.logger.info(`\n--- Wave ${waveIdx + 1}/${waves.length} (${wave.length} tasks) ---`);
      }

      // Execute tasks in this wave with concurrency limit
      this.conflictedTasks.clear();
      await this.executeWave(wave, parsedTasks);

      // Retry tasks that had runtime file conflicts (serialized, not parallel)
      if (this.conflictedTasks.size > 0) {
        const retryTasks = [...this.conflictedTasks].filter(taskPath => {
          // Only retry if the task didn't already succeed
          const existingResult = this.results.find(r => r.taskPath === taskPath);
          return existingResult && !existingResult.result.success;
        });

        if (retryTasks.length > 0) {
          this.logger.info(`\n--- Retrying ${retryTasks.length} conflicted task(s) ---`);

          // Remove previous failed results for these tasks (they'll be re-added)
          this.results = this.results.filter(r => !retryTasks.includes(r.taskPath));

          // Execute retries one at a time to avoid re-conflicts
          for (const taskPath of retryTasks) {
            const colorIdx = wave.indexOf(taskPath) % TASK_COLORS.length;
            await this.executeOneTask(
              taskPath,
              parsedTasks.get(taskPath)!,
              TASK_COLORS[Math.max(0, colorIdx)]
            );
          }
        }
      }
    }
  }

  /**
   * Executes a single wave of tasks with concurrency limiting.
   */
  private async executeWave(
    taskPaths: string[],
    parsedTasks: Map<string, ParsedTask>
  ): Promise<void> {
    const concurrency = this.options.concurrency;
    let running = 0;
    let nextIdx = 0;

    return new Promise<void>((resolve) => {
      const tryNext = () => {
        while (running < concurrency && nextIdx < taskPaths.length) {
          const taskPath = taskPaths[nextIdx];
          const colorIdx = nextIdx % TASK_COLORS.length;
          nextIdx++;
          running++;

          this.executeOneTask(taskPath, parsedTasks.get(taskPath)!, TASK_COLORS[colorIdx])
            .then(() => {
              running--;
              if (running === 0 && nextIdx >= taskPaths.length) {
                resolve();
              } else {
                tryNext();
              }
            });
        }
      };
      tryNext();
    });
  }

  /**
   * Executes a single task with prefixed output and file conflict tracking.
   */
  private async executeOneTask(
    taskPath: string,
    parsedTask: ParsedTask,
    color: string
  ): Promise<void> {
    const taskName = basename(taskPath, '.md');
    const taskLogger = new Logger({
      verbose: this.options.verbose,
      quiet: this.options.quiet,
      logFormat: this.options.logFormat,
      prefix: taskName,
      prefixColor: color,
    });

    const startedAt = new Date();
    this.options.onTaskStart?.(taskPath);

    taskLogger.info(`Starting: ${parsedTask.goal.slice(0, 80)}`);

    try {
      const result = await executeTask(taskPath, {
        dryRun: this.options.dryRun,
        verbose: this.options.verbose,
        maxIterations: this.options.maxIterations,
        resume: this.options.resume,
        logger: taskLogger,
        onIteration: (state: ExecutorState) => {
          // Check for file conflicts with other running tasks
          const conflicts = this.checkFileConflicts(taskPath, state.filesModified);
          if (conflicts.length > 0) {
            taskLogger.warn(`File conflict detected: ${conflicts.join(', ')}`);
            this.fileConflicts.push(...conflicts);
            // Mark this task for retry after the current wave
            this.conflictedTasks.add(taskPath);
          }

          // Track active files
          for (const file of state.filesModified) {
            this.activeFiles.set(file, taskPath);
          }
        },
      });

      const completedAt = new Date();

      this.results.push({
        taskPath,
        taskName,
        result,
        startedAt,
        completedAt,
      });

      // Clean up active files for this task
      for (const [file, owner] of this.activeFiles.entries()) {
        if (owner === taskPath) {
          this.activeFiles.delete(file);
        }
      }

      const statusIcon = result.success ? chalk.green('OK') : chalk.red('FAIL');
      taskLogger.info(`Finished: ${statusIcon} (${result.iterations} iterations, ${result.filesModified.length} files)`);

      this.options.onTaskComplete?.(taskPath, result);
    } catch (error) {
      const completedAt = new Date();
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';

      this.results.push({
        taskPath,
        taskName,
        result: {
          success: false,
          status: 'failed',
          iterations: 0,
          filesModified: [],
          error: errorMsg,
          taskPath,
        },
        startedAt,
        completedAt,
      });

      taskLogger.error(`Failed: ${errorMsg}`);
    }

    await taskLogger.close();
  }

  /**
   * Checks if any of the files modified by a task conflict with files
   * actively being modified by another running task.
   */
  private checkFileConflicts(taskPath: string, filesModified: string[]): string[] {
    const conflicts: string[] = [];
    for (const file of filesModified) {
      const owner = this.activeFiles.get(file);
      if (owner && owner !== taskPath) {
        conflicts.push(`${file} (also modified by ${basename(owner, '.md')})`);
      }
    }
    return conflicts;
  }

  /**
   * Builds the consolidated result from all individual task results.
   */
  private buildConsolidatedResult(taskPaths: string[]): ParallelExecutionResult {
    const completed = this.results.filter(r => r.result.success).length;
    const failed = this.results.filter(r => r.result.status === 'failed').length;
    const blocked = this.results.filter(r => r.result.status === 'blocked').length;
    const skipped = taskPaths.length - this.results.length;

    const totalIterations = this.results.reduce((sum, r) => sum + r.result.iterations, 0);
    const allFiles = new Set<string>();
    for (const r of this.results) {
      for (const f of r.result.filesModified) {
        allFiles.add(f);
      }
    }

    return {
      success: failed === 0 && blocked === 0 && skipped === 0,
      totalTasks: taskPaths.length,
      completed,
      failed,
      blocked,
      skipped,
      tasks: this.results,
      dependencies: this.dependencies,
      fileConflicts: this.fileConflicts,
      totalIterations,
      totalFilesModified: [...allFiles],
    };
  }

  /**
   * Prints the consolidated execution summary.
   */
  private printSummary(result: ParallelExecutionResult, totalTimeMs: number): void {
    const elapsed = this.formatDuration(totalTimeMs);

    this.logger.info('');
    this.logger.box('Parallel Execution Summary', [
      `Total Tasks: ${result.totalTasks}`,
      `  Completed: ${result.completed}`,
      `  Failed:    ${result.failed}`,
      `  Blocked:   ${result.blocked}`,
      `  Skipped:   ${result.skipped}`,
      '',
      `Total Iterations: ${result.totalIterations}`,
      `Total Files Modified: ${result.totalFilesModified.length}`,
      `File Conflicts: ${result.fileConflicts.length}`,
      `Duration: ${elapsed}`,
    ].join('\n'));

    // Per-task breakdown
    this.logger.info('');
    this.logger.info('Per-task results:');
    for (const task of result.tasks) {
      const statusIcon = task.result.success
        ? chalk.green('COMPLETED')
        : task.result.status === 'blocked'
          ? chalk.yellow('BLOCKED')
          : chalk.red('FAILED');

      const duration = task.completedAt.getTime() - task.startedAt.getTime();
      this.logger.info(
        `  ${task.taskName}: ${statusIcon} | ${task.result.iterations} iterations | ${task.result.filesModified.length} files | ${this.formatDuration(duration)}`
      );

      if (task.result.error) {
        this.logger.error(`    Error: ${task.result.error}`);
      }
    }

    if (result.fileConflicts.length > 0) {
      this.logger.info('');
      this.logger.warn('File conflicts detected during execution:');
      for (const conflict of result.fileConflicts) {
        this.logger.warn(`  - ${conflict}`);
      }
    }

    if (result.totalFilesModified.length > 0) {
      this.logger.info('');
      this.logger.info('All modified files:');
      for (const file of result.totalFilesModified) {
        this.logger.info(chalk.gray(`  - ${file}`));
      }
    }
  }

  private formatDuration(ms: number): string {
    const seconds = Math.round(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  }
}
