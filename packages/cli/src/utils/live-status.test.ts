import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LiveStatus } from './live-status.js';

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
  });

  describe('start/complete', () => {
    it('should start and stop without errors', () => {
      const status = new LiveStatus(50);
      status.start();
      status.complete();
    });

    it('should not print heartbeat in quiet mode', () => {
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
      // Reset mock to ignore the phase transition log
      logSpy.mockClear();

      vi.advanceTimersByTime(15000);
      expect(logSpy).toHaveBeenCalledTimes(1);
      const call = logSpy.mock.calls[0][0] as string;
      expect(call).toContain('Iteration 1/50');
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

      // Simulate AI output at 13s — within 5s window of heartbeat at 15s
      vi.advanceTimersByTime(13000);
      status.handleOutput('some AI output');
      vi.advanceTimersByTime(2000); // now at 15s

      // Heartbeat should be suppressed (AI output was < 5s ago)
      expect(logSpy).not.toHaveBeenCalled();

      status.complete();
      logSpy.mockRestore();
      writeSpy.mockRestore();
    });
  });

  describe('setPhase', () => {
    it('should print on phase transition', () => {
      const status = new LiveStatus(50);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      status.start();

      // First phase — no previous phase, so no print
      status.setPhase({ phase: 'Executing AI', iteration: 1, totalIterations: 50, filesModified: 0 });
      expect(logSpy).not.toHaveBeenCalled();

      // Phase transition — should print
      status.setPhase({ phase: 'Checking scope', iteration: 1, totalIterations: 50, filesModified: 2 });
      expect(logSpy).toHaveBeenCalledTimes(1);
      const call = logSpy.mock.calls[0][0] as string;
      expect(call).toContain('Checking scope');

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
});
