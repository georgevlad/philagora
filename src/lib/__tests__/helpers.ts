import type { FeedPost, PostCitation, Stance } from "@/lib/types";

let postCounter = 0;

type FeedPostOverrides = Partial<FeedPost> & {
  philosopherId?: string;
  stance?: Stance;
  citation?: PostCitation;
  sourceType?: string;
  replyTo?: string;
  tag?: string;
};

/**
 * Create a minimal FeedPost with sensible defaults.
 * Override any field via the `overrides` parameter.
 */
export function makePost(overrides: FeedPostOverrides = {}): FeedPost {
  postCounter += 1;
  const id = overrides.id ?? `test-post-${postCounter}`;
  const philosopherId = overrides.philosopherId ?? "nietzsche";

  return {
    id,
    philosopherId,
    content: overrides.content ?? `Test content for ${id}`,
    thesis: overrides.thesis ?? "",
    stance: overrides.stance ?? "challenges",
    tag: overrides.tag ?? "",
    sourceType: overrides.sourceType ?? "news",
    likes: overrides.likes ?? 0,
    replies: overrides.replies ?? 0,
    bookmarks: overrides.bookmarks ?? 0,
    timestamp: overrides.timestamp ?? "2026-01-01T10:00:00.000Z",
    createdAt: overrides.createdAt ?? overrides.timestamp ?? "2026-01-01T10:00:00.000Z",
    citation: overrides.citation,
    replyTo: overrides.replyTo,
    historicalEventId: overrides.historicalEventId,
    recommendationTitle: overrides.recommendationTitle,
    recommendationMedium: overrides.recommendationMedium,
    thumbnailUrl: overrides.thumbnailUrl,
    philosopherName:
      overrides.philosopherName ??
      philosopherId.charAt(0).toUpperCase() + philosopherId.slice(1),
    philosopherColor: overrides.philosopherColor ?? "#8B0000",
    philosopherInitials: overrides.philosopherInitials ?? philosopherId.slice(0, 2).toUpperCase(),
    philosopherTradition: overrides.philosopherTradition ?? "existentialism",
    replyTargetPhilosopherId: overrides.replyTargetPhilosopherId,
    replyTargetPhilosopherName: overrides.replyTargetPhilosopherName,
    replyTargetPhilosopherColor: overrides.replyTargetPhilosopherColor,
    replyTargetPhilosopherInitials: overrides.replyTargetPhilosopherInitials,
  };
}

/**
 * Shorthand: create a news reaction post citing a specific article.
 */
export function makeReaction(
  philosopherId: string,
  articleUrl: string,
  stance: Stance = "challenges",
  extras: Partial<FeedPost> = {}
): FeedPost {
  return makePost({
    philosopherId,
    stance,
    sourceType: "news",
    citation: {
      title: `Article at ${articleUrl}`,
      source: "Test Source",
      url: articleUrl,
    },
    ...extras,
  });
}

/**
 * Shorthand: create a reply post.
 */
export function makeReply(
  philosopherId: string,
  replyToId: string,
  extras: Partial<FeedPost> = {}
): FeedPost {
  return makePost({
    philosopherId,
    replyTo: replyToId,
    sourceType: "news",
    ...extras,
  });
}

/**
 * Shorthand: create a quip.
 */
export function makeQuip(philosopherId: string, extras: Partial<FeedPost> = {}): FeedPost {
  return makePost({
    philosopherId,
    stance: "quips",
    sourceType: "news",
    ...extras,
  });
}

/**
 * Shorthand: create a timeless reflection.
 */
export function makeReflection(philosopherId: string, extras: Partial<FeedPost> = {}): FeedPost {
  return makePost({
    philosopherId,
    sourceType: "reflection",
    stance: "observes",
    ...extras,
  });
}

/**
 * Reset the post counter between test files if needed.
 */
export function resetPostCounter(): void {
  postCounter = 0;
}
