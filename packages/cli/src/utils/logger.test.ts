// packages/cli/src/utils/logger.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Logger } from './logger.js';
import { readFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Logger', () => {
  let testLogDir: string;

  beforeEach(async () => {
    testLogDir = join(tmpdir(), `aidf-logger-test-${Date.now()}`);
    await mkdir(testLogDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test log files
    try {
      const files = await import('fs/promises').then(fs => fs.readdir(testLogDir));
      for (const file of files) {
        await unlink(join(testLogDir, file));
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Text format (default)', () => {
    it('should log info messages in text format', () => {
      const logger = new Logger();
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      logger.info('Test message');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log success messages in text format', () => {
      const logger = new Logger();
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      logger.success('Success message');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log warn messages in text format', () => {
      const logger = new Logger();
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      logger.warn('Warning message');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log error messages in text format', () => {
      const logger = new Logger();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      logger.error('Error message');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log debug messages only when verbose is enabled', () => {
      const logger = new Logger({ verbose: false });
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      logger.debug('Debug message');

      expect(consoleSpy).not.toHaveBeenCalled();

      const verboseLogger = new Logger({ verbose: true });
      verboseLogger.debug('Debug message');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('JSON format', () => {
    it('should produce valid JSON lines', () => {
      const logger = new Logger({ logFormat: 'json' });
      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      logger.info('Test message');

      expect(stdoutSpy).toHaveBeenCalled();
      const call = stdoutSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(call.trim());

      expect(parsed).toHaveProperty('timestamp');
      expect(parsed).toHaveProperty('level', 'info');
      expect(parsed).toHaveProperty('message', 'Test message');
      expect(typeof parsed.timestamp).toBe('string');

      stdoutSpy.mockRestore();
    });

    it('should include context in JSON logs', () => {
      const logger = new Logger({ logFormat: 'json' });
      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      logger.setContext({ task: 'test-task.md', iteration: 1 });
      logger.info('Test message');

      const call = stdoutSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(call.trim());

      expect(parsed.context).toEqual({
        task: 'test-task.md',
        iteration: 1,
      });

      stdoutSpy.mockRestore();
    });

    it('should include all log levels in JSON format', () => {
      const logger = new Logger({ logFormat: 'json', verbose: true });
      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      const levels = ['info', 'success', 'warn', 'error', 'debug'] as const;
      for (const level of levels) {
        logger[level](`${level} message`);
      }

      expect(stdoutSpy).toHaveBeenCalledTimes(levels.length);

      for (let i = 0; i < levels.length; i++) {
        const call = stdoutSpy.mock.calls[i][0] as string;
        const parsed = JSON.parse(call.trim());
        expect(parsed.level).toBe(levels[i]);
      }

      stdoutSpy.mockRestore();
    });

    it('should not include context if empty', () => {
      const logger = new Logger({ logFormat: 'json' });
      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      logger.info('Test message');

      const call = stdoutSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(call.trim());

      expect(parsed.context).toBeUndefined();

      stdoutSpy.mockRestore();
    });
  });

  describe('File output', () => {
    it('should write logs to file', async () => {
      const logFile = join(testLogDir, 'test.log');
      const logger = new Logger({ logFormat: 'text', logFile });

      logger.info('Test message');
      logger.success('Success message');

      await logger.close();

      const content = await readFile(logFile, 'utf-8');
      expect(content).toContain('Test message');
      expect(content).toContain('Success message');
    });

    it('should write JSON logs to file', async () => {
      const logFile = join(testLogDir, 'test.json');
      const logger = new Logger({ logFormat: 'json', logFile });

      logger.setContext({ task: 'test.md', iteration: 1 });
      logger.info('Test message');

      await logger.close();

      const content = await readFile(logFile, 'utf-8');
      const lines = content.trim().split('\n');
      expect(lines.length).toBe(1);

      const parsed = JSON.parse(lines[0]);
      expect(parsed.message).toBe('Test message');
      expect(parsed.context).toEqual({ task: 'test.md', iteration: 1 });
    });

    it('should append to existing log file', async () => {
      const logFile = join(testLogDir, 'append.log');
      const logger1 = new Logger({ logFormat: 'text', logFile });

      logger1.info('First message');
      await logger1.close();

      const logger2 = new Logger({ logFormat: 'text', logFile });
      logger2.info('Second message');
      await logger2.close();

      const content = await readFile(logFile, 'utf-8');
      expect(content).toContain('First message');
      expect(content).toContain('Second message');
    });

    it('should create directory if it does not exist', async () => {
      const logFile = join(testLogDir, 'nested', 'dir', 'test.log');
      const logger = new Logger({ logFormat: 'text', logFile });

      logger.info('Test message');
      await logger.close();

      expect(existsSync(logFile)).toBe(true);
      const content = await readFile(logFile, 'utf-8');
      expect(content).toContain('Test message');
    });
  });

  describe('Log rotation', () => {
    it('should append timestamp to filename when rotation is enabled', async () => {
      const logFile = join(testLogDir, 'rotated.log');
      const logger = new Logger({ logFormat: 'text', logFile, logRotate: true });

      logger.info('Test message');
      await logger.close();

      // Check that a file with timestamp exists
      const files = await import('fs/promises').then(fs => fs.readdir(testLogDir));
      const rotatedFile = files.find(f => f.startsWith('rotated-') && f.endsWith('.log'));

      expect(rotatedFile).toBeDefined();
      if (rotatedFile) {
        const content = await readFile(join(testLogDir, rotatedFile), 'utf-8');
        expect(content).toContain('Test message');
      }
    });
  });

  describe('Context management', () => {
    it('should set and clear context', () => {
      const logger = new Logger({ logFormat: 'json' });
      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      logger.setContext({ task: 'test.md' });
      logger.info('Message 1');

      logger.setContext({ iteration: 2 });
      logger.info('Message 2');

      logger.clearContext();
      logger.info('Message 3');

      const calls = stdoutSpy.mock.calls;
      const parsed1 = JSON.parse((calls[0][0] as string).trim());
      const parsed2 = JSON.parse((calls[1][0] as string).trim());
      const parsed3 = JSON.parse((calls[2][0] as string).trim());

      expect(parsed1.context).toEqual({ task: 'test.md' });
      expect(parsed2.context).toEqual({ task: 'test.md', iteration: 2 });
      expect(parsed3.context).toBeUndefined();

      stdoutSpy.mockRestore();
    });

    it('should merge context on setContext', () => {
      const logger = new Logger({ logFormat: 'json' });
      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      logger.setContext({ task: 'test.md', iteration: 1 });
      logger.setContext({ iteration: 2, files: ['file1.ts'] });
      logger.info('Message');

      const call = stdoutSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(call.trim());

      expect(parsed.context).toEqual({
        task: 'test.md',
        iteration: 2,
        files: ['file1.ts'],
      });

      stdoutSpy.mockRestore();
    });
  });

  describe('Spinner methods', () => {
    it('should emit structured events in JSON mode for spinner', () => {
      const logger = new Logger({ logFormat: 'json' });
      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      logger.startSpinner('Starting...');
      logger.updateSpinner('Processing...');
      logger.stopSpinner(true, 'Done');

      const calls = stdoutSpy.mock.calls;
      expect(calls.length).toBe(3);

      const start = JSON.parse((calls[0][0] as string).trim());
      const update = JSON.parse((calls[1][0] as string).trim());
      const stop = JSON.parse((calls[2][0] as string).trim());

      expect(start.message).toContain('[spinner:start]');
      expect(update.message).toContain('[spinner:update]');
      expect(stop.message).toContain('[spinner:stop]');
      expect(stop.level).toBe('success');

      stdoutSpy.mockRestore();
    });
  });

  describe('Box method', () => {
    it('should emit structured content in JSON mode', () => {
      const logger = new Logger({ logFormat: 'json' });
      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      logger.box('Test Box', 'Line 1\nLine 2');

      const calls = stdoutSpy.mock.calls;
      expect(calls.length).toBeGreaterThan(0);

      const first = JSON.parse((calls[0][0] as string).trim());
      expect(first.message).toContain('[box:Test Box]');

      stdoutSpy.mockRestore();
    });
  });

  describe('Backward compatibility', () => {
    it('should accept boolean for verbose (backward compatibility)', () => {
      const logger = new Logger(true);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      logger.debug('Debug message');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should default to text format when boolean is passed', () => {
      const logger = new Logger(false);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      logger.info('Test');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('jq parseability', () => {
    it('should produce JSON that can be parsed line by line', () => {
      const logger = new Logger({ logFormat: 'json' });
      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      logger.info('Message 1');
      logger.warn('Message 2');
      logger.error('Message 3');

      const calls = stdoutSpy.mock.calls;
      expect(calls.length).toBe(3);

      // Each line should be valid JSON
      for (const call of calls) {
        const line = (call[0] as string).trim();
        expect(() => JSON.parse(line)).not.toThrow();
        const parsed = JSON.parse(line);
        expect(parsed).toHaveProperty('timestamp');
        expect(parsed).toHaveProperty('level');
        expect(parsed).toHaveProperty('message');
      }

      stdoutSpy.mockRestore();
    });

    it('should produce NDJSON format (one JSON object per line)', async () => {
      const logFile = join(testLogDir, 'ndjson.log');
      const logger = new Logger({ logFormat: 'json', logFile });

      logger.info('Message 1');
      logger.info('Message 2');
      logger.info('Message 3');

      await logger.close();

      const content = await readFile(logFile, 'utf-8');
      const lines = content.trim().split('\n');

      expect(lines.length).toBe(3);

      // Each line should be valid JSON
      for (const line of lines) {
        expect(() => JSON.parse(line)).not.toThrow();
      }
    });
  });

  describe('Quiet mode', () => {
    it('should suppress output when quiet is enabled', () => {
      const logger = new Logger({ quiet: true });
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      logger.info('Test');
      logger.success('Test');
      logger.warn('Test');

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should still write to file when quiet is enabled', async () => {
      const logFile = join(testLogDir, 'quiet.log');
      const logger = new Logger({ quiet: true, logFile });

      logger.info('Test message');
      await logger.close();

      const content = await readFile(logFile, 'utf-8');
      expect(content).toContain('Test message');
    });
  });
});
