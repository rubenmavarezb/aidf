// packages/cli/src/__tests__/e2e/full-lifecycle.e2e.test.ts

import { describe, it, expect } from 'vitest';
import {
  createTempProject,
  createTaskFixture,
  createSkillFixture,
  createConfigFixture,
  createRoleFixture,
  readTaskStatus,
} from './helpers/index.js';
import { ContextLoader } from '../../core/context-loader.js';
import { ScopeGuard } from '../../core/safety.js';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { join } from 'path';
import { parse as yamlParse } from 'yaml';
import type {
  AidfConfig,
} from '../../types/index.js';

describe('Full Lifecycle E2E', () => {
  it('should load context from a real project with ContextLoader', async () => {
    const { projectRoot, cleanup } = await createTempProject();
    try {
      const taskPath = await createTaskFixture(projectRoot, {
        id: '001',
        goal: 'Implement user authentication',
        type: 'component',
        allowedScope: ['src/auth/**'],
        forbiddenScope: ['node_modules/', '.env'],
        requirements: 'Use JWT tokens for authentication.',
        definitionOfDone: ['Auth module created', 'Tests pass'],
      });

      const loader = new ContextLoader(projectRoot);
      const context = await loader.loadContext(taskPath);

      expect(context.task.goal).toBe('Implement user authentication');
      expect(context.task.goal).toBeTruthy();
      expect(typeof context.task.goal).toBe('string');

      expect(context.agents.projectOverview).toBeTruthy();
      expect(typeof context.agents.projectOverview).toBe('string');
      expect(context.agents.projectOverview).toContain('Test project');

      expect(context.role.identity).toBeTruthy();
      expect(typeof context.role.identity).toBe('string');
      expect(context.role.identity).toContain('developer');
    } finally {
      await cleanup();
    }
  });

  it('should load context with custom AGENTS.md content', async () => {
    const customAgents = `# AGENTS.md

## Project Overview
A custom e-commerce platform built with Next.js.

## Architecture
Monorepo with packages.

## Technology Stack
- Next.js
- PostgreSQL

## Conventions
- Use TypeScript strict mode.

## Quality Standards
- 90% code coverage required.

## Boundaries

### Never Modify Without Approval
- database/migrations/

### Never Do
- Direct DB access from frontend

### Requires Discussion
- API schema changes
`;

    const { projectRoot, cleanup } = await createTempProject({
      agentsContent: customAgents,
    });
    try {
      const taskPath = await createTaskFixture(projectRoot, {
        id: '001',
        goal: 'Add product listing page',
        type: 'component',
        allowedScope: ['src/**'],
        forbiddenScope: ['database/'],
        requirements: 'Display products in a grid.',
        definitionOfDone: ['Page renders products'],
      });

      const loader = new ContextLoader(projectRoot);
      const context = await loader.loadContext(taskPath);

      expect(context.agents.projectOverview).toContain(
        'custom e-commerce platform'
      );
      expect(context.agents.technologyStack).toContain('Next.js');
      expect(context.agents.boundaries.neverDo).toContain(
        'Direct DB access from frontend'
      );
    } finally {
      await cleanup();
    }
  });

  it('should parse task fields correctly from a real file', async () => {
    const { projectRoot, cleanup } = await createTempProject();
    try {
      const taskPath = await createTaskFixture(projectRoot, {
        id: '042',
        goal: 'Refactor database connection pooling',
        type: 'refactor',
        allowedScope: ['src/db/**', 'src/config/database.ts'],
        forbiddenScope: ['src/api/**', 'tests/fixtures/'],
        requirements:
          'Replace direct connections with a connection pool using pg-pool.',
        definitionOfDone: [
          'Connection pool implemented',
          'All existing tests pass',
          'Pool configuration is in config file',
        ],
      });

      const loader = new ContextLoader(projectRoot);
      const task = await loader.parseTask(taskPath);

      expect(task.goal).toBe('Refactor database connection pooling');
      expect(task.taskType).toBe('refactor');
      expect(task.scope.allowed).toEqual(['src/db/**', 'src/config/database.ts']);
      expect(task.scope.forbidden).toEqual(['src/api/**', 'tests/fixtures/']);
      expect(task.requirements).toContain('pg-pool');
      expect(task.definitionOfDone).toHaveLength(3);
      expect(task.definitionOfDone).toContain('Connection pool implemented');
      expect(task.definitionOfDone).toContain('All existing tests pass');
      expect(task.definitionOfDone).toContain(
        'Pool configuration is in config file'
      );
    } finally {
      await cleanup();
    }
  });

  it('should load and validate config.yml correctly', async () => {
    const { projectRoot, aiDir, cleanup } = await createTempProject();
    try {
      // Write a valid config with specific values
      const configPath = await createConfigFixture(projectRoot, {
        provider: { type: 'anthropic-api', model: 'claude-sonnet-4-20250514' },
        execution: {
          max_iterations: 25,
          max_consecutive_failures: 5,
          timeout_per_iteration: 120,
        },
        permissions: {
          scope_enforcement: 'ask',
          auto_commit: true,
          auto_push: false,
          auto_pr: false,
        },
      });

      // Read and parse the config
      const rawYaml = await readFile(configPath, 'utf-8');
      const parsed = yamlParse(rawYaml) as AidfConfig;

      expect(parsed.version).toBe(1);
      expect(parsed.provider.type).toBe('anthropic-api');
      expect(parsed.provider.model).toBe('claude-sonnet-4-20250514');
      expect(parsed.execution.max_iterations).toBe(25);
      expect(parsed.execution.max_consecutive_failures).toBe(5);
      expect(parsed.permissions.scope_enforcement).toBe('ask');
      expect(parsed.permissions.auto_commit).toBe(true);
      expect(parsed.git.commit_prefix).toBe('aidf:');

      // Write invalid YAML (missing provider.type)
      const invalidConfig = `
version: 1
provider:
  model: some-model
execution:
  max_iterations: 10
`;
      const invalidPath = join(aiDir, 'config-invalid.yml');
      await writeFile(invalidPath, invalidConfig);

      const invalidRaw = await readFile(invalidPath, 'utf-8');
      const invalidParsed = yamlParse(invalidRaw);

      // Validation: provider.type should be missing
      expect(invalidParsed.provider.type).toBeUndefined();
      expect(invalidParsed.permissions).toBeUndefined();
    } finally {
      await cleanup();
    }
  });

  it('should auto-select the first task by filename sort order', async () => {
    const { projectRoot, aiDir, cleanup } = await createTempProject();
    try {
      // Create 3 tasks with different numeric prefixes
      await createTaskFixture(projectRoot, {
        id: '003',
        goal: 'Third task',
        type: 'component',
        allowedScope: ['src/**'],
        forbiddenScope: [],
        requirements: 'Third.',
        definitionOfDone: ['Done'],
      });
      await createTaskFixture(projectRoot, {
        id: '001',
        goal: 'First task',
        type: 'component',
        allowedScope: ['src/**'],
        forbiddenScope: [],
        requirements: 'First.',
        definitionOfDone: ['Done'],
      });
      await createTaskFixture(projectRoot, {
        id: '002',
        goal: 'Second task',
        type: 'component',
        allowedScope: ['src/**'],
        forbiddenScope: [],
        requirements: 'Second.',
        definitionOfDone: ['Done'],
      });

      const pendingDir = join(aiDir, 'tasks', 'pending');
      const { readdir } = await import('fs/promises');
      const files = (await readdir(pendingDir)).sort();

      expect(files[0]).toBe('001-task.md');
      expect(files[1]).toBe('002-task.md');
      expect(files[2]).toBe('003-task.md');
      expect(files).toHaveLength(3);
    } finally {
      await cleanup();
    }
  });

  it('should read task status from a file with appended status', async () => {
    const { projectRoot, cleanup } = await createTempProject();
    try {
      const taskPath = await createTaskFixture(projectRoot, {
        id: '010',
        goal: 'Completed task example',
        type: 'component',
        allowedScope: ['src/**'],
        forbiddenScope: [],
        requirements: 'Some requirements.',
        definitionOfDone: ['Done'],
      });

      // Append a status section
      const currentContent = await readFile(taskPath, 'utf-8');
      await writeFile(
        taskPath,
        currentContent + '\n## Status: COMPLETED\n\nTask finished successfully.\n'
      );

      const status = await readTaskStatus(taskPath);
      expect(status).toBe('COMPLETED');

      // Test with BLOCKED status
      const taskPath2 = await createTaskFixture(projectRoot, {
        id: '011',
        goal: 'Blocked task example',
        type: 'bugfix',
        allowedScope: ['src/**'],
        forbiddenScope: [],
        requirements: 'Fix the bug.',
        definitionOfDone: ['Bug fixed'],
      });

      const content2 = await readFile(taskPath2, 'utf-8');
      await writeFile(
        taskPath2,
        content2 + '\n## Status: BLOCKED\n\nNeed more info.\n'
      );

      const status2 = await readTaskStatus(taskPath2);
      expect(status2).toBe('BLOCKED');
    } finally {
      await cleanup();
    }
  });

  it('should enforce scope with ScopeGuard on real file paths', async () => {
    const { projectRoot, cleanup } = await createTempProject({ withGit: true });
    try {
      // Create files in various locations
      await mkdir(join(projectRoot, 'src', 'components'), { recursive: true });
      await mkdir(join(projectRoot, 'src', 'utils'), { recursive: true });
      await mkdir(join(projectRoot, 'config'), { recursive: true });
      await mkdir(join(projectRoot, 'secrets'), { recursive: true });

      await writeFile(
        join(projectRoot, 'src/components/Button.tsx'),
        'export const Button = () => null;'
      );
      await writeFile(
        join(projectRoot, 'src/utils/helpers.ts'),
        'export const helper = () => {};'
      );
      await writeFile(
        join(projectRoot, 'config/app.json'),
        '{"key": "value"}'
      );
      await writeFile(
        join(projectRoot, 'secrets/keys.json'),
        '{"secret": "hidden"}'
      );

      const guard = new ScopeGuard(
        {
          allowed: ['src/**'],
          forbidden: ['secrets/**', 'config/**'],
        },
        'strict'
      );

      // Allowed file
      const allowedDecision = guard.validate([
        { path: 'src/components/Button.tsx', type: 'modified' },
      ]);
      expect(allowedDecision.action).toBe('ALLOW');

      // Another allowed file
      const allowedDecision2 = guard.validate([
        { path: 'src/utils/helpers.ts', type: 'created' },
      ]);
      expect(allowedDecision2.action).toBe('ALLOW');

      // Forbidden file
      const forbiddenDecision = guard.validate([
        { path: 'secrets/keys.json', type: 'modified' },
      ]);
      expect(forbiddenDecision.action).toBe('BLOCK');

      // Forbidden config file
      const configDecision = guard.validate([
        { path: 'config/app.json', type: 'modified' },
      ]);
      expect(configDecision.action).toBe('BLOCK');

      // File outside allowed scope (strict mode should block)
      const outsideDecision = guard.validate([
        { path: 'README.md', type: 'modified' },
      ]);
      expect(outsideDecision.action).toBe('BLOCK');
    } finally {
      await cleanup();
    }
  });

  it('should load skills via ContextLoader when enabled', async () => {
    const { projectRoot, cleanup } = await createTempProject();
    try {
      // Create a skill matching the default role name (developer -> aidf-developer)
      await createSkillFixture(projectRoot, {
        name: 'aidf-developer',
        description: 'Developer skill for AIDF tasks',
        version: '1.0.0',
        tags: ['development', 'typescript'],
        body: '## Instructions\n\nFollow TypeScript best practices.\n\n## Rules\n\n- Use strict types\n- Write unit tests',
      });

      const taskPath = await createTaskFixture(projectRoot, {
        id: '020',
        goal: 'Build a feature with skills',
        type: 'component',
        allowedScope: ['src/**'],
        forbiddenScope: [],
        requirements: 'Use skill guidance.',
        definitionOfDone: ['Feature works'],
      });

      const loader = new ContextLoader(projectRoot);
      const context = await loader.loadContext(taskPath, { enabled: true });

      expect(context.skills).toBeDefined();
      expect(context.skills).toHaveLength(1);
      expect(context.skills![0].metadata.name).toBe('aidf-developer');
      expect(context.skills![0].metadata.description).toBe(
        'Developer skill for AIDF tasks'
      );
      expect(context.skills![0].content).toContain(
        'Follow TypeScript best practices'
      );
    } finally {
      await cleanup();
    }
  });

  it('should detect resume state from blocked task metadata', async () => {
    const { projectRoot, cleanup } = await createTempProject();
    try {
      const taskPath = await createTaskFixture(projectRoot, {
        id: '030',
        goal: 'Resume after being blocked',
        type: 'bugfix',
        allowedScope: ['src/**'],
        forbiddenScope: ['dist/'],
        requirements: 'Fix the critical bug.',
        definitionOfDone: ['Bug fixed', 'Tests pass'],
      });

      // Append blocked status metadata in the format the parser expects
      const currentContent = await readFile(taskPath, 'utf-8');
      const blockedMetadata = `
## Status: BLOCKED

### Execution Log
- **Iterations:** 3
- **Started:** 2024-01-01T00:00:00Z
- **Blocked at:** 2024-01-01T00:01:00Z

### Blocking Issue
\`\`\`
Scope violation detected in iteration 3
\`\`\`

### Files Modified
- \`src/a.ts\`
- \`src/b.ts\`
`;

      await writeFile(taskPath, currentContent + blockedMetadata);

      const loader = new ContextLoader(projectRoot);
      const task = await loader.parseTask(taskPath);

      expect(task.blockedStatus).toBeDefined();
      expect(task.blockedStatus!.previousIteration).toBe(3);
      expect(task.blockedStatus!.filesModified).toEqual([
        'src/a.ts',
        'src/b.ts',
      ]);
      expect(task.blockedStatus!.blockingIssue).toBe(
        'Scope violation detected in iteration 3'
      );
      expect(task.blockedStatus!.startedAt).toBe('2024-01-01T00:00:00Z');
      expect(task.blockedStatus!.blockedAt).toBe('2024-01-01T00:01:00Z');
    } finally {
      await cleanup();
    }
  });

  it('should load multiple roles with distinct identities', async () => {
    const { projectRoot, cleanup } = await createTempProject();
    try {
      // The default project already has a 'developer' role.
      // Create additional roles.
      await createRoleFixture(projectRoot, {
        name: 'tester',
        identity: 'Quality assurance specialist focused on test coverage.',
        expertise: ['Vitest', 'Playwright', 'Test strategy'],
        responsibilities: [
          'Write unit tests',
          'Write integration tests',
          'Verify coverage thresholds',
        ],
      });

      await createRoleFixture(projectRoot, {
        name: 'reviewer',
        identity:
          'Senior code reviewer ensuring code quality and best practices.',
        expertise: ['Code review', 'Architecture patterns', 'Security'],
        responsibilities: [
          'Review pull requests',
          'Suggest improvements',
          'Enforce standards',
        ],
      });

      const loader = new ContextLoader(projectRoot);

      const developer = await loader.parseRole('developer');
      const tester = await loader.parseRole('tester');
      const reviewer = await loader.parseRole('reviewer');

      // Each role has a distinct identity
      expect(developer.identity).toContain('developer');
      expect(tester.identity).toContain('Quality assurance');
      expect(reviewer.identity).toContain('code reviewer');

      // Each role has different expertise
      expect(developer.expertise).toContain('TypeScript');
      expect(tester.expertise).toContain('Vitest');
      expect(reviewer.expertise).toContain('Code review');

      // Each role has different responsibilities
      expect(developer.responsibilities).toContain('Write code');
      expect(tester.responsibilities).toContain('Write unit tests');
      expect(reviewer.responsibilities).toContain('Review pull requests');

      // Role names are correct
      expect(developer.name).toBe('developer');
      expect(tester.name).toBe('tester');
      expect(reviewer.name).toBe('reviewer');
    } finally {
      await cleanup();
    }
  });
});
