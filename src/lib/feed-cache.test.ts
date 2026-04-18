import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FeedPost } from "@/lib/types";

const SAMPLE_POSTS: FeedPost[] = [
  {
    id: "post-1",
    philosopherId: "nietzsche",
    content: "The feed remembers its shape.",
    thesis: "Caching can be bounded",
    stance: "observes",
    tag: "test",
    sourceType: "news",
    likes: 3,
    replies: 1,
    bookmarks: 2,
    timestamp: "2026-04-18T10:00:00.000Z",
    createdAt: "2026-04-18T10:00:00.000Z",
    philosopherName: "Friedrich Nietzsche",
    philosopherColor: "terracotta",
    philosopherInitials: "FN",
    philosopherTradition: "Existentialism",
  },
];

async function loadFeedCache(envValue: string | undefined) {
  vi.resetModules();
  vi.unstubAllEnvs();

  if (envValue === undefined) {
    delete process.env.FEED_CACHE_ENABLED;
  } else {
    vi.stubEnv("FEED_CACHE_ENABLED", envValue);
  }

  return import("./feed-cache");
}

describe("feed-cache", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("returns cached data within the TTL when enabled", async () => {
    const feedCache = await loadFeedCache("true");

    feedCache.setCachedAnonymousInterleave("home", SAMPLE_POSTS);

    expect(feedCache.getCachedAnonymousInterleave("home")).toEqual(SAMPLE_POSTS);
  });

  it("returns null after the TTL expires", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-18T10:00:00.000Z"));

    const feedCache = await loadFeedCache("true");

    feedCache.setCachedAnonymousInterleave("home", SAMPLE_POSTS);
    vi.advanceTimersByTime(feedCache.FEED_CACHE_TTL_MS + 1);

    expect(feedCache.getCachedAnonymousInterleave("home")).toBeNull();
  });

  it("clears all entries when busted", async () => {
    const feedCache = await loadFeedCache("true");

    feedCache.setCachedAnonymousInterleave("home", SAMPLE_POSTS);
    feedCache.setCachedAnonymousInterleave("profile", SAMPLE_POSTS);

    feedCache.bustFeedCache();

    expect(feedCache.getCachedAnonymousInterleave("home")).toBeNull();
    expect(feedCache.getCachedAnonymousInterleave("profile")).toBeNull();
  });

  it("builds deterministic keys", async () => {
    const feedCache = await loadFeedCache("true");

    const first = feedCache.buildCacheKey({
      contentType: "replies",
      philosopherId: "nietzsche",
    });
    const second = feedCache.buildCacheKey({
      contentType: "replies",
      philosopherId: "nietzsche",
    });
    const different = feedCache.buildCacheKey({
      contentType: "recommendations",
      philosopherId: "nietzsche",
    });

    expect(first).toBe(second);
    expect(first).not.toBe(different);
  });

  it("defaults to enabled when the env var is unset", async () => {
    const feedCache = await loadFeedCache(undefined);

    expect(feedCache.isFeedCacheEnabled()).toBe(true);
  });

  it("always returns null when the kill switch is disabled", async () => {
    const feedCache = await loadFeedCache("false");

    feedCache.setCachedAnonymousInterleave("home", SAMPLE_POSTS);

    expect(feedCache.getCachedAnonymousInterleave("home")).toBeNull();
  });

  it("treats set as a safe no-op when disabled", async () => {
    const feedCache = await loadFeedCache("0");

    expect(() => {
      feedCache.setCachedAnonymousInterleave("home", SAMPLE_POSTS);
    }).not.toThrow();
    expect(feedCache.getCachedAnonymousInterleave("home")).toBeNull();
  });

  it("reports the enabled state in both modes", async () => {
    const enabledFeedCache = await loadFeedCache("true");
    const disabledFeedCache = await loadFeedCache("false");

    expect(enabledFeedCache.isFeedCacheEnabled()).toBe(true);
    expect(disabledFeedCache.isFeedCacheEnabled()).toBe(false);
  });
});
