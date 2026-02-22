import type {
  AidfConfig,
  ExecutorOptions,
  ExecutorState,
  ExecutorDependencies,
  LoadedContext,
  BlockedStatus,
} from '../../types/index.js';
import type { ScopeGuard } from '../safety.js';
import type { Validator } from '../validator.js';
import type { Provider } from '../providers/types.js';
import type { MetricsCollector } from '../metrics-collector.js';

export interface PhaseContext {
  config: AidfConfig;
  options: ExecutorOptions;
  state: ExecutorState;
  cwd: string;
  taskPath: string;
  deps: ExecutorDependencies;
  metrics?: MetricsCollector;
}

export interface PreFlightResult {
  context: LoadedContext;
  scopeGuard: ScopeGuard;
  validator: Validator;
  provider: Provider;
  blockedStatus: BlockedStatus | null;
  skipPermissions: boolean;
}

export interface ExecutionLoopResult {
  completedNormally: boolean;
  terminationReason?: 'completed' | 'blocked' | 'max_iterations' | 'max_failures' | 'dry_run';
  lastError?: string;
}

export interface PostFlightInput {
  preFlightResult: PreFlightResult | null;
  executionResult: ExecutionLoopResult;
}

export interface ExecutorPhase<TInput, TOutput> {
  name: string;
  execute(ctx: PhaseContext, input: TInput): Promise<TOutput>;
}
