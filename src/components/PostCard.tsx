"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import type { FeedPost } from "@/lib/types";
import { PhilosopherLink } from "./public/PhilosopherLink";
import { SourceCitation } from "./public/SourceCitation";
import { BookmarkIcon, HeartIcon, ReplyIcon } from "./Icons";
import { POST_CONTENT_TRUNCATE_LIMIT } from "@/lib/constants";
import { timeAgo } from "@/lib/date-utils";
import { showComingSoon, showToast } from "./ComingSoonToast";
import { useSession } from "@/lib/auth-client";

function ActionButton({
  icon,
  count,
  label,
  active,
  pending,
  onClick,
}: {
  icon: React.ReactNode;
  count?: number;
  label: string;
  active?: boolean;
  pending?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      disabled={pending}
    >
      {icon}
      {count !== undefined && <span>{count}</span>}
    </button>
  );
}

function parseInlineFormatting(text: string): React.ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
    .map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={i}>{part.slice(2, -2)}</strong>
      ) : part.startsWith("*") && part.endsWith("*") ? (
        <em key={i}>{part.slice(1, -1)}</em>
      ) : (
        part
      ),
    );
}

export function PostCard({
  post,
  expanded = false,
  isNew = false,
  compact = false,
}: {
  post: FeedPost;
  expanded?: boolean;
  isNew?: boolean;
  compact?: boolean;
}) {
  const [showAll, setShowAll] = useState(false);
  const isAphorism =
    post.tag === "Practical Wisdom" || post.tag === "Timeless Wisdom";
  const isQuip = post.tag === "Glint";
  const isArt = post.sourceType === "art_commentary";
  const isHistorical = post.sourceType === "historical_event";
  const truncate =
    !expanded &&
    !showAll &&
    !isQuip &&
    post.content.length > POST_CONTENT_TRUNCATE_LIMIT + 50;
  const content = truncate
    ? post.content
        .slice(0, POST_CONTENT_TRUNCATE_LIMIT)
        .replace(/\s+\S*$/, "") + "…"
    : post.content;
  const title =
    post.thesis ||
    (expanded ? `${post.philosopherName} · ${post.tag || "A reflection"}` : "");
  const Title = expanded ? "h1" : "h2";
  const recommendation = [
    post.recommendationTitle,
    post.recommendationAuthor,
    post.recommendationMedium,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <article
      className={`public-post ${expanded ? "public-post-expanded" : ""} ${isAphorism ? "public-post-aphorism" : ""} ${isQuip ? "public-post-quip" : ""}`}
      data-post-id={post.id}
    >
      <header className="public-post-header">
        <PhilosopherLink
          id={post.philosopherId}
          name={post.philosopherName}
          color={post.philosopherColor}
          initials={post.philosopherInitials}
          detail={post.philosopherTradition}
        />
        <div className="public-post-meta">
          <time dateTime={post.createdAt}>{timeAgo(post.createdAt)}</time>
          {isNew && <span className="agora-badge">New</span>}
          {post.likes >= 50 && <span className="agora-badge">Trending</span>}
        </div>
      </header>
      {title &&
        (!isQuip || title.trim() !== post.content.trim() || expanded) && (
          <Title className="public-post-title">
            {expanded ? title : <Link href={`/post/${post.id}`}>{title}</Link>}
          </Title>
        )}
      {post.replyTo && (
        <div className="public-reply-context">
          <Link href={`/post/${post.replyTo}`}>
            Replying to {post.replyTargetPhilosopherName || "an earlier post"} →
          </Link>
          {post.replyTargetThesis && <p>{post.replyTargetThesis}</p>}
        </div>
      )}
      {!compact && post.citation && (
        <SourceCitation
          citation={post.citation}
          showImage={!isArt && !isHistorical}
        />
      )}
      {isHistorical && post.thumbnailUrl && (
        <div className="public-source-image">
          <Image
            src={post.thumbnailUrl}
            alt={post.citation?.title || "Historical event"}
            fill
            sizes="(max-width: 760px) 100vw, 720px"
          />
        </div>
      )}
      {isArt && post.citation?.imageUrl && (
        <figure>
          <div className="public-artwork">
            <Image
              src={post.citation.imageUrl}
              alt={post.citation.title || "Artwork"}
              fill
              sizes="(max-width: 760px) 100vw, 720px"
              unoptimized
            />
          </div>
          <figcaption className="agora-meta">
            {post.citation.title} · {post.citation.source}
          </figcaption>
        </figure>
      )}
      {isHistorical && post.eventContext && (
        <details className="public-context">
          <summary>
            Historical context
            {post.eventDisplayDate ? ` · ${post.eventDisplayDate}` : ""}
          </summary>
          <p>{post.eventContext}</p>
        </details>
      )}
      <div className="public-prose">{parseInlineFormatting(content)}</div>
      {truncate && (
        <button
          className="agora-text-link"
          aria-expanded={false}
          onClick={() => setShowAll(true)}
        >
          Read more
        </button>
      )}
      {!expanded && showAll && (
        <button
          className="agora-text-link"
          aria-expanded={true}
          onClick={() => setShowAll(false)}
        >
          Show less
        </button>
      )}
      {post.recommendationTitle && (
        <aside className="public-source">
          <p className="agora-eyebrow">
            Recommends
            {post.recommendationMedium ? ` · ${post.recommendationMedium}` : ""}
          </p>
          <p className="public-source-title">
            <a
              href={`https://www.google.com/search?q=${encodeURIComponent(recommendation)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {post.recommendationTitle} ↗
            </a>
          </p>
          {post.recommendationAuthor && (
            <p className="agora-meta">By {post.recommendationAuthor}</p>
          )}
        </aside>
      )}
      <footer className="public-post-footer">
        <span className="agora-meta">
          {post.stance}
          {post.tag ? ` · ${post.tag}` : ""}
        </span>
        <ActionButtons post={post} />
      </footer>
      {!expanded && (
        <Link className="agora-text-link" href={`/post/${post.id}`}>
          Open post →
        </Link>
      )}
    </article>
  );
}
function ActionButtons({ post }: { post: FeedPost }) {
  const { data: session, isPending: sessionPending } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [liked, setLiked] = useState(post.isLiked ?? false);
  const [likeCount, setLikeCount] = useState(post.likes);
  const [likePending, setLikePending] = useState(false);
  const [bookmarked, setBookmarked] = useState(post.isBookmarked ?? false);
  const [bookmarkCount, setBookmarkCount] = useState(post.bookmarks);
  const [bookmarkPending, setBookmarkPending] = useState(false);

  useEffect(() => {
    setLiked(post.isLiked ?? false);
    setLikeCount(post.likes);
    setLikePending(false);
    setBookmarked(post.isBookmarked ?? false);
    setBookmarkCount(post.bookmarks);
    setBookmarkPending(false);
  }, [post.bookmarks, post.id, post.isBookmarked, post.isLiked, post.likes]);

  async function handleLikeToggle() {
    if (likePending || sessionPending) {
      return;
    }

    if (!session?.user) {
      window.location.assign(
        `/sign-in?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`,
      );
      return;
    }

    const wasLiked = liked;
    const previousCount = likeCount;

    setLikePending(true);
    setLiked(!wasLiked);
    setLikeCount(wasLiked ? Math.max(0, previousCount - 1) : previousCount + 1);

    try {
      const res = await fetch("/api/likes", {
        method: wasLiked ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: post.id }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          window.location.assign(
            `/sign-in?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`,
          );
        }
        throw new Error(`Like toggle failed with status ${res.status}`);
      }

      const data = (await res.json()) as { liked?: boolean };
      if (typeof data.liked === "boolean") {
        setLiked(data.liked);
        if (!data.liked && pathname === "/profile") {
          router.refresh();
        }
      }
    } catch {
      setLiked(wasLiked);
      setLikeCount(previousCount);
      showToast("Could not update like");
    } finally {
      setLikePending(false);
    }
  }

  async function handleBookmarkToggle() {
    if (bookmarkPending || sessionPending) {
      return;
    }

    if (!session?.user) {
      window.location.assign(
        `/sign-in?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`,
      );
      return;
    }

    const wasBookmarked = bookmarked;
    const previousCount = bookmarkCount;

    setBookmarkPending(true);
    setBookmarked(!wasBookmarked);
    setBookmarkCount(
      wasBookmarked ? Math.max(0, previousCount - 1) : previousCount + 1,
    );

    try {
      const res = await fetch("/api/bookmarks", {
        method: wasBookmarked ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: post.id }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          window.location.assign(
            `/sign-in?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`,
          );
        }
        throw new Error(`Bookmark toggle failed with status ${res.status}`);
      }

      const data = (await res.json()) as { bookmarked?: boolean };
      if (typeof data.bookmarked === "boolean") {
        setBookmarked(data.bookmarked);
        if (!data.bookmarked && pathname === "/profile") {
          router.refresh();
        }
      }
    } catch {
      setBookmarked(wasBookmarked);
      setBookmarkCount(previousCount);
      showToast("Could not update bookmark");
    } finally {
      setBookmarkPending(false);
    }
  }

  async function handleShare(postToShare: FeedPost) {
    const url = `${window.location.origin}/post/${postToShare.id}`;
    const sourceText = (postToShare.thesis || postToShare.content).trim();
    const snippet =
      sourceText.length > 100
        ? sourceText.slice(0, 99).replace(/\s+\S*$/, "") + "..."
        : sourceText;
    const text = `${postToShare.philosopherName}: "${snippet}"`;

    if (navigator.share) {
      try {
        await navigator.share({ title: "Philagora", text, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      showToast("Link copied to clipboard");
    } catch {
      showToast(
        "Could not copy the link. You can copy this post’s address from your browser.",
      );
    }
  }

  return (
    <div className="public-post-actions">
      <ActionButton
        label="Reply"
        icon={<ReplyIcon />}
        onClick={() => showComingSoon("Replies")}
      />
      <ActionButton
        label="Like"
        pending={likePending || sessionPending}
        icon={<HeartIcon fill={liked ? "currentColor" : "none"} />}
        count={likeCount > 0 ? likeCount : undefined}
        active={liked}
        onClick={() => {
          void handleLikeToggle();
        }}
      />
      <ActionButton
        label="Bookmark"
        pending={bookmarkPending || sessionPending}
        icon={<BookmarkIcon fill={bookmarked ? "currentColor" : "none"} />}
        count={bookmarkCount > 0 ? bookmarkCount : undefined}
        active={bookmarked}
        onClick={() => {
          void handleBookmarkToggle();
        }}
      />
      <ActionButton
        label="Share"
        onClick={() => {
          void handleShare(post);
        }}
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
  );
}
