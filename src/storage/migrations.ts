/**
 * FixHive Database Migrations
 * SQLite schema setup and migrations
 */

import type Database from 'better-sqlite3';

/**
 * Run all migrations on the database
 */
export function runMigrations(db: Database.Database): void {
  // Create migrations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Get applied migrations
  const appliedMigrations = new Set(
    (db.prepare('SELECT name FROM migrations').all() as { name: string }[]).map((r) => r.name)
  );

  // Run pending migrations
  for (const migration of MIGRATIONS) {
    if (!appliedMigrations.has(migration.name)) {
      db.exec(migration.sql);
      db.prepare('INSERT INTO migrations (name) VALUES (?)').run(migration.name);
    }
  }
}

/**
 * Migration definitions
 */
const MIGRATIONS = [
  {
    name: '001_initial_schema',
    sql: `
      -- Error records table
      CREATE TABLE IF NOT EXISTS error_records (
        id TEXT PRIMARY KEY,
        error_hash TEXT NOT NULL,
        error_type TEXT NOT NULL,
        error_message TEXT NOT NULL,
        error_stack TEXT,
        language TEXT,
        framework TEXT,
        tool_name TEXT NOT NULL,
        tool_input TEXT NOT NULL DEFAULT '{}',
        session_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'unresolved',
        resolution TEXT,
        resolution_code TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        resolved_at TEXT,
        uploaded_at TEXT,
        cloud_knowledge_id TEXT
      );

      -- Indexes for error_records
      CREATE INDEX IF NOT EXISTS idx_error_records_hash ON error_records(error_hash);
      CREATE INDEX IF NOT EXISTS idx_error_records_status ON error_records(status);
      CREATE INDEX IF NOT EXISTS idx_error_records_session ON error_records(session_id);
      CREATE INDEX IF NOT EXISTS idx_error_records_created ON error_records(created_at);

      -- Query cache table
      CREATE TABLE IF NOT EXISTS query_cache (
        id TEXT PRIMARY KEY,
        error_hash TEXT NOT NULL,
        results TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at TEXT NOT NULL
      );

      -- Indexes for query_cache
      CREATE INDEX IF NOT EXISTS idx_query_cache_hash ON query_cache(error_hash);
      CREATE INDEX IF NOT EXISTS idx_query_cache_expires ON query_cache(expires_at);

      -- User preferences table
      CREATE TABLE IF NOT EXISTS user_preferences (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      -- Usage statistics table
      CREATE TABLE IF NOT EXISTS usage_stats (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        total_errors INTEGER NOT NULL DEFAULT 0,
        resolved_errors INTEGER NOT NULL DEFAULT 0,
        uploaded_errors INTEGER NOT NULL DEFAULT 0,
        queries_made INTEGER NOT NULL DEFAULT 0,
        last_sync TEXT
      );

      -- Initialize usage stats
      INSERT OR IGNORE INTO usage_stats (id) VALUES (1);
    `,
  },
  {
    name: '002_add_confidence_score',
    sql: `
      ALTER TABLE error_records ADD COLUMN confidence REAL DEFAULT 0;
      ALTER TABLE error_records ADD COLUMN severity TEXT DEFAULT 'error';
    `,
  },
];
