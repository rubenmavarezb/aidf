import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LiveStatus, extractTaskLabel } from './live-status.js';

describe('extractTaskLabel', () => {
  it('should extract task ID from filename', () => {
    expect(extractTaskLabel('080-executor-dependencies-interface.md')).toBe('Task 080');
  });

  it('should extract task ID from full path', () => {
    expect(extractTaskLabel('/path/to/tasks/pending/089-improve-live-status-ux.md')).toBe('Task 089');
  });

  it('should fallback to filename without extension', () => {
    expect(extractTaskLabel('custom-task-name.md')).toBe('custom-task-name');
  });

  it('should handle single number prefix', () => {
    expect(extractTaskLabel('1-quick-fix.md')).toBe('Task 1');
  });
});

describe('LiveStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should create instance with total iterations', () => {
      const status = new LiveStatus(50);
      expect(status).toBeDefined();
    });

    it('should accept quiet mode', () => {
      const status = new LiveStatus(50, true);
      expect(status).toBeDefined();
    });

    it('should accept task label', () => {
      const status = new LiveStatus(50, false, 'Task 089');
      expect(status).toBeDefined();
    });
  });

  describe('start/complete', () => {
    it('should start and stop without errors', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const status = new LiveStatus(50);
      status.start();
      status.complete();
      logSpy.mockRestore();
    });

    it('should print initial status line on start', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const status = new LiveStatus(50);
      status.start();

      expect(logSpy).toHaveBeenCalledTimes(1);
      const call = logSpy.mock.calls[0][0] as string;
      expect(call).toContain('Starting');

      status.complete();
      logSpy.mockRestore();
    });

    it('should include task label in status line when provided', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const status = new LiveStatus(50, false, 'Task 089');
      status.start();

      expect(logSpy).toHaveBeenCalledTimes(1);
      const call = logSpy.mock.calls[0][0] as string;
      expect(call).toContain('Task 089');

      status.complete();
      logSpy.mockRestore();
    });

    it('should not print anything in quiet mode', () => {
      const status = new LiveStatus(50, true);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      status.start();
      vi.advanceTimersByTime(20000);
      status.complete();
      expect(logSpy).not.toHaveBeenCalled();
      logSpy.mockRestore();
    });

    it('should print heartbeat after interval when no output received', () => {
      const status = new LiveStatus(50);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      status.start();
      status.setPhase({ phase: 'Executing AI', iteration: 1, totalIterations: 50, filesModified: 0 });
      // Reset mock to ignore the initial status + phase transition logs
      logSpy.mockClear();

      // Heartbeat interval is 3s — advance just past the first one
      vi.advanceTimersByTime(3000);
      expect(logSpy).toHaveBeenCalledTimes(1);
      const call = logSpy.mock.calls[0][0] as string;
      expect(call).toContain('Iter 1/50');
      expect(call).toContain('Executing AI');

      status.complete();
      logSpy.mockRestore();
    });

    it('should suppress heartbeat when AI output is streaming', () => {
      const status = new LiveStatus(50);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
      status.start();
      status.setPhase({ phase: 'Executing AI', iteration: 1, totalIterations: 50, filesModified: 0 });
      logSpy.mockClear();

      // Simulate AI output at 1s — within 3s window of heartbeat at 3s
      vi.advanceTimersByTime(1000);
      status.handleOutput('some AI output');
      vi.advanceTimersByTime(2000); // now at 3s — heartbeat fires but suppressed (output was 2s ago)

      // Heartbeat should be suppressed (AI output was < 3s ago)
      expect(logSpy).not.toHaveBeenCalled();

      status.complete();
      logSpy.mockRestore();
      writeSpy.mockRestore();
    });
  });

  describe('setPhase', () => {
    it('should print on first phase', () => {
      const status = new LiveStatus(50);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      status.start();
      // Clear the initial status line from start()
      logSpy.mockClear();

      // First phase — should now print
      status.setPhase({ phase: 'Executing AI', iteration: 1, totalIterations: 50, filesModified: 0 });
      expect(logSpy).toHaveBeenCalledTimes(1);
      const call = logSpy.mock.calls[0][0] as string;
      expect(call).toContain('Executing AI');

      status.complete();
      logSpy.mockRestore();
    });

    it('should print on phase transition', () => {
      const status = new LiveStatus(50);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      status.start();
      status.setPhase({ phase: 'Executing AI', iteration: 1, totalIterations: 50, filesModified: 0 });
      logSpy.mockClear();

      // Phase transition — should print
      status.setPhase({ phase: 'Checking scope', iteration: 1, totalIterations: 50, filesModified: 2 });
      expect(logSpy).toHaveBeenCalledTimes(1);
      const call = logSpy.mock.calls[0][0] as string;
      expect(call).toContain('Checking scope');

      status.complete();
      logSpy.mockRestore();
    });

    it('should not print when phase and iteration are the same', () => {
      const status = new LiveStatus(50);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      status.start();
      status.setPhase({ phase: 'Executing AI', iteration: 1, totalIterations: 50, filesModified: 0 });
      logSpy.mockClear();

      // Same phase and iteration — should not print
      status.setPhase({ phase: 'Executing AI', iteration: 1, totalIterations: 50, filesModified: 1 });
      expect(logSpy).not.toHaveBeenCalled();

      status.complete();
      logSpy.mockRestore();
    });

    it('should print when iteration changes even if phase is the same', () => {
      const status = new LiveStatus(50);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      status.start();
      status.setPhase({ phase: 'Executing AI', iteration: 1, totalIterations: 50, filesModified: 0 });
      logSpy.mockClear();

      // Same phase but different iteration — should print
      status.setPhase({ phase: 'Executing AI', iteration: 2, totalIterations: 50, filesModified: 1 });
      expect(logSpy).toHaveBeenCalledTimes(1);
      const call = logSpy.mock.calls[0][0] as string;
      expect(call).toContain('Iter 2/50');
      expect(call).toContain('Executing AI');

      status.complete();
      logSpy.mockRestore();
    });

    it('should not show "0 files" during Executing AI phase', () => {
      const status = new LiveStatus(50);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      status.start();
      logSpy.mockClear();

      status.setPhase({ phase: 'Executing AI', iteration: 1, totalIterations: 50, filesModified: 0 });
      const call = logSpy.mock.calls[0][0] as string;
      expect(call).not.toContain('0 file');

      status.complete();
      logSpy.mockRestore();
    });

    it('should preserve file count from previous phase during Executing AI', () => {
      const status = new LiveStatus(50);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      status.start();

      // First: scope check shows 2 files
      status.setPhase({ phase: 'Checking scope', iteration: 1, totalIterations: 50, filesModified: 2 });
      logSpy.mockClear();

      // Then: new iteration starts AI execution — should still show 2 files
      status.setPhase({ phase: 'Executing AI', iteration: 2, totalIterations: 50, filesModified: 0 });
      const call = logSpy.mock.calls[0][0] as string;
      expect(call).toContain('2 file');

      status.complete();
      logSpy.mockRestore();
    });
  });

  describe('handleOutput', () => {
    it('should write output to stdout', () => {
      const status = new LiveStatus(50);
      const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
      status.handleOutput('hello world');
      expect(writeSpy).toHaveBeenCalledWith('hello world');
      writeSpy.mockRestore();
    });
  });

  describe('phaseComplete', () => {
    it('should log completion message', () => {
      const status = new LiveStatus(50);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      status.phaseComplete('Iteration 1 complete · 2 files');
      expect(logSpy).toHaveBeenCalledTimes(1);
      const call = logSpy.mock.calls[0][0] as string;
      expect(call).toContain('Iteration 1 complete');
      logSpy.mockRestore();
    });

    it('should not log in quiet mode', () => {
      const status = new LiveStatus(50, true);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      status.phaseComplete('done');
      expect(logSpy).not.toHaveBeenCalled();
      logSpy.mockRestore();
    });

    it('should include task label when provided', () => {
      const status = new LiveStatus(50, false, 'Task 080');
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      status.phaseComplete('Iteration 1 complete');
      const call = logSpy.mock.calls[0][0] as string;
      expect(call).toContain('Task 080');
      logSpy.mockRestore();
    });
  });

  describe('phaseFailed', () => {
    it('should log failure message', () => {
      const status = new LiveStatus(50);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      status.phaseFailed('Validation failed');
      expect(logSpy).toHaveBeenCalledTimes(1);
      const call = logSpy.mock.calls[0][0] as string;
      expect(call).toContain('Validation failed');
      logSpy.mockRestore();
    });
  });

  describe('iterationStart', () => {
    it('should log iteration start message', () => {
      const status = new LiveStatus(50);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      status.iterationStart(1, 50);
      expect(logSpy).toHaveBeenCalledTimes(1);
      const call = logSpy.mock.calls[0][0] as string;
      expect(call).toContain('Iter 1/50');
      expect(call).toContain('started');
      logSpy.mockRestore();
    });

    it('should not log in quiet mode', () => {
      const status = new LiveStatus(50, true);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      status.iterationStart(1, 50);
      expect(logSpy).not.toHaveBeenCalled();
      logSpy.mockRestore();
    });
  });

  describe('iterationEnd', () => {
    it('should log successful iteration end', () => {
      const status = new LiveStatus(50);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      status.iterationEnd(1, 3, true);
      expect(logSpy).toHaveBeenCalledTimes(1);
      const call = logSpy.mock.calls[0][0] as string;
      expect(call).toContain('Iter 1 complete');
      expect(call).toContain('3 file');
      logSpy.mockRestore();
    });

    it('should log failed iteration end', () => {
      const status = new LiveStatus(50);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      status.iterationEnd(2, 0, false);
      expect(logSpy).toHaveBeenCalledTimes(1);
      const call = logSpy.mock.calls[0][0] as string;
      expect(call).toContain('Iter 2 complete');
      expect(call).toContain('no files changed');
      logSpy.mockRestore();
    });

    it('should use singular "file" for 1 file', () => {
      const status = new LiveStatus(50);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      status.iterationEnd(1, 1, true);
      const call = logSpy.mock.calls[0][0] as string;
      expect(call).toContain('1 file');
      expect(call).not.toContain('1 files');
      logSpy.mockRestore();
    });

    it('should not log in quiet mode', () => {
      const status = new LiveStatus(50, true);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      status.iterationEnd(1, 0, true);
      expect(logSpy).not.toHaveBeenCalled();
      logSpy.mockRestore();
    });

    it('should include detail suffix when provided', () => {
      const status = new LiveStatus(50);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      status.iterationEnd(1, 2, true, 'TASK_COMPLETE signal detected');
      const call = logSpy.mock.calls[0][0] as string;
      expect(call).toContain('TASK_COMPLETE signal detected');
      logSpy.mockRestore();
    });
  });
});
