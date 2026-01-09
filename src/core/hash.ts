/**
 * FixHive Hash Utilities
 * Generates fingerprints and hashes for error deduplication
 */

import { createHash } from 'crypto';

/**
 * Generate SHA-256 hash of content
 */
export function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Generate a shortened hash (first 16 characters)
 */
export function shortHash(content: string): string {
  return sha256(content).substring(0, 16);
}

/**
 * Generate error fingerprint for matching similar errors
 * Normalizes variable parts (paths, numbers, hashes) before hashing
 */
export function generateErrorFingerprint(
  errorMessage: string,
  errorStack?: string
): string {
  // Combine message and stack
  const combined = `${errorMessage}\n${errorStack || ''}`;

  // Normalize the content
  const normalized = normalizeErrorContent(combined);

  // Generate hash
  return shortHash(normalized);
}

/**
 * Normalize error content by replacing variable parts
 */
export function normalizeErrorContent(content: string): string {
  return (
    content
      // String literals
      .replace(/['"`][^'"`\n]{0,100}['"`]/g, '<STR>')
      // File paths
      .replace(/(?:\/[\w.-]+)+/g, '<PATH>')
      // Windows paths
      .replace(/(?:[A-Z]:\\[\w.-]+)+/gi, '<PATH>')
      // Line:column references
      .replace(/:\d+:\d+/g, ':<LINE>:<COL>')
      // Line numbers only
      .replace(/line\s+\d+/gi, 'line <LINE>')
      // Memory addresses
      .replace(/0x[a-f0-9]+/gi, '<ADDR>')
      // UUIDs
      .replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, '<UUID>')
      // Long hex strings (hashes, IDs)
      .replace(/\b[a-f0-9]{8,}\b/gi, '<HASH>')
      // Numbers (but keep small numbers like error codes)
      .replace(/\b\d{5,}\b/g, '<NUM>')
      // Timestamps
      .replace(/\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}/g, '<TIMESTAMP>')
      // Multiple whitespace
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Generate contributor ID (anonymous hash)
 * Uses machine-specific information to create a stable anonymous ID
 */
export function generateContributorId(): string {
  const machineInfo = [
    process.env.USER || process.env.USERNAME || '',
    process.env.HOME || process.env.USERPROFILE || '',
    process.platform,
    process.arch,
  ].join(':');

  return `anon_${shortHash(machineInfo)}`;
}

/**
 * Generate session-specific hash
 */
export function generateSessionHash(sessionId: string): string {
  return shortHash(`session:${sessionId}:${Date.now()}`);
}

/**
 * Compare two fingerprints for similarity
 * Returns true if they're identical (exact match)
 */
export function fingerprintsMatch(fp1: string, fp2: string): boolean {
  return fp1 === fp2;
}

/**
 * Calculate simple string similarity (Jaccard index)
 * Used as a fallback when embeddings aren't available
 */
export function calculateStringSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.toLowerCase().split(/\s+/));
  const words2 = new Set(str2.toLowerCase().split(/\s+/));

  const intersection = new Set([...words1].filter((x) => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  if (union.size === 0) return 0;

  return intersection.size / union.size;
}
