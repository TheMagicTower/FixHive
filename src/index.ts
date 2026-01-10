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

// NOTE: Do NOT export functions from main index.ts!
// OpenCode treats ALL exports as plugin instances and calls them.
// Only export the default plugin instance.

import FixHivePlugin from './plugin/index.js';
export default FixHivePlugin;

// Types only (these are erased at runtime, so safe to export)
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
