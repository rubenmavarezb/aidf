import { spawn } from 'child_process';
import type { Provider, ExecutionResult, ProviderOptions } from './types.js';

/**
 * Detects changed files using git status
 */
async function detectChangedFiles(cwd: string): Promise<string[]> {
  return new Promise((resolve) => {
    const proc = spawn('git', ['status', '--porcelain'], { cwd });
    let output = '';

    proc.stdout?.on('data', (data) => {
      output += data.toString();
    });

    proc.on('close', () => {
      const files = output
        .split('\n')
        .filter(line => line.trim())
        .map(line => line.slice(3).trim());
      resolve(files);
    });

    proc.on('error', () => resolve([]));
  });
}

/**
 * Provider that uses Cursor Agent CLI
 */
export class CursorCliProvider implements Provider {
  name = 'cursor-cli';
  private cwd: string;

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd;
  }

  /**
   * Check if agent CLI is available
   */
  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn('agent', ['--version'], { shell: true });

      proc.on('close', (code) => {
        resolve(code === 0);
      });

      proc.on('error', () => {
        resolve(false);
      });
    });
  }

  /**
   * Execute a prompt with Cursor Agent CLI
   */
  async execute(prompt: string, options: ProviderOptions = {}): Promise<ExecutionResult> {
    const {
      timeout = 600000,
    } = options;

    const filesBefore = await detectChangedFiles(this.cwd);

    return new Promise((resolve) => {
      const args: string[] = ['--print'];

      const proc = spawn('agent', args, {
        cwd: this.cwd,
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        if (options.onOutput) {
          options.onOutput(chunk);
        } else {
          process.stdout.write(chunk);
        }
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.stdin?.write(prompt);
      proc.stdin?.end();

      const timeoutId = setTimeout(() => {
        proc.kill('SIGTERM');
        resolve({
          success: false,
          output: stdout,
          error: `Execution timed out after ${timeout}ms`,
          filesChanged: [],
          iterationComplete: false,
        });
      }, timeout);

      proc.on('close', async (code) => {
        clearTimeout(timeoutId);

        const filesAfter = await detectChangedFiles(this.cwd);
        const filesChanged = filesAfter.filter(f => !filesBefore.includes(f));
        const completionSignal = this.detectCompletionSignal(stdout);

        resolve({
          success: code === 0,
          output: stdout,
          error: stderr || undefined,
          filesChanged,
          iterationComplete: completionSignal !== undefined,
          completionSignal,
        });
      });

      proc.on('error', (error) => {
        clearTimeout(timeoutId);
        resolve({
          success: false,
          output: '',
          error: `Failed to execute agent: ${error.message}`,
          filesChanged: [],
          iterationComplete: false,
        });
      });
    });
  }

  /**
   * Detect completion signals in output
   */
  private detectCompletionSignal(output: string): string | undefined {
    const signals = [
      '<TASK_COMPLETE>',
      '<DONE>',
      '## Task Complete',
      '✅ All done',
      'Definition of Done: All criteria met',
    ];

    for (const signal of signals) {
      if (output.includes(signal)) {
        return signal;
      }
    }

    return undefined;
  }
}

/**
 * Factory function
 */
export function createCursorCliProvider(cwd?: string): Provider {
  return new CursorCliProvider(cwd);
}
