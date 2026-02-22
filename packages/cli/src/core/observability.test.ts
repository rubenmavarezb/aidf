import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type {
  ExecutionReport,
  ValidationRun,
  CIEnvironment,
  PhaseSummary,
} from '../types/index.js';
import { MetricsCollector } from './metrics-collector.js';
import { ReportWriter } from './report-writer.js';
import { escapeCsvValue, exportCsv, exportDetailedCsv } from './csv-export.js';
import { MetricsWebhook } from './metrics-webhook.js';
import { detectCIEnvironment } from '../utils/ci-detect.js';
import { PhaseProfiler } from './phase-profiler.js';
import { lookupCostRates, calculateCost } from '../utils/cost.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockReport(overrides: Partial<ExecutionReport> = {}): ExecutionReport {
  return {
    runId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    taskPath: '.ai/tasks/test-task.md',
    provider: { type: 'claude-cli' },
    cwd: '/test',
    status: 'completed',
    iterations: 3,
    maxIterations: 50,
    timing: {
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      totalDurationMs: 5000,
    },
    files: { modified: ['file1.ts'], created: [], deleted: [], totalCount: 1 },
    ...overrides,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ===========================================================================
// 1. MetricsCollector
// ===========================================================================

describe('MetricsCollector', () => {
  const baseOptions = {
    taskPath: '.ai/tasks/my-task.md',
    provider: { type: 'claude-cli', model: 'claude-sonnet-4' },
    cwd: '/workspace',
    maxIterations: 50,
    scopeMode: 'strict',
  } as const;

  it('generates a valid runId (UUID format)', () => {
    const collector = new MetricsCollector({ ...baseOptions });
    // UUID v4: 8-4-4-4-12 hex chars
    expect(collector.runId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('records phase timing correctly', async () => {
    const collector = new MetricsCollector({ ...baseOptions });
    collector.startPhase('aiExecution');
    await delay(30);
    const elapsed = collector.endPhase('aiExecution');

    expect(elapsed).toBeGreaterThanOrEqual(20);
    const report = collector.toReport();
    expect(report.timing.phases).toBeDefined();
    expect(report.timing.phases!['aiExecution']).toBeGreaterThanOrEqual(20);
  });

  it('accumulates multiple phase entries', async () => {
    const collector = new MetricsCollector({ ...baseOptions });

    collector.startPhase('validation');
    await delay(15);
    collector.endPhase('validation');

    collector.startPhase('validation');
    await delay(15);
    collector.endPhase('validation');

    const report = collector.toReport();
    // Two entries of ~15ms each => accumulated should be >= 25ms
    expect(report.timing.phases!['validation']).toBeGreaterThanOrEqual(25);
  });

  it('records token usage per iteration and accumulates totals', () => {
    const collector = new MetricsCollector({ ...baseOptions });
    collector.recordTokenUsage(1, 1000, 500);
    collector.recordTokenUsage(2, 2000, 800);

    const report = collector.toReport();
    expect(report.tokens).toBeDefined();
    expect(report.tokens!.totalInput).toBe(3000);
    expect(report.tokens!.totalOutput).toBe(1300);
    expect(report.tokens!.totalTokens).toBe(4300);
    expect(report.tokens!.perIteration).toHaveLength(2);
  });

  it('records validation runs', () => {
    const collector = new MetricsCollector({ ...baseOptions });
    const run: ValidationRun = {
      iteration: 1,
      phase: 'pre_commit',
      command: 'pnpm lint',
      passed: true,
      durationMs: 1200,
      exitCode: 0,
    };
    collector.recordValidation(run);
    collector.recordValidation({ ...run, command: 'pnpm typecheck', passed: false, exitCode: 1 });

    const report = collector.toReport();
    expect(report.validation).toBeDefined();
    expect(report.validation!.totalRuns).toBe(2);
    expect(report.validation!.failures).toBe(1);
  });

  it('records scope violations', () => {
    const collector = new MetricsCollector({ ...baseOptions });
    collector.recordScopeViolation(['.env', 'secrets.json']);
    collector.recordScopeViolation(['.env']); // duplicate file

    const report = collector.toReport();
    expect(report.scope).toBeDefined();
    expect(report.scope!.violations).toBe(3);
    // blocked files should deduplicate
    expect(report.scope!.blockedFiles).toEqual(['.env', 'secrets.json']);
  });

  it('records file changes (modified, created, deleted)', () => {
    const collector = new MetricsCollector({ ...baseOptions });
    collector.recordFileChange('src/a.ts', 'modified');
    collector.recordFileChange('src/b.ts', 'created');
    collector.recordFileChange('src/old.ts', 'deleted');

    const report = collector.toReport();
    expect(report.files.modified).toContain('src/a.ts');
    expect(report.files.created).toContain('src/b.ts');
    expect(report.files.deleted).toContain('src/old.ts');
    expect(report.files.totalCount).toBe(3);
  });

  it('toReport() produces a complete ExecutionReport', () => {
    const collector = new MetricsCollector({
      ...baseOptions,
      costRates: { inputPer1M: 3.0, outputPer1M: 15.0 },
    });
    collector.recordTokenUsage(1, 5000, 2000);
    collector.recordFileChange('src/index.ts', 'modified');
    collector.setStatus('completed');

    const report = collector.toReport();

    // Required top-level fields
    expect(report.runId).toBeDefined();
    expect(report.timestamp).toBeDefined();
    expect(report.taskPath).toBe('.ai/tasks/my-task.md');
    expect(report.provider.type).toBe('claude-cli');
    expect(report.cwd).toBe('/workspace');
    expect(report.status).toBe('completed');
    expect(report.maxIterations).toBe(50);

    // Timing
    expect(report.timing.startedAt).toBeDefined();
    expect(report.timing.completedAt).toBeDefined();
    expect(report.timing.totalDurationMs).toBeGreaterThanOrEqual(0);

    // Cost should be calculated
    expect(report.cost).toBeDefined();
    expect(report.cost!.currency).toBe('USD');
    expect(report.cost!.estimatedTotal).toBeGreaterThan(0);

    // Environment
    expect(report.environment).toBeDefined();
    expect(report.environment!.nodeVersion).toMatch(/^v\d+/);
  });

  it('handles zero iterations gracefully', () => {
    const collector = new MetricsCollector({ ...baseOptions });
    const report = collector.toReport();

    expect(report.iterations).toBe(0);
    expect(report.tokens).toBeUndefined();
    expect(report.files.totalCount).toBe(0);
  });

  it('sets task metadata after construction', () => {
    const collector = new MetricsCollector({ ...baseOptions });
    collector.setTaskMetadata({
      taskGoal: 'Refactor auth module',
      taskType: 'refactor',
      roleName: 'developer',
    });

    const report = collector.toReport();
    expect(report.taskGoal).toBe('Refactor auth module');
    expect(report.taskType).toBe('refactor');
    expect(report.roleName).toBe('developer');
  });
});

// ===========================================================================
// 2. ReportWriter
// ===========================================================================

describe('ReportWriter', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'aidf-report-test-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('write/read roundtrip', () => {
    const writer = new ReportWriter({ baseDir: '.ai/reports/', cwd: tmpDir });
    const report = createMockReport();

    const filePath = writer.write(report);
    expect(filePath).toContain('run-');
    expect(filePath).toContain('.json');

    // Read it back
    const loaded = writer.read(report.runId);
    expect(loaded).not.toBeNull();
    expect(loaded!.runId).toBe(report.runId);
    expect(loaded!.status).toBe(report.status);
    expect(loaded!.taskPath).toBe(report.taskPath);
  });

  it('list returns reports sorted by timestamp descending', () => {
    const writer = new ReportWriter({ baseDir: '.ai/reports/', cwd: tmpDir });

    const older = createMockReport({
      timestamp: '2025-06-01T10:00:00.000Z',
    });
    const newer = createMockReport({
      timestamp: '2025-06-01T12:00:00.000Z',
    });

    writer.write(older);
    writer.write(newer);

    const summaries = writer.list();
    expect(summaries).toHaveLength(2);
    // Most recent first
    expect(summaries[0].runId).toBe(newer.runId);
    expect(summaries[1].runId).toBe(older.runId);
  });

  it('list filters by status', () => {
    const writer = new ReportWriter({ baseDir: '.ai/reports/', cwd: tmpDir });

    writer.write(createMockReport({ status: 'completed' }));
    writer.write(createMockReport({ status: 'failed' }));
    writer.write(createMockReport({ status: 'blocked' }));

    const failedOnly = writer.list({ status: 'failed' });
    expect(failedOnly).toHaveLength(1);
    expect(failedOnly[0].status).toBe('failed');
  });

  it('read with partial ID matching', () => {
    const writer = new ReportWriter({ baseDir: '.ai/reports/', cwd: tmpDir });
    const report = createMockReport();
    writer.write(report);

    // Use first 8 chars of runId
    const partialId = report.runId.slice(0, 8);
    const loaded = writer.read(partialId);
    expect(loaded).not.toBeNull();
    expect(loaded!.runId).toBe(report.runId);
  });

  it('aggregate computes correct totals and averages', () => {
    const writer = new ReportWriter({ cwd: tmpDir });

    const reports: ExecutionReport[] = [
      createMockReport({
        status: 'completed',
        iterations: 5,
        timing: { startedAt: '', completedAt: '', totalDurationMs: 10000 },
        tokens: { totalInput: 1000, totalOutput: 500, totalTokens: 1500 },
        cost: { estimatedTotal: 0.10, currency: 'USD' },
        files: { modified: ['a.ts', 'b.ts'], created: [], deleted: [], totalCount: 2 },
      }),
      createMockReport({
        status: 'failed',
        iterations: 2,
        timing: { startedAt: '', completedAt: '', totalDurationMs: 4000 },
        tokens: { totalInput: 800, totalOutput: 300, totalTokens: 1100 },
        cost: { estimatedTotal: 0.05, currency: 'USD' },
        files: { modified: ['a.ts'], created: ['c.ts'], deleted: [], totalCount: 2 },
      }),
    ];

    const agg = writer.aggregate(reports);
    expect(agg.totalRuns).toBe(2);
    expect(agg.successRate).toBe(0.5);
    expect(agg.totalTokens).toBe(2600);
    expect(agg.totalCost).toBeCloseTo(0.15, 5);
    expect(agg.averageIterations).toBe(3.5);
    expect(agg.averageDuration).toBe(7000);
    expect(agg.byStatus).toEqual({ completed: 1, failed: 1 });
    // a.ts appears in both reports
    expect(agg.mostModifiedFiles[0]).toEqual({ file: 'a.ts', count: 2 });
  });
});

// ===========================================================================
// 3. CSV Export
// ===========================================================================

describe('CSV Export', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'aidf-csv-test-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('escapeCsvValue handles commas and quotes', () => {
    expect(escapeCsvValue('hello')).toBe('hello');
    expect(escapeCsvValue('hello, world')).toBe('"hello, world"');
    expect(escapeCsvValue('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvValue('line\nbreak')).toBe('"line\nbreak"');
    expect(escapeCsvValue('')).toBe('""');
  });

  it('exportCsv produces correct header and data rows', () => {
    const outPath = join(tmpDir, 'summary.csv');
    const reports = [createMockReport({ iterations: 7 })];

    exportCsv(reports, outPath);

    const content = readFileSync(outPath, 'utf-8');
    const lines = content.split('\n');

    // Header row
    expect(lines[0]).toContain('run_id');
    expect(lines[0]).toContain('timestamp');
    expect(lines[0]).toContain('status');
    expect(lines[0]).toContain('iterations');
    expect(lines[0]).toContain('provider');

    // Data row
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('completed');
    expect(lines[1]).toContain('7');
    expect(lines[1]).toContain('claude-cli');
  });

  it('exportDetailedCsv produces per-iteration rows', () => {
    const outPath = join(tmpDir, 'detailed.csv');
    const report = createMockReport({
      timing: {
        startedAt: '',
        completedAt: '',
        totalDurationMs: 5000,
        perIteration: [
          { iteration: 1, durationMs: 2000 },
          { iteration: 2, durationMs: 3000 },
        ],
      },
      tokens: {
        totalInput: 3000,
        totalOutput: 1500,
        totalTokens: 4500,
        perIteration: [
          { iteration: 1, input: 1000, output: 600 },
          { iteration: 2, input: 2000, output: 900 },
        ],
      },
    });

    exportDetailedCsv([report], outPath);

    const content = readFileSync(outPath, 'utf-8');
    const lines = content.split('\n');

    // Header + 2 iteration rows
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('run_id');
    expect(lines[0]).toContain('iteration');
    expect(lines[1]).toContain('1000');
    expect(lines[2]).toContain('2000');
  });
});

// ===========================================================================
// 4. MetricsWebhook
// ===========================================================================

describe('MetricsWebhook', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK' });
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends POST with correct headers', async () => {
    const webhook = new MetricsWebhook({
      enabled: true,
      url: 'https://hooks.example.com/aidf',
      headers: { 'Authorization': 'Bearer test-token' },
    });

    const report = createMockReport();
    await webhook.send(report);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://hooks.example.com/aidf');
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(options.headers['X-AIDF-Event']).toBe('completed');
    expect(options.headers['X-AIDF-Run-ID']).toBe(report.runId);
    expect(options.headers['Authorization']).toBe('Bearer test-token');

    const body = JSON.parse(options.body);
    expect(body.runId).toBe(report.runId);
  });

  it('respects events filter (skips non-matching statuses)', async () => {
    const webhook = new MetricsWebhook({
      enabled: true,
      url: 'https://hooks.example.com/aidf',
      events: ['failed'],
    });

    const report = createMockReport({ status: 'completed' });
    await webhook.send(report);

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('retries on failure with exponential backoff', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK' });

    const webhook = new MetricsWebhook({
      enabled: true,
      url: 'https://hooks.example.com/aidf',
      retry: 2,
    });

    const report = createMockReport();
    await webhook.send(report);

    // 1 initial + 2 retries = 3 total
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});

// ===========================================================================
// 5. CI Detection
// ===========================================================================

describe('CI Detection', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    // Clear all CI-related env vars
    delete process.env.CI;
    delete process.env.CONTINUOUS_INTEGRATION;
    delete process.env.GITHUB_ACTIONS;
    delete process.env.GITHUB_RUN_ID;
    delete process.env.GITHUB_REF;
    delete process.env.GITHUB_SHA;
    delete process.env.GITLAB_CI;
    delete process.env.CI_JOB_ID;
    delete process.env.CI_COMMIT_REF_NAME;
    delete process.env.CI_COMMIT_SHA;
    delete process.env.CIRCLECI;
    delete process.env.CIRCLE_BUILD_NUM;
    delete process.env.CIRCLE_BRANCH;
    delete process.env.CIRCLE_SHA1;
    delete process.env.JENKINS_URL;
    delete process.env.BUILD_ID;
    delete process.env.BUILD_NUMBER;
    delete process.env.GIT_BRANCH;
    delete process.env.GIT_COMMIT;
    delete process.env.BITBUCKET_PIPELINE_UUID;
    delete process.env.SYSTEM_TEAMFOUNDATIONCOLLECTIONURI;
    delete process.env.SYSTEM_TEAMPROJECT;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns null when not in CI', () => {
    const result = detectCIEnvironment();
    expect(result).toBeNull();
  });

  it('detects GitHub Actions environment', () => {
    process.env.GITHUB_ACTIONS = 'true';
    process.env.GITHUB_RUN_ID = '12345';
    process.env.GITHUB_REF = 'refs/heads/feat/my-branch';
    process.env.GITHUB_SHA = 'abc123def456';

    const result = detectCIEnvironment();
    expect(result).not.toBeNull();
    expect(result!.ci).toBe(true);
    expect(result!.ciProvider).toBe('github-actions');
    expect(result!.ciBuildId).toBe('12345');
    expect(result!.ciBranch).toBe('feat/my-branch');
    expect(result!.ciCommit).toBe('abc123def456');
  });

  it('detects generic CI environment', () => {
    process.env.CI = 'true';

    const result = detectCIEnvironment();
    expect(result).not.toBeNull();
    expect(result!.ci).toBe(true);
    expect(result!.ciProvider).toBe('unknown');
  });
});

// ===========================================================================
// 6. PhaseProfiler
// ===========================================================================

describe('PhaseProfiler', () => {
  it('tracks phase timing', async () => {
    const profiler = new PhaseProfiler();
    profiler.start('aiExecution');
    await delay(25);
    profiler.end('aiExecution');

    const timings = profiler.getTimings();
    expect(timings['aiExecution']).toBeGreaterThanOrEqual(20);
  });

  it('supports multiple entries for same phase', async () => {
    const profiler = new PhaseProfiler();

    profiler.start('validation');
    await delay(15);
    profiler.end('validation');

    profiler.start('validation');
    await delay(15);
    profiler.end('validation');

    const summaries = profiler.getSummary();
    const validation = summaries.find((s) => s.phase === 'validation');
    expect(validation).toBeDefined();
    expect(validation!.count).toBe(2);
    expect(validation!.totalMs).toBeGreaterThanOrEqual(25);
  });

  it('getSummary returns correct statistics', async () => {
    const profiler = new PhaseProfiler();

    // Phase A: two entries (~20ms and ~10ms)
    profiler.start('phaseA');
    await delay(20);
    profiler.end('phaseA');

    profiler.start('phaseA');
    await delay(10);
    profiler.end('phaseA');

    // Phase B: one entry (~15ms)
    profiler.start('phaseB');
    await delay(15);
    profiler.end('phaseB');

    const summaries = profiler.getSummary();
    expect(summaries.length).toBe(2);

    const phaseA = summaries.find((s) => s.phase === 'phaseA')!;
    expect(phaseA.count).toBe(2);
    expect(phaseA.totalMs).toBeGreaterThanOrEqual(25);
    expect(phaseA.avgMs).toBeGreaterThanOrEqual(10);
    expect(phaseA.maxMs).toBeGreaterThanOrEqual(phaseA.minMs);
    expect(phaseA.percentage).toBeGreaterThan(0);
    expect(phaseA.percentage).toBeLessThanOrEqual(100);

    const phaseB = summaries.find((s) => s.phase === 'phaseB')!;
    expect(phaseB.count).toBe(1);

    // Percentages should sum to ~100
    const totalPct = summaries.reduce((sum, s) => sum + s.percentage, 0);
    expect(totalPct).toBeCloseTo(100, 0);
  });
});

// ===========================================================================
// 7. Cost Utility
// ===========================================================================

describe('Cost Utility', () => {
  it('looks up rates by model substring', () => {
    const rates = lookupCostRates('claude-sonnet-4-20250514', 'anthropic-api');
    expect(rates).toBeDefined();
    expect(rates!.inputPer1M).toBe(3.0);
    expect(rates!.outputPer1M).toBe(15.0);
  });

  it('falls back to provider-type defaults', () => {
    // Unknown model name, but anthropic provider => claude-sonnet defaults
    const anthropicRates = lookupCostRates(undefined, 'anthropic-api');
    expect(anthropicRates).toBeDefined();
    expect(anthropicRates!.inputPer1M).toBe(3.0);

    // Unknown model, openai provider => gpt-4o defaults
    const openaiRates = lookupCostRates(undefined, 'openai-api');
    expect(openaiRates).toBeDefined();
    expect(openaiRates!.inputPer1M).toBe(2.5);
  });

  it('calculateCost computes correctly', () => {
    const rates = { inputPer1M: 3.0, outputPer1M: 15.0 };
    const cost = calculateCost(1_000_000, 500_000, rates);
    // (1M / 1M) * 3.0 + (500K / 1M) * 15.0 = 3.0 + 7.5 = 10.5
    expect(cost).toBeCloseTo(10.5, 5);
  });
});
