"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PostCard } from "@/components/PostCard";
import { TensionCard } from "@/components/TensionCard";
import { EditorialDivider } from "@/components/EditorialDivider";
import { Spinner } from "@/components/Spinner";
import { useNewPostIndicator } from "@/hooks/useNewPostIndicator";
import {
  buildFeedItems,
  normalizeFeedContentType,
  type FeedContentType,
} from "@/lib/feed-utils";
import type { FeedPost } from "@/lib/types";

interface FeedSectionProps {
  initialPosts: FeedPost[];
  initialHasMore: boolean;
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

function FeedSkeleton() {
  return (
    <div className="px-3 sm:px-4 py-3 space-y-4">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="rounded-[22px] border border-border-light/90 bg-[linear-gradient(180deg,rgba(248,243,234,0.96),rgba(244,239,230,0.92))] px-5 py-5 sm:px-6 animate-pulse shadow-[0_14px_34px_rgba(42,36,31,0.03)]"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-full bg-border-light/80" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 rounded-full bg-border-light/70" />
              <div className="h-3 w-24 rounded-full bg-border-light/55" />
            </div>
          </div>
          <div className="space-y-3">
            <div className="h-6 w-[78%] rounded-full bg-parchment-dark/75" />
            <div className="h-4 w-full rounded-full bg-border-light/65" />
            <div className="h-4 w-[92%] rounded-full bg-border-light/55" />
            <div className="h-4 w-[66%] rounded-full bg-border-light/45" />
          </div>
        </div>
      ))}
    </div>
  );
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
    if (type === "history") return `No historical posts from ${philosopherName} yet.`;
    if (type === "replies") return `No replies from ${philosopherName} yet.`;
    return `No posts from ${philosopherName} yet.`;
  }

  if (type === "reactions") return "No reactions yet.";
  if (type === "history") return "No historical posts yet.";
  if (type === "replies") return "No replies yet.";
  return "No posts yet.";
}

export function FeedSection({
  initialPosts,
  initialHasMore,
  philosopherId,
  philosopherName,
}: FeedSectionProps) {
  const isNewPost = useNewPostIndicator();
  const searchParams = useSearchParams();
  const selectedType = normalizeFeedContentType(searchParams.get("type"));
  const showDefaultFeed = selectedType === "all";
  const [posts, setPosts] = useState<FeedPost[]>(showDefaultFeed ? initialPosts : []);
  const [offset, setOffset] = useState<number>(showDefaultFeed ? initialPosts.length : 0);
  const [hasMore, setHasMore] = useState<boolean>(showDefaultFeed ? initialHasMore : true);
  const [loading, setLoading] = useState(!showDefaultFeed);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const filterRequestRef = useRef<AbortController | null>(null);
  const loadMoreRequestRef = useRef<AbortController | null>(null);
  const requestVersionRef = useRef(0);

  useEffect(() => {
    return () => {
      filterRequestRef.current?.abort();
      loadMoreRequestRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    requestVersionRef.current += 1;
    const requestVersion = requestVersionRef.current;

    filterRequestRef.current?.abort();
    loadMoreRequestRef.current?.abort();
    filterRequestRef.current = null;
    loadMoreRequestRef.current = null;

    setLoadingMore(false);
    setLoadMoreError(null);

    if (showDefaultFeed) {
      setPosts(initialPosts);
      setOffset(initialPosts.length);
      setHasMore(initialHasMore);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    filterRequestRef.current = controller;
    setPosts([]);
    setOffset(0);
    setHasMore(true);
    setLoading(true);
    setError(null);

    const loadPosts = async () => {
      try {
        const response = await fetch(buildFeedApiUrl(selectedType, 0, philosopherId), {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Feed request failed with status ${response.status}`);
        }

        const data = (await response.json()) as PaginatedFeedResponse;

        if (controller.signal.aborted || requestVersion !== requestVersionRef.current) {
          return;
        }

        setPosts(data.posts);
        setOffset(data.nextOffset ?? data.posts.length);
        setHasMore(data.hasMore);
      } catch (fetchError) {
        if (controller.signal.aborted) return;

        console.error("Failed to load filtered feed:", fetchError);
        setError("Unable to load the feed right now.");
        setPosts([]);
        setOffset(0);
        setHasMore(false);
      } finally {
        if (!controller.signal.aborted && requestVersion === requestVersionRef.current) {
          setLoading(false);
        }
      }
    };

    loadPosts();

    return () => {
      controller.abort();
      if (filterRequestRef.current === controller) {
        filterRequestRef.current = null;
      }
    };
  }, [initialHasMore, initialPosts, philosopherId, selectedType, showDefaultFeed]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || loadMoreError || !hasMore) {
      return;
    }

    const requestVersion = requestVersionRef.current;
    const controller = new AbortController();
    loadMoreRequestRef.current?.abort();
    loadMoreRequestRef.current = controller;
    setLoadingMore(true);
    setLoadMoreError(null);

    try {
      const response = await fetch(buildFeedApiUrl(selectedType, offset, philosopherId), {
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Feed request failed with status ${response.status}`);
      }

      const data = (await response.json()) as PaginatedFeedResponse;

      if (controller.signal.aborted || requestVersion !== requestVersionRef.current) {
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
      if (!controller.signal.aborted && requestVersion === requestVersionRef.current) {
        setLoadingMore(false);
      }

      if (loadMoreRequestRef.current === controller) {
        loadMoreRequestRef.current = null;
      }
    }
  }, [hasMore, loadMoreError, loading, loadingMore, offset, philosopherId, selectedType]);

  useEffect(() => {
    if (!sentinelRef.current || loading || loadingMore || loadMoreError || !hasMore) {
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
  }, [hasMore, loadMore, loadMoreError, loading, loadingMore]);

  const feedItems = useMemo(() => buildFeedItems(posts), [posts]);
  const showSentinel = hasMore && !loadMoreError;
  const showEndOfFeed = !hasMore && posts.length > 0;
  const getRevealDelay = useCallback((index: number) => Math.min(index, 4), []);

  if (loading && posts.length === 0) {
    return (
      <div className="pb-20 lg:pb-0 py-3">
        <FeedSkeleton />
      </div>
    );
  }

  return (
    <div className="pb-20 lg:pb-0 py-3">
      {loading && posts.length > 0 && (
        <div className="px-4 pb-2">
          <div className="h-1 overflow-hidden rounded-full bg-border-light/70">
            <div className="h-full w-28 rounded-full bg-gold/55 animate-pulse" />
          </div>
        </div>
      )}

      {feedItems.length > 0 ? (
        <>
          <div className={loading ? "opacity-80 transition-opacity duration-200" : "transition-opacity duration-200"}>
            {feedItems.map((item, index) => {
              const revealDelay = getRevealDelay(index);
              const element = item.type === "post" ? (
                <PostCard
                  key={item.post.id}
                  post={item.post}
                  delay={revealDelay}
                  isNew={isNewPost(item.post.timestamp)}
                />
              ) : (
                <TensionCard
                  key={`tension-${item.postA.id}-${item.postB.id}`}
                  philosopherA={{
                    name: item.postA.philosopherName,
                    id: item.postA.philosopherId,
                    color: item.postA.philosopherColor,
                    initials: item.postA.philosopherInitials,
                    stance: item.postA.stance,
                  }}
                  philosopherB={{
                    name: item.postB.philosopherName,
                    id: item.postB.philosopherId,
                    color: item.postB.philosopherColor,
                    initials: item.postB.philosopherInitials,
                    stance: item.postB.stance,
                  }}
                  articleTitle={item.postA.citation?.title || ""}
                  delay={revealDelay}
                />
              );

              const postCount = feedItems
                .slice(0, index + 1)
                .filter((feedItem) => feedItem.type === "post").length;
              const showDivider =
                item.type === "post" &&
                postCount > 0 &&
                postCount % 5 === 0 &&
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
            <div className="px-6 py-4 text-center">
              <p className="font-body text-sm text-ink-lighter">{loadMoreError}</p>
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
            {error ?? buildEmptyStateMessage(selectedType, philosopherName)}
          </p>
        </div>
      )}
    </div>
  );
}
