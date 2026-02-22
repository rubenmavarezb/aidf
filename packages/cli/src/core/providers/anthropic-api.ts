import Anthropic from '@anthropic-ai/sdk';
import type {
  Provider,
  ExecutionResult,
  ApiProviderOptions,
  ToolDefinition,
  ConversationMetrics,
} from './types.js';
import { FILE_TOOLS } from './types.js';
import { ToolHandler } from './tool-handler.js';
import { ConversationWindow, type GenericMessage } from './conversation-window.js';
import { ProviderError, PermissionError } from '../errors.js';

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
    let conversationMetrics: ConversationMetrics | undefined;
    let messages: Anthropic.MessageParam[] = options.conversationState
      ? [...(options.conversationState as Anthropic.MessageParam[]), { role: 'user', content: prompt }]
      : [{ role: 'user', content: prompt }];

    const window = options.conversationConfig
      ? new ConversationWindow(options.conversationConfig)
      : null;

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

        // Trim conversation if window is configured
        if (window) {
          const trimResult = await window.trim(messages as GenericMessage[]);
          messages = trimResult.trimmed as Anthropic.MessageParam[];
          conversationMetrics = trimResult.metrics;
        }

        // If no tool calls, consider iteration complete
        if (
          response.stop_reason === 'end_turn' &&
          !response.content.some((b) => b.type === 'tool_use')
        ) {
          break;
        }
      }

      // Final metrics if no trimming occurred
      if (window && !conversationMetrics) {
        conversationMetrics = {
          totalMessages: messages.length,
          preservedMessages: messages.length,
          evictedMessages: 0,
          estimatedTokens: new ConversationWindow().estimateTokens(messages as GenericMessage[]),
        };
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
        conversationMetrics,
      };
    } catch (error) {
      const categorized = this.categorizeError(error);
      return {
        success: false,
        output: fullOutput,
        error: categorized.message,
        errorCategory: categorized.category,
        errorCode: categorized.code,
        filesChanged: this.toolHandler.getChangedFiles(),
        iterationComplete: false,
        tokenUsage: totalInputTokens > 0 || totalOutputTokens > 0
          ? { inputTokens: totalInputTokens, outputTokens: totalOutputTokens }
          : undefined,
        conversationState: messages,
        conversationMetrics,
      };
    }
  }

  private categorizeError(error: unknown): ProviderError | PermissionError {
    // Check for status-based errors (works with both real SDK errors and mocks)
    const err = error as { status?: number; message?: string };
    const status = err.status;
    const message = err.message ?? (error instanceof Error ? error.message : 'Unknown error');

    if (status !== undefined) {
      if (status === 429) {
        return ProviderError.rateLimit('anthropic-api', message);
      }
      if (status === 401 || status === 403) {
        return PermissionError.apiAuth('anthropic-api');
      }
      if (status >= 500) {
        return ProviderError.apiError('anthropic-api', message, status);
      }
      return ProviderError.apiError('anthropic-api', message, status);
    }

    return ProviderError.crash('anthropic-api', message);
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
