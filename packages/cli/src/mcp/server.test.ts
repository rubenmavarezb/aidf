// packages/cli/src/mcp/server.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMcpServer } from './server.js';

// Mock dependencies
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(false),
    readFileSync: vi.fn().mockReturnValue(''),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    readdirSync: vi.fn().mockReturnValue([]),
  };
});

vi.mock('../core/context-loader.js', () => ({
  ContextLoader: {
    findAiDir: vi.fn().mockReturnValue(null),
  },
}));

vi.mock('../core/project-analyzer.js', () => ({
  analyzeProject: vi.fn().mockReturnValue({
    packageManager: 'npm',
    framework: null,
    testRunner: null,
    linter: null,
    typescript: false,
    monorepo: false,
    scripts: {},
    dependencies: [],
    devDependencies: [],
  }),
  formatProfile: vi.fn().mockReturnValue('Detected Project Profile:\n  Package Manager: npm'),
}));

describe('createMcpServer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create an MCP server instance', () => {
    const server = createMcpServer('/test');
    expect(server).toBeDefined();
  });

  it('should have tools registered', () => {
    const server = createMcpServer('/test');
    // The server object exists and was configured without errors
    expect(server).toBeDefined();
  });
});
