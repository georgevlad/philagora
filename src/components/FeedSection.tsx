"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PostCard } from "@/components/PostCard";
import { TensionCard } from "@/components/TensionCard";
import { EditorialDivider } from "@/components/EditorialDivider";
import {
  buildFeedItems,
  normalizeFeedContentType,
  type FeedContentType,
} from "@/lib/feed-utils";
import type { FeedPost, Philosopher } from "@/lib/types";

function buildFeedApiUrl(type: FeedContentType, philosopherId?: string): string {
  const params = new URLSearchParams();

  if (type !== "all") {
    params.set("type", type);
  }

  if (philosopherId) {
    params.set("philosopher", philosopherId);
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

function buildEmptyStateMessage(type: FeedContentType, philosopherName?: string): string {
  if (philosopherName) {
    if (type === "reactions") return `No reactions from ${philosopherName} yet.`;
    if (type === "reflections") return `No reflections from ${philosopherName} yet.`;
    if (type === "replies") return `No replies from ${philosopherName} yet.`;
    return `No posts from ${philosopherName} yet.`;
  }

  if (type === "reactions") return "No reactions yet.";
  if (type === "reflections") return "No reflections yet.";
  if (type === "replies") return "No replies yet.";
  return "No posts yet.";
}

export function FeedSection({
  initialPosts,
  philosophers,
}: {
  initialPosts: FeedPost[];
  philosophers: Philosopher[];
}) {
  const searchParams = useSearchParams();
  const selectedType = normalizeFeedContentType(searchParams.get("type"));
  const selectedPhilosopherId = searchParams.get("philosopher") || undefined;
  const showDefaultFeed = selectedType === "all" && !selectedPhilosopherId;
  const [posts, setPosts] = useState<FeedPost[]>(
    showDefaultFeed ? initialPosts : []
  );
  const [loading, setLoading] = useState(!showDefaultFeed);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (showDefaultFeed) return;

    const controller = new AbortController();
    const loadPosts = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(buildFeedApiUrl(selectedType, selectedPhilosopherId), {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Feed request failed with status ${response.status}`);
        }

        const nextPosts = (await response.json()) as FeedPost[];
        setPosts(nextPosts);
      } catch (fetchError) {
        if (controller.signal.aborted) return;

        console.error("Failed to load filtered feed:", fetchError);
        setError("Unable to load the feed right now.");
        setPosts([]);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadPosts();

    return () => controller.abort();
  }, [selectedPhilosopherId, selectedType, showDefaultFeed]);

  const displayPosts = showDefaultFeed ? initialPosts : posts;
  const feedItems = useMemo(() => buildFeedItems(displayPosts), [displayPosts]);
  const displayLoading = showDefaultFeed ? false : loading;
  const philosophersById = useMemo(
    () => new Map(philosophers.map((philosopher) => [philosopher.id, philosopher.name])),
    [philosophers]
  );
  const selectedPhilosopherName = selectedPhilosopherId
    ? philosophersById.get(selectedPhilosopherId)
    : undefined;

  if (displayLoading && displayPosts.length === 0) {
    return (
      <div className="pb-20 lg:pb-0 py-3">
        <FeedSkeleton />
      </div>
    );
  }

  return (
    <div className="pb-20 lg:pb-0 py-3">
      {displayLoading && displayPosts.length > 0 && (
        <div className="px-4 pb-2">
          <div className="h-1 overflow-hidden rounded-full bg-border-light/70">
            <div className="h-full w-28 rounded-full bg-gold/55 animate-pulse" />
          </div>
        </div>
      )}

      {feedItems.length > 0 ? (
        <div className={displayLoading ? "opacity-80 transition-opacity duration-200" : "transition-opacity duration-200"}>
          {feedItems.map((item, index) => {
            const element = item.type === "post" ? (
              <PostCard key={item.post.id} post={item.post} delay={item.index} />
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
      ) : (
        <div className="px-6 py-16 text-center">
          <p className="font-serif text-lg text-ink-light mb-2">
            {error ?? buildEmptyStateMessage(selectedType, selectedPhilosopherName)}
          </p>
        </div>
      )}
    </div>
  );
}
