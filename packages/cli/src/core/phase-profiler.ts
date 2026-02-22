import type { PhaseSummary, PhaseTimings } from '../types/index.js';

interface PhaseMetrics {
  totalMs: number;
  count: number;
  durations: number[];
}

/**
 * Lightweight performance profiler for tracking execution phases.
 * Measures timing for nested and repeated phases using performance.now().
 */
export class PhaseProfiler {
  private metrics: Map<string, PhaseMetrics> = new Map();
  private startTimes: Map<string, number> = new Map();
  private grandStartTime: number;

  constructor() {
    this.grandStartTime = performance.now();
  }

  /**
   * Start tracking a phase.
   * Can be called multiple times for the same phase (accumulates).
   */
  start(phase: string): void {
    this.startTimes.set(phase, performance.now());
  }

  /**
   * End tracking a phase and accumulate its duration.
   */
  end(phase: string): void {
    const startTime = this.startTimes.get(phase);
    if (startTime === undefined) {
      return;
    }

    const elapsed = performance.now() - startTime;
    this.startTimes.delete(phase);

    // Initialize metrics if not present
    if (!this.metrics.has(phase)) {
      this.metrics.set(phase, {
        totalMs: 0,
        count: 0,
        durations: [],
      });
    }

    const metric = this.metrics.get(phase)!;
    metric.totalMs += elapsed;
    metric.count += 1;
    metric.durations.push(elapsed);
  }

  /**
   * Get flat map of phase names to cumulative milliseconds.
   */
  getTimings(): PhaseTimings {
    const timings: PhaseTimings = {};
    for (const [phase, metric] of this.metrics) {
      timings[phase] = metric.totalMs;
    }
    return timings;
  }

  /**
   * Get total execution time across all phases.
   */
  getTotalMs(): number {
    let total = 0;
    for (const metric of this.metrics.values()) {
      total += metric.totalMs;
    }
    return total;
  }

  /**
   * Get detailed summary of all phases with statistics.
   */
  getSummary(): PhaseSummary[] {
    const totalMs = this.getTotalMs();
    const summaries: PhaseSummary[] = [];

    for (const [phase, metric] of this.metrics) {
      const avgMs = metric.count > 0 ? metric.totalMs / metric.count : 0;
      const maxMs = metric.durations.length > 0 ? Math.max(...metric.durations) : 0;
      const minMs = metric.durations.length > 0 ? Math.min(...metric.durations) : 0;
      const percentage = totalMs > 0 ? (metric.totalMs / totalMs) * 100 : 0;

      summaries.push({
        phase,
        totalMs: metric.totalMs,
        count: metric.count,
        avgMs,
        maxMs,
        minMs,
        percentage,
      });
    }

    // Sort by totalMs descending for readability
    summaries.sort((a, b) => b.totalMs - a.totalMs);

    return summaries;
  }

  /**
   * Reset all metrics and grand start time.
   */
  reset(): void {
    this.metrics.clear();
    this.startTimes.clear();
    this.grandStartTime = performance.now();
  }
}
