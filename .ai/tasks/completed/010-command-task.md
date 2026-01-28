# TASK: Implementar Comando `aidf task`

## Goal
Crear el subcomando CLI para gestionar tasks: create, list, status.

## Task Type
component

## Suggested Roles
- developer

## Auto-Mode Compatible
✅ **SÍ** - Cursor auto-mode funciona bien.

## Scope

### Allowed
- `packages/cli/src/commands/task.ts`
- `packages/cli/src/index.ts`

### Forbidden
- `templates/**`
- `packages/cli/src/core/**`

## Requirements

### Implementar `commands/task.ts`

```typescript
// packages/cli/src/commands/task.ts

import { Command } from 'commander';
import { existsSync } from 'fs';
import { readFile, writeFile, readdir } from 'fs/promises';
import { join, basename } from 'path';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { Logger } from '../utils/logger.js';
import { ContextLoader } from '../core/context-loader.js';
import type { ParsedTask } from '../types/index.js';

export function createTaskCommand(): Command {
  const cmd = new Command('task')
    .description('Manage AIDF tasks');

  // Subcomando: create
  cmd
    .command('create')
    .description('Create a new task interactively')
    .option('-t, --template <name>', 'Use specific template')
    .action(async (options) => {
      const logger = new Logger();

      try {
        const projectRoot = ContextLoader.findAiDir();
        if (!projectRoot) {
          logger.error('No AIDF project found. Run `aidf init` first.');
          process.exit(1);
        }

        const answers = await promptForTask(projectRoot);
        const taskPath = await createTaskFile(projectRoot, answers, logger);

        logger.success(`Created: ${taskPath}`);
        logger.info(`Run: aidf run ${taskPath}`);

      } catch (error) {
        logger.error(error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });

  // Subcomando: list
  cmd
    .command('list')
    .alias('ls')
    .description('List all tasks')
    .option('-a, --all', 'Include completed tasks')
    .action(async (options) => {
      const logger = new Logger();

      try {
        const projectRoot = ContextLoader.findAiDir();
        if (!projectRoot) {
          logger.error('No AIDF project found.');
          process.exit(1);
        }

        const tasks = await listTasks(projectRoot, options.all);
        printTaskList(tasks, logger);

      } catch (error) {
        logger.error(error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });

  // Subcomando: status
  cmd
    .command('status [task]')
    .description('Show task status')
    .action(async (taskArg) => {
      const logger = new Logger();

      try {
        const projectRoot = ContextLoader.findAiDir();
        if (!projectRoot) {
          logger.error('No AIDF project found.');
          process.exit(1);
        }

        const loader = new ContextLoader(projectRoot);

        if (taskArg) {
          const task = await loader.parseTask(taskArg);
          printTaskDetails(task, logger);
        } else {
          const tasks = await listTasks(projectRoot, true);
          printTaskSummary(tasks, logger);
        }

      } catch (error) {
        logger.error(error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });

  return cmd;
}

interface TaskAnswers {
  goal: string;
  taskType: string;
  suggestedRoles: string[];
  allowedPaths: string;
  forbiddenPaths: string;
  requirements: string;
  definitionOfDone: string[];
}

async function promptForTask(projectRoot: string): Promise<TaskAnswers> {
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
    },
    {
      type: 'checkbox',
      name: 'suggestedRoles',
      message: 'Suggested roles:',
      choices: availableRoles,
      default: ['developer'],
    },
    {
      type: 'input',
      name: 'allowedPaths',
      message: 'Allowed paths (comma-separated globs):',
      default: 'src/**',
    },
    {
      type: 'input',
      name: 'forbiddenPaths',
      message: 'Forbidden paths (comma-separated):',
      default: '.env*, src/config/**',
    },
    {
      type: 'editor',
      name: 'requirements',
      message: 'Requirements (opens editor):',
      default: '- Requirement 1\n- Requirement 2',
    },
    {
      type: 'input',
      name: 'definitionOfDone',
      message: 'Definition of Done (comma-separated criteria):',
      default: 'Implementation complete, Tests pass, Lint passes',
      filter: (input: string) => input.split(',').map(s => s.trim()),
    },
  ]);
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
${answers.requirements}

## Definition of Done
${answers.definitionOfDone.map(c => `- [ ] ${c}`).join('\n')}

## Notes
- Created: ${new Date().toISOString()}
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
```

### Actualizar `index.ts`

```typescript
import { createTaskCommand } from './commands/task.js';
program.addCommand(createTaskCommand());
```

## Definition of Done
- [ ] `aidf task create` abre prompts interactivos
- [ ] Genera archivo con número secuencial (001-, 002-)
- [ ] `aidf task list` muestra tasks con status
- [ ] `aidf task list --all` incluye completados
- [ ] `aidf task status` muestra resumen
- [ ] `aidf task status <path>` muestra detalles
- [ ] Colores y iconos indican status visualmente
- [ ] TypeScript compila sin errores

## Notes
- El editor para requirements usa $EDITOR del sistema
- Los números de task se auto-incrementan
- El slug del nombre viene del goal
- Status se detecta buscando markers en el contenido
