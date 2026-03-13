"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Spinner } from "@/components/Spinner";
import { formatDate } from "@/lib/date-utils";
import type { NewsSource as BaseNewsSource } from "@/lib/news-scout-service";

interface NewsSource extends BaseNewsSource {
  article_count?: number;
}

interface FeedTestResult {
  valid: boolean;
  articleCount: number;
  sampleTitle: string;
  error?: string;
}

const CATEGORIES = [
  "world",
  "politics",
  "science",
  "ideas",
  "opinion",
  "entertainment",
  "sports",
  "tech",
  "culture",
] as const;

const CATEGORY_STYLES: Record<string, string> = {
  world: "border-sky-200 bg-sky-100 text-sky-800",
  politics: "border-red-200 bg-red-100 text-red-800",
  science: "border-emerald-200 bg-emerald-100 text-emerald-800",
  ideas: "border-violet-200 bg-violet-100 text-violet-800",
  opinion: "border-stone-300 bg-stone-200 text-stone-700",
  entertainment: "border-pink-200 bg-pink-100 text-pink-800",
  sports: "border-orange-200 bg-orange-100 text-orange-800",
  tech: "border-blue-200 bg-blue-100 text-blue-800",
  culture: "border-amber-200 bg-amber-100 text-amber-800",
};

function slugifySourceId(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatCategoryLabel(category: string): string {
  if (category === "tech") return "Tech";
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function categoryBadgeClasses(category: string): string {
  return CATEGORY_STYLES[category] ?? "border-border-light bg-parchment-dark/30 text-ink-lighter";
}

function getArticleHealth(count: number) {
  if (count === 0) {
    return {
      dotClass: "bg-red-500",
      textClass: "text-red-700",
      label: "No articles - likely broken",
    };
  }

  if (count >= 100) {
    return {
      dotClass: "bg-amber-500",
      textClass: "text-amber-700",
      label: "100+ articles - flooding pipeline",
    };
  }

  return {
    dotClass: "bg-transparent",
    textClass: "text-ink-light",
    label: "Healthy volume",
  };
}

export default function RSSSourcesPage() {
  const [sources, setSources] = useState<NewsSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [addPanelOpen, setAddPanelOpen] = useState(false);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [newSource, setNewSource] = useState({
    id: "",
    name: "",
    feed_url: "",
    category: "world",
  });
  const [addingSource, setAddingSource] = useState(false);
  const [testingFeed, setTestingFeed] = useState(false);
  const [feedTestResult, setFeedTestResult] = useState<FeedTestResult | null>(null);
  const [updatingSourceId, setUpdatingSourceId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingSourceId, setDeletingSourceId] = useState<string | null>(null);

  const fetchSources = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/news-scout/sources");
      const data = (await res.json()) as NewsSource[] | { error?: string };
      if (!res.ok) {
        throw new Error("error" in data ? data.error : "Failed to fetch sources");
      }
      setSources(Array.isArray(data) ? data : []);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to fetch sources");
    }
  }, []);

  useEffect(() => {
    fetchSources().finally(() => setLoading(false));
  }, [fetchSources]);

  useEffect(() => {
    function handleWindowClick(event: MouseEvent) {
      const target = event.target as Element | null;
      if (!target?.closest("[data-source-menu]")) {
        setOpenMenuId(null);
      }
    }

    window.addEventListener("click", handleWindowClick);
    return () => window.removeEventListener("click", handleWindowClick);
  }, []);

  const categorySummary = useMemo(() => {
    return CATEGORIES.map((category) => ({
      category,
      count: sources.filter((source) => source.category === category).length,
    })).filter((entry) => entry.count > 0);
  }, [sources]);

  const totalArticles = useMemo(() => {
    return sources.reduce((sum, source) => sum + (source.article_count ?? 0), 0);
  }, [sources]);

  const filteredSources = useMemo(() => {
    return sources
      .filter((source) => categoryFilter === "all" || source.category === categoryFilter)
      .slice()
      .sort((a, b) => {
        const categoryCompare = a.category.localeCompare(b.category);
        if (categoryCompare !== 0) return categoryCompare;
        return a.name.localeCompare(b.name);
      });
  }, [categoryFilter, sources]);

  function resetNewSourceForm() {
    setNewSource({
      id: "",
      name: "",
      feed_url: "",
      category: "world",
    });
    setSlugManuallyEdited(false);
    setFeedTestResult(null);
  }

  function handleNewSourceNameChange(value: string) {
    setNewSource((current) => ({
      ...current,
      name: value,
      id: slugManuallyEdited ? current.id : slugifySourceId(value),
    }));
  }

  async function addSource() {
    if (!newSource.id || !newSource.name || !newSource.feed_url) return;

    setAddingSource(true);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch("/api/admin/news-scout/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSource),
      });

      const data = (await res.json()) as NewsSource | { error?: string };
      if (!res.ok) {
        throw new Error("error" in data ? data.error : "Failed to add source");
      }

      resetNewSourceForm();
      setAddPanelOpen(false);
      setNotice(`Added ${newSource.name}.`);
      await fetchSources();
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : "Failed to add source");
    } finally {
      setAddingSource(false);
    }
  }

  async function testFeed() {
    if (!newSource.feed_url) return;

    setTestingFeed(true);
    setError(null);
    setFeedTestResult(null);

    try {
      const res = await fetch("/api/admin/news-scout/sources/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feed_url: newSource.feed_url }),
      });

      const data = (await res.json()) as FeedTestResult | { error?: string };
      if (!res.ok) {
        throw new Error("error" in data ? data.error : "Failed to test feed");
      }

      setFeedTestResult(data as FeedTestResult);
    } catch (testError) {
      const message = testError instanceof Error ? testError.message : "Failed to test feed";
      setFeedTestResult({
        valid: false,
        articleCount: 0,
        sampleTitle: "",
        error: message,
      });
    } finally {
      setTestingFeed(false);
    }
  }

  async function updateSource(
    id: string,
    updates: { is_active?: number; category?: string },
    successMessage: string
  ) {
    setUpdatingSourceId(id);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch("/api/admin/news-scout/sources", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });

      const data = (await res.json()) as NewsSource | { error?: string };
      if (!res.ok) {
        throw new Error("error" in data ? data.error : "Failed to update source");
      }

      setSources((current) =>
        current.map((source) =>
          source.id === id ? { ...source, ...(data as NewsSource) } : source
        )
      );
      setNotice(successMessage);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update source");
    } finally {
      setUpdatingSourceId(null);
      setEditingCategoryId(null);
      setOpenMenuId(null);
    }
  }

  async function deleteSource(id: string) {
    setDeletingSourceId(id);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch("/api/admin/news-scout/sources", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      const data = (await res.json()) as { deleted?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete source");
      }

      setSources((current) => current.filter((source) => source.id !== id));
      setNotice(`Deleted ${id}.`);
      setConfirmDeleteId(null);
      setOpenMenuId(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete source");
    } finally {
      setDeletingSourceId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="h-6 w-6 text-terracotta" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-2xl font-bold text-ink">RSS Sources</h1>
        <p className="mt-1 text-sm font-body text-ink-light">
          Manage feed mix, source health, and category balance for the News Scout pipeline.
        </p>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-3 text-red-600 hover:text-red-800">
            x
          </button>
        </div>
      )}

      {notice && (
        <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="ml-3 text-green-700 hover:text-green-900">
            x
          </button>
        </div>
      )}

      <section className="rounded-xl border border-border bg-white shadow-sm">
        <div className="border-b border-border bg-parchment-dark/20 px-6 py-4">
          <p className="text-xs font-mono uppercase tracking-[0.3em] text-ink-lighter">
            Overview
          </p>
        </div>
        <div className="space-y-4 px-6 py-5">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setCategoryFilter("all")}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider transition-colors ${
                categoryFilter === "all"
                  ? "border-terracotta bg-terracotta/10 text-terracotta"
                  : "border-border-light bg-parchment text-ink-lighter hover:bg-parchment-dark/30"
              }`}
            >
              All
              <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] text-ink">
                {sources.length}
              </span>
            </button>
            {categorySummary.map(({ category, count }) => (
              <button
                key={category}
                type="button"
                onClick={() => setCategoryFilter((current) => (current === category ? "all" : category))}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider transition-transform hover:-translate-y-[1px] ${categoryBadgeClasses(category)} ${
                  categoryFilter === category ? "ring-2 ring-terracotta/30" : ""
                }`}
              >
                {formatCategoryLabel(category)}
                <span className="rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] text-current">
                  {count}
                </span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm font-body text-ink-light">
            <span className="rounded-full border border-border-light bg-parchment px-3 py-1.5">
              Total sources: <strong className="text-ink">{sources.length}</strong>
            </span>
            <span className="rounded-full border border-border-light bg-parchment px-3 py-1.5">
              Total articles: <strong className="text-ink">{totalArticles}</strong>
            </span>
            {categoryFilter !== "all" && (
              <span className="rounded-full border border-terracotta/20 bg-terracotta/5 px-3 py-1.5 text-terracotta">
                Filtered by {formatCategoryLabel(categoryFilter)}
              </span>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-border bg-parchment-dark/20 px-6 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-mono uppercase tracking-[0.3em] text-ink-lighter">
              Sources
            </p>
            <h2 className="mt-1 font-serif text-lg font-bold text-ink">
              RSS Feed Directory
            </h2>
          </div>

          <button
            type="button"
            onClick={() => {
              setAddPanelOpen((current) => !current);
              setFeedTestResult(null);
            }}
            className="inline-flex items-center justify-center rounded-full bg-terracotta px-4 py-2 text-sm font-body font-medium text-white transition-colors hover:bg-terracotta-light"
          >
            {addPanelOpen ? "Close" : "+ Add Source"}
          </button>
        </div>

        {addPanelOpen && (
          <div className="border-b border-border bg-parchment-dark/10 px-6 py-5">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-mono uppercase tracking-wider text-ink-lighter">
                  Display Name
                </label>
                <input
                  type="text"
                  placeholder="MIT Technology Review"
                  value={newSource.name}
                  onChange={(event) => handleNewSourceNameChange(event.target.value)}
                  className="w-full rounded-lg border border-border bg-parchment px-3 py-2.5 text-sm font-body text-ink focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/40"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-mono uppercase tracking-wider text-ink-lighter">
                  Slug ID
                </label>
                <input
                  type="text"
                  placeholder="mit-technology-review"
                  value={newSource.id}
                  onChange={(event) => {
                    setSlugManuallyEdited(true);
                    setNewSource((current) => ({ ...current, id: slugifySourceId(event.target.value) }));
                  }}
                  className="w-full rounded-lg border border-border bg-parchment px-3 py-2.5 text-sm font-body text-ink focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/40"
                />
                <p className="mt-2 text-[11px] font-mono text-ink-lighter">
                  Auto-generated from the display name until you edit it manually.
                </p>
              </div>

              <div className="lg:col-span-2">
                <label className="mb-2 block text-xs font-mono uppercase tracking-wider text-ink-lighter">
                  Feed URL
                </label>
                <div className="flex flex-col gap-3 md:flex-row">
                  <input
                    type="text"
                    placeholder="https://example.com/feed.xml"
                    value={newSource.feed_url}
                    onChange={(event) => {
                      setFeedTestResult(null);
                      setNewSource((current) => ({ ...current, feed_url: event.target.value }));
                    }}
                    className="flex-1 rounded-lg border border-border bg-parchment px-3 py-2.5 text-sm font-body text-ink focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/40"
                  />
                  <button
                    type="button"
                    onClick={testFeed}
                    disabled={testingFeed || !newSource.feed_url}
                    className="inline-flex items-center justify-center rounded-full border border-border-light bg-white px-4 py-2 text-xs font-mono uppercase tracking-wider text-ink-lighter transition-colors hover:bg-parchment disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {testingFeed ? <><Spinner /> Testing</> : "Test Feed"}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-mono uppercase tracking-wider text-ink-lighter">
                  Category
                </label>
                <select
                  value={newSource.category}
                  onChange={(event) =>
                    setNewSource((current) => ({ ...current, category: event.target.value }))
                  }
                  className="w-full rounded-lg border border-border bg-parchment px-3 py-2.5 text-sm font-body text-ink focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/40"
                >
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {formatCategoryLabel(category)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end justify-end">
                <button
                  type="button"
                  onClick={addSource}
                  disabled={addingSource || !newSource.id || !newSource.name || !newSource.feed_url}
                  className="inline-flex items-center justify-center rounded-full bg-terracotta px-5 py-2.5 text-sm font-body font-medium text-white transition-colors hover:bg-terracotta-light disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {addingSource ? <><Spinner /> Saving</> : "Save Source"}
                </button>
              </div>
            </div>

            {feedTestResult && (
              <div
                className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
                  feedTestResult.valid
                    ? "border-green-200 bg-green-50 text-green-800"
                    : "border-red-200 bg-red-50 text-red-800"
                }`}
              >
                <p className="font-mono text-[11px] uppercase tracking-wider">
                  {feedTestResult.valid ? "Feed looks good" : "Feed test failed"}
                </p>
                <p className="mt-1 font-body">
                  Articles found: <strong>{feedTestResult.articleCount}</strong>
                </p>
                {feedTestResult.sampleTitle && (
                  <p className="mt-1 font-body">
                    Latest sample: <span className="italic">{feedTestResult.sampleTitle}</span>
                  </p>
                )}
                {feedTestResult.error && (
                  <p className="mt-1 font-body">{feedTestResult.error}</p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-parchment-dark/30">
                <th className="px-5 py-3 text-left font-mono text-xs uppercase tracking-wider text-ink-lighter">
                  Source
                </th>
                <th className="px-5 py-3 text-left font-mono text-xs uppercase tracking-wider text-ink-lighter">
                  Category
                </th>
                <th className="px-5 py-3 text-left font-mono text-xs uppercase tracking-wider text-ink-lighter">
                  Articles
                </th>
                <th className="px-5 py-3 text-left font-mono text-xs uppercase tracking-wider text-ink-lighter">
                  Last Fetched
                </th>
                <th className="px-5 py-3 text-left font-mono text-xs uppercase tracking-wider text-ink-lighter">
                  Status
                </th>
                <th className="px-5 py-3 text-right font-mono text-xs uppercase tracking-wider text-ink-lighter">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredSources.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm font-body text-ink-lighter">
                    No sources match this filter.
                  </td>
                </tr>
              ) : (
                filteredSources.map((source) => {
                  const articleCount = source.article_count ?? 0;
                  const health = getArticleHealth(articleCount);
                  const isUpdatingThisRow = updatingSourceId === source.id;
                  const showDeleteConfirm = confirmDeleteId === source.id;

                  return (
                    <tr
                      key={source.id}
                      className="border-b border-border-light last:border-b-0 hover:bg-parchment-dark/20 transition-colors"
                    >
                      <td className="px-5 py-4">
                        <div className="font-body text-sm text-ink">{source.name}</div>
                        <div className="mt-1 font-mono text-[10px] text-ink-lighter">{source.id}</div>
                        <div className="mt-1 max-w-[360px] truncate font-mono text-[10px] text-ink-lighter">
                          {source.feed_url}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        {editingCategoryId === source.id ? (
                          <select
                            autoFocus
                            defaultValue={source.category}
                            onBlur={() => {
                              if (updatingSourceId !== source.id) {
                                setEditingCategoryId(null);
                              }
                            }}
                            onChange={(event) =>
                              void updateSource(
                                source.id,
                                { category: event.target.value },
                                `${source.name} moved to ${formatCategoryLabel(event.target.value)}.`
                              )
                            }
                            className="rounded-lg border border-border bg-white px-3 py-2 text-xs font-mono uppercase tracking-wider text-ink focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/40"
                          >
                            {CATEGORIES.map((category) => (
                              <option key={category} value={category}>
                                {formatCategoryLabel(category)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCategoryId(source.id);
                              setOpenMenuId(null);
                            }}
                            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider transition-transform hover:-translate-y-[1px] ${categoryBadgeClasses(source.category)}`}
                          >
                            {formatCategoryLabel(source.category)}
                          </button>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <div
                          className={`inline-flex items-center gap-2 font-mono text-xs ${health.textClass}`}
                          title={health.label}
                        >
                          {(articleCount === 0 || articleCount >= 100) && (
                            <span className={`h-2 w-2 rounded-full ${health.dotClass}`} />
                          )}
                          <span>{articleCount}</span>
                        </div>
                      </td>

                      <td className="px-5 py-4 font-mono text-xs text-ink-lighter">
                        {source.last_fetched_at ? formatDate(source.last_fetched_at) : "Never"}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider ${
                            source.is_active
                              ? "bg-green-100 text-green-800"
                              : "bg-stone-200 text-stone-700"
                          }`}
                        >
                          {source.is_active ? "Active" : "Paused"}
                        </span>
                      </td>

                      <td className="relative px-5 py-4 text-right" data-source-menu>
                        {showDeleteConfirm ? (
                          <div className="inline-flex items-center gap-2">
                            <span className="text-[11px] font-mono text-ink-lighter">
                              Delete?
                            </span>
                            <button
                              type="button"
                              onClick={() => void deleteSource(source.id)}
                              disabled={deletingSourceId === source.id}
                              className="rounded-full bg-red-600 px-3 py-1 text-[11px] font-mono text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {deletingSourceId === source.id ? "..." : "Confirm"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-[11px] font-mono text-ink-lighter transition-colors hover:text-ink"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex justify-end">
                            <button
                              type="button"
                              onClick={() =>
                                setOpenMenuId((current) => (current === source.id ? null : source.id))
                              }
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border-light bg-white text-sm font-mono text-ink-lighter transition-colors hover:bg-parchment hover:text-ink"
                              title="Open actions"
                            >
                              ...
                            </button>

                            {openMenuId === source.id && (
                              <div className="absolute right-5 top-14 z-10 w-44 rounded-lg border border-border bg-white p-2 shadow-lg">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingCategoryId(source.id);
                                    setOpenMenuId(null);
                                  }}
                                  className="block w-full rounded-md px-3 py-2 text-left text-xs font-mono text-ink-lighter transition-colors hover:bg-parchment hover:text-ink"
                                >
                                  Edit Category
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void updateSource(
                                      source.id,
                                      { is_active: source.is_active ? 0 : 1 },
                                      `${source.name} ${source.is_active ? "deactivated" : "activated"}.`
                                    )
                                  }
                                  disabled={isUpdatingThisRow}
                                  className="block w-full rounded-md px-3 py-2 text-left text-xs font-mono text-ink-lighter transition-colors hover:bg-parchment hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {source.is_active ? "Deactivate" : "Activate"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setConfirmDeleteId(source.id);
                                    setOpenMenuId(null);
                                  }}
                                  className="block w-full rounded-md px-3 py-2 text-left text-xs font-mono text-red-700 transition-colors hover:bg-red-50"
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
