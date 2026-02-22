import fs from 'fs';
import path from 'path';
import {
  ExecutionReport,
  ReportSummary,
  AggregateMetrics,
} from '../types/index.js';

export interface ReportWriterOptions {
  baseDir?: string;
  cwd?: string;
}

export interface ListOptions {
  since?: string | Date;
  until?: string | Date;
  status?: 'completed' | 'blocked' | 'failed';
  task?: string;
}

export class ReportWriter {
  private readonly baseDir: string;
  private readonly cwd: string;

  constructor(options: ReportWriterOptions = {}) {
    this.cwd = options.cwd ?? process.cwd();
    this.baseDir = options.baseDir ?? '.ai/reports/';
  }

  /**
   * Persists an execution report as pretty-printed JSON.
   * Returns the absolute file path of the written report.
   */
  write(report: ExecutionReport): string {
    const date = new Date(report.timestamp);
    const dateDir = this.formatDateDir(date);
    const shortId = report.runId.slice(0, 8);
    const dir = path.resolve(this.cwd, this.baseDir, dateDir);
    const filePath = path.join(dir, `run-${shortId}.json`);

    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2) + '\n', 'utf-8');

    return filePath;
  }

  /**
   * Lists report summaries with optional filtering, sorted by timestamp descending.
   */
  list(options: ListOptions = {}): ReportSummary[] {
    const reportsRoot = path.resolve(this.cwd, this.baseDir);

    if (!fs.existsSync(reportsRoot)) {
      return [];
    }

    const since = options.since ? new Date(options.since).getTime() : undefined;
    const until = options.until ? new Date(options.until).getTime() : undefined;

    const summaries: ReportSummary[] = [];

    const dateDirs = this.readDirSafe(reportsRoot);
    for (const dateDir of dateDirs) {
      const datePath = path.join(reportsRoot, dateDir);
      if (!fs.statSync(datePath).isDirectory()) continue;

      const files = this.readDirSafe(datePath).filter(f => f.startsWith('run-') && f.endsWith('.json'));
      for (const file of files) {
        const filePath = path.join(datePath, file);
        const report = this.readReportFile(filePath);
        if (!report) continue;

        const ts = new Date(report.timestamp).getTime();

        if (since !== undefined && ts < since) continue;
        if (until !== undefined && ts > until) continue;
        if (options.status && report.status !== options.status) continue;
        if (options.task && !report.taskPath.includes(options.task)) continue;

        summaries.push(this.toSummary(report));
      }
    }

    summaries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return summaries;
  }

  /**
   * Reads a specific report by run ID. Supports partial ID matching (minimum 4 chars).
   */
  read(runId: string): ExecutionReport | null {
    const reportsRoot = path.resolve(this.cwd, this.baseDir);

    if (!fs.existsSync(reportsRoot)) {
      return null;
    }

    const shortId = runId.slice(0, 8);

    const dateDirs = this.readDirSafe(reportsRoot);
    for (const dateDir of dateDirs) {
      const datePath = path.join(reportsRoot, dateDir);
      if (!fs.statSync(datePath).isDirectory()) continue;

      const files = this.readDirSafe(datePath).filter(f => f.startsWith('run-') && f.endsWith('.json'));
      for (const file of files) {
        const fileId = file.replace('run-', '').replace('.json', '');
        if (fileId.startsWith(shortId) || shortId.startsWith(fileId)) {
          const report = this.readReportFile(path.join(datePath, file));
          if (report && report.runId.startsWith(runId)) {
            return report;
          }
        }
      }
    }

    return null;
  }

  /**
   * Computes aggregate metrics across a set of reports.
   */
  aggregate(reports: ExecutionReport[]): AggregateMetrics {
    const totalRuns = reports.length;

    if (totalRuns === 0) {
      return {
        totalRuns: 0,
        successRate: 0,
        totalTokens: 0,
        totalCost: 0,
        averageIterations: 0,
        averageDuration: 0,
        byStatus: {},
        mostModifiedFiles: [],
      };
    }

    const completedCount = reports.filter(r => r.status === 'completed').length;
    const successRate = completedCount / totalRuns;

    let totalTokens = 0;
    let totalCost = 0;
    let totalIterations = 0;
    let totalDuration = 0;
    const byStatus: Record<string, number> = {};
    const fileFrequency: Record<string, number> = {};

    for (const report of reports) {
      totalTokens += report.tokens?.totalTokens ?? 0;
      totalCost += report.cost?.estimatedTotal ?? 0;
      totalIterations += report.iterations;
      totalDuration += report.timing.totalDurationMs;

      byStatus[report.status] = (byStatus[report.status] ?? 0) + 1;

      const allFiles = [
        ...report.files.modified,
        ...report.files.created,
      ];
      for (const file of allFiles) {
        fileFrequency[file] = (fileFrequency[file] ?? 0) + 1;
      }
    }

    const mostModifiedFiles = Object.entries(fileFrequency)
      .map(([file, count]) => ({ file, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalRuns,
      successRate,
      totalTokens,
      totalCost,
      averageIterations: totalIterations / totalRuns,
      averageDuration: totalDuration / totalRuns,
      byStatus,
      mostModifiedFiles,
    };
  }

  // -- Private helpers --

  private formatDateDir(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private readDirSafe(dirPath: string): string[] {
    try {
      return fs.readdirSync(dirPath);
    } catch {
      return [];
    }
  }

  private readReportFile(filePath: string): ExecutionReport | null {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as ExecutionReport;
    } catch {
      return null;
    }
  }

  private toSummary(report: ExecutionReport): ReportSummary {
    return {
      runId: report.runId,
      timestamp: report.timestamp,
      taskPath: report.taskPath,
      status: report.status,
      iterations: report.iterations,
      totalTokens: report.tokens?.totalTokens,
      estimatedCost: report.cost?.estimatedTotal,
      durationMs: report.timing.totalDurationMs,
      provider: report.provider.type,
      model: report.provider.model,
      filesModified: report.files.totalCount,
    };
  }
}
