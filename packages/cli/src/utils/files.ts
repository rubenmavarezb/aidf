// packages/cli/src/utils/files.ts

import { existsSync, readdirSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * Recursively copies a directory from src to dest
 */
export function copyDir(src: string, dest: string): void {
  // Create destination directory if it doesn't exist
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
  }

  const entries = readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Finds the root of the AIDF package (where templates are located)
 * Works both in development (src/) and production (dist/)
 */
export function findPackageRoot(): string {
  // Get the directory of this file
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  // Walk up to find the package root (where package.json is)
  let currentDir = __dirname;

  for (let i = 0; i < 10; i++) {
    const packageJson = join(currentDir, 'package.json');
    if (existsSync(packageJson)) {
      // Read package.json to verify it's the CLI package
      try {
        const content = JSON.parse(readFileSync(packageJson, 'utf-8'));
        if (content.name === '@aidf/cli') {
          return currentDir;
        }
      } catch {
        // Continue searching
      }
    }
    const parent = dirname(currentDir);
    if (parent === currentDir) break;
    currentDir = parent;
  }

  throw new Error('Could not find AIDF package root');
}

/**
 * Finds the templates directory
 */
export function findTemplatesDir(): string {
  const packageRoot = findPackageRoot();

  // Check for templates in the monorepo root (../../templates from packages/cli)
  const monorepoTemplates = join(packageRoot, '..', '..', 'templates', '.ai');
  if (existsSync(monorepoTemplates)) {
    return monorepoTemplates;
  }

  // Check for bundled templates in the package
  const bundledTemplates = join(packageRoot, 'templates', '.ai');
  if (existsSync(bundledTemplates)) {
    return bundledTemplates;
  }

  throw new Error('Could not find templates directory');
}

/**
 * Process template placeholders in a file
 * Replaces [KEY] with corresponding values
 */
export function processTemplate(
  filePath: string,
  replacements: Record<string, string>
): void {
  let content = readFileSync(filePath, 'utf-8');

  for (const [key, value] of Object.entries(replacements)) {
    // Replace [KEY] patterns
    const pattern = new RegExp(`\\[${key}\\]`, 'g');
    content = content.replace(pattern, value);
  }

  writeFileSync(filePath, content);
}

/**
 * Detect validation commands from package.json
 */
export interface DetectedCommands {
  lint?: string;
  test?: string;
  build?: string;
  typecheck?: string;
  format?: string;
}

export function detectValidationCommands(projectPath: string): DetectedCommands {
  const packageJsonPath = join(projectPath, 'package.json');
  const commands: DetectedCommands = {};

  if (!existsSync(packageJsonPath)) {
    return commands;
  }

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    const scripts = packageJson.scripts || {};

    // Detect common script names
    if (scripts.lint) commands.lint = 'npm run lint';
    if (scripts.test) commands.test = 'npm run test';
    if (scripts.build) commands.build = 'npm run build';
    if (scripts.typecheck) commands.typecheck = 'npm run typecheck';
    if (scripts['type-check']) commands.typecheck = 'npm run type-check';
    if (scripts.format) commands.format = 'npm run format';
    if (scripts.prettier) commands.format = 'npm run prettier';

    return commands;
  } catch {
    return commands;
  }
}

/**
 * Read project name from package.json
 */
export function getProjectName(projectPath: string): string | null {
  const packageJsonPath = join(projectPath, 'package.json');

  if (!existsSync(packageJsonPath)) {
    return null;
  }

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    return packageJson.name || null;
  } catch {
    return null;
  }
}
