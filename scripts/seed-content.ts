/**
 * Populate a local Philagora database from the sanitized offline fixture.
 *
 * Usage:
 *   npm run seed:content
 *   npm run seed:content -- --dry-run
 *   npm run seed:content -- --reset
 *   npm run seed:content -- --database tmp/philagora-dev.db
 */

import dotenv from "dotenv";
import path from "path";

import { getSeedContentSummary, seedContent } from "../db/seed-content";

dotenv.config({ path: ".env.local", override: true });

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const reset = args.includes("--reset");

function getArg(name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function rejectUnsafeTarget(databasePath: string): void {
  const resolved = path.resolve(databasePath);
  const normalized = resolved.replace(/\\/g, "/").toLowerCase();

  if (process.env.NODE_ENV === "production") {
    throw new Error("seed:content is disabled when NODE_ENV=production");
  }
  if (normalized.includes("/data/") && normalized.endsWith(".db")) {
    throw new Error("Refusing to seed a database in data/; that directory is reserved for snapshots");
  }
}

async function main(): Promise<void> {
  const requestedDatabase = getArg("--database");
  if (requestedDatabase) process.env.DATABASE_PATH = path.resolve(requestedDatabase);

  const targetPath = process.env.DATABASE_PATH
    ? path.resolve(process.env.DATABASE_PATH)
    : path.join(process.cwd(), "db", "philagora.db");
  rejectUnsafeTarget(targetPath);

  if (dryRun) {
    console.log("Seed-content dry run; no database changes will be made.");
    console.log(JSON.stringify({ target: targetPath, fixture: getSeedContentSummary() }, null, 2));
    return;
  }

  const { getDb } = await import("../db/index");
  const db = getDb();
  const result = seedContent(db, { mode: reset ? "reset" : "insert" });

  console.log(`Seed-content ${result.mode} complete: ${targetPath}`);
  console.log(JSON.stringify(result, null, 2));
  db.close();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
