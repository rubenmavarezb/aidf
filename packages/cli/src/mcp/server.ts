// packages/cli/src/mcp/server.ts

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import YAML from 'yaml';
import { ContextLoader } from '../core/context-loader.js';
import { runValidation } from '../core/validator.js';
import { analyzeProject, formatProfile } from '../core/project-analyzer.js';
import type { AidfConfig } from '../types/index.js';

/**
 * Creates and configures the AIDF MCP server.
 */
export function createMcpServer(projectRoot?: string): McpServer {
  const cwd = projectRoot ?? process.cwd();
  const server = new McpServer({
    name: 'aidf',
    version: '0.7.0',
  });

  // === Tools ===

  server.tool(
    'aidf_list_tasks',
    'List all AIDF tasks with their status',
    {},
    async () => {
      const aiDir = findAiDir(cwd);
      if (!aiDir) {
        return { content: [{ type: 'text' as const, text: 'No .ai directory found. Run `aidf init` first.' }] };
      }

      const tasks = listTasks(aiDir);
      if (tasks.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No tasks found. Create one with `aidf task create`.' }] };
      }

      const output = tasks
        .map(t => `[${t.status}] ${t.name} — ${t.path}`)
        .join('\n');

      return { content: [{ type: 'text' as const, text: output }] };
    },
  );

  server.tool(
    'aidf_get_context',
    'Load full AIDF context (AGENTS.md + role + skills) for a task',
    { taskPath: z.string().describe('Path to the task file (relative to project root)') },
    async ({ taskPath }) => {
      const aiDir = findAiDir(cwd);
      if (!aiDir) {
        return { content: [{ type: 'text' as const, text: 'No .ai directory found.' }] };
      }

      try {
        const fullPath = join(cwd, taskPath);
        const loader = new ContextLoader(aiDir);
        const context = await loader.loadContext(fullPath);

        const parts: string[] = [];
        parts.push('# AGENTS.md\n');
        parts.push(context.agents.raw);
        parts.push('\n\n# Role: ' + context.role.name + '\n');
        parts.push(context.role.raw);
        parts.push('\n\n# Task\n');
        parts.push(context.task.raw);

        if (context.skills && context.skills.length > 0) {
          parts.push('\n\n# Skills\n');
          for (const skill of context.skills) {
            parts.push(`\n## ${skill.metadata.name}\n`);
            parts.push(skill.content);
          }
        }

        return { content: [{ type: 'text' as const, text: parts.join('') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error loading context: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'aidf_validate',
    'Run validation commands (pre_commit hooks from config.yml)',
    {},
    async () => {
      const aiDir = findAiDir(cwd);
      if (!aiDir) {
        return { content: [{ type: 'text' as const, text: 'No .ai directory found.' }] };
      }

      const config = loadConfig(join(aiDir, '.ai', 'config.yml'));
      if (!config) {
        return { content: [{ type: 'text' as const, text: 'No config.yml found.' }] };
      }

      const commands = config.validation?.pre_commit ?? [];
      if (commands.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No pre_commit validation commands configured.' }] };
      }

      const summary = await runValidation(commands, 'pre_commit', cwd);

      const results = summary.results
        .map(r => `${r.passed ? 'PASS' : 'FAIL'} ${r.command} (${r.duration}ms)${r.passed ? '' : '\n  ' + r.output.slice(0, 500)}`)
        .join('\n');

      return {
        content: [{
          type: 'text' as const,
          text: `Validation ${summary.passed ? 'PASSED' : 'FAILED'}\n\n${results}`,
        }],
      };
    },
  );

  server.tool(
    'aidf_create_task',
    'Create a new AIDF task file from a description',
    {
      name: z.string().describe('Short task name (used as filename, e.g., "add-auth")'),
      goal: z.string().describe('What needs to be accomplished'),
      taskType: z.enum(['component', 'refactor', 'test', 'docs', 'architecture', 'bugfix']).default('component').describe('Type of task'),
      allowedPaths: z.array(z.string()).default([]).describe('File paths/globs allowed to modify'),
      forbiddenPaths: z.array(z.string()).default([]).describe('File paths/globs that must not be modified'),
      role: z.string().default('developer').describe('Suggested role'),
    },
    async ({ name, goal, taskType, allowedPaths, forbiddenPaths, role }) => {
      const aiDir = findAiDir(cwd);
      if (!aiDir) {
        return { content: [{ type: 'text' as const, text: 'No .ai directory found. Run `aidf init` first.' }] };
      }

      const tasksDir = join(aiDir, '.ai', 'tasks');
      if (!existsSync(tasksDir)) {
        mkdirSync(tasksDir, { recursive: true });
      }

      const fileName = `${name}.md`;
      const taskPath = join(tasksDir, fileName);

      if (existsSync(taskPath)) {
        return { content: [{ type: 'text' as const, text: `Task "${name}" already exists at ${taskPath}` }], isError: true };
      }

      const allowed = allowedPaths.length > 0
        ? allowedPaths.map(p => `- \`${p}\``).join('\n')
        : '- `src/**`';
      const forbidden = forbiddenPaths.length > 0
        ? forbiddenPaths.map(p => `- \`${p}\``).join('\n')
        : '- `.env*`';

      const content = `# Task: ${name}

## Goal
${goal}

## Task Type
${taskType}

## Suggested Roles
- ${role}

## Scope

### Allowed
${allowed}

### Forbidden
${forbidden}

## Requirements
${goal}

## Definition of Done
- [ ] Implementation complete
- [ ] Tests pass
- [ ] Linting passes

## Notes
Created via MCP server.
`;

      writeFileSync(taskPath, content);
      return { content: [{ type: 'text' as const, text: `Task created: ${taskPath}` }] };
    },
  );

  server.tool(
    'aidf_analyze_project',
    'Analyze the project and return a profile (framework, package manager, etc.)',
    {},
    async () => {
      const profile = analyzeProject(cwd);
      return { content: [{ type: 'text' as const, text: formatProfile(profile) }] };
    },
  );

  // === Resources ===

  server.resource(
    'agents',
    'aidf://agents',
    { description: 'AGENTS.md — Project context document', mimeType: 'text/markdown' },
    async () => {
      const aiDir = findAiDir(cwd);
      if (!aiDir) {
        return { contents: [{ uri: 'aidf://agents', text: 'No .ai directory found.', mimeType: 'text/markdown' }] };
      }

      const agentsPath = join(aiDir, '.ai', 'AGENTS.md');
      if (!existsSync(agentsPath)) {
        return { contents: [{ uri: 'aidf://agents', text: 'AGENTS.md not found.', mimeType: 'text/markdown' }] };
      }

      return {
        contents: [{ uri: 'aidf://agents', text: readFileSync(agentsPath, 'utf-8'), mimeType: 'text/markdown' }],
      };
    },
  );

  server.resource(
    'config',
    'aidf://config',
    { description: 'config.yml — AIDF configuration', mimeType: 'text/yaml' },
    async () => {
      const aiDir = findAiDir(cwd);
      if (!aiDir) {
        return { contents: [{ uri: 'aidf://config', text: 'No .ai directory found.', mimeType: 'text/yaml' }] };
      }

      const configPath = join(aiDir, '.ai', 'config.yml');
      if (!existsSync(configPath)) {
        return { contents: [{ uri: 'aidf://config', text: 'config.yml not found.', mimeType: 'text/yaml' }] };
      }

      return {
        contents: [{ uri: 'aidf://config', text: readFileSync(configPath, 'utf-8'), mimeType: 'text/yaml' }],
      };
    },
  );

  // Resource templates for dynamic resources
  server.resource(
    'task',
    new ResourceTemplate('aidf://tasks/{name}', { list: undefined }),
    { description: 'Task file content', mimeType: 'text/markdown' },
    async (uri: URL, variables: Record<string, string | string[]>) => {
      const name = Array.isArray(variables.name) ? variables.name[0] : variables.name;
      const aiDir = findAiDir(cwd);
      if (!aiDir) {
        return { contents: [{ uri: uri.href, text: 'No .ai directory found.', mimeType: 'text/markdown' }] };
      }

      const tasksDir = join(aiDir, '.ai', 'tasks');
      const taskFile = findTaskFile(tasksDir, name);

      if (!taskFile) {
        return { contents: [{ uri: uri.href, text: `Task "${name}" not found.`, mimeType: 'text/markdown' }] };
      }

      return {
        contents: [{ uri: uri.href, text: readFileSync(taskFile, 'utf-8'), mimeType: 'text/markdown' }],
      };
    },
  );

  server.resource(
    'role',
    new ResourceTemplate('aidf://roles/{name}', { list: undefined }),
    { description: 'Role definition', mimeType: 'text/markdown' },
    async (uri: URL, variables: Record<string, string | string[]>) => {
      const name = Array.isArray(variables.name) ? variables.name[0] : variables.name;
      const aiDir = findAiDir(cwd);
      if (!aiDir) {
        return { contents: [{ uri: uri.href, text: 'No .ai directory found.', mimeType: 'text/markdown' }] };
      }

      const rolePath = join(aiDir, '.ai', 'roles', `${name}.md`);
      if (!existsSync(rolePath)) {
        return { contents: [{ uri: uri.href, text: `Role "${name}" not found.`, mimeType: 'text/markdown' }] };
      }

      return {
        contents: [{ uri: uri.href, text: readFileSync(rolePath, 'utf-8'), mimeType: 'text/markdown' }],
      };
    },
  );

  return server;
}

/**
 * Starts the MCP server on stdio transport.
 */
export async function startMcpServer(projectRoot?: string): Promise<void> {
  const server = createMcpServer(projectRoot);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// === Helpers ===

function findAiDir(startFrom: string): string | null {
  return ContextLoader.findAiDir(startFrom);
}

interface TaskInfo {
  name: string;
  path: string;
  status: string;
}

function listTasks(projectRoot: string): TaskInfo[] {
  const tasksDir = join(projectRoot, '.ai', 'tasks');
  if (!existsSync(tasksDir)) return [];

  const tasks: TaskInfo[] = [];
  const statusDirs = ['pending', 'completed', 'blocked'];

  // Check status subdirectories
  for (const status of statusDirs) {
    const dir = join(tasksDir, status);
    if (existsSync(dir)) {
      try {
        const files = readdirSync(dir).filter(f => f.endsWith('.md'));
        for (const file of files) {
          tasks.push({
            name: file.replace('.md', ''),
            path: join('.ai', 'tasks', status, file),
            status,
          });
        }
      } catch {
        // Skip unreadable directories
      }
    }
  }

  // Check for task files directly in tasks/
  try {
    const files = readdirSync(tasksDir).filter(f => f.endsWith('.md'));
    for (const file of files) {
      if (!tasks.some(t => t.name === file.replace('.md', ''))) {
        tasks.push({
          name: file.replace('.md', ''),
          path: join('.ai', 'tasks', file),
          status: 'pending',
        });
      }
    }
  } catch {
    // Skip
  }

  return tasks;
}

function findTaskFile(tasksDir: string, name: string): string | null {
  const fileName = name.endsWith('.md') ? name : `${name}.md`;

  const directPath = join(tasksDir, fileName);
  if (existsSync(directPath)) return directPath;

  for (const status of ['pending', 'completed', 'blocked']) {
    const statusPath = join(tasksDir, status, fileName);
    if (existsSync(statusPath)) return statusPath;
  }

  return null;
}

function loadConfig(configPath: string): AidfConfig | null {
  if (!existsSync(configPath)) return null;
  try {
    const content = readFileSync(configPath, 'utf-8');
    return YAML.parse(content) as AidfConfig;
  } catch {
    return null;
  }
}
