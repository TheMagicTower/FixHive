/**
 * FixHive Local Store
 * SQLite-based local storage for error records and caching
 */

import Database from 'better-sqlite3';
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
 * Local Store Class
 * Manages SQLite database for error records and caching
 */
export class LocalStore {
  private db: Database.Database;

  constructor(projectDirectory: string) {
    const dbPath = `${projectDirectory}/.fixhive/fixhive.db`;

    // Ensure directory exists
    const dir = dirname(dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Initialize database
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    // Run migrations
    runMigrations(this.db);
  }

  // ============ Error Records ============

  /**
   * Create a new error record
   */
  createErrorRecord(
    data: Omit<LocalErrorRecord, 'id' | 'errorHash' | 'status' | 'createdAt'>
  ): LocalErrorRecord {
    const id = uuidv4();
    const errorHash = generateErrorFingerprint(data.errorMessage, data.errorStack);

    const stmt = this.db.prepare(`
      INSERT INTO error_records (
        id, error_hash, error_type, error_message, error_stack,
        language, framework, tool_name, tool_input, session_id, status
      ) VALUES (
        @id, @errorHash, @errorType, @errorMessage, @errorStack,
        @language, @framework, @toolName, @toolInput, @sessionId, 'unresolved'
      )
    `);

    stmt.run({
      id,
      errorHash,
      errorType: data.errorType,
      errorMessage: data.errorMessage,
      errorStack: data.errorStack || null,
      language: data.language || null,
      framework: data.framework || null,
      toolName: data.toolName,
      toolInput: JSON.stringify(data.toolInput),
      sessionId: data.sessionId,
    });

    // Update stats
    this.incrementStat('total_errors');

    return this.getErrorById(id)!;
  }

  /**
   * Get error record by ID
   */
  getErrorById(id: string): LocalErrorRecord | null {
    const stmt = this.db.prepare('SELECT * FROM error_records WHERE id = ?');
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    return row ? this.rowToRecord(row) : null;
  }

  /**
   * Get errors by session
   */
  getSessionErrors(
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

    const stmt = this.db.prepare(query);
    return (stmt.all(...params) as Record<string, unknown>[]).map((row) => this.rowToRecord(row));
  }

  /**
   * Get unresolved errors for a session
   */
  getUnresolvedErrors(sessionId: string): LocalErrorRecord[] {
    return this.getSessionErrors(sessionId, { status: 'unresolved' });
  }

  /**
   * Get recent errors across all sessions
   */
  getRecentErrors(limit: number = 10): LocalErrorRecord[] {
    const stmt = this.db.prepare(
      'SELECT * FROM error_records ORDER BY created_at DESC LIMIT ?'
    );
    return (stmt.all(limit) as Record<string, unknown>[]).map((row) => this.rowToRecord(row));
  }

  /**
   * Mark error as resolved
   */
  markResolved(
    id: string,
    data: { resolution: string; resolutionCode?: string }
  ): LocalErrorRecord | null {
    const stmt = this.db.prepare(`
      UPDATE error_records
      SET status = 'resolved',
          resolution = ?,
          resolution_code = ?,
          resolved_at = datetime('now')
      WHERE id = ?
    `);

    const result = stmt.run(data.resolution, data.resolutionCode || null, id);

    if (result.changes > 0) {
      this.incrementStat('resolved_errors');
      return this.getErrorById(id);
    }

    return null;
  }

  /**
   * Mark error as uploaded to cloud
   */
  markUploaded(id: string, cloudKnowledgeId: string): void {
    const stmt = this.db.prepare(`
      UPDATE error_records
      SET status = 'uploaded',
          cloud_knowledge_id = ?,
          uploaded_at = datetime('now')
      WHERE id = ?
    `);

    const result = stmt.run(cloudKnowledgeId, id);

    if (result.changes > 0) {
      this.incrementStat('uploaded_errors');
    }
  }

  /**
   * Find similar errors by hash
   */
  findSimilarErrors(errorHash: string): LocalErrorRecord[] {
    const stmt = this.db.prepare(
      'SELECT * FROM error_records WHERE error_hash = ? ORDER BY created_at DESC'
    );
    return (stmt.all(errorHash) as Record<string, unknown>[]).map((row) => this.rowToRecord(row));
  }

  // ============ Query Cache ============

  /**
   * Get cached query results
   */
  getCachedResults(errorHash: string): CloudKnowledgeEntry[] | null {
    const stmt = this.db.prepare(`
      SELECT results FROM query_cache
      WHERE error_hash = ? AND expires_at > datetime('now')
      ORDER BY created_at DESC LIMIT 1
    `);

    const row = stmt.get(errorHash) as { results: string } | undefined;
    if (row) {
      return JSON.parse(row.results);
    }
    return null;
  }

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

    const stmt = this.db.prepare(`
      INSERT INTO query_cache (id, error_hash, results, expires_at)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(id, errorHash, JSON.stringify(results), expiresAt);

    // Update stats
    this.incrementStat('queries_made');
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): number {
    const stmt = this.db.prepare("DELETE FROM query_cache WHERE expires_at <= datetime('now')");
    const result = stmt.run();
    return result.changes;
  }

  // ============ Statistics ============

  /**
   * Get usage statistics
   */
  getStats(): LocalStats {
    const stmt = this.db.prepare(
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
  }

  /**
   * Allowed stat column names for incrementStat (whitelist to prevent SQL injection)
   */
  private static readonly ALLOWED_STATS = [
    'total_errors',
    'resolved_errors',
    'uploaded_errors',
    'queries_made',
  ] as const;

  /**
   * Increment a stat counter
   * @throws Error if stat name is not in the allowed whitelist
   */
  private incrementStat(stat: string): void {
    // Validate stat name against whitelist to prevent SQL injection
    if (!LocalStore.ALLOWED_STATS.includes(stat as (typeof LocalStore.ALLOWED_STATS)[number])) {
      throw new Error(`Invalid stat name: ${stat}. Allowed: ${LocalStore.ALLOWED_STATS.join(', ')}`);
    }
    const stmt = this.db.prepare(`UPDATE usage_stats SET ${stat} = ${stat} + 1 WHERE id = 1`);
    stmt.run();
  }

  // ============ Preferences ============

  /**
   * Get preference value
   */
  getPreference(key: string): string | null {
    const stmt = this.db.prepare('SELECT value FROM user_preferences WHERE key = ?');
    const row = stmt.get(key) as { value: string } | undefined;
    return row?.value || null;
  }

  /**
   * Set preference value
   */
  setPreference(key: string, value: string): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO user_preferences (key, value) VALUES (?, ?)
    `);
    stmt.run(key, value);
  }

  // ============ Utilities ============

  /**
   * Convert database row to LocalErrorRecord
   */
  private rowToRecord(row: Record<string, unknown>): LocalErrorRecord {
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
   * Close database connection
   */
  close(): void {
    this.db.close();
  }

  /**
   * Get database for advanced queries
   */
  getDatabase(): Database.Database {
    return this.db;
  }
}
