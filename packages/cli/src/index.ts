// packages/cli/src/index.ts

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Logger } from './utils/logger.js';

const _logger = new Logger({});

process.on('unhandledRejection', (reason) => {
  _logger.error(`Unhandled rejection: ${reason}`);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  _logger.error(`Uncaught exception: ${error.message}`);
  process.exit(1);
});
import { createInitCommand } from './commands/init.js';
import { createRunCommand } from './commands/run.js';
import { createTaskCommand } from './commands/task.js';
import { createStatusCommand } from './commands/status.js';
import { createWatchCommand } from './commands/watch.js';
import { createHooksCommand } from './commands/hooks.js';
import { createSkillsCommand } from './commands/skills.js';
import { createMcpCommand } from './commands/mcp.js';
import { createPlanCommand } from './commands/plan.js';
import { createReportCommand } from './commands/report.js';

// Read version from package.json
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
function getVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
    return pkg.version;
  } catch {
    return '0.0.0';
  }
}

const program = new Command();

program
  .name('aidf')
  .description('AI-Integrated Development Framework CLI')
  .version(getVersion());

// Registrar comandos
program.addCommand(createInitCommand());
program.addCommand(createRunCommand());
program.addCommand(createTaskCommand());
program.addCommand(createStatusCommand());
program.addCommand(createWatchCommand());
program.addCommand(createHooksCommand());
program.addCommand(createSkillsCommand());
program.addCommand(createMcpCommand());
program.addCommand(createPlanCommand());
program.addCommand(createReportCommand());

program.parse();
