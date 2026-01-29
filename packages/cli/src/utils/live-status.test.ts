import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LiveStatus } from './live-status.js';

describe('LiveStatus', () => {
  let originalIsTTY: boolean | undefined;

  beforeEach(() => {
    originalIsTTY = process.stdout.isTTY;
    vi.useFakeTimers();
  });

  afterEach(() => {
    Object.defineProperty(process.stdout, 'isTTY', { value: originalIsTTY, writable: true });
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
      Object.defineProperty(process.stdout, 'isTTY', { value: true, writable: true });
      const status = new LiveStatus(50);
      status.start();
      status.complete();
    });

    it('should not start in quiet mode', () => {
      const status = new LiveStatus(50, true);
      const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
      status.start();
      vi.advanceTimersByTime(200);
      status.complete();
      // In quiet mode, should not write any spinner output
      expect(writeSpy).not.toHaveBeenCalled();
      writeSpy.mockRestore();
    });

    it('should not start in non-TTY', () => {
      Object.defineProperty(process.stdout, 'isTTY', { value: false, writable: true });
      const status = new LiveStatus(50);
      const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
      status.start();
      vi.advanceTimersByTime(200);
      status.complete();
      expect(writeSpy).not.toHaveBeenCalled();
      writeSpy.mockRestore();
    });
  });

  describe('setPhase', () => {
    it('should accept phase events', () => {
      const status = new LiveStatus(50);
      // Should not throw
      status.setPhase({
        phase: 'Executing AI',
        iteration: 3,
        totalIterations: 50,
        filesModified: 2,
      });
    });
  });

  describe('handleOutput', () => {
    it('should write output to stdout in non-TTY mode', () => {
      Object.defineProperty(process.stdout, 'isTTY', { value: false, writable: true });
      const status = new LiveStatus(50);
      const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
      status.handleOutput('hello world');
      expect(writeSpy).toHaveBeenCalledWith('hello world');
      writeSpy.mockRestore();
    });
  });

  describe('phaseComplete', () => {
    it('should log completion message in non-TTY', () => {
      Object.defineProperty(process.stdout, 'isTTY', { value: false, writable: true });
      const status = new LiveStatus(50);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      status.phaseComplete('Iteration 1 complete');
      expect(logSpy).toHaveBeenCalledWith('Iteration 1 complete');
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
    it('should log failure message in non-TTY', () => {
      Object.defineProperty(process.stdout, 'isTTY', { value: false, writable: true });
      const status = new LiveStatus(50);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      status.phaseFailed('Validation failed');
      expect(logSpy).toHaveBeenCalledWith('Validation failed');
      logSpy.mockRestore();
    });
  });
});
