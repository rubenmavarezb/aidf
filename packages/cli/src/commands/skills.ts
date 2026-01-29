// packages/cli/src/commands/skills.ts

import { Command } from 'commander';
import { existsSync, mkdirSync, writeFileSync, readFileSync, cpSync } from 'fs';
import { join, basename } from 'path';
import chalk from 'chalk';
import YAML from 'yaml';
import { SkillLoader, validateSkillContent, createSkillTemplate } from '../core/skill-loader.js';
import { ContextLoader } from '../core/context-loader.js';
import type { SkillsConfig } from '../types/index.js';

function loadSkillsConfig(): SkillsConfig {
  try {
    const projectRoot = ContextLoader.findAiDir();
    if (!projectRoot) return {};

    const configPath = join(projectRoot, '.ai', 'config.yml');
    if (!existsSync(configPath)) return {};

    const content = readFileSync(configPath, 'utf-8');
    const config = YAML.parse(content);
    return config?.skills ?? {};
  } catch {
    return {};
  }
}

export function createSkillsCommand(): Command {
  const cmd = new Command('skills')
    .description('Manage Agent Skills');

  // aidf skills list
  cmd
    .command('list')
    .description('List all available skills')
    .action(async () => {
      try {
        const projectRoot = ContextLoader.findAiDir() ?? process.cwd();
        const config = loadSkillsConfig();
        const loader = new SkillLoader(projectRoot, config);
        const skills = await loader.discoverSkills();

        if (skills.length === 0) {
          console.log(chalk.yellow('No skills found.'));
          console.log(chalk.gray('Add skills to .ai/skills/ or run: aidf skills init <name>'));
          return;
        }

        console.log(chalk.bold(`Found ${skills.length} skill(s):\n`));

        for (const skill of skills) {
          const sourceLabel = skill.source === 'project' ? chalk.blue('project')
            : skill.source === 'global' ? chalk.green('global')
            : chalk.gray('config');

          console.log(`  ${chalk.bold(skill.metadata.name)} ${chalk.gray(`[${sourceLabel}]`)}`);
          console.log(`    ${skill.metadata.description}`);
          if (skill.metadata.tags && skill.metadata.tags.length > 0) {
            console.log(`    ${chalk.gray('Tags:')} ${skill.metadata.tags.join(', ')}`);
          }
          console.log('');
        }
      } catch (error) {
        console.error(chalk.red(error instanceof Error ? error.message : 'Failed to list skills'));
        process.exit(1);
      }
    });

  // aidf skills init <name>
  cmd
    .command('init <name>')
    .description('Create a new skill template')
    .option('-g, --global', 'Create in global skills directory (~/.aidf/skills/)')
    .action(async (name: string, options: { global?: boolean }) => {
      try {
        let skillsDir: string;

        if (options.global) {
          const { homedir } = await import('os');
          skillsDir = join(homedir(), '.aidf', 'skills');
        } else {
          const projectRoot = ContextLoader.findAiDir() ?? process.cwd();
          skillsDir = join(projectRoot, '.ai', 'skills');
        }

        const skillDir = join(skillsDir, name);
        const skillPath = join(skillDir, 'SKILL.md');

        if (existsSync(skillPath)) {
          console.error(chalk.red(`Skill "${name}" already exists at ${skillPath}`));
          process.exit(1);
        }

        mkdirSync(skillDir, { recursive: true });
        writeFileSync(skillPath, createSkillTemplate(name));

        console.log(chalk.green(`Created skill template: ${skillPath}`));
        console.log(chalk.gray('Edit the SKILL.md file to define your skill.'));
      } catch (error) {
        console.error(chalk.red(error instanceof Error ? error.message : 'Failed to create skill'));
        process.exit(1);
      }
    });

  // aidf skills validate [name]
  cmd
    .command('validate [name]')
    .description('Validate skill(s)')
    .action(async (name?: string) => {
      try {
        const projectRoot = ContextLoader.findAiDir() ?? process.cwd();
        const config = loadSkillsConfig();
        const loader = new SkillLoader(projectRoot, config);

        if (name) {
          // Validate a specific skill
          const skill = await loader.loadByName(name);
          if (!skill) {
            console.error(chalk.red(`Skill "${name}" not found.`));
            process.exit(1);
          }

          const errors = validateSkillContent(skill.content);
          if (errors.length === 0) {
            console.log(chalk.green(`Skill "${name}" is valid.`));
          } else {
            console.log(chalk.red(`Skill "${name}" has ${errors.length} error(s):`));
            for (const err of errors) {
              console.log(`  ${chalk.red('•')} ${err}`);
            }
            process.exit(1);
          }
        } else {
          // Validate all skills
          const skills = await loader.loadAll();

          if (skills.length === 0) {
            console.log(chalk.yellow('No skills found to validate.'));
            return;
          }

          let allValid = true;

          for (const skill of skills) {
            const errors = validateSkillContent(skill.content);
            if (errors.length === 0) {
              console.log(`  ${chalk.green('✓')} ${skill.metadata.name}`);
            } else {
              allValid = false;
              console.log(`  ${chalk.red('✗')} ${skill.metadata.name}`);
              for (const err of errors) {
                console.log(`    ${chalk.red('•')} ${err}`);
              }
            }
          }

          if (allValid) {
            console.log(chalk.green(`\nAll ${skills.length} skill(s) are valid.`));
          } else {
            process.exit(1);
          }
        }
      } catch (error) {
        console.error(chalk.red(error instanceof Error ? error.message : 'Failed to validate skills'));
        process.exit(1);
      }
    });

  // aidf skills add <path>
  cmd
    .command('add <path>')
    .description('Add an external skill by path')
    .action(async (skillPath: string) => {
      try {
        // Verify the path contains a valid SKILL.md
        const resolvedPath = join(skillPath, 'SKILL.md');
        if (!existsSync(resolvedPath) && !existsSync(skillPath)) {
          console.error(chalk.red(`No SKILL.md found at ${skillPath}`));
          process.exit(1);
        }

        const sourceFile = existsSync(resolvedPath) ? resolvedPath : skillPath;
        const content = readFileSync(sourceFile, 'utf-8');
        const errors = validateSkillContent(content);

        if (errors.length > 0) {
          console.error(chalk.red('Invalid skill:'));
          for (const err of errors) {
            console.error(`  ${chalk.red('•')} ${err}`);
          }
          process.exit(1);
        }

        // Copy to project skills directory
        const projectRoot = ContextLoader.findAiDir() ?? process.cwd();
        const skillsDir = join(projectRoot, '.ai', 'skills');
        const skillName = basename(existsSync(resolvedPath) ? skillPath : skillPath.replace(/\/SKILL\.md$/, ''));
        const targetDir = join(skillsDir, skillName);

        mkdirSync(targetDir, { recursive: true });

        if (existsSync(resolvedPath)) {
          // Copy directory
          cpSync(skillPath, targetDir, { recursive: true });
        } else {
          // Copy single file
          writeFileSync(join(targetDir, 'SKILL.md'), content);
        }

        console.log(chalk.green(`Added skill "${skillName}" to ${targetDir}`));
      } catch (error) {
        console.error(chalk.red(error instanceof Error ? error.message : 'Failed to add skill'));
        process.exit(1);
      }
    });

  return cmd;
}
