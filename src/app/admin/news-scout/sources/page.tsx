"use client";

import { useEffect, useState, useCallback } from "react";
import { Spinner } from "@/components/Spinner";
import { formatDate } from "@/lib/date-utils";
import type { NewsSource as BaseNewsSource } from "@/lib/news-scout-service";

interface NewsSource extends BaseNewsSource {
  article_count?: number;
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
];

export default function RSSSourcesPage() {
  const [sources, setSources] = useState<NewsSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newSource, setNewSource] = useState({
    id: "",
    name: "",
    feed_url: "",
    category: "world",
  });
  const [addingSource, setAddingSource] = useState(false);

  const fetchSources = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/news-scout/sources");
      const data = await res.json();
      setSources(data);
    } catch {
      setError("Failed to fetch sources");
    }
  }, []);

  useEffect(() => {
    fetchSources().finally(() => setLoading(false));
  }, [fetchSources]);

  const addSource = async () => {
    if (!newSource.id || !newSource.name || !newSource.feed_url) return;
    setAddingSource(true);
    try {
      const res = await fetch("/api/admin/news-scout/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSource),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add source");
      }
      setNewSource({ id: "", name: "", feed_url: "", category: "world" });
      fetchSources();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add source");
    } finally {
      setAddingSource(false);
    }
  };

  const toggleSource = async (id: string, currentActive: number) => {
    try {
      await fetch("/api/admin/news-scout/sources", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, is_active: currentActive ? 0 : 1 }),
      });
      fetchSources();
    } catch {
      setError("Failed to toggle source");
    }
  };

  const deleteSource = async (id: string) => {
    if (!confirm(`Delete source "${id}" and all its articles?`)) return;
    try {
      await fetch("/api/admin/news-scout/sources", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      fetchSources();
    } catch {
      setError("Failed to delete source");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="h-6 w-6 text-terracotta" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-serif text-2xl font-bold text-ink">RSS Sources</h1>
        <p className="text-sm text-ink-light font-body mt-1">
          Manage RSS feeds for the News Scout pipeline
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-600 hover:text-red-800 ml-3"
          >
            x
          </button>
        </div>
      )}

      {/* Sources table */}
      <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-parchment-dark/30">
                <th className="text-left px-5 py-3 font-mono text-xs uppercase tracking-wider text-ink-lighter">
                  Source
                </th>
                <th className="text-left px-5 py-3 font-mono text-xs uppercase tracking-wider text-ink-lighter">
                  Category
                </th>
                <th className="text-left px-5 py-3 font-mono text-xs uppercase tracking-wider text-ink-lighter">
                  Articles
                </th>
                <th className="text-left px-5 py-3 font-mono text-xs uppercase tracking-wider text-ink-lighter">
                  Last Fetched
                </th>
                <th className="text-left px-5 py-3 font-mono text-xs uppercase tracking-wider text-ink-lighter">
                  Status
                </th>
                <th className="text-right px-5 py-3 font-mono text-xs uppercase tracking-wider text-ink-lighter">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {sources.map((source) => (
                <tr
                  key={source.id}
                  className="border-b border-border-light last:border-b-0 hover:bg-parchment-dark/20 transition-colors"
                >
                  <td className="px-5 py-3">
                    <div className="font-body text-ink text-sm">
                      {source.name}
                    </div>
                    <div className="font-mono text-[10px] text-ink-lighter truncate max-w-[250px]">
                      {source.feed_url}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-block px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded-full bg-parchment-dark/40 text-ink-lighter">
                      {source.category}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-ink-light">
                    {source.article_count ?? 0}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-ink-lighter">
                    {source.last_fetched_at
                      ? formatDate(source.last_fetched_at)
                      : "Never"}
                  </td>
                                    <td className="px-5 py-3">
                    <button
                      onClick={() => toggleSource(source.id, source.is_active)}
                      className={`rounded-full px-2 py-1 text-[10px] font-mono uppercase tracking-wider transition-colors ${
                        source.is_active
                          ? "bg-green-100 text-green-800 hover:bg-green-200"
                          : "bg-stone-200 text-stone-700 hover:bg-stone-300"
                      }`}
                    >
                      {source.is_active ? "Active" : "Paused"}
                    </button>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => deleteSource(source.id)}
                      className="font-mono text-xs text-red-700 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add Source form */}
        <div className="px-6 py-4 border-t border-border bg-parchment-dark/10">
          <h3 className="text-xs font-mono uppercase tracking-wider text-ink-lighter mb-3">
            Add Source
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <input
              type="text"
              placeholder="slug-id"
              value={newSource.id}
              onChange={(e) =>
                setNewSource({ ...newSource, id: e.target.value })
              }
              className="rounded-lg border border-border bg-parchment px-3 py-2 text-sm text-ink font-body focus:outline-none focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta transition-colors"
            />
            <input
              type="text"
              placeholder="Display Name"
              value={newSource.name}
              onChange={(e) =>
                setNewSource({ ...newSource, name: e.target.value })
              }
              className="rounded-lg border border-border bg-parchment px-3 py-2 text-sm text-ink font-body focus:outline-none focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta transition-colors"
            />
            <input
              type="text"
              placeholder="Feed URL"
              value={newSource.feed_url}
              onChange={(e) =>
                setNewSource({ ...newSource, feed_url: e.target.value })
              }
              className="rounded-lg border border-border bg-parchment px-3 py-2 text-sm text-ink font-body focus:outline-none focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta transition-colors"
            />
            <div className="flex gap-2">
              <select
                value={newSource.category}
                onChange={(e) =>
                  setNewSource({ ...newSource, category: e.target.value })
                }
                className="flex-1 rounded-lg border border-border bg-parchment px-3 py-2 text-sm text-ink font-body focus:outline-none focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta transition-colors"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </option>
                ))}
              </select>
              <button
                onClick={addSource}
                disabled={
                  addingSource ||
                  !newSource.id ||
                  !newSource.name ||
                  !newSource.feed_url
                }
                className="bg-terracotta hover:bg-terracotta-light text-white text-xs font-body px-4 py-2 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
