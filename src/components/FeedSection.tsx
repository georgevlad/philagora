"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArticleThreadCard } from "@/components/ArticleThreadCard";
import { PostCard } from "@/components/PostCard";
import { EditorialDivider } from "@/components/EditorialDivider";
import { Spinner } from "@/components/Spinner";
import { WelcomeCard } from "@/components/WelcomeCard";
import { useNewPostIndicator } from "@/hooks/useNewPostIndicator";
import {
  buildFeedItems,
  type FeedContentType,
} from "@/lib/feed-utils";
import type { FeedPost } from "@/lib/types";

interface FeedSectionProps {
  initialPosts: FeedPost[];
  initialHasMore: boolean;
  contentType?: FeedContentType;
  philosopherId?: string;
  philosopherName?: string;
}

interface PaginatedFeedResponse {
  posts: FeedPost[];
  hasMore: boolean;
  nextOffset: number | null;
}

function buildFeedApiUrl(
  type: FeedContentType,
  offset?: number,
  philosopherId?: string
): string {
  const params = new URLSearchParams();

  if (type !== "all") {
    params.set("type", type);
  }

  if (philosopherId) {
    params.set("philosopher", philosopherId);
  }

  if (offset && offset > 0) {
    params.set("offset", String(offset));
  }

  const query = params.toString();
  return query ? `/api/feed?${query}` : "/api/feed";
}

function FeedLoadMoreIndicator() {
  return (
    <div
      className="mx-auto flex max-w-[280px] items-center justify-center gap-3 rounded-full border border-border-light/80 bg-[linear-gradient(180deg,rgba(248,243,234,0.94),rgba(244,239,230,0.88))] px-4 py-3 text-ink-lighter shadow-[0_10px_24px_rgba(42,36,31,0.03)]"
      aria-live="polite"
      aria-label="Loading more posts"
    >
      <Spinner className="h-4 w-4 text-athenian/75" />
      <span className="font-mono text-[11px] uppercase tracking-[0.18em]">
        Loading more dispatches
      </span>
    </div>
  );
}

function buildEmptyStateMessage(type: FeedContentType, philosopherName?: string): string {
  if (philosopherName) {
    if (type === "reactions") return `No reactions from ${philosopherName} yet.`;
    if (type === "reflections") return `No reflections from ${philosopherName} yet.`;
    if (type === "replies") return `No replies from ${philosopherName} yet.`;
    if (type === "recommends") return `No recommendations from ${philosopherName} yet.`;
    return `No posts from ${philosopherName} yet.`;
  }

  if (type === "reactions") return "No reactions yet.";
  if (type === "reflections") return "No reflections yet.";
  if (type === "replies") return "No replies yet.";
  if (type === "recommends") return "No recommendations yet.";
  return "No posts yet.";
}

export function FeedSection({
  initialPosts,
  initialHasMore,
  contentType = "all",
  philosopherId,
  philosopherName,
}: FeedSectionProps) {
  const isNewPost = useNewPostIndicator();
  const [posts, setPosts] = useState<FeedPost[]>(initialPosts);
  const [offset, setOffset] = useState(initialPosts.length);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadMoreRequestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => loadMoreRequestRef.current?.abort();
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) {
      return;
    }

    const controller = new AbortController();
    loadMoreRequestRef.current?.abort();
    loadMoreRequestRef.current = controller;
    setLoadingMore(true);
    setLoadMoreError(null);

    try {
      const response = await fetch(buildFeedApiUrl(contentType, offset, philosopherId), {
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Feed request failed with status ${response.status}`);
      }

      const data = (await response.json()) as PaginatedFeedResponse;

      if (controller.signal.aborted) {
        return;
      }

      setPosts((previousPosts) => {
        const seenPostIds = new Set(previousPosts.map((post) => post.id));
        const nextPosts = data.posts.filter((post) => !seenPostIds.has(post.id));
        return nextPosts.length > 0 ? [...previousPosts, ...nextPosts] : previousPosts;
      });
      setOffset((previousOffset) => data.nextOffset ?? previousOffset + data.posts.length);
      setHasMore(data.hasMore);
    } catch (fetchError) {
      if (controller.signal.aborted) return;

      console.error("Failed to load more posts:", fetchError);
      setLoadMoreError("Unable to load more posts right now.");
    } finally {
      if (!controller.signal.aborted) {
        setLoadingMore(false);
      }

      if (loadMoreRequestRef.current === controller) {
        loadMoreRequestRef.current = null;
      }
    }
  }, [contentType, hasMore, loadingMore, offset, philosopherId]);

  useEffect(() => {
    if (!sentinelRef.current || loadingMore || loadMoreError || !hasMore) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadMore();
        }
      },
      { rootMargin: "400px" }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadMore, loadMoreError, loadingMore]);

  const feedItems = useMemo(() => buildFeedItems(posts), [posts]);
  const showSentinel = hasMore && !loadMoreError;
  const showEndOfFeed = !hasMore && posts.length > 0;

  return (
    <div className="pb-20 pt-0 sm:pt-3 sm:pb-3 lg:pb-0">
      {feedItems.length > 0 ? (
        <>
          <div>
            <WelcomeCard />
            {feedItems.map((item, index) => {
              const element = item.type === "cluster" ? (
                <ArticleThreadCard
                  key={`cluster-${item.clusterId}`}
                  posts={item.posts}
                />
              ) : (
                <PostCard
                  key={item.post.id}
                  post={item.post}
                  isNew={isNewPost(item.post.timestamp)}
                />
              );

              const showDivider =
                (index + 1) % 5 === 0 &&
                index < feedItems.length - 1;

              return showDivider ? (
                <div key={`group-${index}`}>
                  {element}
                  <EditorialDivider />
                </div>
              ) : (
                element
              );
            })}
          </div>

          {loadMoreError && (
            <div className="px-6 py-4 text-center" role="status">
              <p className="font-body text-sm text-ink-lighter">{loadMoreError}</p>
              <button
                type="button"
                onClick={() => {
                  void loadMore();
                }}
                className="mt-3 rounded-full border border-border-light bg-parchment-dark/45 px-4 py-2 font-body text-sm font-medium text-athenian transition-colors hover:border-border hover:bg-parchment-dark/75"
              >
                Try again
              </button>
            </div>
          )}

          {showSentinel && (
            <div ref={sentinelRef} className="px-3 sm:px-4 py-4">
              {loadingMore ? <FeedLoadMoreIndicator /> : <div className="h-6" aria-hidden="true" />}
            </div>
          )}

          {showEndOfFeed && (
            <div className="text-center py-8 text-ink-lighter/60 text-xs font-mono tracking-wider uppercase">
              You&apos;ve reached the end
            </div>
          )}
        </>
      ) : (
        <div className="px-6 py-16 text-center">
          <p className="font-serif text-lg text-ink-light mb-2">
            {buildEmptyStateMessage(contentType, philosopherName)}
          </p>
        </div>
      )}
    </div>
  );
}
