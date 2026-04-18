import type { FeedPost } from "@/lib/types";

const rawFeedCacheEnabled = process.env.FEED_CACHE_ENABLED?.trim().toLowerCase();

export const FEED_CACHE_ENABLED =
  rawFeedCacheEnabled !== "false" && rawFeedCacheEnabled !== "0";
export const FEED_CACHE_TTL_MS = 30_000;

const anonymousInterleaveCache = new Map<
  string,
  { data: FeedPost[]; expiresAt: number }
>();

if (FEED_CACHE_ENABLED) {
  console.log("[feed-cache] enabled");
} else {
  console.log("[feed-cache] DISABLED via FEED_CACHE_ENABLED env var");
}

export function getCachedAnonymousInterleave(key: string): FeedPost[] | null {
  if (!FEED_CACHE_ENABLED) {
    return null;
  }

  const cached = anonymousInterleaveCache.get(key);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    anonymousInterleaveCache.delete(key);
    return null;
  }

  return cached.data;
}

export function setCachedAnonymousInterleave(key: string, data: FeedPost[]): void {
  if (!FEED_CACHE_ENABLED) {
    return;
  }

  anonymousInterleaveCache.set(key, {
    data,
    expiresAt: Date.now() + FEED_CACHE_TTL_MS,
  });
}

export function bustFeedCache(): void {
  anonymousInterleaveCache.clear();
}

export function buildCacheKey(options: {
  contentType?: string;
  philosopherId?: string;
}): string {
  return `ct=${options.contentType ?? "*"}|ph=${options.philosopherId ?? "*"}`;
}

export function isFeedCacheEnabled(): boolean {
  return FEED_CACHE_ENABLED;
}
