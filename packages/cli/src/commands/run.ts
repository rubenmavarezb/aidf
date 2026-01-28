// packages/cli/src/commands/run.ts

import { Command } from 'commander';
import { existsSync } from 'fs';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { Executor, executeTask } from '../core/executor.js';
import { ContextLoader } from '../core/context-loader.js';
import { Logger } from '../utils/logger.js';
import { ProgressBar } from '../utils/progress-bar.js';
import type { ExecutorResult, ExecutorState } from '../types/index.js';

export function createRunCommand(): Command {
  const cmd = new Command('run')
    .description('Execute a task autonomously')
    .argument('[task]', 'Path to task file (or auto-select first pending)')
    .option('-p, --provider <type>', 'Provider to use (claude-cli, anthropic-api, openai-api)')
    .option('-m, --max-iterations <n>', 'Maximum iterations', parseInt)
    .option('-d, --dry-run', 'Simulate without executing')
    .option('-v, --verbose', 'Verbose output')
    .option('-q, --quiet', 'Suppress all output')
    .option('--auto-pr', 'Create PR when complete')
    .option('--resume', 'Resume a blocked task')
    .option('--log-format <format>', 'Log format (text|json)', 'text')
    .option('--log-file <path>', 'Write logs to file')
    .option('--log-rotate', 'Enable log rotation (append timestamp to filename)')
    .action(async (taskArg, options) => {
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
        let progressBar = new ProgressBar(maxIterations, options.quiet);
        let currentIteration = 0;
        let currentFilesModified = 0;

        const result = await executeTask(taskPath, {
          dryRun: options.dryRun,
          verbose: options.verbose,
          maxIterations: options.maxIterations,
          resume: options.resume,
          onIteration: (state: ExecutorState) => {
            currentIteration = state.iteration;
            currentFilesModified = state.filesModified.length;
            logger.setContext({
              task: taskPath,
              iteration: state.iteration,
              files: state.filesModified,
            });
            progressBar.update(
              state.iteration,
              state.filesModified.length,
              state.iteration
            );
          },
          onAskUser: async (question: string, files: string[]): Promise<boolean> => {
            progressBar.complete();
            console.log('\n');
            logger.warn(question);
            console.log(chalk.gray('Files:'), files.join(', '));

            const { approved } = await inquirer.prompt([{
              type: 'confirm',
              name: 'approved',
              message: 'Allow these changes?',
              default: false,
            }]);

            // Restart progress bar if continuing
            if (approved) {
              progressBar = new ProgressBar(maxIterations, options.quiet);
              progressBar.update(currentIteration, currentFilesModified, currentIteration);
            }
            return approved;
          },
        });

        // Mostrar resultado
        progressBar.complete();

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

  const files = await readdir(tasksDir);
  const taskFiles = files
    .filter(f => f.endsWith('.md') && !f.startsWith('.'))
    .sort();

  if (taskFiles.length === 0) {
    return null;
  }

  // Si es resume, filtrar solo tasks bloqueadas
  if (resume) {
    const blockedTasks: string[] = [];
    for (const file of taskFiles) {
      const content = await readFile(join(tasksDir, file), 'utf-8');
      if (content.includes('## Status:') && content.includes('BLOCKED')) {
        blockedTasks.push(file);
      }
    }

    if (blockedTasks.length === 0) {
      logger.error('No blocked tasks found.');
      return null;
    }

    if (blockedTasks.length === 1) {
      return join(tasksDir, blockedTasks[0]);
    }

    // Mostrar selector de tasks bloqueadas
    logger.warn('Multiple blocked tasks found. Select one to resume:');
    const { selected } = await inquirer.prompt([{
      type: 'list',
      name: 'selected',
      message: 'Select blocked task to resume:',
      choices: blockedTasks,
    }]);

    return join(tasksDir, selected);
  }

  // Buscar primera sin status BLOCKED o COMPLETED
  for (const file of taskFiles) {
    const content = await readFile(join(tasksDir, file), 'utf-8');

    if (!content.includes('## Status:')) {
      return join(tasksDir, file);
    }
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

function printResult(result: ExecutorResult, logger: Logger): void {
  console.log('\n');
  logger.box('Execution Result', [
    `Status: ${result.status}`,
    `Iterations: ${result.iterations}`,
    `Files Modified: ${result.filesModified.length}`,
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
