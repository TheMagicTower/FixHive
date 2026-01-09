/**
 * FixHive Embedding Service
 * Generates text embeddings for semantic search using OpenAI
 */

import OpenAI from 'openai';

const DEFAULT_MODEL = 'text-embedding-3-small';
const DEFAULT_DIMENSIONS = 1536;
const MAX_INPUT_LENGTH = 30000; // ~8000 tokens

/**
 * Embedding Service Class
 * Generates embeddings for error messages and solutions
 */
export class EmbeddingService {
  private client: OpenAI;
  private model: string;
  private dimensions: number;

  constructor(apiKey: string, model?: string, dimensions?: number) {
    this.client = new OpenAI({ apiKey });
    this.model = model || DEFAULT_MODEL;
    this.dimensions = dimensions || DEFAULT_DIMENSIONS;
  }

  /**
   * Generate embedding for a single text
   */
  async generate(text: string): Promise<number[]> {
    const truncated = this.truncateText(text);

    const response = await this.client.embeddings.create({
      model: this.model,
      input: truncated,
      dimensions: this.dimensions,
    });

    return response.data[0].embedding;
  }

  /**
   * Generate embeddings for multiple texts
   */
  async generateBatch(texts: string[]): Promise<number[][]> {
    const truncated = texts.map((t) => this.truncateText(t));

    const response = await this.client.embeddings.create({
      model: this.model,
      input: truncated,
      dimensions: this.dimensions,
    });

    return response.data.map((d) => d.embedding);
  }

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
  }

  /**
   * Truncate text to fit within model limits
   */
  private truncateText(text: string): string {
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

  /**
   * Calculate cosine similarity between two embeddings
   */
  static cosineSimilarity(a: number[], b: number[]): number {
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
   * Get embedding dimensions
   */
  getDimensions(): number {
    return this.dimensions;
  }

  /**
   * Get model name
   */
  getModel(): string {
    return this.model;
  }
}

/**
 * Create embedding service with config
 */
export function createEmbeddingService(config: {
  apiKey: string;
  model?: string;
  dimensions?: number;
}): EmbeddingService {
  return new EmbeddingService(config.apiKey, config.model, config.dimensions);
}
