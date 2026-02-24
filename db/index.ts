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
 * Migrate generation_log if it still has the old NOT NULL constraint
 * on philosopher_id or is missing the 'synthesis' content_type.
 */
function runMigrations(db: Database.Database): void {
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

export default getDb;
