import type { CostRates, CostConfig } from '../types/index.js';

const DEFAULT_RATES: Record<string, CostRates> = {
  'claude-sonnet': { inputPer1M: 3.0, outputPer1M: 15.0 },
  'claude-opus': { inputPer1M: 15.0, outputPer1M: 75.0 },
  'claude-haiku': { inputPer1M: 0.25, outputPer1M: 1.25 },
  'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.60 },
  'gpt-4o': { inputPer1M: 2.5, outputPer1M: 10.0 },
};

/**
 * Look up cost rates for a model. Matches by substring against configured keys,
 * falling back to built-in defaults. Returns undefined if no match found.
 */
export function lookupCostRates(
  model: string | undefined,
  providerType: string,
  costConfig?: CostConfig
): CostRates | undefined {
  const allRates = { ...DEFAULT_RATES, ...costConfig?.rates };

  if (model) {
    // Try exact match first, then substring match
    for (const [pattern, rates] of Object.entries(allRates)) {
      if (model.includes(pattern) || pattern.includes(model)) {
        return rates;
      }
    }
  }

  // Fallback by provider type
  if (providerType === 'anthropic-api' || providerType === 'claude-cli') {
    return allRates['claude-sonnet'];
  }
  if (providerType === 'openai-api' || providerType === 'cursor-cli') {
    return allRates['gpt-4o'];
  }

  return undefined;
}

/**
 * Calculate cost from token counts and rates.
 */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  rates: CostRates
): number {
  return (inputTokens / 1_000_000) * rates.inputPer1M +
    (outputTokens / 1_000_000) * rates.outputPer1M;
}
