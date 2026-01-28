// packages/cli/src/commands/watch.ts

import { Command } from 'commander';
import { ContextLoader } from '../core/context-loader.js';
import { Watcher } from '../core/watcher.js';
import { Logger } from '../utils/logger.js';

export function createWatchCommand(): Command {
  const cmd = new Command('watch')
    .description('Watch for new/modified tasks and execute them automatically')
    .option('-p, --provider <type>', 'Provider to use (claude-cli, anthropic-api, openai-api)')
    .option('-m, --max-iterations <n>', 'Maximum iterations per task', parseInt)
    .option('-d, --dry-run', 'Simulate without executing')
    .option('-v, --verbose', 'Verbose output')
    .option('-q, --quiet', 'Suppress all output')
    .option('--debounce <ms>', 'Debounce delay in milliseconds', parseInt)
    .option('--daemon', 'Run as daemon (not yet fully implemented)')
    .option('--log-format <format>', 'Log format (text|json)', 'text')
    .option('--log-file <path>', 'Write logs to file')
    .option('--log-rotate', 'Enable log rotation (append timestamp to filename)')
    .action(async (options) => {
      const logger = new Logger({
        verbose: options.verbose,
        quiet: options.quiet,
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

        const watcher = new Watcher(projectRoot, {
          debounceMs: options.debounce,
          daemon: options.daemon,
          verbose: options.verbose,
          quiet: options.quiet,
          logFormat: options.logFormat as 'text' | 'json' | undefined,
          logFile: options.logFile,
          logRotate: options.logRotate,
          dryRun: options.dryRun,
          provider: options.provider,
          maxIterations: options.maxIterations,
        });

        // Graceful shutdown on SIGINT/SIGTERM
        const shutdown = async () => {
          await watcher.stop();
          process.exit(0);
        };

        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);

        await watcher.start();
      } catch (error) {
        logger.error(error instanceof Error ? error.message : 'Unknown error');
        await logger.close();
        process.exit(1);
      }
    });

  return cmd;
}
