// packages/cli/src/commands/mcp.ts

import { Command } from 'commander';
import chalk from 'chalk';
import { Logger } from '../utils/logger.js';

export function createMcpCommand(): Command {
  const cmd = new Command('mcp')
    .description('MCP (Model Context Protocol) server for AI clients');

  // aidf mcp serve
  cmd
    .command('serve')
    .description('Start the AIDF MCP server on stdio')
    .option('--project <path>', 'Project root directory', process.cwd())
    .action(async (options) => {
      try {
        // Dynamic import to avoid loading MCP SDK until needed
        const { startMcpServer } = await import('../mcp/server.js');
        await startMcpServer(options.project);
      } catch (error) {
        const logger = new Logger({});
        logger.error(`Failed to start MCP server: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });

  // aidf mcp install
  cmd
    .command('install')
    .description('Generate MCP configuration for Claude Desktop or Cursor')
    .option('--target <target>', 'Target client (claude-desktop|cursor)', 'claude-desktop')
    .option('--project <path>', 'Project root directory', process.cwd())
    .action(async (options) => {
      const aidfPath = process.argv[1] || 'aidf';
      const projectPath = options.project;

      const mcpConfig = {
        mcpServers: {
          aidf: {
            command: 'node',
            args: [aidfPath, 'mcp', 'serve', '--project', projectPath],
          },
        },
      };

      console.log('');
      console.log(chalk.bold('AIDF MCP Server Configuration'));
      console.log('');

      if (options.target === 'cursor') {
        console.log(chalk.gray('Add this to your .cursor/mcp.json:'));
      } else {
        console.log(chalk.gray('Add this to your Claude Desktop config:'));
      }
      console.log('');
      console.log(JSON.stringify(mcpConfig, null, 2));
      console.log('');

      console.log(chalk.bold('Available tools:'));
      console.log('  aidf_list_tasks       — List all tasks with status');
      console.log('  aidf_get_context      — Load full context for a task');
      console.log('  aidf_validate         — Run validation commands');
      console.log('  aidf_create_task      — Create a new task');
      console.log('  aidf_analyze_project  — Analyze project profile');
      console.log('');
      console.log(chalk.bold('Available resources:'));
      console.log('  aidf://agents         — AGENTS.md content');
      console.log('  aidf://config         — config.yml content');
      console.log('  aidf://tasks/{name}   — Task file content');
      console.log('  aidf://roles/{name}   — Role definition');
      console.log('');
    });

  return cmd;
}
