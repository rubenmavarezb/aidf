# TASK: Add Configurable Cost Rates

## Goal
Add a `cost` section to `AidfConfig` and `config.yml` to support configurable per-model token cost rates. Replace the hardcoded `$3/$15` cost estimation in `executor.ts` `buildTokenUsageSummary()` with configurable rate lookup.

New config section in `config.yml`:
```yaml
cost:
  rates:
    claude-sonnet:
      input_per_1m: 3.0
      output_per_1m: 15.0
    claude-opus:
      input_per_1m: 15.0
      output_per_1m: 75.0
    claude-haiku:
      input_per_1m: 0.25
      output_per_1m: 1.25
    gpt-4o:
      input_per_1m: 2.5
      output_per_1m: 10.0
    gpt-4o-mini:
      input_per_1m: 0.15
      output_per_1m: 0.60
  currency: USD
```

## Task Type
feature

## Suggested Roles
- developer

## Auto-Mode Compatible
YES

## Scope
### Allowed
- packages/cli/src/types/index.ts
- packages/cli/src/core/executor.ts
- packages/cli/src/core/context-loader.ts
- packages/cli/src/core/executor.test.ts
- templates/.ai/config.yml

### Forbidden
- packages/cli/src/commands/** (read-only)
- packages/cli/src/core/safety.ts (read-only)

## Requirements
- Define `CostConfig` interface: `{ rates: Record<string, ModelCostRates>, currency: string }`
- Define `ModelCostRates` interface: `{ inputPer1M: number, outputPer1M: number }`
- Add `cost?: CostConfig` to `AidfConfig` interface
- The executor should look up rates by model name (substring match against configured keys, falling back to provider-type defaults)
- Replace the hardcoded `$3/$15` cost estimation in `executor.ts` `buildTokenUsageSummary()` with configurable rate lookup
- Add validation that rates are positive numbers
- Default rates are built into the code for common models so config is optional
- All new config should have sensible defaults and be entirely optional

## Definition of Done
- [ ] `CostConfig` and `ModelCostRates` interfaces defined in `types/index.ts`
- [ ] `cost` field added to `AidfConfig` interface
- [ ] Hardcoded cost estimation replaced with configurable rate lookup
- [ ] Substring matching for model names works (e.g., "claude-sonnet" matches "claude-sonnet-4-20250514")
- [ ] Default rates built into the code for common models
- [ ] Validation rejects negative or zero rates
- [ ] TypeScript compiles with no errors (`pnpm typecheck`)
- [ ] Existing tests pass (`pnpm test`)

## Notes
- Part of PLAN-v080-observability.md
- Depends on task 124 (adds cost config types)
- Independent of task 125
