// packages/cli/src/commands/report.ts

import { Command } from 'commander';
import { readdirSync, rmSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { Logger } from '../utils/logger.js';
import { ReportWriter } from '../core/report-writer.js';
import { exportCsv, exportDetailedCsv } from '../core/csv-export.js';
import type { ExecutionReport, ReportSummary, AggregateMetrics } from '../types/index.js';

function statusColor(status: string): string {
  switch (status) {
    case 'completed':
      return chalk.green(status);
    case 'failed':
      return chalk.red(status);
    case 'blocked':
      return chalk.yellow(status);
    default:
      return chalk.gray(status);
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

function formatCost(cost?: number): string {
  if (cost == null || cost === 0) return chalk.gray('-');
  return chalk.white(`$${cost.toFixed(4)}`);
}

function formatTokens(tokens?: number): string {
  if (tokens == null || tokens === 0) return chalk.gray('-');
  if (tokens >= 1_000_000) return chalk.white(`${(tokens / 1_000_000).toFixed(1)}M`);
  if (tokens >= 1_000) return chalk.white(`${(tokens / 1_000).toFixed(1)}k`);
  return chalk.white(String(tokens));
}

function shortRunId(runId: string): string {
  return runId.slice(0, 8);
}

function shortTaskPath(taskPath: string): string {
  // Show only the filename or last path segment
  const parts = taskPath.replace(/\\/g, '/').split('/');
  const filename = parts[parts.length - 1] || taskPath;
  return filename.replace(/\.md$/, '');
}

function parseFilterDate(dateStr: string): Date {
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) {
    throw new Error(`Invalid date: "${dateStr}". Use ISO 8601 format (e.g., 2025-01-15).`);
  }
  return parsed;
}

function filterReports(
  reports: ReportSummary[],
  options: { since?: string; until?: string; status?: string; task?: string },
): ReportSummary[] {
  let filtered = reports;

  if (options.since) {
    const since = parseFilterDate(options.since);
    filtered = filtered.filter(r => new Date(r.timestamp) >= since);
  }

  if (options.until) {
    const until = parseFilterDate(options.until);
    filtered = filtered.filter(r => new Date(r.timestamp) <= until);
  }

  if (options.status) {
    const status = options.status.toLowerCase();
    filtered = filtered.filter(r => r.status === status);
  }

  if (options.task) {
    const glob = options.task.toLowerCase();
    filtered = filtered.filter(r => r.taskPath.toLowerCase().includes(glob));
  }

  return filtered;
}

export function createReportCommand(): Command {
  const cmd = new Command('report')
    .description('View and manage execution reports')
    .option('--log-format <format>', 'Log format (text|json)', 'text')
    .option('--log-file <path>', 'Write logs to file')
    .option('--log-rotate', 'Enable log rotation (append timestamp to filename)');

  // --- list subcommand ---
  cmd
    .command('list')
    .description('List recent execution reports')
    .option('--since <date>', 'Show reports after this date (ISO 8601)')
    .option('--until <date>', 'Show reports before this date (ISO 8601)')
    .option('--status <status>', 'Filter by status (completed|blocked|failed)')
    .option('--task <glob>', 'Filter by task path pattern')
    .option('--limit <n>', 'Maximum number of reports to show', '20')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      const parentOpts = cmd.opts();
      const logger = new Logger({
        logFormat: parentOpts.logFormat as 'text' | 'json' | undefined,
        logFile: parentOpts.logFile,
        logRotate: parentOpts.logRotate,
      });

      try {
        const writer = new ReportWriter();
        const allReports = writer.list({});
        const filtered = filterReports(allReports, options);
        const limit = parseInt(options.limit, 10) || 20;
        const reports = filtered.slice(0, limit);

        if (options.json) {
          console.log(JSON.stringify(reports, null, 2));
          await logger.close();
          return;
        }

        if (reports.length === 0) {
          logger.info('No reports found matching the given filters.');
          await logger.close();
          return;
        }

        // Table header
        const header = [
          chalk.bold('Run ID'.padEnd(10)),
          chalk.bold('Date'.padEnd(20)),
          chalk.bold('Task'.padEnd(24)),
          chalk.bold('Status'.padEnd(12)),
          chalk.bold('Iter'.padEnd(6)),
          chalk.bold('Tokens'.padEnd(8)),
          chalk.bold('Cost'.padEnd(10)),
          chalk.bold('Duration'.padEnd(10)),
        ].join('  ');

        const separator = chalk.gray('-'.repeat(110));

        const rows = reports.map((r) => {
          const date = new Date(r.timestamp);
          const dateStr = `${date.toISOString().slice(0, 10)} ${date.toISOString().slice(11, 16)}`;
          return [
            chalk.cyan(shortRunId(r.runId).padEnd(10)),
            chalk.gray(dateStr.padEnd(20)),
            chalk.white(shortTaskPath(r.taskPath).padEnd(24)),
            statusColor(r.status).padEnd(12 + 10), // account for ANSI codes
            chalk.white(String(r.iterations).padEnd(6)),
            formatTokens(r.totalTokens).padEnd(8 + 10),
            formatCost(r.estimatedCost).padEnd(10 + 10),
            chalk.white(formatDuration(r.durationMs).padEnd(10)),
          ].join('  ');
        });

        const content = [
          '',
          `Showing ${reports.length} of ${filtered.length} reports`,
          '',
          header,
          separator,
          ...rows,
          '',
        ].join('\n');

        logger.box('Execution Reports', content);
        await logger.close();
      } catch (error) {
        logger.error(error instanceof Error ? error.message : 'Unknown error');
        await logger.close();
        process.exit(1);
      }
    });

  // --- show subcommand ---
  cmd
    .command('show <run-id>')
    .description('Display detailed report for a specific run')
    .option('--json', 'Output as JSON')
    .action(async (runId: string, options) => {
      const parentOpts = cmd.opts();
      const logger = new Logger({
        logFormat: parentOpts.logFormat as 'text' | 'json' | undefined,
        logFile: parentOpts.logFile,
        logRotate: parentOpts.logRotate,
      });

      try {
        const writer = new ReportWriter();
        const report = writer.read(runId);

        if (!report) {
          logger.error(`Report not found: ${runId}`);
          await logger.close();
          process.exit(1);
        }

        if (options.json) {
          console.log(JSON.stringify(report, null, 2));
          await logger.close();
          return;
        }

        printDetailedReport(report, logger);
        await logger.close();
      } catch (error) {
        logger.error(error instanceof Error ? error.message : 'Unknown error');
        await logger.close();
        process.exit(1);
      }
    });

  // --- summary subcommand ---
  cmd
    .command('summary')
    .description('Aggregate statistics across all (or filtered) reports')
    .option('--since <date>', 'Show reports after this date (ISO 8601)')
    .option('--until <date>', 'Show reports before this date (ISO 8601)')
    .option('--json', 'Output as JSON')
    .option('--csv <path>', 'Export summary to CSV file')
    .action(async (options) => {
      const parentOpts = cmd.opts();
      const logger = new Logger({
        logFormat: parentOpts.logFormat as 'text' | 'json' | undefined,
        logFile: parentOpts.logFile,
        logRotate: parentOpts.logRotate,
      });

      try {
        const writer = new ReportWriter();
        const allReports = writer.list({});
        const filtered = filterReports(allReports, options);

        if (filtered.length === 0) {
          logger.info('No reports found matching the given filters.');
          await logger.close();
          return;
        }

        // Read full reports for aggregation
        const fullReports: ExecutionReport[] = [];
        for (const summary of filtered) {
          const report = writer.read(summary.runId);
          if (report) fullReports.push(report);
        }

        const metrics = writer.aggregate(fullReports);

        if (options.json) {
          console.log(JSON.stringify(metrics, null, 2));
          await logger.close();
          return;
        }

        if (options.csv) {
          exportCsv(fullReports, options.csv);
          logger.success(`Summary exported to ${options.csv}`);
          await logger.close();
          return;
        }

        printSummary(metrics, filtered.length, logger);
        await logger.close();
      } catch (error) {
        logger.error(error instanceof Error ? error.message : 'Unknown error');
        await logger.close();
        process.exit(1);
      }
    });

  // --- export subcommand ---
  cmd
    .command('export')
    .description('Export reports to CSV')
    .requiredOption('--csv <path>', 'Output CSV file path')
    .option('--since <date>', 'Show reports after this date (ISO 8601)')
    .option('--until <date>', 'Show reports before this date (ISO 8601)')
    .option('--detailed', 'Include per-iteration details in CSV')
    .action(async (options) => {
      const parentOpts = cmd.opts();
      const logger = new Logger({
        logFormat: parentOpts.logFormat as 'text' | 'json' | undefined,
        logFile: parentOpts.logFile,
        logRotate: parentOpts.logRotate,
      });

      try {
        const writer = new ReportWriter();
        const allReports = writer.list({});
        const filtered = filterReports(allReports, options);

        if (filtered.length === 0) {
          logger.info('No reports found matching the given filters.');
          await logger.close();
          return;
        }

        // Read full reports for export
        const fullReports: ExecutionReport[] = [];
        for (const summary of filtered) {
          const report = writer.read(summary.runId);
          if (report) fullReports.push(report);
        }

        if (options.detailed) {
          exportDetailedCsv(fullReports, options.csv);
        } else {
          exportCsv(fullReports, options.csv);
        }

        logger.success(`Exported ${filtered.length} reports to ${options.csv}`);
        await logger.close();
      } catch (error) {
        logger.error(error instanceof Error ? error.message : 'Unknown error');
        await logger.close();
        process.exit(1);
      }
    });

  // --- clean subcommand ---
  cmd
    .command('clean')
    .description('Delete reports older than a given date')
    .requiredOption('--before <date>', 'Delete reports before this date (ISO 8601)')
    .option('--confirm', 'Confirm deletion (required)')
    .action(async (options) => {
      const parentOpts = cmd.opts();
      const logger = new Logger({
        logFormat: parentOpts.logFormat as 'text' | 'json' | undefined,
        logFile: parentOpts.logFile,
        logRotate: parentOpts.logRotate,
      });

      try {
        if (!options.confirm) {
          logger.error('The --confirm flag is required to delete reports.');
          logger.info('Run again with --confirm to proceed with deletion.');
          await logger.close();
          process.exit(1);
        }

        const beforeDate = parseFilterDate(options.before);
        const reportsDir = join(process.cwd(), '.ai', 'reports');

        let deletedCount = 0;

        try {
          const entries = readdirSync(reportsDir, { withFileTypes: true });

          for (const entry of entries) {
            if (!entry.isDirectory()) continue;

            // Report directories are named by runId. Read report.json to check timestamp.
            const reportJsonPath = join(reportsDir, entry.name, 'report.json');
            try {
              const { readFileSync } = await import('fs');
              const data = JSON.parse(readFileSync(reportJsonPath, 'utf-8')) as ExecutionReport;
              const reportDate = new Date(data.timestamp);

              if (reportDate < beforeDate) {
                rmSync(join(reportsDir, entry.name), { recursive: true, force: true });
                deletedCount++;
                logger.info(`Deleted report: ${chalk.gray(entry.name)}`);
              }
            } catch {
              // Skip directories without valid report.json
            }
          }
        } catch {
          logger.error(`Reports directory not found: ${reportsDir}`);
          await logger.close();
          process.exit(1);
        }

        if (deletedCount === 0) {
          logger.info(`No reports found before ${options.before}.`);
        } else {
          logger.success(`Deleted ${deletedCount} report(s) before ${options.before}.`);
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

function printDetailedReport(report: ExecutionReport, logger: Logger): void {
  const startDate = new Date(report.timing.startedAt);
  const endDate = new Date(report.timing.completedAt);

  const lines = [
    '',
    chalk.bold('Run Information:'),
    `  Run ID:       ${chalk.cyan(report.runId)}`,
    `  Task:         ${chalk.white(report.taskPath)}`,
    report.taskGoal ? `  Goal:         ${chalk.gray(report.taskGoal)}` : '',
    report.taskType ? `  Type:         ${chalk.gray(report.taskType)}` : '',
    report.roleName ? `  Role:         ${chalk.gray(report.roleName)}` : '',
    `  Provider:     ${chalk.cyan(report.provider.type)}${report.provider.model ? ` (${report.provider.model})` : ''}`,
    report.aidfVersion ? `  AIDF Version: ${chalk.gray(report.aidfVersion)}` : '',
    '',
    chalk.bold('Outcome:'),
    `  Status:       ${statusColor(report.status)}`,
    `  Iterations:   ${chalk.white(report.iterations)} / ${chalk.gray(String(report.maxIterations))}`,
    report.error ? `  Error:        ${chalk.red(report.error)}` : '',
    report.blockedReason ? `  Blocked:      ${chalk.yellow(report.blockedReason)}` : '',
    '',
    chalk.bold('Timing:'),
    `  Started:      ${chalk.gray(startDate.toLocaleString())}`,
    `  Completed:    ${chalk.gray(endDate.toLocaleString())}`,
    `  Duration:     ${chalk.white(formatDuration(report.timing.totalDurationMs))}`,
  ];

  // Phase timings
  if (report.timing.phases) {
    lines.push('', chalk.bold('  Phase Breakdown:'));
    for (const [phase, ms] of Object.entries(report.timing.phases)) {
      if (ms != null && ms > 0) {
        const pct = ((ms / report.timing.totalDurationMs) * 100).toFixed(1);
        lines.push(`    ${phase.padEnd(18)} ${formatDuration(ms).padEnd(10)} ${chalk.gray(`(${pct}%)`)}`);
      }
    }
  }

  // Tokens
  if (report.tokens) {
    lines.push('', chalk.bold('Tokens:'));
    if (report.tokens.contextTokens) {
      lines.push(`  Context:      ${formatTokens(report.tokens.contextTokens)}`);
    }
    if (report.tokens.totalInput) {
      lines.push(`  Input:        ${formatTokens(report.tokens.totalInput)}`);
    }
    if (report.tokens.totalOutput) {
      lines.push(`  Output:       ${formatTokens(report.tokens.totalOutput)}`);
    }
    if (report.tokens.totalTokens) {
      lines.push(`  Total:        ${formatTokens(report.tokens.totalTokens)}`);
    }
  }

  // Cost
  if (report.cost?.estimatedTotal) {
    lines.push('', chalk.bold('Cost:'));
    lines.push(`  Estimated:    ${formatCost(report.cost.estimatedTotal)}`);
    if (report.cost.currency) {
      lines.push(`  Currency:     ${chalk.gray(report.cost.currency)}`);
    }
  }

  // Files
  lines.push('', chalk.bold('Files:'));
  lines.push(`  Total:        ${chalk.white(String(report.files.totalCount))}`);
  if (report.files.modified.length > 0) {
    lines.push(`  Modified:     ${chalk.white(String(report.files.modified.length))}`);
    for (const f of report.files.modified.slice(0, 10)) {
      lines.push(`    ${chalk.gray('M')} ${f}`);
    }
    if (report.files.modified.length > 10) {
      lines.push(chalk.gray(`    ... and ${report.files.modified.length - 10} more`));
    }
  }
  if (report.files.created.length > 0) {
    lines.push(`  Created:      ${chalk.white(String(report.files.created.length))}`);
    for (const f of report.files.created.slice(0, 10)) {
      lines.push(`    ${chalk.green('A')} ${f}`);
    }
    if (report.files.created.length > 10) {
      lines.push(chalk.gray(`    ... and ${report.files.created.length - 10} more`));
    }
  }
  if (report.files.deleted.length > 0) {
    lines.push(`  Deleted:      ${chalk.white(String(report.files.deleted.length))}`);
    for (const f of report.files.deleted.slice(0, 5)) {
      lines.push(`    ${chalk.red('D')} ${f}`);
    }
    if (report.files.deleted.length > 5) {
      lines.push(chalk.gray(`    ... and ${report.files.deleted.length - 5} more`));
    }
  }

  // Validation
  if (report.validation) {
    lines.push('', chalk.bold('Validation:'));
    lines.push(`  Total Runs:   ${chalk.white(String(report.validation.totalRuns))}`);
    lines.push(`  Failures:     ${report.validation.failures > 0 ? chalk.red(String(report.validation.failures)) : chalk.green('0')}`);
    for (const run of report.validation.runs.slice(0, 5)) {
      const icon = run.passed ? chalk.green('PASS') : chalk.red('FAIL');
      lines.push(`    [${icon}] ${run.command} (${formatDuration(run.durationMs)})`);
    }
    if (report.validation.runs.length > 5) {
      lines.push(chalk.gray(`    ... and ${report.validation.runs.length - 5} more`));
    }
  }

  // Scope
  if (report.scope) {
    lines.push('', chalk.bold('Scope:'));
    lines.push(`  Mode:         ${chalk.white(report.scope.mode)}`);
    lines.push(`  Violations:   ${report.scope.violations > 0 ? chalk.red(String(report.scope.violations)) : chalk.green('0')}`);
    if (report.scope.blockedFiles.length > 0) {
      lines.push('  Blocked Files:');
      for (const f of report.scope.blockedFiles.slice(0, 5)) {
        lines.push(`    ${chalk.red('X')} ${f}`);
      }
    }
  }

  // Environment
  if (report.environment) {
    lines.push('', chalk.bold('Environment:'));
    if (report.environment.nodeVersion) lines.push(`  Node:         ${chalk.gray(report.environment.nodeVersion)}`);
    if (report.environment.os) lines.push(`  OS:           ${chalk.gray(report.environment.os)}`);
    if (report.environment.ci) {
      lines.push(`  CI:           ${chalk.cyan('true')}${report.environment.ciProvider ? ` (${report.environment.ciProvider})` : ''}`);
      if (report.environment.ciBranch) lines.push(`  Branch:       ${chalk.gray(report.environment.ciBranch)}`);
      if (report.environment.ciCommit) lines.push(`  Commit:       ${chalk.gray(report.environment.ciCommit)}`);
    }
  }

  lines.push('');

  const content = lines.filter(Boolean).join('\n');
  logger.box(`Report: ${shortRunId(report.runId)}`, content);
}

function printSummary(metrics: AggregateMetrics, totalReports: number, logger: Logger): void {
  const lines = [
    '',
    chalk.bold('Overview:'),
    `  Total Runs:          ${chalk.white(String(metrics.totalRuns))}`,
    `  Success Rate:        ${metrics.successRate >= 0.8 ? chalk.green((metrics.successRate * 100).toFixed(1) + '%') : metrics.successRate >= 0.5 ? chalk.yellow((metrics.successRate * 100).toFixed(1) + '%') : chalk.red((metrics.successRate * 100).toFixed(1) + '%')}`,
    `  Avg Iterations:      ${chalk.white(metrics.averageIterations.toFixed(1))}`,
    `  Avg Duration:        ${chalk.white(formatDuration(metrics.averageDuration))}`,
    '',
    chalk.bold('Tokens & Cost:'),
    `  Total Tokens:        ${formatTokens(metrics.totalTokens)}`,
    `  Total Cost:          ${formatCost(metrics.totalCost)}`,
    '',
    chalk.bold('By Status:'),
  ];

  for (const [status, count] of Object.entries(metrics.byStatus)) {
    const pct = ((count / metrics.totalRuns) * 100).toFixed(1);
    lines.push(`  ${statusColor(status).padEnd(22 + 10)} ${chalk.white(String(count).padEnd(6))} ${chalk.gray(`(${pct}%)`)}`);
  }

  if (metrics.mostModifiedFiles.length > 0) {
    lines.push('', chalk.bold('Most Modified Files:'));
    for (const entry of metrics.mostModifiedFiles.slice(0, 10)) {
      lines.push(`  ${chalk.gray(String(entry.count).padStart(4) + 'x')}  ${entry.file}`);
    }
  }

  lines.push('');

  const content = lines.join('\n');
  logger.box(`Report Summary (${totalReports} reports)`, content);
}
