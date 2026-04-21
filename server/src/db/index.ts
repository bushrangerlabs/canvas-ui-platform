import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { config } from '../config';

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialised — call initDb() first');
  return db;
}

export function initDb(): Database.Database {
  // Ensure data directory exists
  const dir = path.dirname(config.dbPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(config.imagesDir, { recursive: true });

  db = new Database(config.dbPath);

  // Performance settings
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  db.pragma('temp_store = MEMORY');

  runMigrations(db);

  return db;
}

function runMigrations(db: Database.Database): void {
  // Create migrations tracking table if not exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const getCurrentVersion = db.prepare(
    'SELECT COALESCE(MAX(version), 0) as version FROM schema_migrations'
  );
  const { version: currentVersion } = getCurrentVersion.get() as { version: number };

  const pending = migrations.filter(m => m.version > currentVersion);
  if (pending.length === 0) {
    console.log(`[db] Schema at version ${currentVersion} — no migrations needed`);
    return;
  }

  for (const migration of pending) {
    console.log(`[db] Applying migration v${migration.version}: ${migration.name}`);
    db.transaction(() => {
      migration.up(db);
      db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(migration.version);
    })();
  }

  const { version: newVersion } = getCurrentVersion.get() as { version: number };
  console.log(`[db] Schema now at version ${newVersion}`);
}

// ─── Migrations ───────────────────────────────────────────────────────────────
// Add new migrations to the END of this array. Never modify existing ones.

const migrations: Array<{
  version: number;
  name: string;
  up: (db: Database.Database) => void;
}> = [
  {
    version: 1,
    name: 'initial schema',
    up: (db) => {
      db.exec(`
        CREATE TABLE views (
          id          TEXT PRIMARY KEY,
          name        TEXT NOT NULL,
          description TEXT,
          width       INTEGER NOT NULL DEFAULT 1920,
          height      INTEGER NOT NULL DEFAULT 1080,
          background  TEXT,
          widgets     TEXT NOT NULL DEFAULT '[]',
          tags        TEXT NOT NULL DEFAULT '[]',
          created_at  TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE devices (
          id              TEXT PRIMARY KEY,
          name            TEXT NOT NULL,
          platform        TEXT NOT NULL DEFAULT 'unknown',
          description     TEXT,
          default_view_id TEXT,
          last_seen       TEXT,
          current_view_id TEXT,
          screen_on       INTEGER NOT NULL DEFAULT 1,
          brightness      INTEGER NOT NULL DEFAULT 100,
          app_version     TEXT,
          ip_address      TEXT,
          created_at      TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE device_views (
          device_id   TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
          view_id     TEXT NOT NULL REFERENCES views(id) ON DELETE CASCADE,
          sort_order  INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (device_id, view_id)
        );

        CREATE TABLE data_sources (
          id         TEXT PRIMARY KEY,
          name       TEXT NOT NULL,
          type       TEXT NOT NULL DEFAULT 'homeassistant',
          url        TEXT NOT NULL,
          token      TEXT,
          enabled    INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE commands (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          device_id       TEXT NOT NULL,
          action          TEXT NOT NULL,
          payload         TEXT NOT NULL DEFAULT '{}',
          source          TEXT NOT NULL DEFAULT 'api',
          sent_at         TEXT NOT NULL DEFAULT (datetime('now')),
          acknowledged_at TEXT
        );

        CREATE TABLE images (
          id         TEXT PRIMARY KEY,
          filename   TEXT NOT NULL,
          mime_type  TEXT NOT NULL,
          size_bytes INTEGER,
          url_path   TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE server_settings (
          key        TEXT PRIMARY KEY,
          value      TEXT NOT NULL,
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX idx_commands_device_id ON commands(device_id);
        CREATE INDEX idx_commands_sent_at   ON commands(sent_at);
        CREATE INDEX idx_views_updated_at   ON views(updated_at);
      `);
    },
  },
];
