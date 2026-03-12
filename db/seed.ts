/**
 * Base seed script - bootstraps philosophers and system prompts into SQLite.
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
import { seedDatabase } from "./seed-runner";

const db = initDb();

console.log("[Philagora] Base seed starting...");
seedDatabase(db);
console.log(`  [ok] Philosophers: ${Object.keys(philosophers).length} inserted`);
console.log("[Philagora] Base seed complete.");
console.log("   Next: npx tsx scripts/seed-demo.ts");
process.exit(0);
