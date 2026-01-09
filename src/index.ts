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

// Core components
export { ErrorDetector, defaultErrorDetector } from './core/error-detector.js';
export { PrivacyFilter, defaultPrivacyFilter, createFilterContext } from './core/privacy-filter.js';
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

// Storage
export { LocalStore } from './storage/local-store.js';
export { runMigrations } from './storage/migrations.js';

// Cloud
export { CloudClient, createCloudClient } from './cloud/client.js';
export { EmbeddingService, createEmbeddingService } from './cloud/embedding.js';

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
