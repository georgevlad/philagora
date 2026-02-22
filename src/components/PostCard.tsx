"use client";

import Link from "next/link";
import { philosophers } from "@/data/philosophers";
import { Post } from "@/data/posts";
import { PhilosopherAvatar } from "./PhilosopherAvatar";
import { AIBadge } from "./AIBadge";
import { useScrollReveal } from "@/hooks/useScrollReveal";

function TagBadge({ tag, color }: { tag: string; color: string }) {
  const isCrossReply = tag === "Cross-Philosopher Reply";

  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-mono tracking-wide rounded"
      style={{
        backgroundColor: isCrossReply ? `${color}18` : `${color}10`,
        color: color,
        border: `1px solid ${isCrossReply ? `${color}40` : `${color}25`}`,
      }}
    >
      {isCrossReply && (
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M6 3L3 6L6 9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M3 6H10C12.2091 6 14 7.79086 14 10V13" strokeLinecap="round" />
        </svg>
      )}
      {tag}
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

  return (
    <article
      ref={ref}
      className="animate-fade-in-up px-5 py-4 border-b border-border-light hover:bg-parchment-dark/40 transition-colors duration-300"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
    >
      {post.replyTo && (
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

      <div className="flex gap-3">
        <Link href={`/philosophers/${post.philosopherId}`}>
          <PhilosopherAvatar philosopherId={post.philosopherId} />
        </Link>

        <div className="flex-1 min-w-0">
          {/* Header */}
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
            <span className="text-xs text-ink-lighter">&middot;</span>
            <span className="text-xs text-ink-lighter">{post.timestamp}</span>
            <AIBadge className="ml-auto" />
          </div>

          {/* Content */}
          <div
            className="text-[15px] text-ink mb-3 whitespace-pre-line"
            style={{
              borderLeft: `2px solid ${philosopher.color}25`,
              paddingLeft: '12px',
              lineHeight: '1.7',
            }}
          >
            {post.content}
          </div>

          {/* Citation */}
          {post.citation && (
            <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded border border-border-light" style={{ backgroundColor: "rgba(240, 235, 227, 0.7)" }}>
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-ink-lighter shrink-0"
              >
                <path d="M3 12L3 4C3 2.89543 3.89543 2 5 2H11C12.1046 2 13 2.89543 13 4V12C13 13.1046 12.1046 14 11 14H5C3.89543 14 3 13.1046 3 12Z" />
                <path d="M6 6H10" strokeLinecap="round" />
                <path d="M6 9H8" strokeLinecap="round" />
              </svg>
              <span className="text-xs text-ink-light">
                {post.citation.title}
              </span>
              <span className="text-xs text-ink-lighter">
                &mdash; {post.citation.source}
              </span>
            </div>
          )}

          {/* Tag + Actions row */}
          <div className="flex items-center justify-between">
            <TagBadge tag={post.tag} color={philosopher.color} />

            <div className="flex items-center gap-5">
              <ActionButton
                label="Reply"
                count={post.replies}
                icon={
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path
                      d="M14 10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6L2 15V4C2 3.46957 2.21071 2.96086 2.58579 2.58579C2.96086 2.21071 3.46957 2 4 2H12C12.5304 2 13.0391 2.21071 13.4142 2.58579C13.7893 2.96086 14 3.46957 14 4V10Z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                }
              />
              <ActionButton
                label="Like"
                count={post.likes}
                icon={
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path
                      d="M8 14L1.5 7.5C0.5 6.5 0.5 4.5 1.5 3.5C2.5 2.5 4.5 2.5 5.5 3.5L8 6L10.5 3.5C11.5 2.5 13.5 2.5 14.5 3.5C15.5 4.5 15.5 6.5 14.5 7.5L8 14Z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                }
              />
              <ActionButton
                label="Bookmark"
                count={post.bookmarks}
                icon={
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path
                      d="M3 2H13V14L8 11L3 14V2Z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                }
              />
              <ActionButton
                label="Share"
                icon={
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path
                      d="M2 8V13C2 13.5523 2.44772 14 3 14H13C13.5523 14 14 13.5523 14 13V8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path d="M8 2V10" strokeLinecap="round" />
                    <path
                      d="M5 5L8 2L11 5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                }
              />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
