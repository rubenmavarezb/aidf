// === Error Types ===

export type ErrorCategory =
  | 'provider'
  | 'timeout'
  | 'validation'
  | 'scope'
  | 'config'
  | 'git'
  | 'permission';

// === Configuration Types ===

export interface AidfConfig {
  version: number;
  provider: ProviderConfig;
  execution: ExecutionConfig;
  permissions: PermissionsConfig;
  validation: ValidationConfig;
  git: GitConfig;
  notifications?: NotificationsConfig;
  skills?: SkillsConfig;
  security?: SecurityConfig;
  cost?: CostConfig;
  observability?: ObservabilityConfig;
}

export interface ProviderConfig {
  type: 'claude-cli' | 'cursor-cli' | 'anthropic-api' | 'openai-api';
  model?: string;
}

export interface ConversationHistoryConfig {
  max_messages?: number;
  summarize_on_trim?: boolean;
  preserve_first_n?: number;
  preserve_last_n?: number;
}

export interface ExecutionConfig {
  max_iterations: number;
  max_consecutive_failures: number;
  timeout_per_iteration: number;
  session_continuation?: boolean;
  max_conversation_messages?: number;
  conversation?: ConversationHistoryConfig;
}

export interface PermissionsConfig {
  scope_enforcement: 'strict' | 'ask' | 'permissive';
  auto_commit: boolean;
  auto_push: boolean;
  auto_pr: boolean;
}

export interface ValidationConfig {
  pre_commit: string[];
  pre_push: string[];
  pre_pr: string[];
}

export interface GitConfig {
  commit_prefix: string;
  branch_prefix: string;
}

// === Notification Types ===

export type NotificationLevel = 'all' | 'errors' | 'blocked';

export interface DesktopNotificationConfig {
  enabled: boolean;
}

export interface SlackNotificationConfig {
  enabled: boolean;
  webhook_url: string;
}

export interface DiscordNotificationConfig {
  enabled: boolean;
  webhook_url: string;
}

export interface EmailNotificationConfig {
  enabled: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_pass: string;
  from: string;
  to: string;
}

export interface WebhookNotificationConfig {
  enabled: boolean;
  url: string;
  headers?: Record<string, string>;
}

export interface NotificationsConfig {
  level: NotificationLevel;
  desktop?: DesktopNotificationConfig;
  slack?: SlackNotificationConfig;
  discord?: DiscordNotificationConfig;
  email?: EmailNotificationConfig;
  webhook?: WebhookNotificationConfig;
}

export type NotificationEventType = 'completed' | 'blocked' | 'failed';

export interface NotificationEvent {
  type: NotificationEventType;
  taskPath: string;
  taskName: string;
  iterations: number;
  filesModified: string[];
  error?: string;
  errorCategory?: ErrorCategory;
  errorCode?: string;
  blockedReason?: string;
  timestamp: Date;
}

// === Task Types ===

export interface TaskScope {
  allowed: string[];
  forbidden: string[];
  ask_before?: string[];
}

export interface ResumeAttempt {
  resumedAt: string;
  completedAt?: string;
  status: 'resumed' | 'completed' | 'blocked_again';
  iterations: number;
}

export interface BlockedStatus {
  previousIteration: number;
  filesModified: string[];
  blockingIssue: string;
  startedAt: string;
  blockedAt: string;
  attemptHistory?: ResumeAttempt[];
}

export interface ParsedTask {
  filePath: string;
  goal: string;
  taskType: 'component' | 'refactor' | 'test' | 'docs' | 'architecture' | 'bugfix';
  suggestedRoles: string[];
  scope: TaskScope;
  requirements: string;
  definitionOfDone: string[];
  notes?: string;
  raw: string;
  blockedStatus?: BlockedStatus;
}

export interface ParsedRole {
  name: string;
  identity: string;
  expertise: string[];
  responsibilities: string[];
  constraints: string[];
  qualityCriteria: string[];
  outputFormat?: string;
  raw: string;
}

export interface ParsedAgents {
  projectOverview: string;
  architecture: string;
  technologyStack: string;
  conventions: string;
  qualityStandards: string;
  boundaries: {
    neverModify: string[];
    neverDo: string[];
    requiresDiscussion: string[];
  };
  commands: {
    development: Record<string, string>;
    quality: Record<string, string>;
    build: Record<string, string>;
  };
  raw: string;
}

export interface LoadedContext {
  agents: ParsedAgents;
  role: ParsedRole;
  task: ParsedTask;
  plan?: string;
  skills?: LoadedSkill[];
}

// === Scope Types ===

export type ScopeDecision =
  | { action: 'ALLOW' }
  | { action: 'BLOCK'; reason: string; files: string[]; error?: import('../core/errors.js').ScopeError }
  | { action: 'ASK_USER'; reason: string; files: string[]; error?: import('../core/errors.js').ScopeError };

export type ScopeMode = 'strict' | 'ask' | 'permissive';

export interface FileChange {
  path: string;
  type: 'created' | 'modified' | 'deleted';
}

// === Validation Types ===

export interface ValidationResult {
  command: string;
  passed: boolean;
  output: string;
  duration: number;
  exitCode: number;
}

export interface ValidationSummary {
  phase: 'pre_commit' | 'pre_push' | 'pre_pr';
  passed: boolean;
  results: ValidationResult[];
  totalDuration: number;
  error?: import('../core/errors.js').ValidationError;
}

// === Executor Types ===

export type ExecutorStatus =
  | 'idle'
  | 'running'
  | 'paused'
  | 'completed'
  | 'blocked'
  | 'failed';

export interface ExecutorState {
  status: ExecutorStatus;
  iteration: number;
  startedAt?: Date;
  completedAt?: Date;
  lastError?: string;
  filesModified: string[];
  validationResults: ValidationSummary[];
  tokenUsage?: { inputTokens: number; outputTokens: number };
  contextBreakdown?: ContextBreakdown;
  contextTokens?: number;
  conversationMessageCount?: number;
}

export interface PhaseEvent {
  phase: string;
  iteration: number;
  totalIterations: number;
  filesModified: number;
}

export interface ExecutorOptions {
  maxIterations: number;
  maxConsecutiveFailures: number;
  timeoutPerIteration: number;
  scopeEnforcement: ScopeMode;
  autoCommit: boolean;
  autoPush: boolean;
  dryRun: boolean;
  verbose: boolean;
  resume?: boolean;
  logger?: import('../utils/logger.js').Logger;
  onIteration?: (state: ExecutorState) => void;
  onPhase?: (event: PhaseEvent) => void;
  onOutput?: (chunk: string) => void;
  onAskUser?: (question: string, files: string[]) => Promise<boolean>;
}

export interface ContextBreakdown {
  agents: number;
  role: number;
  task: number;
  plan: number;
  skills: number;
}

export interface TokenUsageSummary {
  contextTokens: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  estimatedCost?: number;
  breakdown?: ContextBreakdown;
  /** @deprecated Use totalInputTokens instead */
  inputTokens: number;
  /** @deprecated Use totalOutputTokens instead */
  outputTokens: number;
}

export interface ExecutorResult {
  success: boolean;
  status: ExecutorStatus;
  iterations: number;
  filesModified: string[];
  error?: string;
  errorCategory?: ErrorCategory;
  errorCode?: string;
  errorDetails?: Record<string, unknown>;
  blockedReason?: string;
  taskPath: string;
  tokenUsage?: TokenUsageSummary;
  report?: ExecutionReport;
}

// === Status Command Types ===

export interface TaskStats {
  pending: number;
  inProgress: number;
  completed: number;
  blocked: number;
  total: number;
}

export interface LastExecution {
  date: Date;
  duration?: string;
  result: 'success' | 'failed' | 'blocked';
  task?: string;
}

export interface StatusData {
  tasks: TaskStats;
  lastExecution: LastExecution | null;
  recentFiles: string[];
  provider: {
    type: string;
    model?: string;
  };
}

// === Watcher Types ===

export type WatcherEventType = 'task_added' | 'task_modified' | 'config_changed';

export interface WatcherEvent {
  type: WatcherEventType;
  filePath: string;
  timestamp: Date;
}

export interface WatcherOptions {
  debounceMs: number;
  daemon: boolean;
  verbose: boolean;
  quiet: boolean;
  logFormat?: 'text' | 'json';
  logFile?: string;
  logRotate?: boolean;
  dryRun: boolean;
  provider?: string;
  maxIterations?: number;
}

export type WatcherStatus = 'idle' | 'watching' | 'executing' | 'stopping' | 'stopped';

export interface WatcherState {
  status: WatcherStatus;
  startedAt?: Date;
  tasksExecuted: number;
  tasksCompleted: number;
  tasksFailed: number;
  tasksBlocked: number;
  currentTask: string | null;
  queuedTasks: string[];
  processedTasks: Map<string, number>;
}

// === Parallel Execution Types ===

export interface TaskDependency {
  taskPath: string;
  dependsOn: string[];
  reason: string;
}

export interface ParallelExecutorOptions {
  concurrency: number;
  dryRun: boolean;
  verbose: boolean;
  quiet: boolean;
  maxIterations?: number;
  resume?: boolean;
  logFormat?: 'text' | 'json';
  logFile?: string;
  logRotate?: boolean;
  deps?: Partial<ExecutorDependencies>;
  onTaskStart?: (taskPath: string) => void;
  onTaskComplete?: (taskPath: string, result: ExecutorResult) => void;
}

export interface ParallelTaskResult {
  taskPath: string;
  taskName: string;
  result: ExecutorResult;
  startedAt: Date;
  completedAt: Date;
}

export interface ParallelExecutionResult {
  success: boolean;
  totalTasks: number;
  completed: number;
  failed: number;
  blocked: number;
  skipped: number;
  tasks: ParallelTaskResult[];
  dependencies: TaskDependency[];
  fileConflicts: string[];
  totalIterations: number;
  totalFilesModified: string[];
}

// === Logging Types ===

export interface LogContext {
  task?: string;
  iteration?: number;
  files?: string[];
  command?: string;
  [key: string]: unknown;
}

export interface StructuredLogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'success';
  message: string;
  context?: LogContext;
}

// === Skill Types ===

export interface SkillMetadata {
  name: string;
  description: string;
  version?: string;
  author?: string;
  tags?: string[];
  globs?: string[];
}

export interface SkillInfo {
  name: string;
  path: string;
  source: 'project' | 'global' | 'config';
  metadata: SkillMetadata;
}

export interface LoadedSkill extends SkillInfo {
  content: string;
  warnings?: SecurityWarning[];
}

export interface SkillsConfig {
  enabled?: boolean;
  directories?: string[];
  extras?: string[];
  /** Block skills with danger-level security warnings. Default: true */
  block_suspicious?: boolean;
}

// === Skill Security Types ===

export interface SecurityWarning {
  level: 'warning' | 'danger';
  pattern: string;
  description: string;
  line?: number;
}

// === Executor Dependency Injection Types ===

export interface ExecutorDependencies {
  git: import('simple-git').SimpleGit;
  fs: typeof import('fs/promises');
  createScopeGuard: (scope: TaskScope, mode: ScopeMode) => import('../core/safety.js').ScopeGuard;
  createValidator: (config: ValidationConfig, cwd: string) => import('../core/validator.js').Validator;
  createProvider: (type: import('../core/providers/index.js').ProviderType, cwd: string, apiKey?: string) => import('../core/providers/types.js').Provider;
  notificationService: import('../utils/notifications.js').NotificationService;
  logger: import('../utils/logger.js').Logger;
  moveTaskFile: (taskPath: string, status: 'pending' | 'completed' | 'blocked') => string;
}

// === Security Types ===

export interface CommandPolicy {
  /** Commands that are always allowed (e.g., ["pnpm test", "pnpm lint"]) */
  allowed?: string[];
  /** Commands or patterns that are always blocked (e.g., ["rm -rf", "sudo"]) */
  blocked?: string[];
  /** Block all commands not in the allowed list. Default: false */
  strict?: boolean;
}

export interface SecurityConfig {
  /** Whether to skip Claude CLI permission prompts. Default: true for backward compat */
  skip_permissions?: boolean;
  /** Show a warning when skip_permissions is true. Default: true */
  warn_on_skip?: boolean;
  /** Command execution policy for API providers */
  commands?: CommandPolicy;
}

// === Plan Types ===

export interface PlanTask {
  filename: string;
  taskPath: string;
  description: string;
  wave: number;
  dependsOn: string[];
  completed: boolean;
  lineNumber: number;
}

export interface PlanWave {
  number: number;
  tasks: PlanTask[];
}

export interface ParsedPlan {
  planPath: string;
  name: string;
  overview: string;
  tasks: PlanTask[];
  waves: PlanWave[];
}

export interface PlanExecutionResult {
  success: boolean;
  planPath: string;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  blockedTasks: number;
  skippedTasks: number;
}

// === Observability Types ===

export interface CostRates {
  inputPer1M: number;
  outputPer1M: number;
}

export interface ModelCostRates {
  [modelPattern: string]: CostRates;
}

export interface CostConfig {
  rates?: ModelCostRates;
  currency?: string; // always USD for now
}

export interface ObservabilityConfig {
  webhook?: WebhookConfig;
}

export interface WebhookConfig {
  enabled: boolean;
  url: string;
  headers?: Record<string, string>;
  events?: Array<'completed' | 'blocked' | 'failed'>;
  include_iterations?: boolean;
  timeout?: number;
  retry?: number;
}

export interface PhaseTimings {
  contextLoading?: number;
  aiExecution?: number;
  scopeChecking?: number;
  validation?: number;
  gitOperations?: number;
  other?: number;
  [phase: string]: number | undefined;
}

export interface IterationTokens {
  iteration: number;
  input: number;
  output: number;
}

export interface IterationCost {
  iteration: number;
  cost: number;
}

export interface IterationTiming {
  iteration: number;
  durationMs: number;
  phases?: PhaseTimings;
}

export interface IterationMetrics {
  iteration: number;
  input: number;
  output: number;
  cost?: number;
  durationMs: number;
  phases?: PhaseTimings;
  filesChanged?: string[];
}

export interface ValidationRun {
  iteration: number;
  phase: string;
  command: string;
  passed: boolean;
  durationMs: number;
  exitCode: number;
}

export interface CIEnvironment {
  ci: boolean;
  ciProvider?: string;
  ciBuildId?: string;
  ciBranch?: string;
  ciCommit?: string;
}

export interface ExecutionReport {
  // Run metadata
  runId: string;
  timestamp: string; // ISO 8601
  taskPath: string;
  taskGoal?: string;
  taskType?: string;
  roleName?: string;
  provider: {
    type: string;
    model?: string;
  };
  cwd: string;
  aidfVersion?: string;

  // Outcome
  status: 'completed' | 'blocked' | 'failed';
  iterations: number;
  maxIterations: number;
  consecutiveFailures?: number;
  error?: string;
  blockedReason?: string;

  // Token usage
  tokens?: {
    contextTokens?: number;
    totalInput?: number;
    totalOutput?: number;
    totalTokens?: number;
    estimated?: boolean;
    perIteration?: IterationTokens[];
    breakdown?: ContextBreakdown;
  };

  // Cost
  cost?: {
    estimatedTotal?: number;
    currency: string;
    rates?: CostRates;
    perIteration?: IterationCost[];
  };

  // Timing
  timing: {
    startedAt: string;
    completedAt: string;
    totalDurationMs: number;
    phases?: PhaseTimings;
    perIteration?: IterationTiming[];
  };

  // Files
  files: {
    modified: string[];
    created: string[];
    deleted: string[];
    totalCount: number;
  };

  // Validation
  validation?: {
    runs: ValidationRun[];
    totalRuns: number;
    failures: number;
  };

  // Scope
  scope?: {
    mode: string;
    violations: number;
    blockedFiles: string[];
  };

  // Environment
  environment?: {
    nodeVersion?: string;
    os?: string;
    ci?: boolean;
    ciProvider?: string;
    ciBuildId?: string;
    ciBranch?: string;
    ciCommit?: string;
  };
}

export interface ReportSummary {
  runId: string;
  timestamp: string;
  taskPath: string;
  status: 'completed' | 'blocked' | 'failed';
  iterations: number;
  totalTokens?: number;
  estimatedCost?: number;
  durationMs: number;
  provider: string;
  model?: string;
  filesModified: number;
}

export interface AggregateMetrics {
  totalRuns: number;
  successRate: number;
  totalTokens: number;
  totalCost: number;
  averageIterations: number;
  averageDuration: number;
  byStatus: Record<string, number>;
  mostModifiedFiles: Array<{ file: string; count: number }>;
}

export interface PhaseSummary {
  phase: string;
  totalMs: number;
  count: number;
  avgMs: number;
  maxMs: number;
  minMs: number;
  percentage: number;
}
