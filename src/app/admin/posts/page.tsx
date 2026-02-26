"use client";

import { useState, useEffect, useCallback } from "react";
import type { Stance } from "@/lib/types";
import type { Philosopher } from "@/types/admin";
import { STANCE_CONFIG } from "@/lib/constants";

// ── Types ────────────────────────────────────────────────────────────

type PostStatus = "draft" | "approved" | "published" | "archived";

interface AdminPost {
  id: string;
  philosopher_id: string;
  content: string;
  thesis: string;
  stance: Stance;
  tag: string;
  citation_title: string | null;
  citation_source: string | null;
  citation_url: string | null;
  reply_to: string | null;
  likes: number;
  replies: number;
  bookmarks: number;
  status: PostStatus;
  created_at: string;
  updated_at: string;
}

// ── Status config ────────────────────────────────────────────────────

const statusConfig: Record<PostStatus, { label: string; bg: string; text: string; border: string }> = {
  draft:     { label: "Draft",     bg: "#E2E8F0", text: "#4A5568", border: "#CBD5E0" },
  approved:  { label: "Approved",  bg: "#BEE3F8", text: "#2A4365", border: "#90CDF4" },
  published: { label: "Published", bg: "#C6F6D5", text: "#276749", border: "#9AE6B4" },
  archived:  { label: "Archived",  bg: "#FED7D7", text: "#9B2C2C", border: "#FEB2B2" },
};

// ── Status transitions ──────────────────────────────────────────────

const statusTransitions: Record<PostStatus, PostStatus | null> = {
  draft: "approved",
  approved: "published",
  published: null,
  archived: null,
};

const transitionLabels: Record<PostStatus, string> = {
  draft: "Approve",
  approved: "Publish",
  published: "",
  archived: "",
};

// ── Known tags ──────────────────────────────────────────────────────

const KNOWN_TAGS = [
  "Ethical Analysis",
  "Political Commentary",
  "Metaphysical Reflection",
  "Practical Wisdom",
  "Timeless Wisdom",
  "Cross-Philosopher Reply",
  "Existential Reflection",
  "Psychological Insight",
];

// ── Component ────────────────────────────────────────────────────────

export default function AdminPostsPage() {
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [philosophers, setPhilosophers] = useState<Philosopher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filters
  const [filterPhilosopher, setFilterPhilosopher] = useState("");
  const [filterStatus, setFilterStatus] = useState<PostStatus | "">("");
  const [filterTag, setFilterTag] = useState("");

  // Fetch philosophers on mount
  useEffect(() => {
    async function loadPhilosophers() {
      try {
        const res = await fetch("/api/admin/philosophers");
        if (res.ok) {
          const data = await res.json();
          setPhilosophers(data);
        }
      } catch {
        // Silently fall back to empty list
      }
    }
    loadPhilosophers();
  }, []);

  // Fetch posts whenever filters change
  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterPhilosopher) params.set("philosopher", filterPhilosopher);
      if (filterStatus) params.set("status", filterStatus);
      if (filterTag) params.set("tag", filterTag);

      const url = `/api/admin/posts${params.toString() ? `?${params}` : ""}`;
      const res = await fetch(url);

      if (!res.ok) throw new Error(`Failed to fetch posts (${res.status})`);

      const data = await res.json();
      setPosts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load posts");
    } finally {
      setLoading(false);
    }
  }, [filterPhilosopher, filterStatus, filterTag]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Status change handler
  async function handleStatusChange(postId: string, newStatus: PostStatus) {
    setUpdatingId(postId);
    try {
      const res = await fetch("/api/admin/posts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: postId, status: newStatus }),
      });

      if (!res.ok) throw new Error("Failed to update status");

      // Optimistically update the post in local state
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, status: newStatus } : p))
      );
    } catch {
      setError("Failed to update post status. Please try again.");
    } finally {
      setUpdatingId(null);
    }
  }

  // Delete handler
  async function handleDelete(postId: string) {
    setDeletingId(postId);
    try {
      const res = await fetch("/api/admin/posts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: postId }),
      });

      if (!res.ok) throw new Error("Failed to delete post");

      // Remove the post from local state
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      setConfirmDeleteId(null);
    } catch {
      setError("Failed to delete post. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  // Philosopher lookup helper
  function getPhilosopher(id: string): Philosopher | undefined {
    return philosophers.find((p) => p.id === id);
  }

  // Collect tags from posts for the tag filter dropdown
  const availableTags = Array.from(new Set(posts.map((p) => p.tag).filter(Boolean)));
  const tagOptions = Array.from(new Set([...KNOWN_TAGS, ...availableTags])).sort();

  return (
    <div>
      {/* Page header */}
      <div className="mb-8">
        <h1 className="font-serif text-2xl font-bold text-ink">Posts</h1>
        <p className="text-sm text-ink-lighter mt-1 font-body">
          Manage philosopher posts. Filter, review, and transition statuses.
        </p>
      </div>

      {/* ── Filter bar ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 mb-6 p-4 rounded-lg bg-parchment-dark/50 border border-border-light">
        {/* Philosopher filter */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-mono text-ink-lighter tracking-widest uppercase">
            Philosopher
          </label>
          <select
            value={filterPhilosopher}
            onChange={(e) => setFilterPhilosopher(e.target.value)}
            className="text-sm font-body text-ink bg-parchment border border-border rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta"
          >
            <option value="">All Philosophers</option>
            {philosophers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Status filter */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-mono text-ink-lighter tracking-widest uppercase">
            Status
          </label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as PostStatus | "")}
            className="text-sm font-body text-ink bg-parchment border border-border rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta"
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="approved">Approved</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        {/* Tag filter */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-mono text-ink-lighter tracking-widest uppercase">
            Tag
          </label>
          <select
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
            className="text-sm font-body text-ink bg-parchment border border-border rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta"
          >
            <option value="">All Tags</option>
            {tagOptions.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </div>

        {/* Reset filters */}
        {(filterPhilosopher || filterStatus || filterTag) && (
          <button
            onClick={() => {
              setFilterPhilosopher("");
              setFilterStatus("");
              setFilterTag("");
            }}
            className="self-end text-xs font-mono text-terracotta hover:text-terracotta-light transition-colors py-1.5 px-3"
          >
            Clear filters
          </button>
        )}

        {/* Post count */}
        <div className="ml-auto self-end">
          <span className="text-xs font-mono text-ink-lighter">
            {loading ? "Loading..." : `${posts.length} post${posts.length !== 1 ? "s" : ""}`}
          </span>
        </div>
      </div>

      {/* ── Error state ─────────────────────────────────────────────── */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800 font-body">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-3 text-red-600 hover:text-red-800 font-mono text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Loading state ───────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-terracotta/30 border-t-terracotta rounded-full animate-spin" />
            <span className="text-sm text-ink-lighter font-body">Loading posts...</span>
          </div>
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────────────── */}
      {!loading && posts.length === 0 && (
        <div className="text-center py-16">
          <div className="text-4xl mb-3 opacity-40">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto text-ink-lighter">
              <path d="M9 12h6m-3-3v6m-7 4h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-ink-lighter font-body text-sm">
            No posts found matching your filters.
          </p>
        </div>
      )}

      {/* ── Post list ───────────────────────────────────────────────── */}
      {!loading && posts.length > 0 && (
        <div className="space-y-4">
          {posts.map((post) => {
            const philosopher = getPhilosopher(post.philosopher_id);
            const stanceCfg = STANCE_CONFIG[post.stance];
            const statusCfg = statusConfig[post.status];
            const nextStatus = statusTransitions[post.status];
            const isUpdating = updatingId === post.id;
            const contentPreview =
              post.content.length > 200
                ? post.content.slice(0, 200).replace(/\s+\S*$/, "") + "\u2026"
                : post.content;

            return (
              <article
                key={post.id}
                className="rounded-lg border border-border-light bg-parchment hover:border-border transition-colors duration-200"
                style={{
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                }}
              >
                <div className="px-5 py-4">
                  {/* ── Top row: philosopher + status ─────────────────── */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Color swatch + name */}
                      <div
                        className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-white text-xs font-mono font-bold"
                        style={{
                          backgroundColor: philosopher?.color ?? "#7D7468",
                        }}
                      >
                        {philosopher?.initials ?? "??"}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-serif font-bold text-ink text-sm">
                            {philosopher?.name ?? post.philosopher_id}
                          </span>
                          {philosopher?.tradition && (
                            <span
                              className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                              style={{
                                backgroundColor: `${philosopher.color}15`,
                                color: philosopher.color,
                              }}
                            >
                              {philosopher.tradition}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-ink-lighter font-mono">
                          {post.created_at
                            ? new Date(post.created_at).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "Unknown date"}
                        </span>
                      </div>
                    </div>

                    {/* Status badge + action buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className="inline-flex items-center px-2.5 py-1 text-[11px] font-mono tracking-wider uppercase rounded-full"
                        style={{
                          backgroundColor: statusCfg.bg,
                          color: statusCfg.text,
                          border: `1px solid ${statusCfg.border}`,
                        }}
                      >
                        {statusCfg.label}
                      </span>

                      {/* Forward transition (Approve / Publish) */}
                      {nextStatus && (
                        <button
                          onClick={() => handleStatusChange(post.id, nextStatus)}
                          disabled={isUpdating}
                          className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-mono tracking-wide rounded-full text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md"
                          style={{
                            backgroundColor: nextStatus === "approved" ? "#2A4365" : "#276749",
                          }}
                        >
                          {isUpdating ? (
                            <span className="flex items-center gap-1">
                              <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
                              Updating
                            </span>
                          ) : (
                            <>
                              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 8L7 12L13 4" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                              {transitionLabels[post.status]}
                            </>
                          )}
                        </button>
                      )}

                      {/* Restore button (archived → draft) */}
                      {post.status === "archived" && (
                        <button
                          onClick={() => handleStatusChange(post.id, "draft")}
                          disabled={isUpdating}
                          className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-mono tracking-wide rounded-full text-white bg-[#2A4365] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md"
                        >
                          {isUpdating ? (
                            <span className="flex items-center gap-1">
                              <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
                              Restoring
                            </span>
                          ) : (
                            <>
                              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M4 7L2 5L4 3" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M2 5H10C12.2091 5 14 6.79086 14 9C14 11.2091 12.2091 13 10 13H8" strokeLinecap="round" />
                              </svg>
                              Restore
                            </>
                          )}
                        </button>
                      )}

                      {/* Archive button (published/approved/draft → archived) */}
                      {post.status !== "archived" && (
                        <button
                          onClick={() => handleStatusChange(post.id, "archived")}
                          disabled={isUpdating}
                          className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-mono tracking-wide rounded-full text-[#9B2C2C] bg-[#FED7D7] border border-[#FEB2B2] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#FEB2B2]"
                        >
                          {isUpdating ? (
                            <span className="flex items-center gap-1">
                              <span className="w-3 h-3 border border-[#9B2C2C]/40 border-t-[#9B2C2C] rounded-full animate-spin" />
                            </span>
                          ) : (
                            <>
                              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M2 4H14V13C14 13.5523 13.5523 14 13 14H3C2.44772 14 2 13.5523 2 13V4Z" />
                                <path d="M1 2H15V4H1V2Z" />
                                <path d="M6 7H10" strokeLinecap="round" />
                              </svg>
                              Archive
                            </>
                          )}
                        </button>
                      )}

                      {/* Delete button */}
                      {confirmDeleteId === post.id ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleDelete(post.id)}
                            disabled={deletingId === post.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono tracking-wide rounded-full text-white bg-red-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-700"
                          >
                            {deletingId === post.id ? (
                              <span className="flex items-center gap-1">
                                <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
                                Deleting
                              </span>
                            ) : (
                              "Confirm"
                            )}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="inline-flex items-center px-2.5 py-1 text-[11px] font-mono tracking-wide rounded-full text-ink-lighter border border-border-light transition-all duration-200 hover:bg-parchment-dark/50"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(post.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono tracking-wide rounded-full text-ink-lighter border border-border-light transition-all duration-200 hover:text-red-600 hover:border-red-300 hover:bg-red-50"
                          title="Permanently delete this post"
                        >
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M3 4H13L12 14H4L3 4Z" />
                            <path d="M1 4H15" strokeLinecap="round" />
                            <path d="M6 2H10" strokeLinecap="round" />
                            <path d="M7 7V11" strokeLinecap="round" />
                            <path d="M9 7V11" strokeLinecap="round" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* ── Thesis ────────────────────────────────────────── */}
                  {post.thesis && (
                    <blockquote
                      className="font-serif text-[15px] leading-snug text-ink mb-2 pl-3"
                      style={{
                        borderLeft: `3px solid ${philosopher?.color ?? "#7D7468"}`,
                        fontWeight: 600,
                      }}
                    >
                      {post.thesis}
                    </blockquote>
                  )}

                  {/* ── Content preview ──────────────────────────────── */}
                  <p
                    className="text-sm text-ink-light leading-relaxed mb-3"
                    style={{
                      paddingLeft: post.thesis ? "15px" : undefined,
                    }}
                  >
                    {contentPreview}
                  </p>

                  {/* ── Citation ──────────────────────────────────────── */}
                  {post.citation_title && (
                    <div
                      className="flex items-center gap-2 mb-3 px-3 py-2 rounded-md text-xs font-mono"
                      style={{
                        backgroundColor: `${philosopher?.color ?? "#7D7468"}08`,
                        border: `1px solid ${philosopher?.color ?? "#7D7468"}20`,
                        color: philosopher?.color ?? "#7D7468",
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 opacity-60">
                        <path d="M3 12L3 4C3 2.89543 3.89543 2 5 2H11C12.1046 2 13 2.89543 13 4V12C13 13.1046 12.1046 14 11 14H5C3.89543 14 3 13.1046 3 12Z" />
                        <path d="M6 6H10" strokeLinecap="round" />
                        <path d="M6 9H8" strokeLinecap="round" />
                      </svg>
                      <span className="truncate">
                        {post.citation_title}
                        {post.citation_source && (
                          <span className="opacity-60"> &mdash; {post.citation_source}</span>
                        )}
                      </span>
                    </div>
                  )}

                  {/* ── Bottom row: tag, stance, stats ───────────────── */}
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Tag badge */}
                      {post.tag && (
                        <span
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-mono tracking-wide rounded"
                          style={{
                            backgroundColor: `${philosopher?.color ?? "#7D7468"}10`,
                            color: philosopher?.color ?? "#7D7468",
                            border: `1px solid ${philosopher?.color ?? "#7D7468"}25`,
                          }}
                        >
                          {post.tag}
                        </span>
                      )}

                      {/* Stance badge */}
                      <span
                        className="inline-flex items-center px-2 py-0.5 text-[10px] font-mono tracking-wider uppercase rounded-full"
                        style={{
                          backgroundColor: stanceCfg.bg,
                          color: stanceCfg.color,
                          border: `1px solid ${stanceCfg.border}`,
                        }}
                      >
                        {stanceCfg.label}
                      </span>

                      {/* Reply indicator */}
                      {post.reply_to && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-ink-lighter font-mono">
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M6 3L3 6L6 9" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M3 6H10C12.2091 6 14 7.79086 14 10V13" strokeLinecap="round" />
                          </svg>
                          Reply
                        </span>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 text-ink-lighter">
                      <span className="inline-flex items-center gap-1 text-xs font-mono">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M8 14L1.5 7.5C0.5 6.5 0.5 4.5 1.5 3.5C2.5 2.5 4.5 2.5 5.5 3.5L8 6L10.5 3.5C11.5 2.5 13.5 2.5 14.5 3.5C15.5 4.5 15.5 6.5 14.5 7.5L8 14Z" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        {post.likes}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-mono">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M14 10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6L2 15V4C2 3.46957 2.21071 2.96086 2.58579 2.58579C2.96086 2.21071 3.46957 2 4 2H12C12.5304 2 13.0391 2.21071 13.4142 2.58579C13.7893 2.96086 14 3.46957 14 4V10Z" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        {post.replies}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-mono">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M3 2H13V14L8 11L3 14V2Z" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        {post.bookmarks}
                      </span>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
