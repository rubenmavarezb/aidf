import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync, realpathSync } from 'fs';
import { dirname, join, resolve, isAbsolute } from 'path';
import { glob } from 'glob';
import { spawn } from 'child_process';
import type { CommandPolicy, TaskScope, ScopeMode } from '../../types/index.js';
import { checkFileChange } from '../safety.js';

/**
 * Default blocked patterns — always active, even without configuration.
 * Only clearly destructive commands are blocked.
 */
const DEFAULT_BLOCKED_PATTERNS: RegExp[] = [
  /\brm\s+(-[-\w]*\s+)*-[-\w]*r[-\w]*\s+\/(?:\s|$)/, // rm -rf / and variants
  /\bsudo\b/,                                   // sudo (standalone)
  /\|\s*sudo\b/,                                // pipe to sudo
  /&&\s*sudo\b/,                                // chain to sudo
  /;\s*sudo\b/,                                 // semicolon to sudo
  /\b(curl|wget)\s.*\|\s*(sh|bash|zsh)\b/,      // curl|wget piped to shell
  /\bchmod\s+777\b/,                             // chmod 777
  />\s*\/dev\/sd[a-z]/,                          // > /dev/sda and similar
  /\beval\b/,                                    // eval
  /`[^`]+`/,                                     // backtick execution
  /\$\(/,                                        // $() subshell
];

/**
 * Validate a command against the command policy.
 * Returns null if allowed, or an error message string if blocked.
 */
export function validateCommand(command: string, policy?: CommandPolicy): string | null {
  const trimmed = command.trim();

  // Check user-configured blocked list first
  if (policy?.blocked) {
    for (const blocked of policy.blocked) {
      if (trimmed.includes(blocked)) {
        return `Command blocked by policy: "${trimmed}" matches blocked pattern "${blocked}"`;
      }
    }
  }

  // Check default blocked patterns (always active)
  for (const pattern of DEFAULT_BLOCKED_PATTERNS) {
    if (pattern.test(trimmed)) {
      // Allow if command is explicitly in the allowed list
      if (policy?.allowed) {
        for (const allowed of policy.allowed) {
          if (trimmed === allowed || trimmed.startsWith(allowed + ' ')) {
            return null;
          }
        }
      }
      return `Command blocked by default security policy: "${trimmed}" matches a dangerous pattern`;
    }
  }

  // In strict mode, only allow commands in the allowed list
  if (policy?.strict) {
    if (!policy.allowed || policy.allowed.length === 0) {
      return `Command blocked: strict mode is enabled but no commands are in the allowed list`;
    }
    const isAllowed = policy.allowed.some(
      (allowed) => trimmed === allowed || trimmed.startsWith(allowed + ' ')
    );
    if (!isAllowed) {
      return `Command blocked: "${trimmed}" is not in the allowed list (strict mode)`;
    }
  }

  return null;
}

/**
 * Shared tool handler for API providers
 * Extracts common logic to avoid duplication between Anthropic and OpenAI providers
 */
export class ToolHandler {
  private cwd: string;
  private filesChanged: Set<string> = new Set();
  private commandPolicy?: CommandPolicy;
  private scope?: TaskScope;
  private scopeMode: ScopeMode;

  constructor(cwd: string, commandPolicy?: CommandPolicy, scope?: TaskScope, scopeMode?: ScopeMode) {
    this.cwd = cwd;
    this.commandPolicy = commandPolicy;
    this.scope = scope;
    this.scopeMode = scopeMode ?? 'strict';
  }

  /**
   * Resolves a file path and ensures it does not escape the project root.
   * Returns the resolved absolute path, or an error message string if blocked.
   */
  private resolveSafePath(filePath: string): string | { error: string } {
    const resolved = resolve(this.cwd, filePath);

    // Normalize cwd to real path for comparison
    let normalizedCwd: string;
    try {
      normalizedCwd = realpathSync(this.cwd);
    } catch {
      normalizedCwd = resolve(this.cwd);
    }

    // Check parent directory real path if it exists (catches symlink escapes)
    const parentDir = dirname(resolved);
    let normalizedParent: string;
    try {
      normalizedParent = existsSync(parentDir) ? realpathSync(parentDir) : parentDir;
    } catch {
      normalizedParent = parentDir;
    }

    // The resolved path (or its parent) must be within cwd
    const resolvedNormalized = isAbsolute(filePath) ? resolved : join(normalizedParent, resolved.slice(parentDir.length));
    if (!resolvedNormalized.startsWith(normalizedCwd + '/') && resolvedNormalized !== normalizedCwd) {
      return { error: `Path traversal blocked: "${filePath}" resolves outside project root` };
    }

    return resolved;
  }

  /**
   * Validate file path against task scope before write/delete operations.
   * Read operations are always allowed.
   * Returns null if allowed, or an error message string if blocked.
   */
  private validateScope(filePath: string): string | null {
    if (!this.scope) {
      return null;
    }

    const decision = checkFileChange(filePath, this.scope, this.scopeMode);

    if (decision.action === 'BLOCK') {
      return `SCOPE VIOLATION: Cannot write to "${filePath}". ${decision.reason}.\n\nAllowed paths: ${this.scope.allowed.join(', ') || 'none'}\nForbidden paths: ${this.scope.forbidden.join(', ') || 'none'}\n\nPlease only modify files within the allowed scope.`;
    }

    return null;
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
          const safePath = this.resolveSafePath(input.path as string);
          if (typeof safePath !== 'string') return safePath.error;
          const content = await readFile(safePath, 'utf-8');
          return content;
        }

        case 'write_file': {
          const filePath = input.path as string;
          const safePath = this.resolveSafePath(filePath);
          if (typeof safePath !== 'string') return safePath.error;
          const scopeError = this.validateScope(filePath);
          if (scopeError) {
            return scopeError;
          }
          const dir = dirname(safePath);
          if (!existsSync(dir)) {
            await mkdir(dir, { recursive: true });
          }
          await writeFile(safePath, input.content as string);
          this.filesChanged.add(filePath);
          return `File written: ${filePath}`;
        }

        case 'list_files': {
          const pattern = (input.pattern as string) || '**/*';
          const listPath = (input.path as string) || '.';
          const safePath = this.resolveSafePath(listPath);
          if (typeof safePath !== 'string') return safePath.error;
          const files = await glob(pattern, { cwd: safePath });
          return files.join('\n');
        }

        case 'run_command': {
          const cmd = input.command as string;
          const blocked = validateCommand(cmd, this.commandPolicy);
          if (blocked) {
            return blocked;
          }
          return await this.runCommand(cmd);
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
