"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AdminNotice,
  AdminStatus,
  useAdminConfirm,
  useUnsavedChanges,
} from "@/components/admin/AdminUI";
import { STANCE_CONFIG } from "@/lib/constants";
import { formatDateTime } from "@/lib/date-utils";
import { FEED_CONTENT_TABS } from "@/lib/feed-utils";
import type { Philosopher } from "@/types/admin";

type Status = "draft" | "approved" | "published" | "archived";
interface AdminPost {
  id: string;
  philosopher_id: string;
  philosopher_name: string;
  content: string;
  thesis: string;
  stance: string;
  tag: string;
  status: Status;
  created_at: string;
  updated_at: string;
  citation_title: string | null;
  citation_source: string | null;
  citation_url: string | null;
  recommendation_title: string | null;
  recommendation_author: string | null;
  recommendation_medium: string | null;
  reply_to: string | null;
  source_type: string;
}
interface PostList {
  items: AdminPost[];
  total: number;
  page: number;
  totalPages: number;
  availableTags: string[];
}
const editFields = [
  "thesis",
  "content",
  "stance",
  "tag",
  "citation_title",
  "citation_source",
  "citation_url",
  "recommendation_title",
  "recommendation_author",
  "recommendation_medium",
] as const;
const toEdit = (post: AdminPost) =>
  Object.fromEntries(editFields.map((key) => [key, post[key] ?? ""])) as Record<
    (typeof editFields)[number],
    string
  >;

function PostEditor({
  initial,
  onSaved,
  onDirty,
  onBusy,
  onClose,
  onStep,
  previous,
  next,
}: {
  initial: AdminPost;
  onSaved: (post: AdminPost) => void;
  onDirty: (value: boolean) => void;
  onBusy: (value: boolean) => void;
  onClose: () => void;
  onStep: (direction: number) => void;
  previous: boolean;
  next: boolean;
}) {
  const [post, setPost] = useState(initial);
  const [values, setValues] = useState(() => toEdit(initial));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [preview, setPreview] = useState(false);
  const confirm = useAdminConfirm();
  const dirty = JSON.stringify(values) !== JSON.stringify(toEdit(post));
  useEffect(() => {
    onDirty(dirty);
    return () => onDirty(false);
  }, [dirty, onDirty]);
  useEffect(() => {
    onBusy(busy);
    return () => onBusy(false);
  }, [busy, onBusy]);
  const update = (key: (typeof editFields)[number], value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setSaved("");
  };
  async function save(status?: Status) {
    if (!values.content.trim()) {
      setError("Enter the post content before saving.");
      return;
    }
    if (
      (status === "published" || (!status && post.status === "published")) &&
      !(await confirm({
        title: status ? "Publish this post?" : "Update the published post?",
        description:
          "The full content shown in this editor will be visible on the public feed.",
        confirmLabel: status ? "Publish post" : "Save published changes",
      }))
    )
      return;
    setBusy(true);
    setError("");
    setSaved("");
    try {
      const response = await fetch("/api/admin/posts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: post.id,
          ...values,
          ...(status ? { status } : {}),
          expected_updated_at: post.updated_at,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error ?? "Could not save the post. Your edits are still here.",
        );
      const updated = { ...post, ...data } as AdminPost;
      setPost(updated);
      setValues(toEdit(updated));
      onSaved(updated);
      setSaved(status ? `Post ${status}.` : "Changes saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the post.");
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (
      !(await confirm({
        title: "Delete this post permanently?",
        description:
          "This cannot be undone. Replies will remain but will no longer link to this post. Archive instead to keep a recoverable copy.",
        confirmLabel: "Delete permanently",
        destructive: true,
      }))
    )
      return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/posts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: post.id }),
      });
      if (!response.ok) throw new Error("Could not delete this post.");
      onDirty(false);
      onSaved({ ...post, id: "" });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not delete this post.",
      );
    } finally {
      setBusy(false);
    }
  }
  function field(
    key: (typeof editFields)[number],
    label: string,
    multiline = false,
  ) {
    return (
      <div className="admin-field">
        <label htmlFor={`post-${key}`}>{label}</label>
        {multiline ? (
          <textarea
            id={`post-${key}`}
            value={values[key]}
            onChange={(event) => update(key, event.target.value)}
            required
            rows={12}
          />
        ) : (
          <input
            id={`post-${key}`}
            value={values[key]}
            onChange={(event) => update(key, event.target.value)}
            type={key === "citation_url" ? "url" : "text"}
          />
        )}
      </div>
    );
  }
  return (
    <section
      className="admin-panel admin-review-editor"
      aria-label="Post editor"
    >
      <header className="admin-panel-header">
        <div>
          <strong>{post.philosopher_name}</strong>
          <div className="mt-1">
            <AdminStatus status={post.status} />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            className="admin-button"
            onClick={() => onStep(-1)}
            disabled={!previous || busy}
            aria-label="Previous post"
          >
            ←
          </button>
          <button
            className="admin-button"
            onClick={() => onStep(1)}
            disabled={!next || busy}
            aria-label="Next post"
          >
            →
          </button>
          <button
            className="admin-button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close post editor"
          >
            ×
          </button>
        </div>
      </header>
      <fieldset disabled={busy} className="admin-editor-body">
        {error && <AdminNotice error>{error}</AdminNotice>}
        {saved && <AdminNotice>{saved}</AdminNotice>}
        <div className="flex items-center justify-between">
          <span className="text-xs text-ink-lighter">
            {formatDateTime(post.created_at)}
          </span>
          <button className="admin-button" onClick={() => setPreview(!preview)}>
            {preview ? "Edit content" : "Read preview"}
          </button>
        </div>
        {preview ? (
          <div className="space-y-4">
            <h2 className="text-xl">{values.thesis}</h2>
            <p className="admin-post-reading whitespace-pre-wrap font-body">
              {values.content}
            </p>
          </div>
        ) : (
          <>
            {field("thesis", "Thesis / headline")}
            {field("content", "Full post content", true)}
            <div className="admin-split-fields">
              <div className="admin-field">
                <label htmlFor="post-stance">Stance</label>
                <select
                  id="post-stance"
                  value={values.stance}
                  onChange={(event) => update("stance", event.target.value)}
                >
                  {Object.entries(STANCE_CONFIG).map(([key, value]) => (
                    <option key={key} value={key}>
                      {value.label}
                    </option>
                  ))}
                </select>
              </div>
              {field("tag", "Editorial tag")}
            </div>
          </>
        )}
        {post.reply_to && (
          <p className="text-sm">
            Reply to{" "}
            <Link
              className="underline text-terracotta"
              href={`/admin/posts?post=${encodeURIComponent(post.reply_to)}`}
            >
              view parent post
            </Link>
          </p>
        )}
        <details>
          <summary className="cursor-pointer font-medium">
            Source & citation
          </summary>
          <div className="mt-4 grid gap-3">
            {field("citation_title", "Source title")}
            {field("citation_source", "Publication / author")}
            {field("citation_url", "Source URL")}
            {values.citation_url &&
              /^https?:\/\//.test(values.citation_url) && (
                <a
                  href={values.citation_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-terracotta underline"
                >
                  Open source ↗
                </a>
              )}
          </div>
        </details>
        {(post.recommendation_title || post.stance === "recommends") && (
          <details>
            <summary className="cursor-pointer font-medium">
              Recommendation details
            </summary>
            <div className="mt-4 grid gap-3">
              {field("recommendation_title", "Title")}
              {field("recommendation_author", "Creator")}
              {field("recommendation_medium", "Medium")}
            </div>
          </details>
        )}
        <details>
          <summary className="cursor-pointer text-ink-lighter">
            More actions
          </summary>
          <div className="mt-3 flex gap-2">
            <button
              className="admin-button"
              disabled={busy || dirty}
              onClick={() =>
                void save(post.status === "archived" ? "draft" : "archived")
              }
            >
              {post.status === "archived"
                ? "Restore to drafts"
                : "Archive post"}
            </button>
            <button
              className="admin-button admin-button-danger"
              disabled={busy}
              onClick={() => void remove()}
            >
              Delete permanently
            </button>
          </div>
          {dirty && (
            <p className="mt-2 text-xs">
              Save or discard your edits before archiving.
            </p>
          )}
        </details>
      </fieldset>
      <footer className="admin-panel-footer">
        <span className="text-xs text-ink-lighter" role="status">
          {busy ? "Saving…" : dirty ? "Unsaved changes" : "All changes saved"}
        </span>
        <div className="flex gap-2">
          <button
            className="admin-button"
            disabled={busy || !dirty}
            onClick={() => {
              setValues(toEdit(post));
              setError("");
            }}
          >
            Discard
          </button>
          <button
            className="admin-button"
            disabled={busy || !dirty}
            onClick={() => void save()}
          >
            Save changes
          </button>
          {post.status === "draft" && (
            <button
              className="admin-button admin-button-primary"
              disabled={busy}
              onClick={() => void save("approved")}
            >
              {dirty ? "Save & approve" : "Approve"}
            </button>
          )}
          {post.status === "approved" && (
            <button
              className="admin-button admin-button-primary"
              disabled={busy}
              onClick={() => void save("published")}
            >
              {dirty ? "Save & publish" : "Publish"}
            </button>
          )}
        </div>
      </footer>
    </section>
  );
}

function PostsWorkspace() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const query = params.toString();
  const [data, setData] = useState<PostList>({
    items: [],
    total: 0,
    page: 1,
    totalPages: 1,
    availableTags: [],
  });
  const [philosophers, setPhilosophers] = useState<Philosopher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [active, setActive] = useState<AdminPost | null>(null);
  const [dirty, setDirty] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [editorBusy, setEditorBusy] = useState(false);
  const confirmDiscard = useUnsavedChanges(dirty || editorBusy);
  const confirm = useAdminConfirm();
  const currentRequest = useRef(0);
  const selectedId = params.get("post");
  useEffect(() => {
    let live = true;
    fetch("/api/admin/philosophers")
      .then((response) => (response.ok ? response.json() : []))
      .then((items) => {
        if (live) setPhilosophers(items);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    setSearch(new URLSearchParams(query).get("q") ?? "");
  }, [query]);
  useEffect(() => {
    const requestId = ++currentRequest.current;
    const controller = new AbortController();
    const filters = new URLSearchParams(query);
    filters.delete("post");
    filters.set("page_size", "25");
    setLoading(true);
    setError("");
    fetch(`/api/admin/posts?${filters}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load posts. Try again.");
        const result = (await response.json()) as PostList;
        if (requestId !== currentRequest.current) return;
        setData(result);
        setSelected((ids) =>
          ids.filter((id) => result.items.some((item) => item.id === id)),
        );
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted && requestId === currentRequest.current)
          setLoading(false);
      });
    return () => controller.abort();
  }, [query, revision]);
  useEffect(() => {
    if (!selectedId) {
      setActive(null);
      return;
    }
    const controller = new AbortController();
    setActive(null);
    fetch(`/api/admin/posts?id=${encodeURIComponent(selectedId)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not open this post.");
        const items = (await response.json()) as AdminPost[];
        if (!controller.signal.aborted) {
          setActive(items[0] ?? null);
          if (!items.length) setError("This post no longer exists.");
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(err.message);
      });
    return () => controller.abort();
  }, [selectedId]);
  async function navigate(updates: Record<string, string>, resetPage = true) {
    if (busy || editorBusy || !(await confirmDiscard())) return;
    if (updates.post === selectedId) return;
    setDirty(false);
    const next = new URLSearchParams(query);
    for (const [key, value] of Object.entries(updates)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (resetPage) {
      next.delete("page");
      next.delete("post");
      setSelected([]);
    }
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, {
      scroll: false,
    });
  }
  const onSaved = useCallback(
    (post: AdminPost) => {
      setDirty(false);
      setRevision((value) => value + 1);
      if (!post.id) {
        setActive(null);
        const next = new URLSearchParams(query);
        next.delete("post");
        router.replace(`${pathname}?${next}`, { scroll: false });
        setNotice("Post deleted.");
      } else setActive(post);
    },
    [pathname, query, router],
  );
  const selectedPosts = data.items.filter((post) => selected.includes(post.id));
  async function bulk(from: Status, to: Status) {
    const ids = selectedPosts
      .filter((post) => post.status === from)
      .map((post) => post.id);
    if (editorBusy || !ids.length || !(await confirmDiscard())) return;
    if (
      !(await confirm({
        title: `${to === "published" ? "Publish" : "Approve"} ${ids.length} selected posts?`,
        description:
          to === "published"
            ? `Only these ${ids.length} selected approved posts will become visible on the public feed. Other posts will not change.`
            : `Only these ${ids.length} selected drafts will move to Approved. They will not be published.`,
        confirmLabel: `${to === "published" ? "Publish" : "Approve"} ${ids.length} posts`,
      }))
    )
      return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/posts/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, from_status: from, to_status: to }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Bulk update failed.");
      setNotice(
        `${result.updated} of ${ids.length} selected posts ${to}.${result.updated < ids.length ? " Some posts changed status in another session; review the refreshed list." : ""}`,
      );
      setSelected([]);
      setDirty(false);
      setActive(null);
      const next = new URLSearchParams(query);
      next.delete("post");
      router.replace(`${pathname}?${next}`, { scroll: false });
      setRevision((value) => value + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk update failed.");
    } finally {
      setBusy(false);
    }
  }
  const position = data.items.findIndex((post) => post.id === active?.id);
  return (
    <div>
      <header className="admin-page-header">
        <div>
          <h1>Posts</h1>
          <p>Review the full text, make edits, and publish with confidence.</p>
        </div>
        <Link
          className="admin-button admin-button-primary"
          href="/admin/content"
        >
          Generate content
        </Link>
      </header>
      <div className="admin-tabs" role="tablist" aria-label="Post status">
        {[
          ["", "All posts"],
          ["draft", "Drafts"],
          ["approved", "Approved"],
          ["published", "Published"],
          ["archived", "Archived"],
        ].map(([value, label]) => (
          <button
            key={value}
            role="tab"
            aria-selected={(params.get("status") ?? "") === value}
            onClick={() => void navigate({ status: value })}
          >
            {label}
          </button>
        ))}
      </div>
      <form
        className="admin-toolbar"
        onSubmit={(event) => {
          event.preventDefault();
          void navigate({ q: search });
        }}
      >
        <div className="admin-field flex-1">
          <label htmlFor="post-search">Search posts</label>
          <input
            id="post-search"
            placeholder="Text, thesis, or source title…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            maxLength={200}
          />
        </div>
        <button className="admin-button" type="submit">
          Search
        </button>
        <div className="admin-field">
          <label htmlFor="filter-philosopher">Philosopher</label>
          <select
            id="filter-philosopher"
            value={params.get("philosopher") ?? ""}
            onChange={(event) =>
              void navigate({ philosopher: event.target.value })
            }
          >
            <option value="">All philosophers</option>
            {philosophers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-field">
          <label htmlFor="filter-category">Content type</label>
          <select
            id="filter-category"
            value={params.get("category") ?? "all"}
            onChange={(event) =>
              void navigate({
                category:
                  event.target.value === "all" ? "" : event.target.value,
              })
            }
          >
            {FEED_CONTENT_TABS.map((tab) => (
              <option key={tab.key} value={tab.key}>
                {tab.label}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-field">
          <label htmlFor="filter-tag">Tag</label>
          <select
            id="filter-tag"
            value={params.get("tag") ?? ""}
            onChange={(event) => void navigate({ tag: event.target.value })}
          >
            <option value="">All tags</option>
            {data.availableTags.map((tag) => (
              <option key={tag}>{tag}</option>
            ))}
          </select>
        </div>
        <button
          className="admin-button"
          type="button"
          onClick={() =>
            void navigate({
              q: "",
              philosopher: "",
              category: "",
              tag: "",
              status: "",
            })
          }
        >
          Reset
        </button>
      </form>
      {error && (
        <AdminNotice error>
          {error}{" "}
          <button
            className="underline"
            onClick={() => setRevision((value) => value + 1)}
          >
            Retry
          </button>
        </AdminNotice>
      )}
      {notice && <AdminNotice>{notice}</AdminNotice>}
      <div className={active ? "admin-review-grid" : ""}>
        <section className="admin-panel" aria-label="Posts queue">
          <div className="admin-panel-header">
            <span>
              {loading
                ? "Loading posts…"
                : `${data.total} posts · page ${data.page} of ${data.totalPages}`}
            </span>
            {selected.length > 0 && (
              <div className="flex flex-wrap gap-2 items-center">
                <span>{selected.length} selected on this page</span>
                <button
                  className="admin-button"
                  disabled={
                    busy ||
                    !selectedPosts.some((post) => post.status === "draft")
                  }
                  onClick={() => void bulk("draft", "approved")}
                >
                  Approve selected drafts
                </button>
                <button
                  className="admin-button admin-button-primary"
                  disabled={
                    busy ||
                    !selectedPosts.some((post) => post.status === "approved")
                  }
                  onClick={() => void bulk("approved", "published")}
                >
                  Publish selected approved
                </button>
              </div>
            )}
          </div>
          <div className="admin-table-scroll">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="w-10">
                    <input
                      type="checkbox"
                      aria-label="Select all posts on this page"
                      checked={
                        data.items.length > 0 &&
                        selected.length === data.items.length
                      }
                      disabled={loading}
                      onChange={(event) =>
                        setSelected(
                          event.target.checked
                            ? data.items.map((post) => post.id)
                            : [],
                        )
                      }
                    />
                  </th>
                  <th>Post</th>
                  <th>Status</th>
                  <th className="admin-post-date">Created</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((post) => (
                  <tr
                    key={post.id}
                    className={
                      active?.id === post.id ? "admin-row-selected" : ""
                    }
                  >
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Select post by ${post.philosopher_name}: ${post.thesis || post.id}`}
                        checked={selected.includes(post.id)}
                        disabled={loading || busy}
                        onChange={(event) =>
                          setSelected((ids) =>
                            event.target.checked
                              ? [...ids, post.id]
                              : ids.filter((id) => id !== post.id),
                          )
                        }
                      />
                    </td>
                    <td>
                      <span className="block text-xs text-ink-lighter mb-1">
                        {post.philosopher_name} · {post.tag || post.source_type}
                      </span>
                      <button
                        className="admin-post-title"
                        disabled={busy}
                        onClick={() => void navigate({ post: post.id }, false)}
                      >
                        {post.thesis || post.content.slice(0, 100)}
                      </button>
                      <span className="admin-post-excerpt">{post.content}</span>
                    </td>
                    <td>
                      <AdminStatus status={post.status} />
                    </td>
                    <td className="admin-post-date text-xs text-ink-lighter whitespace-nowrap">
                      {formatDateTime(post.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && !data.items.length && (
            <div className="admin-empty">
              No posts match these filters. Try a different search or reset the
              filters.
            </div>
          )}
          <footer className="admin-panel-footer">
            <button
              className="admin-button"
              disabled={loading || data.page <= 1}
              onClick={() =>
                void navigate({ page: String(data.page - 1), post: "" }, false)
              }
            >
              Previous page
            </button>
            <span className="text-xs text-ink-lighter">25 per page</span>
            <button
              className="admin-button"
              disabled={loading || data.page >= data.totalPages}
              onClick={() =>
                void navigate({ page: String(data.page + 1), post: "" }, false)
              }
            >
              Next page
            </button>
          </footer>
        </section>
        {active && (
          <PostEditor
            key={active.id}
            initial={active}
            onSaved={onSaved}
            onDirty={setDirty}
            onBusy={setEditorBusy}
            onClose={() => void navigate({ post: "" }, false)}
            previous={position > 0}
            next={position >= 0 && position < data.items.length - 1}
            onStep={(direction) => {
              const post = data.items[position + direction];
              if (post) void navigate({ post: post.id }, false);
            }}
          />
        )}
      </div>
    </div>
  );
}
export default function AdminPostsPage() {
  return (
    <Suspense fallback={<p>Loading posts…</p>}>
      <PostsWorkspace />
    </Suspense>
  );
}
