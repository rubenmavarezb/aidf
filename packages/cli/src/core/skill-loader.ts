// packages/cli/src/core/skill-loader.ts

import { readFile, readdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { SkillMetadata, SkillInfo, LoadedSkill, SkillsConfig, SecurityWarning } from '../types/index.js';
import { Logger } from '../utils/logger.js';

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

/**
 * Strips fenced code blocks from content for pattern matching.
 * Returns content with code blocks replaced by empty lines to preserve line numbers.
 */
function stripCodeBlocks(content: string): string {
  return content.replace(/```[\s\S]*?```/g, (match) => {
    // Replace with same number of newlines to preserve line numbering
    const lineCount = match.split('\n').length - 1;
    return '\n'.repeat(lineCount);
  });
}

interface SecurityPattern {
  regex: RegExp;
  level: 'warning' | 'danger';
  pattern: string;
  description: string;
  /** If true, check against content with code blocks stripped */
  stripCode?: boolean;
}

const SECURITY_PATTERNS: SecurityPattern[] = [
  // === Danger patterns (potentially malicious) ===
  {
    regex: /ignore\s+(previous|above|all\s+previous)\s+instructions/i,
    level: 'danger',
    pattern: 'ignore previous instructions',
    description: 'Prompt injection attempt: tries to override previous instructions',
  },
  {
    regex: /\bdisregard\b.*\b(instructions|rules|above|previous)\b/i,
    level: 'danger',
    pattern: 'disregard instructions',
    description: 'Prompt injection attempt: tries to disregard existing instructions',
  },
  {
    regex: /\byou\s+are\s+now\b/i,
    level: 'danger',
    pattern: 'you are now',
    description: 'Role override attempt: tries to change AI identity mid-prompt',
  },
  {
    regex: /^\s*system\s*:/im,
    level: 'danger',
    pattern: 'system:',
    description: 'System prompt injection: attempts to inject system-level instructions',
  },
  {
    regex: /<system>/i,
    level: 'danger',
    pattern: '<system>',
    description: 'System prompt injection: attempts to inject system-level XML block',
  },
  {
    regex: /\beval\s*\(/,
    level: 'danger',
    pattern: 'eval(',
    description: 'Code execution: eval() in instructions (outside code blocks)',
    stripCode: true,
  },
  {
    regex: /\bexec\s*\(/,
    level: 'danger',
    pattern: 'exec(',
    description: 'Code execution: exec() in instructions (outside code blocks)',
    stripCode: true,
  },
  {
    regex: /\bFunction\s*\(/,
    level: 'danger',
    pattern: 'Function(',
    description: 'Code execution: Function constructor in instructions (outside code blocks)',
    stripCode: true,
  },
  {
    regex: /[A-Za-z0-9+/]{60,}={0,2}/,
    level: 'danger',
    pattern: 'base64 encoded content',
    description: 'Encoded content: possible base64-encoded payload detected',
    stripCode: true,
  },
  {
    regex: /(?:0x[0-9a-fA-F]{2}[\s,]*){20,}/,
    level: 'danger',
    pattern: 'hex string',
    description: 'Encoded content: long hex string detected, possible obfuscated payload',
    stripCode: true,
  },

  // === Warning patterns (suspicious but may be legitimate) ===
  {
    regex: /\bsudo\b/i,
    level: 'warning',
    pattern: 'sudo',
    description: 'Elevated privileges: sudo command found in instructions',
    stripCode: true,
  },
  {
    regex: /\bchmod\b/i,
    level: 'warning',
    pattern: 'chmod',
    description: 'Permission change: chmod command found in instructions',
    stripCode: true,
  },
  {
    regex: /\bchown\b/i,
    level: 'warning',
    pattern: 'chown',
    description: 'Ownership change: chown command found in instructions',
    stripCode: true,
  },
  {
    regex: /https?:\/\/[^\s)>\]]+/i,
    level: 'warning',
    pattern: 'external URL',
    description: 'External URL: link to external domain found in instructions',
    stripCode: true,
  },
  {
    regex: /(?:^|\s)\.env\b|\/etc\/|~\/\.ssh/,
    level: 'warning',
    pattern: 'sensitive file path',
    description: 'Sensitive path: instructions reference sensitive files (.env, /etc/, ~/.ssh)',
    stripCode: true,
  },
  {
    regex: /--dangerously/,
    level: 'warning',
    pattern: '--dangerously flag',
    description: 'Dangerous flag: --dangerously flag found in instructions',
    stripCode: true,
  },
  {
    regex: /\brm\s+-rf\b/,
    level: 'warning',
    pattern: 'rm -rf',
    description: 'Destructive command: rm -rf found in instructions',
    stripCode: true,
  },
];

/**
 * Validates a SKILL.md content string for security concerns.
 * Returns an array of security warnings (empty = no concerns).
 */
export function validateSkillSecurity(content: string): SecurityWarning[] {
  const warnings: SecurityWarning[] = [];
  const lines = content.split('\n');
  const strippedContent = stripCodeBlocks(content);
  const strippedLines = strippedContent.split('\n');

  for (const pattern of SECURITY_PATTERNS) {
    const searchLines = pattern.stripCode ? strippedLines : lines;

    for (let i = 0; i < searchLines.length; i++) {
      const line = searchLines[i];
      if (pattern.regex.test(line)) {
        warnings.push({
          level: pattern.level,
          pattern: pattern.pattern,
          description: pattern.description,
          line: i + 1,
        });
        // Only report each pattern once (first occurrence)
        break;
      }
    }
  }

  return warnings;
}

export class SkillLoader {
  private projectRoot: string;
  private config: SkillsConfig;
  private logger: Logger;

  constructor(projectRoot: string, config?: SkillsConfig) {
    this.projectRoot = projectRoot;
    this.config = config ?? {};
    this.logger = new Logger({});
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
   * Runs security validation on each skill and stores warnings.
   * If block_suspicious is true, skills with danger-level warnings are excluded.
   */
  async loadAll(): Promise<LoadedSkill[]> {
    if (this.config.enabled === false) return [];

    const infos = await this.discoverSkills();
    const loaded: LoadedSkill[] = [];

    for (const info of infos) {
      const content = await readFile(info.path, 'utf-8');
      const warnings = validateSkillSecurity(content);
      const skill: LoadedSkill = { ...info, content, warnings: warnings.length > 0 ? warnings : undefined };

      if (warnings.length > 0) {
        const dangerWarnings = warnings.filter(w => w.level === 'danger');
        const warnWarnings = warnings.filter(w => w.level === 'warning');
        const blockSuspicious = this.config.block_suspicious !== false;

        if (dangerWarnings.length > 0) {
          this.logger.warn(`Skill "${info.name}" has ${dangerWarnings.length} security concern(s):`);
          for (const w of dangerWarnings) {
            this.logger.warn(`  [DANGER] ${w.description}${w.line ? ` (line ${w.line})` : ''}`);
          }

          if (blockSuspicious) {
            this.logger.warn(`  Skill "${info.name}" blocked (block_suspicious is enabled)`);
            continue;
          }
        }

        if (warnWarnings.length > 0) {
          this.logger.warn(`Skill "${info.name}" has ${warnWarnings.length} warning(s):`);
          for (const w of warnWarnings) {
            this.logger.warn(`  [WARNING] ${w.description}${w.line ? ` (line ${w.line})` : ''}`);
          }
        }
      }

      loaded.push(skill);
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
