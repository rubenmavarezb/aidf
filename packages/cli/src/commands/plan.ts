// packages/cli/src/commands/plan.ts

import { Command } from 'commander';
import { existsSync } from 'fs';
import { readdir, readFile } from 'fs/promises';
import { join, basename, resolve } from 'path';
import chalk from 'chalk';
import { Logger } from '../utils/logger.js';
import { ContextLoader } from '../core/context-loader.js';
import { PlanParser } from '../core/plan-parser.js';
import { PlanExecutor } from '../core/plan-executor.js';
import type { PlanTask } from '../types/index.js';

export function createPlanCommand(): Command {
  const cmd = new Command('plan')
    .description('Manage and execute AIDF plans');

  // Subcommand: run
  cmd
    .command('run <plan>')
    .description('Execute a plan file wave-by-wave')
    .option('-c, --concurrency <n>', 'Max parallel tasks per wave', '3')
    .option('--continue-on-error', 'Continue executing waves after a failure', false)
    .option('--dry-run', 'Parse and display plan without executing', false)
    .option('-v, --verbose', 'Verbose output', false)
    .option('--max-iterations <n>', 'Max iterations per task')
    .option('--provider <type>', 'Override provider type')
    .action(async (planArg: string, options) => {
      const logger = new Logger({ verbose: options.verbose });

      try {
        const projectRoot = ContextLoader.findAiDir();
        if (!projectRoot) {
          logger.error('No AIDF project found. Run `aidf init` first.');
          process.exit(1);
        }

        const planPath = resolvePlanPath(planArg, projectRoot);
        if (!existsSync(planPath)) {
          logger.error(`Plan not found: ${planPath}`);
          process.exit(1);
        }

        const parser = new PlanParser();
        const plan = await parser.parse(planPath, projectRoot);

        if (plan.tasks.length === 0) {
          logger.warn('No task references found in plan file.');
          await logger.close();
          process.exit(0);
        }

        const executor = new PlanExecutor({
          concurrency: parseInt(options.concurrency, 10),
          continueOnError: options.continueOnError,
          dryRun: options.dryRun,
          verbose: options.verbose,
          maxIterations: options.maxIterations ? parseInt(options.maxIterations, 10) : undefined,
          provider: options.provider,
        });

        const result = await executor.run(plan);
        await logger.close();
        process.exit(result.success ? 0 : 1);
      } catch (error) {
        logger.error(error instanceof Error ? error.message : 'Unknown error');
        await logger.close();
        process.exit(1);
      }
    });

  // Subcommand: list
  cmd
    .command('list')
    .alias('ls')
    .description('List all plans in .ai/plans/')
    .action(async () => {
      const logger = new Logger({});

      try {
        const projectRoot = ContextLoader.findAiDir();
        if (!projectRoot) {
          logger.error('No AIDF project found.');
          process.exit(1);
        }

        const plansDir = join(projectRoot, '.ai', 'plans');
        if (!existsSync(plansDir)) {
          logger.info('No plans directory found.');
          await logger.close();
          return;
        }

        const files = await readdir(plansDir);
        const plans = files.filter((f: string) => f.startsWith('PLAN-') && f.endsWith('.md')).sort();

        if (plans.length === 0) {
          logger.info('No plans found.');
          await logger.close();
          return;
        }

        console.log('');
        for (const plan of plans) {
          const planPath = join(plansDir, plan);
          const content = await readFile(planPath, 'utf-8');

          // Count checkboxes
          const total = (content.match(/- \[[ xX]\]\s+`[^`]+\.md`/g) || []).length;
          const completed = (content.match(/- \[[xX]\]\s+`[^`]+\.md`/g) || []).length;

          const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
          const progressBar = renderProgressBar(progress);

          const statusMatch = content.match(/##\s+Status:\s*(.+)/);
          const status = statusMatch ? statusMatch[1].trim() : 'UNKNOWN';

          console.log(`  ${chalk.cyan(basename(plan, '.md'))}`);
          console.log(`    Status: ${status}  |  Tasks: ${completed}/${total}  ${progressBar}`);
          console.log('');
        }

        await logger.close();
      } catch (error) {
        logger.error(error instanceof Error ? error.message : 'Unknown error');
        await logger.close();
        process.exit(1);
      }
    });

  // Subcommand: status
  cmd
    .command('status <plan>')
    .description('Show detailed wave-by-wave plan status')
    .action(async (planArg: string) => {
      const logger = new Logger({});

      try {
        const projectRoot = ContextLoader.findAiDir();
        if (!projectRoot) {
          logger.error('No AIDF project found.');
          process.exit(1);
        }

        const planPath = resolvePlanPath(planArg, projectRoot);
        if (!existsSync(planPath)) {
          logger.error(`Plan not found: ${planPath}`);
          process.exit(1);
        }

        const parser = new PlanParser();
        const plan = await parser.parse(planPath, projectRoot);

        const completed = plan.tasks.filter((t: PlanTask) => t.completed).length;
        const total = plan.tasks.length;
        const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

        logger.box(plan.name, [
          plan.overview ? plan.overview.slice(0, 200) : '',
          '',
          `Progress: ${completed}/${total} tasks (${progress}%)`,
          `Waves: ${plan.waves.length}`,
        ].join('\n'));

        for (const wave of plan.waves) {
          const waveCompleted = wave.tasks.filter((t: PlanTask) => t.completed).length;
          const waveIcon = waveCompleted === wave.tasks.length
            ? chalk.green('DONE')
            : waveCompleted > 0
              ? chalk.yellow('PARTIAL')
              : chalk.gray('PENDING');

          console.log(`\n  ${chalk.bold(`Wave ${wave.number}`)} ${waveIcon} (${waveCompleted}/${wave.tasks.length})`);

          for (const task of wave.tasks) {
            const icon = task.completed ? chalk.green('[x]') : chalk.gray('[ ]');
            const deps = task.dependsOn.length > 0
              ? chalk.gray(` (depends: ${task.dependsOn.join(', ')})`)
              : '';
            console.log(`    ${icon} ${chalk.cyan(task.filename)} — ${task.description.slice(0, 60)}${deps}`);
          }
        }

        console.log('');
        await logger.close();
      } catch (error) {
        logger.error(error instanceof Error ? error.message : 'Unknown error');
        await logger.close();
        process.exit(1);
      }
    });

  return cmd;
}

function resolvePlanPath(planArg: string, projectRoot: string): string {
  // If it's already an absolute path or relative with slashes, resolve directly
  if (planArg.includes('/') || planArg.includes('\\')) {
    return resolve(planArg);
  }

  // Try .ai/plans/ directory
  const plansDir = join(projectRoot, '.ai', 'plans');

  // Try exact match
  const exact = join(plansDir, planArg);
  if (existsSync(exact)) return exact;

  // Try adding .md extension
  const withExt = join(plansDir, planArg.endsWith('.md') ? planArg : `${planArg}.md`);
  if (existsSync(withExt)) return withExt;

  // Try adding PLAN- prefix
  const withPrefix = join(plansDir, `PLAN-${planArg}.md`);
  if (existsSync(withPrefix)) return withPrefix;

  return withExt; // Return best guess for error message
}

function renderProgressBar(percent: number): string {
  const width = 20;
  const filled = Math.round(width * percent / 100);
  const empty = width - filled;
  const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
  return `${bar} ${percent}%`;
}
