// packages/cli/src/core/skill-loader.ts

import { readFile, readdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { SkillMetadata, SkillInfo, LoadedSkill, SkillsConfig } from '../types/index.js';

/**
 * Parses the YAML-like frontmatter from a SKILL.md file.
 * Supports: name, description, version, author, tags (comma-separated), globs (comma-separated)
 */
export function parseSkillFrontmatter(content: string): SkillMetadata | null {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) return null;

  const frontmatter = frontmatterMatch[1];
  const metadata: Record<string, string> = {};

  for (const line of frontmatter.split('\n')) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;
    const key = line.slice(0, colonIndex).trim();
    const value = line.slice(colonIndex + 1).trim();
    if (key && value) {
      metadata[key] = value;
    }
  }

  if (!metadata.name || !metadata.description) {
    return null;
  }

  return {
    name: metadata.name,
    description: metadata.description,
    version: metadata.version,
    author: metadata.author,
    tags: metadata.tags ? metadata.tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
    globs: metadata.globs ? metadata.globs.split(',').map(g => g.trim()).filter(Boolean) : undefined,
  };
}

/**
 * Validates a SKILL.md content string.
 * Returns an array of validation errors (empty = valid).
 */
export function validateSkillContent(content: string): string[] {
  const errors: string[] = [];

  // Must have frontmatter
  if (!content.match(/^---\n[\s\S]*?\n---/)) {
    errors.push('Missing frontmatter (must start with --- and end with ---)');
    return errors;
  }

  const metadata = parseSkillFrontmatter(content);
  if (!metadata) {
    errors.push('Invalid frontmatter: missing required fields "name" and "description"');
    return errors;
  }

  if (!metadata.name.trim()) {
    errors.push('Skill name cannot be empty');
  }

  if (!metadata.description.trim()) {
    errors.push('Skill description cannot be empty');
  }

  // Must have content after frontmatter
  const bodyMatch = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)/);
  if (!bodyMatch || !bodyMatch[1].trim()) {
    errors.push('SKILL.md must have content after the frontmatter');
  }

  return errors;
}

/**
 * Generates XML for prompt injection following the agentskills.io format.
 */
export function generateSkillsXml(skills: LoadedSkill[]): string {
  if (skills.length === 0) return '';

  let xml = '<available_skills>\n';

  for (const skill of skills) {
    xml += `<skill name="${escapeXml(skill.metadata.name)}">\n`;
    xml += `<description>${escapeXml(skill.metadata.description)}</description>\n`;
    if (skill.metadata.tags && skill.metadata.tags.length > 0) {
      xml += `<tags>${escapeXml(skill.metadata.tags.join(', '))}</tags>\n`;
    }

    // Extract body content (after frontmatter)
    const bodyMatch = skill.content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)/);
    const body = bodyMatch ? bodyMatch[1].trim() : skill.content;
    xml += `<instructions>\n${body}\n</instructions>\n`;

    xml += `</skill>\n`;
  }

  xml += '</available_skills>';
  return xml;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export class SkillLoader {
  private projectRoot: string;
  private config: SkillsConfig;

  constructor(projectRoot: string, config?: SkillsConfig) {
    this.projectRoot = projectRoot;
    this.config = config ?? {};
  }

  /**
   * Discovers all available skills from all directories.
   */
  async discoverSkills(): Promise<SkillInfo[]> {
    const skills: SkillInfo[] = [];

    // 1. Project-level skills: .ai/skills/
    const projectSkillsDir = join(this.projectRoot, '.ai', 'skills');
    const projectSkills = await this.scanDirectory(projectSkillsDir, 'project');
    skills.push(...projectSkills);

    // 2. Global skills: ~/.aidf/skills/
    const globalSkillsDir = join(homedir(), '.aidf', 'skills');
    const globalSkills = await this.scanDirectory(globalSkillsDir, 'global');
    skills.push(...globalSkills);

    // 3. Extra directories from config
    if (this.config.directories) {
      for (const dir of this.config.directories) {
        const extraSkills = await this.scanDirectory(dir, 'config');
        skills.push(...extraSkills);
      }
    }

    return skills;
  }

  /**
   * Loads all discovered skills (reads their content).
   */
  async loadAll(): Promise<LoadedSkill[]> {
    if (this.config.enabled === false) return [];

    const infos = await this.discoverSkills();
    const loaded: LoadedSkill[] = [];

    for (const info of infos) {
      const content = await readFile(info.path, 'utf-8');
      loaded.push({ ...info, content });
    }

    return loaded;
  }

  /**
   * Loads a single skill by name.
   */
  async loadByName(name: string): Promise<LoadedSkill | null> {
    const infos = await this.discoverSkills();
    const info = infos.find(s => s.name === name);
    if (!info) return null;

    const content = await readFile(info.path, 'utf-8');
    return { ...info, content };
  }

  /**
   * Scans a directory for SKILL.md files.
   * Expects structure: dir/<skill-name>/SKILL.md
   */
  private async scanDirectory(dir: string, source: SkillInfo['source']): Promise<SkillInfo[]> {
    if (!existsSync(dir)) return [];

    const skills: SkillInfo[] = [];

    try {
      const entries = await readdir(dir);

      for (const entry of entries) {
        const entryPath = join(dir, entry);
        const entryStat = await stat(entryPath);

        if (entryStat.isDirectory()) {
          // Look for SKILL.md inside subdirectory
          const skillPath = join(entryPath, 'SKILL.md');
          if (existsSync(skillPath)) {
            const content = await readFile(skillPath, 'utf-8');
            const metadata = parseSkillFrontmatter(content);
            if (metadata) {
              skills.push({
                name: metadata.name,
                path: skillPath,
                source,
                metadata,
              });
            }
          }
        }
      }
    } catch {
      // Directory might not be readable
    }

    return skills;
  }
}

/**
 * Creates a SKILL.md template string for skill initialization.
 */
export function createSkillTemplate(name: string): string {
  return `---
name: ${name}
description: A brief description of what this skill does
version: 1.0.0
author:
tags:
globs:
---

# ${name}

## Instructions

Describe the skill's behavior, expertise, and constraints here.

## When to Use

Describe when this skill should be activated.

## Behavior Rules

### ALWAYS
-

### NEVER
-
`;
}
