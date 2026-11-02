import { buildPhilosopherPrompt } from "../db/philosopher-prompts";
/**
 * One-time script to add Cicero to an existing database without re-seeding.
 * Run with: npx tsx scripts/add-cicero.ts
 */

import Database from "better-sqlite3";
import path from "path";
import { philosophers } from "../db/philosophers";

const DB_PATH = path.join(process.cwd(), "db", "philagora.db");
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const cicero = philosophers.cicero;
if (!cicero) {
  console.error("Cicero not found in philosophers.ts");
  process.exit(1);
}

// Check if already exists
const existing = db
  .prepare("SELECT id FROM philosophers WHERE id = ?")
  .get("cicero");

if (existing) {
  console.log("Cicero already exists in database, skipping philosopher insert.");
} else {
  db.prepare(
    `INSERT INTO philosophers (id, name, tradition, color, initials, bio, era, key_works, core_principles, followers, posts_count, debates_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    cicero.id,
    cicero.name,
    cicero.tradition,
    cicero.color,
    cicero.initials,
    cicero.bio,
    cicero.era,
    JSON.stringify(cicero.keyWorks),
    JSON.stringify(cicero.corePrinciples),
    cicero.followers,
    cicero.postsCount,
    cicero.debatesCount
  );
  console.log("✓ Inserted Cicero into philosophers table");
}

// Check if system prompt exists
const existingPrompt = db
  .prepare(
    "SELECT id FROM system_prompts WHERE philosopher_id = ? AND is_active = 1"
  )
  .get("cicero");

if (existingPrompt) {
  console.log("Cicero already has an active system prompt, skipping.");
} else {
  const promptText = buildPhilosopherPrompt("cicero");

  db.prepare(
    `INSERT INTO system_prompts (philosopher_id, prompt_version, system_prompt_text, is_active, created_at)
     VALUES (?, 1, ?, 1, datetime('now'))`
  ).run("cicero", promptText);
  console.log("✓ Inserted Cicero system prompt (active)");
}

// Verify
const phil = db
  .prepare("SELECT id, name, tradition FROM philosophers WHERE id = ?")
  .get("cicero") as { id: string; name: string; tradition: string };
const prompt = db
  .prepare(
    "SELECT id, philosopher_id, is_active FROM system_prompts WHERE philosopher_id = ? AND is_active = 1"
  )
  .get("cicero") as { id: number; philosopher_id: string; is_active: number };

console.log("Verified philosopher:", phil);
console.log("Verified prompt:", prompt);

db.close();
console.log("\nDone! Cicero is ready to argue his case.");
