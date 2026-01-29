// packages/cli/src/index.ts

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createInitCommand } from './commands/init.js';
import { createRunCommand } from './commands/run.js';
import { createTaskCommand } from './commands/task.js';
import { createStatusCommand } from './commands/status.js';
import { createWatchCommand } from './commands/watch.js';
import { createHooksCommand } from './commands/hooks.js';
import { createSkillsCommand } from './commands/skills.js';

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

program.parse();
