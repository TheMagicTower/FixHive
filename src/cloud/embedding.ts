/**
 * FixHive Embedding Service
 * Generates text embeddings for semantic search using OpenAI
 */

import * as openaiModule from 'openai';

const DEFAULT_MODEL = 'text-embedding-3-small';
const DEFAULT_DIMENSIONS = 1536;
const MAX_INPUT_LENGTH = 30000; // ~8000 tokens

/**
 * EmbeddingService interface - defines all public methods
 */
export interface EmbeddingService {
  generate(text: string): Promise<number[]>;
  generateBatch(texts: string[]): Promise<number[][]>;
  generateErrorEmbedding(
    errorMessage: string,
    errorStack?: string,
    context?: { language?: string; framework?: string }
  ): Promise<number[]>;
  getDimensions(): number;
  getModel(): string;
}

/**
 * EmbeddingService configuration
 */
export interface EmbeddingServiceConfig {
  apiKey: string;
  model?: string;
  dimensions?: number;
}

/**
 * Calculate cosine similarity between two embeddings
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embeddings must have same dimensions');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0;

  return dotProduct / magnitude;
}

/**
 * Create an EmbeddingService instance
 * Factory function pattern to avoid ES6 class issues with Bun
 */
export function createEmbeddingService(config: EmbeddingServiceConfig): EmbeddingService {
  // Handle both default and named exports for CJS/ESM interop
  const OpenAI = openaiModule.OpenAI || (openaiModule as unknown as { default: typeof openaiModule.OpenAI }).default;
  const client = new OpenAI({ apiKey: config.apiKey });
  const model = config.model || DEFAULT_MODEL;
  const dimensions = config.dimensions || DEFAULT_DIMENSIONS;

  /**
   * Truncate text to fit within model limits
   */
  function truncateText(text: string): string {
    if (text.length <= MAX_INPUT_LENGTH) {
      return text;
    }

    // Try to truncate at a sensible boundary
    const truncated = text.substring(0, MAX_INPUT_LENGTH);
    const lastNewline = truncated.lastIndexOf('\n');

    if (lastNewline > MAX_INPUT_LENGTH * 0.8) {
      return truncated.substring(0, lastNewline);
    }

    return truncated;
  }

  return {
    /**
     * Generate embedding for a single text
     */
    async generate(text: string): Promise<number[]> {
      const truncated = truncateText(text);

      const response = await client.embeddings.create({
        model,
        input: truncated,
        dimensions,
      });

      return response.data[0].embedding;
    },

    /**
     * Generate embeddings for multiple texts
     */
    async generateBatch(texts: string[]): Promise<number[][]> {
      const truncated = texts.map((t) => truncateText(t));

      const response = await client.embeddings.create({
        model,
        input: truncated,
        dimensions,
      });

      return response.data.map((d) => d.embedding);
    },

    /**
     * Generate embedding for error context
     * Combines error message, stack trace, and context
     */
    async generateErrorEmbedding(
      errorMessage: string,
      errorStack?: string,
      context?: { language?: string; framework?: string }
    ): Promise<number[]> {
      // Build context string
      const parts: string[] = [];

      if (context?.language) {
        parts.push(`Language: ${context.language}`);
      }
      if (context?.framework) {
        parts.push(`Framework: ${context.framework}`);
      }

      parts.push(`Error: ${errorMessage}`);

      if (errorStack) {
        parts.push(`Stack Trace:\n${errorStack}`);
      }

      const text = parts.join('\n');
      return this.generate(text);
    },

    /**
     * Get embedding dimensions
     */
    getDimensions(): number {
      return dimensions;
    },

    /**
     * Get model name
     */
    getModel(): string {
      return model;
    },
  };
}

/**
 * Legacy class wrapper for backwards compatibility
 * @deprecated Use createEmbeddingService() instead
 */
export const EmbeddingService = {
  create: createEmbeddingService,
  cosineSimilarity,
};
