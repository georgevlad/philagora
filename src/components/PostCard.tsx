"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { FeedPost } from "@/lib/types";
import { PhilosopherAvatar } from "./PhilosopherAvatar";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { STANCE_CONFIG, POST_CONTENT_TRUNCATE_LIMIT } from "@/lib/constants";

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

function StanceBadge({ stance }: { stance: FeedPost["stance"] }) {
  const config = STANCE_CONFIG[stance];
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

function CrossReplyHeader({ post }: { post: FeedPost }) {
  if (!post.replyTargetPhilosopherId || !post.replyTargetPhilosopherName) {
    return null;
  }

  return (
    <div className="mb-3">
      <div
        className="flex items-center gap-3 px-4 py-2.5 rounded-lg"
        style={{ backgroundColor: `${post.philosopherColor}08`, border: `1px solid ${post.philosopherColor}15` }}
      >
        <div className="flex items-center gap-2">
          <PhilosopherAvatar philosopherId={post.philosopherId} name={post.philosopherName} color={post.philosopherColor} initials={post.philosopherInitials} size="sm" />
          <span className="font-serif font-bold text-sm text-ink">{post.philosopherName}</span>
        </div>
        <div className="flex items-center gap-1.5 text-ink-lighter">
          <span className="text-xs font-mono">vs</span>
        </div>
        <div className="flex items-center gap-2">
          <PhilosopherAvatar philosopherId={post.replyTargetPhilosopherId} name={post.replyTargetPhilosopherName} color={post.replyTargetPhilosopherColor!} initials={post.replyTargetPhilosopherInitials!} size="sm" />
          <span className="font-serif font-bold text-sm text-ink">{post.replyTargetPhilosopherName}</span>
        </div>
      </div>
      {/* Vertical connector line */}
      <div className="flex justify-center">
        <div
          className="w-px h-3"
          style={{ backgroundColor: `${post.philosopherColor}30` }}
        />
      </div>
    </div>
  );
}

// ── Truncated Content ───────────────────────────────────────────────

function PostContent({ content, color, isAphorism }: { content: string; color: string; isAphorism?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const needsTruncation = content.length > POST_CONTENT_TRUNCATE_LIMIT;
  const displayText = needsTruncation && !expanded
    ? content.slice(0, POST_CONTENT_TRUNCATE_LIMIT).replace(/\s+\S*$/, '') + "\u2026"
    : content;

  const toggleButton = needsTruncation && (
    <button
      onClick={() => setExpanded(!expanded)}
      className={`ml-1 text-terracotta/80 hover:text-terracotta text-[13px] transition-colors ${isAphorism ? 'font-body not-italic' : ''}`}
    >
      {expanded ? 'Show less' : 'Read more'}
    </button>
  );

  if (isAphorism) {
    return (
      <div className="text-[16px] text-ink mb-3 whitespace-pre-line text-center leading-relaxed font-serif italic px-4">
        {displayText}
        {toggleButton}
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
      {toggleButton}
    </div>
  );
}

// ── Main PostCard ───────────────────────────────────────────────────

export function PostCard({
  post,
  delay = 0,
}: {
  post: FeedPost;
  delay?: number;
}) {
  const ref = useScrollReveal<HTMLElement>(delay);

  const color = post.philosopherColor;
  const isCrossReply = post.tag === "Cross-Philosopher Reply";
  const isAphorism = post.tag === "Practical Wisdom" || post.tag === "Timeless Wisdom";
  const isNewsReaction = !!post.citation;
  const isPopular = post.likes >= 50;

  return (
    <article
      ref={ref}
      className="animate-fade-in-up rounded-xl bg-white/60 border border-border-light mx-3 my-2 sm:mx-4 sm:my-3 overflow-hidden hover:shadow-md transition-shadow duration-200"
      style={{
        borderTop: `2px solid ${color}`,
        borderLeftWidth: isPopular ? '3px' : undefined,
        borderLeftColor: isPopular ? 'var(--color-terracotta)' : undefined,
        borderLeftStyle: isPopular ? 'solid' : undefined,
      }}
    >
      <div className="px-5 py-5">
        {/* Cross-reply prominent header */}
        {isCrossReply && (
          <CrossReplyHeader post={post} />
        )}

        {/* Non-cross-reply: regular reply indicator */}
        {post.replyTo && !isCrossReply && (
          <div className="flex items-center gap-2 ml-12 mb-2 text-xs text-ink-lighter">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 3L3 6L6 9" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3 6H10C12.2091 6 14 7.79086 14 10V13" strokeLinecap="round" />
            </svg>
            Replying to thread
          </div>
        )}

        {/* Aphorism layout: centered, no avatar sidebar */}
        {isAphorism ? (
          <div className="flex flex-col items-center text-center relative">
            {/* Decorative quotation mark */}
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 font-serif select-none pointer-events-none"
              style={{ fontSize: '120px', color: `${color}08`, lineHeight: 1 }}
              aria-hidden="true"
            >
              &#x201C;
            </div>

            {/* Header centered */}
            <div className="flex items-center gap-2 mb-4 relative z-10">
              <Link href={`/philosophers/${post.philosopherId}`}>
                <PhilosopherAvatar philosopherId={post.philosopherId} name={post.philosopherName} color={color} initials={post.philosopherInitials} />
              </Link>
              <div className="flex items-center gap-2">
                <Link
                  href={`/philosophers/${post.philosopherId}`}
                  className="font-serif font-bold text-ink hover:text-athenian transition-colors duration-200"
                >
                  {post.philosopherName}
                </Link>
                <span className="text-xs text-ink-lighter">&middot;</span>
                <span className="text-xs text-ink-lighter">{post.timestamp}</span>
              </div>
            </div>

            {/* Stance + Popular */}
            <div className="flex items-center gap-2 mb-4 relative z-10">
              <StanceBadge stance={post.stance} />
              {isPopular && <PopularBadge />}
            </div>

            {/* Thesis as aphorism pull-quote */}
            <blockquote
              className="font-serif text-lg sm:text-xl leading-relaxed text-ink mb-4 max-w-md px-2 relative z-10"
              style={{ fontWeight: 600 }}
            >
              &ldquo;{post.thesis}&rdquo;
            </blockquote>

            {/* Decorative divider */}
            <div
              className="w-12 mx-auto mb-4"
              style={{ height: '1px', backgroundColor: `${color}30` }}
            />

            {/* Body text */}
            <PostContent content={post.content} color={color} isAphorism />

            {/* Citation */}
            {post.citation && (
              <div className="w-full mt-1">
                <CitationBlock citation={post.citation} color={color} isNewsReaction={false} />
              </div>
            )}

            {/* Tag + Actions */}
            <div className="flex items-center justify-between gap-2 flex-wrap w-full mt-1">
              <TagBadge tag={post.tag} color={color} />
              <ActionButtons post={post} />
            </div>
          </div>
        ) : (
          /* Standard / news-reaction / cross-reply layout */
          <div className="flex gap-3">
            {!isCrossReply && (
              <Link href={`/philosophers/${post.philosopherId}`}>
                <PhilosopherAvatar philosopherId={post.philosopherId} name={post.philosopherName} color={color} initials={post.philosopherInitials} />
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
                    {post.philosopherName}
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
                  borderLeft: `3px solid ${color}`,
                  fontWeight: 600,
                }}
              >
                {post.thesis}
              </blockquote>

              {/* Content */}
              <PostContent content={post.content} color={color} />

              {/* Citation */}
              {post.citation && (
                <CitationBlock citation={post.citation} color={color} isNewsReaction={isNewsReaction} />
              )}

              {/* Tag + Actions row */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <TagBadge tag={post.tag} color={color} />
                <ActionButtons post={post} />
              </div>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

// ── Citation Block ──────────────────────────────────────────────────

function CitationBlock({
  citation,
  color,
  isNewsReaction = false,
}: {
  citation: NonNullable<FeedPost["citation"]>;
  color: string;
  isNewsReaction?: boolean;
}) {
  const inner = (
    <div className="flex items-center gap-3">
      {citation.imageUrl ? (
        <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-parchment-dark/30">
          <Image
            src={citation.imageUrl}
            alt=""
            width={64}
            height={64}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="w-10 h-10 rounded-lg shrink-0 flex items-center justify-center" style={{ backgroundColor: `${color}10` }}>
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5" className="opacity-50">
            <path d="M3 12L3 4C3 2.89543 3.89543 2 5 2H11C12.1046 2 13 2.89543 13 4V12C13 13.1046 12.1046 14 11 14H5C3.89543 14 3 13.1046 3 12Z" />
            <path d="M6 6H10" strokeLinecap="round" />
            <path d="M6 9H8" strokeLinecap="round" />
          </svg>
        </div>
      )}
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-[11px] text-ink-lighter font-mono mb-0.5">
          {citation.source}
        </span>
        <span className="text-sm text-ink-light font-medium line-clamp-2 group-hover:text-athenian transition-colors">
          {citation.title}
        </span>
      </div>
      {citation.url && (
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-ink-lighter group-hover:text-athenian shrink-0 transition-colors"
        >
          <path d="M6 3H3V13H13V10" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9 2H14V7" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M14 2L7 9" strokeLinecap="round" />
        </svg>
      )}
    </div>
  );

  return (
    <div className="mb-3">
      {/* "Reacting to" label for news posts */}
      {isNewsReaction && (
        <div className="flex items-center gap-1.5 mb-1.5 text-[10px] font-mono text-ink-lighter uppercase tracking-wider">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-60">
            <path d="M3 12L3 4C3 2.89543 3.89543 2 5 2H11C12.1046 2 13 2.89543 13 4V12C13 13.1046 12.1046 14 11 14H5C3.89543 14 3 13.1046 3 12Z" />
            <path d="M6 6H10" strokeLinecap="round" />
            <path d="M6 9H8" strokeLinecap="round" />
          </svg>
          Reacting to
        </div>
      )}
      {citation.url ? (
        <a
          href={citation.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block px-4 py-3 rounded-lg bg-parchment-dark/30 border border-border-light hover:border-border transition-colors duration-200 group"
        >
          {inner}
        </a>
      ) : (
        <div className="px-4 py-3 rounded-lg bg-parchment-dark/30 border border-border-light group">
          {inner}
        </div>
      )}
    </div>
  );
}

// ── Action Buttons Row ──────────────────────────────────────────────

function ActionButtons({ post }: { post: FeedPost }) {
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
