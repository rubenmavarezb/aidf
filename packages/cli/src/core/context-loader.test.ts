import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ContextLoader } from './context-loader.js';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('ContextLoader', () => {
  let testDir: string;
  let aiDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `aidf-test-${Date.now()}`);
    aiDir = join(testDir, '.ai');
    await mkdir(join(aiDir, 'roles'), { recursive: true });
    await mkdir(join(aiDir, 'tasks'), { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('findAiDir', () => {
    it('should find .ai directory in parent folders', async () => {
      const agentsContent = `# AGENTS.md\n\n## Project Overview\n\nTest project`;
      await writeFile(join(aiDir, 'AGENTS.md'), agentsContent);

      const subDir = join(testDir, 'src', 'components');
      await mkdir(subDir, { recursive: true });

      const result = ContextLoader.findAiDir(subDir);
      expect(result).toBe(testDir);
    });

    it('should return null if no .ai directory found', () => {
      const result = ContextLoader.findAiDir('/tmp/nonexistent-dir-12345');
      expect(result).toBeNull();
    });
  });

  describe('parseTask', () => {
    it('should parse task type correctly', async () => {
      const taskContent = `# TASK: Test Task

## Goal

Implement a feature.

## Task Type

refactor

## Suggested Roles

- developer
- tester

## Scope

### Allowed

- \`src/**/*.ts\`
- \`tests/**/*.ts\`

### Forbidden

- \`config/**\`

## Requirements

Some requirements here.

## Definition of Done

- [ ] Code compiles
- [x] Tests pass
- [ ] Lint passes

## Notes

Some additional notes.
`;
      const taskPath = join(aiDir, 'tasks', 'test-task.md');
      await writeFile(taskPath, taskContent);

      // Create required AGENTS.md for the loader
      await writeFile(join(aiDir, 'AGENTS.md'), '# AGENTS.md\n\n## Project Overview\n\nTest');

      const loader = new ContextLoader(testDir);
      const task = await loader.parseTask(taskPath);

      expect(task.taskType).toBe('refactor');
      expect(task.goal).toBe('Implement a feature.');
      expect(task.filePath).toBe(taskPath);
    });

    it('should extract scope allowed/forbidden paths', async () => {
      const taskContent = `# TASK: Scoped Task

## Goal

Test scope extraction.

## Task Type

component

## Suggested Roles

- developer

## Scope

### Allowed

- \`src/components/**/*.tsx\`
- \`src/utils/helpers.ts\`

### Forbidden

- \`src/config/**\`
- \`node_modules/**\`

### Ask Before

- \`src/api/**\`

## Requirements

N/A

## Definition of Done

- [ ] Done
`;
      const taskPath = join(aiDir, 'tasks', 'scoped-task.md');
      await writeFile(taskPath, taskContent);
      await writeFile(join(aiDir, 'AGENTS.md'), '# AGENTS.md\n\n## Project Overview\n\nTest');

      const loader = new ContextLoader(testDir);
      const task = await loader.parseTask(taskPath);

      expect(task.scope.allowed).toEqual([
        'src/components/**/*.tsx',
        'src/utils/helpers.ts',
      ]);
      expect(task.scope.forbidden).toEqual([
        'src/config/**',
        'node_modules/**',
      ]);
      expect(task.scope.ask_before).toEqual(['src/api/**']);
    });

    it('should extract definition of done checklist', async () => {
      const taskContent = `# TASK: DoD Task

## Goal

Test DoD extraction.

## Task Type

test

## Suggested Roles

- tester

## Scope

### Allowed

- \`tests/**\`

### Forbidden

- \`src/**\`

## Requirements

N/A

## Definition of Done

- [ ] Unit tests written
- [x] Integration tests pass
- [ ] Coverage above 80%
- [ ] No console.log statements
`;
      const taskPath = join(aiDir, 'tasks', 'dod-task.md');
      await writeFile(taskPath, taskContent);
      await writeFile(join(aiDir, 'AGENTS.md'), '# AGENTS.md\n\n## Project Overview\n\nTest');

      const loader = new ContextLoader(testDir);
      const task = await loader.parseTask(taskPath);

      expect(task.definitionOfDone).toEqual([
        'Unit tests written',
        'Integration tests pass',
        'Coverage above 80%',
        'No console.log statements',
      ]);
    });

    it('should default to component type for invalid task types', async () => {
      const taskContent = `# TASK

## Goal

Test

## Task Type

invalid-type

## Suggested Roles

- developer

## Scope

### Allowed

- \`*\`

### Forbidden

- none

## Requirements

N/A

## Definition of Done

- [ ] Done
`;
      const taskPath = join(aiDir, 'tasks', 'invalid-type.md');
      await writeFile(taskPath, taskContent);
      await writeFile(join(aiDir, 'AGENTS.md'), '# AGENTS.md\n\n## Project Overview\n\nTest');

      const loader = new ContextLoader(testDir);
      const task = await loader.parseTask(taskPath);

      expect(task.taskType).toBe('component');
    });

    it('should throw error for non-existent task file', async () => {
      await writeFile(join(aiDir, 'AGENTS.md'), '# AGENTS.md\n\n## Project Overview\n\nTest');

      const loader = new ContextLoader(testDir);
      await expect(loader.parseTask('/nonexistent/task.md')).rejects.toThrow('Task file not found');
    });
  });

  describe('parseRole', () => {
    it('should parse role expertise list', async () => {
      const roleContent = `# Role: Developer

## Identity

You are a senior developer.

## Expertise

- TypeScript
- React
- Testing

## Responsibilities

- Write clean code
- Review PRs

## Constraints

- Do NOT skip tests
- Do NOT add deps without approval

## Quality Criteria

Your work is successful when:

- Code compiles
- Tests pass
- No lint errors

## Output Format

Provide complete code changes.
`;
      await writeFile(join(aiDir, 'roles', 'developer.md'), roleContent);
      await writeFile(join(aiDir, 'AGENTS.md'), '# AGENTS.md\n\n## Project Overview\n\nTest');

      const loader = new ContextLoader(testDir);
      const role = await loader.parseRole('developer');

      expect(role.name).toBe('developer');
      expect(role.identity).toBe('You are a senior developer.');
      expect(role.expertise).toEqual(['TypeScript', 'React', 'Testing']);
      expect(role.responsibilities).toEqual(['Write clean code', 'Review PRs']);
      expect(role.constraints).toEqual([
        'Do NOT skip tests',
        'Do NOT add deps without approval',
      ]);
    });

    it('should throw error for non-existent role', async () => {
      await writeFile(join(aiDir, 'AGENTS.md'), '# AGENTS.md\n\n## Project Overview\n\nTest');

      const loader = new ContextLoader(testDir);
      await expect(loader.parseRole('nonexistent')).rejects.toThrow('Role file not found');
    });
  });

  describe('parseAgents', () => {
    it('should parse AGENTS.md boundaries correctly', async () => {
      const agentsContent = `# AGENTS.md

## Project Overview

A test project for unit testing.

## Architecture

Simple architecture.

## Technology Stack

| Category | Technology |
|----------|------------|
| Language | TypeScript |

## Conventions

Follow standard conventions.

## Quality Standards

High quality required.

## Boundaries

### Never Modify Without Approval

- \`package.json\` - Critical config
- \`tsconfig.json\` - TypeScript config

### Never Do

- Delete production data
- Push to main directly

### Requires Discussion

- Adding new dependencies
- Changing API contracts

## Commands

### Development

\`\`\`bash
npm run dev     # Start development server
npm run build   # Build the project
\`\`\`

### Quality Checks

\`\`\`bash
npm test        # Run tests
npm run lint    # Run linter
\`\`\`

### Build & Deploy

\`\`\`bash
npm run deploy  # Deploy to production
\`\`\`
`;
      await writeFile(join(aiDir, 'AGENTS.md'), agentsContent);

      const loader = new ContextLoader(testDir);
      const agents = await loader.parseAgents();

      expect(agents.projectOverview).toBe('A test project for unit testing.');
      expect(agents.boundaries.neverModify).toEqual([
        '`package.json` - Critical config',
        '`tsconfig.json` - TypeScript config',
      ]);
      expect(agents.boundaries.neverDo).toEqual([
        'Delete production data',
        'Push to main directly',
      ]);
      expect(agents.boundaries.requiresDiscussion).toEqual([
        'Adding new dependencies',
        'Changing API contracts',
      ]);
    });

    it('should extract commands from code blocks', async () => {
      const agentsContent = `# AGENTS.md

## Project Overview

Test

## Architecture

Test

## Technology Stack

Test

## Conventions

Test

## Quality Standards

Test

## Boundaries

### Never Modify Without Approval

- none

### Never Do

- none

### Requires Discussion

- none

## Commands

### Development

\`\`\`bash
npm start       # Start the server
npm run watch   # Watch mode
\`\`\`

### Quality Checks

\`\`\`bash
npm test        # Run tests
npm run lint    # Lint code
\`\`\`

### Build & Deploy

\`\`\`bash
npm run build   # Production build
\`\`\`
`;
      await writeFile(join(aiDir, 'AGENTS.md'), agentsContent);

      const loader = new ContextLoader(testDir);
      const agents = await loader.parseAgents();

      expect(agents.commands.development).toEqual({
        'npm start': 'Start the server',
        'npm run watch': 'Watch mode',
      });
      expect(agents.commands.quality).toEqual({
        'npm test': 'Run tests',
        'npm run lint': 'Lint code',
      });
      expect(agents.commands.build).toEqual({
        'npm run build': 'Production build',
      });
    });

    it('should throw error when AGENTS.md not found', async () => {
      // Remove the AGENTS.md file (wasn't created in this test)
      const loader = new ContextLoader(testDir);
      await expect(loader.parseAgents()).rejects.toThrow('AGENTS.md not found');
    });
  });

  describe('loadPlanIfExists', () => {
    it('should return plan content when file exists', async () => {
      const planContent = `# Implementation Plan\n\n## Phase 1\n\nDo stuff`;
      await writeFile(join(aiDir, 'IMPLEMENTATION_PLAN.md'), planContent);

      const loader = new ContextLoader(testDir);
      const plan = await loader.loadPlanIfExists();

      expect(plan).toBe(planContent);
    });

    it('should return undefined when plan file does not exist', async () => {
      const loader = new ContextLoader(testDir);
      const plan = await loader.loadPlanIfExists();

      expect(plan).toBeUndefined();
    });
  });

  describe('loadContext', () => {
    it('should load full context for a task', async () => {
      // Setup AGENTS.md
      const agentsContent = `# AGENTS.md

## Project Overview

Full context test project.

## Architecture

Modular architecture.

## Technology Stack

TypeScript + Node.js

## Conventions

Standard conventions.

## Quality Standards

High quality.

## Boundaries

### Never Modify Without Approval

- none

### Never Do

- none

### Requires Discussion

- none

## Commands

### Development

\`\`\`bash
npm run dev     # Dev server
\`\`\`

### Quality Checks

\`\`\`bash
npm test        # Tests
\`\`\`

### Build & Deploy

\`\`\`bash
npm run build   # Build
\`\`\`
`;
      await writeFile(join(aiDir, 'AGENTS.md'), agentsContent);

      // Setup role
      const roleContent = `# Role: Developer

## Identity

Senior dev.

## Expertise

- TypeScript

## Responsibilities

- Code

## Constraints

- Follow patterns

## Quality Criteria

- Clean code
`;
      await writeFile(join(aiDir, 'roles', 'developer.md'), roleContent);

      // Setup task
      const taskContent = `# TASK: Full Test

## Goal

Test full context loading.

## Task Type

component

## Suggested Roles

- developer

## Scope

### Allowed

- \`src/**\`

### Forbidden

- \`config/**\`

## Requirements

Implement feature.

## Definition of Done

- [ ] Done
`;
      const taskPath = join(aiDir, 'tasks', 'full-test.md');
      await writeFile(taskPath, taskContent);

      const loader = new ContextLoader(testDir);
      const context = await loader.loadContext(taskPath);

      expect(context.agents.projectOverview).toBe('Full context test project.');
      expect(context.role.name).toBe('developer');
      expect(context.task.goal).toBe('Test full context loading.');
      expect(context.plan).toBeUndefined();
    });

    it('should default to developer role when no role suggested', async () => {
      const agentsContent = `# AGENTS.md

## Project Overview

Test

## Architecture

Test

## Technology Stack

Test

## Conventions

Test

## Quality Standards

Test

## Boundaries

### Never Modify Without Approval

- none

### Never Do

- none

### Requires Discussion

- none

## Commands

### Development

\`\`\`bash
test    # test
\`\`\`

### Quality Checks

\`\`\`bash
test    # test
\`\`\`

### Build & Deploy

\`\`\`bash
test    # test
\`\`\`
`;
      await writeFile(join(aiDir, 'AGENTS.md'), agentsContent);

      const roleContent = `# Role: Developer

## Identity

Default dev.

## Expertise

- Code

## Responsibilities

- Code

## Constraints

- None

## Quality Criteria

- Works
`;
      await writeFile(join(aiDir, 'roles', 'developer.md'), roleContent);

      const taskContent = `# TASK: No Role

## Goal

Test default role.

## Task Type

component

## Suggested Roles



## Scope

### Allowed

- \`*\`

### Forbidden

- none

## Requirements

N/A

## Definition of Done

- [ ] Done
`;
      const taskPath = join(aiDir, 'tasks', 'no-role.md');
      await writeFile(taskPath, taskContent);

      const loader = new ContextLoader(testDir);
      const context = await loader.loadContext(taskPath);

      expect(context.role.name).toBe('developer');
    });
  });
});
