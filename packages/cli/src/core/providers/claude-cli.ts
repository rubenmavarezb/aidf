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
 * Provider that uses Claude Code CLI
 */
export class ClaudeCliProvider implements Provider {
  name = 'claude-cli';
  private cwd: string;

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd;
  }

  /**
   * Check if claude CLI is available
   */
  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn('claude', ['--version'], { shell: true });

      proc.on('close', (code) => {
        resolve(code === 0);
      });

      proc.on('error', () => {
        resolve(false);
      });
    });
  }

  /**
   * Execute a prompt with Claude CLI
   */
  async execute(prompt: string, options: ProviderOptions = {}): Promise<ExecutionResult> {
    const {
      timeout = 600000,
      dangerouslySkipPermissions = false,
    } = options;

    const filesBefore = await detectChangedFiles(this.cwd);

    return new Promise((resolve) => {
      const args: string[] = ['--print'];

      if (dangerouslySkipPermissions) {
        args.push('--dangerously-skip-permissions');
      }

      const proc = spawn('claude', args, {
        cwd: this.cwd,
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        process.stdout.write(chunk);
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
          error: `Failed to execute claude: ${error.message}`,
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
export function createClaudeCliProvider(cwd?: string): Provider {
  return new ClaudeCliProvider(cwd);
}

/**
 * Build the complete prompt for an iteration
 */
export function buildIterationPrompt(context: {
  agents: string;
  role: string;
  task: string;
  plan?: string;
  previousOutput?: string;
  iteration: number;
}): string {
  let prompt = '';

  prompt += `# AIDF Autonomous Execution - Iteration ${context.iteration}\n\n`;
  prompt += `You are executing a task autonomously. Follow the context below.\n\n`;

  prompt += `## Project Context (AGENTS.md)\n\n`;
  prompt += context.agents;
  prompt += '\n\n';

  prompt += `## Your Role\n\n`;
  prompt += context.role;
  prompt += '\n\n';

  prompt += `## Current Task\n\n`;
  prompt += context.task;
  prompt += '\n\n';

  if (context.plan) {
    prompt += `## Implementation Plan\n\n`;
    prompt += context.plan;
    prompt += '\n\n';
  }

  if (context.previousOutput) {
    prompt += `## Previous Iteration Output\n\n`;
    prompt += '```\n';
    prompt += context.previousOutput.slice(-2000);
    prompt += '\n```\n\n';
  }

  prompt += `## Execution Instructions\n\n`;
  prompt += `1. Read the task requirements carefully\n`;
  prompt += `2. Check the Definition of Done criteria\n`;
  prompt += `3. Make necessary code changes\n`;
  prompt += `4. Stay within the allowed scope\n`;
  prompt += `5. When ALL Definition of Done criteria are met, output: <TASK_COMPLETE>\n`;
  prompt += `6. If you encounter a blocker, output: <BLOCKED: reason>\n\n`;

  prompt += `**IMPORTANT:** Only modify files within the allowed scope. `;
  prompt += `Do NOT modify files in the forbidden scope.\n`;

  return prompt;
}
