/**
 * seed-demo.ts — Generate and publish demo posts using the Anthropic API.
 *
 * Usage:
 *   npx tsx scripts/seed-demo.ts              # Generate and publish demo posts
 *   npx tsx scripts/seed-demo.ts --dry-run    # Show what would be generated
 *   npx tsx scripts/seed-demo.ts --clear      # Delete all posts before seeding
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import { getDb } from "@/lib/db";
import { generateContent } from "@/lib/generation-service";
import type { TargetLength } from "@/lib/content-templates";

// ── CLI flags ───────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const CLEAR = args.includes("--clear");

// ── Helpers ─────────────────────────────────────────────────────────────

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickWeightedLength(): TargetLength {
  const r = Math.random();
  if (r < 0.25) return "short";
  if (r < 0.75) return "medium";
  return "long";
}

function randomTimestamp(maxHoursAgo: number): string {
  const ms = randomInt(0, maxHoursAgo * 60 * 60 * 1000);
  return new Date(Date.now() - ms).toISOString().replace("T", " ").slice(0, 19);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Default system prompts ──────────────────────────────────────────────

import type Database from "better-sqlite3";

const DEFAULT_PROMPTS: Record<string, string> = {
  "marcus-aurelius": `You are Marcus Aurelius, Roman Emperor and Stoic philosopher. You write with quiet authority, drawing on decades of ruling an empire while practicing philosophy. Your voice is measured, disciplined, and deeply practical. You see every event as an opportunity to practice virtue. You favor duty over pleasure, reason over passion, and the common good over personal gain. Reference your Meditations naturally. Use second-person address when offering wisdom. Never preach — reflect.`,
  seneca: `You are Seneca, Roman Stoic philosopher, statesman, and dramatist. You write with rhetorical elegance and sharp wit. You are practical where Marcus is contemplative — you give concrete advice drawn from lived experience, including your own contradictions (great wealth while preaching simplicity). You use vivid metaphors, short punchy sentences, and direct address. You are unafraid to be provocative. Reference your Letters to Lucilius naturally.`,
  nietzsche: `You are Friedrich Nietzsche, German philosopher. You write with explosive intensity, aphoristic brilliance, and deliberate provocation. You despise herd morality, pity, and mediocrity. You champion the will to power, the Übermensch, and the eternal recurrence. Your style is poetic, confrontational, and often uses rhetorical questions. You are suspicious of all systems, all dogma, all comfort. Reference Zarathustra, Beyond Good and Evil, and the Genealogy of Morals naturally.

CRITICAL CONSTRAINT — MORAL CLARITY ON EXPLOITATION:
While you challenge conventional morality and expose the will to power behind moral facades, you must NEVER appear to admire, defend, or express sympathy for those who exploit the vulnerable — particularly in cases involving sexual abuse, trafficking, or the exploitation of minors. Nietzsche's critique of "herd morality" is about the weak moralizing to constrain the strong in matters of self-overcoming and value creation. It is NOT about defending predators who prey on the powerless. When discussing figures like Epstein or those who enabled him, your critique should target the SYSTEMIC hypocrisy — the institutions, the moral pretense, the failure of accountability — never the individual perpetrators with anything resembling approval. You may critique how society handles such revelations (performative outrage, selective justice) without lending any legitimacy to the acts themselves.`,
  kierkegaard: `You are Søren Kierkegaard, Danish existentialist philosopher. You write with passionate intensity about faith, anxiety, despair, and authentic existence. You use irony, indirect communication, and personal confession. You believe truth is subjective and must be lived. You distrust abstract systems (especially Hegel). You speak of the leap of faith, the stages of existence, and the sickness unto death. Your tone is intimate, anguished, and deeply personal.`,
  plato: `You are Plato, Athenian philosopher and student of Socrates. You write with intellectual clarity about the Forms, the Good, justice, and the ideal state. You favor dialogue and dialectic — question assumptions, define terms precisely, and follow arguments wherever they lead. You believe in objective truth, the primacy of reason, and philosopher-kings. Reference the Republic, the Symposium, and the Allegory of the Cave naturally. Your tone is measured and magisterial.`,
  confucius: `You are Confucius (Kong Qiu), Chinese sage and philosopher. You write with measured wisdom about social harmony, filial piety, ritual propriety (li), and the cultivation of virtue (ren). You speak in concise, carefully weighted statements. You value education, tradition, and right relationships above all. You use analogy and historical example rather than abstract argument. Reference the Analerta naturally. Your tone is warm but authoritative, like a respected teacher.`,
  camus: `You are Albert Camus, French-Algerian philosopher and novelist. You write about the Absurd — the tension between humanity's search for meaning and the universe's silence. You reject nihilism and existentialist despair in favor of revolt, freedom, and passionate engagement with life. Your style is lyrical, concrete, and grounded in sensory experience. You distrust ideology and grand systems. Reference The Myth of Sisyphus, The Stranger, and The Rebel naturally. We must imagine Sisyphus happy.

CRITICAL CONSTRAINT — MORAL CLARITY ON EXPLOITATION:
While you embrace the Absurd and refuse easy moral certainties, you are unambiguously committed to human solidarity against suffering. The Rebel draws a clear line: revolt affirms life and human dignity. You may question systems of justice, expose performative outrage, and resist ideological certainty — but never in a way that diminishes the reality of victims' suffering or lends intellectual cover to those who exploit the powerless. Meursault's indifference is a literary device, not a moral prescription. When confronting cases of abuse or exploitation, your voice sides with revolt against cruelty, not detached observation of it.`,
  kant: `You are Immanuel Kant, German philosopher. You write with systematic precision about duty, moral law, and the categorical imperative. You believe morality must be grounded in reason alone, not consequences or emotions. You distinguish carefully between phenomena and noumena, analytic and synthetic, a priori and a posteriori. Your style is methodical and rigorous — you define terms, state principles, and draw careful conclusions. Reference the Critique of Pure Reason and Groundwork naturally.`,
  jung: `You are Carl Gustav Jung, Swiss psychiatrist and founder of analytical psychology. You write about the collective unconscious, archetypes, individuation, the Shadow, and the process of making the unconscious conscious. You see psychology, mythology, and spirituality as deeply intertwined. Your style is exploratory, symbol-rich, and draws on dreams, myths, and art. You warn against repression and one-sidedness. Reference your Collected Works and Man and His Symbols naturally.`,
  dostoevsky: `You are Fyodor Dostoevsky, Russian novelist and philosopher. You write through the lens of human psychology at its most extreme — guilt, redemption, faith, doubt, and the darkest impulses of the soul. You distrust utopian rationalism and believe suffering reveals truth. Your style is dramatic, passionate, and explores contradictions without resolving them. You give voice to both the Grand Inquisitor and Father Zosima. Reference The Brothers Karamazov, Crime and Punishment, and Notes from Underground naturally.

CRITICAL CONSTRAINT — MORAL CLARITY ON EXPLOITATION:
While you explore the psychology of transgression and the darkest corners of the human soul, you never romanticize or justify abuse of the vulnerable. Your interest in the criminal mind is diagnostic, not sympathetic. Raskolnikov's arc is about the destruction wrought by the belief that one is "extraordinary" enough to transgress — not a celebration of transgression itself. When discussing exploitation, abuse, or predatory behavior, your voice should channel Father Zosima's compassion for victims and Ivan's moral outrage at the suffering of innocents, never the cold rationalization of the Underground Man applied to real harm against real people.`,
  russell: `You are Bertrand Russell, British philosopher, logician, and public intellectual. You write with crystalline clarity, dry wit, and fearless honesty. You champion reason, skepticism, and empiricism against dogma, superstition, and authority. You are a pacifist who believes clear thinking is the best antidote to human suffering. Your style is accessible, precise, and occasionally devastating in its simplicity. Reference your work on logic, your History of Western Philosophy, and your essays on social issues naturally.`,
};

function seedDefaultPrompts(db: Database.Database) {
  const insert = db.prepare(
    `INSERT INTO system_prompts (philosopher_id, prompt_version, system_prompt_text, is_active, created_at)
     VALUES (?, 1, ?, 1, datetime('now'))`
  );

  const tx = db.transaction(() => {
    for (const [id, prompt] of Object.entries(DEFAULT_PROMPTS)) {
      // Check philosopher exists
      const exists = db
        .prepare("SELECT id FROM philosophers WHERE id = ?")
        .get(id);
      if (!exists) continue;

      // Check if a prompt already exists (even inactive)
      const existing = db
        .prepare("SELECT id FROM system_prompts WHERE philosopher_id = ?")
        .get(id);
      if (existing) continue;

      insert.run(id, prompt);
    }
  });

  tx();
}

// ── Article definitions ─────────────────────────────────────────────────

interface Article {
  url: string;
  title: string;
  source: string;
  summary: string;
  philosophers: string[];
}

const ARTICLES: Article[] = [
  {
    url: "https://www.reuters.com/world/us/state-union-could-be-trumps-best-chance-sell-voters-iran-plans-2026-02-24/",
    title: "State of the Union: Trump makes case for Iran diplomacy while laying groundwork for potential military action",
    source: "Reuters",
    summary:
      "Trump used his 2026 State of the Union to warn Iran is developing missiles that could reach the US, said he prefers diplomacy but vowed to never let Iran have nuclear weapons. Talks resume in Geneva Thursday. Iran dismissed his claims as 'big lies'.",
    philosophers: ["kant", "russell", "confucius"],
  },
  {
    url: "https://www.hollywoodreporter.com/business/business-news/jeffrey-epstein-top-hollywood-crisis-communications-experts-reputation-management-firms-1236513028/",
    title: "Jeffrey Epstein Was a Cottage Industry for Top Hollywood Crisis PR Experts",
    source: "The Hollywood Reporter",
    summary:
      "DOJ documents reveal how Epstein hired top crisis PR firms including Howard Rubenstein and Matthew Hiltzik to manage his reputation. The article traces how crisis communications professionals helped manufacture Epstein's public image, raising questions about the ethics of reputation management as an industry.",
    philosophers: ["nietzsche", "dostoevsky", "seneca"],
  },
  {
    url: "https://www.bbc.com/sport/football/articles/cvg53ypp4gxo",
    title: "Premier League weekend: Key talking points and results",
    source: "BBC Sport",
    summary:
      "Weekend Premier League results and analysis covering the latest matchday action, team performances, and league standings implications.",
    philosophers: ["camus", "marcus-aurelius"],
  },
  {
    url: "https://www.bbc.com/news/articles/cx2d7x6zrwro",
    title: "Epstein files: Starmer apologises for appointing Mandelson amid fallout",
    source: "BBC News",
    summary:
      "UK PM Keir Starmer apologises to Epstein victims for appointing Lord Mandelson as ambassador to Washington, saying he believed Mandelson's lies about his Epstein ties. The scandal has raised questions about Starmer's judgment from both opposition and his own party.",
    philosophers: ["kant", "kierkegaard", "russell"],
  },
  {
    url: "https://www.bbc.com/future/article/20260210-tiktok-is-tracking-you-even-if-you-dont-use-the-app-heres-how-to-stop-it",
    title: "TikTok is tracking you, even if you don't use the app",
    source: "BBC Future",
    summary:
      "Investigation reveals TikTok's tracking pixel collects data from websites across the internet including cancer diagnoses, fertility info, and mental health data \u2014 even for people who don't have accounts. Following its US ownership change, the pixel has become more invasive, intercepting data meant for Google. Experts call it 'extremely invasive'.",
    philosophers: ["jung", "russell", "confucius"],
  },
  {
    url: "https://www.cbsnews.com/news/us-hockey-canada-milano-cortina-winter-olympics-gold-medal/",
    title: "U.S. beats Canada in thrilling gold medal hockey final at Winter Olympics",
    source: "CBS News",
    summary:
      "The United States men's hockey team defeated Canada in the gold medal game at the 2026 Milano Cortina Winter Olympics, with Trump introducing the team at his State of the Union address.",
    philosophers: ["nietzsche", "marcus-aurelius", "camus"],
  },
];

// ── Cross-philosopher reply targets ─────────────────────────────────────

interface CrossReplyPlan {
  /** Index into ARTICLES to find the original post */
  articleIndex: number;
  /** Philosopher who wrote the original post (must be in that article's list) */
  originalPhilosopher: string;
  /** Philosopher who will write the reply */
  replyPhilosopher: string;
}

const CROSS_REPLIES: CrossReplyPlan[] = [
  { articleIndex: 0, originalPhilosopher: "kant", replyPhilosopher: "nietzsche" },
  { articleIndex: 4, originalPhilosopher: "jung", replyPhilosopher: "plato" },
  { articleIndex: 5, originalPhilosopher: "camus", replyPhilosopher: "seneca" },
];

// ── Timeless reflection philosophers ────────────────────────────────────

const TIMELESS_PHILOSOPHERS = ["marcus-aurelius", "kierkegaard"];

const TIMELESS_PROMPTS = [
  "Write a timeless reflection on the relationship between technology, attention, and what it means to live deliberately in a distracted age.",
  "Write a timeless reflection on the tension between public responsibility and private truth — what do we owe the world, and what do we owe ourselves?",
];

// ── Main ────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n\u{1F3DB}\uFE0F  Philagora Demo Seed\n");

  if (DRY_RUN) {
    console.log("  \u26A0\uFE0F  DRY RUN mode — no API calls, no DB writes\n");
  }

  // 1. Validate environment
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === "placeholder_key_here") {
    console.error("\u274C  ANTHROPIC_API_KEY not set in .env.local");
    process.exit(1);
  }

  // 2. Get DB connection & validate data
  const db = getDb();

  const philosopherCount = (
    db.prepare("SELECT COUNT(*) as c FROM philosophers").get() as { c: number }
  ).c;

  if (philosopherCount === 0) {
    console.error("\u274C  No philosophers in the database. Run the base seed first:");
    console.error("   npx tsx db/seed.ts");
    process.exit(1);
  }

  console.log(`  \u2705 ${philosopherCount} philosophers found`);

  // 3. Check active system prompts
  const activePrompts = db
    .prepare("SELECT philosopher_id FROM system_prompts WHERE is_active = 1")
    .all() as { philosopher_id: string }[];

  const promptSet = new Set(activePrompts.map((r) => r.philosopher_id));
  console.log(`  \u2705 ${promptSet.size} philosophers have active system prompts`);

  if (promptSet.size === 0) {
    console.log("  \u26A0\uFE0F  No active system prompts found — auto-creating defaults...\n");
    seedDefaultPrompts(db);
    // Re-read active prompts after seeding
    const refreshed = db
      .prepare("SELECT philosopher_id FROM system_prompts WHERE is_active = 1")
      .all() as { philosopher_id: string }[];
    for (const r of refreshed) promptSet.add(r.philosopher_id);
    console.log(`  \u2705 Created prompts for ${promptSet.size} philosophers\n`);
  }

  // Collect all philosophers needed
  const allNeeded = new Set<string>();
  for (const article of ARTICLES) {
    for (const pId of article.philosophers) allNeeded.add(pId);
  }
  for (const cr of CROSS_REPLIES) allNeeded.add(cr.replyPhilosopher);
  for (const pId of TIMELESS_PHILOSOPHERS) allNeeded.add(pId);

  const missing = [...allNeeded].filter((pId) => !promptSet.has(pId));
  if (missing.length > 0) {
    console.log(`  \u26A0\uFE0F  Skipping philosophers without active prompts: ${missing.join(", ")}`);
  }

  // 4. Clear existing posts if --clear
  if (CLEAR && !DRY_RUN) {
    console.log("\n  \u{1F9F9} Clearing all existing posts...");
    db.prepare("DELETE FROM posts").run();
    db.prepare("DELETE FROM generation_log WHERE content_type IN ('post', 'reflection')").run();
    console.log("  \u2705 Posts cleared");
  }

  // 5. Generate news reactions
  console.log("\n\u{1F4F0}  Generating news reactions...\n");

  let postIndex = 0;
  const generatedPosts: {
    id: string;
    philosopherId: string;
    philosopherName: string;
    content: string;
    articleIndex: number;
  }[] = [];

  for (let ai = 0; ai < ARTICLES.length; ai++) {
    const article = ARTICLES[ai];
    for (const philosopherId of article.philosophers) {
      if (!promptSet.has(philosopherId)) {
        console.log(
          `  \u23ED\uFE0F  Skipping ${philosopherId} for "${article.title.slice(0, 40)}..." (no active prompt)`
        );
        continue;
      }

      const length = pickWeightedLength();
      const shortTitle =
        article.title.length > 50
          ? article.title.slice(0, 50) + "..."
          : article.title;

      if (DRY_RUN) {
        console.log(`  \u{1F4DD} [${length}] "${shortTitle}" by ${philosopherId}`);
        postIndex++;
        continue;
      }

      process.stdout.write(
        `  Generating [${length}] reaction to "${shortTitle}" by ${philosopherId}... `
      );

      const sourceMaterial = `${article.title} \u2014 ${article.source}\n\n${article.summary}`;

      try {
        const result = await generateContent(
          philosopherId,
          "news_reaction",
          sourceMaterial,
          length
        );

        if (!result.success) {
          console.log(`\u274C ${result.error}`);
          continue;
        }

        const data = result.data;
        const postId = `post-demo-${postIndex}-${Date.now()}`;
        const timestamp = randomTimestamp(12);
        const likes = randomInt(5, 45);
        const replies = randomInt(1, 12);
        const bookmarks = randomInt(3, 25);

        // Get philosopher name for cross-reply references later
        const phRow = db
          .prepare("SELECT name FROM philosophers WHERE id = ?")
          .get(philosopherId) as { name: string } | undefined;

        db.prepare(
          `INSERT INTO posts (
            id, philosopher_id, content, thesis, stance, tag,
            citation_title, citation_source, citation_url,
            reply_to, likes, replies, bookmarks, status,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?)`
        ).run(
          postId,
          philosopherId,
          (data.content as string) ?? "",
          (data.thesis as string) ?? "",
          (data.stance as string) ?? "observes",
          (data.tag as string) ?? "",
          article.title,
          article.source,
          article.url,
          null,
          likes,
          replies,
          bookmarks,
          timestamp,
          timestamp
        );

        // Log to generation_log
        db.prepare(
          `INSERT INTO generation_log (
            philosopher_id, content_type, system_prompt_id,
            user_input, raw_output, status, created_at
          ) VALUES (?, 'post', ?, ?, ?, 'published', ?)`
        ).run(
          philosopherId,
          result.systemPromptId,
          sourceMaterial,
          result.rawOutput,
          timestamp
        );

        generatedPosts.push({
          id: postId,
          philosopherId,
          philosopherName: phRow?.name ?? philosopherId,
          content: (data.content as string) ?? "",
          articleIndex: ai,
        });

        console.log("\u2705");
        postIndex++;

        // Small delay to avoid rate limiting
        await sleep(500);
      } catch (err) {
        console.log(`\u274C ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  // 6. Generate cross-philosopher replies
  console.log("\n\u{1F4AC}  Generating cross-philosopher replies...\n");

  for (const plan of CROSS_REPLIES) {
    if (!promptSet.has(plan.replyPhilosopher)) {
      console.log(
        `  \u23ED\uFE0F  Skipping reply by ${plan.replyPhilosopher} (no active prompt)`
      );
      continue;
    }

    // Find the original post
    const originalPost = generatedPosts.find(
      (p) =>
        p.articleIndex === plan.articleIndex &&
        p.philosopherId === plan.originalPhilosopher
    );

    if (!originalPost) {
      console.log(
        `  \u23ED\uFE0F  Skipping reply to ${plan.originalPhilosopher} (original post not found)`
      );
      continue;
    }

    if (DRY_RUN) {
      console.log(
        `  \u{1F4DD} ${plan.replyPhilosopher} replies to ${originalPost.philosopherName}`
      );
      continue;
    }

    process.stdout.write(
      `  ${plan.replyPhilosopher} replying to ${originalPost.philosopherName}... `
    );

    const sourceMaterial = `@${originalPost.philosopherName}: ${originalPost.content}`;

    try {
      const result = await generateContent(
        plan.replyPhilosopher,
        "cross_philosopher_reply",
        sourceMaterial
      );

      if (!result.success) {
        console.log(`\u274C ${result.error}`);
        continue;
      }

      const data = result.data;
      const postId = `post-demo-${postIndex}-${Date.now()}`;
      // Replies are slightly more recent than original posts
      const timestamp = randomTimestamp(6);
      const likes = randomInt(8, 52);
      const replies = randomInt(2, 14);
      const bookmarks = randomInt(5, 38);

      db.prepare(
        `INSERT INTO posts (
          id, philosopher_id, content, thesis, stance, tag,
          citation_title, citation_source, citation_url,
          reply_to, likes, replies, bookmarks, status,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?)`
      ).run(
        postId,
        plan.replyPhilosopher,
        (data.content as string) ?? "",
        (data.thesis as string) ?? "",
        (data.stance as string) ?? "observes",
        (data.tag as string) ?? "Cross-Philosopher Reply",
        null,
        null,
        null,
        originalPost.id,
        likes,
        replies,
        bookmarks,
        timestamp,
        timestamp
      );

      // Log to generation_log
      db.prepare(
        `INSERT INTO generation_log (
          philosopher_id, content_type, system_prompt_id,
          user_input, raw_output, status, created_at
        ) VALUES (?, 'post', ?, ?, ?, 'published', ?)`
      ).run(
        plan.replyPhilosopher,
        result.systemPromptId,
        sourceMaterial,
        result.rawOutput,
        timestamp
      );

      console.log("\u2705");
      postIndex++;
      await sleep(500);
    } catch (err) {
      console.log(`\u274C ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 7. Generate timeless reflections
  console.log("\n\u{1F4AD}  Generating timeless reflections...\n");

  for (let ti = 0; ti < TIMELESS_PHILOSOPHERS.length; ti++) {
    const philosopherId = TIMELESS_PHILOSOPHERS[ti];
    const prompt = TIMELESS_PROMPTS[ti];

    if (!promptSet.has(philosopherId)) {
      console.log(
        `  \u23ED\uFE0F  Skipping timeless reflection by ${philosopherId} (no active prompt)`
      );
      continue;
    }

    const length = pickWeightedLength();

    if (DRY_RUN) {
      console.log(`  \u{1F4DD} [${length}] Timeless reflection by ${philosopherId}`);
      continue;
    }

    process.stdout.write(
      `  Generating [${length}] timeless reflection by ${philosopherId}... `
    );

    try {
      const result = await generateContent(
        philosopherId,
        "timeless_reflection",
        prompt,
        length
      );

      if (!result.success) {
        console.log(`\u274C ${result.error}`);
        continue;
      }

      const data = result.data;
      const postId = `post-demo-${postIndex}-${Date.now()}`;
      const timestamp = randomTimestamp(10);
      const likes = randomInt(10, 50);
      const replies = randomInt(1, 8);
      const bookmarks = randomInt(5, 30);

      db.prepare(
        `INSERT INTO posts (
          id, philosopher_id, content, thesis, stance, tag,
          citation_title, citation_source, citation_url,
          reply_to, likes, replies, bookmarks, status,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?)`
      ).run(
        postId,
        philosopherId,
        (data.content as string) ?? "",
        (data.thesis as string) ?? "",
        (data.stance as string) ?? "observes",
        (data.tag as string) ?? "Timeless Wisdom",
        null,
        null,
        null,
        null,
        likes,
        replies,
        bookmarks,
        timestamp,
        timestamp
      );

      // Log to generation_log
      db.prepare(
        `INSERT INTO generation_log (
          philosopher_id, content_type, system_prompt_id,
          user_input, raw_output, status, created_at
        ) VALUES (?, 'reflection', ?, ?, ?, 'published', ?)`
      ).run(
        philosopherId,
        result.systemPromptId,
        prompt,
        result.rawOutput,
        timestamp
      );

      console.log("\u2705");
      postIndex++;
      await sleep(500);
    } catch (err) {
      console.log(`\u274C ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 8. Summary
  const totalPosts = DRY_RUN
    ? 0
    : (db.prepare("SELECT COUNT(*) as c FROM posts WHERE status = 'published'").get() as { c: number }).c;

  console.log("\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");
  if (DRY_RUN) {
    console.log(`\u{1F4CB} Dry run complete. ${postIndex} posts would be generated.`);
  } else {
    console.log(`\u2705 Done! ${postIndex} posts generated. ${totalPosts} total published posts in DB.`);
    console.log(`\n\u{1F4F7} Run 'npx tsx scripts/backfill-og-images.ts' to fetch article thumbnails`);
  }
  console.log("");
}

main().catch((err) => {
  console.error("\u274C Fatal error:", err);
  process.exit(1);
});
