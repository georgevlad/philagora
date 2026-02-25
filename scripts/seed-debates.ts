/**
 * seed-debates.ts — Clear existing debates/agora and regenerate using AI.
 *
 * Creates 3 debates (2 complete, 1 in-progress) and 2 agora threads,
 * generating all content through the Anthropic API generation pipeline.
 *
 * Usage:
 *   npx tsx scripts/seed-debates.ts              # Generate everything
 *   npx tsx scripts/seed-debates.ts --dry-run    # Show what would be generated
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import { getDb } from "@/lib/db";
import { generateContent, generateSynthesis } from "@/lib/generation-service";

// ── CLI flags ───────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes("--dry-run");

// ── Helpers ─────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function dateToSqlite(dateStr: string): string {
  // "2026-02-20" → "2026-02-20 12:00:00"
  return `${dateStr} 12:00:00`;
}

// ── Debate definitions ──────────────────────────────────────────────────

interface DebatePlan {
  id: string;
  title: string;
  triggerArticleTitle: string;
  triggerArticleSource: string;
  triggerArticleUrl: string;
  philosophers: string[];
  status: "complete" | "in_progress";
  debateDate: string;
  articleSummary: string;
}

const DEBATES: DebatePlan[] = [
  {
    id: "debate-1",
    title: "Should We Accept Surveillance as the Price of Free Technology?",
    triggerArticleTitle:
      "TikTok is tracking you, even if you don't use the app",
    triggerArticleSource: "BBC Future",
    triggerArticleUrl:
      "https://www.bbc.com/future/article/20260210-tiktok-is-tracking-you-even-if-you-dont-use-the-app-heres-how-to-stop-it",
    philosophers: ["russell", "jung", "confucius"],
    status: "complete",
    debateDate: "2026-02-20",
    articleSummary:
      "Investigation reveals TikTok's tracking pixel collects data from websites across the internet including cancer diagnoses, fertility info, and mental health data — even for people who don't have accounts. Experts call it 'extremely invasive'.",
  },
  {
    id: "debate-2",
    title: "Is Reputation Management Just Paid Dishonesty?",
    triggerArticleTitle:
      "Jeffrey Epstein Was a Cottage Industry for Top Hollywood Crisis PR Experts",
    triggerArticleSource: "The Hollywood Reporter",
    triggerArticleUrl:
      "https://www.hollywoodreporter.com/business/business-news/jeffrey-epstein-top-hollywood-crisis-communications-experts-reputation-management-firms-1236513028/",
    philosophers: ["kant", "nietzsche", "seneca"],
    status: "complete",
    debateDate: "2026-02-22",
    articleSummary:
      "DOJ documents reveal how Epstein hired top crisis PR firms including Howard Rubenstein and Matthew Hiltzik to manage his reputation. The article traces how crisis communications professionals helped manufacture Epstein's public image, raising questions about the ethics of reputation management as an industry.",
  },
  {
    id: "debate-3",
    title: "Can Diplomacy Backed by Military Threats Ever Be Genuine?",
    triggerArticleTitle:
      "State of the Union: Trump makes case for Iran diplomacy while laying groundwork for potential military action",
    triggerArticleSource: "Reuters",
    triggerArticleUrl:
      "https://www.reuters.com/world/us/state-union-could-be-trumps-best-chance-sell-voters-iran-plans-2026-02-24/",
    philosophers: ["confucius", "russell", "kant", "camus"],
    status: "in_progress",
    debateDate: "2026-02-25",
    articleSummary:
      "Trump used his 2026 State of the Union to warn Iran is developing missiles that could reach the US, said he prefers diplomacy but vowed to never let Iran have nuclear weapons. Talks resume in Geneva Thursday. Iran dismissed his claims as 'big lies'.",
  },
];

// ── Agora thread definitions ────────────────────────────────────────────

interface AgoraThreadPlan {
  id: string;
  question: string;
  askedBy: string;
  philosophers: string[];
  hoursAgo: number;
}

const AGORA_THREADS: AgoraThreadPlan[] = [
  {
    id: "agora-1",
    question:
      "My company wants me to install TikTok for marketing. Given what we know about tracking, should I refuse on principle or is that naive?",
    askedBy: "Marketing Manager, 34",
    philosophers: ["seneca", "confucius", "russell", "camus"],
    hoursAgo: 48,
  },
  {
    id: "agora-2",
    question:
      "A friend got caught in the Epstein document dump with a minor mention. He did nothing wrong but his career is being destroyed. How should he handle it?",
    askedBy: "Anonymous",
    philosophers: ["marcus-aurelius", "kierkegaard", "nietzsche", "kant"],
    hoursAgo: 96,
  },
];

// ── Main ────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n🏛️  seed-debates — Replacing debates & agora with AI-generated content\n");

  if (DRY_RUN) {
    console.log("  ⚠️  DRY RUN — showing plans only\n");
    dryRunSummary();
    return;
  }

  // Check for API key
  if (
    !process.env.ANTHROPIC_API_KEY ||
    process.env.ANTHROPIC_API_KEY === "placeholder_key_here"
  ) {
    console.error("❌  ANTHROPIC_API_KEY not set in .env.local");
    process.exit(1);
  }

  const db = getDb();

  // Check that system prompts exist for all needed philosophers
  const allPhilosophers = new Set<string>();
  for (const d of DEBATES) d.philosophers.forEach((p) => allPhilosophers.add(p));
  for (const t of AGORA_THREADS) t.philosophers.forEach((p) => allPhilosophers.add(p));

  const missingPrompts: string[] = [];
  for (const pid of allPhilosophers) {
    const row = db
      .prepare(
        "SELECT id FROM system_prompts WHERE philosopher_id = ? AND is_active = 1 LIMIT 1"
      )
      .get(pid) as { id: number } | undefined;
    if (!row) missingPrompts.push(pid);
  }

  if (missingPrompts.length > 0) {
    console.warn(
      `⚠️  Missing active system prompts for: ${missingPrompts.join(", ")}`
    );
    console.warn("   These philosophers will be skipped during generation.\n");
  }

  // ── Step 1: Clear existing data ─────────────────────────────────────

  console.log("🗑️  Clearing existing debate & agora data...");
  db.exec("DELETE FROM agora_synthesis");
  db.exec("DELETE FROM agora_responses");
  db.exec("DELETE FROM agora_thread_philosophers");
  db.exec("DELETE FROM agora_threads");
  db.exec("DELETE FROM debate_posts");
  db.exec("DELETE FROM debate_philosophers");
  db.exec("DELETE FROM debates");
  console.log("   Done.\n");

  // ── Step 2: Create debates ──────────────────────────────────────────

  let totalDebatePosts = 0;

  const insertDebate = db.prepare(`
    INSERT INTO debates (
      id, title, trigger_article_title, trigger_article_source,
      trigger_article_url, status, debate_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertDebatePhilosopher = db.prepare(
    "INSERT INTO debate_philosophers (debate_id, philosopher_id) VALUES (?, ?)"
  );

  const insertDebatePost = db.prepare(`
    INSERT INTO debate_posts (id, debate_id, philosopher_id, content, phase, reply_to, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const updateDebateSynthesis = db.prepare(`
    UPDATE debates SET
      synthesis_tensions = ?,
      synthesis_agreements = ?,
      synthesis_questions = ?,
      synthesis_summary_agree = ?,
      synthesis_summary_diverge = ?,
      synthesis_summary_unresolved = ?,
      status = 'complete'
    WHERE id = ?
  `);

  for (const debate of DEBATES) {
    console.log(`📋 Debate: "${debate.title}"`);
    console.log(`   Philosophers: ${debate.philosophers.join(", ")}`);
    console.log(`   Status: ${debate.status}\n`);

    // Insert debate row
    insertDebate.run(
      debate.id,
      debate.title,
      debate.triggerArticleTitle,
      debate.triggerArticleSource,
      debate.triggerArticleUrl,
      debate.status === "complete" ? "in_progress" : debate.status, // Set as in_progress initially, update to complete after synthesis
      dateToSqlite(debate.debateDate)
    );

    // Insert junction rows
    for (const pid of debate.philosophers) {
      insertDebatePhilosopher.run(debate.id, pid);
    }

    // ── Generate openings ──────────────────────────────────────────

    const sourceMaterial = `DEBATE TOPIC: ${debate.title}\n\nTRIGGER ARTICLE: ${debate.triggerArticleTitle} (${debate.triggerArticleSource})\n\nSUMMARY: ${debate.articleSummary}`;

    const openings: Record<string, { postId: string; content: string }> = {};
    let sortOrder = 0;

    for (const pid of debate.philosophers) {
      if (missingPrompts.includes(pid)) {
        console.log(`   ⚠️  Skipping opening for ${pid} (no active prompt)`);
        continue;
      }

      process.stdout.write(`   Generating opening for ${pid}... `);

      try {
        const result = await generateContent(pid, "debate_opening", sourceMaterial);

        if (!result.success) {
          console.log(`❌ ${result.error}`);
          await sleep(1000);
          continue;
        }

        const content = (result.data.content as string) ?? "";
        const postId = `dp-${debate.id.split("-")[1]}-${pid}-opening`;

        insertDebatePost.run(
          postId,
          debate.id,
          pid,
          content,
          "opening",
          null,
          sortOrder++
        );

        openings[pid] = { postId, content };
        totalDebatePosts++;

        console.log(`✅ (${content.split(/\s+/).length} words)`);
      } catch (err) {
        console.log(
          `❌ ${err instanceof Error ? err.message : String(err)}`
        );
      }

      await sleep(1000);
    }

    // ── Generate rebuttals (complete debates only) ─────────────────

    if (debate.status === "complete") {
      const philosopherIds = debate.philosophers.filter(
        (pid) => openings[pid] != null
      );

      for (let i = 0; i < philosopherIds.length; i++) {
        const rebutterId = philosopherIds[i];
        const targetIdx = (i + 1) % philosopherIds.length;
        const targetId = philosopherIds[targetIdx];
        const targetOpening = openings[targetId];

        if (!targetOpening) continue;
        if (missingPrompts.includes(rebutterId)) {
          console.log(
            `   ⚠️  Skipping rebuttal for ${rebutterId} (no active prompt)`
          );
          continue;
        }

        // Look up target philosopher name
        const targetRow = db
          .prepare("SELECT name FROM philosophers WHERE id = ?")
          .get(targetId) as { name: string } | undefined;
        const targetName = targetRow?.name ?? targetId;

        const rebuttalSource = `DEBATE TOPIC: ${debate.title}\n\nYou are rebutting ${targetName}'s opening statement:\n\n${targetOpening.content}`;

        process.stdout.write(
          `   Generating rebuttal: ${rebutterId} → ${targetId}... `
        );

        try {
          const result = await generateContent(
            rebutterId,
            "debate_rebuttal",
            rebuttalSource
          );

          if (!result.success) {
            console.log(`❌ ${result.error}`);
            await sleep(1000);
            continue;
          }

          const content = (result.data.content as string) ?? "";
          const postId = `dp-${debate.id.split("-")[1]}-${rebutterId}-rebuttal`;

          insertDebatePost.run(
            postId,
            debate.id,
            rebutterId,
            content,
            "rebuttal",
            targetOpening.postId,
            sortOrder++
          );

          totalDebatePosts++;
          console.log(`✅ (${content.split(/\s+/).length} words)`);
        } catch (err) {
          console.log(
            `❌ ${err instanceof Error ? err.message : String(err)}`
          );
        }

        await sleep(1000);
      }

      // ── Generate synthesis ───────────────────────────────────────

      process.stdout.write("   Generating debate synthesis... ");

      // Build source material with all posts
      const allPosts = db
        .prepare(
          `SELECT dp.content, dp.phase, ph.name AS philosopher_name
           FROM debate_posts dp
           JOIN philosophers ph ON dp.philosopher_id = ph.id
           WHERE dp.debate_id = ?
           ORDER BY dp.sort_order ASC`
        )
        .all(debate.id) as {
        content: string;
        phase: string;
        philosopher_name: string;
      }[];

      let synthesisMaterial = `DEBATE TOPIC: ${debate.title}\n\n`;
      for (const post of allPosts) {
        synthesisMaterial += `[${post.philosopher_name} — ${post.phase}]\n${post.content}\n\n`;
      }

      try {
        const result = await generateSynthesis(
          "debate_synthesis",
          synthesisMaterial
        );

        if (!result.success) {
          console.log(`❌ ${result.error}`);
        } else {
          const data = result.data;
          const tensions = (data.tensions as string[]) ?? [];
          const agreements = (data.agreements as string[]) ?? [];
          const questions = (data.questionsForReflection as string[]) ?? [];
          const summary = (data.synthesisSummary as Record<string, string>) ?? {};

          updateDebateSynthesis.run(
            JSON.stringify(tensions),
            JSON.stringify(agreements),
            JSON.stringify(questions),
            summary.agree ?? "",
            summary.diverge ?? "",
            summary.unresolvedQuestion ?? "",
            debate.id
          );

          console.log("✅");
        }
      } catch (err) {
        console.log(
          `❌ ${err instanceof Error ? err.message : String(err)}`
        );
      }

      await sleep(1000);
    }

    console.log("");
  }

  // ── Step 3: Create agora threads ────────────────────────────────────

  let totalAgoraResponses = 0;

  const insertThread = db.prepare(`
    INSERT INTO agora_threads (id, question, asked_by, status, created_at)
    VALUES (?, ?, ?, 'complete', ?)
  `);

  const insertThreadPhilosopher = db.prepare(
    "INSERT INTO agora_thread_philosophers (thread_id, philosopher_id) VALUES (?, ?)"
  );

  const insertAgoraResponse = db.prepare(`
    INSERT INTO agora_responses (id, thread_id, philosopher_id, posts, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertAgoraSynthesis = db.prepare(`
    INSERT INTO agora_synthesis (thread_id, tensions, agreements, practical_takeaways)
    VALUES (?, ?, ?, ?)
  `);

  for (const thread of AGORA_THREADS) {
    console.log(`❓ Agora: "${thread.question.slice(0, 80)}..."`);
    console.log(`   Philosophers: ${thread.philosophers.join(", ")}\n`);

    const createdAt = new Date(
      Date.now() - thread.hoursAgo * 60 * 60 * 1000
    )
      .toISOString()
      .replace("T", " ")
      .slice(0, 19);

    insertThread.run(thread.id, thread.question, thread.askedBy, createdAt);

    for (const pid of thread.philosophers) {
      insertThreadPhilosopher.run(thread.id, pid);
    }

    // Generate responses
    const allResponses: { philosopherId: string; name: string; posts: string[] }[] = [];
    let responseSortOrder = 0;

    for (const pid of thread.philosophers) {
      if (missingPrompts.includes(pid)) {
        console.log(`   ⚠️  Skipping response for ${pid} (no active prompt)`);
        continue;
      }

      process.stdout.write(`   Generating response from ${pid}... `);

      try {
        const result = await generateContent(
          pid,
          "agora_response",
          `USER QUESTION: ${thread.question}\n\nAsked by: ${thread.askedBy}`
        );

        if (!result.success) {
          console.log(`❌ ${result.error}`);
          await sleep(1000);
          continue;
        }

        const posts = (result.data.posts as string[]) ?? [];

        const responseId = `ar-${thread.id.split("-")[1]}-${pid}`;
        insertAgoraResponse.run(
          responseId,
          thread.id,
          pid,
          JSON.stringify(posts),
          responseSortOrder++
        );

        const nameRow = db
          .prepare("SELECT name FROM philosophers WHERE id = ?")
          .get(pid) as { name: string } | undefined;

        allResponses.push({
          philosopherId: pid,
          name: nameRow?.name ?? pid,
          posts,
        });

        totalAgoraResponses++;
        console.log(`✅ (${posts.length} post${posts.length > 1 ? "s" : ""})`);
      } catch (err) {
        console.log(
          `❌ ${err instanceof Error ? err.message : String(err)}`
        );
      }

      await sleep(1000);
    }

    // Generate agora synthesis
    process.stdout.write("   Generating agora synthesis... ");

    let synthesisMaterial = `USER QUESTION: ${thread.question}\nAsked by: ${thread.askedBy}\n\n`;
    for (const resp of allResponses) {
      synthesisMaterial += `[${resp.name}]\n`;
      for (const post of resp.posts) {
        synthesisMaterial += `${post}\n\n`;
      }
    }

    try {
      const result = await generateSynthesis("agora_synthesis", synthesisMaterial);

      if (!result.success) {
        console.log(`❌ ${result.error}`);
      } else {
        const data = result.data;
        insertAgoraSynthesis.run(
          thread.id,
          JSON.stringify((data.tensions as string[]) ?? []),
          JSON.stringify((data.agreements as string[]) ?? []),
          JSON.stringify((data.practicalTakeaways as string[]) ?? [])
        );
        console.log("✅");
      }
    } catch (err) {
      console.log(
        `❌ ${err instanceof Error ? err.message : String(err)}`
      );
    }

    console.log("");
    await sleep(1000);
  }

  // ── Summary ─────────────────────────────────────────────────────────

  const debateCount = (
    db.prepare("SELECT COUNT(*) as c FROM debates").get() as { c: number }
  ).c;
  const postCount = (
    db.prepare("SELECT COUNT(*) as c FROM debate_posts").get() as { c: number }
  ).c;
  const threadCount = (
    db.prepare("SELECT COUNT(*) as c FROM agora_threads").get() as {
      c: number;
    }
  ).c;
  const responseCount = (
    db.prepare("SELECT COUNT(*) as c FROM agora_responses").get() as {
      c: number;
    }
  ).c;

  console.log(
    `\n✅ Done! Created ${debateCount} debates (${postCount} posts), ${threadCount} agora threads (${responseCount} responses)\n`
  );
}

// ── Dry-run output ──────────────────────────────────────────────────────

function dryRunSummary() {
  console.log("  DEBATES TO CREATE:");
  for (const d of DEBATES) {
    console.log(`\n  📋 [${d.id}] ${d.title}`);
    console.log(`     Status: ${d.status}`);
    console.log(`     Date: ${d.debateDate}`);
    console.log(`     Trigger: ${d.triggerArticleTitle} (${d.triggerArticleSource})`);
    console.log(`     Philosophers: ${d.philosophers.join(", ")}`);
    console.log(`     Will generate:`);
    console.log(`       - ${d.philosophers.length} opening statements`);
    if (d.status === "complete") {
      console.log(`       - ${d.philosophers.length} rebuttals (circular)`);
      console.log(`       - 1 synthesis`);
    } else {
      console.log(`       - No rebuttals or synthesis (in_progress)`);
    }
  }

  console.log("\n\n  AGORA THREADS TO CREATE:");
  for (const t of AGORA_THREADS) {
    console.log(`\n  ❓ [${t.id}] "${t.question.slice(0, 70)}..."`);
    console.log(`     Asked by: ${t.askedBy}`);
    console.log(`     Philosophers: ${t.philosophers.join(", ")}`);
    console.log(`     Will generate:`);
    console.log(`       - ${t.philosophers.length} responses`);
    console.log(`       - 1 synthesis`);
  }

  const totalApiCalls =
    DEBATES.reduce((sum, d) => {
      let calls = d.philosophers.length; // openings
      if (d.status === "complete") {
        calls += d.philosophers.length; // rebuttals
        calls += 1; // synthesis
      }
      return sum + calls;
    }, 0) +
    AGORA_THREADS.reduce(
      (sum, t) => sum + t.philosophers.length + 1, // responses + synthesis
      0
    );

  console.log(`\n\n  Total API calls: ~${totalApiCalls}`);
  console.log("  Estimated time: ~" + totalApiCalls + " minutes (1s delay between calls)\n");
  console.log("✅ Dry run complete. Remove --dry-run to execute.\n");
}

// ── Run ─────────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
