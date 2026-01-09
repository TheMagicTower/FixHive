/**
 * FixHive Type Definitions
 * Community-based error knowledge sharing for OpenCode
 */

// ============ Core Types ============

export type ErrorType =
  | 'runtime'
  | 'build'
  | 'lint'
  | 'test'
  | 'network'
  | 'permission'
  | 'dependency'
  | 'syntax'
  | 'type_error'
  | 'unknown';

export type ErrorStatus = 'unresolved' | 'resolved' | 'uploaded';

export type Language =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'rust'
  | 'go'
  | 'java'
  | 'ruby'
  | 'php'
  | 'csharp'
  | 'cpp'
  | 'other';

export type Severity = 'critical' | 'error' | 'warning';

// ============ Local Storage Types ============

export interface LocalErrorRecord {
  id: string;
  errorHash: string;
  errorType: ErrorType;
  errorMessage: string;
  errorStack?: string;
  language?: Language;
  framework?: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  sessionId: string;
  status: ErrorStatus;
  resolution?: string;
  resolutionCode?: string;
  createdAt: string;
  resolvedAt?: string;
  uploadedAt?: string;
  cloudKnowledgeId?: string;
}

export interface QueryCacheEntry {
  id: string;
  errorHash: string;
  results: CloudKnowledgeEntry[];
  createdAt: string;
  expiresAt: string;
}

export interface LocalStats {
  totalErrors: number;
  resolvedErrors: number;
  uploadedErrors: number;
}

// ============ Cloud Types ============

export interface CloudKnowledgeEntry {
  id: string;
  errorHash: string;
  errorType: ErrorType;
  errorMessage: string;
  errorStack?: string;
  language: Language;
  framework?: string;
  dependencies?: Record<string, string>;
  embedding?: number[];
  resolutionDescription: string;
  resolutionCode?: string;
  resolutionSteps?: string[];
  contributorId: string;
  upvotes: number;
  downvotes: number;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
  isVerified: boolean;
  similarity?: number;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingId?: string;
  similarityScore: number;
}

export interface ContributorStats {
  contributionCount: number;
  helpedCount: number;
  totalUpvotes: number;
}

// ============ Detection Types ============

export interface DetectedSignal {
  type: 'exit_code' | 'stderr' | 'pattern' | 'stack_trace';
  weight: number;
  value: string | number;
  description: string;
}

export interface ErrorDetectionResult {
  detected: boolean;
  confidence: number;
  errorType: ErrorType;
  severity: Severity;
  signals: DetectedSignal[];
  errorMessage: string;
  errorStack?: string;
  rawOutput: string;
}

export interface StackFrame {
  function: string;
  file: string;
  line: number;
  column?: number;
  isProjectCode: boolean;
}

export interface StackTraceInfo {
  hasStackTrace: boolean;
  language: string | null;
  frames: string[];
}

// ============ Plugin Context Types ============

export interface FixHiveContext {
  sessionId: string;
  projectDirectory: string;
  language?: Language;
  framework?: string;
}

export interface ToolOutput {
  tool: string;
  output: string;
  exitCode?: number;
  stderr?: string;
  metadata?: Record<string, unknown>;
}

// ============ Privacy Filter Types ============

export interface PrivacyFilterRule {
  name: string;
  category: 'secret' | 'identity' | 'infrastructure' | 'path' | 'environment';
  pattern: RegExp;
  replacement: string | ((match: string, ...groups: string[]) => string);
  priority: number;
}

export interface SanitizedContent {
  original: string;
  sanitized: string;
  redactedCount: number;
  appliedFilters: string[];
}

export interface FilterContext {
  projectRoot: string;
  homeDir: string;
  commonPaths: Map<string, string>;
}

// ============ API Types ============

export interface SearchRequest {
  errorMessage: string;
  errorStack?: string;
  language?: Language;
  framework?: string;
  limit?: number;
  threshold?: number;
}

export interface SearchResponse {
  results: CloudKnowledgeEntry[];
  queryTime: number;
  cached: boolean;
}

export interface UploadRequest {
  errorRecord: LocalErrorRecord;
  resolution: string;
  resolutionCode?: string;
  resolutionSteps?: string[];
}

export interface UploadResponse {
  success: boolean;
  knowledgeId?: string;
  isDuplicate: boolean;
  existingId?: string;
  message: string;
}

// ============ Tool Argument Types ============

export interface QueryKnowledgeArgs {
  errorMessage: string;
  language?: string;
  framework?: string;
  limit?: number;
}

export interface SubmitResolutionArgs {
  errorId: string;
  resolution: string;
  resolutionCode?: string;
}

export interface ListErrorsArgs {
  status?: ErrorStatus;
  limit?: number;
}

export interface MarkResolvedArgs {
  errorId: string;
  resolution: string;
  resolutionCode?: string;
  upload?: boolean;
}

export interface VoteArgs {
  knowledgeId: string;
  helpful: boolean;
}

// ============ Configuration Types ============

export interface FixHiveConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  openaiApiKey?: string;
  contributorId: string;
  cacheExpirationMs: number;
  embeddingModel: string;
  embeddingDimensions: number;
  similarityThreshold: number;
  maxSearchResults: number;
}

export interface PartialConfig {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  openaiApiKey?: string;
  contributorId?: string;
  cacheExpirationMs?: number;
}

// ============ Event Types ============

export type FixHiveEvent =
  | { type: 'error:detected'; payload: LocalErrorRecord }
  | { type: 'error:resolved'; payload: { errorId: string; resolution: string } }
  | { type: 'solution:uploaded'; payload: { knowledgeId: string } }
  | { type: 'solution:found'; payload: CloudKnowledgeEntry[] };
