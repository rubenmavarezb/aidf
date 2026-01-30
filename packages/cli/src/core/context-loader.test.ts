import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ContextLoader, estimateTokens, estimateContextSize } from './context-loader.js';
import type { LoadedContext } from '../types/index.js';
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

    it('should filter skills by task role', async () => {
      // Setup AGENTS.md, role, task
      await writeFile(join(aiDir, 'AGENTS.md'), `# AGENTS.md\n\n## Project Overview\n\nTest\n\n## Architecture\n\nTest\n\n## Technology Stack\n\nTest\n\n## Conventions\n\nTest\n\n## Quality Standards\n\nTest\n\n## Boundaries\n\n### Never Modify Without Approval\n\n- none\n\n### Never Do\n\n- none\n\n### Requires Discussion\n\n- none\n\n## Commands\n\n### Development\n\n\`\`\`bash\ntest    # test\n\`\`\`\n\n### Quality Checks\n\n\`\`\`bash\ntest    # test\n\`\`\`\n\n### Build & Deploy\n\n\`\`\`bash\ntest    # test\n\`\`\``);
      await writeFile(join(aiDir, 'roles', 'developer.md'), `# Role: Developer\n\n## Identity\n\nDev.\n\n## Expertise\n\n- Code\n\n## Responsibilities\n\n- Code\n\n## Constraints\n\n- None\n\n## Quality Criteria\n\n- Works`);

      const taskContent = `# TASK\n\n## Goal\n\nTest skill filtering.\n\n## Task Type\n\ncomponent\n\n## Suggested Roles\n\n- developer\n\n## Scope\n\n### Allowed\n\n- \`src/**\`\n\n### Forbidden\n\n- none\n\n## Requirements\n\nN/A\n\n## Definition of Done\n\n- [ ] Done`;
      const taskPath = join(aiDir, 'tasks', 'skill-filter.md');
      await writeFile(taskPath, taskContent);

      // Create multiple skills — only aidf-developer should be loaded
      const skillsDir = join(aiDir, 'skills');
      await mkdir(join(skillsDir, 'aidf-developer'), { recursive: true });
      await mkdir(join(skillsDir, 'aidf-architect'), { recursive: true });
      await mkdir(join(skillsDir, 'aidf-tester'), { recursive: true });

      await writeFile(join(skillsDir, 'aidf-developer', 'SKILL.md'), `---\nname: aidf-developer\ndescription: Developer skill\n---\n\n# Developer instructions`);
      await writeFile(join(skillsDir, 'aidf-architect', 'SKILL.md'), `---\nname: aidf-architect\ndescription: Architect skill\n---\n\n# Architect instructions`);
      await writeFile(join(skillsDir, 'aidf-tester', 'SKILL.md'), `---\nname: aidf-tester\ndescription: Tester skill\n---\n\n# Tester instructions`);

      const loader = new ContextLoader(testDir);
      const context = await loader.loadContext(taskPath, { enabled: true });

      // Only the developer skill should be loaded
      expect(context.skills).toBeDefined();
      expect(context.skills).toHaveLength(1);
      expect(context.skills![0].metadata.name).toBe('aidf-developer');
    });

    it('should return no skills when role has no matching skill', async () => {
      await writeFile(join(aiDir, 'AGENTS.md'), `# AGENTS.md\n\n## Project Overview\n\nTest\n\n## Architecture\n\nTest\n\n## Technology Stack\n\nTest\n\n## Conventions\n\nTest\n\n## Quality Standards\n\nTest\n\n## Boundaries\n\n### Never Modify Without Approval\n\n- none\n\n### Never Do\n\n- none\n\n### Requires Discussion\n\n- none\n\n## Commands\n\n### Development\n\n\`\`\`bash\ntest    # test\n\`\`\`\n\n### Quality Checks\n\n\`\`\`bash\ntest    # test\n\`\`\`\n\n### Build & Deploy\n\n\`\`\`bash\ntest    # test\n\`\`\``);
      await writeFile(join(aiDir, 'roles', 'developer.md'), `# Role: Developer\n\n## Identity\n\nDev.\n\n## Expertise\n\n- Code\n\n## Responsibilities\n\n- Code\n\n## Constraints\n\n- None\n\n## Quality Criteria\n\n- Works`);

      const taskContent = `# TASK\n\n## Goal\n\nTest no matching skill.\n\n## Task Type\n\ncomponent\n\n## Suggested Roles\n\n- developer\n\n## Scope\n\n### Allowed\n\n- \`src/**\`\n\n### Forbidden\n\n- none\n\n## Requirements\n\nN/A\n\n## Definition of Done\n\n- [ ] Done`;
      const taskPath = join(aiDir, 'tasks', 'no-skill.md');
      await writeFile(taskPath, taskContent);

      // Create only architect skill — no match for developer role
      const skillsDir = join(aiDir, 'skills');
      await mkdir(join(skillsDir, 'aidf-architect'), { recursive: true });
      await writeFile(join(skillsDir, 'aidf-architect', 'SKILL.md'), `---\nname: aidf-architect\ndescription: Architect skill\n---\n\n# Architect instructions`);

      const loader = new ContextLoader(testDir);
      const context = await loader.loadContext(taskPath, { enabled: true });

      // No matching skill → skills should be undefined
      expect(context.skills).toBeUndefined();
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

  describe('parseBlockedStatus', () => {
    it('should parse blocked status from task file', async () => {
      const taskContent = `# TASK: Blocked Task

## Goal

Test blocked status parsing.

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

N/A

## Definition of Done

- [ ] Done

## Status: BLOCKED

### Execution Log
- **Started:** 2024-01-01T10:00:00.000Z
- **Iterations:** 5
- **Blocked at:** 2024-01-01T11:00:00.000Z

### Blocking Issue
\`\`\`
Missing API key configuration
\`\`\`

### Files Modified
- \`src/api/client.ts\`
- \`src/config/settings.ts\`

---
@developer: Review and provide guidance, then run \`aidf run --resume task.md\`
`;
      const taskPath = join(aiDir, 'tasks', 'blocked-task.md');
      await writeFile(taskPath, taskContent);
      await writeFile(join(aiDir, 'AGENTS.md'), '# AGENTS.md\n\n## Project Overview\n\nTest');

      const loader = new ContextLoader(testDir);
      const task = await loader.parseTask(taskPath);

      expect(task.blockedStatus).toBeDefined();
      expect(task.blockedStatus?.previousIteration).toBe(5);
      expect(task.blockedStatus?.startedAt).toBe('2024-01-01T10:00:00.000Z');
      expect(task.blockedStatus?.blockedAt).toBe('2024-01-01T11:00:00.000Z');
      expect(task.blockedStatus?.blockingIssue).toBe('Missing API key configuration');
      expect(task.blockedStatus?.filesModified).toEqual([
        'src/api/client.ts',
        'src/config/settings.ts',
      ]);
    });

    it('should return undefined for non-blocked task', async () => {
      const taskContent = `# TASK: Normal Task

## Goal

Test normal task.

## Task Type

component

## Suggested Roles

- developer

## Scope

### Allowed

- \`src/**\`

### Forbidden

- none

## Requirements

N/A

## Definition of Done

- [ ] Done
`;
      const taskPath = join(aiDir, 'tasks', 'normal-task.md');
      await writeFile(taskPath, taskContent);
      await writeFile(join(aiDir, 'AGENTS.md'), '# AGENTS.md\n\n## Project Overview\n\nTest');

      const loader = new ContextLoader(testDir);
      const task = await loader.parseTask(taskPath);

      expect(task.blockedStatus).toBeUndefined();
    });

    it('should handle task with no files modified', async () => {
      const taskContent = `# TASK: Blocked No Files

## Goal

Test blocked with no files.

## Task Type

component

## Suggested Roles

- developer

## Scope

### Allowed

- \`src/**\`

### Forbidden

- none

## Requirements

N/A

## Definition of Done

- [ ] Done

## Status: BLOCKED

### Execution Log
- **Started:** 2024-01-01T10:00:00.000Z
- **Iterations:** 0
- **Blocked at:** 2024-01-01T10:05:00.000Z

### Blocking Issue
\`\`\`
Initial blocker
\`\`\`

### Files Modified
_None_

---
@developer: Review and provide guidance, then run \`aidf run --resume task.md\`
`;
      const taskPath = join(aiDir, 'tasks', 'blocked-no-files.md');
      await writeFile(taskPath, taskContent);
      await writeFile(join(aiDir, 'AGENTS.md'), '# AGENTS.md\n\n## Project Overview\n\nTest');

      const loader = new ContextLoader(testDir);
      const task = await loader.parseTask(taskPath);

      expect(task.blockedStatus).toBeDefined();
      expect(task.blockedStatus?.filesModified).toEqual([]);
    });

    it('should handle task with completed status', async () => {
      const taskContent = `# TASK: Completed Task

## Goal

Test completed task.

## Task Type

component

## Suggested Roles

- developer

## Scope

### Allowed

- \`src/**\`

### Forbidden

- none

## Requirements

N/A

## Definition of Done

- [ ] Done

## Status: ✅ COMPLETED
`;
      const taskPath = join(aiDir, 'tasks', 'completed-task.md');
      await writeFile(taskPath, taskContent);
      await writeFile(join(aiDir, 'AGENTS.md'), '# AGENTS.md\n\n## Project Overview\n\nTest');

      const loader = new ContextLoader(testDir);
      const task = await loader.parseTask(taskPath);

      expect(task.blockedStatus).toBeUndefined();
    });
  });
});

describe('estimateTokens', () => {
  it('should estimate tokens as chars / 4', () => {
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcdefgh')).toBe(2);
    expect(estimateTokens('ab')).toBe(1); // ceil(2/4) = 1
  });

  it('should handle empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('should round up for non-divisible lengths', () => {
    expect(estimateTokens('abcde')).toBe(2); // ceil(5/4) = 2
    expect(estimateTokens('a')).toBe(1); // ceil(1/4) = 1
  });
});

describe('estimateContextSize', () => {
  it('should calculate breakdown for all context layers', () => {
    const context: LoadedContext = {
      agents: {
        projectOverview: '',
        architecture: '',
        technologyStack: '',
        conventions: '',
        qualityStandards: '',
        boundaries: { neverModify: [], neverDo: [], requiresDiscussion: [] },
        commands: { development: {}, quality: {}, build: {} },
        raw: 'a'.repeat(400), // 100 tokens
      },
      role: {
        name: 'developer',
        identity: '',
        expertise: [],
        responsibilities: [],
        constraints: [],
        qualityCriteria: [],
        raw: 'b'.repeat(200), // 50 tokens
      },
      task: {
        filePath: '/test.md',
        goal: 'Test',
        taskType: 'component',
        suggestedRoles: ['developer'],
        scope: { allowed: ['**'], forbidden: [] },
        requirements: '',
        definitionOfDone: [],
        raw: 'c'.repeat(100), // 25 tokens
      },
      plan: 'd'.repeat(80), // 20 tokens
      skills: [
        {
          name: 'skill1',
          path: '/skill1',
          source: 'project',
          metadata: { name: 'skill1', description: 'test' },
          content: 'e'.repeat(120), // 30 tokens
        },
      ],
    };

    const result = estimateContextSize(context);

    expect(result.breakdown.agents).toBe(100);
    expect(result.breakdown.role).toBe(50);
    expect(result.breakdown.task).toBe(25);
    expect(result.breakdown.plan).toBe(20);
    expect(result.breakdown.skills).toBe(30);
    expect(result.total).toBe(225);
  });

  it('should handle missing optional layers', () => {
    const context: LoadedContext = {
      agents: {
        projectOverview: '',
        architecture: '',
        technologyStack: '',
        conventions: '',
        qualityStandards: '',
        boundaries: { neverModify: [], neverDo: [], requiresDiscussion: [] },
        commands: { development: {}, quality: {}, build: {} },
        raw: 'a'.repeat(40), // 10 tokens
      },
      role: {
        name: 'developer',
        identity: '',
        expertise: [],
        responsibilities: [],
        constraints: [],
        qualityCriteria: [],
        raw: 'b'.repeat(20), // 5 tokens
      },
      task: {
        filePath: '/test.md',
        goal: 'Test',
        taskType: 'component',
        suggestedRoles: ['developer'],
        scope: { allowed: ['**'], forbidden: [] },
        requirements: '',
        definitionOfDone: [],
        raw: 'c'.repeat(8), // 2 tokens
      },
    };

    const result = estimateContextSize(context);

    expect(result.breakdown.plan).toBe(0);
    expect(result.breakdown.skills).toBe(0);
    expect(result.total).toBe(17);
  });

  it('should sum multiple skills', () => {
    const context: LoadedContext = {
      agents: {
        projectOverview: '',
        architecture: '',
        technologyStack: '',
        conventions: '',
        qualityStandards: '',
        boundaries: { neverModify: [], neverDo: [], requiresDiscussion: [] },
        commands: { development: {}, quality: {}, build: {} },
        raw: '',
      },
      role: {
        name: 'dev',
        identity: '',
        expertise: [],
        responsibilities: [],
        constraints: [],
        qualityCriteria: [],
        raw: '',
      },
      task: {
        filePath: '/t.md',
        goal: 'T',
        taskType: 'component',
        suggestedRoles: [],
        scope: { allowed: [], forbidden: [] },
        requirements: '',
        definitionOfDone: [],
        raw: '',
      },
      skills: [
        { name: 's1', path: '/s1', source: 'project', metadata: { name: 's1', description: '' }, content: 'x'.repeat(40) },
        { name: 's2', path: '/s2', source: 'global', metadata: { name: 's2', description: '' }, content: 'y'.repeat(80) },
      ],
    };

    const result = estimateContextSize(context);

    expect(result.breakdown.skills).toBe(30); // 10 + 20
  });
});
