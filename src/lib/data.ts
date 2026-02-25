import { getDb } from "@/lib/db";
import { timeAgo } from "@/lib/date-utils";
import type { Philosopher, FeedPost, PostCitation } from "@/lib/types";

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
