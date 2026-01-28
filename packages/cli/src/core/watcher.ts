// packages/cli/src/core/watcher.ts

import chokidar from 'chokidar';
import { readdir, readFile, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join, basename } from 'path';
import { parse as parseYaml } from 'yaml';
import type {
  AidfConfig,
  WatcherOptions,
  WatcherState,
  WatcherStatus,
  ExecutorResult,
} from '../types/index.js';
import { executeTask } from './executor.js';
import { Logger } from '../utils/logger.js';

const CONFIG_FILES = ['config.yml', 'config.yaml', 'config.json'];

export class Watcher {
  private options: WatcherOptions;
  private projectRoot: string;
  private logger: Logger;
  private state: WatcherState;
  private config: AidfConfig | null = null;
  private fileWatcher: chokidar.FSWatcher | null = null;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private queue: string[] = [];
  private processing = false;
  private stopResolve: (() => void) | null = null;

  constructor(projectRoot: string, options: Partial<WatcherOptions> = {}) {
    this.projectRoot = projectRoot;
    this.options = {
      debounceMs: options.debounceMs ?? 500,
      daemon: options.daemon ?? false,
      verbose: options.verbose ?? false,
      quiet: options.quiet ?? false,
      logFormat: options.logFormat,
      logFile: options.logFile,
      logRotate: options.logRotate,
      dryRun: options.dryRun ?? false,
      provider: options.provider,
      maxIterations: options.maxIterations,
    };

    this.logger = new Logger({
      verbose: this.options.verbose,
      quiet: this.options.quiet,
      logFormat: this.options.logFormat,
      logFile: this.options.logFile,
      logRotate: this.options.logRotate,
    });

    this.state = {
      status: 'idle',
      tasksExecuted: 0,
      tasksCompleted: 0,
      tasksFailed: 0,
      tasksBlocked: 0,
      currentTask: null,
      queuedTasks: [],
      processedTasks: new Map(),
    };
  }

  async start(): Promise<void> {
    if (this.options.daemon) {
      this.logger.warn('--daemon flag accepted but full daemon mode is not yet implemented. Running in foreground.');
    }

    this.state.status = 'watching';
    this.state.startedAt = new Date();

    await this.loadConfig();
    this.setupFileWatcher();
    await this.scanExistingTasks();

    this.logger.box('Watch Mode', [
      `Project: ${this.projectRoot}`,
      `Watching: .ai/tasks/*.md`,
      `Debounce: ${this.options.debounceMs}ms`,
      `Dry run: ${this.options.dryRun}`,
      '',
      'Press Ctrl+C to stop.',
    ].join('\n'));

    // Block until stop() is called
    await new Promise<void>((resolve) => {
      this.stopResolve = resolve;
    });
  }

  async stop(): Promise<void> {
    if (this.state.status === 'stopped' || this.state.status === 'stopping') {
      return;
    }

    this.state.status = 'stopping';

    // Clear all debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    // Close file watcher
    if (this.fileWatcher) {
      await this.fileWatcher.close();
      this.fileWatcher = null;
    }

    // Wait for current task to finish (up to 10s)
    if (this.state.currentTask) {
      this.logger.info(`Waiting for current task to finish: ${basename(this.state.currentTask)}`);
      const deadline = Date.now() + 10_000;
      while (this.state.currentTask && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    this.printSummary();
    this.state.status = 'stopped';
    await this.logger.close();

    // Unblock start()
    if (this.stopResolve) {
      this.stopResolve();
      this.stopResolve = null;
    }
  }

  getState(): WatcherState {
    return {
      ...this.state,
      queuedTasks: [...this.queue],
      processedTasks: new Map(this.state.processedTasks),
    };
  }

  // --- Private methods ---

  private setupFileWatcher(): void {
    const tasksDir = join(this.projectRoot, '.ai', 'tasks');
    const configPatterns = CONFIG_FILES.map(f => join(this.projectRoot, '.ai', f));

    const watchPaths = [join(tasksDir, '*.md'), ...configPatterns];

    this.fileWatcher = chokidar.watch(watchPaths, {
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 300,
      },
    });

    this.fileWatcher.on('add', (filePath) => this.handleFileEvent('add', filePath));
    this.fileWatcher.on('change', (filePath) => this.handleFileEvent('change', filePath));
  }

  private handleFileEvent(eventType: string, filePath: string): void {
    const fileName = basename(filePath);

    // Check if it's a config file
    if (CONFIG_FILES.includes(fileName)) {
      this.handleConfigChange(filePath);
      return;
    }

    // It's a task file
    this.handleFileChange(eventType, filePath);
  }

  private handleFileChange(eventType: string, filePath: string): void {
    // Per-file debounce
    const existing = this.debounceTimers.get(filePath);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      this.debounceTimers.delete(filePath);
      const logType = eventType === 'add' ? 'New task detected' : 'Task modified';
      this.logger.info(`${logType}: ${basename(filePath)}`);
      this.enqueueTask(filePath);
    }, this.options.debounceMs);

    this.debounceTimers.set(filePath, timer);
  }

  private handleConfigChange(filePath: string): void {
    const existing = this.debounceTimers.get(filePath);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(async () => {
      this.debounceTimers.delete(filePath);
      this.logger.info(`Config changed: ${basename(filePath)}. Reloading...`);
      try {
        await this.loadConfig();
        this.logger.success('Config reloaded successfully.');
      } catch (error) {
        this.logger.error(`Failed to reload config: ${error instanceof Error ? error.message : 'Unknown error'}. Keeping previous config.`);
      }
    }, this.options.debounceMs);

    this.debounceTimers.set(filePath, timer);
  }

  private enqueueTask(taskPath: string): void {
    // Skip if already queued
    if (this.queue.includes(taskPath)) {
      this.logger.debug(`Task already queued: ${basename(taskPath)}`);
      return;
    }

    // Skip if currently running
    if (this.state.currentTask === taskPath) {
      this.logger.debug(`Task currently running: ${basename(taskPath)}`);
      return;
    }

    this.queue.push(taskPath);
    this.state.queuedTasks = [...this.queue];
    this.processQueue();
  }

  private isStopping(): boolean {
    const s: WatcherStatus = this.state.status;
    return s === 'stopping' || s === 'stopped';
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    if (this.isStopping()) return;

    this.processing = true;

    while (this.queue.length > 0) {
      if (this.isStopping()) break;

      const taskPath = this.queue.shift()!;
      this.state.queuedTasks = [...this.queue];

      const eligible = await this.isTaskEligible(taskPath);
      if (!eligible) {
        this.logger.debug(`Skipping ineligible task: ${basename(taskPath)}`);
        continue;
      }

      this.state.status = 'executing';
      this.state.currentTask = taskPath;

      const result = await this.executeNextTask(taskPath);
      this.notifyResult(taskPath, result);

      this.state.currentTask = null;
      if (!this.isStopping()) {
        this.state.status = 'watching';
      }
    }

    this.processing = false;
  }

  private async executeNextTask(taskPath: string): Promise<ExecutorResult> {
    this.state.tasksExecuted++;
    this.logger.info(`Executing task: ${basename(taskPath)}`);

    try {
      const result = await executeTask(taskPath, {
        dryRun: this.options.dryRun,
        verbose: this.options.verbose,
        maxIterations: this.options.maxIterations,
        // No onAskUser in watch mode -- fully autonomous
      });

      // Record mtime for re-execution prevention
      try {
        const stats = await stat(taskPath);
        this.state.processedTasks.set(taskPath, stats.mtimeMs);
      } catch {
        // Ignore stat errors
      }

      return result;
    } catch (error) {
      return {
        success: false,
        status: 'failed',
        iterations: 0,
        filesModified: [],
        error: error instanceof Error ? error.message : 'Unknown error',
        taskPath,
      };
    }
  }

  private async isTaskEligible(taskPath: string): Promise<boolean> {
    try {
      const content = await readFile(taskPath, 'utf-8');

      // Skip completed tasks
      if (content.includes('## Status:') && content.includes('COMPLETED')) {
        return false;
      }

      // Skip blocked tasks that haven't been modified since last processing
      if (content.includes('## Status:') && content.includes('BLOCKED')) {
        const lastMtime = this.state.processedTasks.get(taskPath);
        if (lastMtime !== undefined) {
          const stats = await stat(taskPath);
          if (stats.mtimeMs <= lastMtime) {
            return false; // Unchanged blocked task
          }
        }
        // Blocked but modified -- allow re-run (might have been unblocked)
        return true;
      }

      // Check mtime for re-execution prevention of pending tasks
      const lastMtime = this.state.processedTasks.get(taskPath);
      if (lastMtime !== undefined) {
        const stats = await stat(taskPath);
        if (stats.mtimeMs <= lastMtime) {
          return false; // Already processed and unchanged
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  async loadConfig(): Promise<void> {
    const aiDir = join(this.projectRoot, '.ai');

    for (const fileName of CONFIG_FILES) {
      const configPath = join(aiDir, fileName);
      if (existsSync(configPath)) {
        const content = await readFile(configPath, 'utf-8');
        if (configPath.endsWith('.json')) {
          this.config = JSON.parse(content);
        } else {
          this.config = parseYaml(content);
        }
        this.logger.debug(`Loaded config from ${fileName}`);
        return;
      }
    }

    // No config found -- use defaults
    this.config = null;
    this.logger.debug('No config file found. Using defaults.');
  }

  private async scanExistingTasks(): Promise<void> {
    const tasksDir = join(this.projectRoot, '.ai', 'tasks');

    if (!existsSync(tasksDir)) {
      this.logger.debug('No tasks directory found.');
      return;
    }

    try {
      const files = await readdir(tasksDir);
      const taskFiles = files
        .filter(f => f.endsWith('.md') && !f.startsWith('.'))
        .sort()
        .map(f => join(tasksDir, f));

      let enqueued = 0;
      for (const taskPath of taskFiles) {
        const eligible = await this.isTaskEligible(taskPath);
        if (eligible) {
          this.enqueueTask(taskPath);
          enqueued++;
        }
      }

      if (enqueued > 0) {
        this.logger.info(`Found ${enqueued} pending task(s) on startup.`);
      } else {
        this.logger.info('No pending tasks found. Watching for new tasks...');
      }
    } catch (error) {
      this.logger.debug(`Error scanning tasks: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  private notifyResult(taskPath: string, result: ExecutorResult): void {
    const name = basename(taskPath);

    if (result.success) {
      this.state.tasksCompleted++;
      this.logger.box('Task Completed', [
        `Task: ${name}`,
        `Iterations: ${result.iterations}`,
        `Files: ${result.filesModified.length}`,
      ].join('\n'));
    } else if (result.status === 'blocked') {
      this.state.tasksBlocked++;
      this.logger.box('Task Blocked', [
        `Task: ${name}`,
        `Reason: ${result.blockedReason || 'Unknown'}`,
        `Iterations: ${result.iterations}`,
      ].join('\n'));
    } else {
      this.state.tasksFailed++;
      this.logger.box('Task Failed', [
        `Task: ${name}`,
        `Error: ${result.error || 'Unknown error'}`,
        `Iterations: ${result.iterations}`,
      ].join('\n'));
    }
  }

  private printSummary(): void {
    const elapsed = this.state.startedAt
      ? Math.round((Date.now() - this.state.startedAt.getTime()) / 1000)
      : 0;

    this.logger.box('Watch Session Summary', [
      `Duration: ${elapsed}s`,
      `Tasks executed: ${this.state.tasksExecuted}`,
      `  Completed: ${this.state.tasksCompleted}`,
      `  Blocked: ${this.state.tasksBlocked}`,
      `  Failed: ${this.state.tasksFailed}`,
    ].join('\n'));
  }
}
