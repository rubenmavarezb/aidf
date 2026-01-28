// packages/cli/src/core/context-loader.ts

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import type { LoadedContext, ParsedTask, ParsedRole, ParsedAgents, TaskScope } from '../types/index.js';

export class ContextLoader {
  private aiDir: string;

  constructor(projectRoot: string) {
    this.aiDir = join(projectRoot, '.ai');
  }

  /**
   * Encuentra el directorio .ai subiendo desde el cwd
   */
  static findAiDir(startFrom: string = process.cwd()): string | null {
    let current = startFrom;
    while (current !== dirname(current)) {
      if (existsSync(join(current, '.ai', 'AGENTS.md'))) {
        return current;
      }
      current = dirname(current);
    }
    return null;
  }

  /**
   * Carga todo el contexto necesario para ejecutar una task
   */
  async loadContext(taskPath: string): Promise<LoadedContext> {
    const task = await this.parseTask(taskPath);
    const roleName = task.suggestedRoles[0] || 'developer';
    const role = await this.parseRole(roleName);
    const agents = await this.parseAgents();
    const plan = await this.loadPlanIfExists();

    return { agents, role, task, plan };
  }

  /**
   * Parsea un archivo de task
   */
  async parseTask(taskPath: string): Promise<ParsedTask> {
    if (!existsSync(taskPath)) {
      throw new Error(`Task file not found: ${taskPath}`);
    }

    const content = await readFile(taskPath, 'utf-8');

    return {
      filePath: taskPath,
      goal: this.extractSection(content, 'Goal'),
      taskType: this.extractTaskType(content),
      suggestedRoles: this.extractList(content, 'Suggested Roles'),
      scope: this.extractScope(content),
      requirements: this.extractSection(content, 'Requirements'),
      definitionOfDone: this.extractChecklist(content, 'Definition of Done'),
      notes: this.extractSection(content, 'Notes') || undefined,
      raw: content,
    };
  }

  /**
   * Parsea un archivo de rol
   */
  async parseRole(roleName: string): Promise<ParsedRole> {
    const rolePath = join(this.aiDir, 'roles', `${roleName}.md`);

    if (!existsSync(rolePath)) {
      throw new Error(`Role file not found: ${rolePath}. Available roles are in ${join(this.aiDir, 'roles')}`);
    }

    const content = await readFile(rolePath, 'utf-8');

    return {
      name: roleName,
      identity: this.extractSection(content, 'Identity'),
      expertise: this.extractList(content, 'Expertise'),
      responsibilities: this.extractList(content, 'Responsibilities'),
      constraints: this.extractList(content, 'Constraints'),
      qualityCriteria: this.extractList(content, 'Quality Criteria'),
      outputFormat: this.extractSection(content, 'Output Format') || undefined,
      raw: content,
    };
  }

  /**
   * Parsea AGENTS.md
   */
  async parseAgents(): Promise<ParsedAgents> {
    const agentsPath = join(this.aiDir, 'AGENTS.md');

    if (!existsSync(agentsPath)) {
      throw new Error(`AGENTS.md not found at ${agentsPath}. Run \`aidf init\` first.`);
    }

    const content = await readFile(agentsPath, 'utf-8');

    return {
      projectOverview: this.extractSection(content, 'Project Overview'),
      architecture: this.extractSection(content, 'Architecture'),
      technologyStack: this.extractSection(content, 'Technology Stack'),
      conventions: this.extractSection(content, 'Conventions'),
      qualityStandards: this.extractSection(content, 'Quality Standards'),
      boundaries: {
        neverModify: this.extractListFromSubsection(content, 'Boundaries', 'Never Modify Without Approval'),
        neverDo: this.extractListFromSubsection(content, 'Boundaries', 'Never Do'),
        requiresDiscussion: this.extractListFromSubsection(content, 'Boundaries', 'Requires Discussion'),
      },
      commands: this.extractCommands(content),
      raw: content,
    };
  }

  /**
   * Carga IMPLEMENTATION_PLAN.md si existe
   */
  async loadPlanIfExists(): Promise<string | undefined> {
    const planPath = join(this.aiDir, 'IMPLEMENTATION_PLAN.md');
    if (existsSync(planPath)) {
      return readFile(planPath, 'utf-8');
    }
    return undefined;
  }

  // --- Helpers de parsing ---

  private extractSection(content: string, sectionName: string): string {
    const regex = new RegExp(`## ${sectionName}\\n([\\s\\S]*?)(?=\\n## |$)`, 'i');
    const match = content.match(regex);
    return match ? match[1].trim() : '';
  }

  private extractTaskType(content: string): ParsedTask['taskType'] {
    const section = this.extractSection(content, 'Task Type');
    const type = section.toLowerCase().trim();
    const validTypes = ['component', 'refactor', 'test', 'docs', 'architecture', 'bugfix'];
    return validTypes.includes(type) ? type as ParsedTask['taskType'] : 'component';
  }

  private extractList(content: string, sectionName: string): string[] {
    const section = this.extractSection(content, sectionName);
    return section
      .split('\n')
      .filter(line => line.trim().startsWith('-'))
      .map(line => line.replace(/^-\s*/, '').trim());
  }

  private extractChecklist(content: string, sectionName: string): string[] {
    const section = this.extractSection(content, sectionName);
    return section
      .split('\n')
      .filter(line => line.trim().match(/^-\s*\[[ x]\]/i))
      .map(line => line.replace(/^-\s*\[[ x]\]\s*/i, '').trim());
  }

  private extractScope(content: string): TaskScope {
    const scopeSection = this.extractSection(content, 'Scope');

    const allowedMatch = scopeSection.match(/### Allowed\n([\s\S]*?)(?=\n### |$)/i);
    const forbiddenMatch = scopeSection.match(/### Forbidden\n([\s\S]*?)(?=\n### |$)/i);
    const askBeforeMatch = scopeSection.match(/### Ask Before\n([\s\S]*?)(?=\n### |$)/i);

    const extractPaths = (text: string | undefined): string[] => {
      if (!text) return [];
      return text
        .split('\n')
        .filter(line => line.trim().startsWith('-'))
        .map(line => line.replace(/^-\s*/, '').replace(/`/g, '').trim());
    };

    return {
      allowed: extractPaths(allowedMatch?.[1]),
      forbidden: extractPaths(forbiddenMatch?.[1]),
      ask_before: askBeforeMatch ? extractPaths(askBeforeMatch[1]) : undefined,
    };
  }

  private extractListFromSubsection(content: string, section: string, subsection: string): string[] {
    const sectionContent = this.extractSection(content, section);
    const subsectionMatch = sectionContent.match(new RegExp(`### ${subsection}\\n([\\s\\S]*?)(?=\\n### |$)`, 'i'));
    if (!subsectionMatch) return [];

    return subsectionMatch[1]
      .split('\n')
      .filter(line => line.trim().startsWith('-'))
      .map(line => line.replace(/^-\s*/, '').trim());
  }

  private extractCommands(content: string): ParsedAgents['commands'] {
    const commandsSection = this.extractSection(content, 'Commands');

    const extractCommandBlock = (subsection: string): Record<string, string> => {
      const match = commandsSection.match(new RegExp(`### ${subsection}\\n([\\s\\S]*?)(?=\\n### |$)`, 'i'));
      if (!match) return {};

      const commands: Record<string, string> = {};
      const codeBlockMatch = match[1].match(/```(?:bash|sh)?\n([\s\S]*?)```/);
      if (codeBlockMatch) {
        codeBlockMatch[1].split('\n').forEach(line => {
          const cmdMatch = line.match(/^(.+?)\s{2,}#\s*(.+)$/);
          if (cmdMatch) {
            commands[cmdMatch[1]] = cmdMatch[2];
          }
        });
      }
      return commands;
    };

    return {
      development: extractCommandBlock('Development'),
      quality: extractCommandBlock('Quality Checks'),
      build: extractCommandBlock('Build & Deploy'),
    };
  }
}

export async function loadContext(taskPath: string): Promise<LoadedContext> {
  const projectRoot = ContextLoader.findAiDir();
  if (!projectRoot) {
    throw new Error('No .ai directory found. Run `aidf init` first.');
  }
  const loader = new ContextLoader(projectRoot);
  return loader.loadContext(taskPath);
}
