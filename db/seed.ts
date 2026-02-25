/**
 * Seed script — imports all existing hardcoded data into SQLite.
 * Run with: npx tsx db/seed.ts
 */

import { initDb } from "./index";
import { philosophers } from "../src/data/philosophers";
import { posts } from "../src/data/posts";
import { debates } from "../src/data/debates";
import { agoraThreads } from "../src/data/agora";

const db = initDb();

// ── Helper: delete existing data (safe re-seed) ─────────────────────
console.log("🏛️  Philagora seed — starting...\n");

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

// ── Philosophers ─────────────────────────────────────────────────────

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

// ── Posts ─────────────────────────────────────────────────────────────

const insertPost = db.prepare(`
  INSERT INTO posts (id, philosopher_id, content, thesis, stance, tag, citation_title, citation_source, citation_url, citation_image_url, reply_to, likes, replies, bookmarks, status, created_at, updated_at)
  VALUES (@id, @philosopher_id, @content, @thesis, @stance, @tag, @citation_title, @citation_source, @citation_url, @citation_image_url, @reply_to, @likes, @replies, @bookmarks, @status, @created_at, @updated_at)
`);

function relativeToAbsolute(timestamp: string): string {
  const now = new Date();
  const match = timestamp.match(/(\d+)(m|h|d)\s*ago/);
  if (match) {
    const amount = parseInt(match[1]);
    const unit = match[2];
    if (unit === "m") now.setMinutes(now.getMinutes() - amount);
    else if (unit === "h") now.setHours(now.getHours() - amount);
    else if (unit === "d") now.setDate(now.getDate() - amount);
  }
  return now.toISOString().replace("T", " ").replace("Z", "").split(".")[0];
}

const insertPosts = db.transaction(() => {
  for (const post of posts) {
    const createdAt = relativeToAbsolute(post.timestamp);
    insertPost.run({
      id: post.id,
      philosopher_id: post.philosopherId,
      content: post.content,
      thesis: post.thesis,
      stance: post.stance,
      tag: post.tag,
      citation_title: post.citation?.title ?? null,
      citation_source: post.citation?.source ?? null,
      citation_url: post.citation?.url ?? null,
      citation_image_url: post.citation?.imageUrl ?? null,
      reply_to: post.replyTo ?? null,
      likes: post.likes,
      replies: post.replies,
      bookmarks: post.bookmarks,
      status: "published",
      created_at: createdAt,
      updated_at: createdAt,
    });
  }
});

insertPosts();
console.log(`  ✓ Posts: ${posts.length} inserted`);

// ── Debates ──────────────────────────────────────────────────────────

const insertDebate = db.prepare(`
  INSERT INTO debates (id, title, trigger_article_title, trigger_article_source, trigger_article_url, status, debate_date, synthesis_tensions, synthesis_agreements, synthesis_questions, synthesis_summary_agree, synthesis_summary_diverge, synthesis_summary_unresolved)
  VALUES (@id, @title, @trigger_article_title, @trigger_article_source, @trigger_article_url, @status, @debate_date, @synthesis_tensions, @synthesis_agreements, @synthesis_questions, @synthesis_summary_agree, @synthesis_summary_diverge, @synthesis_summary_unresolved)
`);

const insertDebatePhilosopher = db.prepare(`
  INSERT INTO debate_philosophers (debate_id, philosopher_id)
  VALUES (@debate_id, @philosopher_id)
`);

const insertDebatePost = db.prepare(`
  INSERT INTO debate_posts (id, debate_id, philosopher_id, content, phase, reply_to, sort_order)
  VALUES (@id, @debate_id, @philosopher_id, @content, @phase, @reply_to, @sort_order)
`);

// Map the TS status strings to our DB enum
function mapDebateStatus(s: string): string {
  const map: Record<string, string> = {
    "Complete": "complete",
    "In Progress": "in_progress",
    "Scheduled": "scheduled",
  };
  return map[s] ?? "scheduled";
}

const insertDebates = db.transaction(() => {
  for (const d of Object.values(debates)) {
    insertDebate.run({
      id: d.id,
      title: d.title,
      trigger_article_title: d.triggerArticle.title,
      trigger_article_source: d.triggerArticle.source,
      trigger_article_url: d.triggerArticle.url ?? null,
      status: mapDebateStatus(d.status),
      debate_date: d.date,
      synthesis_tensions: JSON.stringify(d.synthesis.tensions),
      synthesis_agreements: JSON.stringify(d.synthesis.agreements),
      synthesis_questions: JSON.stringify(d.synthesis.questionsForReflection),
      synthesis_summary_agree: d.synthesisSummary.agree,
      synthesis_summary_diverge: d.synthesisSummary.diverge,
      synthesis_summary_unresolved: d.synthesisSummary.unresolvedQuestion,
    });

    // Junction: debate ↔ philosophers
    for (const pId of d.philosophers) {
      insertDebatePhilosopher.run({ debate_id: d.id, philosopher_id: pId });
    }

    // Debate posts
    for (let i = 0; i < d.posts.length; i++) {
      const dp = d.posts[i];
      insertDebatePost.run({
        id: dp.id,
        debate_id: d.id,
        philosopher_id: dp.philosopherId,
        content: dp.content,
        phase: dp.phase,
        reply_to: dp.replyTo ?? null,
        sort_order: i,
      });
    }
  }
});

insertDebates();
const debateCount = Object.keys(debates).length;
const debatePostCount = Object.values(debates).reduce((sum, d) => sum + d.posts.length, 0);
console.log(`  ✓ Debates: ${debateCount} inserted (${debatePostCount} debate posts)`);

// ── Agora Threads ────────────────────────────────────────────────────

const insertAgoraThread = db.prepare(`
  INSERT INTO agora_threads (id, question, asked_by, status, created_at)
  VALUES (@id, @question, @asked_by, @status, @created_at)
`);

const insertAgoraThreadPhilosopher = db.prepare(`
  INSERT INTO agora_thread_philosophers (thread_id, philosopher_id)
  VALUES (@thread_id, @philosopher_id)
`);

const insertAgoraResponse = db.prepare(`
  INSERT INTO agora_responses (id, thread_id, philosopher_id, posts, sort_order)
  VALUES (@id, @thread_id, @philosopher_id, @posts, @sort_order)
`);

const insertAgoraSynthesis = db.prepare(`
  INSERT INTO agora_synthesis (thread_id, tensions, agreements, practical_takeaways)
  VALUES (@thread_id, @tensions, @agreements, @practical_takeaways)
`);

const insertAgoraData = db.transaction(() => {
  const now = new Date().toISOString();
  for (const t of agoraThreads) {
    const hasResponses = t.responses.length > 0;
    const hasSynthesis = t.synthesis.tensions.length > 0 || t.synthesis.agreements.length > 0;
    const status = hasSynthesis ? "complete" : hasResponses ? "in_progress" : "pending";

    insertAgoraThread.run({
      id: t.id,
      question: t.question,
      asked_by: t.askedBy,
      status,
      created_at: now,
    });

    // Junction: thread ↔ philosophers
    for (const pId of t.philosophers) {
      insertAgoraThreadPhilosopher.run({ thread_id: t.id, philosopher_id: pId });
    }

    // Responses
    for (let i = 0; i < t.responses.length; i++) {
      const r = t.responses[i];
      insertAgoraResponse.run({
        id: `${t.id}-resp-${i}`,
        thread_id: t.id,
        philosopher_id: r.philosopherId,
        posts: JSON.stringify(r.posts),
        sort_order: i,
      });
    }

    // Synthesis
    if (hasSynthesis) {
      insertAgoraSynthesis.run({
        thread_id: t.id,
        tensions: JSON.stringify(t.synthesis.tensions),
        agreements: JSON.stringify(t.synthesis.agreements),
        practical_takeaways: JSON.stringify(t.synthesis.practicalTakeaways),
      });
    }
  }
});

insertAgoraData();
console.log(`  ✓ Agora threads: ${agoraThreads.length} inserted`);

// ── Done ─────────────────────────────────────────────────────────────

console.log("\n🏛️  Seed complete!\n");
process.exit(0);
