import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  SkillLoader,
  parseSkillFrontmatter,
  validateSkillContent,
  generateSkillsXml,
  createSkillTemplate,
} from './skill-loader.js';
import type { LoadedSkill } from '../types/index.js';

const VALID_SKILL = `---
name: test-skill
description: A test skill for unit testing
version: 1.0.0
author: Test Author
tags: test, unit
globs: src/**
---

# Test Skill

Instructions for the test skill.
`;

const VALID_SKILL_MINIMAL = `---
name: minimal-skill
description: Minimal skill
---

# Minimal

Content here.
`;

describe('parseSkillFrontmatter', () => {
  it('should parse full frontmatter', () => {
    const metadata = parseSkillFrontmatter(VALID_SKILL);
    expect(metadata).toEqual({
      name: 'test-skill',
      description: 'A test skill for unit testing',
      version: '1.0.0',
      author: 'Test Author',
      tags: ['test', 'unit'],
      globs: ['src/**'],
    });
  });

  it('should parse minimal frontmatter', () => {
    const metadata = parseSkillFrontmatter(VALID_SKILL_MINIMAL);
    expect(metadata).toEqual({
      name: 'minimal-skill',
      description: 'Minimal skill',
      version: undefined,
      author: undefined,
      tags: undefined,
      globs: undefined,
    });
  });

  it('should return null for missing frontmatter', () => {
    const result = parseSkillFrontmatter('# No frontmatter\n\nJust content.');
    expect(result).toBeNull();
  });

  it('should return null for missing required fields', () => {
    const content = `---
version: 1.0.0
author: Someone
---

# Missing name and description
`;
    expect(parseSkillFrontmatter(content)).toBeNull();
  });

  it('should handle frontmatter with only name but no description', () => {
    const content = `---
name: only-name
---

# Content
`;
    expect(parseSkillFrontmatter(content)).toBeNull();
  });
});

describe('validateSkillContent', () => {
  it('should return no errors for valid skill', () => {
    expect(validateSkillContent(VALID_SKILL)).toEqual([]);
  });

  it('should return no errors for minimal valid skill', () => {
    expect(validateSkillContent(VALID_SKILL_MINIMAL)).toEqual([]);
  });

  it('should error on missing frontmatter', () => {
    const errors = validateSkillContent('# No frontmatter');
    expect(errors).toContain('Missing frontmatter (must start with --- and end with ---)');
  });

  it('should error on invalid frontmatter', () => {
    const content = `---
version: 1.0.0
---

# Content
`;
    const errors = validateSkillContent(content);
    expect(errors).toContain('Invalid frontmatter: missing required fields "name" and "description"');
  });

  it('should error on missing body content', () => {
    const content = `---
name: empty-body
description: Skill with no body
---
`;
    const errors = validateSkillContent(content);
    expect(errors).toContain('SKILL.md must have content after the frontmatter');
  });
});

describe('generateSkillsXml', () => {
  it('should return empty string for no skills', () => {
    expect(generateSkillsXml([])).toBe('');
  });

  it('should generate XML for a single skill', () => {
    const skills: LoadedSkill[] = [{
      name: 'test-skill',
      path: '/tmp/test/SKILL.md',
      source: 'project',
      metadata: {
        name: 'test-skill',
        description: 'A test skill',
        tags: ['test', 'unit'],
      },
      content: VALID_SKILL,
    }];

    const xml = generateSkillsXml(skills);
    expect(xml).toContain('<available_skills>');
    expect(xml).toContain('</available_skills>');
    expect(xml).toContain('<skill name="test-skill">');
    expect(xml).toContain('<description>A test skill</description>');
    expect(xml).toContain('<tags>test, unit</tags>');
    expect(xml).toContain('<instructions>');
    expect(xml).toContain('# Test Skill');
    expect(xml).toContain('</instructions>');
    expect(xml).toContain('</skill>');
  });

  it('should generate XML for multiple skills', () => {
    const skills: LoadedSkill[] = [
      {
        name: 'skill-a',
        path: '/tmp/a/SKILL.md',
        source: 'project',
        metadata: { name: 'skill-a', description: 'First' },
        content: `---\nname: skill-a\ndescription: First\n---\n\nContent A`,
      },
      {
        name: 'skill-b',
        path: '/tmp/b/SKILL.md',
        source: 'global',
        metadata: { name: 'skill-b', description: 'Second' },
        content: `---\nname: skill-b\ndescription: Second\n---\n\nContent B`,
      },
    ];

    const xml = generateSkillsXml(skills);
    expect(xml).toContain('<skill name="skill-a">');
    expect(xml).toContain('<skill name="skill-b">');
    expect(xml).toContain('Content A');
    expect(xml).toContain('Content B');
  });

  it('should escape XML special characters', () => {
    const skills: LoadedSkill[] = [{
      name: 'escape-test',
      path: '/tmp/test/SKILL.md',
      source: 'project',
      metadata: {
        name: 'test & <skill>',
        description: 'Uses "quotes" & <tags>',
      },
      content: `---\nname: test & <skill>\ndescription: Uses "quotes" & <tags>\n---\n\nBody`,
    }];

    const xml = generateSkillsXml(skills);
    expect(xml).toContain('&amp;');
    expect(xml).toContain('&lt;');
    expect(xml).toContain('&gt;');
    expect(xml).toContain('&quot;');
  });
});

describe('createSkillTemplate', () => {
  it('should create a template with the given name', () => {
    const template = createSkillTemplate('my-skill');
    expect(template).toContain('name: my-skill');
    expect(template).toContain('# my-skill');
    expect(template).toContain('description:');
    expect(template).toContain('version: 1.0.0');
  });
});

describe('SkillLoader', () => {
  let testDir: string;
  let aiDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `aidf-skill-test-${Date.now()}`);
    aiDir = join(testDir, '.ai');
    await mkdir(join(aiDir, 'skills'), { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('discoverSkills', () => {
    it('should discover skills in project .ai/skills/ directory', async () => {
      const skillDir = join(aiDir, 'skills', 'my-skill');
      await mkdir(skillDir, { recursive: true });
      await writeFile(join(skillDir, 'SKILL.md'), VALID_SKILL);

      const loader = new SkillLoader(testDir);
      const skills = await loader.discoverSkills();

      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('test-skill');
      expect(skills[0].source).toBe('project');
      expect(skills[0].metadata.description).toBe('A test skill for unit testing');
    });

    it('should return empty array when no skills directory exists', async () => {
      const emptyDir = join(tmpdir(), `aidf-empty-${Date.now()}`);
      await mkdir(emptyDir, { recursive: true });

      const loader = new SkillLoader(emptyDir);
      const skills = await loader.discoverSkills();

      expect(skills).toEqual([]);

      await rm(emptyDir, { recursive: true, force: true });
    });

    it('should skip directories without SKILL.md', async () => {
      const noSkillDir = join(aiDir, 'skills', 'no-skill');
      await mkdir(noSkillDir, { recursive: true });
      await writeFile(join(noSkillDir, 'README.md'), '# Not a skill');

      const loader = new SkillLoader(testDir);
      const skills = await loader.discoverSkills();

      expect(skills).toEqual([]);
    });

    it('should skip SKILL.md with invalid frontmatter', async () => {
      const badSkillDir = join(aiDir, 'skills', 'bad-skill');
      await mkdir(badSkillDir, { recursive: true });
      await writeFile(join(badSkillDir, 'SKILL.md'), '# No frontmatter\n\nContent');

      const loader = new SkillLoader(testDir);
      const skills = await loader.discoverSkills();

      expect(skills).toEqual([]);
    });

    it('should discover skills from extra config directories', async () => {
      const extraDir = join(tmpdir(), `aidf-extra-${Date.now()}`);
      const extraSkillDir = join(extraDir, 'extra-skill');
      await mkdir(extraSkillDir, { recursive: true });
      await writeFile(join(extraSkillDir, 'SKILL.md'), VALID_SKILL_MINIMAL);

      const loader = new SkillLoader(testDir, { directories: [extraDir] });
      const skills = await loader.discoverSkills();

      expect(skills.some(s => s.name === 'minimal-skill' && s.source === 'config')).toBe(true);

      await rm(extraDir, { recursive: true, force: true });
    });
  });

  describe('loadAll', () => {
    it('should load all skills with content', async () => {
      const skillDir = join(aiDir, 'skills', 'my-skill');
      await mkdir(skillDir, { recursive: true });
      await writeFile(join(skillDir, 'SKILL.md'), VALID_SKILL);

      const loader = new SkillLoader(testDir);
      const skills = await loader.loadAll();

      expect(skills).toHaveLength(1);
      expect(skills[0].content).toBe(VALID_SKILL);
      expect(skills[0].name).toBe('test-skill');
    });

    it('should return empty array when disabled', async () => {
      const skillDir = join(aiDir, 'skills', 'my-skill');
      await mkdir(skillDir, { recursive: true });
      await writeFile(join(skillDir, 'SKILL.md'), VALID_SKILL);

      const loader = new SkillLoader(testDir, { enabled: false });
      const skills = await loader.loadAll();

      expect(skills).toEqual([]);
    });
  });

  describe('loadByName', () => {
    it('should load a skill by name', async () => {
      const skillDir = join(aiDir, 'skills', 'my-skill');
      await mkdir(skillDir, { recursive: true });
      await writeFile(join(skillDir, 'SKILL.md'), VALID_SKILL);

      const loader = new SkillLoader(testDir);
      const skill = await loader.loadByName('test-skill');

      expect(skill).not.toBeNull();
      expect(skill!.name).toBe('test-skill');
      expect(skill!.content).toBe(VALID_SKILL);
    });

    it('should return null for non-existent skill', async () => {
      const loader = new SkillLoader(testDir);
      const skill = await loader.loadByName('nonexistent');

      expect(skill).toBeNull();
    });
  });
});
