// packages/cli/src/commands/init.ts

import { Command } from 'commander';
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, renameSync } from 'fs';
import { join, basename } from 'path';
import inquirer from 'inquirer';
import chalk from 'chalk';
import YAML from 'yaml';
import { Logger } from '../utils/logger.js';
import {
  copyDir,
  findTemplatesDir,
  detectValidationCommands,
  getProjectName,
  type DetectedCommands,
} from '../utils/files.js';

interface InitAnswers {
  projectName: string;
  projectType: string;
  projectDescription: string;
  provider: string;
  scopeEnforcement: string;
  autoCommit: boolean;
}

interface InitConfig {
  framework: string;
  version: number;
  project: {
    name: string;
    type: string;
    description: string;
  };
  provider: {
    type: string;
  };
  permissions: {
    scope_enforcement: string;
    auto_commit: boolean;
    auto_push: boolean;
    auto_pr: boolean;
  };
  validation: {
    pre_commit: string[];
    pre_push: string[];
    pre_pr: string[];
  };
  security: {
    skip_permissions: boolean;
    warn_on_skip: boolean;
    commands: {
      allowed: string[];
      blocked: string[];
      strict: boolean;
    };
  };
}

const PROJECT_TYPES = [
  { name: 'Web Application', value: 'web-app' },
  { name: 'REST API', value: 'api' },
  { name: 'CLI Tool', value: 'cli' },
  { name: 'Library/Package', value: 'library' },
  { name: 'Mobile App', value: 'mobile' },
  { name: 'Monorepo', value: 'monorepo' },
  { name: 'Other', value: 'other' },
];

const PROVIDERS = [
  { name: 'Claude CLI (claude.ai/code)', value: 'claude-cli' },
  { name: 'Cursor CLI (cursor.com/cli)', value: 'cursor-cli' },
  { name: 'Anthropic API (direct)', value: 'anthropic-api' },
  { name: 'OpenAI API', value: 'openai-api' },
];

const SCOPE_ENFORCEMENT = [
  { name: 'Strict - Block all out-of-scope changes', value: 'strict' },
  { name: 'Ask - Prompt before out-of-scope changes', value: 'ask' },
  { name: 'Permissive - Allow with warnings', value: 'permissive' },
];

export function createInitCommand(): Command {
  const cmd = new Command('init')
    .description('Initialize AIDF in an existing project')
    .option('-y, --yes', 'Use defaults without prompting')
    .option('-f, --force', 'Overwrite existing .ai directory')
    .option('-v, --verbose', 'Verbose output')
    .option('--log-format <format>', 'Log format (text|json)', 'text')
    .option('--log-file <path>', 'Write logs to file')
    .option('--log-rotate', 'Enable log rotation (append timestamp to filename)')
    .action(async (options) => {
      const logger = new Logger({
        verbose: options.verbose,
        logFormat: options.logFormat as 'text' | 'json' | undefined,
        logFile: options.logFile,
        logRotate: options.logRotate,
      });
      const projectPath = process.cwd();

      try {
        logger.setContext({ command: 'init' });
        await runInit(projectPath, options, logger);
        await logger.close();
      } catch (error) {
        logger.error(error instanceof Error ? error.message : 'Unknown error');
        await logger.close();
        process.exit(1);
      }
    });

  return cmd;
}

async function runInit(
  projectPath: string,
  options: { yes?: boolean; force?: boolean; verbose?: boolean },
  logger: Logger
): Promise<void> {
  const aiDir = join(projectPath, '.ai');

  // Step 1: Check if .ai already exists
  if (existsSync(aiDir)) {
    if (!options.force) {
      const { overwrite } = await inquirer.prompt([{
        type: 'confirm',
        name: 'overwrite',
        message: chalk.yellow('.ai directory already exists. Overwrite?'),
        default: false,
      }]);

      if (!overwrite) {
        logger.warn('Initialization cancelled.');
        return;
      }
    }
    logger.debug('Overwriting existing .ai directory');
  }

  // Step 2: Gather information
  const detectedName = getProjectName(projectPath) || basename(projectPath);
  const detectedCommands = detectValidationCommands(projectPath);

  logger.debug(`Detected project name: ${detectedName}`);
  logger.debug(`Detected commands: ${JSON.stringify(detectedCommands)}`);

  let answers: InitAnswers;

  if (options.yes) {
    answers = getDefaults(detectedName);
    logger.info('Using default configuration');
  } else {
    answers = await promptForInfo(detectedName);
  }

  // Step 3: Copy templates
  logger.startSpinner('Copying AIDF templates...');

  const templatesDir = findTemplatesDir();
  logger.debug(`Templates directory: ${templatesDir}`);

  copyDir(templatesDir, aiDir);
  logger.updateSpinner('Processing templates...');

  // Step 4: Rename AGENTS.template.md -> AGENTS.md
  const templatePath = join(aiDir, 'AGENTS.template.md');
  const agentsPath = join(aiDir, 'AGENTS.md');

  if (existsSync(templatePath)) {
    renameSync(templatePath, agentsPath);
  }

  // Step 5: Process placeholders in AGENTS.md
  if (existsSync(agentsPath)) {
    // Read content and do manual replacement for the complex TYPE pattern
    let agentsContent = readFileSync(agentsPath, 'utf-8');

    // Replace simple placeholders
    agentsContent = agentsContent.replace(/\[PROJECT_NAME\]/g, answers.projectName);
    agentsContent = agentsContent.replace(/\[PRIMARY_PURPOSE\]/g, answers.projectDescription || 'serves its primary purpose');

    // Replace the TYPE pattern (it has special characters)
    agentsContent = agentsContent.replace(
      /\[TYPE: web app \| mobile app \| API \| library \| CLI tool\]/g,
      getTypeLabel(answers.projectType)
    );

    writeFileSync(agentsPath, agentsContent);
  }

  // Step 6: Create config.yml
  logger.updateSpinner('Creating configuration...');

  // Map detected commands to validation phases
  const preCommit: string[] = [];
  const prePush: string[] = [];
  const prePr: string[] = [];
  if (detectedCommands.lint) preCommit.push(detectedCommands.lint);
  if (detectedCommands.typecheck) preCommit.push(detectedCommands.typecheck);
  if (detectedCommands.format) preCommit.push(detectedCommands.format);
  if (detectedCommands.test) prePush.push(detectedCommands.test);
  if (detectedCommands.build) prePr.push(detectedCommands.build);

  const config: InitConfig = {
    framework: 'aidf',
    version: 1,
    project: {
      name: answers.projectName,
      type: answers.projectType,
      description: answers.projectDescription,
    },
    provider: {
      type: answers.provider,
    },
    permissions: {
      scope_enforcement: answers.scopeEnforcement,
      auto_commit: answers.autoCommit,
      auto_push: false,
      auto_pr: false,
    },
    validation: {
      pre_commit: preCommit,
      pre_push: prePush,
      pre_pr: prePr,
    },
    security: {
      skip_permissions: true,
      warn_on_skip: true,
      commands: {
        allowed: ['pnpm test', 'pnpm lint', 'pnpm typecheck', 'pnpm build'],
        blocked: ['rm -rf /', 'sudo'],
        strict: false,
      },
    },
  };

  const configPath = join(aiDir, 'config.yml');
  const configHeader = `# AIDF (AI Development Framework) Configuration
# Framework docs: https://rubenmavarezb.github.io/aidf/docs/concepts/
#
# AIDF provides structured, layered context for AI assistants:
#   Layer 1: AGENTS.md (global project context)
#   Layer 2: roles/*.md (specialized role definitions)
#   Layer 3: skills/*.md (portable skill definitions)
#   Layer 4: tasks/*.md (scoped task specifications)
#   Layer 5: plans/*.md (multi-task initiatives)
#
# For sensitive values, use environment variables:
#   api_key: \${ANTHROPIC_API_KEY}
#   webhook_url: \${AIDF_SLACK_WEBHOOK}
# Environment variables are resolved at runtime using \${VAR} or $VAR syntax.

`;
  writeFileSync(configPath, configHeader + YAML.stringify(config));

  // Step 7: Ensure tasks/ and plans/ directories exist
  const tasksDir = join(aiDir, 'tasks');
  const plansDir = join(aiDir, 'plans');

  if (!existsSync(tasksDir)) {
    mkdirSync(tasksDir, { recursive: true });
    writeFileSync(join(tasksDir, '.gitkeep'), '');
  }

  if (!existsSync(plansDir)) {
    mkdirSync(plansDir, { recursive: true });
    writeFileSync(join(plansDir, '.gitkeep'), '');
  }

  // Step 8: Update .gitignore
  logger.updateSpinner('Updating .gitignore...');
  updateGitignore(projectPath);

  logger.stopSpinner(true, 'AIDF initialized successfully!');

  // Step 9: Show next steps
  printNextSteps(answers, detectedCommands, logger);
}

function getDefaults(projectName: string): InitAnswers {
  return {
    projectName,
    projectType: 'web-app',
    projectDescription: '',
    provider: 'claude-cli',
    scopeEnforcement: 'ask',
    autoCommit: false,
  };
}

async function promptForInfo(detectedName: string): Promise<InitAnswers> {
  console.log('');
  console.log(chalk.bold('Configure AIDF for your project'));
  console.log(chalk.gray('Press Enter to accept defaults\n'));

  return inquirer.prompt([
    {
      type: 'input',
      name: 'projectName',
      message: 'Project name:',
      default: detectedName,
    },
    {
      type: 'list',
      name: 'projectType',
      message: 'Project type:',
      choices: PROJECT_TYPES,
      default: 'web-app',
    },
    {
      type: 'input',
      name: 'projectDescription',
      message: 'Brief description (optional):',
      default: '',
    },
    {
      type: 'list',
      name: 'provider',
      message: 'AI provider:',
      choices: PROVIDERS,
      default: 'claude-cli',
    },
    {
      type: 'list',
      name: 'scopeEnforcement',
      message: 'Scope enforcement:',
      choices: SCOPE_ENFORCEMENT,
      default: 'ask',
    },
    {
      type: 'confirm',
      name: 'autoCommit',
      message: 'Auto-commit after successful tasks?',
      default: false,
    },
  ]);
}

function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    'web-app': 'web app',
    'api': 'API',
    'cli': 'CLI tool',
    'library': 'library',
    'mobile': 'mobile app',
    'monorepo': 'monorepo',
    'other': 'project',
  };
  return labels[type] || type;
}

function updateGitignore(projectPath: string): void {
  const gitignorePath = join(projectPath, '.gitignore');
  const aidfIgnoreEntries = `
# AIDF
.ai/tasks/*.log
.ai/tasks/*.tmp
.ai/.cache/
.ai/config.local.yml
`;

  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, 'utf-8');

    // Check if AIDF entries already exist
    if (!content.includes('# AIDF')) {
      appendFileSync(gitignorePath, aidfIgnoreEntries);
    }
  } else {
    writeFileSync(gitignorePath, aidfIgnoreEntries.trim() + '\n');
  }
}

function printNextSteps(
  answers: InitAnswers,
  commands: DetectedCommands,
  logger: Logger
): void {
  console.log('');
  logger.box('Next Steps', [
    '1. Review and customize .ai/AGENTS.md',
    '   This is your project\'s master context document',
    '',
    '2. Create your first task:',
    '   aidf task create',
    '',
    '3. Run a task:',
    '   aidf run',
  ].join('\n'));

  // Show detected commands
  const detectedList = Object.entries(commands)
    .filter(([_, cmd]) => cmd)
    .map(([name, cmd]) => `  ${chalk.green('✓')} ${name}: ${chalk.gray(cmd)}`);

  if (detectedList.length > 0) {
    console.log(chalk.bold('Detected validation commands:'));
    console.log(detectedList.join('\n'));
    console.log('');
  }

  console.log(chalk.gray('Files created:'));
  console.log(chalk.gray('  .ai/README.md      - Framework quick start'));
  console.log(chalk.gray('  .ai/AGENTS.md      - Project context'));
  console.log(chalk.gray('  .ai/config.yml     - AIDF configuration'));
  console.log(chalk.gray('  .ai/roles/         - Role definitions'));
  console.log(chalk.gray('  .ai/templates/     - Task templates'));
  console.log(chalk.gray('  .ai/tasks/         - Your tasks'));
  console.log(chalk.gray('  .ai/plans/         - Your plans'));
  console.log('');
}
