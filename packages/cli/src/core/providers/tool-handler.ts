import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { glob } from 'glob';
import { spawn } from 'child_process';

/**
 * Shared tool handler for API providers
 * Extracts common logic to avoid duplication between Anthropic and OpenAI providers
 */
export class ToolHandler {
  private cwd: string;
  private filesChanged: Set<string> = new Set();

  constructor(cwd: string) {
    this.cwd = cwd;
  }

  /**
   * Reset tracked files for new execution
   */
  reset(): void {
    this.filesChanged.clear();
  }

  /**
   * Get list of files changed during execution
   */
  getChangedFiles(): string[] {
    return Array.from(this.filesChanged);
  }

  /**
   * Handle a tool call and return the result
   */
  async handle(name: string, input: Record<string, unknown>): Promise<string> {
    try {
      switch (name) {
        case 'read_file': {
          const path = join(this.cwd, input.path as string);
          const content = await readFile(path, 'utf-8');
          return content;
        }

        case 'write_file': {
          const path = join(this.cwd, input.path as string);
          const dir = dirname(path);
          if (!existsSync(dir)) {
            await mkdir(dir, { recursive: true });
          }
          await writeFile(path, input.content as string);
          this.filesChanged.add(input.path as string);
          return `File written: ${input.path}`;
        }

        case 'list_files': {
          const pattern = (input.pattern as string) || '**/*';
          const basePath = join(this.cwd, input.path as string);
          const files = await glob(pattern, { cwd: basePath });
          return files.join('\n');
        }

        case 'run_command': {
          return await this.runCommand(input.command as string);
        }

        case 'task_complete': {
          return `Task completed: ${input.summary}`;
        }

        case 'task_blocked': {
          return `Task blocked: ${input.reason}`;
        }

        default:
          return `Unknown tool: ${name}`;
      }
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private runCommand(command: string): Promise<string> {
    return new Promise((resolve) => {
      const proc = spawn(command, { cwd: this.cwd, shell: true });
      let output = '';

      proc.stdout?.on('data', (data) => {
        output += data.toString();
      });
      proc.stderr?.on('data', (data) => {
        output += data.toString();
      });

      proc.on('close', (code) => {
        resolve(`Exit code: ${code}\n${output}`);
      });

      proc.on('error', (err) => {
        resolve(`Error: ${err.message}`);
      });
    });
  }
}
