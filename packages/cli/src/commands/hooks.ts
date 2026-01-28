// packages/cli/src/commands/hooks.ts

import { Command } from 'commander';
import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync, chmodSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { Logger } from '../utils/logger.js';
import { ContextLoader } from '../core/context-loader.js';

type HookType = 'pre-commit' | 'commit-msg' | 'pre-push';

interface InstallOptions {
  husky?: boolean;
  preCommit?: boolean;
  force?: boolean;
  verbose?: boolean;
  logFormat?: string;
  logFile?: string;
  logRotate?: boolean;
}

export function createHooksCommand(): Command {
  const cmd = new Command('hooks')
    .description('Manage AIDF git hooks');

  cmd
    .command('install')
    .description('Install AIDF pre-commit hooks')
    .option('--husky', 'Force husky integration')
    .option('--pre-commit', 'Generate pre-commit framework config')
    .option('-f, --force', 'Overwrite existing hooks')
    .option('-v, --verbose', 'Verbose output')
    .option('--log-format <format>', 'Log format (text|json)', 'text')
    .option('--log-file <path>', 'Write logs to file')
    .option('--log-rotate', 'Enable log rotation')
    .action(async (options: InstallOptions) => {
      const logger = new Logger({
        verbose: options.verbose,
        logFormat: options.logFormat as 'text' | 'json' | undefined,
        logFile: options.logFile,
        logRotate: options.logRotate,
      });

      try {
        logger.setContext({ command: 'hooks install' });
        await runInstall(options, logger);
        await logger.close();
      } catch (error) {
        logger.error(error instanceof Error ? error.message : 'Unknown error');
        await logger.close();
        process.exit(1);
      }
    });

  cmd
    .command('uninstall')
    .description('Remove AIDF git hooks')
    .option('-v, --verbose', 'Verbose output')
    .option('--log-format <format>', 'Log format (text|json)', 'text')
    .option('--log-file <path>', 'Write logs to file')
    .option('--log-rotate', 'Enable log rotation')
    .action(async (options) => {
      const logger = new Logger({
        verbose: options.verbose,
        logFormat: options.logFormat as 'text' | 'json' | undefined,
        logFile: options.logFile,
        logRotate: options.logRotate,
      });

      try {
        logger.setContext({ command: 'hooks uninstall' });
        await runUninstall(logger);
        await logger.close();
      } catch (error) {
        logger.error(error instanceof Error ? error.message : 'Unknown error');
        await logger.close();
        process.exit(1);
      }
    });

  return cmd;
}

async function runInstall(options: InstallOptions, logger: Logger): Promise<void> {
  const projectRoot = ContextLoader.findAiDir();
  if (!projectRoot) {
    logger.error('No AIDF project found. Run `aidf init` first.');
    process.exit(1);
  }

  const useHusky = options.husky || detectHusky(projectRoot);
  const usePreCommitFramework = options.preCommit;

  if (usePreCommitFramework) {
    installPreCommitConfig(projectRoot, options.force, logger);
    return;
  }

  if (useHusky) {
    installHuskyHooks(projectRoot, options.force, logger);
  } else {
    installGitHooks(projectRoot, options.force, logger);
  }
}

async function runUninstall(logger: Logger): Promise<void> {
  const projectRoot = ContextLoader.findAiDir();
  if (!projectRoot) {
    logger.error('No AIDF project found.');
    process.exit(1);
  }

  const useHusky = detectHusky(projectRoot);

  if (useHusky) {
    uninstallHuskyHooks(projectRoot, logger);
  } else {
    uninstallGitHooks(projectRoot, logger);
  }
}

// --- Detection ---

export function detectHusky(projectRoot: string): boolean {
  const huskyDir = join(projectRoot, '.husky');
  if (existsSync(huskyDir)) return true;

  const packageJsonPath = join(projectRoot, 'package.json');
  if (existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      if (pkg.devDependencies?.husky || pkg.dependencies?.husky) return true;
      if (pkg.scripts?.prepare?.includes('husky')) return true;
    } catch {
      // Ignore parse errors
    }
  }

  return false;
}

// --- Git Hooks (direct .git/hooks) ---

function installGitHooks(projectRoot: string, force: boolean | undefined, logger: Logger): void {
  const gitHooksDir = join(projectRoot, '.git', 'hooks');

  if (!existsSync(join(projectRoot, '.git'))) {
    logger.error('No .git directory found. Initialize a git repository first.');
    process.exit(1);
  }

  if (!existsSync(gitHooksDir)) {
    mkdirSync(gitHooksDir, { recursive: true });
  }

  const hooks: HookType[] = ['pre-commit', 'commit-msg', 'pre-push'];
  let installed = 0;

  for (const hook of hooks) {
    const hookPath = join(gitHooksDir, hook);
    if (existsSync(hookPath) && !force) {
      const content = readFileSync(hookPath, 'utf-8');
      if (!content.includes('# AIDF')) {
        logger.warn(`${hook} hook already exists. Use --force to overwrite.`);
        continue;
      }
    }

    writeFileSync(hookPath, generateHookScript(hook));
    chmodSync(hookPath, '755');
    installed++;
    logger.debug(`Installed ${hook} hook`);
  }

  if (installed > 0) {
    logger.success(`Installed ${installed} git hook(s) in .git/hooks/`);
  } else {
    logger.warn('No hooks installed. Use --force to overwrite existing hooks.');
  }

  printHooksSummary(logger);
}

function uninstallGitHooks(projectRoot: string, logger: Logger): void {
  const gitHooksDir = join(projectRoot, '.git', 'hooks');
  const hooks: HookType[] = ['pre-commit', 'commit-msg', 'pre-push'];
  let removed = 0;

  for (const hook of hooks) {
    const hookPath = join(gitHooksDir, hook);
    if (existsSync(hookPath)) {
      const content = readFileSync(hookPath, 'utf-8');
      if (content.includes('# AIDF')) {
        unlinkSync(hookPath);
        removed++;
        logger.debug(`Removed ${hook} hook`);
      }
    }
  }

  if (removed > 0) {
    logger.success(`Removed ${removed} AIDF hook(s)`);
  } else {
    logger.info('No AIDF hooks found to remove.');
  }
}

// --- Husky Integration ---

function installHuskyHooks(projectRoot: string, force: boolean | undefined, logger: Logger): void {
  const huskyDir = join(projectRoot, '.husky');

  if (!existsSync(huskyDir)) {
    mkdirSync(huskyDir, { recursive: true });
    logger.debug('Created .husky directory');
  }

  const hooks: HookType[] = ['pre-commit', 'commit-msg', 'pre-push'];
  let installed = 0;

  for (const hook of hooks) {
    const hookPath = join(huskyDir, hook);
    if (existsSync(hookPath) && !force) {
      const content = readFileSync(hookPath, 'utf-8');
      if (!content.includes('# AIDF')) {
        // Append to existing hook
        const aidfBlock = `\n# AIDF - scope and format validation\n${getHuskyHookCommand(hook)}\n`;
        writeFileSync(hookPath, content.trimEnd() + '\n' + aidfBlock);
        installed++;
        logger.debug(`Appended AIDF to existing ${hook} hook`);
        continue;
      }
    }

    writeFileSync(hookPath, generateHuskyHookScript(hook));
    chmodSync(hookPath, '755');
    installed++;
    logger.debug(`Installed ${hook} husky hook`);
  }

  if (installed > 0) {
    logger.success(`Installed ${installed} husky hook(s) in .husky/`);
  } else {
    logger.warn('No hooks installed. Use --force to overwrite existing hooks.');
  }

  printHooksSummary(logger);
}

function uninstallHuskyHooks(projectRoot: string, logger: Logger): void {
  const huskyDir = join(projectRoot, '.husky');
  const hooks: HookType[] = ['pre-commit', 'commit-msg', 'pre-push'];
  let removed = 0;

  for (const hook of hooks) {
    const hookPath = join(huskyDir, hook);
    if (!existsSync(hookPath)) continue;

    const content = readFileSync(hookPath, 'utf-8');
    if (!content.includes('# AIDF')) continue;

    // If the entire file is AIDF-generated, remove it
    const lines = content.split('\n');
    const nonAidfLines = lines.filter(
      line => !line.includes('# AIDF') && !line.includes('aidf-hook-')
    );
    const hasOtherContent = nonAidfLines.some(
      line => line.trim() && !line.startsWith('#!') && !line.startsWith('#')
    );

    if (hasOtherContent) {
      // Remove only the AIDF block
      const cleaned = content.replace(/\n# AIDF[^\n]*\n[^\n]*aidf-hook-[^\n]*\n?/g, '');
      writeFileSync(hookPath, cleaned);
      logger.debug(`Removed AIDF block from ${hook}`);
    } else {
      unlinkSync(hookPath);
      logger.debug(`Removed ${hook} hook`);
    }
    removed++;
  }

  if (removed > 0) {
    logger.success(`Removed AIDF from ${removed} hook(s)`);
  } else {
    logger.info('No AIDF hooks found to remove.');
  }
}

// --- pre-commit framework (Python) ---

function installPreCommitConfig(projectRoot: string, force: boolean | undefined, logger: Logger): void {
  const configPath = join(projectRoot, '.pre-commit-config.yaml');

  if (existsSync(configPath) && !force) {
    const content = readFileSync(configPath, 'utf-8');
    if (content.includes('aidf')) {
      logger.warn('AIDF hooks already in .pre-commit-config.yaml. Use --force to overwrite.');
      return;
    }

    // Append to existing config
    const aidfRepo = generatePreCommitRepoBlock();
    writeFileSync(configPath, content.trimEnd() + '\n' + aidfRepo);
    logger.success('Added AIDF hooks to existing .pre-commit-config.yaml');
    return;
  }

  writeFileSync(configPath, generatePreCommitConfig());
  logger.success('Created .pre-commit-config.yaml with AIDF hooks');

  console.log('');
  console.log(chalk.gray('Next: run `pre-commit install` to activate the hooks'));
}

// --- Hook Script Generators ---

export function generateHookScript(hook: HookType): string {
  const header = `#!/bin/sh
# AIDF - AI-Integrated Development Framework
# Hook: ${hook}
# Installed by: aidf hooks install

`;

  switch (hook) {
    case 'pre-commit':
      return header + PRE_COMMIT_SCRIPT;
    case 'commit-msg':
      return header + COMMIT_MSG_SCRIPT;
    case 'pre-push':
      return header + PRE_PUSH_SCRIPT;
  }
}

function generateHuskyHookScript(hook: HookType): string {
  return `# AIDF - scope and format validation
${getHuskyHookCommand(hook)}
`;
}

function getHuskyHookCommand(hook: HookType): string {
  switch (hook) {
    case 'pre-commit':
      return 'npx aidf-hook-pre-commit';
    case 'commit-msg':
      return 'npx aidf-hook-commit-msg "$1"';
    case 'pre-push':
      return 'npx aidf-hook-pre-push';
  }
}

function generatePreCommitRepoBlock(): string {
  return `
  - repo: local
    hooks:
      - id: aidf-scope-check
        name: AIDF Scope Validation
        entry: npx aidf-hook-pre-commit
        language: system
        always_run: true
      - id: aidf-commit-msg
        name: AIDF Commit Message Format
        entry: npx aidf-hook-commit-msg
        language: system
        stages: [commit-msg]
`;
}

function generatePreCommitConfig(): string {
  return `# See https://pre-commit.com for more information
repos:
  - repo: local
    hooks:
      - id: aidf-scope-check
        name: AIDF Scope Validation
        entry: npx aidf-hook-pre-commit
        language: system
        always_run: true
      - id: aidf-commit-msg
        name: AIDF Commit Message Format
        entry: npx aidf-hook-commit-msg
        language: system
        stages: [commit-msg]
`;
}

// --- Inline Hook Scripts ---

const PRE_COMMIT_SCRIPT = `# Validate staged files against AIDF task scopes

AI_DIR=""
DIR="$(pwd)"
while [ "$DIR" != "/" ]; do
  if [ -d "$DIR/.ai" ] && [ -f "$DIR/.ai/AGENTS.md" ]; then
    AI_DIR="$DIR/.ai"
    break
  fi
  DIR="$(dirname "$DIR")"
done

if [ -z "$AI_DIR" ]; then
  # No AIDF project, skip validation
  exit 0
fi

# Get staged files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)

if [ -z "$STAGED_FILES" ]; then
  exit 0
fi

# Check config for scope enforcement
CONFIG_FILE="$AI_DIR/config.yml"
ENFORCEMENT="ask"
if [ -f "$CONFIG_FILE" ]; then
  ENFORCEMENT=$(grep -E "^\\s*scopeEnforcement:" "$CONFIG_FILE" | sed 's/.*: *//' | tr -d '"'"'"' || echo "ask")
  if [ -z "$ENFORCEMENT" ]; then
    ENFORCEMENT="ask"
  fi
fi

if [ "$ENFORCEMENT" = "permissive" ]; then
  exit 0
fi

# Find active tasks (non-completed .md files in tasks/)
TASKS_DIR="$AI_DIR/tasks"
VIOLATIONS=""

if [ -d "$TASKS_DIR" ]; then
  for TASK_FILE in "$TASKS_DIR"/*.md; do
    [ -f "$TASK_FILE" ] || continue

    # Skip completed tasks
    if grep -q "Status:.*COMPLETED" "$TASK_FILE" 2>/dev/null; then
      continue
    fi

    # Extract forbidden paths
    FORBIDDEN=$(sed -n '/### Forbidden/,/^##\\|^###/{/^-/p}' "$TASK_FILE" | sed 's/^- *//' | sed 's/\`//g')

    if [ -n "$FORBIDDEN" ]; then
      for FILE in $STAGED_FILES; do
        echo "$FORBIDDEN" | while IFS= read -r PATTERN; do
          [ -z "$PATTERN" ] && continue
          case "$FILE" in
            $PATTERN*) echo "VIOLATION: $FILE matches forbidden pattern '$PATTERN'" ;;
          esac
        done
      done
    fi
  done | sort -u > /tmp/aidf-violations.txt

  if [ -s /tmp/aidf-violations.txt ]; then
    echo ""
    echo "\\033[1;31mAIDF Scope Violations Detected:\\033[0m"
    echo ""
    cat /tmp/aidf-violations.txt | while IFS= read -r LINE; do
      echo "  \\033[31m✗\\033[0m $LINE"
    done
    echo ""

    if [ "$ENFORCEMENT" = "strict" ]; then
      echo "\\033[31mCommit blocked by strict scope enforcement.\\033[0m"
      rm -f /tmp/aidf-violations.txt
      exit 1
    else
      echo "\\033[33mWarning: Files outside allowed scope detected.\\033[0m"
    fi
    rm -f /tmp/aidf-violations.txt
  fi
fi

exit 0
`;

const COMMIT_MSG_SCRIPT = `# Validate commit message format
# Supports: Conventional Commits (type: description) or (type(scope): description)

COMMIT_MSG_FILE="$1"

if [ -z "$COMMIT_MSG_FILE" ]; then
  exit 0
fi

COMMIT_MSG=$(head -1 "$COMMIT_MSG_FILE")

# Allow merge commits
if echo "$COMMIT_MSG" | grep -qE "^Merge "; then
  exit 0
fi

# Allow revert commits
if echo "$COMMIT_MSG" | grep -qE "^Revert "; then
  exit 0
fi

# Validate conventional commit format
# type(scope)?: description
PATTERN="^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\\(.+\\))?: .{1,}"

if ! echo "$COMMIT_MSG" | grep -qE "$PATTERN"; then
  echo ""
  echo "\\033[1;31mAIDF Commit Message Format Error\\033[0m"
  echo ""
  echo "  Your message: $COMMIT_MSG"
  echo ""
  echo "  Expected format: type(scope?): description"
  echo ""
  echo "  Valid types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert"
  echo ""
  echo "  Examples:"
  echo "    feat: add user authentication"
  echo "    fix(api): resolve timeout issue"
  echo "    docs: update README"
  echo ""
  exit 1
fi

# Validate message length (header <= 72 chars)
MSG_LEN=$(echo "$COMMIT_MSG" | wc -c | tr -d ' ')
if [ "$MSG_LEN" -gt 73 ]; then
  echo ""
  echo "\\033[33mAIDF Warning: Commit message header exceeds 72 characters ($MSG_LEN chars)\\033[0m"
  echo ""
fi

exit 0
`;

const PRE_PUSH_SCRIPT = `# Run validation commands before push

AI_DIR=""
DIR="$(pwd)"
while [ "$DIR" != "/" ]; do
  if [ -d "$DIR/.ai" ] && [ -f "$DIR/.ai/AGENTS.md" ]; then
    AI_DIR="$DIR/.ai"
    break
  fi
  DIR="$(dirname "$DIR")"
done

if [ -z "$AI_DIR" ]; then
  exit 0
fi

CONFIG_FILE="$AI_DIR/config.yml"

if [ ! -f "$CONFIG_FILE" ]; then
  exit 0
fi

echo ""
echo "\\033[1mAIDF Pre-push Validation\\033[0m"
echo ""

FAILED=0

# Run lint if configured
LINT_CMD=$(grep -E "^\\s*lint:" "$CONFIG_FILE" | sed 's/.*: *//' | tr -d '"'"'"')
if [ -n "$LINT_CMD" ]; then
  echo "  Running lint..."
  if ! $LINT_CMD > /dev/null 2>&1; then
    echo "  \\033[31m✗\\033[0m Lint failed"
    FAILED=1
  else
    echo "  \\033[32m✓\\033[0m Lint passed"
  fi
fi

# Run typecheck if configured
TYPECHECK_CMD=$(grep -E "^\\s*typecheck:" "$CONFIG_FILE" | sed 's/.*: *//' | tr -d '"'"'"')
if [ -n "$TYPECHECK_CMD" ]; then
  echo "  Running typecheck..."
  if ! $TYPECHECK_CMD > /dev/null 2>&1; then
    echo "  \\033[31m✗\\033[0m Typecheck failed"
    FAILED=1
  else
    echo "  \\033[32m✓\\033[0m Typecheck passed"
  fi
fi

# Run tests if configured
TEST_CMD=$(grep -E "^\\s*test:" "$CONFIG_FILE" | sed 's/.*: *//' | tr -d '"'"'"')
if [ -n "$TEST_CMD" ]; then
  echo "  Running tests..."
  if ! $TEST_CMD > /dev/null 2>&1; then
    echo "  \\033[31m✗\\033[0m Tests failed"
    FAILED=1
  else
    echo "  \\033[32m✓\\033[0m Tests passed"
  fi
fi

echo ""

if [ "$FAILED" -ne 0 ]; then
  echo "\\033[31mPush blocked: validation failed.\\033[0m"
  echo "Fix the issues above and try again."
  exit 1
fi

exit 0
`;

// --- UI Helpers ---

function printHooksSummary(logger: Logger): void {
  console.log('');
  logger.box('Installed Hooks', [
    `${chalk.green('✓')} pre-commit  - Validates staged files against task scopes`,
    `${chalk.green('✓')} commit-msg  - Validates conventional commit format`,
    `${chalk.green('✓')} pre-push    - Runs lint, typecheck, and tests`,
  ].join('\n'));
}
