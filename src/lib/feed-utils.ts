import type { FeedPost } from "@/lib/types";

export const FEED_CONTENT_TABS = [
  { key: "all", label: "All" },
  { key: "reactions", label: "Reactions" },
  { key: "reflections", label: "Reflections" },
  { key: "replies", label: "Replies" },
  { key: "recommends", label: "Recommends" },
] as const;

export type FeedContentType = (typeof FEED_CONTENT_TABS)[number]["key"];

export type FeedItem =
  | { type: "post"; post: FeedPost; index: number }
  | { type: "cluster"; clusterId: string; posts: FeedPost[] };

export function normalizeFeedContentType(value?: string | null): FeedContentType {
  if (
    value === "reactions" ||
    value === "reflections" ||
    value === "replies" ||
    value === "recommends"
  ) {
    return value;
  }

  return "all";
}

export function buildFeedContentTypeConditions(
  value?: string | null,
  tableAlias = "p"
): string[] {
  const normalized = normalizeFeedContentType(value);
  const replyTo = `${tableAlias}.reply_to`;

  if (normalized === "reactions") {
    return [
      `COALESCE(${tableAlias}.source_type, 'news') = 'news'`,
      `${tableAlias}.citation_url IS NOT NULL AND ${tableAlias}.citation_url != ''`,
      `(${replyTo} IS NULL OR ${replyTo} = '')`,
    ];
  }

  if (normalized === "reflections") {
    return [
      `${tableAlias}.source_type IN ('reflection', 'historical_event', 'art_commentary', 'everyday')`,
      `(${replyTo} IS NULL OR ${replyTo} = '')`,
    ];
  }

  if (normalized === "replies") {
    return [`${replyTo} IS NOT NULL AND ${replyTo} != ''`];
  }

  if (normalized === "recommends") {
    return [
      `((${tableAlias}.recommendation_title IS NOT NULL AND ${tableAlias}.recommendation_title != '') OR ${tableAlias}.stance = 'recommends')`,
      `(${replyTo} IS NULL OR ${replyTo} = '')`,
    ];
  }

  return [];
}

export function sharesSameArticle(a: FeedPost, b: FeedPost): boolean {
  if (!a.citation || !b.citation) return false;
  if (a.citation.url && b.citation.url && a.citation.url === b.citation.url) return true;
  if (a.citation.title && b.citation.title && a.citation.source && b.citation.source) {
    return a.citation.title === b.citation.title && a.citation.source === b.citation.source;
  }
  return false;
}

function isStandaloneReaction(post: FeedPost): boolean {
  return Boolean(post.citation) && !post.replyTo;
}

export function classifyPostFormat(post: {
  replyTo?: string;
  sourceType?: string;
  stance: string;
}): string {
  if (post.replyTo) return "Cross-Reply";
  if (post.sourceType === "reflection" || post.sourceType === "art_commentary") {
    return "Reflection";
  }
  if (post.sourceType === "historical_event") return "Historical";
  if (post.sourceType === "everyday") return "Everyday";
  if (post.stance === "quips" || post.stance === "mocks") return "Glint";
  return "News Reaction";
}

export function buildFeedItems(posts: FeedPost[]): FeedItem[] {
  const items: FeedItem[] = [];
  let i = 0;

  while (i < posts.length) {
    const post = posts[i];

    if (post._clusterId) {
      const clusterId = post._clusterId;
      const clusterPosts: FeedPost[] = [post];

      let j = i + 1;
      while (j < posts.length && posts[j]._clusterId === clusterId) {
        clusterPosts.push(posts[j]);
        j += 1;
      }

      items.push({ type: "cluster", clusterId, posts: clusterPosts });
      i = j;
      continue;
    }

    items.push({ type: "post", post, index: i });
    i += 1;
  }

  return items;
}

export function getPhilosopherChipLabel(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";

  const parts = trimmed.split(/\s+/);
  return parts[parts.length - 1] ?? trimmed;
}
