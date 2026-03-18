"use client";

import { Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BookIcon, BookmarkIcon, HeartIcon, ReplyArrowIcon, ReplyIcon } from "@/components/Icons";
import { STANCE_CONFIG } from "@/lib/constants";
import {
  FEED_CONTENT_TABS,
  normalizeFeedContentType,
  type FeedContentType,
} from "@/lib/feed-utils";
import type { Stance } from "@/lib/types";
import type { Philosopher } from "@/types/admin";

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
}

interface AdminPostsListResponse {
  items: AdminPost[];
  total: number;
  page: number;
  totalPages: number;
  availableTags: string[];
  approvedCount: number;
}

const POSTS_PER_PAGE = 50;

const STATUS_CONFIG: Record<PostStatus, { label: string; bg: string; text: string; border: string }> = {
  draft: { label: "Draft", bg: "#E2E8F0", text: "#4A5568", border: "#CBD5E0" },
  approved: { label: "Approved", bg: "#BEE3F8", text: "#2A4365", border: "#90CDF4" },
  published: { label: "Published", bg: "#C6F6D5", text: "#276749", border: "#9AE6B4" },
  archived: { label: "Archived", bg: "#FED7D7", text: "#9B2C2C", border: "#FEB2B2" },
};

const STATUS_TRANSITIONS: Record<PostStatus, PostStatus | null> = {
  draft: "approved",
  approved: "published",
  published: null,
  archived: null,
};

const TRANSITION_LABELS: Record<PostStatus, string> = {
  draft: "Approve",
  approved: "Publish",
  published: "",
  archived: "",
};

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

function parseStatus(value: string | null): PostStatus | "" {
  if (value === "draft" || value === "approved" || value === "published" || value === "archived") {
    return value;
  }

  return "";
}

function parsePage(value: string | null): number {
  const parsed = value ? Number.parseInt(value, 10) : 1;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function buildPageList(currentPage: number, totalPages: number): number[] {
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, currentPage + 2);
  const pages: number[] = [];

  for (let page = start; page <= end; page += 1) {
    pages.push(page);
  }

  return pages;
}

function formatCreatedAt(value: string): string {
  try {
    return new Date(value).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function AdminPostsPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [philosophers, setPhilosophers] = useState<Philosopher[]>([]);
  const [totalPosts, setTotalPosts] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [approvedCount, setApprovedCount] = useState(0);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkUpdating, setBulkUpdating] = useState(false);

  const [filterPhilosopher, setFilterPhilosopher] = useState(() => searchParams.get("philosopher") ?? "");
  const [filterStatus, setFilterStatus] = useState<PostStatus | "">(() => parseStatus(searchParams.get("status")));
  const [filterTag, setFilterTag] = useState(() => searchParams.get("tag") ?? "");
  const [filterCategory, setFilterCategory] = useState<FeedContentType>(() =>
    normalizeFeedContentType(searchParams.get("category"))
  );
  const [currentPage, setCurrentPage] = useState(() => parsePage(searchParams.get("page")));

  useEffect(() => {
    async function loadPhilosophers() {
      try {
        const response = await fetch("/api/admin/philosophers");
        if (!response.ok) {
          return;
        }

        setPhilosophers((await response.json()) as Philosopher[]);
      } catch {
        // Ignore secondary metadata failures.
      }
    }

    void loadPhilosophers();
  }, []);

  useEffect(() => {
    setFilterPhilosopher(searchParams.get("philosopher") ?? "");
    setFilterStatus(parseStatus(searchParams.get("status")));
    setFilterTag(searchParams.get("tag") ?? "");
    setFilterCategory(normalizeFeedContentType(searchParams.get("category")));
    setCurrentPage(parsePage(searchParams.get("page")));
  }, [searchParams]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());

    if (filterPhilosopher) params.set("philosopher", filterPhilosopher);
    else params.delete("philosopher");

    if (filterStatus) params.set("status", filterStatus);
    else params.delete("status");

    if (filterTag) params.set("tag", filterTag);
    else params.delete("tag");

    if (filterCategory !== "all") params.set("category", filterCategory);
    else params.delete("category");

    if (currentPage > 1) params.set("page", String(currentPage));
    else params.delete("page");

    const nextQuery = params.toString();
    const currentQuery = searchParams.toString();

    if (nextQuery !== currentQuery) {
      router.replace(`${pathname}${nextQuery ? `?${nextQuery}` : ""}`, { scroll: false });
    }
  }, [
    currentPage,
    filterCategory,
    filterPhilosopher,
    filterStatus,
    filterTag,
    pathname,
    router,
    searchParams,
  ]);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        page_size: String(POSTS_PER_PAGE),
      });

      if (filterPhilosopher) params.set("philosopher", filterPhilosopher);
      if (filterStatus) params.set("status", filterStatus);
      if (filterTag) params.set("tag", filterTag);
      if (filterCategory !== "all") params.set("category", filterCategory);

      const response = await fetch(`/api/admin/posts?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch posts (${response.status})`);
      }

      const data = (await response.json()) as AdminPostsListResponse;
      setPosts(data.items);
      setTotalPosts(data.total);
      setTotalPages(data.totalPages);
      setApprovedCount(data.approvedCount);
      setAvailableTags(data.availableTags);

      if (data.page !== currentPage) {
        setCurrentPage(data.page);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load posts");
    } finally {
      setLoading(false);
    }
  }, [currentPage, filterCategory, filterPhilosopher, filterStatus, filterTag]);

  useEffect(() => {
    void fetchPosts();
  }, [fetchPosts]);

  async function handleStatusChange(postId: string, newStatus: PostStatus) {
    setUpdatingId(postId);
    try {
      const response = await fetch("/api/admin/posts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: postId, status: newStatus }),
      });

      if (!response.ok) {
        throw new Error("Failed to update status");
      }

      await fetchPosts();
    } catch {
      setError("Failed to update post status. Please try again.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleDelete(postId: string) {
    setDeletingId(postId);
    try {
      const response = await fetch("/api/admin/posts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: postId }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete post");
      }

      setConfirmDeleteId(null);
      await fetchPosts();
    } catch {
      setError("Failed to delete post. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleBulkPublish() {
    if (!confirm("Publish all approved posts? This will make them visible on the public feed.")) {
      return;
    }

    setBulkUpdating(true);
    try {
      const response = await fetch("/api/admin/posts/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from_status: "approved", to_status: "published" }),
      });

      if (!response.ok) {
        throw new Error("Failed to bulk publish");
      }

      await fetchPosts();
    } catch {
      setError("Failed to bulk publish posts.");
    } finally {
      setBulkUpdating(false);
    }
  }

  const tagOptions = useMemo(
    () => Array.from(new Set([...KNOWN_TAGS, ...availableTags])).sort(),
    [availableTags]
  );

  const philosopherMap = useMemo(
    () => new Map(philosophers.map((philosopher) => [philosopher.id, philosopher])),
    [philosophers]
  );

  const visiblePages = useMemo(() => buildPageList(currentPage, totalPages), [currentPage, totalPages]);
  const rangeStart = totalPosts === 0 ? 0 : (currentPage - 1) * POSTS_PER_PAGE + 1;
  const rangeEnd = totalPosts === 0 ? 0 : Math.min(currentPage * POSTS_PER_PAGE, totalPosts);

  function resetFilters() {
    setFilterPhilosopher("");
    setFilterStatus("");
    setFilterTag("");
    setFilterCategory("all");
    setCurrentPage(1);
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-2xl font-bold text-ink">Posts</h1>
        <p className="mt-1 text-sm font-body text-ink-lighter">
          Manage philosopher posts. Filter, review, and transition statuses.
        </p>
      </div>

      <div className="sticky top-0 z-10 mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-border-light bg-parchment-dark/50 p-5">
        <FilterSelect
          label="Philosopher"
          value={filterPhilosopher}
          onChange={(value) => {
            setFilterPhilosopher(value);
            setCurrentPage(1);
          }}
        >
          <option value="">All Philosophers</option>
          {philosophers.map((philosopher) => (
            <option key={philosopher.id} value={philosopher.id}>
              {philosopher.name}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect
          label="Status"
          value={filterStatus}
          onChange={(value) => {
            setFilterStatus(value as PostStatus | "");
            setCurrentPage(1);
          }}
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="approved">Approved</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </FilterSelect>

        <FilterSelect
          label="Tag"
          value={filterTag}
          onChange={(value) => {
            setFilterTag(value);
            setCurrentPage(1);
          }}
        >
          <option value="">All Tags</option>
          {tagOptions.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect
          label="Category"
          value={filterCategory}
          onChange={(value) => {
            setFilterCategory(normalizeFeedContentType(value));
            setCurrentPage(1);
          }}
        >
          {FEED_CONTENT_TABS.map((tab) => (
            <option key={tab.key} value={tab.key}>
              {tab.label}
            </option>
          ))}
        </FilterSelect>

        {(filterPhilosopher || filterStatus || filterTag || filterCategory !== "all") && (
          <button
            onClick={resetFilters}
            className="self-end rounded-lg border border-border px-3 py-2 text-xs font-mono text-terracotta transition-colors hover:bg-parchment-dark/40 hover:text-terracotta-light"
          >
            Clear filters
          </button>
        )}

        <div className="ml-auto self-end flex items-center gap-3 border-l border-border pl-4">
          {(filterStatus === "" || filterStatus === "approved") && approvedCount > 0 && (
            <button
              onClick={handleBulkPublish}
              disabled={bulkUpdating}
              className="inline-flex items-center gap-1.5 rounded-full bg-green-700 px-4 py-2 text-xs font-mono tracking-wide text-white transition-colors hover:bg-green-800 disabled:opacity-50"
            >
              {bulkUpdating ? "Publishing..." : `Publish all approved (${approvedCount})`}
            </button>
          )}

          <span className="text-xs font-mono text-ink-lighter">
            {loading ? "Loading..." : totalPosts === 0 ? "0 posts" : `${rangeStart}-${rangeEnd} of ${totalPosts} posts`}
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
          <button onClick={() => setError(null)} className="ml-3 text-xs font-mono text-red-600 hover:text-red-800">
            Dismiss
          </button>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-terracotta/30 border-t-terracotta" />
            <span className="text-sm text-ink-lighter">Loading posts...</span>
          </div>
        </div>
      )}

      {!loading && posts.length === 0 && (
        <div className="py-16 text-center text-sm text-ink-lighter">
          No posts found matching your filters.
        </div>
      )}

      {!loading && posts.length > 0 && (
        <div className="space-y-4">
          {posts.map((post) => {
            const philosopher = philosopherMap.get(post.philosopher_id);
            const stanceCfg = STANCE_CONFIG[post.stance];
            const statusCfg = STATUS_CONFIG[post.status];
            const nextStatus = STATUS_TRANSITIONS[post.status];
            const isUpdating = updatingId === post.id;
            const isDeleting = deletingId === post.id;
            const preview =
              post.content.length > 200
                ? `${post.content.slice(0, 200).replace(/\s+\S*$/, "")}\u2026`
                : post.content;

            return (
              <article
                key={post.id}
                className="rounded-lg border border-border-light bg-parchment"
                style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
              >
                <div className="px-6 py-5">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-mono font-bold text-white"
                        style={{ backgroundColor: philosopher?.color ?? "#7D7468" }}
                      >
                        {philosopher?.initials ?? "??"}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-serif font-bold text-ink">
                            {philosopher?.name ?? post.philosopher_id}
                          </span>
                          {philosopher?.tradition && (
                            <span
                              className="rounded px-2 py-0.5 text-[11px] font-mono"
                              style={{
                                backgroundColor: `${philosopher.color}15`,
                                color: philosopher.color,
                              }}
                            >
                              {philosopher.tradition}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-mono text-ink-lighter">
                          {formatCreatedAt(post.created_at)}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <span
                        className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider"
                        style={{
                          backgroundColor: statusCfg.bg,
                          color: statusCfg.text,
                          border: `1px solid ${statusCfg.border}`,
                        }}
                      >
                        {statusCfg.label}
                      </span>

                      {nextStatus && (
                        <button
                          onClick={() => handleStatusChange(post.id, nextStatus)}
                          disabled={isUpdating}
                          className="rounded-full px-4 py-1.5 text-xs font-mono text-white disabled:opacity-50"
                          style={{ backgroundColor: nextStatus === "approved" ? "#2A4365" : "#276749" }}
                        >
                          {isUpdating ? "Updating..." : TRANSITION_LABELS[post.status]}
                        </button>
                      )}

                      {post.status === "archived" && (
                        <button
                          onClick={() => handleStatusChange(post.id, "draft")}
                          disabled={isUpdating}
                          className="rounded-full bg-[#2A4365] px-4 py-1.5 text-xs font-mono text-white disabled:opacity-50"
                        >
                          {isUpdating ? "Restoring..." : "Restore"}
                        </button>
                      )}

                      {post.status !== "archived" && (
                        <button
                          onClick={() => handleStatusChange(post.id, "archived")}
                          disabled={isUpdating}
                          className="rounded-full border border-[#FEB2B2] bg-[#FED7D7] px-4 py-1.5 text-xs font-mono text-[#9B2C2C] disabled:opacity-50"
                        >
                          Archive
                        </button>
                      )}

                      {confirmDeleteId === post.id ? (
                        <>
                          <button
                            onClick={() => handleDelete(post.id)}
                            disabled={isDeleting}
                            className="rounded-full bg-red-600 px-3.5 py-1.5 text-xs font-mono text-white disabled:opacity-50"
                          >
                            {isDeleting ? "Deleting..." : "Confirm"}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="rounded-full border border-border-light px-3.5 py-1.5 text-xs font-mono text-ink-lighter"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(post.id)}
                          className="rounded-lg border border-border-light px-3 py-1.5 text-xs font-mono text-ink-lighter"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>

                  {post.citation_title && (
                    <div className="mb-2 ml-12 text-[11px] font-mono text-ink-lighter">
                      {post.citation_url ? (
                        <a href={post.citation_url} target="_blank" rel="noopener noreferrer" className="hover:text-terracotta">
                          via {post.citation_source || "article"}: {post.citation_title}
                        </a>
                      ) : (
                        <span>via {post.citation_source || "article"}: {post.citation_title}</span>
                      )}
                    </div>
                  )}

                  {post.thesis && (
                    <blockquote
                      className="mb-2 pl-3 font-serif text-[15px] leading-snug text-ink"
                      style={{
                        borderLeft: `3px solid ${philosopher?.color ?? "#7D7468"}`,
                        fontWeight: 600,
                      }}
                    >
                      {post.thesis}
                    </blockquote>
                  )}

                  <p className="mb-3 text-sm leading-relaxed text-ink-light" style={{ paddingLeft: post.thesis ? "15px" : undefined }}>
                    {preview}
                  </p>

                  {post.citation_title && (
                    <div
                      className="mb-3 mt-3 flex items-center gap-2 rounded-md px-4 py-3 text-xs font-mono"
                      style={{
                        backgroundColor: `${philosopher?.color ?? "#7D7468"}08`,
                        border: `1px solid ${philosopher?.color ?? "#7D7468"}20`,
                        color: philosopher?.color ?? "#7D7468",
                      }}
                    >
                      <BookIcon size={14} className="shrink-0 opacity-60" />
                      <span className="truncate">
                        {post.citation_title}
                        {post.citation_source && <span className="opacity-60"> - {post.citation_source}</span>}
                      </span>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border-light pt-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {post.tag && (
                        <span
                          className="inline-flex items-center rounded px-2.5 py-0.5 text-[11px] font-mono tracking-wide"
                          style={{
                            backgroundColor: `${philosopher?.color ?? "#7D7468"}10`,
                            color: philosopher?.color ?? "#7D7468",
                            border: `1px solid ${philosopher?.color ?? "#7D7468"}25`,
                          }}
                        >
                          {post.tag}
                        </span>
                      )}

                      <span
                        className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-mono uppercase tracking-wider"
                        style={{
                          backgroundColor: stanceCfg.bg,
                          color: stanceCfg.color,
                          border: `1px solid ${stanceCfg.border}`,
                        }}
                      >
                        {stanceCfg.label}
                      </span>

                      {post.reply_to && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-ink-lighter">
                          <ReplyArrowIcon />
                          Reply
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-ink-lighter">
                      <span className="inline-flex items-center gap-1 text-xs font-mono">
                        <HeartIcon size={14} />
                        {post.likes}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-mono">
                        <ReplyIcon size={14} />
                        {post.replies}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-mono">
                        <BookmarkIcon size={14} />
                        {post.bookmarks}
                      </span>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}

          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                className="rounded-full border border-border px-4 py-2 text-xs font-mono text-ink-lighter disabled:opacity-50"
              >
                Previous
              </button>

              <div className="flex flex-wrap items-center justify-center gap-2">
                {visiblePages[0] > 1 && (
                  <button
                    onClick={() => setCurrentPage(1)}
                    className="rounded-full border border-border px-3 py-2 text-xs font-mono text-ink-lighter"
                  >
                    1
                  </button>
                )}
                {visiblePages[0] > 2 && <span className="px-1 text-xs font-mono text-ink-lighter">...</span>}
                {visiblePages.map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`min-w-9 rounded-full border px-3 py-2 text-xs font-mono ${
                      page === currentPage
                        ? "border-terracotta bg-terracotta text-white"
                        : "border-border text-ink-lighter"
                    }`}
                  >
                    {page}
                  </button>
                ))}
                {visiblePages[visiblePages.length - 1] < totalPages - 1 && (
                  <span className="px-1 text-xs font-mono text-ink-lighter">...</span>
                )}
                {visiblePages[visiblePages.length - 1] < totalPages && (
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    className="rounded-full border border-border px-3 py-2 text-xs font-mono text-ink-lighter"
                  >
                    {totalPages}
                  </button>
                )}
              </div>

              <button
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
                className="rounded-full border border-border px-4 py-2 text-xs font-mono text-ink-lighter disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-mono uppercase tracking-widest text-ink-lighter">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-md border border-border bg-parchment px-4 py-2.5 text-sm font-body text-ink focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/30"
      >
        {children}
      </select>
    </div>
  );
}

export default function AdminPostsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-16 text-center">
          <span className="text-sm font-body text-ink-lighter">Loading posts...</span>
        </div>
      }
    >
      <AdminPostsPageInner />
    </Suspense>
  );
}
