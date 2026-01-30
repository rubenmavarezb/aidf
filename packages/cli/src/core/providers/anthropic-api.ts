import Anthropic from '@anthropic-ai/sdk';
import type {
  Provider,
  ExecutionResult,
  ApiProviderOptions,
  ToolDefinition,
} from './types.js';
import { FILE_TOOLS } from './types.js';
import { ToolHandler } from './tool-handler.js';

/**
 * Provider that uses Anthropic API directly with tool calling
 */
export class AnthropicApiProvider implements Provider {
  name = 'anthropic-api';
  private client: Anthropic;
  private cwd: string;
  private model: string;
  private toolHandler: ToolHandler;

  constructor(cwd: string = process.cwd(), apiKey?: string) {
    this.cwd = cwd;
    this.model = 'claude-sonnet-4-20250514';
    this.toolHandler = new ToolHandler(cwd);
    this.client = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    });
  }

  /**
   * Check if Anthropic API is available
   */
  async isAvailable(): Promise<boolean> {
    return !!(process.env.ANTHROPIC_API_KEY);
  }

  /**
   * Execute a prompt with Anthropic API using tool calling
   */
  async execute(prompt: string, options: ApiProviderOptions = {}): Promise<ExecutionResult> {
    const { model = this.model, maxTokens = 8192 } = options;

    this.toolHandler.reset();
    let isComplete = false;
    let isBlocked = false;
    let blockReason = '';
    let fullOutput = '';
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let messages: Anthropic.MessageParam[] = options.conversationState
      ? [...(options.conversationState as Anthropic.MessageParam[]), { role: 'user', content: prompt }]
      : [{ role: 'user', content: prompt }];

    try {

      const tools = this.convertToolsToAnthropicFormat(FILE_TOOLS);

      while (!isComplete && !isBlocked) {
        const response = await this.client.messages.create({
          model,
          max_tokens: maxTokens,
          tools,
          messages,
        });

        // Accumulate token usage
        totalInputTokens += response.usage?.input_tokens ?? 0;
        totalOutputTokens += response.usage?.output_tokens ?? 0;

        // Process response content blocks
        for (const block of response.content) {
          if (block.type === 'text') {
            fullOutput += block.text + '\n';
          } else if (block.type === 'tool_use') {
            const toolResult = await this.toolHandler.handle(
              block.name,
              block.input as Record<string, unknown>
            );

            if (block.name === 'task_complete') {
              isComplete = true;
            } else if (block.name === 'task_blocked') {
              isBlocked = true;
              blockReason = (block.input as { reason: string }).reason;
            }

            // Add assistant response and tool result
            messages = [
              ...messages,
              { role: 'assistant', content: response.content },
              {
                role: 'user',
                content: [
                  {
                    type: 'tool_result',
                    tool_use_id: block.id,
                    content: toolResult,
                  },
                ],
              },
            ];
          }
        }

        // If no tool calls, consider iteration complete
        if (
          response.stop_reason === 'end_turn' &&
          !response.content.some((b) => b.type === 'tool_use')
        ) {
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
        tokenUsage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
        conversationState: messages,
      };
    } catch (error) {
      return {
        success: false,
        output: fullOutput,
        error: error instanceof Error ? error.message : 'Unknown error',
        filesChanged: this.toolHandler.getChangedFiles(),
        iterationComplete: false,
        tokenUsage: totalInputTokens > 0 || totalOutputTokens > 0
          ? { inputTokens: totalInputTokens, outputTokens: totalOutputTokens }
          : undefined,
        conversationState: messages,
      };
    }
  }

  private convertToolsToAnthropicFormat(tools: ToolDefinition[]): Anthropic.Tool[] {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema as Anthropic.Tool['input_schema'],
    }));
  }
}

/**
 * Factory function
 */
export function createAnthropicApiProvider(cwd?: string, apiKey?: string): Provider {
  return new AnthropicApiProvider(cwd, apiKey);
}
