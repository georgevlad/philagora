import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { beforeEach, describe, expect, it } from "vitest";

import {
  ensureMetaTable,
  getSchemaVersion,
  MIGRATIONS,
  runMigrations,
  setSchemaVersion,
} from "./migrations";

/**
 * Create a fresh in-memory SQLite database with the base schema applied.
 * This simulates a brand-new Philagora database before any migrations.
 */
function createFreshDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  const schemaPath = path.join(process.cwd(), "db", "schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf-8");

  const statements = schema
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0 && !statement.startsWith("PRAGMA"));

  for (const statement of statements) {
    db.exec(statement + ";");
  }

  return db;
}

describe("migration system", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createFreshDb();
  });

  describe("version tracking", () => {
    it("creates _schema_meta table if it does not exist", () => {
      ensureMetaTable(db);
      const table = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='_schema_meta'")
        .get();

      expect(table).toBeTruthy();
    });

    it("returns version 0 for a fresh database", () => {
      expect(getSchemaVersion(db)).toBe(0);
    });

    it("stores and retrieves a version number", () => {
      ensureMetaTable(db);
      setSchemaVersion(db, 5);

      expect(getSchemaVersion(db)).toBe(5);
    });

    it("overwrites the version on subsequent calls", () => {
      ensureMetaTable(db);
      setSchemaVersion(db, 1);
      setSchemaVersion(db, 3);

      expect(getSchemaVersion(db)).toBe(3);
    });
  });

  describe("migration registry", () => {
    it("has sequential version numbers starting at 1", () => {
      for (let i = 0; i < MIGRATIONS.length; i += 1) {
        expect(MIGRATIONS[i].version).toBe(i + 1);
      }
    });

    it("has unique version numbers", () => {
      const versions = MIGRATIONS.map((migration) => migration.version);

      expect(new Set(versions).size).toBe(versions.length);
    });

    it("has non-empty names for all migrations", () => {
      for (const migration of MIGRATIONS) {
        expect(migration.name.length).toBeGreaterThan(0);
      }
    });
  });

  describe("runMigrations", () => {
    it("applies all migrations on a fresh database", () => {
      expect(getSchemaVersion(db)).toBe(0);

      runMigrations(db, { bootstrapNewsSources: true });

      expect(getSchemaVersion(db)).toBe(MIGRATIONS.length);
    });

    it("is idempotent - running twice does not error", () => {
      runMigrations(db, { bootstrapNewsSources: true });
      const versionAfterFirst = getSchemaVersion(db);

      runMigrations(db, { bootstrapNewsSources: false });
      const versionAfterSecond = getSchemaVersion(db);

      expect(versionAfterSecond).toBe(versionAfterFirst);
    });

    it("skips already-applied migrations", () => {
      ensureMetaTable(db);
      setSchemaVersion(db, MIGRATIONS.length);

      runMigrations(db);

      expect(getSchemaVersion(db)).toBe(MIGRATIONS.length);
    });

    it("creates expected tables after legacy migration", () => {
      runMigrations(db, { bootstrapNewsSources: true });

      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        .all() as Array<{ name: string }>;
      const tableNames = tables.map((table) => table.name);

      expect(tableNames).toContain("philosophers");
      expect(tableNames).toContain("posts");
      expect(tableNames).toContain("debates");
      expect(tableNames).toContain("agora_threads");
      expect(tableNames).toContain("agora_synthesis_v2");

      expect(tableNames).toContain("news_sources");
      expect(tableNames).toContain("article_candidates");
      expect(tableNames).toContain("scoring_config");
      expect(tableNames).toContain("mood_palettes");
      expect(tableNames).toContain("content_templates");
      expect(tableNames).toContain("house_rules");
      expect(tableNames).toContain("historical_events");
      expect(tableNames).toContain("api_call_log");

      expect(tableNames).toContain("_schema_meta");
    });

    it("adds expected columns to posts table after legacy migration", () => {
      runMigrations(db, { bootstrapNewsSources: true });

      const columns = db.prepare("PRAGMA table_info(posts)").all() as Array<{ name: string }>;
      const colNames = columns.map((column) => column.name);

      expect(colNames).toContain("source_type");
      expect(colNames).toContain("historical_event_id");
      expect(colNames).toContain("recommendation_title");
      expect(colNames).toContain("recommendation_author");
      expect(colNames).toContain("recommendation_medium");
    });

    it("creates the posts status-created_at composite index", () => {
      runMigrations(db, { bootstrapNewsSources: true });

      const indexes = db.prepare("PRAGMA index_list(posts)").all() as Array<{ name: string }>;
      const indexNames = indexes.map((index) => index.name);

      expect(indexNames).toContain("idx_posts_status_created_at");
    });

    it("adds mood_register to generation_log and seeds mood config defaults", () => {
      runMigrations(db, { bootstrapNewsSources: true });

      const columns = db
        .prepare("PRAGMA table_info(generation_log)")
        .all() as Array<{ name: string }>;
      const colNames = columns.map((column) => column.name);
      const configRows = db
        .prepare("SELECT key, value FROM scoring_config WHERE key IN ('mood_enabled', 'mood_content_types')")
        .all() as Array<{ key: string; value: string }>;
      const configByKey = new Map(configRows.map((row) => [row.key, row.value]));

      expect(colNames).toContain("mood_register");
      expect(configByKey.get("mood_enabled")).toBe("false");
      expect(configByKey.get("mood_content_types")).toBe(
        "[\"news_reaction\",\"cross_philosopher_reply\"]"
      );
    });

    it("seeds default mood palettes only for philosophers present in the database", () => {
      db.prepare(
        `INSERT INTO philosophers (
          id, name, tradition, color, initials, bio, era, key_works, core_principles,
          followers, posts_count, debates_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        "nietzsche",
        "Nietzsche",
        "Existentialism",
        "#000000",
        "FN",
        "Test bio",
        "1844-1900",
        "[]",
        "[]",
        0,
        0,
        0
      );

      runMigrations(db, { bootstrapNewsSources: true });

      const paletteRows = db
        .prepare("SELECT philosopher_id, registers, is_active FROM mood_palettes")
        .all() as Array<{ philosopher_id: string; registers: string; is_active: number }>;

      expect(paletteRows).toHaveLength(1);
      expect(paletteRows[0].philosopher_id).toBe("nietzsche");
      expect(paletteRows[0].is_active).toBe(1);
      expect(JSON.parse(paletteRows[0].registers)).toHaveLength(5);
    });

    it("adds recommendation_author to existing posts tables on version 9 databases", () => {
      const legacyDb = new Database(":memory:");
      legacyDb.exec(`
        CREATE TABLE posts (
          id TEXT PRIMARY KEY,
          philosopher_id TEXT NOT NULL,
          content TEXT NOT NULL,
          thesis TEXT NOT NULL DEFAULT '',
          stance TEXT NOT NULL,
          tag TEXT NOT NULL DEFAULT '',
          source_type TEXT NOT NULL DEFAULT 'news',
          historical_event_id TEXT,
          recommendation_title TEXT DEFAULT NULL,
          recommendation_medium TEXT DEFAULT NULL,
          citation_title TEXT,
          citation_source TEXT,
          citation_url TEXT,
          citation_image_url TEXT,
          reply_to TEXT,
          likes INTEGER NOT NULL DEFAULT 0,
          replies INTEGER NOT NULL DEFAULT 0,
          bookmarks INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'published',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `);

      ensureMetaTable(legacyDb);
      setSchemaVersion(legacyDb, 9);

      runMigrations(legacyDb);

      const columns = legacyDb.prepare("PRAGMA table_info(posts)").all() as Array<{ name: string }>;
      const colNames = columns.map((column) => column.name);

      expect(colNames).toContain("recommendation_author");

      legacyDb.close();
    });

    it("adds hidden_from_feed to existing agora_threads tables on version 12 databases", () => {
      const legacyDb = new Database(":memory:");
      legacyDb.exec(`
        CREATE TABLE agora_threads (
          id TEXT PRIMARY KEY,
          question TEXT NOT NULL,
          asked_by TEXT NOT NULL DEFAULT 'Anonymous User',
          status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_progress','complete','failed')),
          ip_address TEXT,
          question_type TEXT NOT NULL DEFAULT 'advice'
            CHECK(question_type IN ('advice', 'conceptual', 'debate')),
          recommendations_enabled INTEGER NOT NULL DEFAULT 0
            CHECK(recommendations_enabled IN (0, 1)),
          visibility TEXT NOT NULL DEFAULT 'public'
            CHECK(visibility IN ('public', 'private')),
          user_id TEXT DEFAULT NULL,
          follow_up_to TEXT DEFAULT NULL REFERENCES agora_threads(id),
          article_url TEXT DEFAULT NULL,
          article_title TEXT DEFAULT NULL,
          article_source TEXT DEFAULT NULL,
          article_excerpt TEXT DEFAULT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `);

      ensureMetaTable(legacyDb);
      setSchemaVersion(legacyDb, 12);

      runMigrations(legacyDb);

      const columns = legacyDb
        .prepare("PRAGMA table_info(agora_threads)")
        .all() as Array<{ name: string }>;
      const colNames = columns.map((column) => column.name);

      expect(colNames).toContain("hidden_from_feed");

      legacyDb.close();
    });

    it("adds expected columns to agora tables", () => {
      runMigrations(db, { bootstrapNewsSources: true });

      const threadColumns = db
        .prepare("PRAGMA table_info(agora_threads)")
        .all() as Array<{ name: string }>;
      const threadColNames = threadColumns.map((column) => column.name);

      expect(threadColNames).toContain("ip_address");
      expect(threadColNames).toContain("question_type");
      expect(threadColNames).toContain("recommendations_enabled");
      expect(threadColNames).toContain("visibility");
      expect(threadColNames).toContain("hidden_from_feed");
      expect(threadColNames).toContain("user_id");
      expect(threadColNames).toContain("follow_up_to");
      expect(threadColNames).toContain("article_url");
      expect(threadColNames).toContain("article_title");
      expect(threadColNames).toContain("article_source");
      expect(threadColNames).toContain("article_excerpt");

      const responseColumns = db
        .prepare("PRAGMA table_info(agora_responses)")
        .all() as Array<{ name: string }>;
      const responseColNames = responseColumns.map((column) => column.name);

      expect(responseColNames).toContain("recommendation");

      const indexes = db
        .prepare("PRAGMA index_list(agora_threads)")
        .all() as Array<{ name: string }>;
      const indexNames = indexes.map((index) => index.name);

      expect(indexNames).toContain("idx_agora_threads_follow_up");
    });

    it("seeds news sources when bootstrapNewsSources is true", () => {
      runMigrations(db, { bootstrapNewsSources: true });

      const count = db.prepare("SELECT COUNT(*) as c FROM news_sources").get() as { c: number };

      expect(count.c).toBeGreaterThan(0);
    });

    it("skips legacy default source bootstrap but still applies later source migrations", () => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS news_sources (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          feed_url TEXT NOT NULL UNIQUE,
          category TEXT NOT NULL DEFAULT 'world',
          is_active INTEGER NOT NULL DEFAULT 1,
          last_fetched_at TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `);

      runMigrations(db, { bootstrapNewsSources: false });

      const rows = db.prepare("SELECT id FROM news_sources ORDER BY id").all() as Array<{
        id: string;
      }>;
      const ids = rows.map((row) => row.id);

      expect(ids).not.toContain("bbc-world");
      expect(ids).toContain("quanta-magazine");
    });
  });
});
