// packages/cli/src/commands/run.ts

import { Command } from 'commander';
import { existsSync } from 'fs';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { executeTask } from '../core/executor.js';
import { ParallelExecutor } from '../core/parallel-executor.js';
import { ContextLoader } from '../core/context-loader.js';
import { Logger } from '../utils/logger.js';
import { LiveStatus } from '../utils/live-status.js';
import type { ExecutorResult, ExecutorState, PhaseEvent } from '../types/index.js';

export function createRunCommand(): Command {
  const cmd = new Command('run')
    .description('Execute a task autonomously')
    .argument('[tasks...]', 'Path(s) to task file(s) (or auto-select first pending)')
    .option('-p, --provider <type>', 'Provider to use (claude-cli, cursor-cli, anthropic-api, openai-api)')
    .option('-m, --max-iterations <n>', 'Maximum iterations', parseInt)
    .option('-d, --dry-run', 'Simulate without executing')
    .option('-v, --verbose', 'Verbose output')
    .option('-q, --quiet', 'Suppress all output')
    .option('--auto-pr', 'Create PR when complete')
    .option('--resume', 'Resume a blocked task')
    .option('--parallel', 'Execute multiple tasks in parallel')
    .option('--concurrency <n>', 'Maximum concurrent tasks (default: 2)', parseInt)
    .option('--log-format <format>', 'Log format (text|json)', 'text')
    .option('--log-file <path>', 'Write logs to file')
    .option('--log-rotate', 'Enable log rotation (append timestamp to filename)')
    .action(async (tasksArg: string[], options) => {
      const logger = new Logger({
        verbose: options.verbose,
        quiet: options.quiet,
        logFormat: options.logFormat as 'text' | 'json' | undefined,
        logFile: options.logFile,
        logRotate: options.logRotate,
      });

      try {
        // Encontrar proyecto AIDF
        const projectRoot = ContextLoader.findAiDir();
        if (!projectRoot) {
          logger.error('No AIDF project found. Run `aidf init` first.');
          process.exit(1);
        }

        // Handle parallel execution
        if (options.parallel) {
          await runParallel(tasksArg, projectRoot, logger, options);
          return;
        }

        // Single task execution (backwards compatible)
        const taskArg = tasksArg.length > 0 ? tasksArg[0] : undefined;

        // Resolver path del task
        const taskPath = await resolveTaskPath(taskArg, projectRoot, logger, options.resume);
        if (!taskPath) {
          if (options.resume) {
            logger.error('No blocked task found to resume.');
          } else {
            logger.error('No task specified and no pending tasks found.');
          }
          process.exit(1);
        }

        logger.info(`Task: ${taskPath}`);

        // Cargar contexto para preview
        const context = await new ContextLoader(projectRoot).loadContext(taskPath);

        // Validar resume si está habilitado
        if (options.resume) {
          if (!context.task.blockedStatus) {
            logger.error('Task is not blocked. Cannot use --resume on a task that is not in BLOCKED status.');
            process.exit(1);
          }
        }

        // Mostrar preview
        const previewLines = [
          `Goal: ${context.task.goal}`,
          `Type: ${context.task.taskType}`,
          `Role: ${context.role.name}`,
          `Scope: ${context.task.scope.allowed.slice(0, 3).join(', ')}${context.task.scope.allowed.length > 3 ? '...' : ''}`,
        ];

        // Agregar información de resume si está habilitado
        if (options.resume && context.task.blockedStatus) {
          const blocked = context.task.blockedStatus;
          previewLines.push(
            '',
            '--- Resume Context ---',
            `Previous Iteration: ${blocked.previousIteration}`,
            `Blocking Issue: ${blocked.blockingIssue.slice(0, 100)}${blocked.blockingIssue.length > 100 ? '...' : ''}`,
            `Files Modified: ${blocked.filesModified.length}`,
          );
        }

        logger.box(options.resume ? 'Resuming Blocked Task' : 'Task Preview', previewLines.join('\n'));

        // Confirmar ejecución
        if (!options.dryRun) {
          const { confirm } = await inquirer.prompt([{
            type: 'confirm',
            name: 'confirm',
            message: 'Start autonomous execution?',
            default: true,
          }]);

          if (!confirm) {
            logger.warn('Aborted.');
            return;
          }
        }

        // Ejecutar
        logger.setContext({ task: taskPath, command: 'run' });
        const maxIterations = options.maxIterations || 50;
        const liveStatus = new LiveStatus(maxIterations, options.quiet);
        liveStatus.start();

        const result = await executeTask(taskPath, {
          dryRun: options.dryRun,
          verbose: options.verbose,
          maxIterations: options.maxIterations,
          resume: options.resume,
          onPhase: (event: PhaseEvent) => {
            if (event.phase === 'Starting iteration') {
              liveStatus.iterationStart(event.iteration, event.totalIterations);
            } else if (event.phase === 'Scope violation' || event.phase === 'Validation failed') {
              liveStatus.phaseFailed(event.phase);
            } else {
              liveStatus.setPhase(event);
            }
          },
          onOutput: (chunk: string) => {
            liveStatus.handleOutput(chunk);
          },
          onIteration: (state: ExecutorState) => {
            logger.setContext({
              task: taskPath,
              iteration: state.iteration,
              files: state.filesModified,
            });
            liveStatus.iterationEnd(
              state.iteration,
              state.filesModified.length,
              true
            );
          },
          onAskUser: async (question: string, files: string[]): Promise<boolean> => {
            liveStatus.complete();
            console.log('\n');
            logger.warn(question);
            console.log(chalk.gray('Files:'), files.join(', '));

            const { approved } = await inquirer.prompt([{
              type: 'confirm',
              name: 'approved',
              message: 'Allow these changes?',
              default: false,
            }]);

            // Restart live status if continuing
            if (approved) {
              const newLiveStatus = new LiveStatus(maxIterations, options.quiet);
              newLiveStatus.start();
            }

            return approved;
          },
        });

        // Mostrar resultado
        liveStatus.complete();

        printResult(result, logger);

        // Auto PR si está habilitado
        if (options.autoPr && result.success) {
          await createPullRequest(context.task.goal, result, logger);
        }

        // Close log file if open
        await logger.close();

        process.exit(result.success ? 0 : 1);

      } catch (error) {
        logger.stopSpinner(false);
        logger.error(error instanceof Error ? error.message : 'Unknown error');
        await logger.close();
        process.exit(1);
      }
    });

  return cmd;
}

async function runParallel(
  tasksArg: string[],
  projectRoot: string,
  logger: Logger,
  options: {
    dryRun?: boolean;
    verbose?: boolean;
    quiet?: boolean;
    maxIterations?: number;
    resume?: boolean;
    concurrency?: number;
    logFormat?: string;
    logFile?: string;
    logRotate?: boolean;
  }
): Promise<void> {
  // Resolve all task paths
  const taskPaths: string[] = [];

  if (tasksArg.length === 0) {
    logger.error('--parallel requires at least 2 task files. Usage: aidf run --parallel task1.md task2.md');
    process.exit(1);
  }

  if (tasksArg.length < 2) {
    logger.error('--parallel requires at least 2 task files. Use `aidf run` for single task execution.');
    process.exit(1);
  }

  for (const taskArg of tasksArg) {
    const fullPath = taskArg.startsWith('/')
      ? taskArg
      : join(process.cwd(), taskArg);

    if (!existsSync(fullPath)) {
      logger.error(`Task file not found: ${fullPath}`);
      process.exit(1);
    }
    taskPaths.push(fullPath);
  }

  // Confirm execution
  if (!options.dryRun) {
    logger.info(`Parallel execution of ${taskPaths.length} tasks:`);
    for (const tp of taskPaths) {
      logger.info(`  - ${tp}`);
    }

    const { confirm } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: `Start parallel execution of ${taskPaths.length} tasks?`,
      default: true,
    }]);

    if (!confirm) {
      logger.warn('Aborted.');
      return;
    }
  }

  const executor = new ParallelExecutor({
    concurrency: options.concurrency || 2,
    dryRun: options.dryRun ?? false,
    verbose: options.verbose ?? false,
    quiet: options.quiet ?? false,
    maxIterations: options.maxIterations,
    resume: options.resume,
    logFormat: options.logFormat as 'text' | 'json' | undefined,
    logFile: options.logFile,
    logRotate: options.logRotate,
  });

  const result = await executor.run(taskPaths);

  await logger.close();
  process.exit(result.success ? 0 : 1);
}

async function resolveTaskPath(
  taskArg: string | undefined,
  projectRoot: string,
  logger: Logger,
  resume: boolean = false
): Promise<string | null> {
  // Si se especificó, usarlo directamente
  if (taskArg) {
    const fullPath = taskArg.startsWith('/')
      ? taskArg
      : join(process.cwd(), taskArg);

    if (!existsSync(fullPath)) {
      logger.error(`Task file not found: ${fullPath}`);
      return null;
    }
    
    // Si es resume, validar que esté bloqueado
    if (resume) {
      const content = await readFile(fullPath, 'utf-8');
      if (!content.includes('## Status:') || !content.includes('BLOCKED')) {
        logger.error(`Task is not blocked. Cannot use --resume on this task.`);
        return null;
      }
    }
    
    return fullPath;
  }

  // Auto-seleccionar primera task pendiente
  const tasksDir = join(projectRoot, '.ai', 'tasks');
  if (!existsSync(tasksDir)) {
    return null;
  }

  // Si es resume, buscar tasks bloqueadas
  if (resume) {
    const blockedTasks = await findTasksInDirs(tasksDir, ['blocked', ''], 'blocked');

    if (blockedTasks.length === 0) {
      logger.error('No blocked tasks found.');
      return null;
    }

    if (blockedTasks.length === 1) {
      return blockedTasks[0];
    }

    logger.warn('Multiple blocked tasks found. Select one to resume:');
    const { selected } = await inquirer.prompt([{
      type: 'list',
      name: 'selected',
      message: 'Select blocked task to resume:',
      choices: blockedTasks.map(t => ({ name: t.split('/').pop()!, value: t })),
    }]);

    return selected;
  }

  // Search pending/ first, then fall back to tasks/ root (backward compat)
  const pendingDir = join(tasksDir, 'pending');
  if (existsSync(pendingDir)) {
    const pendingFiles = await readdir(pendingDir);
    const pendingTasks = pendingFiles
      .filter(f => f.endsWith('.md') && !f.startsWith('.'))
      .sort();

    if (pendingTasks.length > 0) {
      return join(pendingDir, pendingTasks[0]);
    }
  }

  // Fallback: look directly in tasks/ for backward compatibility
  const files = await readdir(tasksDir);
  const taskFiles = files
    .filter(f => f.endsWith('.md') && !f.startsWith('.'))
    .sort();

  // Buscar primera sin status BLOCKED o COMPLETED
  for (const file of taskFiles) {
    const content = await readFile(join(tasksDir, file), 'utf-8');

    if (!content.includes('## Status:')) {
      return join(tasksDir, file);
    }
  }

  if (taskFiles.length === 0) {
    return null;
  }

  // Si todas tienen status, mostrar selector
  logger.warn('All tasks have a status. Select one to run:');
  const { selected } = await inquirer.prompt([{
    type: 'list',
    name: 'selected',
    message: 'Select task:',
    choices: taskFiles,
  }]);

  return join(tasksDir, selected);
}

/**
 * Find task files in multiple directories, optionally filtering by status.
 */
async function findTasksInDirs(
  tasksDir: string,
  subfolders: string[],
  statusFilter?: 'blocked' | 'completed'
): Promise<string[]> {
  const results: string[] = [];

  for (const subfolder of subfolders) {
    const dir = subfolder ? join(tasksDir, subfolder) : tasksDir;
    if (!existsSync(dir)) continue;

    try {
      const files = await readdir(dir);
      const taskFiles = files
        .filter(f => f.endsWith('.md') && !f.startsWith('.'))
        .sort();

      for (const file of taskFiles) {
        const fullPath = join(dir, file);

        if (statusFilter) {
          const content = await readFile(fullPath, 'utf-8');
          if (statusFilter === 'blocked') {
            if (content.includes('## Status:') && content.includes('BLOCKED')) {
              results.push(fullPath);
            }
          } else if (statusFilter === 'completed') {
            if (content.includes('## Status:') && (content.includes('COMPLETED') || content.includes('✅'))) {
              results.push(fullPath);
            }
          }
        } else {
          results.push(fullPath);
        }
      }
    } catch {
      // Ignore errors reading directory
    }
  }

  return results;
}

function printResult(result: ExecutorResult, logger: Logger): void {
  console.log('\n');
  const tokenLine = result.tokenUsage
    ? `Tokens Used: ${(result.tokenUsage.inputTokens + result.tokenUsage.outputTokens).toLocaleString()} (input: ${result.tokenUsage.inputTokens.toLocaleString()} / output: ${result.tokenUsage.outputTokens.toLocaleString()})`
    : '';
  logger.box('Execution Result', [
    `Status: ${result.status}`,
    `Iterations: ${result.iterations}`,
    `Files Modified: ${result.filesModified.length}`,
    tokenLine,
    result.error ? `Error: ${result.error}` : '',
    result.blockedReason ? `Blocked: ${result.blockedReason}` : '',
  ].filter(Boolean).join('\n'));

  if (result.filesModified.length > 0) {
    console.log(chalk.gray('\nModified files:'));
    result.filesModified.forEach(f => console.log(chalk.gray(`  - ${f}`)));
  }

  if (result.blockedReason) {
    console.log('\n');
    logger.warn('Task is blocked. Review the task file for details.');
    logger.info(`Run \`aidf run --resume ${result.taskPath}\` after resolving.`);
  }
}

async function createPullRequest(
  goal: string,
  result: ExecutorResult,
  logger: Logger
): Promise<void> {
  const { spawn } = await import('child_process');

  logger.startSpinner('Creating pull request...');

  const title = goal.slice(0, 70);
  const body = `## Summary
${goal}

## Changes
${result.filesModified.map(f => `- \`${f}\``).join('\n')}

## Execution
- Iterations: ${result.iterations}
- Status: ${result.status}

---
🤖 Generated by AIDF
`;

  return new Promise((resolve, reject) => {
    const proc = spawn('gh', ['pr', 'create', '--title', title, '--body', body], {
      stdio: 'inherit',
    });

    proc.on('close', (code) => {
      if (code === 0) {
        logger.stopSpinner(true, 'Pull request created!');
        resolve();
      } else {
        logger.stopSpinner(false, 'Failed to create PR');
        reject(new Error('gh pr create failed'));
      }
    });
  });
}
