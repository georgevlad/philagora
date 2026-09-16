"use client";
import { EmptyState } from "./public/PageState";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArticleThreadCard } from "@/components/ArticleThreadCard";
import { PostCard } from "@/components/PostCard";
import { useNewPostIndicator } from "@/hooks/useNewPostIndicator";
import { buildFeedItems, type FeedContentType } from "@/lib/feed-utils";
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
  philosopherId?: string,
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

function buildEmptyStateMessage(
  type: FeedContentType,
  philosopherName?: string,
): string {
  if (philosopherName) {
    if (type === "reactions")
      return `No reactions from ${philosopherName} yet.`;
    if (type === "reflections")
      return `No reflections from ${philosopherName} yet.`;
    if (type === "replies") return `No replies from ${philosopherName} yet.`;
    if (type === "recommends")
      return `No recommendations from ${philosopherName} yet.`;
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
      const response = await fetch(
        buildFeedApiUrl(contentType, offset, philosopherId),
        {
          cache: "no-store",
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        throw new Error(`Feed request failed with status ${response.status}`);
      }

      const data = (await response.json()) as PaginatedFeedResponse;

      if (controller.signal.aborted) {
        return;
      }

      setPosts((previousPosts) => {
        const seenPostIds = new Set(previousPosts.map((post) => post.id));
        const nextPosts = data.posts.filter(
          (post) => !seenPostIds.has(post.id),
        );
        return nextPosts.length > 0
          ? [...previousPosts, ...nextPosts]
          : previousPosts;
      });
      setOffset(
        (previousOffset) =>
          data.nextOffset ?? previousOffset + data.posts.length,
      );
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
      { rootMargin: "400px" },
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadMore, loadMoreError, loadingMore]);

  const feedItems = useMemo(() => buildFeedItems(posts), [posts]);
  const showSentinel = hasMore && !loadMoreError;
  const showEndOfFeed = !hasMore && posts.length > 0;

  return (
    <div>
      {feedItems.length > 0 ? (
        <>
          <div>
            {feedItems.map((item) =>
              item.type === "cluster" ? (
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
              ),
            )}
          </div>
          {loadMoreError && (
            <div className="public-pagination" role="status">
              <p>{loadMoreError} The posts already loaded are still here.</p>
              <button className="agora-outline" onClick={() => void loadMore()}>
                Try again
              </button>
            </div>
          )}
          {showSentinel && (
            <div ref={sentinelRef} className="public-pagination">
              <button
                className="agora-outline"
                disabled={loadingMore}
                onClick={() => void loadMore()}
              >
                {loadingMore ? "Loading more posts…" : "Load more posts"}
              </button>
              <span className="sr-only" role="status">
                {loadingMore
                  ? "Loading more posts"
                  : `${posts.length} posts loaded`}
              </span>
            </div>
          )}
          {showEndOfFeed && (
            <div className="public-pagination">
              <p role="status">You’ve reached the end.</p>
              <a href="#main" className="agora-text-link">
                Back to the top ↑
              </a>
            </div>
          )}
        </>
      ) : (
        <EmptyState
          title={buildEmptyStateMessage(contentType, philosopherName)}
          href={
            contentType === "all"
              ? "/#ask"
              : philosopherId
                ? `/philosophers/${philosopherId}`
                : "/feed"
          }
          action={contentType === "all" ? "Ask the philosophers" : "View all posts"}
        >
          {contentType === "all"
            ? "Published posts will appear here."
            : "Try another filter, or return to all posts."}
        </EmptyState>
      )}
    </div>
  );
}
