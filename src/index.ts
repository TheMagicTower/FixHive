/**
 * FixHive - Community-based Error Knowledge Sharing for OpenCode
 *
 * @module @fixhive/opencode-plugin
 * @description
 * FixHive is an OpenCode plugin that automatically captures errors during
 * development sessions, queries a community knowledge base for solutions,
 * and shares resolved errors with other developers.
 *
 * @example
 * ```typescript
 * // In your OpenCode plugin configuration
 * import FixHivePlugin from '@fixhive/opencode-plugin';
 *
 * export default FixHivePlugin;
 * ```
 *
 * @example
 * ```bash
 * # Environment variables
 * FIXHIVE_SUPABASE_URL=https://your-project.supabase.co
 * FIXHIVE_SUPABASE_KEY=your-anon-key
 * OPENAI_API_KEY=sk-...  # Optional, for embeddings
 * ```
 */

// Main plugin export
export { FixHivePlugin, default } from './plugin/index.js';

// Core components - Factory functions
export { createErrorDetector, defaultErrorDetector } from './core/error-detector.js';
export { createPrivacyFilter, defaultPrivacyFilter, createFilterContext } from './core/privacy-filter.js';
export {
  sha256,
  shortHash,
  generateErrorFingerprint,
  normalizeErrorContent,
  generateContributorId,
  generateSessionHash,
  fingerprintsMatch,
  calculateStringSimilarity,
} from './core/hash.js';

// Storage - Factory functions
export { createLocalStore } from './storage/local-store.js';
export { runMigrations } from './storage/migrations.js';

// Cloud - Factory functions
export { createCloudClient } from './cloud/client.js';
export { createEmbeddingService, cosineSimilarity } from './cloud/embedding.js';

// Legacy exports for backwards compatibility (deprecated)
export { ErrorDetector } from './core/error-detector.js';
export { PrivacyFilter } from './core/privacy-filter.js';
export { LocalStore } from './storage/local-store.js';
export { CloudClient } from './cloud/client.js';
export { EmbeddingService } from './cloud/embedding.js';

// Types
export type {
  // Core types
  ErrorType,
  ErrorStatus,
  Language,
  Severity,

  // Local storage types
  LocalErrorRecord,
  QueryCacheEntry,
  LocalStats,

  // Cloud types
  CloudKnowledgeEntry,
  DuplicateCheckResult,
  ContributorStats,

  // Detection types
  DetectedSignal,
  ErrorDetectionResult,
  StackFrame,
  StackTraceInfo,

  // Plugin context types
  FixHiveContext,
  ToolOutput,

  // Privacy filter types
  PrivacyFilterRule,
  SanitizedContent,
  FilterContext,

  // API types
  SearchRequest,
  SearchResponse,
  UploadRequest,
  UploadResponse,

  // Tool argument types
  QueryKnowledgeArgs,
  SubmitResolutionArgs,
  ListErrorsArgs,
  MarkResolvedArgs,
  VoteArgs,

  // Configuration types
  FixHiveConfig,
  PartialConfig,

  // Event types
  FixHiveEvent,
} from './types/index.js';

// Re-export interface types
export type { ErrorDetector as ErrorDetectorInterface } from './core/error-detector.js';
export type { PrivacyFilter as PrivacyFilterInterface } from './core/privacy-filter.js';
export type { LocalStore as LocalStoreInterface } from './storage/local-store.js';
export type { CloudClient as CloudClientInterface } from './cloud/client.js';
export type { EmbeddingService as EmbeddingServiceInterface, EmbeddingServiceConfig } from './cloud/embedding.js';
