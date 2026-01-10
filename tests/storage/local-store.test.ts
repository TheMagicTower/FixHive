import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createLocalStore, type LocalStore } from '../../src/storage/local-store.js';
import { rmSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('LocalStore', () => {
  let store: LocalStore;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'fixhive-test-'));
    store = await createLocalStore(tempDir);
  });

  afterEach(() => {
    store.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Error Records', () => {
    it('should create an error record', () => {
      const record = store.createErrorRecord({
        errorType: 'runtime',
        errorMessage: 'TypeError: Cannot read property',
        toolName: 'bash',
        toolInput: { command: 'npm test' },
        sessionId: 'session-123',
      });

      expect(record.id).toBeDefined();
      expect(record.errorHash).toBeDefined();
      expect(record.errorHash).toHaveLength(16);
      expect(record.errorType).toBe('runtime');
      expect(record.errorMessage).toBe('TypeError: Cannot read property');
      expect(record.status).toBe('unresolved');
    });

    it('should get error by ID', () => {
      const created = store.createErrorRecord({
        errorType: 'build',
        errorMessage: 'error TS2339',
        toolName: 'tsc',
        toolInput: {},
        sessionId: 'session-123',
      });

      const retrieved = store.getErrorById(created.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.errorMessage).toBe('error TS2339');
    });

    it('should return null for non-existent ID', () => {
      const result = store.getErrorById('non-existent-id');
      expect(result).toBeNull();
    });

    it('should get session errors', () => {
      const sessionId = 'test-session';

      store.createErrorRecord({
        errorType: 'runtime',
        errorMessage: 'Error 1',
        toolName: 'node',
        toolInput: {},
        sessionId,
      });

      store.createErrorRecord({
        errorType: 'build',
        errorMessage: 'Error 2',
        toolName: 'tsc',
        toolInput: {},
        sessionId,
      });

      store.createErrorRecord({
        errorType: 'runtime',
        errorMessage: 'Error 3',
        toolName: 'node',
        toolInput: {},
        sessionId: 'other-session',
      });

      const errors = store.getSessionErrors(sessionId);
      expect(errors).toHaveLength(2);
    });

    it('should filter session errors by status', () => {
      const sessionId = 'test-session';

      const record1 = store.createErrorRecord({
        errorType: 'runtime',
        errorMessage: 'Error 1',
        toolName: 'node',
        toolInput: {},
        sessionId,
      });

      store.createErrorRecord({
        errorType: 'runtime',
        errorMessage: 'Error 2',
        toolName: 'node',
        toolInput: {},
        sessionId,
      });

      store.markResolved(record1.id, { resolution: 'Fixed' });

      const unresolved = store.getUnresolvedErrors(sessionId);
      expect(unresolved).toHaveLength(1);
      expect(unresolved[0].errorMessage).toBe('Error 2');
    });

    it('should limit session errors', () => {
      const sessionId = 'test-session';

      for (let i = 0; i < 5; i++) {
        store.createErrorRecord({
          errorType: 'runtime',
          errorMessage: `Error ${i}`,
          toolName: 'node',
          toolInput: {},
          sessionId,
        });
      }

      const limited = store.getSessionErrors(sessionId, { limit: 3 });
      expect(limited).toHaveLength(3);
    });

    it('should get recent errors across sessions', () => {
      for (let i = 0; i < 15; i++) {
        store.createErrorRecord({
          errorType: 'runtime',
          errorMessage: `Error ${i}`,
          toolName: 'node',
          toolInput: {},
          sessionId: `session-${i}`,
        });
      }

      const recent = store.getRecentErrors(10);
      expect(recent).toHaveLength(10);
    });

    it('should mark error as resolved', () => {
      const record = store.createErrorRecord({
        errorType: 'runtime',
        errorMessage: 'TypeError',
        toolName: 'node',
        toolInput: {},
        sessionId: 'session-123',
      });

      const resolved = store.markResolved(record.id, {
        resolution: 'Added null check',
        resolutionCode: 'if (x != null) { ... }',
      });

      expect(resolved).not.toBeNull();
      expect(resolved!.status).toBe('resolved');
      expect(resolved!.resolution).toBe('Added null check');
      expect(resolved!.resolutionCode).toBe('if (x != null) { ... }');
      expect(resolved!.resolvedAt).toBeDefined();
    });

    it('should mark error as uploaded', () => {
      const record = store.createErrorRecord({
        errorType: 'runtime',
        errorMessage: 'TypeError',
        toolName: 'node',
        toolInput: {},
        sessionId: 'session-123',
      });

      store.markResolved(record.id, { resolution: 'Fixed' });
      store.markUploaded(record.id, 'cloud-knowledge-id-123');

      const updated = store.getErrorById(record.id);
      expect(updated!.status).toBe('uploaded');
      expect(updated!.cloudKnowledgeId).toBe('cloud-knowledge-id-123');
      expect(updated!.uploadedAt).toBeDefined();
    });

    it('should find similar errors by hash', () => {
      // Create two errors with same message (same hash)
      store.createErrorRecord({
        errorType: 'runtime',
        errorMessage: 'TypeError: Cannot read property',
        toolName: 'node',
        toolInput: {},
        sessionId: 'session-1',
      });

      store.createErrorRecord({
        errorType: 'runtime',
        errorMessage: 'TypeError: Cannot read property',
        toolName: 'node',
        toolInput: {},
        sessionId: 'session-2',
      });

      // Create different error
      store.createErrorRecord({
        errorType: 'build',
        errorMessage: 'Different error',
        toolName: 'tsc',
        toolInput: {},
        sessionId: 'session-3',
      });

      const firstRecord = store.getRecentErrors(3)[0];
      const similar = store.findSimilarErrors(firstRecord.errorHash);

      // Should find errors with same hash
      expect(similar.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Query Cache', () => {
    it('should cache and retrieve results', () => {
      const errorHash = 'test-hash-123';
      const results = [
        {
          id: 'knowledge-1',
          errorMessage: 'Error',
          resolutionDescription: 'Fix it',
          language: 'javascript',
          upvotes: 5,
          usageCount: 10,
          createdAt: new Date().toISOString(),
        },
      ];

      store.cacheResults(errorHash, results);
      const cached = store.getCachedResults(errorHash);

      expect(cached).not.toBeNull();
      expect(cached).toHaveLength(1);
      expect(cached![0].id).toBe('knowledge-1');
    });

    it('should return null for non-existent cache', () => {
      const cached = store.getCachedResults('non-existent-hash');
      expect(cached).toBeNull();
    });

    it('should expire cache based on expiration time', () => {
      // Insert expired entry directly via database using SQLite datetime format
      const db = store.getDatabase();
      // Use SQLite's datetime function for past date
      db.prepare(`
        INSERT INTO query_cache (id, error_hash, results, expires_at)
        VALUES (?, ?, ?, datetime('now', '-1 hour'))
      `).run('expired-id', 'expired-hash', JSON.stringify([{ id: '1' }]));

      const cached = store.getCachedResults('expired-hash');
      expect(cached).toBeNull();
    });

    it('should clear expired cache entries', () => {
      // Insert expired entry directly using SQLite datetime
      const db = store.getDatabase();
      db.prepare(`
        INSERT INTO query_cache (id, error_hash, results, expires_at)
        VALUES (?, ?, ?, datetime('now', '-1 hour'))
      `).run('expired-id', 'expired-hash', JSON.stringify([{ id: '1' }]));

      // Create valid entry
      store.cacheResults('valid', [{ id: '2' }] as any, 3600000);

      const cleared = store.clearExpiredCache();
      expect(cleared).toBeGreaterThanOrEqual(1);

      // Valid entry should still exist
      const valid = store.getCachedResults('valid');
      expect(valid).not.toBeNull();
    });
  });

  describe('Statistics', () => {
    it('should track total errors', () => {
      const statsBefore = store.getStats();
      const initialTotal = statsBefore.totalErrors;

      store.createErrorRecord({
        errorType: 'runtime',
        errorMessage: 'Error',
        toolName: 'node',
        toolInput: {},
        sessionId: 'session',
      });

      const statsAfter = store.getStats();
      expect(statsAfter.totalErrors).toBe(initialTotal + 1);
    });

    it('should track resolved errors', () => {
      const record = store.createErrorRecord({
        errorType: 'runtime',
        errorMessage: 'Error',
        toolName: 'node',
        toolInput: {},
        sessionId: 'session',
      });

      const statsBefore = store.getStats();
      const initialResolved = statsBefore.resolvedErrors;

      store.markResolved(record.id, { resolution: 'Fixed' });

      const statsAfter = store.getStats();
      expect(statsAfter.resolvedErrors).toBe(initialResolved + 1);
    });

    it('should track uploaded errors', () => {
      const record = store.createErrorRecord({
        errorType: 'runtime',
        errorMessage: 'Error',
        toolName: 'node',
        toolInput: {},
        sessionId: 'session',
      });

      const statsBefore = store.getStats();
      const initialUploaded = statsBefore.uploadedErrors;

      store.markResolved(record.id, { resolution: 'Fixed' });
      store.markUploaded(record.id, 'cloud-id');

      const statsAfter = store.getStats();
      expect(statsAfter.uploadedErrors).toBe(initialUploaded + 1);
    });
  });

  describe('Preferences', () => {
    it('should set and get preferences', () => {
      store.setPreference('theme', 'dark');
      const value = store.getPreference('theme');
      expect(value).toBe('dark');
    });

    it('should return null for non-existent preference', () => {
      const value = store.getPreference('non-existent');
      expect(value).toBeNull();
    });

    it('should update existing preference', () => {
      store.setPreference('theme', 'light');
      store.setPreference('theme', 'dark');
      const value = store.getPreference('theme');
      expect(value).toBe('dark');
    });
  });

  describe('Database Management', () => {
    it('should close database connection', () => {
      store.close();
      // Accessing after close should throw
      expect(() => store.getStats()).toThrow();
    });

    it('should provide database access', () => {
      const db = store.getDatabase();
      expect(db).toBeDefined();
    });
  });

  describe('Error Record Fields', () => {
    it('should store optional fields', () => {
      const record = store.createErrorRecord({
        errorType: 'runtime',
        errorMessage: 'Error',
        errorStack: 'at foo()\nat bar()',
        language: 'javascript',
        framework: 'react',
        toolName: 'node',
        toolInput: { file: 'test.js' },
        sessionId: 'session',
      });

      const retrieved = store.getErrorById(record.id);
      expect(retrieved!.errorStack).toBe('at foo()\nat bar()');
      expect(retrieved!.language).toBe('javascript');
      expect(retrieved!.framework).toBe('react');
      expect(retrieved!.toolInput).toEqual({ file: 'test.js' });
    });

    it('should handle missing optional fields', () => {
      const record = store.createErrorRecord({
        errorType: 'unknown',
        errorMessage: 'Error',
        toolName: 'bash',
        toolInput: {},
        sessionId: 'session',
      });

      const retrieved = store.getErrorById(record.id);
      expect(retrieved!.errorStack).toBeUndefined();
      expect(retrieved!.language).toBeUndefined();
      expect(retrieved!.framework).toBeUndefined();
    });
  });
});
