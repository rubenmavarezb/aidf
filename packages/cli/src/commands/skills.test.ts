import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSkillsCommand } from './skills.js';

vi.mock('../core/context-loader.js', () => ({
  ContextLoader: {
    findAiDir: vi.fn(() => '/test/project'),
  },
}));

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: vi.fn(() => false),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(() => '{}'),
  };
});

describe('skills command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createSkillsCommand', () => {
    it('should create command with correct name and description', () => {
      const cmd = createSkillsCommand();
      expect(cmd.name()).toBe('skills');
      expect(cmd.description()).toContain('Skill');
    });

    it('should have list subcommand', () => {
      const cmd = createSkillsCommand();
      const sub = cmd.commands.find(c => c.name() === 'list');
      expect(sub).toBeDefined();
    });

    it('should have init subcommand', () => {
      const cmd = createSkillsCommand();
      const sub = cmd.commands.find(c => c.name() === 'init');
      expect(sub).toBeDefined();
    });

    it('should have validate subcommand', () => {
      const cmd = createSkillsCommand();
      const sub = cmd.commands.find(c => c.name() === 'validate');
      expect(sub).toBeDefined();
    });

    it('should have add subcommand', () => {
      const cmd = createSkillsCommand();
      const sub = cmd.commands.find(c => c.name() === 'add');
      expect(sub).toBeDefined();
    });
  });
});
