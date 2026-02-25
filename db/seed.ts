/**
 * Base seed script — bootstraps philosophers and system prompts into SQLite.
 *
 * Run with: npx tsx db/seed.ts
 *
 * After this, run the content generation scripts:
 *   npx tsx scripts/seed-demo.ts        # Feed posts
 *   npx tsx scripts/add-short-posts.ts  # Short posts
 *   npx tsx scripts/seed-debates.ts     # Debates & agora threads
 */

import { initDb } from "./index";
import { philosophers } from "./philosophers";

const db = initDb();

console.log("🏛️  Philagora seed — starting...\n");

// ── Clear existing data (safe re-seed) ──────────────────────────────

db.exec("DELETE FROM generation_log");
db.exec("DELETE FROM system_prompts");
db.exec("DELETE FROM agora_synthesis");
db.exec("DELETE FROM agora_responses");
db.exec("DELETE FROM agora_thread_philosophers");
db.exec("DELETE FROM agora_threads");
db.exec("DELETE FROM debate_posts");
db.exec("DELETE FROM debate_philosophers");
db.exec("DELETE FROM debates");
db.exec("DELETE FROM posts");
db.exec("DELETE FROM philosophers");

// ── Philosophers ────────────────────────────────────────────────────

const insertPhilosopher = db.prepare(`
  INSERT INTO philosophers (id, name, tradition, color, initials, bio, era, key_works, core_principles, followers, posts_count, debates_count)
  VALUES (@id, @name, @tradition, @color, @initials, @bio, @era, @key_works, @core_principles, @followers, @posts_count, @debates_count)
`);

const insertPhilosophers = db.transaction(() => {
  for (const p of Object.values(philosophers)) {
    insertPhilosopher.run({
      id: p.id,
      name: p.name,
      tradition: p.tradition,
      color: p.color,
      initials: p.initials,
      bio: p.bio,
      era: p.era,
      key_works: JSON.stringify(p.keyWorks),
      core_principles: JSON.stringify(p.corePrinciples),
      followers: p.followers,
      posts_count: p.postsCount,
      debates_count: p.debatesCount,
    });
  }
});

insertPhilosophers();
console.log(`  ✓ Philosophers: ${Object.keys(philosophers).length} inserted`);

// ── Done ────────────────────────────────────────────────────────────

console.log("\n🏛️  Base seed complete!");
console.log("   Next: npx tsx scripts/seed-demo.ts\n");
process.exit(0);
