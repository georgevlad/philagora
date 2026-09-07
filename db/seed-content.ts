import type Database from "better-sqlite3";

import fixtureData from "../scripts/fixtures/seed-content.json";
import { philosophers } from "./philosophers";

type SeedMode = "insert" | "reset";

interface FixturePost {
  id: string;
  philosopher_id: string;
  content: string;
  thesis: string;
  stance: string;
  tag: string;
  source_type: string;
  historical_event_id: string | null;
  recommendation_title: string | null;
  recommendation_author: string | null;
  recommendation_medium: string | null;
  citation_title: string | null;
  citation_source: string | null;
  citation_url: string | null;
  citation_image_url: string | null;
  reply_to: string | null;
  likes: number;
  replies: number;
  bookmarks: number;
  status: "draft" | "published";
  created_at: string;
  updated_at: string;
}

interface FixtureHistoricalEvent {
  id: string;
  title: string;
  event_month: number;
  event_day: number;
  event_year: number | null;
  display_date: string;
  era: string;
  category: string;
  context: string;
  key_themes: string;
  status: string;
  thumbnail_filename: null;
  created_at: string;
  updated_at: string;
}

interface FixtureDebatePost {
  id: string;
  debate_id: string;
  philosopher_id: string;
  content: string;
  phase: string;
  reply_to: string | null;
  sort_order: number;
}

interface FixtureDebate {
  id: string;
  title: string;
  trigger_article_title: string | null;
  trigger_article_source: string | null;
  trigger_article_url: string | null;
  editorial_context: string | null;
  status: string;
  debate_date: string;
  synthesis_tensions: string;
  synthesis_agreements: string;
  synthesis_questions: string;
  synthesis_summary_agree: string;
  synthesis_summary_diverge: string;
  synthesis_summary_unresolved: string;
  philosophers: string[];
  posts: FixtureDebatePost[];
}

interface FixtureAgoraResponse {
  id: string;
  thread_id: string;
  philosopher_id: string;
  posts: string;
  recommendation: string | null;
  sort_order: number;
}

interface FixtureAgoraSynthesis {
  synthesis_type: string;
  sections: string;
  created_at: string;
}

interface FixtureAgoraThread {
  id: string;
  question: string;
  asked_by: "Anonymous";
  status: "complete";
  ip_address: null;
  question_type: string;
  recommendations_enabled: number;
  visibility: "public";
  hidden_from_feed: number;
  user_id: null;
  follow_up_to: string | null;
  article_url: string | null;
  article_title: string | null;
  article_source: string | null;
  article_excerpt: string | null;
  created_at: string;
  philosophers: string[];
  responses: FixtureAgoraResponse[];
  synthesis: FixtureAgoraSynthesis | null;
}

interface SeedFixture {
  version: number;
  sourceSnapshotDate: string;
  systemPrompts: Array<{
    philosopher_id: string;
    prompt_version: number;
    system_prompt_text: string;
  }>;
  moodPalettes: Array<{
    philosopher_id: string;
    registers: string;
    is_active: number;
  }>;
  contentTemplates: Array<{
    template_key: string;
    version: number;
    instructions: string;
    notes: string;
  }>;
  historicalEvents: FixtureHistoricalEvent[];
  posts: FixturePost[];
  debates: FixtureDebate[];
  agoraThreads: FixtureAgoraThread[];
}

const fixture = fixtureData as SeedFixture;

export interface SeedContentSummary {
  philosophers: number;
  systemPrompts: number;
  moodPalettes: number;
  contentTemplates: number;
  historicalEvents: number;
  publishedPosts: number;
  draftPosts: number;
  debates: number;
  debatePosts: number;
  agoraThreads: number;
  agoraResponses: number;
  agoraSyntheses: number;
}

export interface SeedContentResult {
  mode: SeedMode;
  inserted: SeedContentSummary;
  available: SeedContentSummary;
}

export interface SeedContentOptions {
  mode?: SeedMode;
  now?: Date;
}

function emptySummary(): SeedContentSummary {
  return {
    philosophers: 0,
    systemPrompts: 0,
    moodPalettes: 0,
    contentTemplates: 0,
    historicalEvents: 0,
    publishedPosts: 0,
    draftPosts: 0,
    debates: 0,
    debatePosts: 0,
    agoraThreads: 0,
    agoraResponses: 0,
    agoraSyntheses: 0,
  };
}

export function getSeedContentSummary(): SeedContentSummary {
  return {
    philosophers: Object.keys(philosophers).length,
    systemPrompts: fixture.systemPrompts.length,
    moodPalettes: fixture.moodPalettes.length,
    contentTemplates: fixture.contentTemplates.length,
    historicalEvents: fixture.historicalEvents.length,
    publishedPosts: fixture.posts.filter((post) => post.status === "published").length,
    draftPosts: fixture.posts.filter((post) => post.status === "draft").length,
    debates: fixture.debates.length,
    debatePosts: fixture.debates.reduce((sum, debate) => sum + debate.posts.length, 0),
    agoraThreads: fixture.agoraThreads.length,
    agoraResponses: fixture.agoraThreads.reduce(
      (sum, thread) => sum + thread.responses.length,
      0
    ),
    agoraSyntheses: fixture.agoraThreads.filter((thread) => thread.synthesis).length,
  };
}

function parseSqliteTimestamp(value: string): number {
  const timestamp = Date.parse(`${value.replace(" ", "T")}Z`);
  if (!Number.isFinite(timestamp)) {
    throw new Error(`Invalid fixture timestamp: ${value}`);
  }
  return timestamp;
}

function formatSqliteTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString().replace("T", " ").slice(0, 19);
}

function createTimestampShifter(values: string[], targetNewest: Date): (value: string) => string {
  const newest = Math.max(...values.map(parseSqliteTimestamp));
  const offset = targetNewest.getTime() - newest;
  return (value: string) => formatSqliteTimestamp(parseSqliteTimestamp(value) + offset);
}

function validateFixture(): void {
  if (fixture.version !== 1) {
    throw new Error(`Unsupported seed-content fixture version: ${fixture.version}`);
  }

  const philosopherIds = new Set(Object.keys(philosophers));
  const eventIds = new Set(fixture.historicalEvents.map((event) => event.id));
  const postIds = new Set(fixture.posts.map((post) => post.id));
  const agoraIds = new Set(fixture.agoraThreads.map((thread) => thread.id));

  for (const id of [...eventIds, ...postIds, ...agoraIds, ...fixture.debates.map((debate) => debate.id)]) {
    if (!id.startsWith("seed-")) throw new Error(`Fixture contains a non-seed ID: ${id}`);
  }

  for (const post of fixture.posts) {
    if (!philosopherIds.has(post.philosopher_id)) {
      throw new Error(`Post ${post.id} references unknown philosopher ${post.philosopher_id}`);
    }
    if (post.reply_to && !postIds.has(post.reply_to)) {
      throw new Error(`Post ${post.id} references unknown reply target ${post.reply_to}`);
    }
    if (post.historical_event_id && !eventIds.has(post.historical_event_id)) {
      throw new Error(`Post ${post.id} references unknown event ${post.historical_event_id}`);
    }
  }

  for (const debate of fixture.debates) {
    for (const philosopherId of debate.philosophers) {
      if (!philosopherIds.has(philosopherId)) {
        throw new Error(`Debate ${debate.id} references unknown philosopher ${philosopherId}`);
      }
    }
  }

  for (const thread of fixture.agoraThreads) {
    if (thread.asked_by !== "Anonymous" || thread.ip_address !== null || thread.user_id !== null) {
      throw new Error(`Agora thread ${thread.id} is not sanitized`);
    }
    if (thread.follow_up_to && !agoraIds.has(thread.follow_up_to)) {
      throw new Error(`Agora thread ${thread.id} references unknown parent ${thread.follow_up_to}`);
    }
  }
}

function resetSeedRows(db: Database.Database): void {
  db.prepare("DELETE FROM agora_synthesis_v2 WHERE thread_id GLOB 'seed-agora-*'").run();
  db.prepare("DELETE FROM agora_responses WHERE thread_id GLOB 'seed-agora-*'").run();
  db.prepare("DELETE FROM agora_thread_philosophers WHERE thread_id GLOB 'seed-agora-*'").run();
  db.prepare("DELETE FROM agora_threads WHERE id GLOB 'seed-agora-*'").run();
  db.prepare("DELETE FROM debate_posts WHERE debate_id GLOB 'seed-debate-*'").run();
  db.prepare("DELETE FROM debate_philosophers WHERE debate_id GLOB 'seed-debate-*'").run();
  db.prepare("DELETE FROM debates WHERE id GLOB 'seed-debate-*'").run();
  db.prepare("DELETE FROM posts WHERE id GLOB 'seed-post-*'").run();
  db.prepare("DELETE FROM historical_events WHERE id GLOB 'seed-event-*'").run();
}

function readAvailableSummary(db: Database.Database): SeedContentSummary {
  const scalar = (sql: string): number =>
    (db.prepare(sql).get() as { count: number }).count;

  return {
    philosophers: scalar("SELECT COUNT(*) count FROM philosophers"),
    systemPrompts: scalar("SELECT COUNT(*) count FROM system_prompts WHERE is_active = 1"),
    moodPalettes: scalar("SELECT COUNT(*) count FROM mood_palettes WHERE is_active = 1"),
    contentTemplates: scalar("SELECT COUNT(*) count FROM content_templates WHERE is_active = 1"),
    historicalEvents: scalar("SELECT COUNT(*) count FROM historical_events WHERE id GLOB 'seed-event-*'"),
    publishedPosts: scalar(
      "SELECT COUNT(*) count FROM posts WHERE id GLOB 'seed-post-*' AND status = 'published'"
    ),
    draftPosts: scalar(
      "SELECT COUNT(*) count FROM posts WHERE id GLOB 'seed-post-*' AND status = 'draft'"
    ),
    debates: scalar("SELECT COUNT(*) count FROM debates WHERE id GLOB 'seed-debate-*'"),
    debatePosts: scalar(
      "SELECT COUNT(*) count FROM debate_posts WHERE debate_id GLOB 'seed-debate-*'"
    ),
    agoraThreads: scalar(
      "SELECT COUNT(*) count FROM agora_threads WHERE id GLOB 'seed-agora-*'"
    ),
    agoraResponses: scalar(
      "SELECT COUNT(*) count FROM agora_responses WHERE thread_id GLOB 'seed-agora-*'"
    ),
    agoraSyntheses: scalar(
      "SELECT COUNT(*) count FROM agora_synthesis_v2 WHERE thread_id GLOB 'seed-agora-*'"
    ),
  };
}

export function seedContent(
  db: Database.Database,
  options: SeedContentOptions = {}
): SeedContentResult {
  validateFixture();

  const mode = options.mode ?? "insert";
  const now = options.now ?? new Date();
  const inserted = emptySummary();
  const postTimes = fixture.posts.map((post) => post.created_at);
  const debateTimes = fixture.debates.map((debate) => debate.debate_date);
  const agoraTimes = fixture.agoraThreads.flatMap((thread) => [
    thread.created_at,
    ...(thread.synthesis ? [thread.synthesis.created_at] : []),
  ]);
  const eventTimes = fixture.historicalEvents.flatMap((event) => [
    event.created_at,
    event.updated_at,
  ]);
  const shiftPostTime = createTimestampShifter(
    postTimes,
    new Date(now.getTime() - 2 * 60 * 60 * 1000)
  );
  const shiftDebateTime = createTimestampShifter(
    debateTimes,
    new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
  );
  const shiftAgoraTime = createTimestampShifter(
    agoraTimes,
    new Date(now.getTime() - 24 * 60 * 60 * 1000)
  );
  const shiftEventTime = createTimestampShifter(
    eventTimes,
    new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  );

  const run = db.transaction(() => {
    if (mode === "reset") resetSeedRows(db);

    const insertPhilosopher = db.prepare(`
      INSERT OR IGNORE INTO philosophers (
        id, name, tradition, color, initials, bio, era, key_works,
        core_principles, followers, posts_count, debates_count, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 1)
    `);
    for (const philosopher of Object.values(philosophers)) {
      inserted.philosophers += insertPhilosopher.run(
        philosopher.id,
        philosopher.name,
        philosopher.tradition,
        philosopher.color,
        philosopher.initials,
        philosopher.bio,
        philosopher.era,
        JSON.stringify(philosopher.keyWorks),
        JSON.stringify(philosopher.corePrinciples),
        philosopher.followers
      ).changes;
    }

    const hasActivePrompt = db.prepare(
      "SELECT 1 FROM system_prompts WHERE philosopher_id = ? AND is_active = 1 LIMIT 1"
    );
    const insertPrompt = db.prepare(`
      INSERT INTO system_prompts (
        philosopher_id, prompt_version, system_prompt_text, is_active
      ) VALUES (?, ?, ?, 1)
    `);
    for (const prompt of fixture.systemPrompts) {
      if (!hasActivePrompt.get(prompt.philosopher_id)) {
        inserted.systemPrompts += insertPrompt.run(
          prompt.philosopher_id,
          prompt.prompt_version,
          prompt.system_prompt_text
        ).changes;
      }
    }

    const insertMoodPalette = db.prepare(`
      INSERT OR IGNORE INTO mood_palettes (
        philosopher_id, registers, is_active, updated_at
      ) VALUES (?, ?, ?, ?)
    `);
    for (const palette of fixture.moodPalettes) {
      inserted.moodPalettes += insertMoodPalette.run(
        palette.philosopher_id,
        palette.registers,
        palette.is_active,
        formatSqliteTimestamp(now.getTime())
      ).changes;
    }

    const hasActiveTemplate = db.prepare(
      "SELECT 1 FROM content_templates WHERE template_key = ? AND is_active = 1 LIMIT 1"
    );
    const insertTemplate = db.prepare(`
      INSERT INTO content_templates (
        template_key, version, instructions, is_active, notes
      ) VALUES (?, ?, ?, 1, ?)
    `);
    for (const template of fixture.contentTemplates) {
      if (!hasActiveTemplate.get(template.template_key)) {
        inserted.contentTemplates += insertTemplate.run(
          template.template_key,
          template.version,
          template.instructions,
          template.notes
        ).changes;
      }
    }

    const insertEvent = db.prepare(`
      INSERT OR IGNORE INTO historical_events (
        id, title, event_month, event_day, event_year, display_date, era,
        category, context, key_themes, status, thumbnail_filename,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const event of fixture.historicalEvents) {
      inserted.historicalEvents += insertEvent.run(
        event.id,
        event.title,
        event.event_month,
        event.event_day,
        event.event_year,
        event.display_date,
        event.era,
        event.category,
        event.context,
        event.key_themes,
        event.status,
        null,
        shiftEventTime(event.created_at),
        shiftEventTime(event.updated_at)
      ).changes;
    }

    const insertPost = db.prepare(`
      INSERT OR IGNORE INTO posts (
        id, philosopher_id, content, thesis, stance, tag, source_type,
        historical_event_id, recommendation_title, recommendation_author,
        recommendation_medium, citation_title, citation_source, citation_url,
        citation_image_url, reply_to, likes, replies, bookmarks, status,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const post of fixture.posts) {
      const changes = insertPost.run(
        post.id,
        post.philosopher_id,
        post.content,
        post.thesis,
        post.stance,
        post.tag,
        post.source_type,
        post.historical_event_id,
        post.recommendation_title,
        post.recommendation_author,
        post.recommendation_medium,
        post.citation_title,
        post.citation_source,
        post.citation_url,
        post.citation_image_url,
        post.reply_to,
        post.likes,
        post.replies,
        post.bookmarks,
        post.status,
        shiftPostTime(post.created_at),
        shiftPostTime(post.updated_at)
      ).changes;
      if (post.status === "published") inserted.publishedPosts += changes;
      else inserted.draftPosts += changes;
    }

    const insertDebate = db.prepare(`
      INSERT OR IGNORE INTO debates (
        id, title, trigger_article_title, trigger_article_source,
        trigger_article_url, editorial_context, status, debate_date,
        synthesis_tensions, synthesis_agreements, synthesis_questions,
        synthesis_summary_agree, synthesis_summary_diverge,
        synthesis_summary_unresolved
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertDebatePhilosopher = db.prepare(
      "INSERT OR IGNORE INTO debate_philosophers (debate_id, philosopher_id) VALUES (?, ?)"
    );
    const insertDebatePost = db.prepare(`
      INSERT OR IGNORE INTO debate_posts (
        id, debate_id, philosopher_id, content, phase, reply_to, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const debate of fixture.debates) {
      inserted.debates += insertDebate.run(
        debate.id,
        debate.title,
        debate.trigger_article_title,
        debate.trigger_article_source,
        debate.trigger_article_url,
        debate.editorial_context,
        debate.status,
        shiftDebateTime(debate.debate_date),
        debate.synthesis_tensions,
        debate.synthesis_agreements,
        debate.synthesis_questions,
        debate.synthesis_summary_agree,
        debate.synthesis_summary_diverge,
        debate.synthesis_summary_unresolved
      ).changes;
      for (const philosopherId of debate.philosophers) {
        insertDebatePhilosopher.run(debate.id, philosopherId);
      }
      for (const post of debate.posts) {
        inserted.debatePosts += insertDebatePost.run(
          post.id,
          debate.id,
          post.philosopher_id,
          post.content,
          post.phase,
          post.reply_to,
          post.sort_order
        ).changes;
      }
    }

    const insertAgoraThread = db.prepare(`
      INSERT OR IGNORE INTO agora_threads (
        id, question, asked_by, status, ip_address, question_type,
        recommendations_enabled, visibility, hidden_from_feed, user_id,
        follow_up_to, article_url, article_title, article_source,
        article_excerpt, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertAgoraPhilosopher = db.prepare(
      "INSERT OR IGNORE INTO agora_thread_philosophers (thread_id, philosopher_id) VALUES (?, ?)"
    );
    const insertAgoraResponse = db.prepare(`
      INSERT OR IGNORE INTO agora_responses (
        id, thread_id, philosopher_id, posts, recommendation, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);
    const insertAgoraSynthesis = db.prepare(`
      INSERT OR IGNORE INTO agora_synthesis_v2 (
        thread_id, synthesis_type, sections, created_at
      ) VALUES (?, ?, ?, ?)
    `);

    const rootsFirst = [...fixture.agoraThreads].sort((a, b) =>
      Number(Boolean(a.follow_up_to)) - Number(Boolean(b.follow_up_to))
    );
    for (const thread of rootsFirst) {
      inserted.agoraThreads += insertAgoraThread.run(
        thread.id,
        thread.question,
        "Anonymous",
        "complete",
        null,
        thread.question_type,
        thread.recommendations_enabled,
        "public",
        thread.hidden_from_feed,
        null,
        thread.follow_up_to,
        thread.article_url,
        thread.article_title,
        thread.article_source,
        thread.article_excerpt,
        shiftAgoraTime(thread.created_at)
      ).changes;
      for (const philosopherId of thread.philosophers) {
        insertAgoraPhilosopher.run(thread.id, philosopherId);
      }
      for (const response of thread.responses) {
        inserted.agoraResponses += insertAgoraResponse.run(
          response.id,
          thread.id,
          response.philosopher_id,
          response.posts,
          response.recommendation,
          response.sort_order
        ).changes;
      }
      if (thread.synthesis) {
        inserted.agoraSyntheses += insertAgoraSynthesis.run(
          thread.id,
          thread.synthesis.synthesis_type,
          thread.synthesis.sections,
          shiftAgoraTime(thread.synthesis.created_at)
        ).changes;
      }
    }

    db.prepare(`
      UPDATE philosophers
      SET posts_count = (
            SELECT COUNT(*) FROM posts
            WHERE posts.philosopher_id = philosophers.id
              AND posts.status = 'published'
          ),
          debates_count = (
            SELECT COUNT(*) FROM debate_philosophers
            WHERE debate_philosophers.philosopher_id = philosophers.id
          )
    `).run();
  });

  db.pragma("foreign_keys = ON");
  run();

  const violations = db.pragma("foreign_key_check") as unknown[];
  if (violations.length > 0) {
    throw new Error(`Seed completed with ${violations.length} foreign-key violation(s)`);
  }

  return {
    mode,
    inserted,
    available: readAvailableSummary(db),
  };
}
