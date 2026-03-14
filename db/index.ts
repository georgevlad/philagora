import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { runMigrations } from "./migrations";

export function resolveDatabasePath(): string {
  if (process.env.DATABASE_PATH) {
    const resolved = path.resolve(process.env.DATABASE_PATH);
    const dir = path.dirname(resolved);

    // Railway volumes are unavailable during build, so fall back locally then.
    if (!fs.existsSync(dir)) {
      return path.join(process.cwd(), "db", "philagora.db");
    }

    return resolved;
  }

  return path.join(process.cwd(), "db", "philagora.db");
}

const DB_PATH = resolveDatabasePath();

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    const schemaWasCreated = ensureSchema(_db);
    runMigrations(_db, { bootstrapNewsSources: schemaWasCreated });
    if (process.env.RUN_SEED === "true") {
      const count = _db.prepare("SELECT COUNT(*) as c FROM philosophers").get() as { c: number };

      if (count.c === 0) {
        console.log("[Philagora] RUN_SEED=true and DB is empty, seeding...");
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { seedDatabase } = require("./seed-runner") as typeof import("./seed-runner");
        seedDatabase(_db);
        console.log("[Philagora] Seed complete.");
      }
    }
  }
  return _db;
}

/**
 * Initialize the database by running schema.sql.
 * Safe to call multiple times - uses IF NOT EXISTS.
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
function ensureSchema(db: Database.Database): boolean {
  const hasSchema = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='posts'")
    .get();

  if (hasSchema) return false; // tables already exist

  const schemaPath = path.join(process.cwd(), "db", "schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf-8");

  const statements = schema
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("PRAGMA"));

  for (const stmt of statements) {
    db.exec(stmt + ";");
  }

  return true;
}

export default getDb;
