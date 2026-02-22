export * from './types.js';
export * from './claude-cli.js';
export * from './cursor-cli.js';
export * from './anthropic-api.js';
export * from './openai-api.js';
export * from './tool-handler.js';
export * from './conversation-window.js';

import type { Provider } from './types.js';
import { createClaudeCliProvider } from './claude-cli.js';
import { createCursorCliProvider } from './cursor-cli.js';
import { createAnthropicApiProvider } from './anthropic-api.js';
import { createOpenAiApiProvider } from './openai-api.js';

export type ProviderType = 'claude-cli' | 'cursor-cli' | 'anthropic-api' | 'openai-api';

export function createProvider(
  type: ProviderType,
  cwd?: string,
  apiKey?: string
): Provider {
  switch (type) {
    case 'claude-cli':
      return createClaudeCliProvider(cwd);
    case 'cursor-cli':
      return createCursorCliProvider(cwd);
    case 'anthropic-api':
      return createAnthropicApiProvider(cwd, apiKey);
    case 'openai-api':
      return createOpenAiApiProvider(cwd, apiKey);
    default:
      throw new Error(`Unknown provider type: ${type}`);
  }
}
