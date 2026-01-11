/**
 * FixHive Cloud Client
 * Supabase client for cloud knowledge base operations
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CloudKnowledgeEntry,
  SearchRequest,
  SearchResponse,
  UploadRequest,
  UploadResponse,
  DuplicateCheckResult,
  ContributorStats,
} from '../types/index.js';
import { createEmbeddingService, type EmbeddingService } from './embedding.js';
import { generateContributorId } from '../core/hash.js';

/**
 * Dynamic import helper for Supabase (Bun ESM/CJS interop)
 */
async function getSupabaseCreateClient(): Promise<typeof import('@supabase/supabase-js').createClient> {
  const mod = await import('@supabase/supabase-js');
  // Handle various export patterns
  return mod.createClient || (mod as unknown as { default: { createClient: typeof mod.createClient } }).default?.createClient;
}

/**
 * Cloud Client Configuration
 */
export interface CloudClientConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  openaiApiKey?: string;
  contributorId?: string;
  similarityThreshold?: number;
}

/**
 * CloudClient interface - defines all public methods
 */
export interface CloudClient {
  searchSimilar(request: SearchRequest): Promise<SearchResponse>;
  uploadResolution(request: UploadRequest): Promise<UploadResponse>;
  checkDuplicate(errorHash: string, embedding: number[]): Promise<DuplicateCheckResult>;
  vote(knowledgeId: string, helpful: boolean): Promise<{ success: boolean; error?: string }>;
  reportEntry(knowledgeId: string, reason?: string): Promise<{ success: boolean }>;
  reportHelpful(knowledgeId: string): Promise<void>;
  getContributorStats(): Promise<ContributorStats>;
  getEntry(id: string): Promise<CloudKnowledgeEntry | null>;
  getContributorId(): string;
  hasEmbeddingService(): boolean;
}

/**
 * Map database row to CloudKnowledgeEntry
 */
function mapToKnowledgeEntry(row: Record<string, unknown>): CloudKnowledgeEntry {
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
 * Create a CloudClient instance
 * Factory function pattern to avoid ES6 class issues with Bun
 */
export async function createCloudClient(config: CloudClientConfig): Promise<CloudClient> {
  // Create Supabase client using dynamic import for Bun compatibility
  const createClient = await getSupabaseCreateClient();
  const supabase: SupabaseClient = createClient(config.supabaseUrl, config.supabaseAnonKey);

  // Initialize embedding service (optional)
  let embedding: EmbeddingService | null = null;
  if (config.openaiApiKey) {
    try {
      embedding = await createEmbeddingService({ apiKey: config.openaiApiKey });
    } catch (err) {
      console.warn('[FixHive] Failed to initialize embedding service:', err);
    }
  }

  const contributorId = config.contributorId || generateContributorId();
  const similarityThreshold = config.similarityThreshold || 0.7;

  // Private helper for duplicate check
  async function checkDuplicateInternal(errorHash: string, embeddingData: number[]): Promise<DuplicateCheckResult> {
    // First check by exact hash
    const { data: hashMatch } = await supabase
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
    const { data, error } = await supabase.rpc('check_duplicate_entry', {
      new_hash: errorHash,
      new_embedding: embeddingData,
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

  // Private helper for text-based search
  async function searchByText(request: SearchRequest): Promise<SearchResponse> {
    const startTime = Date.now();

    let query = supabase
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
      results: (data || []).map(mapToKnowledgeEntry),
      queryTime: Date.now() - startTime,
      cached: false,
    };
  }

  // Return object with all methods (closure pattern)
  return {
    async searchSimilar(request: SearchRequest): Promise<SearchResponse> {
      const startTime = Date.now();

      // If no embedding service, fall back to text search
      if (!embedding) {
        return searchByText(request);
      }

      // Generate embedding for search query
      const queryText = `${request.errorMessage}\n${request.errorStack || ''}`;
      const queryEmbedding = await embedding.generate(queryText);

      // Call Supabase RPC function
      const { data, error } = await supabase.rpc('search_similar_errors', {
        query_embedding: queryEmbedding,
        match_threshold: request.threshold || similarityThreshold,
        match_count: request.limit || 10,
        filter_language: request.language || null,
        filter_framework: request.framework || null,
      });

      if (error) {
        console.error('Search error:', error);
        return { results: [], queryTime: Date.now() - startTime, cached: false };
      }

      return {
        results: (data || []).map(mapToKnowledgeEntry),
        queryTime: Date.now() - startTime,
        cached: false,
      };
    },

    async uploadResolution(request: UploadRequest): Promise<UploadResponse> {
      const { errorRecord, resolution, resolutionCode, resolutionSteps } = request;

      console.log(`[FixHive:Cloud] Starting upload for error: ${errorRecord.id.slice(0, 8)}`);

      // Generate embedding if available
      let embeddingData: number[] | null = null;
      if (embedding) {
        const embeddingText = `${errorRecord.errorMessage}\n${errorRecord.errorStack || ''}`;
        console.log(`[FixHive:Cloud] Generating embedding for error...`);
        embeddingData = await embedding.generate(embeddingText);
        console.log(`[FixHive:Cloud] Embedding generated: ${embeddingData ? embeddingData.length : 0} dims`);
      } else {
        console.log(`[FixHive:Cloud] No embedding service available - using text-only upload`);
      }

      // Check for duplicates
      if (embeddingData) {
        console.log(`[FixHive:Cloud] Checking for duplicates...`);
        const duplicateCheck = await checkDuplicateInternal(errorRecord.errorHash, embeddingData);
        console.log(`[FixHive:Cloud] Duplicate check: isDuplicate=${duplicateCheck.isDuplicate}, similarity=${duplicateCheck.similarityScore.toFixed(2)}`);

        if (duplicateCheck.isDuplicate && duplicateCheck.similarityScore > 0.95) {
          // Increment usage count on existing entry
          console.log(`[FixHive:Cloud] Duplicate found (similarity > 0.95). Incrementing usage count on entry ${duplicateCheck.existingId}`);
          await supabase.rpc('increment_usage_count', {
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
      console.log(`[FixHive:Cloud] Inserting new knowledge entry...`);
      console.log(`[FixHive:Cloud]   Hash: ${errorRecord.errorHash}`);
      console.log(`[FixHive:Cloud]   Language: ${errorRecord.language}`);
      console.log(`[FixHive:Cloud]   Framework: ${errorRecord.framework}`);
      console.log(`[FixHive:Cloud]   Contributor: ${contributorId}`);

      const { data, error } = await supabase
        .from('knowledge_entries')
        .insert({
          error_hash: errorRecord.errorHash,
          error_type: errorRecord.errorType,
          error_message: errorRecord.errorMessage,
          error_stack: errorRecord.errorStack,
          language: errorRecord.language || 'other',
          framework: errorRecord.framework,
          embedding: embeddingData,
          resolution_description: resolution,
          resolution_code: resolutionCode,
          resolution_steps: resolutionSteps,
          contributor_id: contributorId,
        })
        .select('id')
        .single();

      if (error) {
        console.error(`[FixHive:Cloud] Upload failed:`, error);
        console.error(`[FixHive:Cloud] Error details:`, {
          message: error.message,
          code: error.code,
          hint: error.hint,
          details: error.details,
        });
        return {
          success: false,
          isDuplicate: false,
          message: `Upload failed: ${error.message}`,
        };
      }

      console.log(`[FixHive:Cloud] Upload successful! Knowledge ID: ${data.id}`);
      return {
        success: true,
        knowledgeId: data.id,
        isDuplicate: false,
        message: 'Solution uploaded successfully!',
      };
    },

    async checkDuplicate(errorHash: string, embeddingData: number[]): Promise<DuplicateCheckResult> {
      return checkDuplicateInternal(errorHash, embeddingData);
    },

    async vote(knowledgeId: string, helpful: boolean): Promise<{ success: boolean; error?: string }> {
      const voteType = helpful ? 'up' : 'down';

      const { data, error } = await supabase.rpc('safe_vote', {
        p_entry_id: knowledgeId,
        p_user_hash: contributorId,
        p_vote_type: voteType,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      const result = data as { success: boolean; error?: string; action?: string };

      // Log usage only on successful new vote
      if (result.success) {
        await supabase.from('usage_logs').insert({
          knowledge_id: knowledgeId,
          action: helpful ? 'upvote' : 'downvote',
          user_hash: contributorId,
        });
      }

      return result;
    },

    async reportEntry(knowledgeId: string, reason?: string): Promise<{ success: boolean }> {
      const { data, error } = await supabase.rpc('report_entry', {
        p_entry_id: knowledgeId,
        p_user_hash: contributorId,
        p_reason: reason || null,
      });

      if (error) {
        return { success: false };
      }

      return data as { success: boolean };
    },

    async reportHelpful(knowledgeId: string): Promise<void> {
      await supabase.rpc('increment_usage_count', {
        entry_id: knowledgeId,
      });

      await supabase.from('usage_logs').insert({
        knowledge_id: knowledgeId,
        action: 'apply',
        user_hash: contributorId,
      });
    },

    async getContributorStats(): Promise<ContributorStats> {
      const { data } = await supabase
        .from('knowledge_entries')
        .select('upvotes, usage_count')
        .eq('contributor_id', contributorId);

      if (!data || data.length === 0) {
        return { contributionCount: 0, helpedCount: 0, totalUpvotes: 0 };
      }

      return {
        contributionCount: data.length,
        helpedCount: data.reduce((sum, e) => sum + (e.usage_count || 0), 0),
        totalUpvotes: data.reduce((sum, e) => sum + (e.upvotes || 0), 0),
      };
    },

    async getEntry(id: string): Promise<CloudKnowledgeEntry | null> {
      const { data, error } = await supabase
        .from('knowledge_entries')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        return null;
      }

      return mapToKnowledgeEntry(data);
    },

    getContributorId(): string {
      return contributorId;
    },

    hasEmbeddingService(): boolean {
      return embedding !== null;
    },
  };
}

// Legacy export for backwards compatibility
// CloudClient is now an interface, use createCloudClient() instead
export const CloudClient = {
  create: createCloudClient,
};
