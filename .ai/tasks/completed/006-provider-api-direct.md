# TASK: Implementar Provider API Direct (Anthropic/OpenAI)

## Goal
Crear providers que usan los SDKs de Anthropic y OpenAI directamente para mayor control sobre el contexto y costos.

## Status: ✅ COMPLETED

- **Completed:** 2026-01-27
- **Agent:** Claude Code (main session)
- **Files Created:** anthropic-api.ts, openai-api.ts, tool-handler.ts
- **Note:** Extraje lógica común a tool-handler.ts para evitar duplicación

## Task Type
component

## Suggested Roles
- developer

## Auto-Mode Compatible
✅ **SÍ** - Cursor auto-mode funciona bien. APIs bien documentadas.

## Scope

### Allowed
- `packages/cli/src/core/providers/anthropic-api.ts`
- `packages/cli/src/core/providers/openai-api.ts`
- `packages/cli/src/core/providers/index.ts`
- `packages/cli/src/core/providers/types.ts`

### Forbidden
- `templates/**`
- Cualquier archivo fuera de `packages/cli/`

## Requirements

### 1. Actualizar `providers/types.ts`

```typescript
// Añadir a types.ts

export interface ToolCall {
  name: string;
  input: Record<string, unknown>;
}

export interface ApiProviderOptions extends ProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  tools?: ToolDefinition[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

// Tools predefinidas para file operations
export const FILE_TOOLS: ToolDefinition[] = [
  {
    name: 'read_file',
    description: 'Read contents of a file',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path to read' },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Write content to a file',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path to write' },
        content: { type: 'string', description: 'Content to write' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'list_files',
    description: 'List files in a directory',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path' },
        pattern: { type: 'string', description: 'Glob pattern to filter' },
      },
      required: ['path'],
    },
  },
  {
    name: 'run_command',
    description: 'Run a shell command',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Command to execute' },
      },
      required: ['command'],
    },
  },
  {
    name: 'task_complete',
    description: 'Signal that the task is complete',
    inputSchema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'Summary of what was done' },
      },
      required: ['summary'],
    },
  },
  {
    name: 'task_blocked',
    description: 'Signal that the task is blocked and needs human input',
    inputSchema: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why the task is blocked' },
        attempted: { type: 'string', description: 'What was attempted' },
        suggestion: { type: 'string', description: 'Suggested next steps' },
      },
      required: ['reason'],
    },
  },
];
```

### 2. Implementar `anthropic-api.ts`

```typescript
// packages/cli/src/core/providers/anthropic-api.ts

import Anthropic from '@anthropic-ai/sdk';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { glob } from 'glob';
import { spawn } from 'child_process';
import type {
  Provider,
  ExecutionResult,
  ApiProviderOptions,
  ToolDefinition,
  FILE_TOOLS,
} from './types.js';

export class AnthropicApiProvider implements Provider {
  name = 'anthropic-api';
  private client: Anthropic;
  private cwd: string;
  private model: string;
  private filesChanged: Set<string> = new Set();

  constructor(cwd: string = process.cwd(), apiKey?: string) {
    this.cwd = cwd;
    this.model = 'claude-sonnet-4-20250514';
    this.client = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    });
  }

  async isAvailable(): Promise<boolean> {
    return !!(process.env.ANTHROPIC_API_KEY || this.client);
  }

  async execute(prompt: string, options: ApiProviderOptions = {}): Promise<ExecutionResult> {
    const { model = this.model, maxTokens = 8192, timeout = 600000 } = options;

    this.filesChanged.clear();
    let isComplete = false;
    let isBlocked = false;
    let blockReason = '';
    let fullOutput = '';

    try {
      // Ejecutar con tool use loop
      let messages: Anthropic.MessageParam[] = [
        { role: 'user', content: prompt },
      ];

      const tools = this.convertToolsToAnthropicFormat(FILE_TOOLS);

      while (!isComplete && !isBlocked) {
        const response = await this.client.messages.create({
          model,
          max_tokens: maxTokens,
          tools,
          messages,
        });

        // Procesar respuesta
        for (const block of response.content) {
          if (block.type === 'text') {
            fullOutput += block.text + '\n';
          } else if (block.type === 'tool_use') {
            const toolResult = await this.handleToolCall(block.name, block.input as Record<string, unknown>);

            if (block.name === 'task_complete') {
              isComplete = true;
            } else if (block.name === 'task_blocked') {
              isBlocked = true;
              blockReason = (block.input as { reason: string }).reason;
            }

            // Añadir respuesta del assistant y resultado de tool
            messages = [
              ...messages,
              { role: 'assistant', content: response.content },
              {
                role: 'user',
                content: [{
                  type: 'tool_result',
                  tool_use_id: block.id,
                  content: toolResult,
                }],
              },
            ];
          }
        }

        // Si no hay tool calls, considerarlo completo
        if (response.stop_reason === 'end_turn' && !response.content.some(b => b.type === 'tool_use')) {
          break;
        }
      }

      return {
        success: !isBlocked,
        output: fullOutput,
        error: isBlocked ? blockReason : undefined,
        filesChanged: Array.from(this.filesChanged),
        iterationComplete: isComplete,
        completionSignal: isComplete ? '<TASK_COMPLETE>' : undefined,
      };

    } catch (error) {
      return {
        success: false,
        output: fullOutput,
        error: error instanceof Error ? error.message : 'Unknown error',
        filesChanged: Array.from(this.filesChanged),
        iterationComplete: false,
      };
    }
  }

  private convertToolsToAnthropicFormat(tools: ToolDefinition[]): Anthropic.Tool[] {
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema as Anthropic.Tool['input_schema'],
    }));
  }

  private async handleToolCall(name: string, input: Record<string, unknown>): Promise<string> {
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
          const pattern = input.pattern as string || '**/*';
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

      proc.stdout?.on('data', (data) => { output += data.toString(); });
      proc.stderr?.on('data', (data) => { output += data.toString(); });

      proc.on('close', (code) => {
        resolve(`Exit code: ${code}\n${output}`);
      });

      proc.on('error', (err) => {
        resolve(`Error: ${err.message}`);
      });
    });
  }
}

export function createAnthropicApiProvider(cwd?: string, apiKey?: string): Provider {
  return new AnthropicApiProvider(cwd, apiKey);
}
```

### 3. Implementar `openai-api.ts`

```typescript
// packages/cli/src/core/providers/openai-api.ts

import OpenAI from 'openai';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { glob } from 'glob';
import { spawn } from 'child_process';
import type { Provider, ExecutionResult, ApiProviderOptions, FILE_TOOLS } from './types.js';

export class OpenAiApiProvider implements Provider {
  name = 'openai-api';
  private client: OpenAI;
  private cwd: string;
  private model: string;
  private filesChanged: Set<string> = new Set();

  constructor(cwd: string = process.cwd(), apiKey?: string) {
    this.cwd = cwd;
    this.model = 'gpt-4o';
    this.client = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
  }

  async isAvailable(): Promise<boolean> {
    return !!(process.env.OPENAI_API_KEY || this.client);
  }

  async execute(prompt: string, options: ApiProviderOptions = {}): Promise<ExecutionResult> {
    const { model = this.model, maxTokens = 8192 } = options;

    this.filesChanged.clear();
    let isComplete = false;
    let isBlocked = false;
    let blockReason = '';
    let fullOutput = '';

    try {
      const tools = this.convertToolsToOpenAIFormat(FILE_TOOLS);

      let messages: OpenAI.ChatCompletionMessageParam[] = [
        { role: 'user', content: prompt },
      ];

      while (!isComplete && !isBlocked) {
        const response = await this.client.chat.completions.create({
          model,
          max_tokens: maxTokens,
          tools,
          messages,
        });

        const message = response.choices[0]?.message;
        if (!message) break;

        if (message.content) {
          fullOutput += message.content + '\n';
        }

        if (message.tool_calls && message.tool_calls.length > 0) {
          // Añadir mensaje del assistant
          messages.push(message);

          // Procesar cada tool call
          for (const toolCall of message.tool_calls) {
            const args = JSON.parse(toolCall.function.arguments);
            const result = await this.handleToolCall(toolCall.function.name, args);

            if (toolCall.function.name === 'task_complete') {
              isComplete = true;
            } else if (toolCall.function.name === 'task_blocked') {
              isBlocked = true;
              blockReason = args.reason;
            }

            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: result,
            });
          }
        } else {
          // No más tool calls
          break;
        }
      }

      return {
        success: !isBlocked,
        output: fullOutput,
        error: isBlocked ? blockReason : undefined,
        filesChanged: Array.from(this.filesChanged),
        iterationComplete: isComplete,
        completionSignal: isComplete ? '<TASK_COMPLETE>' : undefined,
      };

    } catch (error) {
      return {
        success: false,
        output: fullOutput,
        error: error instanceof Error ? error.message : 'Unknown error',
        filesChanged: Array.from(this.filesChanged),
        iterationComplete: false,
      };
    }
  }

  private convertToolsToOpenAIFormat(tools: typeof FILE_TOOLS): OpenAI.ChatCompletionTool[] {
    return tools.map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));
  }

  private async handleToolCall(name: string, input: Record<string, unknown>): Promise<string> {
    // Mismo código que AnthropicApiProvider.handleToolCall
    // ... (copiar implementación)
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
          const pattern = input.pattern as string || '**/*';
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
      proc.stdout?.on('data', (data) => { output += data.toString(); });
      proc.stderr?.on('data', (data) => { output += data.toString(); });
      proc.on('close', (code) => {
        resolve(`Exit code: ${code}\n${output}`);
      });
      proc.on('error', (err) => {
        resolve(`Error: ${err.message}`);
      });
    });
  }
}

export function createOpenAiApiProvider(cwd?: string, apiKey?: string): Provider {
  return new OpenAiApiProvider(cwd, apiKey);
}
```

### 4. Index de providers

```typescript
// packages/cli/src/core/providers/index.ts

export * from './types.js';
export * from './claude-cli.js';
export * from './anthropic-api.js';
export * from './openai-api.js';

import type { Provider } from './types.js';
import { createClaudeCliProvider } from './claude-cli.js';
import { createAnthropicApiProvider } from './anthropic-api.js';
import { createOpenAiApiProvider } from './openai-api.js';

export type ProviderType = 'claude-cli' | 'anthropic-api' | 'openai-api';

export function createProvider(
  type: ProviderType,
  cwd?: string,
  apiKey?: string
): Provider {
  switch (type) {
    case 'claude-cli':
      return createClaudeCliProvider(cwd);
    case 'anthropic-api':
      return createAnthropicApiProvider(cwd, apiKey);
    case 'openai-api':
      return createOpenAiApiProvider(cwd, apiKey);
    default:
      throw new Error(`Unknown provider type: ${type}`);
  }
}
```

## Definition of Done
- [ ] `AnthropicApiProvider` implementa tool use loop completo
- [ ] `OpenAiApiProvider` implementa tool use loop completo
- [ ] Ambos providers manejan read_file, write_file, list_files, run_command
- [ ] Tools `task_complete` y `task_blocked` funcionan correctamente
- [ ] `createProvider` factory function funciona
- [ ] Providers detectan archivos cambiados
- [ ] Manejo de errores robusto
- [ ] TypeScript compila sin errores

## Notes
- Los providers API usan tool calling para operaciones de archivos
- El loop continúa hasta que se llame `task_complete` o `task_blocked`
- Usar variables de entorno para API keys: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`
- El modelo default para Anthropic es claude-sonnet-4, para OpenAI es gpt-4o
- El código de handleToolCall es duplicado - considerar extraer a clase base
