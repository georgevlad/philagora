/**
 * backfill-og-images.ts — Fetch og:image URLs for posts with citations.
 *
 * Queries all posts that have a citation_url but no citation_image_url,
 * fetches the HTML, extracts the og:image meta tag, and updates the DB.
 *
 * Usage:
 *   npx tsx scripts/backfill-og-images.ts
 *
 * Idempotent — safe to run multiple times.
 */

import { getDb } from "../db/index";

// ── Helpers ─────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extract og:image from raw HTML using regex.
 * Handles both attribute orders:
 *   <meta property="og:image" content="URL">
 *   <meta content="URL" property="og:image">
 */
function extractOgImage(html: string): string | null {
  // property first, then content
  const match1 = html.match(
    /<meta[^>]+property\s*=\s*["']og:image["'][^>]+content\s*=\s*["']([^"']+)["']/i
  );
  if (match1) return decodeHtmlEntities(match1[1]);

  // content first, then property
  const match2 = html.match(
    /<meta[^>]+content\s*=\s*["']([^"']+)["'][^>]+property\s*=\s*["']og:image["']/i
  );
  if (match2) return decodeHtmlEntities(match2[1]);

  return null;
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&#038;/g, "&")
    .replace(/&amp;/g, "&");
}

// ── Main ────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n🖼️  Backfilling OG images for citation posts\n");

  const db = getDb();

  const posts = db
    .prepare(
      `SELECT id, citation_url FROM posts
       WHERE citation_url IS NOT NULL
         AND citation_url != ''
         AND (citation_image_url IS NULL OR citation_image_url = '')`
    )
    .all() as { id: string; citation_url: string }[];

  if (posts.length === 0) {
    console.log("  ✅ All posts already have OG images (or no citations). Nothing to do.\n");
    return;
  }

  console.log(`  Found ${posts.length} posts to process\n`);

  let updated = 0;
  let skipped = 0;

  const updateStmt = db.prepare(
    "UPDATE posts SET citation_image_url = ? WHERE id = ?"
  );

  for (const post of posts) {
    const shortUrl =
      post.citation_url.length > 60
        ? post.citation_url.slice(0, 60) + "..."
        : post.citation_url;

    process.stdout.write(`  ${shortUrl} ... `);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const resp = await fetch(post.citation_url, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; Philagora/1.0; +https://philagora.app)",
          Accept: "text/html",
        },
        redirect: "follow",
      });

      clearTimeout(timeout);

      if (!resp.ok) {
        console.log(`⚠️  HTTP ${resp.status} — skipped`);
        skipped++;
        await sleep(500);
        continue;
      }

      // Only read the first ~50KB to find the og:image tag (it's in <head>)
      const text = await resp.text();
      const head = text.slice(0, 50000);

      const ogImage = extractOgImage(head);

      if (ogImage) {
        updateStmt.run(ogImage, post.id);
        updated++;
        console.log("✅");
      } else {
        console.log("⚠️  no og:image found — skipped");
        skipped++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("abort")) {
        console.log("⚠️  timeout — skipped");
      } else {
        console.log(`⚠️  ${msg.slice(0, 60)} — skipped`);
      }
      skipped++;
    }

    await sleep(500);
  }

  console.log(`\n✅ Updated ${updated} of ${posts.length} posts with OG images (${skipped} skipped)\n`);
}

main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
