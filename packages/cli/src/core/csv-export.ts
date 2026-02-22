import { writeFileSync } from 'node:fs';
import { ExecutionReport } from '../types/index.js';

/**
 * Escapes CSV values by wrapping in quotes and escaping internal quotes.
 * Values containing commas, quotes, or newlines are wrapped in double-quotes,
 * and internal double-quotes are escaped by doubling them.
 */
export function escapeCsvValue(value: string): string {
  if (!value) {
    return '""';
  }

  // Check if value contains special characters
  const needsQuoting = value.includes(',') || value.includes('"') || value.includes('\n');

  if (!needsQuoting) {
    return value;
  }

  // Escape internal double-quotes by doubling them, then wrap in quotes
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Exports execution reports to a flat CSV file with one row per run.
 * Columns: run_id, timestamp, task, status, iterations, input_tokens, output_tokens,
 * total_tokens, estimated_cost, duration_seconds, files_modified, provider, model,
 * scope_violations, validation_failures
 */
export function exportCsv(reports: ExecutionReport[], outputPath: string): void {
  if (!reports || reports.length === 0) {
    writeFileSync(outputPath, '', 'utf-8');
    return;
  }

  const headers = [
    'run_id',
    'timestamp',
    'task',
    'status',
    'iterations',
    'input_tokens',
    'output_tokens',
    'total_tokens',
    'estimated_cost',
    'duration_seconds',
    'files_modified',
    'provider',
    'model',
    'scope_violations',
    'validation_failures',
  ];

  const rows: string[] = [headers.join(',')];

  for (const report of reports) {
    const row = [
      escapeCsvValue(report.runId),
      escapeCsvValue(report.timestamp),
      escapeCsvValue(report.taskPath),
      escapeCsvValue(report.status),
      String(report.iterations),
      String(report.tokens?.totalInput ?? ''),
      String(report.tokens?.totalOutput ?? ''),
      String(report.tokens?.totalTokens ?? ''),
      String(report.cost?.estimatedTotal ?? ''),
      String((report.timing.totalDurationMs / 1000).toFixed(2)),
      String(report.files.totalCount),
      escapeCsvValue(report.provider.type),
      escapeCsvValue(report.provider.model ?? ''),
      String(report.scope?.violations ?? 0),
      String(report.validation?.failures ?? 0),
    ];

    rows.push(row.join(','));
  }

  writeFileSync(outputPath, rows.join('\n'), 'utf-8');
}

/**
 * Exports detailed per-iteration CSV data.
 * Columns: run_id, iteration, input_tokens, output_tokens, duration_ms, phase_ai_ms,
 * phase_validation_ms, files_changed
 */
export function exportDetailedCsv(reports: ExecutionReport[], outputPath: string): void {
  if (!reports || reports.length === 0) {
    writeFileSync(outputPath, '', 'utf-8');
    return;
  }

  const headers = [
    'run_id',
    'iteration',
    'input_tokens',
    'output_tokens',
    'duration_ms',
    'phase_ai_ms',
    'phase_validation_ms',
    'files_changed',
  ];

  const rows: string[] = [headers.join(',')];

  for (const report of reports) {
    // If per-iteration data is available, create one row per iteration
    if (report.timing.perIteration && report.timing.perIteration.length > 0) {
      for (const iterationTiming of report.timing.perIteration) {
        const iterationNum = iterationTiming.iteration;

        // Find corresponding token data for this iteration
        let inputTokens = '';
        let outputTokens = '';
        if (report.tokens?.perIteration) {
          const tokenData = report.tokens.perIteration.find(
            t => t.iteration === iterationNum
          );
          if (tokenData) {
            inputTokens = String(tokenData.input);
            outputTokens = String(tokenData.output);
          }
        }

        // Extract phase timings
        const phaseAiMs = iterationTiming.phases?.['execution'] ?? '';
        const phaseValidationMs = iterationTiming.phases?.['validation'] ?? '';

        // Count files modified in this iteration (if available)
        const filesChanged = report.files.totalCount ? String(report.files.totalCount) : '';

        const row = [
          escapeCsvValue(report.runId),
          String(iterationNum),
          inputTokens,
          outputTokens,
          String(iterationTiming.durationMs),
          String(phaseAiMs),
          String(phaseValidationMs),
          filesChanged,
        ];

        rows.push(row.join(','));
      }
    } else {
      // Fallback: create single row with overall data
      const inputTokens = report.tokens?.totalInput ?? '';
      const outputTokens = report.tokens?.totalOutput ?? '';

      const row = [
        escapeCsvValue(report.runId),
        '1',
        String(inputTokens),
        String(outputTokens),
        String(report.timing.totalDurationMs),
        '',
        '',
        String(report.files.totalCount),
      ];

      rows.push(row.join(','));
    }
  }

  writeFileSync(outputPath, rows.join('\n'), 'utf-8');
}
