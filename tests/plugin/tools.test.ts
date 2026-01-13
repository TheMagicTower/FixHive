import { describe, it, expect, vi } from 'vitest';

// Create mock schema builder
const createMockSchema = () => ({
  string: () => ({
    describe: () => ({}),
    optional: () => ({ describe: () => ({}) }),
  }),
  number: () => ({
    describe: () => ({}),
    optional: () => ({ describe: () => ({}) }),
  }),
  boolean: () => ({
    describe: () => ({}),
    optional: () => ({ describe: () => ({}) }),
  }),
  object: () => ({
    describe: () => ({}),
    optional: () => ({ describe: () => ({}) }),
  }),
  array: () => ({
    describe: () => ({}),
    optional: () => ({ describe: () => ({}) }),
  }),
  enum: () => ({
    describe: () => ({}),
  }),
});

// Mock @opencode-ai/plugin before any imports
vi.mock('@opencode-ai/plugin', () => {
  const mockTool = vi.fn((config) => ({
    description: config.description,
    args: config.args,
    execute: config.execute,
  }));
  mockTool.schema = createMockSchema();
  return { tool: mockTool };
});

// Mock shared package
vi.mock('@the-magic-tower/fixhive-shared', () => ({
  hashSignature: vi.fn((sig) => `hash-${sig}`),
  filterSensitiveData: vi.fn((data) => ({
    filtered: data,
    containsSensitive: false,
    redactedCount: 0,
    redactedTypes: [],
  })),
  sanitizeStackTrace: vi.fn((trace) => trace),
  NORMALIZATION_GUIDE: 'Mock normalization guide',
}));

describe('FixHive Plugin Tools', () => {
  it('should be importable after mocking dependencies', async () => {
    // Import after mocking
    const { createTools, createOfflineTools } = await import('../../src/plugin/tools.js');

    expect(createTools).toBeDefined();
    expect(createOfflineTools).toBeDefined();
  });

  it('should create tools with correct structure', async () => {
    const { createTools } = await import('../../src/plugin/tools.js');

    const mockClient = {
      searchCases: vi.fn().mockResolvedValue({ group: null, variants: [] }),
      reportResolution: vi.fn().mockResolvedValue({ success: true }),
      vote: vi.fn().mockResolvedValue({ success: true }),
    };

    const mockContext = {
      sessionId: 'test',
      projectDirectory: '/test',
      language: 'typescript',
      framework: 'react',
      packages: {},
    };

    const tools = createTools(mockClient as any, mockContext);

    expect(tools).toHaveProperty('fixhive_search_cases');
    expect(tools).toHaveProperty('fixhive_report_resolution');
    expect(tools).toHaveProperty('fixhive_vote');
    expect(Object.keys(tools)).toHaveLength(3);
  });

  it('should create offline tools', async () => {
    const { createOfflineTools } = await import('../../src/plugin/tools.js');

    const mockContext = {
      sessionId: 'test',
      projectDirectory: '/test',
    };

    const tools = createOfflineTools(mockContext);

    expect(tools).toHaveProperty('fixhive_search_cases');
    expect(Object.keys(tools)).toHaveLength(1);
  });

  it('should execute search_cases and return not found', async () => {
    const { createTools } = await import('../../src/plugin/tools.js');

    const mockClient = {
      searchCases: vi.fn().mockResolvedValue({ group: null, variants: [] }),
      reportResolution: vi.fn(),
      vote: vi.fn(),
    };

    const mockContext = {
      sessionId: 'test',
      projectDirectory: '/test',
    };

    const tools = createTools(mockClient as any, mockContext);
    const result = await tools.fixhive_search_cases.execute(
      { error_message: 'Test error' },
      { sessionID: 'test' }
    );

    const parsed = JSON.parse(result);
    expect(parsed.found).toBe(false);
    expect(mockClient.searchCases).toHaveBeenCalled();
  });

  it('should execute vote and require reason for report', async () => {
    const { createTools } = await import('../../src/plugin/tools.js');

    const mockClient = {
      searchCases: vi.fn(),
      reportResolution: vi.fn(),
      vote: vi.fn().mockResolvedValue({ success: true }),
    };

    const mockContext = {
      sessionId: 'test',
      projectDirectory: '/test',
    };

    const tools = createTools(mockClient as any, mockContext);
    const result = await tools.fixhive_vote.execute({
      variant_id: 'var-123',
      value: 'report',
    });

    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain('Reason is required');
  });
});
