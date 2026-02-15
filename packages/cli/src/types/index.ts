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
}

export interface ProviderConfig {
  type: 'claude-cli' | 'cursor-cli' | 'anthropic-api' | 'openai-api';
  model?: string;
}

export interface ExecutionConfig {
  max_iterations: number;
  max_consecutive_failures: number;
  timeout_per_iteration: number;
  session_continuation?: boolean;
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
  | { action: 'BLOCK'; reason: string; files: string[] }
  | { action: 'ASK_USER'; reason: string; files: string[] };

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
  blockedReason?: string;
  taskPath: string;
  tokenUsage?: TokenUsageSummary;
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
