// packages/cli/src/commands/status.ts

import { Command } from 'commander';
import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';
import { simpleGit } from 'simple-git';
import chalk from 'chalk';
import { Logger } from '../utils/logger.js';
import { ContextLoader } from '../core/context-loader.js';
import type { StatusData, TaskStats, LastExecution, AidfConfig } from '../types/index.js';

export function createStatusCommand(): Command {
  const cmd = new Command('status')
    .description('Show dashboard of current AIDF project state')
    .option('--json', 'Output as JSON')
    .option('--log-format <format>', 'Log format (text|json)', 'text')
    .option('--log-file <path>', 'Write logs to file')
    .option('--log-rotate', 'Enable log rotation (append timestamp to filename)')
    .action(async (options) => {
      const logger = new Logger({
        logFormat: options.logFormat as 'text' | 'json' | undefined,
        logFile: options.logFile,
        logRotate: options.logRotate,
      });

      try {
        const projectRoot = ContextLoader.findAiDir();
        if (!projectRoot) {
          logger.error('No AIDF project found. Run `aidf init` first.');
          process.exit(1);
        }

        // Collect all data
        const tasks = await collectTaskStats(projectRoot);
        const lastExecution = await getLastExecution(projectRoot);
        const recentFiles = await getRecentFiles(projectRoot);
        const provider = await getProviderConfig(projectRoot);

        const statusData: StatusData = {
          tasks,
          lastExecution,
          recentFiles,
          provider,
        };

        // Output
        logger.setContext({ command: 'status' });
        if (options.json) {
          printStatusJson(statusData);
        } else {
          printStatusTable(statusData, logger);
        }
        await logger.close();

      } catch (error) {
        logger.error(error instanceof Error ? error.message : 'Unknown error');
        await logger.close();
        process.exit(1);
      }
    });

  return cmd;
}

export async function collectTaskStats(projectRoot: string): Promise<TaskStats> {
  const tasksDir = join(projectRoot, '.ai', 'tasks');
  const stats: TaskStats = {
    pending: 0,
    inProgress: 0,
    completed: 0,
    blocked: 0,
    total: 0,
  };

  try {
    const files = await readdir(tasksDir);
    const taskFiles = files.filter(f => f.endsWith('.md') && !f.startsWith('.'));

    for (const file of taskFiles) {
      const filePath = join(tasksDir, file);
      const content = await readFile(filePath, 'utf-8');

      stats.total++;

      // Check status section
      const statusMatch = content.match(/## Status:[\s\S]*?(?=\n## |$)/i);
      if (!statusMatch) {
        // No status section or status is "Ready"
        if (content.includes('Status: 🔵 Ready') || content.includes('Status: Ready')) {
          stats.pending++;
        } else {
          stats.pending++;
        }
        continue;
      }

      const statusText = statusMatch[0].toLowerCase();

      if (statusText.includes('✅ completed') || statusText.includes('completed')) {
        stats.completed++;
      } else if (statusText.includes('⚠️ blocked') || statusText.includes('blocked')) {
        stats.blocked++;
      } else if (statusText.includes('in progress') || statusText.includes('running')) {
        stats.inProgress++;
      } else {
        stats.pending++;
      }
    }
  } catch {
    // No tasks directory or error reading
  }

  return stats;
}

export async function getLastExecution(projectRoot: string): Promise<LastExecution | null> {
  try {
    const git = simpleGit(projectRoot);

    // Try to load config to get commit prefix
    let commitPrefix = 'aidf:';
    try {
      const config = await loadConfig(projectRoot);
      commitPrefix = config.git?.commit_prefix || 'aidf:';
    } catch {
      // Use default
    }

    // Get commits with the prefix using raw git command
    const logOutput = await git.raw([
      'log',
      '--grep', commitPrefix,
      '--pretty=format:%H|%ai|%s',
      '-n', '1',
    ]);

    if (!logOutput || !logOutput.trim()) {
      // Fallback: check task files for execution metadata
      return await getLastExecutionFromTasks(projectRoot);
    }

    const parts = logOutput.trim().split('|');
    if (parts.length < 3) {
      return await getLastExecutionFromTasks(projectRoot);
    }

    const date = new Date(parts[1]);
    const message = parts[2];

    // Determine result from commit message or status
    let result: 'success' | 'failed' | 'blocked' = 'success';
    if (message.toLowerCase().includes('blocked')) {
      result = 'blocked';
    } else if (message.toLowerCase().includes('failed') || message.toLowerCase().includes('error')) {
      result = 'failed';
    }

    // Try to extract task path from commit or find matching task
    let taskPath: string | undefined;
    const tasksDir = join(projectRoot, '.ai', 'tasks');
    try {
      const files = await readdir(tasksDir);
      for (const file of files.filter(f => f.endsWith('.md'))) {
        const content = await readFile(join(tasksDir, file), 'utf-8');
        if (content.includes(message.slice(0, 50))) {
          taskPath = join(tasksDir, file);
          break;
        }
      }
    } catch {
      // Ignore
    }

    return {
      date,
      result,
      task: taskPath,
    };
  } catch {
    // Git not available or no commits
    return await getLastExecutionFromTasks(projectRoot);
  }
}

async function getLastExecutionFromTasks(projectRoot: string): Promise<LastExecution | null> {
  const tasksDir = join(projectRoot, '.ai', 'tasks');
  let lastExecution: LastExecution | null = null;
  let lastDate: Date | null = null;

  try {
    const files = await readdir(tasksDir);
    for (const file of files.filter(f => f.endsWith('.md'))) {
      const filePath = join(tasksDir, file);
      const content = await readFile(filePath, 'utf-8');
      const stats = await stat(filePath);

      // Check for execution metadata in Status section
      const statusMatch = content.match(/## Status:[\s\S]*?(?=\n## |$)/i);
      if (statusMatch) {
        const statusText = statusMatch[0];
        const dateMatch = statusText.match(/- \*\*Started:\*\* (.+)/i) ||
                         statusText.match(/- \*\*Completed:\*\* (.+)/i) ||
                         statusText.match(/- \*\*Date:\*\* (.+)/i);

        if (dateMatch) {
          const date = new Date(dateMatch[1]);
          if (!lastDate || date > lastDate) {
            lastDate = date;

            let result: 'success' | 'failed' | 'blocked' = 'success';
            if (statusText.includes('BLOCKED') || statusText.includes('blocked')) {
              result = 'blocked';
            } else if (statusText.includes('FAILED') || statusText.includes('failed')) {
              result = 'failed';
            } else if (statusText.includes('COMPLETED') || statusText.includes('✅')) {
              result = 'success';
            }

            // Extract duration if available
            const durationMatch = statusText.match(/- \*\*Duration:\*\* (.+)/i) ||
                                 statusText.match(/- \*\*Time:\*\* (.+)/i);
            const duration = durationMatch ? durationMatch[1].trim() : undefined;

            lastExecution = {
              date,
              duration,
              result,
              task: filePath,
            };
          }
        }
      } else {
        // Use file modification time as fallback
        const fileDate = stats.mtime;
        if (!lastDate || fileDate > lastDate) {
          lastDate = fileDate;
          lastExecution = {
            date: fileDate,
            result: 'success',
            task: filePath,
          };
        }
      }
    }
  } catch {
    // No tasks or error
  }

  return lastExecution;
}

export async function getRecentFiles(projectRoot: string): Promise<string[]> {
  try {
    const git = simpleGit(projectRoot);

    // Get files modified in the last 7 days using git log
    const logOutput = await git.raw([
      'log',
      '--since=7 days ago',
      '--name-only',
      '--pretty=format:',
      '--diff-filter=ACMR',
    ]);

    const files = new Set<string>();
    if (logOutput) {
      logOutput.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('.ai/') && !trimmed.includes('→')) {
          files.add(trimmed);
        }
      });
    }

    // Also check git status for uncommitted changes
    try {
      const status = await git.status();
      status.files.forEach(file => {
        if (!file.path.startsWith('.ai/')) {
          files.add(file.path);
        }
      });
    } catch {
      // Ignore
    }

    // Return top 10 most recent
    return Array.from(files).slice(0, 10);
  } catch {
    // Git not available, return empty
    return [];
  }
}

export async function getProviderConfig(projectRoot: string): Promise<{ type: string; model?: string }> {
  try {
    const config = await loadConfig(projectRoot);
    return {
      type: config.provider.type || (config.provider as Record<string, unknown>).default as string || 'claude-cli',
      model: config.provider.model,
    };
  } catch {
    // Return default
    return {
      type: 'claude-cli',
    };
  }
}

async function loadConfig(projectRoot: string): Promise<AidfConfig> {
  const fs = await import('fs');
  const yaml = await import('yaml');

  const possiblePaths = [
    join(projectRoot, '.ai', 'config.yml'),
    join(projectRoot, '.ai', 'config.yaml'),
    join(projectRoot, '.ai', 'config.json'),
  ];

  for (const configPath of possiblePaths) {
    if (fs.existsSync(configPath)) {
      const content = await (await import('fs/promises')).readFile(configPath, 'utf-8');
      if (configPath.endsWith('.json')) {
        return JSON.parse(content);
      }
      return yaml.parse(content);
    }
  }

  // Return default config
  return {
    version: 1,
    provider: { type: 'claude-cli' },
    execution: {
      max_iterations: 50,
      max_consecutive_failures: 3,
      timeout_per_iteration: 300,
    },
    permissions: {
      scope_enforcement: 'ask',
      auto_commit: true,
      auto_push: false,
      auto_pr: false,
    },
    validation: {
      pre_commit: [],
      pre_push: [],
      pre_pr: [],
    },
    git: {
      commit_prefix: 'aidf:',
      branch_prefix: 'aidf/',
    },
  };
}

export function printStatusTable(data: StatusData, logger: Logger): void {
  console.log('\n');
  logger.box('AIDF Status Dashboard', [
    '',
    chalk.bold('Tasks:'),
    `  ${chalk.yellow('○')} Pending:     ${chalk.white(data.tasks.pending)}`,
    `  ${chalk.blue('⟳')} In Progress:  ${chalk.white(data.tasks.inProgress)}`,
    `  ${chalk.green('✓')} Completed:   ${chalk.white(data.tasks.completed)}`,
    `  ${chalk.red('⚠')} Blocked:      ${chalk.white(data.tasks.blocked)}`,
    `  ${chalk.gray('─')} Total:        ${chalk.white(data.tasks.total)}`,
    '',
    chalk.bold('Last Execution:'),
    data.lastExecution
      ? [
          `  Date:    ${chalk.gray(data.lastExecution.date.toLocaleString())}`,
          data.lastExecution.duration
            ? `  Duration: ${chalk.gray(data.lastExecution.duration)}`
            : '',
          `  Result:  ${
            data.lastExecution.result === 'success'
              ? chalk.green('✓ Success')
              : data.lastExecution.result === 'blocked'
              ? chalk.red('⚠ Blocked')
              : chalk.yellow('✗ Failed')
          }`,
          data.lastExecution.task
            ? `  Task:    ${chalk.gray(data.lastExecution.task.replace(process.cwd(), '.'))}`
            : '',
        ]
          .filter(Boolean)
          .join('\n')
      : '  No executions found',
    '',
    chalk.bold('Recent Files:'),
    data.recentFiles.length > 0
      ? data.recentFiles
          .slice(0, 10)
          .map(f => `  ${chalk.gray('•')} ${chalk.white(f)}`)
          .join('\n')
      : '  No recent files',
    '',
    chalk.bold('Provider:'),
    `  Type:  ${chalk.cyan(data.provider.type)}`,
    data.provider.model ? `  Model: ${chalk.gray(data.provider.model)}` : '',
  ]
    .filter(Boolean)
    .join('\n'));
}

export function printStatusJson(data: StatusData): void {
  const json = {
    tasks: data.tasks,
    lastExecution: data.lastExecution
      ? {
          date: data.lastExecution.date.toISOString(),
          duration: data.lastExecution.duration,
          result: data.lastExecution.result,
          task: data.lastExecution.task,
        }
      : null,
    recentFiles: data.recentFiles,
    provider: data.provider,
  };

  console.log(JSON.stringify(json, null, 2));
}
