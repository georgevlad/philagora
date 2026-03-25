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
      expect(colNames).toContain("recommendation_medium");
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
      expect(threadColNames).toContain("user_id");
      expect(threadColNames).toContain("article_url");
      expect(threadColNames).toContain("article_title");
      expect(threadColNames).toContain("article_source");
      expect(threadColNames).toContain("article_excerpt");

      const responseColumns = db
        .prepare("PRAGMA table_info(agora_responses)")
        .all() as Array<{ name: string }>;
      const responseColNames = responseColumns.map((column) => column.name);

      expect(responseColNames).toContain("recommendation");
    });

    it("seeds news sources when bootstrapNewsSources is true", () => {
      runMigrations(db, { bootstrapNewsSources: true });

      const count = db.prepare("SELECT COUNT(*) as c FROM news_sources").get() as { c: number };

      expect(count.c).toBeGreaterThan(0);
    });

    it("does not seed news sources when bootstrapNewsSources is false on existing DB", () => {
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

      const count = db.prepare("SELECT COUNT(*) as c FROM news_sources").get() as { c: number };

      expect(count.c).toBe(0);
    });
  });
});
