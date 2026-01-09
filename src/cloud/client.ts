/**
 * FixHive Cloud Client
 * Supabase client for cloud knowledge base operations
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  CloudKnowledgeEntry,
  SearchRequest,
  SearchResponse,
  UploadRequest,
  UploadResponse,
  DuplicateCheckResult,
  ContributorStats,
  LocalErrorRecord,
} from '../types/index.js';
import { EmbeddingService } from './embedding.js';
import { generateContributorId } from '../core/hash.js';

/**
 * Cloud Client Class
 * Manages communication with Supabase cloud database
 */
export class CloudClient {
  private supabase: SupabaseClient;
  private embedding: EmbeddingService | null;
  private contributorId: string;
  private similarityThreshold: number;

  constructor(config: {
    supabaseUrl: string;
    supabaseAnonKey: string;
    openaiApiKey?: string;
    contributorId?: string;
    similarityThreshold?: number;
  }) {
    this.supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
    this.embedding = config.openaiApiKey
      ? new EmbeddingService(config.openaiApiKey)
      : null;
    this.contributorId = config.contributorId || generateContributorId();
    this.similarityThreshold = config.similarityThreshold || 0.7;
  }

  /**
   * Search for similar errors in cloud knowledge base
   */
  async searchSimilar(request: SearchRequest): Promise<SearchResponse> {
    const startTime = Date.now();

    // If no embedding service, fall back to text search
    if (!this.embedding) {
      return this.searchByText(request);
    }

    // Generate embedding for search query
    const queryText = `${request.errorMessage}\n${request.errorStack || ''}`;
    const embedding = await this.embedding.generate(queryText);

    // Call Supabase RPC function
    const { data, error } = await this.supabase.rpc('search_similar_errors', {
      query_embedding: embedding,
      match_threshold: request.threshold || this.similarityThreshold,
      match_count: request.limit || 10,
      filter_language: request.language || null,
      filter_framework: request.framework || null,
    });

    if (error) {
      console.error('Search error:', error);
      return { results: [], queryTime: Date.now() - startTime, cached: false };
    }

    return {
      results: (data || []).map(this.mapToKnowledgeEntry),
      queryTime: Date.now() - startTime,
      cached: false,
    };
  }

  /**
   * Fallback text-based search
   */
  private async searchByText(request: SearchRequest): Promise<SearchResponse> {
    const startTime = Date.now();

    let query = this.supabase
      .from('knowledge_entries')
      .select('*')
      .ilike('error_message', `%${request.errorMessage.substring(0, 100)}%`)
      .order('upvotes', { ascending: false })
      .limit(request.limit || 10);

    if (request.language) {
      query = query.eq('language', request.language);
    }

    if (request.framework) {
      query = query.eq('framework', request.framework);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Text search error:', error);
      return { results: [], queryTime: Date.now() - startTime, cached: false };
    }

    return {
      results: (data || []).map(this.mapToKnowledgeEntry),
      queryTime: Date.now() - startTime,
      cached: false,
    };
  }

  /**
   * Upload a resolution to cloud knowledge base
   */
  async uploadResolution(request: UploadRequest): Promise<UploadResponse> {
    const { errorRecord, resolution, resolutionCode, resolutionSteps } = request;

    // Generate embedding if available
    let embedding: number[] | null = null;
    if (this.embedding) {
      const embeddingText = `${errorRecord.errorMessage}\n${errorRecord.errorStack || ''}`;
      embedding = await this.embedding.generate(embeddingText);
    }

    // Check for duplicates
    if (embedding) {
      const duplicateCheck = await this.checkDuplicate(errorRecord.errorHash, embedding);

      if (duplicateCheck.isDuplicate && duplicateCheck.similarityScore > 0.95) {
        // Increment usage count on existing entry
        await this.supabase.rpc('increment_usage_count', {
          entry_id: duplicateCheck.existingId,
        });

        return {
          success: true,
          isDuplicate: true,
          existingId: duplicateCheck.existingId,
          message: 'Similar solution already exists. Usage count incremented.',
        };
      }
    }

    // Insert new entry
    const { data, error } = await this.supabase
      .from('knowledge_entries')
      .insert({
        error_hash: errorRecord.errorHash,
        error_type: errorRecord.errorType,
        error_message: errorRecord.errorMessage,
        error_stack: errorRecord.errorStack,
        language: errorRecord.language || 'other',
        framework: errorRecord.framework,
        embedding,
        resolution_description: resolution,
        resolution_code: resolutionCode,
        resolution_steps: resolutionSteps,
        contributor_id: this.contributorId,
      })
      .select('id')
      .single();

    if (error) {
      return {
        success: false,
        isDuplicate: false,
        message: `Upload failed: ${error.message}`,
      };
    }

    return {
      success: true,
      knowledgeId: data.id,
      isDuplicate: false,
      message: 'Solution uploaded successfully!',
    };
  }

  /**
   * Check for duplicate entries
   */
  async checkDuplicate(
    errorHash: string,
    embedding: number[]
  ): Promise<DuplicateCheckResult> {
    // First check by exact hash
    const { data: hashMatch } = await this.supabase
      .from('knowledge_entries')
      .select('id')
      .eq('error_hash', errorHash)
      .limit(1)
      .single();

    if (hashMatch) {
      return {
        isDuplicate: true,
        existingId: hashMatch.id,
        similarityScore: 1.0,
      };
    }

    // Then check by embedding similarity
    const { data, error } = await this.supabase.rpc('check_duplicate_entry', {
      new_hash: errorHash,
      new_embedding: embedding,
      similarity_threshold: 0.95,
    });

    if (error || !data || data.length === 0) {
      return { isDuplicate: false, similarityScore: 0 };
    }

    const result = data[0];
    return {
      isDuplicate: result.is_duplicate,
      existingId: result.existing_id,
      similarityScore: result.similarity_score,
    };
  }

  /**
   * Vote on a knowledge entry
   */
  async vote(knowledgeId: string, helpful: boolean): Promise<void> {
    const column = helpful ? 'upvotes' : 'downvotes';

    await this.supabase.rpc('increment_vote', {
      entry_id: knowledgeId,
      vote_type: column,
    });

    // Log usage
    await this.supabase.from('usage_logs').insert({
      knowledge_id: knowledgeId,
      action: helpful ? 'upvote' : 'downvote',
      user_hash: this.contributorId,
    });
  }

  /**
   * Report helpful usage
   */
  async reportHelpful(knowledgeId: string): Promise<void> {
    await this.supabase.rpc('increment_usage_count', {
      entry_id: knowledgeId,
    });

    await this.supabase.from('usage_logs').insert({
      knowledge_id: knowledgeId,
      action: 'apply',
      user_hash: this.contributorId,
    });
  }

  /**
   * Get contributor statistics
   */
  async getContributorStats(): Promise<ContributorStats> {
    const { data } = await this.supabase
      .from('knowledge_entries')
      .select('upvotes, usage_count')
      .eq('contributor_id', this.contributorId);

    if (!data || data.length === 0) {
      return { contributionCount: 0, helpedCount: 0, totalUpvotes: 0 };
    }

    return {
      contributionCount: data.length,
      helpedCount: data.reduce((sum, e) => sum + (e.usage_count || 0), 0),
      totalUpvotes: data.reduce((sum, e) => sum + (e.upvotes || 0), 0),
    };
  }

  /**
   * Get entry by ID
   */
  async getEntry(id: string): Promise<CloudKnowledgeEntry | null> {
    const { data, error } = await this.supabase
      .from('knowledge_entries')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapToKnowledgeEntry(data);
  }

  /**
   * Map database row to CloudKnowledgeEntry
   */
  private mapToKnowledgeEntry(row: Record<string, unknown>): CloudKnowledgeEntry {
    return {
      id: row.id as string,
      errorHash: row.error_hash as string,
      errorType: row.error_type as CloudKnowledgeEntry['errorType'],
      errorMessage: row.error_message as string,
      errorStack: (row.error_stack as string) || undefined,
      language: row.language as CloudKnowledgeEntry['language'],
      framework: (row.framework as string) || undefined,
      dependencies: (row.dependencies as Record<string, string>) || undefined,
      resolutionDescription: row.resolution_description as string,
      resolutionCode: (row.resolution_code as string) || undefined,
      resolutionSteps: (row.resolution_steps as string[]) || undefined,
      contributorId: row.contributor_id as string,
      upvotes: (row.upvotes as number) || 0,
      downvotes: (row.downvotes as number) || 0,
      usageCount: (row.usage_count as number) || 0,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
      isVerified: (row.is_verified as boolean) || false,
      similarity: (row.similarity as number) || undefined,
    };
  }

  /**
   * Get contributor ID
   */
  getContributorId(): string {
    return this.contributorId;
  }

  /**
   * Check if embedding service is available
   */
  hasEmbeddingService(): boolean {
    return this.embedding !== null;
  }
}

/**
 * Create cloud client with config
 */
export function createCloudClient(config: {
  supabaseUrl: string;
  supabaseAnonKey: string;
  openaiApiKey?: string;
  contributorId?: string;
  similarityThreshold?: number;
}): CloudClient {
  return new CloudClient(config);
}
