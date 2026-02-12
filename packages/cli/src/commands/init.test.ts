import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  appendFileSync: vi.fn(),
  renameSync: vi.fn(),
}));

vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}));

vi.mock('chalk', () => ({
  default: {
    bold: vi.fn((s: string) => s),
    gray: vi.fn((s: string) => s),
    yellow: vi.fn((s: string) => s),
    green: vi.fn((s: string) => s),
  },
}));

vi.mock('yaml', () => ({
  default: {
    stringify: vi.fn((obj: unknown) => JSON.stringify(obj)),
  },
}));

vi.mock('../utils/logger.js', () => ({
  Logger: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    success: vi.fn(),
    startSpinner: vi.fn(),
    updateSpinner: vi.fn(),
    stopSpinner: vi.fn(),
    box: vi.fn(),
    setContext: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../utils/files.js', () => ({
  copyDir: vi.fn(),
  findTemplatesDir: vi.fn(() => '/mock/templates/.ai'),
  detectValidationCommands: vi.fn(() => ({ pre_commit: [], pre_push: [], pre_pr: [] })),
  getProjectName: vi.fn(() => 'test-project'),
}));

import { existsSync, readFileSync, writeFileSync, renameSync } from 'fs';
import { createInitCommand } from './init.js';

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockWriteFileSync = vi.mocked(writeFileSync);
const mockRenameSync = vi.mocked(renameSync);

describe('createInitCommand', () => {
  it('should create command with correct name', () => {
    const cmd = createInitCommand();
    expect(cmd.name()).toBe('init');
  });

  it('should have description', () => {
    const cmd = createInitCommand();
    expect(cmd.description()).toContain('Initialize');
  });

  it('should have --yes option', () => {
    const cmd = createInitCommand();
    const yesOption = cmd.options.find(opt => opt.long === '--yes');
    expect(yesOption).toBeDefined();
  });

  it('should have --force option', () => {
    const cmd = createInitCommand();
    const forceOption = cmd.options.find(opt => opt.long === '--force');
    expect(forceOption).toBeDefined();
  });

  it('should have --verbose option', () => {
    const cmd = createInitCommand();
    const verboseOption = cmd.options.find(opt => opt.long === '--verbose');
    expect(verboseOption).toBeDefined();
  });
});

describe('init --yes (default mode)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: .ai dir does not exist, template file exists, agents file exists, .gitignore does not exist
    mockExistsSync.mockImplementation((p: unknown) => {
      const path = String(p);
      if (path.endsWith('.ai')) return false;
      if (path.endsWith('AGENTS.template.md')) return true;
      if (path.endsWith('AGENTS.md')) return true;
      if (path.endsWith('.gitignore')) return false;
      if (path.endsWith('tasks')) return true;
      if (path.endsWith('plans')) return true;
      return false;
    });
    // AGENTS.md content with placeholders
    mockReadFileSync.mockImplementation((p: unknown) => {
      const path = String(p);
      if (path.endsWith('AGENTS.md')) {
        return '# AGENTS.md\n\n## AIDF Framework\n\nThis project uses **AIDF v1.0**\n\n### Context Layers\n\n| Layer | Source | Purpose |\n\n### Navigation Guide\n\n---\n\n## Identity\nThis project is [PROJECT_NAME], a [TYPE: web app | mobile app | API | library | CLI tool] that [PRIMARY_PURPOSE].';
      }
      if (path.endsWith('.gitignore')) {
        return '';
      }
      return '';
    });
    // Suppress console.log output during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('should generate config.yml with AIDF header comments', async () => {
    const cmd = createInitCommand();
    await cmd.parseAsync(['init', '--yes'], { from: 'user' });

    const configWriteCall = mockWriteFileSync.mock.calls.find(
      (call) => String(call[0]).endsWith('config.yml')
    );

    expect(configWriteCall).toBeDefined();
    const content = String(configWriteCall![1]);
    expect(content).toContain('# AIDF (AI Development Framework) Configuration');
    expect(content).toContain('# Framework docs: https://rubenmavarezb.github.io/aidf/docs/concepts/');
    expect(content).toContain('#   Layer 1: AGENTS.md (global project context)');
    expect(content).toContain('#   Layer 2: roles/*.md (specialized role definitions)');
    expect(content).toContain('#   Layer 3: skills/*.md (portable skill definitions)');
    expect(content).toContain('#   Layer 4: tasks/*.md (scoped task specifications)');
    expect(content).toContain('#   Layer 5: plans/*.md (multi-task initiatives)');
  });

  it('should generate config.yml with framework: aidf field', async () => {
    const cmd = createInitCommand();
    await cmd.parseAsync(['init', '--yes'], { from: 'user' });

    const configWriteCall = mockWriteFileSync.mock.calls.find(
      (call) => String(call[0]).endsWith('config.yml')
    );

    expect(configWriteCall).toBeDefined();
    const content = String(configWriteCall![1]);
    expect(content).toContain('"framework":"aidf"');
  });

  it('should generate config.yml with environment variable examples in comments', async () => {
    const cmd = createInitCommand();
    await cmd.parseAsync(['init', '--yes'], { from: 'user' });

    const configWriteCall = mockWriteFileSync.mock.calls.find(
      (call) => String(call[0]).endsWith('config.yml')
    );

    expect(configWriteCall).toBeDefined();
    const content = String(configWriteCall![1]);
    expect(content).toContain('# For sensitive values, use environment variables:');
    expect(content).toContain('${ANTHROPIC_API_KEY}');
    expect(content).toContain('${AIDF_SLACK_WEBHOOK}');
  });

  it('should rename AGENTS.template.md to AGENTS.md', async () => {
    const cmd = createInitCommand();
    await cmd.parseAsync(['init', '--yes'], { from: 'user' });

    expect(mockRenameSync).toHaveBeenCalledWith(
      expect.stringContaining('AGENTS.template.md'),
      expect.stringContaining('AGENTS.md')
    );
  });

  it('should replace placeholders in AGENTS.md', async () => {
    const cmd = createInitCommand();
    await cmd.parseAsync(['init', '--yes'], { from: 'user' });

    const agentsWriteCall = mockWriteFileSync.mock.calls.find(
      (call) => String(call[0]).endsWith('AGENTS.md')
    );

    expect(agentsWriteCall).toBeDefined();
    const content = String(agentsWriteCall![1]);
    expect(content).toContain('test-project');
    expect(content).not.toContain('[PROJECT_NAME]');
  });

  it('should preserve AIDF Framework section in AGENTS.md', async () => {
    const cmd = createInitCommand();
    await cmd.parseAsync(['init', '--yes'], { from: 'user' });

    const agentsWriteCall = mockWriteFileSync.mock.calls.find(
      (call) => String(call[0]).endsWith('AGENTS.md')
    );

    expect(agentsWriteCall).toBeDefined();
    const content = String(agentsWriteCall![1]);
    expect(content).toContain('## AIDF Framework');
    expect(content).toContain('AIDF v1.0');
    expect(content).toContain('### Context Layers');
    expect(content).toContain('### Navigation Guide');
  });

  it('should print README.md in the files created list', async () => {
    const consoleSpy = vi.mocked(console.log);
    const cmd = createInitCommand();
    await cmd.parseAsync(['init', '--yes'], { from: 'user' });

    const readmeLog = consoleSpy.mock.calls.find(
      (call) => String(call[0]).includes('README.md')
    );
    expect(readmeLog).toBeDefined();
  });
});
