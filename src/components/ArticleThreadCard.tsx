"use client";

import { useState } from "react";
import Image from "next/image";
import { PostCard } from "@/components/PostCard";
import { BookIcon, ExternalLinkIcon } from "@/components/Icons";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { STANCE_CONFIG } from "@/lib/constants";
import type { FeedPost, PostCitation } from "@/lib/types";

interface ArticleThreadCardProps {
  posts: FeedPost[];
  delay?: number;
}

export function ArticleThreadCard({ posts, delay = 0 }: ArticleThreadCardProps) {
  const ref = useScrollReveal<HTMLDivElement>(delay);
  const reactions = posts.filter((post) => !post.replyTo);
  const replies = posts.filter((post) => Boolean(post.replyTo));
  const citation = reactions[0]?.citation || posts[0]?.citation;
  const tensionPair = findTensionPair(reactions);
  const [showReplies, setShowReplies] = useState(replies.length <= 1);

  if (!citation) {
    return (
      <>
        {posts.map((post) => (
          <PostCard key={post.id} post={post} delay={delay} />
        ))}
      </>
    );
  }

  const primaryColor = reactions[0]?.philosopherColor || posts[0]?.philosopherColor || "#A88C6D";

  return (
    <div
      ref={ref}
      className="animate-fade-in-up rounded-[22px] bg-[linear-gradient(180deg,rgba(248,243,234,0.96),rgba(244,239,230,0.92))] border border-border-light/90 mx-2 my-2.5 overflow-hidden shadow-[0_14px_34px_rgba(42,36,31,0.045)] transition-shadow duration-200 hover:shadow-[0_18px_40px_rgba(42,36,31,0.06)] sm:mx-4 sm:my-3"
      style={{ borderTop: `2px solid ${primaryColor}` }}
    >
      <div className="flex items-center gap-3 px-4 pt-3.5 sm:px-6">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-terracotta/20 to-transparent" />
        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-terracotta/70">
          {new Set(posts.map((post) => post.philosopherId)).size} perspectives
        </span>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-terracotta/20 to-transparent" />
      </div>

      <div className="px-4 pt-3 pb-1 sm:px-6">
        <CitationHeader citation={citation} />
      </div>

      {tensionPair && (
        <div className="px-4 py-2 sm:px-6">
          <TensionIndicator a={tensionPair[0]} b={tensionPair[1]} />
        </div>
      )}

      <div>
        {reactions.map((post) => (
          <PostCard key={post.id} post={post} compact />
        ))}
      </div>

      {replies.length > 0 && (
        <div className="border-t border-border-light/60">
          {!showReplies ? (
            <button
              type="button"
              onClick={() => setShowReplies(true)}
              className="w-full px-4 py-3 text-center text-[12px] font-mono uppercase tracking-[0.1em] text-ink-lighter transition-colors duration-200 hover:text-athenian sm:px-6"
            >
              Show {replies.length} {replies.length === 1 ? "reply" : "replies"}
            </button>
          ) : (
            <div>
              {replies.length > 1 && (
                <button
                  type="button"
                  onClick={() => setShowReplies(false)}
                  className="w-full px-4 py-2 text-center text-[11px] font-mono uppercase tracking-[0.1em] text-ink-faint transition-colors duration-200 hover:text-ink-lighter sm:px-6"
                >
                  Hide replies
                </button>
              )}
              {replies.map((post) => (
                <PostCard key={post.id} post={post} compact />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CitationHeader({ citation }: { citation: PostCitation }) {
  const hasImage = Boolean(citation.imageUrl);

  const content = hasImage ? (
    <div className="flex flex-col gap-0 sm:flex-row sm:items-center sm:gap-3">
      <div className="h-[100px] w-full overflow-hidden rounded-t-xl border-b border-border-light/60 bg-parchment-dark/35 sm:h-14 sm:w-14 sm:shrink-0 sm:rounded-lg sm:border sm:border-border-light/60">
        <Image
          src={citation.imageUrl!}
          alt=""
          width={200}
          height={100}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col px-3 py-2 sm:p-0">
        <span className="line-clamp-2 font-serif text-[15px] font-medium leading-snug text-ink transition-colors group-hover:text-athenian">
          {citation.title}
        </span>
        <span className="mt-1 inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.16em] text-ink-faint">
          {citation.source}
        </span>
      </div>
    </div>
  ) : (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-terracotta/8">
        <BookIcon size={15} stroke="#C05A2C" className="opacity-60" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="line-clamp-2 font-serif text-[15px] font-medium leading-snug text-ink transition-colors group-hover:text-athenian">
          {citation.title}
        </span>
        <span className="mt-1 text-[10px] font-mono uppercase tracking-[0.16em] text-ink-faint">
          {citation.source}
        </span>
      </div>
    </div>
  );

  if (citation.url) {
    return (
      <a
        href={citation.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group block rounded-xl border border-border-light/60 bg-parchment-dark/15 p-2 transition-colors duration-200 hover:bg-parchment-dark/30"
        onClick={(event) => event.stopPropagation()}
      >
        {content}
        <div className="flex justify-end px-2 pt-1">
          <ExternalLinkIcon
            size={13}
            className="text-ink-faint transition-colors group-hover:text-athenian"
          />
        </div>
      </a>
    );
  }

  return (
    <div className="rounded-xl border border-border-light/60 bg-parchment-dark/15 p-2">
      {content}
    </div>
  );
}

function TensionIndicator({ a, b }: { a: FeedPost; b: FeedPost }) {
  const stanceA = STANCE_CONFIG[a.stance];
  const stanceB = STANCE_CONFIG[b.stance];

  return (
    <div className="rounded-xl border border-burgundy/12 bg-[linear-gradient(180deg,rgba(122,62,58,0.035),rgba(248,243,234,0.5))] px-3 py-2">
      <div className="flex flex-wrap items-center justify-center gap-2 text-center">
        <span className="font-serif text-[12px] font-semibold" style={{ color: a.philosopherColor }}>
          {a.philosopherName}
        </span>
        <span className="text-[9px] font-mono uppercase tracking-[0.16em] text-ink-faint">
          {stanceA?.label || a.stance}
        </span>
        <span className="text-[10px] text-burgundy/60">vs</span>
        <span className="font-serif text-[12px] font-semibold" style={{ color: b.philosopherColor }}>
          {b.philosopherName}
        </span>
        <span className="text-[9px] font-mono uppercase tracking-[0.16em] text-ink-faint">
          {stanceB?.label || b.stance}
        </span>
      </div>
    </div>
  );
}

function findTensionPair(reactions: FeedPost[]): [FeedPost, FeedPost] | null {
  if (reactions.length < 2) {
    return null;
  }

  for (let i = 0; i < reactions.length; i += 1) {
    for (let j = i + 1; j < reactions.length; j += 1) {
      if (
        reactions[i].philosopherId !== reactions[j].philosopherId &&
        reactions[i].stance !== reactions[j].stance
      ) {
        return [reactions[i], reactions[j]];
      }
    }
  }

  return null;
}
