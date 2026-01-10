/**
 * FixHive Local Store
 * SQLite-based local storage for error records and caching
 * Automatically uses bun:sqlite for Bun runtime, better-sqlite3 for Node.js
 */

import { v4 as uuidv4 } from 'uuid';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import type {
  LocalErrorRecord,
  ErrorStatus,
  LocalStats,
  CloudKnowledgeEntry,
} from '../types/index.js';
import { generateErrorFingerprint } from '../core/hash.js';
import { runMigrations } from './migrations.js';

/**
 * Detect if running in Bun runtime
 */
declare const Bun: unknown;
const isBun = typeof Bun !== 'undefined';

/**
 * Unified database interface for both Bun and Node.js
 */
interface UnifiedDatabase {
  exec(sql: string): void;
  prepare(sql: string): UnifiedStatement;
  close(): void;
}

interface UnifiedStatement {
  run(...params: unknown[]): { changes: number };
  get(...params: unknown[]): Record<string, unknown> | undefined;
  all(...params: unknown[]): Record<string, unknown>[];
}

/**
 * Create a database instance using the appropriate SQLite implementation
 */
async function createDatabase(dbPath: string): Promise<UnifiedDatabase> {
  if (isBun) {
    // Use bun:sqlite
    const { Database } = await import('bun:sqlite');
    const db = new Database(dbPath, { create: true });

    return {
      exec: (sql: string) => db.exec(sql),
      prepare: (sql: string) => {
        const stmt = db.prepare(sql);
        return {
          run: (...params: unknown[]) => {
            stmt.run(...params);
            return { changes: db.changes };
          },
          get: (...params: unknown[]) => stmt.get(...params) as Record<string, unknown> | undefined,
          all: (...params: unknown[]) => stmt.all(...params) as Record<string, unknown>[],
        };
      },
      close: () => db.close(),
    };
  } else {
    // Use better-sqlite3 for Node.js
    const BetterSqlite3 = (await import('better-sqlite3')).default;
    const db = new BetterSqlite3(dbPath);

    return {
      exec: (sql: string) => db.exec(sql),
      prepare: (sql: string) => {
        const stmt = db.prepare(sql);
        return {
          run: (...params: unknown[]) => {
            const result = stmt.run(...params);
            return { changes: result.changes };
          },
          get: (...params: unknown[]) => stmt.get(...params) as Record<string, unknown> | undefined,
          all: (...params: unknown[]) => stmt.all(...params) as Record<string, unknown>[],
        };
      },
      close: () => db.close(),
    };
  }
}

/**
 * Allowed stat column names for incrementStat (whitelist to prevent SQL injection)
 */
const ALLOWED_STATS = [
  'total_errors',
  'resolved_errors',
  'uploaded_errors',
  'queries_made',
] as const;

/**
 * LocalStore interface - defines all public methods
 */
export interface LocalStore {
  createErrorRecord(data: Omit<LocalErrorRecord, 'id' | 'errorHash' | 'status' | 'createdAt'>): LocalErrorRecord;
  getErrorById(id: string): LocalErrorRecord | null;
  getSessionErrors(sessionId: string, options?: { status?: ErrorStatus; limit?: number }): LocalErrorRecord[];
  getUnresolvedErrors(sessionId: string): LocalErrorRecord[];
  getRecentErrors(limit?: number): LocalErrorRecord[];
  markResolved(id: string, data: { resolution: string; resolutionCode?: string }): LocalErrorRecord | null;
  markUploaded(id: string, cloudKnowledgeId: string): void;
  findSimilarErrors(errorHash: string): LocalErrorRecord[];
  getCachedResults(errorHash: string): CloudKnowledgeEntry[] | null;
  cacheResults(errorHash: string, results: CloudKnowledgeEntry[], expirationMs?: number): void;
  clearExpiredCache(): number;
  getStats(): LocalStats;
  getPreference(key: string): string | null;
  setPreference(key: string, value: string): void;
  close(): void;
  getDatabase(): UnifiedDatabase;
}

/**
 * Convert database row to LocalErrorRecord
 */
function rowToRecord(row: Record<string, unknown>): LocalErrorRecord {
  return {
    id: row.id as string,
    errorHash: row.error_hash as string,
    errorType: row.error_type as LocalErrorRecord['errorType'],
    errorMessage: row.error_message as string,
    errorStack: (row.error_stack as string) || undefined,
    language: (row.language as LocalErrorRecord['language']) || undefined,
    framework: (row.framework as string) || undefined,
    toolName: row.tool_name as string,
    toolInput: JSON.parse((row.tool_input as string) || '{}'),
    sessionId: row.session_id as string,
    status: row.status as ErrorStatus,
    resolution: (row.resolution as string) || undefined,
    resolutionCode: (row.resolution_code as string) || undefined,
    createdAt: row.created_at as string,
    resolvedAt: (row.resolved_at as string) || undefined,
    uploadedAt: (row.uploaded_at as string) || undefined,
    cloudKnowledgeId: (row.cloud_knowledge_id as string) || undefined,
  };
}

/**
 * Create a LocalStore instance
 * Factory function pattern to avoid ES6 class issues with Bun
 * Automatically uses bun:sqlite for Bun runtime, better-sqlite3 for Node.js
 */
export async function createLocalStore(projectDirectory: string): Promise<LocalStore> {
  const dbPath = `${projectDirectory}/.fixhive/fixhive.db`;

  // Ensure directory exists
  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // Initialize database (bun:sqlite or better-sqlite3 based on runtime)
  const db = await createDatabase(dbPath);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');

  // Run migrations
  runMigrations(db);

  /**
   * Increment a stat counter
   * @throws Error if stat name is not in the allowed whitelist
   */
  function incrementStat(stat: string): void {
    // Validate stat name against whitelist to prevent SQL injection
    if (!ALLOWED_STATS.includes(stat as (typeof ALLOWED_STATS)[number])) {
      throw new Error(`Invalid stat name: ${stat}. Allowed: ${ALLOWED_STATS.join(', ')}`);
    }
    const stmt = db.prepare(`UPDATE usage_stats SET ${stat} = ${stat} + 1 WHERE id = 1`);
    stmt.run();
  }

  // Define helper functions to avoid `this` issues in async context
  function getErrorById(id: string): LocalErrorRecord | null {
    const stmt = db.prepare('SELECT * FROM error_records WHERE id = ?');
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    return row ? rowToRecord(row) : null;
  }

  function getSessionErrors(
    sessionId: string,
    options?: { status?: ErrorStatus; limit?: number }
  ): LocalErrorRecord[] {
    let query = 'SELECT * FROM error_records WHERE session_id = ?';
    const params: (string | number)[] = [sessionId];

    if (options?.status) {
      query += ' AND status = ?';
      params.push(options.status);
    }

    query += ' ORDER BY created_at DESC';

    if (options?.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }

    const stmt = db.prepare(query);
    return (stmt.all(...params) as Record<string, unknown>[]).map((row) => rowToRecord(row));
  }

  return {
    // ============ Error Records ============

    /**
     * Create a new error record
     */
    createErrorRecord(
      data: Omit<LocalErrorRecord, 'id' | 'errorHash' | 'status' | 'createdAt'>
    ): LocalErrorRecord {
      const id = uuidv4();
      const errorHash = generateErrorFingerprint(data.errorMessage, data.errorStack);

      const stmt = db.prepare(`
        INSERT INTO error_records (
          id, error_hash, error_type, error_message, error_stack,
          language, framework, tool_name, tool_input, session_id, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unresolved')
      `);

      stmt.run(
        id,
        errorHash,
        data.errorType,
        data.errorMessage,
        data.errorStack || null,
        data.language || null,
        data.framework || null,
        data.toolName,
        JSON.stringify(data.toolInput),
        data.sessionId
      );

      // Update stats
      incrementStat('total_errors');

      return getErrorById(id)!;
    },

    getErrorById,
    getSessionErrors,

    /**
     * Get unresolved errors for a session
     */
    getUnresolvedErrors(sessionId: string): LocalErrorRecord[] {
      return getSessionErrors(sessionId, { status: 'unresolved' });
    },

    /**
     * Get recent errors across all sessions
     */
    getRecentErrors(limit: number = 10): LocalErrorRecord[] {
      const stmt = db.prepare(
        'SELECT * FROM error_records ORDER BY created_at DESC LIMIT ?'
      );
      return (stmt.all(limit) as Record<string, unknown>[]).map((row) => rowToRecord(row));
    },

    /**
     * Mark error as resolved
     */
    markResolved(
      id: string,
      data: { resolution: string; resolutionCode?: string }
    ): LocalErrorRecord | null {
      const stmt = db.prepare(`
        UPDATE error_records
        SET status = 'resolved',
            resolution = ?,
            resolution_code = ?,
            resolved_at = datetime('now')
        WHERE id = ?
      `);

      const result = stmt.run(data.resolution, data.resolutionCode || null, id);

      if (result.changes > 0) {
        incrementStat('resolved_errors');
        return getErrorById(id);
      }

      return null;
    },

    /**
     * Mark error as uploaded to cloud
     */
    markUploaded(id: string, cloudKnowledgeId: string): void {
      const stmt = db.prepare(`
        UPDATE error_records
        SET status = 'uploaded',
            cloud_knowledge_id = ?,
            uploaded_at = datetime('now')
        WHERE id = ?
      `);

      const result = stmt.run(cloudKnowledgeId, id);

      if (result.changes > 0) {
        incrementStat('uploaded_errors');
      }
    },

    /**
     * Find similar errors by hash
     */
    findSimilarErrors(errorHash: string): LocalErrorRecord[] {
      const stmt = db.prepare(
        'SELECT * FROM error_records WHERE error_hash = ? ORDER BY created_at DESC'
      );
      return (stmt.all(errorHash) as Record<string, unknown>[]).map((row) => rowToRecord(row));
    },

    // ============ Query Cache ============

    /**
     * Get cached query results
     */
    getCachedResults(errorHash: string): CloudKnowledgeEntry[] | null {
      const stmt = db.prepare(`
        SELECT results FROM query_cache
        WHERE error_hash = ? AND expires_at > datetime('now')
        ORDER BY created_at DESC LIMIT 1
      `);

      const row = stmt.get(errorHash) as { results: string } | undefined;
      if (row) {
        return JSON.parse(row.results);
      }
      return null;
    },

    /**
     * Cache query results
     */
    cacheResults(
      errorHash: string,
      results: CloudKnowledgeEntry[],
      expirationMs: number = 3600000 // 1 hour default
    ): void {
      const id = uuidv4();
      const expiresAt = new Date(Date.now() + expirationMs).toISOString();

      const stmt = db.prepare(`
        INSERT INTO query_cache (id, error_hash, results, expires_at)
        VALUES (?, ?, ?, ?)
      `);

      stmt.run(id, errorHash, JSON.stringify(results), expiresAt);

      // Update stats
      incrementStat('queries_made');
    },

    /**
     * Clear expired cache entries
     */
    clearExpiredCache(): number {
      const stmt = db.prepare("DELETE FROM query_cache WHERE expires_at <= datetime('now')");
      const result = stmt.run();
      return result.changes;
    },

    // ============ Statistics ============

    /**
     * Get usage statistics
     */
    getStats(): LocalStats {
      const stmt = db.prepare(
        'SELECT total_errors, resolved_errors, uploaded_errors FROM usage_stats WHERE id = 1'
      );
      const row = stmt.get() as {
        total_errors: number;
        resolved_errors: number;
        uploaded_errors: number;
      };

      return {
        totalErrors: row.total_errors,
        resolvedErrors: row.resolved_errors,
        uploadedErrors: row.uploaded_errors,
      };
    },

    // ============ Preferences ============

    /**
     * Get preference value
     */
    getPreference(key: string): string | null {
      const stmt = db.prepare('SELECT value FROM user_preferences WHERE key = ?');
      const row = stmt.get(key) as { value: string } | undefined;
      return row?.value || null;
    },

    /**
     * Set preference value
     */
    setPreference(key: string, value: string): void {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO user_preferences (key, value) VALUES (?, ?)
      `);
      stmt.run(key, value);
    },

    // ============ Utilities ============

    /**
     * Close database connection
     */
    close(): void {
      db.close();
    },

    /**
     * Get database for advanced queries
     */
    getDatabase(): UnifiedDatabase {
      return db;
    },
  };
}

/**
 * Legacy class wrapper for backwards compatibility
 * @deprecated Use createLocalStore() instead
 */
export const LocalStore = {
  create: createLocalStore,
};
