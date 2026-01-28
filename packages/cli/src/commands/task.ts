// packages/cli/src/commands/task.ts

import { Command } from 'commander';
import { existsSync } from 'fs';
import { readFile, writeFile, readdir } from 'fs/promises';
import { join, basename } from 'path';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { Logger } from '../utils/logger.js';
import { ContextLoader } from '../core/context-loader.js';
import { findTemplatesDir } from '../utils/files.js';
import type { ParsedTask } from '../types/index.js';

export function createTaskCommand(): Command {
  const cmd = new Command('task')
    .description('Manage AIDF tasks');

  // Subcomando: create
  cmd
    .command('create')
    .description('Create a new task interactively')
    .option('-t, --template <name>', 'Use specific template')
    .option('--log-format <format>', 'Log format (text|json)', 'text')
    .option('--log-file <path>', 'Write logs to file')
    .option('--log-rotate', 'Enable log rotation (append timestamp to filename)')
    .action(async (options) => {
      const logger = new Logger({
        logFormat: options.logFormat as 'text' | 'json' | undefined,
        logFile: options.logFile,
        logRotate: options.logRotate,
      });

      try {
        const projectRoot = ContextLoader.findAiDir();
        if (!projectRoot) {
          logger.error('No AIDF project found. Run `aidf init` first.');
          process.exit(1);
        }

        const answers = await promptForTask(projectRoot, options.template);
        const taskPath = await createTaskFile(projectRoot, answers, logger);

        logger.success(`Created: ${taskPath}`);
        logger.info(`Run: aidf run ${taskPath}`);
        await logger.close();

      } catch (error) {
        logger.error(error instanceof Error ? error.message : 'Unknown error');
        await logger.close();
        process.exit(1);
      }
    });

  // Subcomando: list
  cmd
    .command('list')
    .alias('ls')
    .description('List all tasks')
    .option('-a, --all', 'Include completed tasks')
    .option('--log-format <format>', 'Log format (text|json)', 'text')
    .option('--log-file <path>', 'Write logs to file')
    .option('--log-rotate', 'Enable log rotation (append timestamp to filename)')
    .action(async (options) => {
      const logger = new Logger({
        logFormat: options.logFormat as 'text' | 'json' | undefined,
        logFile: options.logFile,
        logRotate: options.logRotate,
      });

      try {
        const projectRoot = ContextLoader.findAiDir();
        if (!projectRoot) {
          logger.error('No AIDF project found.');
          process.exit(1);
        }

        logger.setContext({ command: 'task list' });
        const tasks = await listTasks(projectRoot, options.all);
        printTaskList(tasks, logger);
        await logger.close();

      } catch (error) {
        logger.error(error instanceof Error ? error.message : 'Unknown error');
        await logger.close();
        process.exit(1);
      }
    });

  // Subcomando: status
  cmd
    .command('status [task]')
    .description('Show task status')
    .option('--log-format <format>', 'Log format (text|json)', 'text')
    .option('--log-file <path>', 'Write logs to file')
    .option('--log-rotate', 'Enable log rotation (append timestamp to filename)')
    .action(async (taskArg, options) => {
      const logger = new Logger({
        logFormat: options.logFormat as 'text' | 'json' | undefined,
        logFile: options.logFile,
        logRotate: options.logRotate,
      });

      try {
        const projectRoot = ContextLoader.findAiDir();
        if (!projectRoot) {
          logger.error('No AIDF project found.');
          process.exit(1);
        }

        const loader = new ContextLoader(projectRoot);

        logger.setContext({ command: 'task status', task: taskArg });
        if (taskArg) {
          const task = await loader.parseTask(taskArg);
          printTaskDetails(task, logger);
        } else {
          const tasks = await listTasks(projectRoot, true);
          printTaskSummary(tasks, logger);
        }
        await logger.close();

      } catch (error) {
        logger.error(error instanceof Error ? error.message : 'Unknown error');
        await logger.close();
        process.exit(1);
      }
    });

  return cmd;
}

interface TaskAnswers {
  template?: string;
  goal: string;
  taskType: string;
  suggestedRoles: string[];
  allowedPaths: string;
  forbiddenPaths: string;
  requirements: string;
  definitionOfDone: string[];
}

interface TaskTemplate {
  name: string;
  path: string;
  content: string;
}

interface ParsedTemplate {
  goal?: string;
  taskType?: string;
  suggestedRoles?: string[];
  allowedPaths?: string;
  forbiddenPaths?: string;
  requirements?: string;
  definitionOfDone?: string[];
}

/**
 * Find available task templates
 */
async function findTaskTemplates(projectRoot: string): Promise<TaskTemplate[]> {
  const templates: TaskTemplate[] = [];

  // Check project's .ai/templates/tasks/ first (user overrides)
  const projectTemplatesDir = join(projectRoot, '.ai', 'templates', 'tasks');
  if (existsSync(projectTemplatesDir)) {
    try {
      const files = await readdir(projectTemplatesDir);
      for (const file of files.filter(f => f.endsWith('.template.md'))) {
        const path = join(projectTemplatesDir, file);
        const content = await readFile(path, 'utf-8');
        const name = file.replace('.template.md', '').replace(/-/g, ' ');
        templates.push({ name, path, content });
      }
    } catch {
      // Ignore errors
    }
  }

  // Check package templates directory
  try {
    const templatesDir = findTemplatesDir();
    const tasksTemplatesDir = join(templatesDir, 'templates', 'tasks');
    if (existsSync(tasksTemplatesDir)) {
      const files = await readdir(tasksTemplatesDir);
      for (const file of files.filter(f => f.endsWith('.template.md'))) {
        // Skip if already found in project templates (check by filename)
        const templateName = file.replace('.template.md', '');
        if (templates.some(t => basename(t.path).replace('.template.md', '') === templateName)) {
          continue;
        }

        const path = join(tasksTemplatesDir, file);
        const content = await readFile(path, 'utf-8');
        const name = file.replace('.template.md', '').replace(/-/g, ' ');
        templates.push({ name, path, content });
      }
    }
  } catch {
    // Ignore errors if templates dir not found
  }

  return templates;
}

/**
 * Parse template content to extract default values
 */
function parseTemplate(templateContent: string): ParsedTemplate {
  const parsed: ParsedTemplate = {};

  // Extract Goal
  const goalMatch = templateContent.match(/## Goal\n\n(.+?)(?=\n##)/s);
  if (goalMatch) {
    const goal = goalMatch[1].trim();
    if (!goal.startsWith('<')) {
      parsed.goal = goal;
    }
  }

  // Extract Task Type
  const taskTypeMatch = templateContent.match(/## Task Type\n\n(.+?)(?=\n##)/s);
  if (taskTypeMatch) {
    const taskType = taskTypeMatch[1].trim();
    if (!taskType.startsWith('<') && taskType.length > 0) {
      parsed.taskType = taskType;
    }
  }

  // Extract Suggested Roles
  const rolesMatch = templateContent.match(/## Suggested Roles\n\n((?:- .+\n?)+)/);
  if (rolesMatch) {
    const roles = rolesMatch[1]
      .split('\n')
      .filter(line => line.trim().startsWith('-'))
      .map(line => line.replace(/^-\s*/, '').trim())
      .filter(role => !role.startsWith('<') && role.length > 0);
    if (roles.length > 0) {
      parsed.suggestedRoles = roles;
    }
  }

  // Extract Allowed paths
  const allowedMatch = templateContent.match(/### Allowed\n\n((?:- .+\n?)+?)(?=\n### Forbidden)/s);
  if (allowedMatch) {
    const paths = allowedMatch[1]
      .split('\n')
      .filter(line => line.trim().startsWith('-'))
      .map(line => line.replace(/^-\s*/, '').replace(/`/g, '').trim())
      .filter(path => !path.startsWith('<') && path.length > 0);
    if (paths.length > 0) {
      parsed.allowedPaths = paths.join(', ');
    }
  }

  // Extract Forbidden paths
  const forbiddenMatch = templateContent.match(/### Forbidden\n\n((?:- .+\n?)+?)(?=\n##)/s);
  if (forbiddenMatch) {
    const paths = forbiddenMatch[1]
      .split('\n')
      .filter(line => line.trim().startsWith('-'))
      .map(line => line.replace(/^-\s*/, '').replace(/`/g, '').trim())
      .filter(path => !path.startsWith('<') && path.length > 0);
    if (paths.length > 0) {
      parsed.forbiddenPaths = paths.join(', ');
    }
  }

  // Extract Requirements (keep as template content for editor)
  const requirementsMatch = templateContent.match(/## Requirements\n\n([\s\S]+?)(?=\n## Definition of Done)/);
  if (requirementsMatch) {
    parsed.requirements = requirementsMatch[1].trim();
  }

  // Extract Definition of Done
  const doneMatch = templateContent.match(/## Definition of Done\n\n((?:- \[ \].+\n?)+)/);
  if (doneMatch) {
    const items = doneMatch[1]
      .split('\n')
      .filter(line => line.trim().startsWith('- ['))
      .map(line => line.replace(/^-\s*\[ \]\s*/, '').trim())
      .filter(item => !item.startsWith('<') && item.length > 0);
    if (items.length > 0) {
      parsed.definitionOfDone = items;
    }
  }

  return parsed;
}

async function promptForTask(projectRoot: string, templateName?: string): Promise<TaskAnswers> {
  // Find available templates
  const templates = await findTaskTemplates(projectRoot);
  let selectedTemplate: TaskTemplate | undefined;
  let templateDefaults: ParsedTemplate = {};

  // If template name provided via CLI, find it
  if (templateName) {
    selectedTemplate = templates.find(
      t => t.name.toLowerCase().replace(/\s/g, '-') === templateName.toLowerCase()
    );
    if (!selectedTemplate) {
      throw new Error(`Template "${templateName}" not found. Available: ${templates.map(t => t.name).join(', ')}`);
    }
    templateDefaults = parseTemplate(selectedTemplate.content);
  } else if (templates.length > 0) {
    // Prompt for template selection
    const { template } = await inquirer.prompt([
      {
        type: 'list',
        name: 'template',
        message: 'Select a template (or none to start from scratch):',
        choices: [
          { name: 'None (start from scratch)', value: 'none' },
          ...templates.map(t => ({ name: t.name, value: t.name })),
        ],
        default: 'none',
      },
    ]);

    if (template !== 'none') {
      selectedTemplate = templates.find(t => t.name === template);
      if (selectedTemplate) {
        templateDefaults = parseTemplate(selectedTemplate.content);
      }
    }
  }

  // Obtener roles disponibles
  const rolesDir = join(projectRoot, '.ai', 'roles');
  let availableRoles: string[] = ['developer', 'architect', 'tester'];
  try {
    const files = await readdir(rolesDir);
    availableRoles = files
      .filter(f => f.endsWith('.md'))
      .map(f => f.replace('.md', ''));
  } catch {
    // Use defaults
  }

  return inquirer.prompt([
    {
      type: 'input',
      name: 'goal',
      message: 'Task goal (one sentence):',
      default: templateDefaults.goal,
      validate: (input) => input.length > 10 ? true : 'Goal must be descriptive',
    },
    {
      type: 'list',
      name: 'taskType',
      message: 'Task type:',
      choices: [
        'component',
        'refactor',
        'bugfix',
        'test',
        'docs',
        'architecture',
      ],
      default: templateDefaults.taskType,
    },
    {
      type: 'checkbox',
      name: 'suggestedRoles',
      message: 'Suggested roles:',
      choices: availableRoles,
      default: templateDefaults.suggestedRoles || ['developer'],
    },
    {
      type: 'input',
      name: 'allowedPaths',
      message: 'Allowed paths (comma-separated globs):',
      default: templateDefaults.allowedPaths || 'src/**',
    },
    {
      type: 'input',
      name: 'forbiddenPaths',
      message: 'Forbidden paths (comma-separated):',
      default: templateDefaults.forbiddenPaths || '.env*, src/config/**',
    },
    {
      type: 'editor',
      name: 'requirements',
      message: 'Requirements (opens editor):',
      default: templateDefaults.requirements || '- Requirement 1\n- Requirement 2',
    },
    {
      type: 'input',
      name: 'definitionOfDone',
      message: 'Definition of Done (comma-separated criteria):',
      default: templateDefaults.definitionOfDone?.join(', ') || 'Implementation complete, Tests pass, Lint passes',
      filter: (input: string) => input.split(',').map(s => s.trim()),
    },
  ]).then(answers => ({
    ...answers,
    template: selectedTemplate?.name,
  }));
}

async function createTaskFile(
  projectRoot: string,
  answers: TaskAnswers,
  logger: Logger
): Promise<string> {
  const tasksDir = join(projectRoot, '.ai', 'tasks');

  // Generar número de task
  const existingTasks = await readdir(tasksDir).catch(() => []);
  const taskNumbers = existingTasks
    .map(f => parseInt(f.match(/^(\d+)-/)?.[1] || '0', 10))
    .filter(n => !isNaN(n));
  const nextNumber = Math.max(0, ...taskNumbers) + 1;
  const paddedNumber = String(nextNumber).padStart(3, '0');

  // Generar slug del goal
  const slug = answers.goal
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30);

  const fileName = `${paddedNumber}-${slug}.md`;
  const filePath = join(tasksDir, fileName);

  // If template was used, try to preserve more of its structure
  let requirementsContent = answers.requirements;
  if (answers.template) {
    // Try to load template to preserve its structure better
    const templates = await findTaskTemplates(projectRoot);
    const template = templates.find(t => t.name === answers.template);
    if (template) {
      // Extract requirements section from template if it has more structure
      const requirementsMatch = template.content.match(/## Requirements\n\n([\s\S]+?)(?=\n## Definition of Done)/);
      if (requirementsMatch && requirementsMatch[1].includes('\n###')) {
        // Template has structured requirements, use it as base
        requirementsContent = requirementsMatch[1].trim();
      }
    }
  }

  // Generar contenido
  const content = `# TASK

## Goal
${answers.goal}

## Task Type
${answers.taskType}

## Suggested Roles
${answers.suggestedRoles.map(r => `- ${r}`).join('\n')}

## Scope

### Allowed
${answers.allowedPaths.split(',').map(p => `- \`${p.trim()}\``).join('\n')}

### Forbidden
${answers.forbiddenPaths.split(',').map(p => `- \`${p.trim()}\``).join('\n')}

## Requirements
${requirementsContent}

## Definition of Done
${answers.definitionOfDone.map(c => `- [ ] ${c}`).join('\n')}

## Notes
- Created: ${new Date().toISOString()}
${answers.template ? `- Template: ${answers.template}` : ''}
`;

  await writeFile(filePath, content);
  return filePath;
}

interface TaskInfo {
  path: string;
  name: string;
  goal: string;
  type: string;
  status: 'pending' | 'blocked' | 'completed';
}

async function listTasks(projectRoot: string, includeAll: boolean): Promise<TaskInfo[]> {
  const tasksDir = join(projectRoot, '.ai', 'tasks');
  const loader = new ContextLoader(projectRoot);
  const tasks: TaskInfo[] = [];

  try {
    const files = await readdir(tasksDir);
    for (const file of files.filter(f => f.endsWith('.md'))) {
      const filePath = join(tasksDir, file);
      const content = await readFile(filePath, 'utf-8');

      let status: TaskInfo['status'] = 'pending';
      if (content.includes('## Status: ⚠️ BLOCKED') || content.includes('Status: BLOCKED')) {
        status = 'blocked';
      } else if (content.includes('## Status: ✅') || content.includes('Status: COMPLETED')) {
        status = 'completed';
      }

      if (!includeAll && status === 'completed') {
        continue;
      }

      const goalMatch = content.match(/## Goal\n(.+)/);
      const typeMatch = content.match(/## Task Type\n(\w+)/);

      tasks.push({
        path: filePath,
        name: file,
        goal: goalMatch?.[1] || 'No goal defined',
        type: typeMatch?.[1] || 'unknown',
        status,
      });
    }
  } catch {
    // No tasks dir
  }

  return tasks.sort((a, b) => a.name.localeCompare(b.name));
}

function printTaskList(tasks: TaskInfo[], logger: Logger): void {
  if (tasks.length === 0) {
    logger.info('No tasks found. Create one with: aidf task create');
    return;
  }

  console.log('\n');
  console.log(chalk.bold('Tasks:\n'));

  for (const task of tasks) {
    const statusIcon = {
      pending: chalk.yellow('○'),
      blocked: chalk.red('⚠'),
      completed: chalk.green('✓'),
    }[task.status];

    const typeColor = {
      component: chalk.blue,
      refactor: chalk.magenta,
      bugfix: chalk.red,
      test: chalk.green,
      docs: chalk.gray,
      architecture: chalk.cyan,
    }[task.type] || chalk.white;

    console.log(`  ${statusIcon} ${chalk.gray(task.name)}`);
    console.log(`    ${task.goal.slice(0, 60)}${task.goal.length > 60 ? '...' : ''}`);
    console.log(`    ${typeColor(task.type)} ${chalk.gray(`(${task.status})`)}`);
    console.log('');
  }
}

function printTaskDetails(task: ParsedTask, logger: Logger): void {
  logger.box(basename(task.filePath), [
    `Goal: ${task.goal}`,
    `Type: ${task.taskType}`,
    `Roles: ${task.suggestedRoles.join(', ')}`,
    '',
    'Scope:',
    `  Allowed: ${task.scope.allowed.join(', ')}`,
    `  Forbidden: ${task.scope.forbidden.join(', ')}`,
    '',
    'Definition of Done:',
    ...task.definitionOfDone.map(d => `  - ${d}`),
  ].join('\n'));
}

function printTaskSummary(tasks: TaskInfo[], logger: Logger): void {
  const pending = tasks.filter(t => t.status === 'pending').length;
  const blocked = tasks.filter(t => t.status === 'blocked').length;
  const completed = tasks.filter(t => t.status === 'completed').length;

  logger.box('Task Summary', [
    `${chalk.yellow('○')} Pending: ${pending}`,
    `${chalk.red('⚠')} Blocked: ${blocked}`,
    `${chalk.green('✓')} Completed: ${completed}`,
    '',
    `Total: ${tasks.length}`,
  ].join('\n'));
}
