"use client";

import { useState } from "react";
import Link from "next/link";
import { philosophers } from "@/data/philosophers";
import { Post, Stance, posts as allPosts } from "@/data/posts";
import { PhilosopherAvatar } from "./PhilosopherAvatar";
import { AIBadge } from "./AIBadge";
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

// ── Tag icons ───────────────────────────────────────────────────────

function TagIcon({ tag }: { tag: string }) {
  const size = 12;
  const props = { width: size, height: size, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5" };

  switch (tag) {
    case "Ethical Analysis":
      // Scales icon
      return (
        <svg {...props}>
          <path d="M8 2V14" strokeLinecap="round" />
          <path d="M4 4L8 2L12 4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M2 9L4 4L6 9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10 9L12 4L14 9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M2 9C2 9 2.5 11 4 11C5.5 11 6 9 6 9" />
          <path d="M10 9C10 9 10.5 11 12 11C13.5 11 14 9 14 9" />
        </svg>
      );
    case "Political Commentary":
      // Scroll/document icon
      return (
        <svg {...props}>
          <path d="M4 2H12C12.5523 2 13 2.44772 13 3V13C13 13.5523 12.5523 14 12 14H4C3.44772 14 3 13.5523 3 13V3C3 2.44772 3.44772 2 4 2Z" />
          <path d="M6 5H10" strokeLinecap="round" />
          <path d="M6 8H10" strokeLinecap="round" />
          <path d="M6 11H8" strokeLinecap="round" />
        </svg>
      );
    case "Metaphysical Reflection":
      // Eye icon
      return (
        <svg {...props}>
          <path d="M1 8C1 8 4 3 8 3C12 3 15 8 15 8C15 8 12 13 8 13C4 13 1 8 1 8Z" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="8" cy="8" r="2.5" />
        </svg>
      );
    case "Practical Wisdom":
    case "Timeless Wisdom":
      // Compass/star icon
      return (
        <svg {...props}>
          <circle cx="8" cy="8" r="6" />
          <path d="M8 4L9.2 6.8L12 8L9.2 9.2L8 12L6.8 9.2L4 8L6.8 6.8L8 4Z" fill="currentColor" stroke="none" />
        </svg>
      );
    case "Cross-Philosopher Reply":
      // Reply arrows icon
      return (
        <svg {...props}>
          <path d="M6 3L3 6L6 9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M3 6H10C12.2091 6 14 7.79086 14 10V13" strokeLinecap="round" />
        </svg>
      );
    case "Existential Reflection":
      // Spiral icon
      return (
        <svg {...props}>
          <path d="M8 8C8 6.5 9.5 5 11 5C12.5 5 14 6.5 14 8C14 10.5 11.5 13 8 13C4 13 2 10 2 7C2 3.5 5 1 8.5 1" strokeLinecap="round" />
        </svg>
      );
    case "Psychological Insight":
      // Brain/mind icon
      return (
        <svg {...props}>
          <path d="M8 14V8" strokeLinecap="round" />
          <path d="M4.5 8C3.1 8 2 6.9 2 5.5C2 4.1 3.1 3 4.5 3C4.8 2.4 5.6 2 6.5 2C7.6 2 8.5 2.7 8.8 3.6" strokeLinecap="round" />
          <path d="M11.5 8C12.9 8 14 6.9 14 5.5C14 4.1 12.9 3 11.5 3C11.2 2.4 10.4 2 9.5 2C8.8 2 8.2 2.3 7.8 2.8" strokeLinecap="round" />
          <path d="M5 8C5 10 6.3 12 8 12C9.7 12 11 10 11 8" strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
}

// ── Tag Badge ───────────────────────────────────────────────────────

function TagBadge({ tag, color }: { tag: string; color: string }) {
  const isCrossReply = tag === "Cross-Philosopher Reply";

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-mono tracking-wide rounded"
      style={{
        backgroundColor: isCrossReply ? `${color}18` : `${color}10`,
        color: color,
        border: `1px solid ${isCrossReply ? `${color}40` : `${color}25`}`,
      }}
    >
      <TagIcon tag={tag} />
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

// ── Micro-CTAs ──────────────────────────────────────────────────────

function MicroCTAs({ philosopherName }: { philosopherName: string }) {
  const ctas = [
    `Ask ${philosopherName.split(' ')[0]} about this \u2192`,
    "See opposing view \u2192",
    "Explore this debate \u2192",
  ];
  // Pick 1-2 randomly per post for variety (deterministic based on name)
  const seed = philosopherName.length;
  const selected = seed % 2 === 0 ? [ctas[0], ctas[2]] : [ctas[0], ctas[1]];

  return (
    <div className="flex items-center gap-4 mt-1">
      {selected.map((cta) => (
        <Link
          key={cta}
          href="/agora"
          className="text-[11px] text-terracotta/70 hover:text-terracotta transition-colors duration-200 font-body"
        >
          {cta}
        </Link>
      ))}
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
              <span
                className="text-xs font-mono px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: `${philosopher.color}15`,
                  color: philosopher.color,
                }}
              >
                {philosopher.tradition}
              </span>
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

          <MicroCTAs philosopherName={philosopher.name} />
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
                <span
                  className="text-xs font-mono px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: `${philosopher.color}15`,
                    color: philosopher.color,
                  }}
                >
                  {philosopher.tradition}
                </span>
                <StanceBadge stance={post.stance} />
                {isPopular && <PopularBadge />}
                <span className="text-xs text-ink-lighter">&middot;</span>
                <span className="text-xs text-ink-lighter">{post.timestamp}</span>
                <AIBadge className="ml-auto" />
              </div>
            )}

            {/* Cross-reply: compact header after the prominent one */}
            {isCrossReply && (
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <StanceBadge stance={post.stance} />
                {isPopular && <PopularBadge />}
                <span className="text-xs text-ink-lighter">&middot;</span>
                <span className="text-xs text-ink-lighter">{post.timestamp}</span>
                <AIBadge className="ml-auto" />
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

            <MicroCTAs philosopherName={philosopher.name} />
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
