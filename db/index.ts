import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = path.join(process.cwd(), "db", "philagora.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    ensureSchema(_db);
    runMigrations(_db);
  }
  return _db;
}

/**
 * Initialize the database by running schema.sql.
 * Safe to call multiple times — uses IF NOT EXISTS.
 */
export function initDb(): Database.Database {
  const db = getDb();
  const schemaPath = path.join(process.cwd(), "db", "schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf-8");

  // Split on semicolons and execute each statement
  // (better-sqlite3's exec handles multiple statements, but we filter out PRAGMAs
  //  already handled by getDb)
  const statements = schema
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("PRAGMA"));

  for (const stmt of statements) {
    db.exec(stmt + ";");
  }

  // Run migrations for existing databases
  runMigrations(db);

  return db;
}

/**
 * Ensure the database schema exists.
 * Runs schema.sql (all CREATE TABLE IF NOT EXISTS) so a fresh DB gets its tables.
 */
function ensureSchema(db: Database.Database): void {
  const hasSchema = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='posts'")
    .get();

  if (hasSchema) return; // tables already exist

  const schemaPath = path.join(process.cwd(), "db", "schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf-8");

  const statements = schema
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("PRAGMA"));

  for (const stmt of statements) {
    db.exec(stmt + ";");
  }
}

/**
 * Migrate generation_log if it still has the old NOT NULL constraint
 * on philosopher_id or is missing the 'synthesis' content_type.
 */
function runMigrations(db: Database.Database): void {
  // ── News Scout tables (always runs, idempotent) ──────────────────
  migrateNewsScout(db);

  // Check if generation_log needs migration by inspecting the table schema
  const tableInfo = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='generation_log'")
    .get() as { sql: string } | undefined;

  if (!tableInfo) return;

  const needsMigration =
    tableInfo.sql.includes("NOT NULL REFERENCES philosophers") ||
    !tableInfo.sql.includes("synthesis");

  if (!needsMigration) return;

  // Rebuild the table with the corrected schema
  db.exec("PRAGMA foreign_keys = OFF;");

  db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS generation_log_new (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        philosopher_id   TEXT REFERENCES philosophers(id),
        content_type     TEXT NOT NULL CHECK(content_type IN ('post','debate_opening','debate_rebuttal','agora_response','reflection','synthesis')),
        system_prompt_id INTEGER REFERENCES system_prompts(id),
        user_input       TEXT NOT NULL DEFAULT '',
        raw_output       TEXT NOT NULL DEFAULT '',
        status           TEXT NOT NULL DEFAULT 'generated' CHECK(status IN ('generated','approved','rejected','published','pending')),
        created_at       TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    db.exec("INSERT INTO generation_log_new SELECT * FROM generation_log;");
    db.exec("DROP TABLE generation_log;");
    db.exec("ALTER TABLE generation_log_new RENAME TO generation_log;");
    db.exec("CREATE INDEX IF NOT EXISTS idx_generation_log_philosopher ON generation_log(philosopher_id);");
    db.exec("CREATE INDEX IF NOT EXISTS idx_generation_log_status ON generation_log(status);");
  })();

  db.exec("PRAGMA foreign_keys = ON;");
}

/**
 * Create news_sources and article_candidates tables if they don't exist,
 * then seed starter RSS sources.
 */
function migrateNewsScout(db: Database.Database): void {
  const hasTable = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='news_sources'"
    )
    .get();

  if (hasTable) return; // already migrated

  db.exec(`
    CREATE TABLE IF NOT EXISTS news_sources (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      feed_url        TEXT NOT NULL UNIQUE,
      category        TEXT NOT NULL DEFAULT 'world',
      is_active       INTEGER NOT NULL DEFAULT 1,
      last_fetched_at TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS article_candidates (
      id                       TEXT PRIMARY KEY,
      source_id                TEXT NOT NULL REFERENCES news_sources(id),
      title                    TEXT NOT NULL,
      url                      TEXT NOT NULL UNIQUE,
      description              TEXT NOT NULL DEFAULT '',
      pub_date                 TEXT,
      score                    INTEGER,
      score_reasoning          TEXT,
      suggested_philosophers   TEXT NOT NULL DEFAULT '[]',
      suggested_stances        TEXT NOT NULL DEFAULT '{}',
      primary_tensions         TEXT NOT NULL DEFAULT '[]',
      philosophical_entry_point TEXT,
      image_url                TEXT,
      status                   TEXT NOT NULL DEFAULT 'new'
                                 CHECK(status IN ('new','scored','approved','dismissed','used')),
      fetched_at               TEXT NOT NULL DEFAULT (datetime('now')),
      scored_at                TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_article_candidates_status ON article_candidates(status);
    CREATE INDEX IF NOT EXISTS idx_article_candidates_score ON article_candidates(score);
    CREATE INDEX IF NOT EXISTS idx_article_candidates_url ON article_candidates(url);
  `);

  // Seed starter RSS sources
  const insert = db.prepare(
    "INSERT OR IGNORE INTO news_sources (id, name, feed_url, category) VALUES (?, ?, ?, ?)"
  );

  const seeds: [string, string, string, string][] = [
    ["bbc-world", "BBC World News", "https://feeds.bbci.co.uk/news/world/rss.xml", "world"],
    ["bbc-top", "BBC Top Stories", "https://feeds.bbci.co.uk/news/rss.xml", "world"],
    ["npr-top", "NPR Top Stories", "https://feeds.npr.org/1001/rss.xml", "world"],
    ["guardian-world", "The Guardian World", "https://www.theguardian.com/world/rss", "world"],
    ["aljazeera", "Al Jazeera", "https://www.aljazeera.com/xml/rss/all.xml", "world"],
    ["cnn-world", "CNN World", "http://rss.cnn.com/rss/edition_world.rss", "world"],
    ["atlantic", "The Atlantic", "https://www.theatlantic.com/feed/all/", "opinion"],
    ["aeon", "Aeon", "https://aeon.co/feed.rss", "culture"],
    ["avclub", "The A.V. Club", "https://www.avclub.com/rss", "entertainment"],
    ["popmatters", "PopMatters", "https://popmatters.com/feed", "culture"],
    ["bbc-sport", "BBC Sport", "https://feeds.bbci.co.uk/sport/rss.xml", "sports"],
    ["espn-top", "ESPN Top News", "http://www.espn.com/espn/rss/news", "sports"],
    ["ars-technica", "Ars Technica", "http://feeds.arstechnica.com/arstechnica/index/", "tech"],
  ];

  for (const row of seeds) {
    insert.run(...row);
  }
}

export default getDb;
