import type { FeedPost } from "@/lib/types";

export const FEED_CONTENT_TABS = [
  { key: "all", label: "All" },
  { key: "reactions", label: "Reactions" },
  { key: "history", label: "Today in History" },
  { key: "replies", label: "Replies" },
] as const;

export type FeedContentType = (typeof FEED_CONTENT_TABS)[number]["key"];

export type FeedItem =
  | { type: "post"; post: FeedPost; index: number }
  | { type: "tension"; postA: FeedPost; postB: FeedPost };

export function normalizeFeedContentType(value?: string | null): FeedContentType {
  if (value === "reactions" || value === "history" || value === "replies") {
    return value;
  }

  return "all";
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
  if (post.sourceType === "reflection") return "Reflection";
  if (post.sourceType === "historical_event") return "Historical";
  if (post.sourceType === "everyday") return "Everyday";
  if (post.stance === "quips" || post.stance === "mocks") return "Quip";
  return "News Reaction";
}

export function buildFeedItems(posts: FeedPost[]): FeedItem[] {
  const items: FeedItem[] = [];
  let lastTensionArticle: string | null = null;

  for (let i = 0; i < posts.length; i++) {
    items.push({ type: "post", post: posts[i], index: i });

    if (i < posts.length - 1) {
      const current = posts[i];
      const next = posts[i + 1];
      const standalonePair = isStandaloneReaction(current) && isStandaloneReaction(next);
      const sameArticle = sharesSameArticle(current, next);
      const differentStance = current.stance !== next.stance;
      const differentPhilosopher = current.philosopherId !== next.philosopherId;
      const articleKey = current.citation?.url || current.citation?.title || null;
      const notDuplicate = articleKey !== lastTensionArticle;

      if (standalonePair && sameArticle && differentStance && differentPhilosopher && notDuplicate) {
        items.push({ type: "tension", postA: current, postB: next });
        lastTensionArticle = articleKey;
      }
    }
  }

  return items;
}

export function getPhilosopherChipLabel(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";

  const parts = trimmed.split(/\s+/);
  return parts[parts.length - 1] ?? trimmed;
}
