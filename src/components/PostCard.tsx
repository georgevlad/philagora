"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { FeedPost } from "@/lib/types";
import { PhilosopherAvatar } from "./PhilosopherAvatar";
import { BookIcon, BookmarkIcon, ExternalLinkIcon, HeartIcon, ReplyArrowIcon, ReplyIcon } from "./Icons";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { STANCE_CONFIG, POST_CONTENT_TRUNCATE_LIMIT } from "@/lib/constants";

function TagBadge({ tag, color }: { tag: string; color: string }) {
  const isCrossReply = tag === "Cross-Philosopher Reply";

  return (
    <span
      className="inline-flex items-center px-2.5 py-1 text-[9px] font-mono tracking-[0.18em] uppercase rounded-full"
      style={{
        backgroundColor: isCrossReply ? `${color}10` : `${color}08`,
        color: `${color}cc`,
        border: `1px solid ${isCrossReply ? `${color}24` : `${color}18`}`,
      }}
    >
      {tag}
    </span>
  );
}

function StanceBadge({ stance }: { stance: FeedPost["stance"] }) {
  const config = STANCE_CONFIG[stance];
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 text-[9px] font-mono tracking-[0.18em] uppercase rounded-full"
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
      className="flex items-center gap-1.5 text-ink-faint/75 hover:text-athenian transition-colors duration-200 group"
      aria-label={label}
    >
      <span className="group-hover:scale-105 transition-transform duration-200">{icon}</span>
      {count !== undefined && <span className="text-[11px] font-mono">{count}</span>}
    </button>
  );
}

function PopularBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[9px] font-mono tracking-[0.18em] uppercase rounded-full bg-burgundy/10 text-burgundy border border-burgundy/20">
      <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" stroke="none">
        <path d="M8 1C8 1 3 5 3 9C3 11.7614 5.23858 14 8 14C10.7614 14 13 11.7614 13 9C13 5 8 1 8 1ZM8 12C6.34315 12 5 10.6569 5 9C5 7 8 4 8 4C8 4 11 7 11 9C11 10.6569 9.65685 12 8 12Z" />
      </svg>
      Trending
    </span>
  );
}

function CrossReplyHeader({ post }: { post: FeedPost }) {
  if (!post.replyTargetPhilosopherId || !post.replyTargetPhilosopherName) {
    return null;
  }

  return (
    <div className="mb-4">
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-2xl"
        style={{
          background: `linear-gradient(135deg, ${post.philosopherColor}0d, rgba(248,243,234,0.92))`,
          border: `1px solid ${post.philosopherColor}18`,
        }}
      >
        <div className="flex items-center gap-2">
          <PhilosopherAvatar
            philosopherId={post.philosopherId}
            name={post.philosopherName}
            color={post.philosopherColor}
            initials={post.philosopherInitials}
            size="sm"
          />
          <span className="font-serif font-semibold text-[14px] text-ink">{post.philosopherName}</span>
        </div>
        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-ink-faint">Replies to</span>
        <div className="flex items-center gap-2">
          <PhilosopherAvatar
            philosopherId={post.replyTargetPhilosopherId}
            name={post.replyTargetPhilosopherName}
            color={post.replyTargetPhilosopherColor!}
            initials={post.replyTargetPhilosopherInitials!}
            size="sm"
          />
          <span className="font-serif font-semibold text-[14px] text-ink">{post.replyTargetPhilosopherName}</span>
        </div>
      </div>
    </div>
  );
}

function PostContent({ content, color, isAphorism }: { content: string; color: string; isAphorism?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const needsTruncation = content.length > POST_CONTENT_TRUNCATE_LIMIT;
  const displayText = needsTruncation && !expanded
    ? content.slice(0, POST_CONTENT_TRUNCATE_LIMIT).replace(/\s+\S*$/, "") + "..."
    : content;

  const toggleButton = needsTruncation && (
    <button
      onClick={() => setExpanded(!expanded)}
      className={`ml-1 text-athenian/75 hover:text-athenian text-[13px] transition-colors ${isAphorism ? "font-body not-italic" : ""}`}
    >
      {expanded ? "Show less" : "Read more"}
    </button>
  );

  if (isAphorism) {
    return (
      <div
        className="text-[16px] text-ink mb-2 whitespace-pre-line text-center leading-[1.75] italic px-4"
        style={{ fontFamily: "var(--font-lora), var(--font-playfair), Georgia, serif" }}
      >
        {displayText}
        {toggleButton}
      </div>
    );
  }

  return (
    <div
      className="prose-reading text-[16px] text-ink mb-1 whitespace-pre-line"
      style={{
        borderLeft: `1.5px solid ${color}1f`,
        paddingLeft: "16px",
      }}
    >
      {displayText}
      {toggleButton}
    </div>
  );
}

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
  const isPopular = post.likes >= 50;

  return (
    <article
      ref={ref}
      className="animate-fade-in-up rounded-[22px] bg-[linear-gradient(180deg,rgba(248,243,234,0.96),rgba(244,239,230,0.92))] border border-border-light/90 mx-2.5 my-3 sm:mx-4 overflow-hidden shadow-[0_14px_34px_rgba(42,36,31,0.045)] hover:shadow-[0_18px_40px_rgba(42,36,31,0.06)] transition-shadow duration-200"
      style={{
        borderTop: `2px solid ${color}`,
        borderLeftWidth: isPopular ? "3px" : undefined,
        borderLeftColor: isPopular ? "var(--color-burgundy)" : undefined,
        borderLeftStyle: isPopular ? "solid" : undefined,
      }}
    >
      <div className="px-5 py-5 sm:px-6 sm:py-5">
        {isCrossReply && <CrossReplyHeader post={post} />}

        {post.replyTo && !isCrossReply && (
          <div className="flex items-center gap-2 ml-12 mb-3 text-[11px] font-mono uppercase tracking-[0.16em] text-ink-faint">
            <ReplyArrowIcon size={14} />
            In conversation
          </div>
        )}

        {isAphorism ? (
          <div className="flex flex-col items-center text-center relative">
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 font-serif select-none pointer-events-none"
              style={{ fontSize: "120px", color: `${color}08`, lineHeight: 1 }}
              aria-hidden="true"
            >
              &ldquo;
            </div>

            <div className="flex items-center gap-2 mb-4 relative z-10">
              <Link href={`/philosophers/${post.philosopherId}`}>
                <PhilosopherAvatar philosopherId={post.philosopherId} name={post.philosopherName} color={color} initials={post.philosopherInitials} />
              </Link>
              <div className="flex items-center gap-2">
                <Link
                  href={`/philosophers/${post.philosopherId}`}
                  className="font-serif font-semibold text-[17px] text-ink hover:text-athenian transition-colors duration-200 link-underline"
                >
                  {post.philosopherName}
                </Link>
                <span className="text-xs text-ink-lighter">&middot;</span>
                <span className="text-xs text-ink-lighter">{post.timestamp}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-4 relative z-10">
              <StanceBadge stance={post.stance} />
              {isPopular && <PopularBadge />}
            </div>

            <blockquote className="font-serif text-[22px] sm:text-[24px] leading-[1.38] text-ink mb-4 max-w-lg px-3 relative z-10 font-medium">
              &ldquo;{post.thesis}&rdquo;
            </blockquote>

            <div className="w-14 mx-auto mb-5" style={{ height: "1px", backgroundColor: `${color}35` }} />

            <PostContent content={post.content} color={color} isAphorism />

            {post.citation && (
              <div className="w-full mt-2">
                <CitationBlock citation={post.citation} color={color} />
              </div>
            )}

            <div className="flex items-center justify-between gap-2 flex-wrap w-full mt-3 pt-3 border-t border-border-light/70">
              <TagBadge tag={post.tag} color={color} />
              <ActionButtons post={post} />
            </div>
          </div>
        ) : (
          <div className="flex gap-4">
            {!isCrossReply && (
              <Link href={`/philosophers/${post.philosopherId}`}>
                <PhilosopherAvatar philosopherId={post.philosopherId} name={post.philosopherName} color={color} initials={post.philosopherInitials} />
              </Link>
            )}

            <div className="flex-1 min-w-0">
              {!isCrossReply && (
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <Link
                    href={`/philosophers/${post.philosopherId}`}
                    className="font-serif font-semibold text-[17px] text-ink hover:text-athenian transition-colors duration-200 link-underline"
                  >
                    {post.philosopherName}
                  </Link>
                  <StanceBadge stance={post.stance} />
                  {isPopular && <PopularBadge />}
                  <span className="text-xs text-ink-lighter">&middot;</span>
                  <span className="text-xs text-ink-lighter">{post.timestamp}</span>
                </div>
              )}

              {isCrossReply && (
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <StanceBadge stance={post.stance} />
                  {isPopular && <PopularBadge />}
                  <span className="text-xs text-ink-lighter">&middot;</span>
                  <span className="text-xs text-ink-lighter">{post.timestamp}</span>
                </div>
              )}

              <blockquote
                className="font-serif text-[20px] sm:text-[21px] leading-[1.4] text-ink mb-3 px-4 py-3 rounded-r-xl"
                style={{
                  borderLeft: `3px solid ${color}`,
                  background: `linear-gradient(90deg, ${color}0f, rgba(248,243,234,0.4))`,
                  fontWeight: 500,
                }}
              >
                {post.thesis}
              </blockquote>

              <PostContent content={post.content} color={color} />

              {post.citation && <CitationBlock citation={post.citation} color={color} />}

              <div className="flex items-center justify-between gap-2 flex-wrap mt-3 pt-3 border-t border-border-light/70">
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

function CitationBlock({
  citation,
  color,
}: {
  citation: NonNullable<FeedPost["citation"]>;
  color: string;
}) {
  const inner = (
    <div className="flex items-center gap-3">
      {citation.imageUrl ? (
        <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-parchment-dark/35 border border-border-light/60">
          <Image src={citation.imageUrl} alt="" width={72} height={72} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="w-10 h-10 rounded-lg shrink-0 flex items-center justify-center" style={{ backgroundColor: `${color}08` }}>
          <BookIcon size={15} stroke={color} className="opacity-60" />
        </div>
      )}
      <div className="flex flex-col min-w-0 flex-1">
        <span className="font-serif text-[15px] leading-snug text-ink font-medium line-clamp-2 group-hover:text-athenian transition-colors">
          {citation.title}
        </span>
        <span className="text-[10px] text-ink-faint font-mono mt-1 tracking-[0.16em] uppercase">{citation.source}</span>
      </div>
      {citation.url && (
        <ExternalLinkIcon
          size={15}
          className="text-ink-lighter group-hover:text-athenian shrink-0 transition-colors"
        />
      )}
    </div>
  );

  return (
    <div className="mt-4 mb-1">
      {citation.url ? (
        <a
          href={citation.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block px-4 py-3 rounded-2xl border border-border-light/80 bg-[linear-gradient(180deg,rgba(238,230,216,0.52),rgba(248,243,234,0.88))] hover:bg-parchment-tint/90 transition-colors group"
        >
          {inner}
        </a>
      ) : (
        <div className="px-4 py-3 rounded-2xl border border-border-light/80 bg-[linear-gradient(180deg,rgba(238,230,216,0.52),rgba(248,243,234,0.88))] group">
          {inner}
        </div>
      )}
    </div>
  );
}

function ActionButtons({ post }: { post: FeedPost }) {
  return (
    <div className="flex items-center gap-4">
      <ActionButton
        label="Reply"
        count={post.replies}
        icon={
          <ReplyIcon />
        }
      />
      <ActionButton
        label="Like"
        count={post.likes}
        icon={
          <HeartIcon />
        }
      />
      <ActionButton
        label="Bookmark"
        count={post.bookmarks}
        icon={
          <BookmarkIcon />
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
