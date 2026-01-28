import OpenAI from 'openai';
import type {
  Provider,
  ExecutionResult,
  ApiProviderOptions,
  ToolDefinition,
} from './types.js';
import { FILE_TOOLS } from './types.js';
import { ToolHandler } from './tool-handler.js';

/**
 * Provider that uses OpenAI API directly with tool calling
 */
export class OpenAiApiProvider implements Provider {
  name = 'openai-api';
  private client: OpenAI;
  private cwd: string;
  private model: string;
  private toolHandler: ToolHandler;

  constructor(cwd: string = process.cwd(), apiKey?: string) {
    this.cwd = cwd;
    this.model = 'gpt-4o';
    this.toolHandler = new ToolHandler(cwd);
    this.client = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Check if OpenAI API is available
   */
  async isAvailable(): Promise<boolean> {
    return !!(process.env.OPENAI_API_KEY);
  }

  /**
   * Execute a prompt with OpenAI API using tool calling
   */
  async execute(prompt: string, options: ApiProviderOptions = {}): Promise<ExecutionResult> {
    const { model = this.model, maxTokens = 8192 } = options;

    this.toolHandler.reset();
    let isComplete = false;
    let isBlocked = false;
    let blockReason = '';
    let fullOutput = '';

    try {
      const tools = this.convertToolsToOpenAIFormat(FILE_TOOLS);

      const messages: OpenAI.ChatCompletionMessageParam[] = [
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
          // Add assistant message to history
          messages.push(message);

          // Process each tool call
          for (const toolCall of message.tool_calls) {
            const args = JSON.parse(toolCall.function.arguments);
            const result = await this.toolHandler.handle(toolCall.function.name, args);

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
          // No more tool calls
          break;
        }
      }

      return {
        success: !isBlocked,
        output: fullOutput,
        error: isBlocked ? blockReason : undefined,
        filesChanged: this.toolHandler.getChangedFiles(),
        iterationComplete: isComplete,
        completionSignal: isComplete ? '<TASK_COMPLETE>' : undefined,
      };
    } catch (error) {
      return {
        success: false,
        output: fullOutput,
        error: error instanceof Error ? error.message : 'Unknown error',
        filesChanged: this.toolHandler.getChangedFiles(),
        iterationComplete: false,
      };
    }
  }

  private convertToolsToOpenAIFormat(tools: ToolDefinition[]): OpenAI.ChatCompletionTool[] {
    return tools.map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));
  }
}

/**
 * Factory function
 */
export function createOpenAiApiProvider(cwd?: string, apiKey?: string): Provider {
  return new OpenAiApiProvider(cwd, apiKey);
}
