import { spawn } from 'child_process';
import type { Provider, ExecutionResult, ProviderOptions } from './types.js';
import type { LoadedSkill } from '../../types/index.js';
import { generateSkillsXml } from '../skill-loader.js';
import { ProviderError, TimeoutError, GitError } from '../errors.js';

/**
 * @description Detects files that have been changed in the working directory using git status.
 * Runs `git status --porcelain` and parses the output to extract file paths.
 * @param {string} cwd - The working directory in which to run git status
 * @returns {Promise<string[]>} A promise that resolves to a list of changed file paths
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

    proc.on('error', (error) => {
      // Wrap git errors but still resolve empty to avoid breaking the flow
      // The error is available via GitError.statusFailed if callers need it
      resolve([]);
    });
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

      if (options.sessionContinuation) {
        args.push('--continue');
      }

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
        const err = TimeoutError.iteration(timeout, 0);
        resolve({
          success: false,
          output: stdout,
          error: err.message,
          errorCategory: err.category,
          errorCode: err.code,
          filesChanged: [],
          iterationComplete: false,
        });
      }, timeout);

      proc.on('close', async (code) => {
        clearTimeout(timeoutId);

        const filesAfter = await detectChangedFiles(this.cwd);
        const filesChanged = filesAfter.filter(f => !filesBefore.includes(f));
        const completionSignal = this.detectCompletionSignal(stdout);

        if (code !== 0 && code !== null && stderr) {
          const err = ProviderError.apiError('claude-cli', stderr, code);
          resolve({
            success: false,
            output: stdout,
            error: stderr,
            errorCategory: err.category,
            errorCode: err.code,
            filesChanged,
            iterationComplete: completionSignal !== undefined,
            completionSignal,
          });
        } else {
          resolve({
            success: code === 0,
            output: stdout,
            error: stderr || undefined,
            filesChanged,
            iterationComplete: completionSignal !== undefined,
            completionSignal,
          });
        }
      });

      proc.on('error', (error) => {
        clearTimeout(timeoutId);
        const err = ProviderError.crash('claude-cli', error.message);
        resolve({
          success: false,
          output: '',
          error: err.message,
          errorCategory: err.category,
          errorCode: err.code,
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
  skills?: LoadedSkill[];
  previousOutput?: string;
  previousValidationError?: string;
  iteration: number;
  blockingContext?: {
    previousIteration: number;
    blockingIssue: string;
    filesModified: string[];
  };
}): string {
  let prompt = '';

  prompt += `# AIDF Autonomous Execution - Iteration ${context.iteration}\n\n`;
  
  if (context.blockingContext) {
    prompt += `## Resuming Blocked Task\n\n`;
    prompt += `This task was previously blocked at iteration ${context.blockingContext.previousIteration}.\n\n`;
    prompt += `### Previous Blocking Issue\n\n`;
    prompt += context.blockingContext.blockingIssue;
    prompt += '\n\n';
    prompt += `### Files Modified in Previous Attempt\n\n`;
    if (context.blockingContext.filesModified.length > 0) {
      context.blockingContext.filesModified.forEach(file => {
        prompt += `- \`${file}\`\n`;
      });
    } else {
      prompt += '_None_\n';
    }
    prompt += '\n';
    prompt += `**IMPORTANT**: Review the blocking issue above. The problem has been addressed or guidance provided. Continue from where it left off.\n\n`;
    prompt += `---\n\n`;
  }

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

  if (context.skills && context.skills.length > 0) {
    prompt += `## Available Skills\n\n`;
    prompt += generateSkillsXml(context.skills);
    prompt += '\n\n';
  }

  if (context.previousOutput) {
    prompt += `## Previous Iteration Output\n\n`;
    prompt += '```\n';
    prompt += context.previousOutput.slice(-2000);
    prompt += '\n```\n\n';
  }

  if (context.previousValidationError) {
    prompt += `## Previous Iteration Feedback\n\n`;
    prompt += `⚠ Your previous iteration signaled <TASK_COMPLETE> but validation failed:\n\n`;
    prompt += '```\n';
    prompt += context.previousValidationError;
    prompt += '\n```\n\n';
    prompt += `Please fix the validation errors and signal <TASK_COMPLETE> again when done.\n\n`;
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

/**
 * Build a minimal continuation prompt for iterations 2+.
 * Contains only delta information (validation feedback, iteration number).
 * Static context (AGENTS.md, role, task, plan, skills) is omitted — the
 * provider already has it from the first iteration's conversation.
 */
export function buildContinuationPrompt(context: {
  previousOutput?: string;
  previousValidationError?: string;
  iteration: number;
}): string {
  let prompt = '';

  prompt += `# Continuation — Iteration ${context.iteration}\n\n`;
  prompt += `Continue working on the task from the previous iteration.\n\n`;

  if (context.previousOutput) {
    prompt += `## Previous Iteration Output\n\n`;
    prompt += '```\n';
    prompt += context.previousOutput.slice(-2000);
    prompt += '\n```\n\n';
  }

  if (context.previousValidationError) {
    prompt += `## Previous Iteration Feedback\n\n`;
    prompt += `⚠ Your previous iteration signaled <TASK_COMPLETE> but validation failed:\n\n`;
    prompt += '```\n';
    prompt += context.previousValidationError;
    prompt += '\n```\n\n';
    prompt += `Please fix the validation errors and signal <TASK_COMPLETE> again when done.\n\n`;
  }

  prompt += `## Reminder\n\n`;
  prompt += `- Stay within the allowed scope\n`;
  prompt += `- When ALL Definition of Done criteria are met, output: <TASK_COMPLETE>\n`;
  prompt += `- If you encounter a blocker, output: <BLOCKED: reason>\n`;

  return prompt;
}
