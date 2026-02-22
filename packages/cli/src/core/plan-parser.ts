// packages/cli/src/core/plan-parser.ts

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, basename } from 'path';
import type { PlanTask, PlanWave, ParsedPlan } from '../types/index.js';

/**
 * Regex to match plan task lines:
 * - [ ] `filename.md` — description
 * - [x] `filename.md` — description (wave: 2, depends: foo.md, bar.md)
 *
 * Supports —, –, and - as separators.
 */
const TASK_LINE_RE =
  /^- \[([ xX])\]\s+`([^`]+\.md)`\s+[—–-]\s+(.+?)(?:\s+\(([^)]+)\))?\s*$/;

const WAVE_RE = /wave:\s*(\d+)/i;
const DEPENDS_RE = /depends?:\s*(.+)/i;

export class PlanParser {
  /**
   * Parse a plan markdown file and extract tasks, waves, and metadata.
   */
  async parse(planPath: string, projectRoot: string): Promise<ParsedPlan> {
    const content = await readFile(planPath, 'utf-8');
    const lines = content.split('\n');

    const name = this.extractName(lines);
    const overview = this.extractOverview(lines);
    const tasks = this.extractTasks(lines, projectRoot);

    this.assignDefaultWaves(tasks);
    this.validateNoCycles(tasks);

    const waves = this.groupByWaves(tasks);

    return { planPath, name, overview, tasks, waves };
  }

  private extractName(lines: string[]): string {
    for (const line of lines) {
      const match = line.match(/^#\s+(?:PLAN:\s*)?(.+)/);
      if (match) return match[1].trim();
    }
    return 'Unnamed Plan';
  }

  private extractOverview(lines: string[]): string {
    let inOverview = false;
    const overviewLines: string[] = [];

    for (const line of lines) {
      if (/^##\s+Overview/i.test(line)) {
        inOverview = true;
        continue;
      }
      if (inOverview) {
        if (/^##\s/.test(line)) break;
        overviewLines.push(line);
      }
    }

    return overviewLines.join('\n').trim();
  }

  /**
   * Extract task references from checkbox lines.
   */
  extractTasks(lines: string[], projectRoot: string): PlanTask[] {
    const tasks: PlanTask[] = [];

    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(TASK_LINE_RE);
      if (!match) continue;

      const [, checkmark, filename, description, metadata] = match;
      const completed = checkmark.toLowerCase() === 'x';

      let wave = 0; // 0 = unassigned
      const dependsOn: string[] = [];

      if (metadata) {
        const waveMatch = metadata.match(WAVE_RE);
        if (waveMatch) wave = parseInt(waveMatch[1], 10);

        const depsMatch = metadata.match(DEPENDS_RE);
        if (depsMatch) {
          const deps = depsMatch[1].split(',').map((d: string) => d.trim()).filter(Boolean);
          dependsOn.push(...deps);
        }
      }

      const taskPath = this.resolveTaskPath(filename, projectRoot);

      tasks.push({
        filename,
        taskPath,
        description: description.trim(),
        wave,
        dependsOn,
        completed,
        lineNumber: i + 1, // 1-based
      });
    }

    return tasks;
  }

  /**
   * Resolve the full path of a task file by searching standard directories.
   */
  resolveTaskPath(filename: string, projectRoot: string): string {
    const searchDirs = [
      join(projectRoot, '.ai', 'tasks', 'pending'),
      join(projectRoot, '.ai', 'tasks', 'blocked'),
      join(projectRoot, '.ai', 'tasks', 'completed'),
      join(projectRoot, '.ai', 'tasks'),
    ];

    for (const dir of searchDirs) {
      const fullPath = join(dir, filename);
      if (existsSync(fullPath)) return fullPath;
    }

    // Fallback: return the pending path even if not found yet
    return join(projectRoot, '.ai', 'tasks', 'pending', filename);
  }

  /**
   * Assign wave 1 to tasks without explicit wave.
   * Tasks with dependencies get wave = max(dependency waves) + 1.
   */
  private assignDefaultWaves(tasks: PlanTask[]): void {
    const taskMap = new Map(tasks.map((t: PlanTask) => [t.filename, t]));

    // First pass: assign wave 1 to tasks with no explicit wave and no dependencies
    for (const task of tasks) {
      if (task.wave === 0 && task.dependsOn.length === 0) {
        task.wave = 1;
      }
    }

    // Second pass: resolve waves for tasks with dependencies
    const resolved = new Set<string>();
    const resolveWave = (task: PlanTask): number => {
      if (task.wave > 0) return task.wave;
      if (resolved.has(task.filename)) return task.wave;

      resolved.add(task.filename);

      if (task.dependsOn.length === 0) {
        task.wave = 1;
        return 1;
      }

      let maxDepWave = 0;
      for (const depName of task.dependsOn) {
        const dep = taskMap.get(depName);
        if (dep) {
          maxDepWave = Math.max(maxDepWave, resolveWave(dep));
        }
      }

      task.wave = maxDepWave + 1;
      return task.wave;
    };

    for (const task of tasks) {
      resolveWave(task);
    }

    // Final fallback: any remaining wave=0 gets wave 1
    for (const task of tasks) {
      if (task.wave === 0) task.wave = 1;
    }
  }

  /**
   * Detect dependency cycles using DFS.
   * Throws if a cycle is found.
   */
  private validateNoCycles(tasks: PlanTask[]): void {
    const taskMap = new Map(tasks.map((t: PlanTask) => [t.filename, t]));

    const visiting = new Set<string>();
    const visited = new Set<string>();

    const dfs = (filename: string, path: string[]): void => {
      if (visited.has(filename)) return;
      if (visiting.has(filename)) {
        const cycle = [...path.slice(path.indexOf(filename)), filename];
        throw new Error(`Dependency cycle detected: ${cycle.join(' -> ')}`);
      }

      visiting.add(filename);
      path.push(filename);

      const task = taskMap.get(filename);
      if (task) {
        for (const dep of task.dependsOn) {
          dfs(dep, [...path]);
        }
      }

      visiting.delete(filename);
      visited.add(filename);
    };

    for (const task of tasks) {
      dfs(task.filename, []);
    }
  }

  /**
   * Group tasks into waves sorted by wave number.
   */
  private groupByWaves(tasks: PlanTask[]): PlanWave[] {
    const waveMap = new Map<number, PlanTask[]>();

    for (const task of tasks) {
      const existing = waveMap.get(task.wave) || [];
      existing.push(task);
      waveMap.set(task.wave, existing);
    }

    return [...waveMap.entries()]
      .sort(([a], [b]) => a - b)
      .map(([number, waveTasks]): PlanWave => ({ number, tasks: waveTasks }));
  }

  /**
   * Update a checkbox in the plan file from [ ] to [x].
   */
  static async markTaskCompleted(planPath: string, lineNumber: number): Promise<void> {
    const content = await readFile(planPath, 'utf-8');
    const lines = content.split('\n');
    const idx = lineNumber - 1; // Convert to 0-based

    if (idx >= 0 && idx < lines.length) {
      lines[idx] = lines[idx].replace('- [ ]', '- [x]');
      const { writeFile: writeFileAsync } = await import('fs/promises');
      await writeFileAsync(planPath, lines.join('\n'));
    }
  }

  /**
   * Get plan name from a file path without reading it (uses basename).
   */
  static planNameFromPath(planPath: string): string {
    return basename(planPath, '.md');
  }
}
