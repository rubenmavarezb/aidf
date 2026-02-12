// packages/cli/src/utils/files.ts

import { existsSync, readdirSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, renameSync } from 'fs';
import { join, dirname, basename } from 'path';
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
        if (content.name === 'aidf' || content.name === '@aidf/cli') {
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

export interface DetectedValidation {
  pre_commit: string[];
  pre_push: string[];
  pre_pr: string[];
}

/**
 * Detect validation commands from package.json and map them
 * directly to validation phases (pre_commit, pre_push, pre_pr).
 */
export function detectValidationCommands(projectPath: string): DetectedValidation {
  const result: DetectedValidation = { pre_commit: [], pre_push: [], pre_pr: [] };
  const packageJsonPath = join(projectPath, 'package.json');

  if (!existsSync(packageJsonPath)) {
    return result;
  }

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    const scripts = packageJson.scripts || {};

    // lint, typecheck, format → pre_commit
    if (scripts.lint) result.pre_commit.push('npm run lint');
    if (scripts.typecheck) result.pre_commit.push('npm run typecheck');
    else if (scripts['type-check']) result.pre_commit.push('npm run type-check');
    if (scripts.format) result.pre_commit.push('npm run format');
    else if (scripts.prettier) result.pre_commit.push('npm run prettier');

    // test → pre_push
    if (scripts.test) result.pre_push.push('npm run test');

    // build → pre_pr
    if (scripts.build) result.pre_pr.push('npm run build');

    return result;
  } catch {
    return result;
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

const STATUS_FOLDERS = ['pending', 'completed', 'blocked'] as const;
export type TaskStatus = (typeof STATUS_FOLDERS)[number];

/**
 * Moves a task file between status folders (pending/completed/blocked).
 * If the file is not in a recognized status folder, does nothing (backward compatible).
 * Creates the target folder if it doesn't exist.
 * Returns the new path if moved, or the original path if not moved.
 */
export function moveTaskFile(taskPath: string, targetStatus: TaskStatus): string {
  const dir = dirname(taskPath);
  const currentFolder = basename(dir);
  const fileName = basename(taskPath);

  // Only move if file is currently in a recognized status folder
  if (!STATUS_FOLDERS.includes(currentFolder as TaskStatus)) {
    return taskPath;
  }

  // Already in the target folder
  if (currentFolder === targetStatus) {
    return taskPath;
  }

  // Build target path: go up from current status folder, then into target status folder
  const tasksDir = dirname(dir);
  const targetDir = join(tasksDir, targetStatus);

  // Create target folder if it doesn't exist
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  const targetPath = join(targetDir, fileName);

  renameSync(taskPath, targetPath);

  return targetPath;
}
