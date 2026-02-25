import { getDb } from "@/lib/db";
import { timeAgo } from "@/lib/date-utils";
import type {
  Philosopher,
  FeedPost,
  PostCitation,
  DebateListItem,
  DebateDetail,
  DebatePost,
  AgoraThreadDetail,
  AgoraResponse,
  AgoraSynthesis,
} from "@/lib/types";

// ── Raw DB row types (snake_case) ──────────────────────────

interface PhilosopherRow {
  id: string;
  name: string;
  tradition: string;
  color: string;
  initials: string;
  bio: string;
  era: string;
  key_works: string;
  core_principles: string;
  followers: number;
  posts_count: number;
  debates_count: number;
}

interface PostRow {
  id: string;
  philosopher_id: string;
  content: string;
  thesis: string;
  stance: string;
  tag: string;
  citation_title: string | null;
  citation_source: string | null;
  citation_url: string | null;
  citation_image_url: string | null;
  reply_to: string | null;
  likes: number;
  replies: number;
  bookmarks: number;
  status: string;
  created_at: string;
  updated_at: string;
  // Joined philosopher fields
  philosopher_name: string;
  philosopher_color: string;
  philosopher_initials: string;
  philosopher_tradition: string;
  // Joined reply-target philosopher fields (may be null)
  reply_target_philosopher_id: string | null;
  reply_target_philosopher_name: string | null;
  reply_target_philosopher_color: string | null;
  reply_target_philosopher_initials: string | null;
}

// ── Mappers ────────────────────────────────────────────────

function mapPhilosopher(row: PhilosopherRow): Philosopher {
  return {
    id: row.id,
    name: row.name,
    tradition: row.tradition,
    color: row.color,
    initials: row.initials,
    bio: row.bio,
    era: row.era,
    followers: row.followers,
    postsCount: row.posts_count,
    debatesCount: row.debates_count,
    keyWorks: JSON.parse(row.key_works || "[]"),
    corePrinciples: JSON.parse(row.core_principles || "[]"),
  };
}

function buildCitation(row: PostRow): PostCitation | undefined {
  if (!row.citation_title && !row.citation_source) return undefined;
  return {
    title: row.citation_title ?? "",
    source: row.citation_source ?? "",
    url: row.citation_url ?? undefined,
    imageUrl: row.citation_image_url ?? undefined,
  };
}

function mapFeedPost(row: PostRow): FeedPost {
  return {
    id: row.id,
    philosopherId: row.philosopher_id,
    content: row.content,
    thesis: row.thesis || "",
    stance: row.stance as FeedPost["stance"],
    tag: row.tag || "",
    citation: buildCitation(row),
    likes: row.likes,
    replies: row.replies,
    bookmarks: row.bookmarks,
    timestamp: timeAgo(row.created_at),
    replyTo: row.reply_to ?? undefined,
    philosopherName: row.philosopher_name,
    philosopherColor: row.philosopher_color,
    philosopherInitials: row.philosopher_initials,
    philosopherTradition: row.philosopher_tradition,
    replyTargetPhilosopherId: row.reply_target_philosopher_id ?? undefined,
    replyTargetPhilosopherName: row.reply_target_philosopher_name ?? undefined,
    replyTargetPhilosopherColor: row.reply_target_philosopher_color ?? undefined,
    replyTargetPhilosopherInitials: row.reply_target_philosopher_initials ?? undefined,
  };
}

// ── SQL Fragments ──────────────────────────────────────────

const FEED_POST_QUERY = `
  SELECT
    p.*,
    ph.name       AS philosopher_name,
    ph.color      AS philosopher_color,
    ph.initials   AS philosopher_initials,
    ph.tradition  AS philosopher_tradition,
    rph.id        AS reply_target_philosopher_id,
    rph.name      AS reply_target_philosopher_name,
    rph.color     AS reply_target_philosopher_color,
    rph.initials  AS reply_target_philosopher_initials
  FROM posts p
  JOIN philosophers ph ON p.philosopher_id = ph.id
  LEFT JOIN posts rp ON p.reply_to = rp.id
  LEFT JOIN philosophers rph ON rp.philosopher_id = rph.id
`;

// ── Query Functions ────────────────────────────────────────

export function getPublishedPosts(): FeedPost[] {
  const db = getDb();
  const rows = db
    .prepare(FEED_POST_QUERY + " WHERE p.status = 'published' ORDER BY p.created_at DESC")
    .all() as PostRow[];
  return rows.map(mapFeedPost);
}

export function getPostsByPhilosopher(philosopherId: string): FeedPost[] {
  const db = getDb();
  const rows = db
    .prepare(
      FEED_POST_QUERY +
        " WHERE p.philosopher_id = ? AND p.status = 'published' ORDER BY p.created_at DESC"
    )
    .all(philosopherId) as PostRow[];
  return rows.map(mapFeedPost);
}

export function getAllPhilosophers(): Philosopher[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM philosophers ORDER BY name ASC")
    .all() as PhilosopherRow[];
  return rows.map(mapPhilosopher);
}

export function getPhilosopherById(id: string): Philosopher | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM philosophers WHERE id = ?")
    .get(id) as PhilosopherRow | undefined;
  return row ? mapPhilosopher(row) : null;
}

export function getPhilosophersMap(): Record<string, Philosopher> {
  const all = getAllPhilosophers();
  const map: Record<string, Philosopher> = {};
  for (const p of all) {
    map[p.id] = p;
  }
  return map;
}

// ── Helpers ───────────────────────────────────────────────────

function formatDebateStatus(status: string): "Complete" | "In Progress" | "Scheduled" {
  switch (status) {
    case "complete": return "Complete";
    case "in_progress": return "In Progress";
    case "scheduled": return "Scheduled";
    default: return "Scheduled";
  }
}

function formatDebateDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

// ── Debate row types ──────────────────────────────────────────

interface DebateRow {
  id: string;
  title: string;
  status: string;
  debate_date: string;
  trigger_article_title: string;
  trigger_article_source: string;
  trigger_article_url: string | null;
  synthesis_tensions: string;
  synthesis_agreements: string;
  synthesis_questions: string;
  synthesis_summary_agree: string;
  synthesis_summary_diverge: string;
  synthesis_summary_unresolved: string;
}

interface DebatePhilosopherRow {
  philosopher_id: string;
}

interface DebatePostRow {
  id: string;
  debate_id: string;
  philosopher_id: string;
  content: string;
  phase: string;
  reply_to: string | null;
  sort_order: number;
  // Joined
  philosopher_name: string;
  philosopher_color: string;
  philosopher_initials: string;
  philosopher_tradition: string;
}

// ── Debate queries ────────────────────────────────────────────

export function getAllDebates(): DebateListItem[] {
  const db = getDb();

  const debates = db
    .prepare("SELECT * FROM debates ORDER BY debate_date DESC")
    .all() as DebateRow[];

  return debates.map((d) => {
    const philRows = db
      .prepare("SELECT philosopher_id FROM debate_philosophers WHERE debate_id = ?")
      .all(d.id) as DebatePhilosopherRow[];

    // Get first opening post preview
    const firstPost = db
      .prepare(
        `SELECT dp.content FROM debate_posts dp
         WHERE dp.debate_id = ? AND dp.phase = 'opening'
         ORDER BY dp.sort_order ASC LIMIT 1`
      )
      .get(d.id) as { content: string } | undefined;

    const preview = firstPost
      ? firstPost.content.slice(0, 120) + (firstPost.content.length > 120 ? "..." : "")
      : "";

    return {
      id: d.id,
      title: d.title,
      status: formatDebateStatus(d.status),
      debateDate: formatDebateDate(d.debate_date),
      triggerArticleTitle: d.trigger_article_title,
      triggerArticleSource: d.trigger_article_source,
      triggerArticleUrl: d.trigger_article_url,
      philosophers: philRows.map((r) => r.philosopher_id),
      firstPostPreview: preview,
    };
  });
}

export function getDebateById(id: string): DebateDetail | null {
  const db = getDb();

  const d = db
    .prepare("SELECT * FROM debates WHERE id = ?")
    .get(id) as DebateRow | undefined;

  if (!d) return null;

  const philRows = db
    .prepare("SELECT philosopher_id FROM debate_philosophers WHERE debate_id = ?")
    .all(d.id) as DebatePhilosopherRow[];

  const postRows = db
    .prepare(
      `SELECT dp.*, ph.name AS philosopher_name, ph.color AS philosopher_color,
              ph.initials AS philosopher_initials, ph.tradition AS philosopher_tradition
       FROM debate_posts dp
       JOIN philosophers ph ON dp.philosopher_id = ph.id
       WHERE dp.debate_id = ?
       ORDER BY dp.sort_order ASC`
    )
    .all(d.id) as DebatePostRow[];

  const mapPost = (row: DebatePostRow): DebatePost => ({
    id: row.id,
    philosopherId: row.philosopher_id,
    content: row.content,
    phase: row.phase as DebatePost["phase"],
    replyTo: row.reply_to,
    sortOrder: row.sort_order,
    philosopherName: row.philosopher_name,
    philosopherColor: row.philosopher_color,
    philosopherInitials: row.philosopher_initials,
    philosopherTradition: row.philosopher_tradition,
  });

  return {
    id: d.id,
    title: d.title,
    status: formatDebateStatus(d.status),
    debateDate: formatDebateDate(d.debate_date),
    triggerArticleTitle: d.trigger_article_title,
    triggerArticleSource: d.trigger_article_source,
    triggerArticleUrl: d.trigger_article_url,
    philosophers: philRows.map((r) => r.philosopher_id),
    openings: postRows.filter((p) => p.phase === "opening").map(mapPost),
    rebuttals: postRows.filter((p) => p.phase === "rebuttal").map(mapPost),
    synthesisTensions: safeJsonParse(d.synthesis_tensions, []),
    synthesisAgreements: safeJsonParse(d.synthesis_agreements, []),
    synthesisQuestions: safeJsonParse(d.synthesis_questions, []),
    synthesisSummaryAgree: d.synthesis_summary_agree || "",
    synthesisSummaryDiverge: d.synthesis_summary_diverge || "",
    synthesisSummaryUnresolved: d.synthesis_summary_unresolved || "",
  };
}

// ── Agora row types ───────────────────────────────────────────

interface AgoraThreadRow {
  id: string;
  question: string;
  asked_by: string;
  status: string;
  created_at: string;
}

interface AgoraResponseRow {
  id: string;
  thread_id: string;
  philosopher_id: string;
  posts: string; // JSON array of strings
  sort_order: number;
  // Joined
  philosopher_name: string;
  philosopher_color: string;
  philosopher_initials: string;
  philosopher_tradition: string;
}

interface AgoraSynthesisRow {
  thread_id: string;
  tensions: string;
  agreements: string;
  practical_takeaways: string;
}

interface AgoraPhilosopherRow {
  philosopher_id: string;
}

// ── Agora queries ─────────────────────────────────────────────

export function getAllAgoraThreads(): AgoraThreadDetail[] {
  const db = getDb();

  const threads = db
    .prepare("SELECT * FROM agora_threads ORDER BY created_at DESC")
    .all() as AgoraThreadRow[];

  return threads.map((t) => buildAgoraThreadDetail(db, t));
}

function buildAgoraThreadDetail(
  db: ReturnType<typeof getDb>,
  t: AgoraThreadRow
): AgoraThreadDetail {
  const philRows = db
    .prepare("SELECT philosopher_id FROM agora_thread_philosophers WHERE thread_id = ?")
    .all(t.id) as AgoraPhilosopherRow[];

  const responseRows = db
    .prepare(
      `SELECT ar.*, ph.name AS philosopher_name, ph.color AS philosopher_color,
              ph.initials AS philosopher_initials, ph.tradition AS philosopher_tradition
       FROM agora_responses ar
       JOIN philosophers ph ON ar.philosopher_id = ph.id
       WHERE ar.thread_id = ?
       ORDER BY ar.sort_order ASC`
    )
    .all(t.id) as AgoraResponseRow[];

  const synthRow = db
    .prepare("SELECT * FROM agora_synthesis WHERE thread_id = ?")
    .get(t.id) as AgoraSynthesisRow | undefined;

  const responses: AgoraResponse[] = responseRows.map((r) => ({
    philosopherId: r.philosopher_id,
    philosopherName: r.philosopher_name,
    philosopherColor: r.philosopher_color,
    philosopherInitials: r.philosopher_initials,
    philosopherTradition: r.philosopher_tradition,
    posts: safeJsonParse<string[]>(r.posts, []),
    sortOrder: r.sort_order,
  }));

  const synthesis: AgoraSynthesis | null = synthRow
    ? {
        tensions: safeJsonParse<string[]>(synthRow.tensions, []),
        agreements: safeJsonParse<string[]>(synthRow.agreements, []),
        practicalTakeaways: safeJsonParse<string[]>(synthRow.practical_takeaways, []),
      }
    : null;

  return {
    id: t.id,
    question: t.question,
    askedBy: t.asked_by,
    status: t.status,
    createdAt: timeAgo(t.created_at),
    philosophers: philRows.map((r) => r.philosopher_id),
    responses,
    synthesis,
  };
}

export function getAgoraThreadById(id: string): AgoraThreadDetail | null {
  const db = getDb();

  const t = db
    .prepare("SELECT * FROM agora_threads WHERE id = ?")
    .get(id) as AgoraThreadRow | undefined;

  if (!t) return null;

  return buildAgoraThreadDetail(db, t);
}
