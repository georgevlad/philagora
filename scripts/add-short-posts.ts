/**
 * add-short-posts.ts — Generate 4 genuinely SHORT posts via the API.
 *
 * Uses the generation service with targetLength="short" (max_tokens: 256)
 * and validates each result is under 60 words. Retries up to 3 times if
 * a post comes back too long.
 *
 * Usage:
 *   npx tsx scripts/add-short-posts.ts
 *   npx tsx scripts/add-short-posts.ts --dry-run
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import { getDb } from "@/lib/db";
import { generateContent } from "@/lib/generation-service";

const DRY_RUN = process.argv.includes("--dry-run");
const MAX_RETRIES = 3;
const MAX_WORDS = 60;

interface ShortPostPlan {
  id: string;
  philosopherId: string;
  citationTitle: string;
  citationSource: string;
  citationUrl: string;
  articleSummary: string;
  hoursAgo: number;
  likes: number;
  replies: number;
  bookmarks: number;
}

const PLANS: ShortPostPlan[] = [
  {
    id: "post-short-camus-hockey",
    philosopherId: "camus",
    citationTitle:
      "U.S. beats Canada in thrilling gold medal hockey final at Winter Olympics",
    citationSource: "CBS News",
    citationUrl:
      "https://www.cbsnews.com/news/us-hockey-canada-milano-cortina-winter-olympics-gold-medal/",
    articleSummary:
      "The United States men's hockey team defeated Canada in the gold medal game at the 2026 Milano Cortina Winter Olympics in an overtime thriller, with Trump introducing the team at his State of the Union address.",
    hoursAgo: 2,
    likes: 38,
    replies: 5,
    bookmarks: 22,
  },
  {
    id: "post-short-seneca-tiktok",
    philosopherId: "seneca",
    citationTitle: "TikTok is tracking you, even if you don't use the app",
    citationSource: "BBC Future",
    citationUrl:
      "https://www.bbc.com/future/article/20260210-tiktok-is-tracking-you-even-if-you-dont-use-the-app-heres-how-to-stop-it",
    articleSummary:
      "Investigation reveals TikTok's tracking pixel collects data from websites across the internet including cancer diagnoses, fertility info, and mental health data — even for people who don't have accounts. Experts call it 'extremely invasive'.",
    hoursAgo: 4,
    likes: 51,
    replies: 8,
    bookmarks: 34,
  },
  {
    id: "post-short-russell-epstein",
    philosopherId: "russell",
    citationTitle:
      "Jeffrey Epstein Was a Cottage Industry for Top Hollywood Crisis PR Experts",
    citationSource: "The Hollywood Reporter",
    citationUrl:
      "https://www.hollywoodreporter.com/business/business-news/jeffrey-epstein-top-hollywood-crisis-communications-experts-reputation-management-firms-1236513028/",
    articleSummary:
      "DOJ documents reveal how Epstein hired top crisis PR firms including Howard Rubenstein and Matthew Hiltzik to manage his reputation. The article traces how crisis communications professionals helped manufacture Epstein's public image, raising questions about the ethics of reputation management as an industry.",
    hoursAgo: 7,
    likes: 63,
    replies: 11,
    bookmarks: 42,
  },
  {
    id: "post-short-marcus-iran",
    philosopherId: "marcus-aurelius",
    citationTitle:
      "State of the Union: Trump makes case for Iran diplomacy while laying groundwork for potential military action",
    citationSource: "Reuters",
    citationUrl:
      "https://www.reuters.com/world/us/state-union-could-be-trumps-best-chance-sell-voters-iran-plans-2026-02-24/",
    articleSummary:
      "Trump used his 2026 State of the Union to warn Iran is developing missiles that could reach the US, said he prefers diplomacy but vowed to never let Iran have nuclear weapons. Talks resume in Geneva Thursday. Iran dismissed his claims as 'big lies'.",
    hoursAgo: 9,
    likes: 29,
    replies: 4,
    bookmarks: 18,
  },
];

function wordCount(text: string): number {
  return text.trim().split(/\s+/).length;
}

function hoursAgoToTimestamp(hours: number): string {
  const date = new Date(Date.now() - hours * 60 * 60 * 1000);
  return date.toISOString().replace("T", " ").slice(0, 19);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("\n📝  Generating 4 SHORT posts via API\n");

  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === "placeholder_key_here") {
    console.error("❌  ANTHROPIC_API_KEY not set in .env.local");
    process.exit(1);
  }

  if (DRY_RUN) {
    console.log("  ⚠️  DRY RUN — showing plans only\n");
    for (const plan of PLANS) {
      console.log(`  ${plan.philosopherId} → ${plan.citationTitle.slice(0, 50)}...`);
    }
    console.log("\n✅ Dry run complete.\n");
    return;
  }

  const db = getDb();

  const insert = db.prepare(`
    INSERT OR REPLACE INTO posts (
      id, philosopher_id, content, thesis, stance, tag,
      citation_title, citation_source, citation_url,
      reply_to, likes, replies, bookmarks, status,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?)
  `);

  let successCount = 0;

  for (const plan of PLANS) {
    const sourceMaterial = `${plan.citationTitle} — ${plan.citationSource}\n\n${plan.articleSummary}`;

    let content = "";
    let thesis = "";
    let stance = "observes";
    let tag = "";
    let words = 0;
    let success = false;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      process.stdout.write(
        `  [attempt ${attempt}/${MAX_RETRIES}] ${plan.philosopherId} → `
      );

      try {
        const result = await generateContent(
          plan.philosopherId,
          "news_reaction",
          sourceMaterial,
          "short"
        );

        if (!result.success) {
          console.log(`❌ ${result.error}`);
          await sleep(1000);
          continue;
        }

        const data = result.data;
        content = (data.content as string) ?? "";
        thesis = (data.thesis as string) ?? "";
        stance = (data.stance as string) ?? "observes";
        tag = (data.tag as string) ?? "";
        words = wordCount(content);

        if (words > MAX_WORDS) {
          console.log(`⚠️  ${words} words (over ${MAX_WORDS} limit) — retrying`);
          await sleep(1000);
          continue;
        }

        console.log(`✅ ${words} words`);
        success = true;
        break;
      } catch (err) {
        console.log(`❌ ${err instanceof Error ? err.message : String(err)}`);
        await sleep(1000);
      }
    }

    if (!success) {
      console.log(`  ⚠️  Skipping ${plan.philosopherId} — all ${MAX_RETRIES} attempts exceeded ${MAX_WORDS} words (last: ${words})`);
      continue;
    }

    const ts = hoursAgoToTimestamp(plan.hoursAgo);

    insert.run(
      plan.id,
      plan.philosopherId,
      content,
      thesis,
      stance,
      tag,
      plan.citationTitle,
      plan.citationSource,
      plan.citationUrl,
      null,
      plan.likes,
      plan.replies,
      plan.bookmarks,
      ts,
      ts
    );

    console.log(`     → "${thesis}"\n`);
    successCount++;
    await sleep(500);
  }

  const total = (
    db
      .prepare("SELECT COUNT(*) as c FROM posts WHERE status = 'published'")
      .get() as { c: number }
  ).c;

  console.log(`\n✅ Done! ${successCount}/4 short posts generated. ${total} total published posts.\n`);
}

main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
