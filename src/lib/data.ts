import { getDb } from "@/lib/db";
import { timeAgo } from "@/lib/date-utils";
import { interleaveFeed } from "@/lib/feed-interleave";
import { buildFeedContentTypeConditions } from "@/lib/feed-utils";
import { isPostSourceType } from "@/lib/historical-events";
import { safeJsonParse } from "@/lib/json-utils";
import type {
  AgoraPhilosopherRow,
  AgoraResponseRow,
  AgoraSynthesisRow,
  AgoraThreadRow,
  DebatePhilosopherRow,
  DebatePostRow,
  DebateRow,
  PhilosopherRow,
  PostRow,
} from "@/lib/db-types";
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

type FeedPostRow = PostRow & { is_bookmarked?: number | null };

// ── Raw DB row types (snake_case) ──────────────────────────

// ── Mappers ────────────────────────────────────────────────

function mapPhilosopher(row: PhilosopherRow): Philosopher {
  return {
    id: row.id,
    name: row.name,
    tradition: row.tradition,
    color: row.color,
    initials: row.initials,
    bio: row.bio!,
    era: row.era!,
    followers: row.followers!,
    postsCount: row.posts_count!,
    debatesCount: row.debates_count!,
    keyWorks: JSON.parse(row.key_works! || "[]"),
    corePrinciples: JSON.parse(row.core_principles! || "[]"),
  };
}

function buildCitation(row: FeedPostRow): PostCitation | undefined {
  if (!row.citation_title && !row.citation_source) return undefined;
  return {
    title: row.citation_title ?? "",
    source: row.citation_source ?? "",
    url: row.citation_url ?? undefined,
    imageUrl: row.citation_image_url ?? undefined,
  };
}

function mapFeedPost(row: FeedPostRow): FeedPost {
  return {
    id: row.id,
    philosopherId: row.philosopher_id,
    content: row.content,
    thesis: row.thesis || "",
    stance: row.stance as FeedPost["stance"],
    tag: row.tag || "",
    sourceType: isPostSourceType(row.source_type ?? "") ? row.source_type : "news",
    historicalEventId: row.historical_event_id ?? undefined,
    recommendationTitle: row.recommendation_title ?? undefined,
    recommendationMedium: row.recommendation_medium ?? undefined,
    citation: buildCitation(row),
    thumbnailUrl: row.historical_event_thumbnail
      ? `/api/thumbnails/${row.historical_event_thumbnail}`
      : undefined,
    likes: row.likes,
    replies: row.replies,
    bookmarks: row.bookmarks,
    isBookmarked: row.is_bookmarked === 1 ? true : undefined,
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
    rph.initials  AS reply_target_philosopher_initials,
    he.thumbnail_filename AS historical_event_thumbnail
  FROM posts p
  JOIN philosophers ph ON p.philosopher_id = ph.id
  LEFT JOIN posts rp ON p.reply_to = rp.id
  LEFT JOIN philosophers rph ON rp.philosopher_id = rph.id
  LEFT JOIN historical_events he ON p.historical_event_id = he.id
`;

function buildFeedPostQuery(userId?: string): {
  sql: string;
  extraParams: (string | number)[];
} {
  if (userId) {
    return {
      sql: `
        SELECT
          p.*,
          ph.name       AS philosopher_name,
          ph.color      AS philosopher_color,
          ph.initials   AS philosopher_initials,
          ph.tradition  AS philosopher_tradition,
          rph.id        AS reply_target_philosopher_id,
          rph.name      AS reply_target_philosopher_name,
          rph.color     AS reply_target_philosopher_color,
          rph.initials  AS reply_target_philosopher_initials,
          he.thumbnail_filename AS historical_event_thumbnail,
          CASE WHEN ub.user_id IS NOT NULL THEN 1 ELSE 0 END AS is_bookmarked
        FROM posts p
        JOIN philosophers ph ON p.philosopher_id = ph.id
        LEFT JOIN posts rp ON p.reply_to = rp.id
        LEFT JOIN philosophers rph ON rp.philosopher_id = rph.id
        LEFT JOIN historical_events he ON p.historical_event_id = he.id
        LEFT JOIN user_bookmarks ub ON ub.post_id = p.id AND ub.user_id = ?
      `,
      extraParams: [userId],
    };
  }

  return {
    sql: FEED_POST_QUERY,
    extraParams: [],
  };
}

// ── Query Functions ────────────────────────────────────────

export function getPublishedPosts(userId?: string): FeedPost[] {
  return interleaveFeed(queryPublishedPosts({ userId }));
}

function buildPublishedPostFilters(options: {
  contentType?: string;
  philosopherId?: string;
}) {
  const conditions: string[] = ["p.status = 'published'"];
  const params: (string | number)[] = [];
  conditions.push(...buildFeedContentTypeConditions(options.contentType));

  if (options.philosopherId) {
    conditions.push("p.philosopher_id = ?");
    params.push(options.philosopherId);
  }

  return {
    where: ` WHERE ${conditions.join(" AND ")}`,
    params,
  };
}

function queryPublishedPosts(options: {
  contentType?: string;
  philosopherId?: string;
  userId?: string;
} = {}): FeedPost[] {
  const db = getDb();
  const { where, params } = buildPublishedPostFilters(options);
  const { sql: baseQuery, extraParams } = buildFeedPostQuery(options.userId);
  const rows = db
    .prepare(baseQuery + where + " ORDER BY p.created_at DESC")
    .all(...extraParams, ...params) as FeedPostRow[];

  return rows.map(mapFeedPost);
}

export function getFilteredPublishedPosts(
  contentType?: string,
  philosopherId?: string,
  userId?: string
): FeedPost[] {
  return interleaveFeed(queryPublishedPosts({ contentType, philosopherId, userId }));
}

export function getInterleavedFeed(options: {
  contentType?: string;
  philosopherId?: string;
  offset?: number;
  limit?: number;
  userId?: string;
}): { posts: FeedPost[]; hasMore: boolean; nextOffset: number | null } {
  const limit = Math.max(1, options.limit ?? 15);
  const offset = Math.max(0, options.offset ?? 0);
  const interleavedPosts = interleaveFeed(
    queryPublishedPosts({
      contentType: options.contentType,
      philosopherId: options.philosopherId,
      userId: options.userId,
    })
  );
  const posts = interleavedPosts.slice(offset, offset + limit);
  const hasMore = offset + limit < interleavedPosts.length;

  return {
    posts,
    hasMore,
    nextOffset: hasMore ? offset + posts.length : null,
  };
}

export function getPostsByPhilosopher(philosopherId: string, userId?: string): FeedPost[] {
  return interleaveFeed(queryPublishedPosts({ philosopherId, userId }));
}

export function getPostById(id: string, userId?: string): FeedPost | null {
  const db = getDb();
  const { sql: baseQuery, extraParams } = buildFeedPostQuery(userId);
  const row = db
    .prepare(baseQuery + " WHERE p.id = ? AND p.status = 'published'")
    .get(...extraParams, id) as FeedPostRow | undefined;
  return row ? mapFeedPost(row) : null;
}

export function getBookmarkedPosts(userId: string): FeedPost[] {
  const db = getDb();
  const { sql: baseQuery, extraParams } = buildFeedPostQuery(userId);
  const rows = db
    .prepare(
      baseQuery
      + " WHERE p.status = 'published' AND ub.user_id IS NOT NULL"
      + " ORDER BY ub.created_at DESC"
    )
    .all(...extraParams) as FeedPostRow[];

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

// ── Debate row types ──────────────────────────────────────────

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

    // Get first two opening post snippets for tension preview
    const openingRows = db
      .prepare(
        `SELECT dp.philosopher_id, dp.content FROM debate_posts dp
         WHERE dp.debate_id = ? AND dp.phase = 'opening'
         ORDER BY dp.sort_order ASC LIMIT 2`
      )
      .all(d.id) as { philosopher_id: string; content: string }[];

    const openingPreviews = openingRows.map((row) => {
      // Extract the first sentence as the strongest opening hook.
      const firstSentenceMatch = row.content.match(/^(.+?[.!?])\s/);
      let snippet = firstSentenceMatch
        ? firstSentenceMatch[1]
        : row.content.slice(0, 100);

      if (snippet.length > 120) {
        snippet = `${snippet.slice(0, 117)}...`;
      }

      return {
        philosopherId: row.philosopher_id,
        snippet,
      };
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
      openingPreviews,
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

// ── Agora queries ─────────────────────────────────────────────

export function getAllAgoraThreads(): AgoraThreadDetail[] {
  const db = getDb();

  const threads = db
    .prepare("SELECT * FROM agora_threads ORDER BY created_at DESC")
    .all() as AgoraThreadRow[];

  return threads.map((t) => buildAgoraThreadDetail(db, t));
}

export function getRecentAgoraThreads(limit = 5) {
  const db = getDb();

  const threads = db
    .prepare(
      `SELECT id, question, asked_by, created_at
       FROM agora_threads
       WHERE status = 'complete'
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .all(limit) as Array<{
      id: string;
      question: string;
      asked_by: string;
      created_at: string;
    }>;

  const getPhilosophers = db.prepare(
    `SELECT p.id, p.name, p.initials, p.color
     FROM philosophers p
     JOIN agora_thread_philosophers atp ON p.id = atp.philosopher_id
     WHERE atp.thread_id = ?`
  );

  return threads.map((thread) => ({
    ...thread,
    philosophers: getPhilosophers.all(thread.id) as Array<{
      id: string;
      name: string;
      initials: string;
      color: string;
    }>,
  }));
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
