// packages/cli/src/core/project-analyzer.ts

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export interface ProjectProfile {
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun' | null;
  framework: FrameworkInfo | null;
  testRunner: TestRunnerInfo | null;
  linter: LinterInfo | null;
  typescript: boolean;
  monorepo: boolean;
  scripts: Record<string, string>;
  dependencies: string[];
  devDependencies: string[];
}

export interface FrameworkInfo {
  name: string;
  version?: string;
}

export interface TestRunnerInfo {
  name: string;
  version?: string;
}

export interface LinterInfo {
  name: string;
  version?: string;
}

const FRAMEWORK_DETECTORS: { pkg: string; name: string }[] = [
  { pkg: 'next', name: 'Next.js' },
  { pkg: 'nuxt', name: 'Nuxt' },
  { pkg: '@remix-run/react', name: 'Remix' },
  { pkg: '@angular/core', name: 'Angular' },
  { pkg: 'vue', name: 'Vue' },
  { pkg: 'svelte', name: 'Svelte' },
  { pkg: 'astro', name: 'Astro' },
  { pkg: 'react', name: 'React' },
  { pkg: 'express', name: 'Express' },
  { pkg: 'fastify', name: 'Fastify' },
  { pkg: 'koa', name: 'Koa' },
  { pkg: 'hono', name: 'Hono' },
  { pkg: 'nestjs', name: 'NestJS' },
  { pkg: '@nestjs/core', name: 'NestJS' },
  { pkg: 'electron', name: 'Electron' },
  { pkg: 'react-native', name: 'React Native' },
  { pkg: 'expo', name: 'Expo' },
];

const TEST_RUNNER_DETECTORS: { pkg: string; name: string }[] = [
  { pkg: 'vitest', name: 'Vitest' },
  { pkg: 'jest', name: 'Jest' },
  { pkg: 'mocha', name: 'Mocha' },
  { pkg: '@playwright/test', name: 'Playwright' },
  { pkg: 'cypress', name: 'Cypress' },
  { pkg: 'ava', name: 'AVA' },
  { pkg: 'tap', name: 'tap' },
];

const LINTER_DETECTORS: { pkg: string; name: string }[] = [
  { pkg: 'eslint', name: 'ESLint' },
  { pkg: '@biomejs/biome', name: 'Biome' },
  { pkg: 'biome', name: 'Biome' },
  { pkg: 'oxlint', name: 'oxlint' },
  { pkg: 'tslint', name: 'TSLint' },
];

/**
 * Analyzes a project directory and returns a ProjectProfile.
 */
export function analyzeProject(projectPath: string): ProjectProfile {
  const packageJson = readPackageJson(projectPath);
  const deps: Record<string, string> = packageJson?.dependencies ?? {};
  const devDeps: Record<string, string> = packageJson?.devDependencies ?? {};
  const allDeps: Record<string, string> = { ...deps, ...devDeps };
  const depNames = Object.keys(allDeps);

  return {
    packageManager: detectPackageManager(projectPath),
    framework: detectFramework(depNames, allDeps),
    testRunner: detectTestRunner(depNames, allDeps),
    linter: detectLinter(depNames, allDeps),
    typescript: detectTypeScript(projectPath, depNames),
    monorepo: detectMonorepo(projectPath, packageJson),
    scripts: packageJson?.scripts ?? {},
    dependencies: Object.keys(deps),
    devDependencies: Object.keys(devDeps),
  };
}

interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  workspaces?: string[] | { packages: string[] };
}

function readPackageJson(projectPath: string): PackageJson | null {
  const pkgPath = join(projectPath, 'package.json');
  if (!existsSync(pkgPath)) return null;
  try {
    return JSON.parse(readFileSync(pkgPath, 'utf-8')) as PackageJson;
  } catch {
    return null;
  }
}

function detectPackageManager(projectPath: string): ProjectProfile['packageManager'] {
  if (existsSync(join(projectPath, 'bun.lockb')) || existsSync(join(projectPath, 'bun.lock'))) return 'bun';
  if (existsSync(join(projectPath, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(projectPath, 'yarn.lock'))) return 'yarn';
  if (existsSync(join(projectPath, 'package-lock.json'))) return 'npm';
  if (existsSync(join(projectPath, 'package.json'))) return 'npm';
  return null;
}

function detectFramework(
  depNames: string[],
  allDeps: Record<string, string>,
): FrameworkInfo | null {
  for (const detector of FRAMEWORK_DETECTORS) {
    if (depNames.includes(detector.pkg)) {
      return {
        name: detector.name,
        version: allDeps[detector.pkg]?.replace(/[\^~>=<]/g, ''),
      };
    }
  }
  return null;
}

function detectTestRunner(
  depNames: string[],
  allDeps: Record<string, string>,
): TestRunnerInfo | null {
  for (const detector of TEST_RUNNER_DETECTORS) {
    if (depNames.includes(detector.pkg)) {
      return {
        name: detector.name,
        version: allDeps[detector.pkg]?.replace(/[\^~>=<]/g, ''),
      };
    }
  }
  return null;
}

function detectLinter(
  depNames: string[],
  allDeps: Record<string, string>,
): LinterInfo | null {
  for (const detector of LINTER_DETECTORS) {
    if (depNames.includes(detector.pkg)) {
      return {
        name: detector.name,
        version: allDeps[detector.pkg]?.replace(/[\^~>=<]/g, ''),
      };
    }
  }
  return null;
}

function detectTypeScript(projectPath: string, depNames: string[]): boolean {
  if (existsSync(join(projectPath, 'tsconfig.json'))) return true;
  if (depNames.includes('typescript')) return true;
  return false;
}

function detectMonorepo(
  projectPath: string,
  packageJson: PackageJson | null,
): boolean {
  // Check for workspaces in package.json
  if (packageJson?.workspaces) return true;
  // Check for pnpm-workspace.yaml
  if (existsSync(join(projectPath, 'pnpm-workspace.yaml'))) return true;
  // Check for lerna.json
  if (existsSync(join(projectPath, 'lerna.json'))) return true;
  // Check for nx.json
  if (existsSync(join(projectPath, 'nx.json'))) return true;
  // Check for turbo.json
  if (existsSync(join(projectPath, 'turbo.json'))) return true;
  return false;
}

/**
 * Formats a ProjectProfile as a human-readable summary.
 */
export function formatProfile(profile: ProjectProfile): string {
  const lines: string[] = [];

  lines.push('Detected Project Profile:');
  lines.push('');

  if (profile.packageManager) {
    lines.push(`  Package Manager: ${profile.packageManager}`);
  }
  if (profile.framework) {
    lines.push(`  Framework:       ${profile.framework.name}${profile.framework.version ? ` v${profile.framework.version}` : ''}`);
  }
  if (profile.testRunner) {
    lines.push(`  Test Runner:     ${profile.testRunner.name}${profile.testRunner.version ? ` v${profile.testRunner.version}` : ''}`);
  }
  if (profile.linter) {
    lines.push(`  Linter:          ${profile.linter.name}${profile.linter.version ? ` v${profile.linter.version}` : ''}`);
  }
  lines.push(`  TypeScript:      ${profile.typescript ? 'Yes' : 'No'}`);
  lines.push(`  Monorepo:        ${profile.monorepo ? 'Yes' : 'No'}`);

  if (Object.keys(profile.scripts).length > 0) {
    lines.push('');
    lines.push('  Scripts:');
    for (const [name, cmd] of Object.entries(profile.scripts)) {
      lines.push(`    ${name}: ${cmd}`);
    }
  }

  return lines.join('\n');
}
