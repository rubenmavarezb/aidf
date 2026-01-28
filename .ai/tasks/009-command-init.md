# TASK: Implementar Comando `aidf init`

## Goal
Crear el comando CLI que inicializa AIDF en un proyecto existente, copiando templates y configurando .ai/.

## Task Type
component

## Suggested Roles
- developer

## Auto-Mode Compatible
✅ **SÍ** - Cursor auto-mode funciona bien. File operations y prompts claros.

## Scope

### Allowed
- `packages/cli/src/commands/init.ts`
- `packages/cli/src/index.ts`
- `packages/cli/src/utils/files.ts`

### Forbidden
- `templates/**` (solo leer, no modificar)
- `packages/cli/src/core/**`

## Requirements

### 1. Implementar `utils/files.ts`

```typescript
// packages/cli/src/utils/files.ts

import { readdir, readFile, writeFile, mkdir, copyFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';

/**
 * Copia un directorio recursivamente
 */
export async function copyDir(src: string, dest: string): Promise<void> {
  await mkdir(dest, { recursive: true });

  const entries = await readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await copyFile(srcPath, destPath);
    }
  }
}

/**
 * Encuentra el root del package aidf (donde están los templates)
 */
export function findPackageRoot(): string {
  // En desarrollo: buscar desde el directorio actual
  // En producción: usar import.meta.url
  const url = new URL(import.meta.url);
  let dir = dirname(url.pathname);

  // Subir hasta encontrar templates/
  while (dir !== '/') {
    if (existsSync(join(dir, 'templates'))) {
      return dir;
    }
    // También buscar en node_modules/@aidf/cli
    if (existsSync(join(dir, 'node_modules', '@aidf', 'cli', 'templates'))) {
      return join(dir, 'node_modules', '@aidf', 'cli');
    }
    dir = dirname(dir);
  }

  throw new Error('Could not find AIDF templates directory');
}

/**
 * Reemplaza placeholders en un archivo
 */
export async function processTemplate(
  filePath: string,
  replacements: Record<string, string>
): Promise<void> {
  let content = await readFile(filePath, 'utf-8');

  for (const [key, value] of Object.entries(replacements)) {
    content = content.replace(new RegExp(`\\[${key}\\]`, 'g'), value);
  }

  await writeFile(filePath, content);
}
```

### 2. Implementar `commands/init.ts`

```typescript
// packages/cli/src/commands/init.ts

import { Command } from 'commander';
import { existsSync } from 'fs';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import inquirer from 'inquirer';
import chalk from 'chalk';
import yaml from 'yaml';
import { Logger } from '../utils/logger.js';
import { copyDir, findPackageRoot, processTemplate } from '../utils/files.js';
import { detectValidationCommands } from '../core/validator.js';
import type { AidfConfig } from '../types/index.js';

interface InitAnswers {
  projectName: string;
  projectType: string;
  projectDescription: string;
  provider: 'claude-cli' | 'anthropic-api' | 'openai-api';
  scopeEnforcement: 'strict' | 'ask' | 'permissive';
  autoCommit: boolean;
}

export function createInitCommand(): Command {
  const cmd = new Command('init')
    .description('Initialize AIDF in the current project')
    .option('-y, --yes', 'Skip prompts and use defaults')
    .option('-f, --force', 'Overwrite existing .ai directory')
    .action(async (options) => {
      const logger = new Logger();
      const cwd = process.cwd();

      try {
        // Verificar si ya existe
        if (existsSync(join(cwd, '.ai')) && !options.force) {
          logger.warn('.ai directory already exists.');
          const { overwrite } = await inquirer.prompt([{
            type: 'confirm',
            name: 'overwrite',
            message: 'Overwrite existing configuration?',
            default: false,
          }]);

          if (!overwrite) {
            logger.info('Aborted.');
            return;
          }
        }

        // Recopilar información
        const answers = options.yes
          ? getDefaults(cwd)
          : await promptForInfo(cwd, logger);

        logger.startSpinner('Initializing AIDF...');

        // 1. Copiar templates
        const packageRoot = findPackageRoot();
        const templatesDir = join(packageRoot, 'templates', '.ai');
        const destDir = join(cwd, '.ai');

        await copyDir(templatesDir, destDir);
        logger.updateSpinner('Copied templates...');

        // 2. Renombrar AGENTS.template.md a AGENTS.md
        const agentsTemplatePath = join(destDir, 'AGENTS.template.md');
        const agentsPath = join(destDir, 'AGENTS.md');
        if (existsSync(agentsTemplatePath)) {
          const content = await readFile(agentsTemplatePath, 'utf-8');
          await writeFile(agentsPath, content);
          // Opcional: eliminar template
        }

        // 3. Procesar placeholders en AGENTS.md
        await processTemplate(agentsPath, {
          PROJECT_NAME: answers.projectName,
          TYPE: answers.projectType,
          PRIMARY_PURPOSE: answers.projectDescription,
        });
        logger.updateSpinner('Configured AGENTS.md...');

        // 4. Detectar comandos de validación
        const detectedCommands = await detectValidationCommands(cwd);

        // 5. Crear config.yml
        const config: AidfConfig = {
          version: 1,
          provider: {
            type: answers.provider,
          },
          execution: {
            max_iterations: 50,
            max_consecutive_failures: 3,
            timeout_per_iteration: 300,
          },
          permissions: {
            scope_enforcement: answers.scopeEnforcement,
            auto_commit: answers.autoCommit,
            auto_push: false,
            auto_pr: false,
          },
          validation: {
            pre_commit: detectedCommands.pre_commit || [],
            pre_push: detectedCommands.pre_push || [],
            pre_pr: detectedCommands.pre_pr || [],
          },
          git: {
            commit_prefix: 'aidf:',
            branch_prefix: 'aidf/',
          },
        };

        const configPath = join(destDir, 'config.yml');
        await writeFile(configPath, yaml.stringify(config));
        logger.updateSpinner('Created config.yml...');

        // 6. Crear carpetas vacías
        await mkdir(join(destDir, 'tasks'), { recursive: true });
        await mkdir(join(destDir, 'plans'), { recursive: true });

        // 7. Añadir a .gitignore si no está
        await updateGitignore(cwd, logger);

        logger.stopSpinner(true, 'AIDF initialized!');

        // Mostrar siguiente pasos
        console.log('\n');
        logger.box('Next Steps', [
          '1. Review and customize .ai/AGENTS.md',
          '2. Create your first task:',
          '   aidf task create',
          '3. Run the task:',
          '   aidf run',
        ].join('\n'));

        // Mostrar comandos detectados
        if (Object.values(detectedCommands).some(arr => arr && arr.length > 0)) {
          console.log(chalk.gray('\nDetected validation commands:'));
          if (detectedCommands.pre_commit?.length) {
            console.log(chalk.gray(`  pre-commit: ${detectedCommands.pre_commit.join(', ')}`));
          }
          if (detectedCommands.pre_push?.length) {
            console.log(chalk.gray(`  pre-push: ${detectedCommands.pre_push.join(', ')}`));
          }
        }

      } catch (error) {
        logger.stopSpinner(false);
        logger.error(error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });

  return cmd;
}

async function promptForInfo(cwd: string, logger: Logger): Promise<InitAnswers> {
  // Intentar detectar nombre del proyecto
  let defaultName = 'my-project';
  try {
    const pkg = JSON.parse(await readFile(join(cwd, 'package.json'), 'utf-8'));
    defaultName = pkg.name || defaultName;
  } catch {
    // No package.json
  }

  return inquirer.prompt([
    {
      type: 'input',
      name: 'projectName',
      message: 'Project name:',
      default: defaultName,
    },
    {
      type: 'list',
      name: 'projectType',
      message: 'Project type:',
      choices: [
        'web application',
        'API/backend',
        'CLI tool',
        'library',
        'mobile app',
        'other',
      ],
    },
    {
      type: 'input',
      name: 'projectDescription',
      message: 'Brief description (what does it do?):',
      default: 'provides functionality for users',
    },
    {
      type: 'list',
      name: 'provider',
      message: 'Default AI provider:',
      choices: [
        { name: 'Claude CLI (recommended)', value: 'claude-cli' },
        { name: 'Anthropic API', value: 'anthropic-api' },
        { name: 'OpenAI API', value: 'openai-api' },
      ],
    },
    {
      type: 'list',
      name: 'scopeEnforcement',
      message: 'Scope enforcement level:',
      choices: [
        { name: 'Ask - Prompt before changes outside scope', value: 'ask' },
        { name: 'Strict - Block all changes outside scope', value: 'strict' },
        { name: 'Permissive - Allow all changes (dangerous)', value: 'permissive' },
      ],
    },
    {
      type: 'confirm',
      name: 'autoCommit',
      message: 'Auto-commit after each successful iteration?',
      default: true,
    },
  ]);
}

function getDefaults(cwd: string): InitAnswers {
  return {
    projectName: 'my-project',
    projectType: 'web application',
    projectDescription: 'provides functionality for users',
    provider: 'claude-cli',
    scopeEnforcement: 'ask',
    autoCommit: true,
  };
}

async function updateGitignore(cwd: string, logger: Logger): Promise<void> {
  const gitignorePath = join(cwd, '.gitignore');

  const linesToAdd = [
    '',
    '# AIDF',
    '.ai/tasks/*.blocked',
    '.ai/.cache/',
  ];

  try {
    if (existsSync(gitignorePath)) {
      const content = await readFile(gitignorePath, 'utf-8');
      if (!content.includes('# AIDF')) {
        await writeFile(gitignorePath, content + linesToAdd.join('\n'));
        logger.debug('Updated .gitignore');
      }
    } else {
      await writeFile(gitignorePath, linesToAdd.join('\n'));
      logger.debug('Created .gitignore');
    }
  } catch {
    // Ignore gitignore errors
  }
}
```

### 3. Actualizar `index.ts`

```typescript
// Añadir import
import { createInitCommand } from './commands/init.js';

// Añadir comando
program.addCommand(createInitCommand());
```

## Definition of Done
- [ ] `aidf init` ejecuta interactivamente
- [ ] `aidf init -y` usa defaults sin prompts
- [ ] `aidf init -f` fuerza overwrite
- [ ] Copia templates de .ai/ correctamente
- [ ] Procesa placeholders en AGENTS.md
- [ ] Detecta comandos de validación de package.json
- [ ] Crea config.yml con configuración
- [ ] Crea carpetas tasks/ y plans/
- [ ] Actualiza .gitignore
- [ ] Muestra next steps al terminar
- [ ] Maneja caso de .ai existente
- [ ] TypeScript compila sin errores

## Notes
- Los templates vienen del directorio templates/ del package
- Buscar package root es necesario tanto en dev como en producción (npm install)
- Los placeholders en templates usan formato [PLACEHOLDER]
- La detección de comandos es best-effort, el usuario puede modificar config.yml
