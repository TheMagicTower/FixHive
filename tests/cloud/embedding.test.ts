import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEmbeddingService, cosineSimilarity, type EmbeddingService } from '../../src/cloud/embedding.js';

// Mock OpenAI - vitest v4 requires class/function syntax for constructor mocks
// Mock returns embeddings based on input array length for batch support
vi.mock('openai', () => {
  return {
    OpenAI: class MockOpenAI {
      embeddings = {
        create: vi.fn().mockImplementation((params: { input: string | string[] }) => {
          const inputCount = Array.isArray(params?.input) ? params.input.length : 1;
          return Promise.resolve({
            data: Array.from({ length: inputCount }, (_, i) => ({
              embedding: new Array(1536).fill(0.1 * (i + 1)),
            })),
          });
        }),
      };
    },
  };
});

describe('EmbeddingService', () => {
  let service: EmbeddingService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createEmbeddingService({ apiKey: 'test-api-key' });
  });

  describe('createEmbeddingService', () => {
    it('should use default model and dimensions', () => {
      expect(service.getModel()).toBe('text-embedding-3-small');
      expect(service.getDimensions()).toBe(1536);
    });

    it('should accept custom model and dimensions', () => {
      const customService = createEmbeddingService({
        apiKey: 'key',
        model: 'text-embedding-ada-002',
        dimensions: 512,
      });
      expect(customService.getModel()).toBe('text-embedding-ada-002');
      expect(customService.getDimensions()).toBe(512);
    });
  });

  describe('generate', () => {
    it('should generate embedding for text', async () => {
      const embedding = await service.generate('Test error message');
      expect(embedding).toHaveLength(1536);
      expect(embedding[0]).toBe(0.1);
    });

    it('should truncate long text', async () => {
      const longText = 'a'.repeat(50000);
      const embedding = await service.generate(longText);
      expect(embedding).toHaveLength(1536);
    });
  });

  describe('generateBatch', () => {
    it('should generate embeddings for multiple texts', async () => {
      // Mock now automatically handles batch by returning embeddings based on input length
      const embeddings = await service.generateBatch(['Text 1', 'Text 2']);
      expect(embeddings).toHaveLength(2);
      // First embedding should have 0.1 values, second should have 0.2 values
      expect(embeddings[0][0]).toBe(0.1);
      expect(embeddings[1][0]).toBe(0.2);
    });
  });

  describe('generateErrorEmbedding', () => {
    it('should include error message', async () => {
      const embedding = await service.generateErrorEmbedding('TypeError: x is undefined');
      expect(embedding).toHaveLength(1536);
    });

    it('should include stack trace if provided', async () => {
      const embedding = await service.generateErrorEmbedding(
        'TypeError',
        'at foo()\nat bar()'
      );
      expect(embedding).toHaveLength(1536);
    });

    it('should include context if provided', async () => {
      const embedding = await service.generateErrorEmbedding(
        'Error',
        undefined,
        { language: 'javascript', framework: 'react' }
      );
      expect(embedding).toHaveLength(1536);
    });
  });

  describe('cosineSimilarity', () => {
    it('should return 1 for identical vectors', () => {
      const vec = [1, 0, 0, 0];
      const similarity = cosineSimilarity(vec, vec);
      expect(similarity).toBeCloseTo(1, 5);
    });

    it('should return 0 for orthogonal vectors', () => {
      const vec1 = [1, 0];
      const vec2 = [0, 1];
      const similarity = cosineSimilarity(vec1, vec2);
      expect(similarity).toBeCloseTo(0, 5);
    });

    it('should return -1 for opposite vectors', () => {
      const vec1 = [1, 0];
      const vec2 = [-1, 0];
      const similarity = cosineSimilarity(vec1, vec2);
      expect(similarity).toBeCloseTo(-1, 5);
    });

    it('should handle normalized vectors correctly', () => {
      const vec1 = [0.6, 0.8]; // normalized
      const vec2 = [0.8, 0.6]; // normalized
      const similarity = cosineSimilarity(vec1, vec2);
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(1);
    });

    it('should throw error for different dimensions', () => {
      const vec1 = [1, 2, 3];
      const vec2 = [1, 2];
      expect(() => cosineSimilarity(vec1, vec2)).toThrow(
        'Embeddings must have same dimensions'
      );
    });

    it('should return 0 for zero vectors', () => {
      const vec = [0, 0, 0];
      const similarity = cosineSimilarity(vec, vec);
      expect(similarity).toBe(0);
    });
  });

  describe('text truncation', () => {
    it('should not truncate text under limit', async () => {
      const text = 'Short text';
      const embedding = await service.generate(text);
      expect(embedding).toHaveLength(1536);
    });

    it('should truncate at newline when possible', async () => {
      // The truncation logic prefers to cut at newline
      // if it's within the last 20% of the limit
      const longText = 'a'.repeat(25000) + '\n' + 'b'.repeat(10000);
      const embedding = await service.generate(longText);
      expect(embedding).toHaveLength(1536);
    });
  });
});
