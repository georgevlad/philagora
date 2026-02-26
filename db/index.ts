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
  migrateNewsSourceLogos(db);

  // Table-rebuild migrations can race with parallel build workers.
  // Wrap each in try-catch so a concurrent "table already dropped" or
  // "table not found" error from another worker doesn't crash the build.
  try {
    migratePostsArchivedStatus(db);
  } catch (err) {
    if (!(err instanceof Error && err.message.includes("SQLITE_ERROR"))) throw err;
  }

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
  try {
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
  } catch (err) {
    // Another worker may have completed this migration concurrently
    if (!(err instanceof Error && err.message.includes("SQLITE_ERROR"))) throw err;
    try { db.exec("PRAGMA foreign_keys = ON;"); } catch { /* best effort */ }
  }
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

/**
 * Add logo_url column to news_sources and seed favicon URLs.
 */
function migrateNewsSourceLogos(db: Database.Database): void {
  // Check if column already exists
  const columns = db
    .prepare("PRAGMA table_info(news_sources)")
    .all() as { name: string }[];

  const hasLogoUrl = columns.some((c) => c.name === "logo_url");
  if (hasLogoUrl) return;

  try {
    db.exec("ALTER TABLE news_sources ADD COLUMN logo_url TEXT;");
  } catch (err) {
    // Another worker may have added the column between check and alter (build-time race)
    if (err instanceof Error && err.message.includes("duplicate column")) return;
    throw err;
  }

  // Seed logos using Google's favicon service
  const sourceLogos: Record<string, string> = {
    "bbc-world": "https://www.google.com/s2/favicons?domain=bbc.co.uk&sz=64",
    "bbc-top": "https://www.google.com/s2/favicons?domain=bbc.co.uk&sz=64",
    "npr-top": "https://www.google.com/s2/favicons?domain=npr.org&sz=64",
    "guardian-world": "https://www.google.com/s2/favicons?domain=theguardian.com&sz=64",
    "aljazeera": "https://www.google.com/s2/favicons?domain=aljazeera.com&sz=64",
    "cnn-world": "https://www.google.com/s2/favicons?domain=cnn.com&sz=64",
    "atlantic": "https://www.google.com/s2/favicons?domain=theatlantic.com&sz=64",
    "aeon": "https://www.google.com/s2/favicons?domain=aeon.co&sz=64",
    "avclub": "https://www.google.com/s2/favicons?domain=avclub.com&sz=64",
    "popmatters": "https://www.google.com/s2/favicons?domain=popmatters.com&sz=64",
    "bbc-sport": "https://www.google.com/s2/favicons?domain=bbc.co.uk&sz=64",
    "espn-top": "https://www.google.com/s2/favicons?domain=espn.com&sz=64",
    "ars-technica": "https://www.google.com/s2/favicons?domain=arstechnica.com&sz=64",
  };

  const update = db.prepare(
    "UPDATE news_sources SET logo_url = ? WHERE id = ?"
  );

  for (const [id, logoUrl] of Object.entries(sourceLogos)) {
    update.run(logoUrl, id);
  }
}

/**
 * Add 'archived' to the posts status CHECK constraint.
 * SQLite requires rebuilding the table to alter a CHECK constraint.
 */
function migratePostsArchivedStatus(db: Database.Database): void {
  const tableInfo = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='posts'")
    .get() as { sql: string } | undefined;

  if (!tableInfo) return;

  // Already migrated if 'archived' is in the CHECK constraint
  if (tableInfo.sql.includes("archived")) return;

  db.exec("PRAGMA foreign_keys = OFF;");

  db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS posts_new (
        id              TEXT PRIMARY KEY,
        philosopher_id  TEXT NOT NULL REFERENCES philosophers(id),
        content         TEXT NOT NULL,
        thesis          TEXT NOT NULL DEFAULT '',
        stance          TEXT NOT NULL CHECK(stance IN ('challenges','defends','reframes','questions','warns','observes')),
        tag             TEXT NOT NULL DEFAULT '',
        citation_title     TEXT,
        citation_source    TEXT,
        citation_url       TEXT,
        citation_image_url TEXT,
        reply_to        TEXT REFERENCES posts_new(id),
        likes           INTEGER NOT NULL DEFAULT 0,
        replies         INTEGER NOT NULL DEFAULT 0,
        bookmarks       INTEGER NOT NULL DEFAULT 0,
        status          TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('draft','approved','published','archived')),
        created_at      TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    db.exec("INSERT INTO posts_new SELECT * FROM posts;");
    db.exec("DROP TABLE posts;");
    db.exec("ALTER TABLE posts_new RENAME TO posts;");
    db.exec("CREATE INDEX IF NOT EXISTS idx_posts_philosopher ON posts(philosopher_id);");
    db.exec("CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);");
    db.exec("CREATE INDEX IF NOT EXISTS idx_posts_tag ON posts(tag);");
    db.exec("CREATE INDEX IF NOT EXISTS idx_posts_reply_to ON posts(reply_to);");
  })();

  db.exec("PRAGMA foreign_keys = ON;");
}

export default getDb;
