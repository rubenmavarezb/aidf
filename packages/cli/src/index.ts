// packages/cli/src/index.ts

import { Command } from 'commander';
import { createInitCommand } from './commands/init.js';
import { createRunCommand } from './commands/run.js';
import { createTaskCommand } from './commands/task.js';
import { createStatusCommand } from './commands/status.js';
import { createWatchCommand } from './commands/watch.js';
import { createHooksCommand } from './commands/hooks.js';

const program = new Command();

program
  .name('aidf')
  .description('AI-Integrated Development Framework CLI')
  .version('0.1.0');

// Registrar comandos
program.addCommand(createInitCommand());
program.addCommand(createRunCommand());
program.addCommand(createTaskCommand());
program.addCommand(createStatusCommand());
program.addCommand(createWatchCommand());
program.addCommand(createHooksCommand());

program.parse();
