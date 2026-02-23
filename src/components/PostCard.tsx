"use client";

import { useState } from "react";
import Link from "next/link";
import { philosophers } from "@/data/philosophers";
import { Post, Stance, posts as allPosts } from "@/data/posts";
import { PhilosopherAvatar } from "./PhilosopherAvatar";
import { useScrollReveal } from "@/hooks/useScrollReveal";

// ── Stance config ───────────────────────────────────────────────────

const stanceConfig: Record<Stance, { label: string; color: string; bg: string; border: string }> = {
  challenges: { label: "Challenges", color: "#9B2C2C", bg: "#FED7D7", border: "#FEB2B2" },
  defends:    { label: "Defends",    color: "#276749", bg: "#C6F6D5", border: "#9AE6B4" },
  reframes:   { label: "Reframes",   color: "#744210", bg: "#FEFCBF", border: "#FAF089" },
  questions:  { label: "Questions",  color: "#2A4365", bg: "#BEE3F8", border: "#90CDF4" },
  warns:      { label: "Warns",      color: "#9C4221", bg: "#FEEBC8", border: "#FBD38D" },
  observes:   { label: "Observes",   color: "#4A5568", bg: "#E2E8F0", border: "#CBD5E0" },
};

// ── Tag Badge ───────────────────────────────────────────────────────

function TagBadge({ tag, color }: { tag: string; color: string }) {
  const isCrossReply = tag === "Cross-Philosopher Reply";

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 text-[10px] font-mono tracking-wide rounded"
      style={{
        backgroundColor: isCrossReply ? `${color}0c` : `${color}08`,
        color: `${color}bb`,
        border: `1px solid ${isCrossReply ? `${color}20` : `${color}15`}`,
      }}
    >
      {tag}
    </span>
  );
}

// ── Stance Badge ────────────────────────────────────────────────────

function StanceBadge({ stance }: { stance: Stance }) {
  const config = stanceConfig[stance];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 text-[10px] font-mono tracking-wider uppercase rounded-full"
      style={{
        backgroundColor: config.bg,
        color: config.color,
        border: `1px solid ${config.border}`,
      }}
    >
      {config.label}
    </span>
  );
}

// ── Action Button ───────────────────────────────────────────────────

function ActionButton({
  icon,
  count,
  label,
}: {
  icon: React.ReactNode;
  count?: number;
  label: string;
}) {
  return (
    <button
      className="flex items-center gap-1.5 text-ink-lighter hover:text-terracotta transition-colors duration-200 group"
      aria-label={label}
    >
      <span className="group-hover:scale-110 transition-transform duration-200">
        {icon}
      </span>
      {count !== undefined && (
        <span className="text-xs font-mono">{count}</span>
      )}
    </button>
  );
}

// ── Popular Indicator ───────────────────────────────────────────────

function PopularBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono tracking-wider uppercase rounded-full bg-terracotta/10 text-terracotta border border-terracotta/20">
      <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" stroke="none">
        <path d="M8 1C8 1 3 5 3 9C3 11.7614 5.23858 14 8 14C10.7614 14 13 11.7614 13 9C13 5 8 1 8 1ZM8 12C6.34315 12 5 10.6569 5 9C5 7 8 4 8 4C8 4 11 7 11 9C11 10.6569 9.65685 12 8 12Z" />
      </svg>
      Trending
    </span>
  );
}

// ── Cross-Reply Header ──────────────────────────────────────────────

function CrossReplyHeader({ post, philosopher }: { post: Post; philosopher: { name: string; color: string } }) {
  const replyTarget = post.replyTo ? allPosts.find(p => p.id === post.replyTo) : null;
  const targetPhilosopher = replyTarget ? philosophers[replyTarget.philosopherId] : null;

  if (!replyTarget || !targetPhilosopher) {
    return null;
  }

  return (
    <div
      className="flex items-center gap-3 mb-3 px-4 py-2.5 rounded-lg"
      style={{ backgroundColor: `${philosopher.color}08`, border: `1px solid ${philosopher.color}15` }}
    >
      <div className="flex items-center gap-2">
        <PhilosopherAvatar philosopherId={post.philosopherId} size="sm" />
        <span className="font-serif font-bold text-sm text-ink">{philosopher.name}</span>
      </div>
      <div className="flex items-center gap-1.5 text-ink-lighter">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M4 8H12" strokeLinecap="round" />
          <path d="M9 5L12 8L9 11" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-xs font-mono">responds to</span>
      </div>
      <div className="flex items-center gap-2">
        <PhilosopherAvatar philosopherId={replyTarget.philosopherId} size="sm" />
        <span className="font-serif font-bold text-sm text-ink">{targetPhilosopher.name}</span>
      </div>
    </div>
  );
}

// ── Truncated Content ───────────────────────────────────────────────

const TRUNCATE_LIMIT = 140;

function PostContent({ content, color, isAphorism }: { content: string; color: string; isAphorism?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const needsTruncation = content.length > TRUNCATE_LIMIT;
  const displayText = needsTruncation && !expanded
    ? content.slice(0, TRUNCATE_LIMIT).replace(/\s+\S*$/, '') + "\u2026"
    : content;

  if (isAphorism) {
    return (
      <div className="text-[16px] text-ink mb-3 whitespace-pre-line text-center leading-relaxed font-serif italic px-4">
        {displayText}
        {needsTruncation && !expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="ml-1 text-terracotta/80 hover:text-terracotta text-[13px] font-body not-italic transition-colors"
          >
            Read more
          </button>
        )}
        {needsTruncation && expanded && (
          <button
            onClick={() => setExpanded(false)}
            className="ml-1 text-terracotta/80 hover:text-terracotta text-[13px] font-body not-italic transition-colors"
          >
            Show less
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className="text-[15px] text-ink mb-3 whitespace-pre-line"
      style={{
        borderLeft: `2px solid ${color}25`,
        paddingLeft: '12px',
        lineHeight: '1.7',
      }}
    >
      {displayText}
      {needsTruncation && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="ml-1 text-terracotta/80 hover:text-terracotta text-[13px] transition-colors"
        >
          Read more
        </button>
      )}
      {needsTruncation && expanded && (
        <button
          onClick={() => setExpanded(false)}
          className="ml-1 text-terracotta/80 hover:text-terracotta text-[13px] transition-colors"
        >
          Show less
        </button>
      )}
    </div>
  );
}

// ── Main PostCard ───────────────────────────────────────────────────

export function PostCard({
  post,
  delay = 0,
}: {
  post: Post;
  delay?: number;
}) {
  const ref = useScrollReveal<HTMLElement>(delay);
  const philosopher = philosophers[post.philosopherId];
  if (!philosopher) return null;

  const isCrossReply = post.tag === "Cross-Philosopher Reply";
  const isAphorism = post.tag === "Practical Wisdom" || post.tag === "Timeless Wisdom";
  const isPopular = post.likes >= 50;

  return (
    <article
      ref={ref}
      className="animate-fade-in-up px-5 py-5 border-b border-border-light hover:bg-parchment-dark/40 transition-colors duration-300"
      style={{
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        borderLeftWidth: isPopular ? '3px' : undefined,
        borderLeftColor: isPopular ? 'var(--color-terracotta)' : undefined,
        borderLeftStyle: isPopular ? 'solid' : undefined,
      }}
    >
      {/* Cross-reply prominent header */}
      {isCrossReply && (
        <CrossReplyHeader post={post} philosopher={philosopher} />
      )}

      {/* Non-cross-reply: regular reply indicator */}
      {post.replyTo && !isCrossReply && (
        <div className="flex items-center gap-2 ml-12 mb-2 text-xs text-ink-lighter">
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M6 3L3 6L6 9" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M3 6H10C12.2091 6 14 7.79086 14 10V13" strokeLinecap="round" />
          </svg>
          Replying to thread
        </div>
      )}

      {/* Aphorism layout: centered, no avatar sidebar */}
      {isAphorism ? (
        <div className="flex flex-col items-center text-center">
          {/* Header centered */}
          <div className="flex items-center gap-2 mb-4">
            <Link href={`/philosophers/${post.philosopherId}`}>
              <PhilosopherAvatar philosopherId={post.philosopherId} />
            </Link>
            <div className="flex items-center gap-2">
              <Link
                href={`/philosophers/${post.philosopherId}`}
                className="font-serif font-bold text-ink hover:text-athenian transition-colors duration-200"
              >
                {philosopher.name}
              </Link>
              <span className="text-xs text-ink-lighter">&middot;</span>
              <span className="text-xs text-ink-lighter">{post.timestamp}</span>
            </div>
          </div>

          {/* Stance + Popular */}
          <div className="flex items-center gap-2 mb-4">
            <StanceBadge stance={post.stance} />
            {isPopular && <PopularBadge />}
          </div>

          {/* Thesis as aphorism pull-quote */}
          <blockquote
            className="font-serif text-lg sm:text-xl leading-relaxed text-ink mb-4 max-w-md px-2"
            style={{ fontWeight: 600 }}
          >
            &ldquo;{post.thesis}&rdquo;
          </blockquote>

          {/* Body text */}
          <PostContent content={post.content} color={philosopher.color} isAphorism />

          {/* Citation */}
          {post.citation && (
            <div className="w-full mt-1">
              <CitationBlock citation={post.citation} color={philosopher.color} />
            </div>
          )}

          {/* Tag + Actions */}
          <div className="flex items-center justify-between gap-2 flex-wrap w-full mt-1">
            <TagBadge tag={post.tag} color={philosopher.color} />
            <ActionButtons post={post} />
          </div>

        </div>
      ) : (
        /* Standard / news-reaction / cross-reply layout */
        <div className="flex gap-3">
          {!isCrossReply && (
            <Link href={`/philosophers/${post.philosopherId}`}>
              <PhilosopherAvatar philosopherId={post.philosopherId} />
            </Link>
          )}

          <div className="flex-1 min-w-0">
            {/* Header */}
            {!isCrossReply && (
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <Link
                  href={`/philosophers/${post.philosopherId}`}
                  className="font-serif font-bold text-ink hover:text-athenian transition-colors duration-200"
                >
                  {philosopher.name}
                </Link>
                <StanceBadge stance={post.stance} />
                {isPopular && <PopularBadge />}
                <span className="text-xs text-ink-lighter">&middot;</span>
                <span className="text-xs text-ink-lighter">{post.timestamp}</span>
              </div>
            )}

            {/* Cross-reply: compact header after the prominent one */}
            {isCrossReply && (
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <StanceBadge stance={post.stance} />
                {isPopular && <PopularBadge />}
                <span className="text-xs text-ink-lighter">&middot;</span>
                <span className="text-xs text-ink-lighter">{post.timestamp}</span>
              </div>
            )}

            {/* Thesis pull-quote */}
            <blockquote
              className="font-serif text-[17px] leading-snug text-ink mb-3 pl-3"
              style={{
                borderLeft: `3px solid ${philosopher.color}`,
                fontWeight: 600,
              }}
            >
              {post.thesis}
            </blockquote>

            {/* Content */}
            <PostContent content={post.content} color={philosopher.color} />

            {/* Citation */}
            {post.citation && (
              <CitationBlock citation={post.citation} color={philosopher.color} />
            )}

            {/* Tag + Actions row */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <TagBadge tag={post.tag} color={philosopher.color} />
              <ActionButtons post={post} />
            </div>

          </div>
        </div>
      )}
    </article>
  );
}

// ── Citation Block ──────────────────────────────────────────────────

function CitationBlock({ citation, color }: { citation: NonNullable<Post["citation"]>; color: string }) {
  if (citation.url) {
    return (
      <a
        href={citation.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2.5 mb-3 px-4 py-2.5 rounded-lg border hover:border-border transition-colors duration-200 group"
        style={{
          backgroundColor: `${color}08`,
          borderColor: `${color}20`,
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          className="shrink-0 opacity-60"
        >
          <path d="M3 12L3 4C3 2.89543 3.89543 2 5 2H11C12.1046 2 13 2.89543 13 4V12C13 13.1046 12.1046 14 11 14H5C3.89543 14 3 13.1046 3 12Z" />
          <path d="M6 6H10" strokeLinecap="round" />
          <path d="M6 9H8" strokeLinecap="round" />
        </svg>
        <div className="flex flex-col min-w-0">
          <span className="text-sm text-ink-light group-hover:text-athenian transition-colors truncate font-medium">
            {citation.title}
          </span>
          <span className="text-[11px] text-ink-lighter font-mono">
            {citation.source}
          </span>
        </div>
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="ml-auto text-ink-lighter group-hover:text-athenian shrink-0 transition-colors"
        >
          <path d="M6 3H3V13H13V10" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9 2H14V7" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M14 2L7 9" strokeLinecap="round" />
        </svg>
      </a>
    );
  }

  return (
    <div
      className="flex items-center gap-2.5 mb-3 px-4 py-2.5 rounded-lg border"
      style={{
        backgroundColor: `${color}08`,
        borderColor: `${color}20`,
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        className="shrink-0 opacity-60"
      >
        <path d="M3 12L3 4C3 2.89543 3.89543 2 5 2H11C12.1046 2 13 2.89543 13 4V12C13 13.1046 12.1046 14 11 14H5C3.89543 14 3 13.1046 3 12Z" />
        <path d="M6 6H10" strokeLinecap="round" />
        <path d="M6 9H8" strokeLinecap="round" />
      </svg>
      <div className="flex flex-col min-w-0">
        <span className="text-sm text-ink-light font-medium">
          {citation.title}
        </span>
        <span className="text-[11px] text-ink-lighter font-mono">
          {citation.source}
        </span>
      </div>
    </div>
  );
}

// ── Action Buttons Row ──────────────────────────────────────────────

function ActionButtons({ post }: { post: Post }) {
  return (
    <div className="flex items-center gap-3 sm:gap-5">
      <ActionButton
        label="Reply"
        count={post.replies}
        icon={
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6L2 15V4C2 3.46957 2.21071 2.96086 2.58579 2.58579C2.96086 2.21071 3.46957 2 4 2H12C12.5304 2 13.0391 2.21071 13.4142 2.58579C13.7893 2.96086 14 3.46957 14 4V10Z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        }
      />
      <ActionButton
        label="Like"
        count={post.likes}
        icon={
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M8 14L1.5 7.5C0.5 6.5 0.5 4.5 1.5 3.5C2.5 2.5 4.5 2.5 5.5 3.5L8 6L10.5 3.5C11.5 2.5 13.5 2.5 14.5 3.5C15.5 4.5 15.5 6.5 14.5 7.5L8 14Z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        }
      />
      <ActionButton
        label="Bookmark"
        count={post.bookmarks}
        icon={
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 2H13V14L8 11L3 14V2Z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        }
      />
      <ActionButton
        label="Share"
        icon={
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 8V13C2 13.5523 2.44772 14 3 14H13C13.5523 14 14 13.5523 14 13V8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M8 2V10" strokeLinecap="round" />
            <path d="M5 5L8 2L11 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        }
      />
    </div>
  );
}
