# TASK: Implementar Context Loader

## Goal
Crear el módulo que parsea y carga AGENTS.md, archivos de rol, y tasks en memoria para el executor.

## Status: ✅ COMPLETED

- **Completed:** 2026-01-27
- **Agent:** Claude Code (parallel session 1)
- **Tests:** 16 passed
- **Files Created:** context-loader.ts, context-loader.test.ts

## Task Type
component

## Suggested Roles
- developer

## Auto-Mode Compatible
✅ **SÍ** - Cursor auto-mode funciona bien. Lógica clara, sin ambigüedades.

## Scope

### Allowed
- `packages/cli/src/core/context-loader.ts`
- `packages/cli/src/types/index.ts`
- `packages/cli/src/core/context-loader.test.ts`

### Forbidden
- `templates/**`
- Cualquier archivo fuera de `packages/cli/`

## Requirements

### 1. Tipos a definir en `types/index.ts`

```typescript
export interface TaskScope {
  allowed: string[];
  forbidden: string[];
  ask_before?: string[];
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
  plan?: string;  // IMPLEMENTATION_PLAN.md content if exists
}
```

### 2. Implementar `context-loader.ts`

```typescript
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
          const cmdMatch = line.match(/^(\S+)\s+#\s*(.+)$/);
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
```

### 3. Tests en `context-loader.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { ContextLoader } from './context-loader.js';

describe('ContextLoader', () => {
  describe('extractSection', () => {
    it('should extract a section by heading', () => {
      // Test implementation
    });
  });

  describe('parseTask', () => {
    it('should parse task type correctly', () => {
      // Test implementation
    });

    it('should extract scope allowed/forbidden paths', () => {
      // Test implementation
    });

    it('should extract definition of done checklist', () => {
      // Test implementation
    });
  });

  describe('parseRole', () => {
    it('should parse role expertise list', () => {
      // Test implementation
    });
  });
});
```

## Definition of Done
- [ ] `ContextLoader` class implementada completa
- [ ] Puede parsear AGENTS.md correctamente
- [ ] Puede parsear archivos de rol
- [ ] Puede parsear archivos de task incluyendo scope
- [ ] Función `loadContext()` exportada y funcional
- [ ] Tests unitarios pasan
- [ ] TypeScript compila sin errores
- [ ] Maneja errores gracefully (archivo no encontrado, formato inválido)

## Notes
- El parsing de markdown es regex-based, no necesitamos un parser completo
- Los paths en scope pueden incluir globs (`**/*.ts`)
- Si no hay rol sugerido, usar "developer" por defecto
- El content "raw" se guarda para poder pasarlo completo al LLM si es necesario
