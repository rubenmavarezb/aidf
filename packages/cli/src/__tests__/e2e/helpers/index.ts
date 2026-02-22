// packages/cli/src/__tests__/e2e/helpers/index.ts

import { mkdtemp, rm, mkdir, writeFile, readFile, access } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { simpleGit, type SimpleGit } from 'simple-git';
import { stringify } from 'yaml';
import type { AidfConfig } from '../../../types/index.js';
import type {
  TempProjectOptions,
  TempProjectResult,
  TaskFixtureDef,
  SkillFixtureDef,
  RoleFixtureDef,
} from './types.js';

export type {
  TempProjectOptions,
  TempProjectResult,
  TaskFixtureDef,
  SkillFixtureDef,
  RoleFixtureDef,
} from './types.js';

const TEMP_PREFIX = 'aidf-e2e-';

const DEFAULT_CONFIG: AidfConfig = {
  version: 1,
  provider: { type: 'claude-cli' },
  execution: {
    max_iterations: 10,
    max_consecutive_failures: 3,
    timeout_per_iteration: 60,
  },
  permissions: {
    scope_enforcement: 'strict',
    auto_commit: false,
    auto_push: false,
    auto_pr: false,
  },
  validation: {
    pre_commit: [],
    pre_push: [],
    pre_pr: [],
  },
  git: {
    commit_prefix: 'aidf:',
    branch_prefix: 'aidf/',
  },
};

const DEFAULT_AGENTS_CONTENT = `# AGENTS.md

## Project Overview
Test project for E2E tests.

## Architecture
Simple test project.

## Technology Stack
- TypeScript

## Conventions
- Follow standard practices.

## Quality Standards
- All tests must pass.

## Boundaries

### Never Modify
- node_modules/

### Never Do
- Deploy to production

### Requires Discussion
- Schema changes
`;

const DEFAULT_ROLE_CONTENT = `# Role: Developer

## Identity
Software developer for the project.

## Expertise
- TypeScript
- Node.js

## Responsibilities
- Write code
- Write tests

## Constraints
- Follow coding standards

## Quality Criteria
- All tests pass
`;

/**
 * Creates a temporary directory with a valid AIDF project structure.
 */
export async function createTempProject(
  options: TempProjectOptions = {}
): Promise<TempProjectResult> {
  const projectRoot = await mkdtemp(join(tmpdir(), TEMP_PREFIX));
  const aiDir = join(projectRoot, '.ai');

  // Create directory structure
  await mkdir(join(aiDir, 'tasks', 'pending'), { recursive: true });
  await mkdir(join(aiDir, 'tasks', 'completed'), { recursive: true });
  await mkdir(join(aiDir, 'tasks', 'blocked'), { recursive: true });
  await mkdir(join(aiDir, 'roles'), { recursive: true });
  await mkdir(join(aiDir, 'skills'), { recursive: true });

  // Write AGENTS.md
  await writeFile(
    join(aiDir, 'AGENTS.md'),
    options.agentsContent ?? DEFAULT_AGENTS_CONTENT
  );

  // Write default role
  await writeFile(join(aiDir, 'roles', 'developer.md'), DEFAULT_ROLE_CONTENT);

  // Write config.yml
  const config: AidfConfig = {
    ...DEFAULT_CONFIG,
    ...options.config,
    provider: { ...DEFAULT_CONFIG.provider, ...options.config?.provider },
    execution: { ...DEFAULT_CONFIG.execution, ...options.config?.execution },
    permissions: { ...DEFAULT_CONFIG.permissions, ...options.config?.permissions },
    validation: { ...DEFAULT_CONFIG.validation, ...options.config?.validation },
    git: { ...DEFAULT_CONFIG.git, ...options.config?.git },
  };
  await writeFile(join(aiDir, 'config.yml'), stringify(config));

  // Initialize git if requested
  if (options.withGit) {
    await initGitRepo(projectRoot);
  }

  const cleanup = async () => {
    await rm(projectRoot, { recursive: true, force: true });
  };

  // Track for global cleanup
  trackedDirs.add(projectRoot);

  return { projectRoot, aiDir, cleanup };
}

/**
 * Initializes a git repository with test user config and initial commit.
 */
export async function initGitRepo(dir: string): Promise<SimpleGit> {
  const git = simpleGit(dir);
  await git.init();
  await git.addConfig('user.name', 'AIDF E2E Test');
  await git.addConfig('user.email', 'e2e-test@aidf.dev');
  await git.addConfig('commit.gpgSign', 'false');

  // Create .gitignore
  await writeFile(join(dir, '.gitignore'), 'node_modules/\n');

  await git.add('.');
  await git.commit('Initial commit', { '--no-gpg-sign': null });

  return git;
}

/**
 * Creates a task fixture .md file in the project's pending tasks directory.
 */
export async function createTaskFixture(
  projectRoot: string,
  taskDef: TaskFixtureDef
): Promise<string> {
  const taskPath = join(
    projectRoot,
    '.ai',
    'tasks',
    'pending',
    `${taskDef.id}-task.md`
  );

  const content = `# TASK: ${taskDef.goal}

## Goal

${taskDef.goal}

## Task Type

${taskDef.type}

## Scope

### Allowed

${taskDef.allowedScope.map(s => `- \`${s}\``).join('\n')}

### Forbidden

${taskDef.forbiddenScope.map(s => `- \`${s}\``).join('\n')}

## Requirements

${taskDef.requirements}

## Definition of Done

${taskDef.definitionOfDone.map(d => `- [ ] ${d}`).join('\n')}
`;

  await writeFile(taskPath, content);
  return taskPath;
}

/**
 * Creates a SKILL.md file in the project's skills directory.
 */
export async function createSkillFixture(
  projectRoot: string,
  skillDef: SkillFixtureDef
): Promise<string> {
  const skillDir = join(projectRoot, '.ai', 'skills', skillDef.name);
  await mkdir(skillDir, { recursive: true });

  const skillPath = join(skillDir, 'SKILL.md');
  const frontmatter = [
    '---',
    `name: ${skillDef.name}`,
    `description: ${skillDef.description}`,
  ];
  if (skillDef.version) frontmatter.push(`version: ${skillDef.version}`);
  if (skillDef.tags?.length) frontmatter.push(`tags: ${skillDef.tags.join(', ')}`);
  frontmatter.push('---');

  const content = `${frontmatter.join('\n')}\n\n${skillDef.body}\n`;
  await writeFile(skillPath, content);
  return skillPath;
}

/**
 * Creates a role fixture .md file in the project's roles directory.
 */
export async function createRoleFixture(
  projectRoot: string,
  roleDef: RoleFixtureDef
): Promise<string> {
  const rolePath = join(projectRoot, '.ai', 'roles', `${roleDef.name}.md`);
  const content = `# Role: ${roleDef.name}

## Identity
${roleDef.identity}

## Expertise
${roleDef.expertise.map(e => `- ${e}`).join('\n')}

## Responsibilities
${roleDef.responsibilities.map(r => `- ${r}`).join('\n')}

## Constraints
- Follow project standards

## Quality Criteria
- All tests pass
`;

  await writeFile(rolePath, content);
  return rolePath;
}

/**
 * Creates a config.yml from an AidfConfig object.
 */
export async function createConfigFixture(
  projectRoot: string,
  config: Partial<AidfConfig>
): Promise<string> {
  const fullConfig: AidfConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    provider: { ...DEFAULT_CONFIG.provider, ...config.provider },
    execution: { ...DEFAULT_CONFIG.execution, ...config.execution },
    permissions: { ...DEFAULT_CONFIG.permissions, ...config.permissions },
    validation: { ...DEFAULT_CONFIG.validation, ...config.validation },
    git: { ...DEFAULT_CONFIG.git, ...config.git },
  };

  const configPath = join(projectRoot, '.ai', 'config.yml');
  await writeFile(configPath, stringify(fullConfig));
  return configPath;
}

/**
 * Polls for a file to exist. Rejects after timeout.
 */
export async function waitForFile(
  filePath: string,
  timeoutMs: number = 5000
): Promise<void> {
  const start = Date.now();
  const interval = 50;

  while (Date.now() - start < timeoutMs) {
    try {
      await access(filePath);
      return;
    } catch {
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }

  throw new Error(`Timed out waiting for file: ${filePath} (${timeoutMs}ms)`);
}

/**
 * Reads a task .md file and extracts the `## Status:` line value.
 */
export async function readTaskStatus(taskPath: string): Promise<string | null> {
  const content = await readFile(taskPath, 'utf-8');
  const match = content.match(/^## Status:\s*(.+)$/m);
  return match ? match[1].trim() : null;
}

// Global cleanup tracking
const trackedDirs = new Set<string>();

/**
 * Cleans up all tracked temp directories. Called from setup.ts afterAll.
 */
export async function cleanupAllTempDirs(): Promise<void> {
  const promises = Array.from(trackedDirs).map(dir =>
    rm(dir, { recursive: true, force: true }).catch(() => {})
  );
  await Promise.all(promises);
  trackedDirs.clear();
}

/**
 * Returns the set of tracked directories for testing.
 */
export function getTrackedDirs(): Set<string> {
  return trackedDirs;
}
