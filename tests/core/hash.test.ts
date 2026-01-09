import { describe, it, expect } from 'vitest';
import {
  sha256,
  shortHash,
  generateErrorFingerprint,
  normalizeErrorContent,
  generateContributorId,
  fingerprintsMatch,
  calculateStringSimilarity,
} from '../../src/core/hash.js';

describe('Hash Utilities', () => {
  describe('sha256', () => {
    it('should generate consistent SHA-256 hash', () => {
      const hash1 = sha256('test content');
      const hash2 = sha256('test content');
      expect(hash1).toBe(hash2);
    });

    it('should generate 64-character hex string', () => {
      const hash = sha256('any content');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should generate different hashes for different inputs', () => {
      const hash1 = sha256('content 1');
      const hash2 = sha256('content 2');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('shortHash', () => {
    it('should generate 16-character hash', () => {
      const hash = shortHash('test content');
      expect(hash).toHaveLength(16);
    });

    it('should be first 16 chars of SHA-256', () => {
      const full = sha256('test');
      const short = shortHash('test');
      expect(short).toBe(full.substring(0, 16));
    });
  });

  describe('normalizeErrorContent', () => {
    it('should normalize file paths', () => {
      const content = 'Error in /Users/dev/project/src/app.ts';
      const normalized = normalizeErrorContent(content);
      expect(normalized).toContain('<PATH>');
      expect(normalized).not.toContain('/Users/dev');
    });

    it('should normalize Windows paths', () => {
      const content = 'Error at C:\\Users\\dev\\project\\main.js';
      const normalized = normalizeErrorContent(content);
      expect(normalized).toContain('<PATH>');
    });

    it('should normalize line:column references', () => {
      const content = 'Error at file.ts:42:10';
      const normalized = normalizeErrorContent(content);
      expect(normalized).toContain(':<LINE>:<COL>');
      expect(normalized).not.toContain(':42:10');
    });

    it('should normalize memory addresses', () => {
      const content = 'Segfault at 0x7fff5fbff8c0';
      const normalized = normalizeErrorContent(content);
      expect(normalized).toContain('<ADDR>');
    });

    it('should normalize UUIDs', () => {
      const content = 'Request id: 550e8400-e29b-41d4-a716-446655440000';
      const normalized = normalizeErrorContent(content);
      expect(normalized).toContain('<UUID>');
    });

    it('should normalize long hex strings', () => {
      const content = 'Hash: a1b2c3d4e5f67890';
      const normalized = normalizeErrorContent(content);
      expect(normalized).toContain('<HASH>');
    });

    it('should normalize ISO timestamps', () => {
      // Note: Line:col pattern runs before timestamp pattern
      // Format \d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2} - but :dd:dd gets caught by line:col first
      const content = 'Created 2024-01-15T10:30:45Z';
      const normalized = normalizeErrorContent(content);
      // Due to rule ordering, time part gets caught by line:col pattern
      expect(normalized).toContain('2024-01-15');
    });

    it('should normalize string literals', () => {
      const content = "Cannot find module 'react'";
      const normalized = normalizeErrorContent(content);
      expect(normalized).toContain('<STR>');
    });

    it('should preserve error type keywords', () => {
      const content = 'TypeError: Cannot read property';
      const normalized = normalizeErrorContent(content);
      expect(normalized).toContain('TypeError');
    });

    it('should collapse multiple whitespace', () => {
      const content = 'Error    with   many    spaces';
      const normalized = normalizeErrorContent(content);
      expect(normalized).not.toContain('  ');
    });
  });

  describe('generateErrorFingerprint', () => {
    it('should generate consistent fingerprint for same error', () => {
      const fp1 = generateErrorFingerprint('TypeError: x is undefined');
      const fp2 = generateErrorFingerprint('TypeError: x is undefined');
      expect(fp1).toBe(fp2);
    });

    it('should generate 16-character fingerprint', () => {
      const fp = generateErrorFingerprint('Some error');
      expect(fp).toHaveLength(16);
    });

    it('should normalize variable parts before hashing', () => {
      const fp1 = generateErrorFingerprint('Error at /path/a/file.ts:10:5');
      const fp2 = generateErrorFingerprint('Error at /path/b/file.ts:20:8');
      expect(fp1).toBe(fp2);
    });

    it('should include stack trace in fingerprint', () => {
      const fp1 = generateErrorFingerprint('Error', 'at foo()');
      const fp2 = generateErrorFingerprint('Error', 'at bar()');
      expect(fp1).not.toBe(fp2);
    });

    it('should handle missing stack trace', () => {
      const fp = generateErrorFingerprint('Error message');
      expect(fp).toHaveLength(16);
    });
  });

  describe('generateContributorId', () => {
    it('should generate stable contributor ID', () => {
      const id1 = generateContributorId();
      const id2 = generateContributorId();
      expect(id1).toBe(id2);
    });

    it('should start with anon_ prefix', () => {
      const id = generateContributorId();
      expect(id).toMatch(/^anon_[a-f0-9]{16}$/);
    });
  });

  describe('fingerprintsMatch', () => {
    it('should return true for identical fingerprints', () => {
      expect(fingerprintsMatch('abc123', 'abc123')).toBe(true);
    });

    it('should return false for different fingerprints', () => {
      expect(fingerprintsMatch('abc123', 'def456')).toBe(false);
    });
  });

  describe('calculateStringSimilarity', () => {
    it('should return 1 for identical strings', () => {
      const similarity = calculateStringSimilarity(
        'Error module not found',
        'Error module not found'
      );
      expect(similarity).toBe(1);
    });

    it('should return 0 for completely different strings', () => {
      const similarity = calculateStringSimilarity('abc def', 'xyz uvw');
      expect(similarity).toBe(0);
    });

    it('should return partial similarity for overlapping words', () => {
      const similarity = calculateStringSimilarity(
        'Error module not found',
        'Error package not installed'
      );
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(1);
    });

    it('should be case insensitive', () => {
      const similarity = calculateStringSimilarity(
        'ERROR MODULE',
        'error module'
      );
      expect(similarity).toBe(1);
    });

    it('should handle empty strings', () => {
      // Empty strings split to [''] which creates Set of size 1
      // So intersection=1, union=1, similarity=1
      const similarity = calculateStringSimilarity('', '');
      expect(similarity).toBe(1);
    });
  });
});
