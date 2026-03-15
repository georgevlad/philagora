import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { PostRow } from "@/lib/db-types";
import { timeAgo } from "@/lib/date-utils";
import { interleaveFeed } from "@/lib/feed-interleave";
import { classifyPostFormat } from "@/lib/feed-utils";
import { isPostSourceType } from "@/lib/historical-events";
import type { FeedPost, PostCitation } from "@/lib/types";

export const dynamic = "force-dynamic";

interface CompositionStats {
  total: number;
  byPhilosopher: { id: string; name: string; count: number; pct: number }[];
  bySourceType: { type: string; count: number; pct: number }[];
  byStance: { stance: string; count: number; pct: number }[];
  byTag: { tag: string; count: number; pct: number }[];
  byFormat: { format: string; count: number; pct: number }[];
}

interface PreviewPost extends FeedPost {
  createdAt: string;
}

const FEED_PREVIEW_QUERY = `
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
  WHERE p.status = 'published'
  ORDER BY p.created_at DESC
`;

function buildCitation(row: PostRow): PostCitation | undefined {
  if (!row.citation_title && !row.citation_source) return undefined;

  return {
    title: row.citation_title ?? "",
    source: row.citation_source ?? "",
    url: row.citation_url ?? undefined,
    imageUrl: row.citation_image_url ?? undefined,
  };
}

function mapPreviewPost(row: PostRow): PreviewPost {
  return {
    id: row.id,
    philosopherId: row.philosopher_id,
    content: row.content,
    thesis: row.thesis || "",
    stance: row.stance as FeedPost["stance"],
    tag: row.tag || "",
    sourceType: isPostSourceType(row.source_type ?? "") ? row.source_type : "news",
    historicalEventId: row.historical_event_id ?? undefined,
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
    createdAt: row.created_at,
  };
}

function computeStats(posts: FeedPost[]): CompositionStats {
  const total = posts.length;

  if (total === 0) {
    return {
      total: 0,
      byPhilosopher: [],
      bySourceType: [],
      byStance: [],
      byTag: [],
      byFormat: [],
    };
  }

  function countBy<T>(items: T[], keyFn: (item: T) => string) {
    const counts = new Map<string, number>();

    for (const item of items) {
      const key = keyFn(item);
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    return [...counts.entries()]
      .map(([key, count]) => ({
        key,
        count,
        pct: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  }

  const philosopherNames = new Map<string, string>();
  for (const post of posts) {
    if (!philosopherNames.has(post.philosopherId)) {
      philosopherNames.set(post.philosopherId, post.philosopherName);
    }
  }

  return {
    total,
    byPhilosopher: countBy(posts, (post) => post.philosopherId).map((entry) => ({
      id: entry.key,
      name: philosopherNames.get(entry.key) || entry.key,
      count: entry.count,
      pct: entry.pct,
    })),
    bySourceType: countBy(posts, (post) => post.sourceType || "news").map((entry) => ({
      type: entry.key,
      count: entry.count,
      pct: entry.pct,
    })),
    byStance: countBy(posts, (post) => post.stance).map((entry) => ({
      stance: entry.key,
      count: entry.count,
      pct: entry.pct,
    })),
    byTag: countBy(posts, (post) => post.tag || "(untagged)").map((entry) => ({
      tag: entry.key,
      count: entry.count,
      pct: entry.pct,
    })),
    byFormat: countBy(posts, classifyPostFormat).map((entry) => ({
      format: entry.key,
      count: entry.count,
      pct: entry.pct,
    })),
  };
}

export async function GET() {
  try {
    const db = getDb();
    const rows = db.prepare(FEED_PREVIEW_QUERY).all() as PostRow[];
    const chronological = rows.map(mapPreviewPost);
    const interleaved = interleaveFeed([...chronological]);
    const chronologicalIndexMap = new Map<string, number>();

    for (let index = 0; index < chronological.length; index += 1) {
      chronologicalIndexMap.set(chronological[index].id, index);
    }

    const annotatedChronological = chronological.map((post, index) => ({
      ...post,
      _chronoRank: index + 1,
      _shift: 0,
    }));

    const annotatedInterleaved = interleaved.map((post, interleavedIndex) => {
      const chronologicalIndex = chronologicalIndexMap.get(post.id) ?? interleavedIndex;

      return {
        ...post,
        _chronoRank: chronologicalIndex + 1,
        _shift: chronologicalIndex - interleavedIndex,
      };
    });

    return NextResponse.json({
      chronological: annotatedChronological,
      interleaved: annotatedInterleaved,
      stats: computeStats(chronological),
    });
  } catch (error) {
    console.error("Failed to build feed preview:", error);
    return NextResponse.json(
      { error: "Failed to build feed preview" },
      { status: 500 }
    );
  }
}
