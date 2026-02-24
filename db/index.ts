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

  return db;
}

export default getDb;
