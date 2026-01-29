// === Provider Interface ===

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  filesChanged: string[];
  iterationComplete: boolean;
  completionSignal?: string;
  tokenUsage?: TokenUsage;
}

export interface ProviderOptions {
  model?: string;
  timeout?: number;
  maxTokens?: number;
  dangerouslySkipPermissions?: boolean;
}

export interface Provider {
  name: string;
  execute(prompt: string, options?: ProviderOptions): Promise<ExecutionResult>;
  isAvailable(): Promise<boolean>;
}

// === API Provider Types ===

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

// === Predefined Tools for File Operations ===

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
