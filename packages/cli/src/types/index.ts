// === Configuration Types ===

export interface AidfConfig {
  version: number;
  provider: ProviderConfig;
  execution: ExecutionConfig;
  permissions: PermissionsConfig;
  validation: ValidationConfig;
  git: GitConfig;
}

export interface ProviderConfig {
  type: 'claude-cli' | 'anthropic-api' | 'openai-api';
  model?: string;
}

export interface ExecutionConfig {
  max_iterations: number;
  max_consecutive_failures: number;
  timeout_per_iteration: number;
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
  onAskUser?: (question: string, files: string[]) => Promise<boolean>;
}

export interface ExecutorResult {
  success: boolean;
  status: ExecutorStatus;
  iterations: number;
  filesModified: string[];
  error?: string;
  blockedReason?: string;
  taskPath: string;
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
