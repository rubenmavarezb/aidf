import { describe, it, expect } from 'vitest';
import { runCommand, runValidation, Validator } from './validator.js';

describe('runCommand', () => {
  it('should run successful command', async () => {
    const result = await runCommand('echo "hello"', process.cwd());
    expect(result.passed).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('hello');
  });

  it('should capture failed command', async () => {
    const result = await runCommand('exit 1', process.cwd());
    expect(result.passed).toBe(false);
    expect(result.exitCode).toBe(1);
  });

  it('should timeout long commands', async () => {
    const result = await runCommand('sleep 10', process.cwd(), 100);
    expect(result.passed).toBe(false);
    expect(result.output).toContain('timed out');
  });
});

describe('runValidation', () => {
  it('should stop on first failure by default', async () => {
    const results = await runValidation(
      ['exit 1', 'echo "never runs"'],
      'pre_commit',
      process.cwd()
    );
    expect(results.passed).toBe(false);
    expect(results.results).toHaveLength(1);
  });

  it('should continue when stopOnFirst is false', async () => {
    const results = await runValidation(
      ['exit 1', 'echo "runs"'],
      'pre_commit',
      process.cwd(),
      { stopOnFirst: false }
    );
    expect(results.passed).toBe(false);
    expect(results.results).toHaveLength(2);
  });
});

describe('Validator.formatReport', () => {
  it('should format passed summary', () => {
    const report = Validator.formatReport({
      phase: 'pre_commit',
      passed: true,
      results: [{
        command: 'pnpm lint',
        passed: true,
        output: 'All good',
        duration: 1234,
        exitCode: 0,
      }],
      totalDuration: 1234,
    });

    expect(report).toContain('✅');
    expect(report).toContain('PASSED');
    expect(report).toContain('pnpm lint');
  });

  it('should format failed summary with output', () => {
    const report = Validator.formatReport({
      phase: 'pre_commit',
      passed: false,
      results: [{
        command: 'pnpm lint',
        passed: false,
        output: 'Error: something wrong',
        duration: 500,
        exitCode: 1,
      }],
      totalDuration: 500,
    });

    expect(report).toContain('❌');
    expect(report).toContain('FAILED');
    expect(report).toContain('Error: something wrong');
  });
});
