import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CloudClient, createCloudClient } from '../../src/cloud/client.js';

// Mock Supabase - create chainable mock functions
const mockRpc = vi.fn();
const mockFrom = vi.fn();

// Helper to create chainable query mock
const createChainableMock = (finalResult: unknown) => {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.ilike = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue(finalResult);
  return chain;
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: function mockCreateClient() {
    return {
      rpc: mockRpc,
      from: mockFrom,
    };
  },
}));

// Mock EmbeddingService - vitest v4 requires class/function syntax
vi.mock('../../src/cloud/embedding.js', () => ({
  EmbeddingService: class MockEmbeddingService {
    generate = vi.fn().mockResolvedValue(new Array(1536).fill(0.1));
  },
}));

describe('CloudClient', () => {
  let client: CloudClient;

  beforeEach(async () => {
    vi.clearAllMocks();

    client = await CloudClient.create({
      supabaseUrl: 'https://test.supabase.co',
      supabaseAnonKey: 'test-anon-key',
      openaiApiKey: 'test-openai-key',
      contributorId: 'test-contributor',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should initialize with custom contributor ID', () => {
      expect(client.getContributorId()).toBe('test-contributor');
    });

    it('should have embedding service when API key provided', () => {
      expect(client.hasEmbeddingService()).toBe(true);
    });

    it('should not have embedding service when no API key', async () => {
      const clientNoEmbed = await CloudClient.create({
        supabaseUrl: 'https://test.supabase.co',
        supabaseAnonKey: 'test-key',
      });
      expect(clientNoEmbed.hasEmbeddingService()).toBe(false);
    });
  });

  describe('searchSimilar', () => {
    it('should search with embedding when available', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [
          {
            id: 'entry-1',
            error_hash: 'hash-1',
            error_type: 'runtime',
            error_message: 'TypeError',
            language: 'javascript',
            resolution_description: 'Fix it',
            contributor_id: 'contributor-1',
            upvotes: 5,
            usage_count: 10,
            created_at: '2024-01-15',
            similarity: 0.95,
          },
        ],
        error: null,
      });

      const result = await client.searchSimilar({
        errorMessage: 'TypeError: undefined',
      });

      expect(mockRpc).toHaveBeenCalledWith('search_similar_errors', expect.any(Object));
      expect(result.results).toHaveLength(1);
      expect(result.results[0].id).toBe('entry-1');
      expect(result.results[0].similarity).toBe(0.95);
    });

    it('should fall back to text search when no embedding', async () => {
      const clientNoEmbed = await CloudClient.create({
        supabaseUrl: 'https://test.supabase.co',
        supabaseAnonKey: 'test-key',
      });

      // Create chainable mock for text search
      const chain: Record<string, unknown> = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.ilike = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.order = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockResolvedValue({ data: [], error: null });
      mockFrom.mockImplementation(() => chain);

      await clientNoEmbed.searchSimilar({
        errorMessage: 'TypeError',
      });

      expect(mockFrom).toHaveBeenCalledWith('knowledge_entries');
      expect(chain.ilike).toHaveBeenCalled();
    });

    it('should return empty results on error', async () => {
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Search failed' },
      });

      const result = await client.searchSimilar({
        errorMessage: 'Error',
      });

      expect(result.results).toHaveLength(0);
    });
  });

  describe('uploadResolution', () => {
    const mockErrorRecord = {
      id: 'error-1',
      errorHash: 'hash-1',
      errorType: 'runtime' as const,
      errorMessage: 'TypeError',
      toolName: 'node',
      toolInput: {},
      sessionId: 'session-1',
      status: 'resolved' as const,
      createdAt: '2024-01-15',
    };

    it('should upload new resolution', async () => {
      // Mock checkDuplicate - hash check (not found)
      const hashCheckQuery = createChainableMock({ data: null, error: { code: 'PGRST116' } });
      // Mock insert
      const insertQuery = createChainableMock({
        data: { id: 'new-knowledge-id' },
        error: null,
      });

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return hashCheckQuery;
        return insertQuery;
      });

      // Mock RPC for embedding duplicate check - no duplicate found
      mockRpc.mockResolvedValueOnce({ data: [], error: null });

      const result = await client.uploadResolution({
        errorRecord: mockErrorRecord,
        resolution: 'Added null check',
      });

      expect(result.success).toBe(true);
      expect(result.knowledgeId).toBe('new-knowledge-id');
      expect(result.isDuplicate).toBe(false);
    });

    it('should detect duplicate by hash', async () => {
      // Mock hash check - match found
      const hashCheckQuery = createChainableMock({
        data: { id: 'existing-id' },
        error: null,
      });
      mockFrom.mockImplementation(() => hashCheckQuery);

      // Mock increment usage count RPC
      mockRpc.mockResolvedValueOnce({ data: null, error: null });

      const result = await client.uploadResolution({
        errorRecord: mockErrorRecord,
        resolution: 'Same fix',
      });

      expect(result.isDuplicate).toBe(true);
      expect(result.existingId).toBe('existing-id');
    });

    it('should handle upload error', async () => {
      // Mock checkDuplicate - hash check (not found)
      const hashCheckQuery = createChainableMock({ data: null, error: { code: 'PGRST116' } });
      // Mock insert error
      const insertQuery = createChainableMock({
        data: null,
        error: { message: 'Insert failed' },
      });

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return hashCheckQuery;
        return insertQuery;
      });

      // Mock RPC for embedding duplicate check - no duplicate found
      mockRpc.mockResolvedValueOnce({ data: [], error: null });

      const result = await client.uploadResolution({
        errorRecord: mockErrorRecord,
        resolution: 'Fix',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Upload failed');
    });
  });

  describe('vote', () => {
    it('should submit upvote', async () => {
      mockRpc.mockResolvedValueOnce({
        data: { success: true, action: 'voted' },
        error: null,
      });

      // Mock usage_logs insert
      const insertQuery = createChainableMock({ data: null, error: null });
      mockFrom.mockImplementation(() => insertQuery);

      const result = await client.vote('entry-1', true);

      expect(mockRpc).toHaveBeenCalledWith('safe_vote', {
        p_entry_id: 'entry-1',
        p_user_hash: 'test-contributor',
        p_vote_type: 'up',
      });
      expect(result.success).toBe(true);
    });

    it('should submit downvote', async () => {
      mockRpc.mockResolvedValueOnce({
        data: { success: true, action: 'voted' },
        error: null,
      });

      // Mock usage_logs insert
      const insertQuery = createChainableMock({ data: null, error: null });
      mockFrom.mockImplementation(() => insertQuery);

      const result = await client.vote('entry-1', false);

      expect(mockRpc).toHaveBeenCalledWith('safe_vote', expect.objectContaining({
        p_vote_type: 'down',
      }));
      expect(result.success).toBe(true);
    });

    it('should handle vote error', async () => {
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Vote failed' },
      });

      const result = await client.vote('entry-1', true);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Vote failed');
    });
  });

  describe('reportEntry', () => {
    it('should report entry', async () => {
      mockRpc.mockResolvedValueOnce({
        data: { success: true },
        error: null,
      });

      const result = await client.reportEntry('entry-1', 'spam');

      expect(mockRpc).toHaveBeenCalledWith('report_entry', {
        p_entry_id: 'entry-1',
        p_user_hash: 'test-contributor',
        p_reason: 'spam',
      });
      expect(result.success).toBe(true);
    });

    it('should handle report error', async () => {
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Report failed' },
      });

      const result = await client.reportEntry('entry-1');

      expect(result.success).toBe(false);
    });
  });

  describe('reportHelpful', () => {
    it('should increment usage count and log', async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: null });

      // Mock usage_logs insert
      const insertQuery = createChainableMock({ data: null, error: null });
      mockFrom.mockImplementation(() => insertQuery);

      await client.reportHelpful('entry-1');

      expect(mockRpc).toHaveBeenCalledWith('increment_usage_count', {
        entry_id: 'entry-1',
      });
      expect(mockFrom).toHaveBeenCalledWith('usage_logs');
    });
  });

  describe('getContributorStats', () => {
    it('should return contributor statistics', async () => {
      // Create chainable mock that resolves the final eq() call
      const chain: Record<string, unknown> = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockResolvedValue({
        data: [
          { upvotes: 5, usage_count: 10 },
          { upvotes: 3, usage_count: 5 },
        ],
        error: null,
      });
      mockFrom.mockImplementation(() => chain);

      const stats = await client.getContributorStats();

      expect(stats.contributionCount).toBe(2);
      expect(stats.totalUpvotes).toBe(8);
      expect(stats.helpedCount).toBe(15);
    });

    it('should return zeros when no contributions', async () => {
      const chain: Record<string, unknown> = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });
      mockFrom.mockImplementation(() => chain);

      const stats = await client.getContributorStats();

      expect(stats.contributionCount).toBe(0);
      expect(stats.totalUpvotes).toBe(0);
      expect(stats.helpedCount).toBe(0);
    });
  });

  describe('getEntry', () => {
    it('should return entry by ID', async () => {
      const entryQuery = createChainableMock({
        data: {
          id: 'entry-1',
          error_hash: 'hash-1',
          error_type: 'runtime',
          error_message: 'Error',
          language: 'javascript',
          resolution_description: 'Fix',
          contributor_id: 'contrib-1',
          upvotes: 5,
          usage_count: 10,
          created_at: '2024-01-15',
        },
        error: null,
      });
      mockFrom.mockImplementation(() => entryQuery);

      const entry = await client.getEntry('entry-1');

      expect(entry).not.toBeNull();
      expect(entry!.id).toBe('entry-1');
      expect(entry!.errorMessage).toBe('Error');
    });

    it('should return null when not found', async () => {
      const entryQuery = createChainableMock({
        data: null,
        error: { code: 'PGRST116' },
      });
      mockFrom.mockImplementation(() => entryQuery);

      const entry = await client.getEntry('nonexistent');

      expect(entry).toBeNull();
    });
  });

  describe('createCloudClient', () => {
    it('should create client with config', async () => {
      const newClient = await createCloudClient({
        supabaseUrl: 'https://test.supabase.co',
        supabaseAnonKey: 'test-key',
        contributorId: 'custom-id',
      });

      expect(newClient.getContributorId()).toBe('custom-id');
    });
  });
});
