"use client";

import { useEffect, useState, useCallback } from "react";
import { Spinner } from "@/components/Spinner";
import { formatDate } from "@/lib/date-utils";
import { STANCE_CONFIG } from "@/lib/constants";
import type { Stance } from "@/lib/types";

// ── Types ────────────────────────────────────────────────────────────

import type {
  NewsSource as BaseNewsSource,
  ArticleCandidate,
  FetchResult,
  ScoreResult,
} from "@/lib/news-scout-service";

interface NewsSource extends BaseNewsSource {
  article_count?: number;
}

interface Stats {
  total: number;
  new: number;
  scored: number;
  approved: number;
  dismissed: number;
  used: number;
}

// ── Helpers ──────────────────────────────────────────────────────────

function parseJSON<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function scoreBadgeClasses(score: number | null): string {
  if (score === null) return "bg-gray-100 text-gray-600";
  if (score >= 80) return "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300";
  if (score >= 60) return "bg-green-100 text-green-800";
  if (score >= 40) return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-800";
}

const CATEGORIES = ["all", "world", "opinion", "entertainment", "sports", "tech", "culture"];
const MIN_SCORES = [
  { label: "All scores", value: "" },
  { label: "40+", value: "40" },
  { label: "60+", value: "60" },
  { label: "80+", value: "80" },
];
const STATUS_TABS = ["scored", "approved", "dismissed", "all"];

// ── Component ────────────────────────────────────────────────────────

export default function NewsScoutPage() {
  // ── State ──────────────────────────────────────────────────────────

  const [stats, setStats] = useState<Stats | null>(null);
  const [candidates, setCandidates] = useState<ArticleCandidate[]>([]);
  const [sources, setSources] = useState<NewsSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineStatus, setPipelineStatus] = useState("");
  const [pipelineResult, setPipelineResult] = useState<{
    fetchResult?: FetchResult;
    scoreResult?: ScoreResult;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState("scored");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [minScoreFilter, setMinScoreFilter] = useState("");

  // Sources management
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  const [newSource, setNewSource] = useState({
    id: "",
    name: "",
    feed_url: "",
    category: "world",
  });
  const [addingSource, setAddingSource] = useState(false);

  // Philosopher lookup (fetched dynamically so it stays current)
  const [philosopherMeta, setPhilosopherMeta] = useState<
    Record<string, { name: string; initials: string; color: string }>
  >({});

  // ── Data fetching ──────────────────────────────────────────────────

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/news-scout");
      const data = await res.json();
      setStats(data.stats);
    } catch {
      // stats are non-critical
    }
  }, []);

  const fetchCandidates = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      if (minScoreFilter) params.set("min_score", minScoreFilter);
      params.set("limit", "50");

      const res = await fetch(`/api/admin/news-scout/candidates?${params}`);
      const data = await res.json();
      setCandidates(data);
    } catch {
      setError("Failed to fetch candidates");
    }
  }, [statusFilter, categoryFilter, minScoreFilter]);

  const fetchSources = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/news-scout/sources");
      const data = await res.json();
      setSources(data);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    fetch("/api/admin/philosophers")
      .then((r) => r.json())
      .then((data: Array<{ id: string; name: string; initials: string; color: string }>) => {
        const lookup: Record<string, { name: string; initials: string; color: string }> = {};
        for (const p of data) {
          lookup[p.id] = { name: p.name, initials: p.initials, color: p.color };
        }
        setPhilosopherMeta(lookup);
      })
      .catch((e) => console.error("Failed to fetch philosophers:", e));

    Promise.all([fetchStats(), fetchCandidates(), fetchSources()]).finally(() =>
      setLoading(false)
    );
  }, [fetchStats, fetchCandidates, fetchSources]);

  // Re-fetch candidates when filters change
  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  // ── Pipeline actions ───────────────────────────────────────────────

  const runPipeline = async (action: "fetch" | "score" | "fetch_and_score") => {
    setPipelineRunning(true);
    setPipelineResult(null);
    setError(null);

    if (action === "fetch") setPipelineStatus("Fetching feeds...");
    else if (action === "score") setPipelineStatus("Scoring articles...");
    else setPipelineStatus("Fetching feeds...");

    try {
      const res = await fetch("/api/admin/news-scout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Pipeline failed");

      setPipelineResult(data);
      // Refresh all data
      await Promise.all([fetchStats(), fetchCandidates(), fetchSources()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pipeline failed");
    } finally {
      setPipelineRunning(false);
      setPipelineStatus("");
    }
  };

  // ── Candidate actions ──────────────────────────────────────────────

  const updateCandidateStatus = async (
    id: string,
    newStatus: "approved" | "dismissed" | "scored"
  ) => {
    try {
      const res = await fetch("/api/admin/news-scout/candidates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update");

      const updated = await res.json();
      setCandidates((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...updated } : c))
      );
      fetchStats();
    } catch {
      setError("Failed to update candidate status");
    }
  };

  // ── Source management ──────────────────────────────────────────────

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
      fetchStats();
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
      fetchStats();
      fetchCandidates();
    } catch {
      setError("Failed to delete source");
    }
  };

  // ── Render ─────────────────────────────────────────────────────────

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
        <h1 className="font-serif text-2xl font-bold text-ink">News Scout</h1>
        <p className="text-sm text-ink-light font-body mt-1">
          Discover and score articles for philosophical potential
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
            ✕
          </button>
        </div>
      )}

      {/* Pipeline result */}
      {pipelineResult && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {pipelineResult.fetchResult && (
            <p>
              Fetched {pipelineResult.fetchResult.sourcesChecked} sources →{" "}
              <strong>{pipelineResult.fetchResult.newArticles}</strong> new articles
              {pipelineResult.fetchResult.errors.length > 0 && (
                <span className="text-yellow-700">
                  {" "}
                  ({pipelineResult.fetchResult.errors.length} errors)
                </span>
              )}
            </p>
          )}
          {pipelineResult.scoreResult && (
            <p>
              Scored <strong>{pipelineResult.scoreResult.scored}</strong> articles
              {pipelineResult.scoreResult.errors.length > 0 && (
                <span className="text-yellow-700">
                  {" "}
                  ({pipelineResult.scoreResult.errors.length} errors)
                </span>
              )}
            </p>
          )}
        </div>
      )}

      {/* ── Stats Bar ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total", value: stats?.total ?? 0, icon: "📊" },
          { label: "Unscored", value: stats?.new ?? 0, icon: "🆕" },
          { label: "Scored", value: stats?.scored ?? 0, icon: "📋" },
          { label: "Approved", value: stats?.approved ?? 0, icon: "✅" },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-white border border-border rounded-xl px-5 py-4 shadow-sm"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono uppercase tracking-wider text-ink-lighter">
                {card.label}
              </span>
              <span className="text-lg">{card.icon}</span>
            </div>
            <p className="font-serif text-3xl font-bold text-ink">
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Action Buttons ────────────────────────────────────────── */}
      <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 flex items-center gap-3 flex-wrap">
          <button
            onClick={() => runPipeline("fetch_and_score")}
            disabled={pipelineRunning}
            className="bg-terracotta hover:bg-terracotta-light text-white text-sm font-body px-5 py-2.5 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {pipelineRunning ? (
              <>
                <Spinner className="h-4 w-4" />
                <span>{pipelineStatus}</span>
              </>
            ) : (
              <>📰 Fetch &amp; Score</>
            )}
          </button>

          <button
            onClick={() => runPipeline("fetch")}
            disabled={pipelineRunning}
            className="text-sm font-body text-ink-light hover:text-ink px-3 py-2 rounded-lg hover:bg-parchment-dark transition-colors disabled:opacity-50"
          >
            Fetch Only
          </button>

          <button
            onClick={() => runPipeline("score")}
            disabled={pipelineRunning}
            className="text-sm font-body text-ink-light hover:text-ink px-3 py-2 rounded-lg hover:bg-parchment-dark transition-colors disabled:opacity-50"
          >
            Score Only
          </button>

          {sources.length > 0 && sources[0].last_fetched_at && (
            <span className="text-xs font-mono text-ink-lighter ml-auto">
              Last fetch:{" "}
              {formatDate(
                sources.reduce((latest, s) => {
                  if (!s.last_fetched_at) return latest;
                  return s.last_fetched_at > latest ? s.last_fetched_at : latest;
                }, "")
              )}
            </span>
          )}
        </div>
      </div>

      {/* ── Filter Bar ────────────────────────────────────────────── */}
      <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 space-y-4">
          {/* Status tabs */}
          <div className="flex gap-1">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-4 py-2 text-sm font-body rounded-lg transition-colors capitalize ${
                  statusFilter === tab
                    ? "bg-terracotta/10 text-terracotta ring-1 ring-terracotta/30"
                    : "text-ink-light hover:text-ink hover:bg-parchment-dark"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Dropdowns */}
          <div className="flex gap-3">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-lg border border-border bg-parchment px-3 py-2 text-sm text-ink font-body focus:outline-none focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta transition-colors"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === "all" ? "All categories" : cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </select>

            <select
              value={minScoreFilter}
              onChange={(e) => setMinScoreFilter(e.target.value)}
              className="rounded-lg border border-border bg-parchment px-3 py-2 text-sm text-ink font-body focus:outline-none focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta transition-colors"
            >
              {MIN_SCORES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Candidates List ───────────────────────────────────────── */}
      <div className="space-y-3">
        {candidates.length === 0 && (
          <div className="bg-white border border-border rounded-xl px-6 py-12 text-center">
            <p className="text-ink-lighter font-body text-sm">
              No candidates found. Try adjusting your filters or running the
              pipeline.
            </p>
          </div>
        )}

        {candidates.map((candidate) => {
          const philosophers = parseJSON<string[]>(
            candidate.suggested_philosophers,
            []
          );
          const stances = parseJSON<Record<string, string>>(
            candidate.suggested_stances,
            {}
          );
          const tensions = parseJSON<string[]>(candidate.primary_tensions, []);
          const isApproved = candidate.status === "approved";
          const isDismissed = candidate.status === "dismissed";

          return (
            <div
              key={candidate.id}
              className={`bg-white border rounded-xl shadow-sm overflow-hidden transition-colors ${
                isApproved
                  ? "border-green-300 bg-green-50/30"
                  : isDismissed
                  ? "border-border opacity-50"
                  : "border-border"
              }`}
            >
              <div className="px-5 py-4">
                <div className="flex gap-4">
                  {/* Thumbnail — article image or source logo fallback */}
                  {(() => {
                    const displayImage =
                      candidate.image_url || candidate.source_logo_url;
                    const isLogo =
                      !candidate.image_url && !!candidate.source_logo_url;
                    if (!displayImage) return null;
                    return (
                      <div
                        className={`shrink-0 rounded-lg overflow-hidden ${
                          isLogo
                            ? "w-12 h-12 flex items-center justify-center bg-parchment-dark/20"
                            : "w-20 h-16"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={displayImage}
                          alt=""
                          className={
                            isLogo
                              ? "w-8 h-8 object-contain"
                              : "w-full h-full object-cover"
                          }
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display =
                              "none";
                          }}
                        />
                      </div>
                    );
                  })()}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Top row: score + title */}
                    <div className="flex items-start gap-3 mb-2">
                      <span
                        className={`shrink-0 inline-flex items-center justify-center w-10 h-7 text-xs font-mono font-bold rounded-md ${scoreBadgeClasses(
                          candidate.score
                        )}`}
                      >
                        {candidate.score ?? "—"}
                      </span>

                      <a
                        href={candidate.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-serif text-sm font-bold text-ink hover:text-terracotta transition-colors line-clamp-2 leading-snug"
                      >
                        {candidate.title}
                      </a>
                    </div>

                    {/* Source + category + date */}
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-xs font-mono text-ink-lighter">
                        {candidate.source_name}
                      </span>
                      <span className="inline-block px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded-full bg-parchment-dark/40 text-ink-lighter">
                        {candidate.source_category}
                      </span>
                      {candidate.pub_date && (
                        <span className="text-xs font-mono text-ink-lighter">
                          {formatDate(candidate.pub_date)}
                        </span>
                      )}
                    </div>

                    {/* Philosophers + stances */}
                    {philosophers.length > 0 && (
                      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                        {philosophers.map((pid) => {
                          const meta = philosopherMeta[pid];
                          const stance = stances[pid] as Stance | undefined;
                          const stanceStyle = stance
                            ? STANCE_CONFIG[stance]
                            : null;

                          return (
                            <div key={pid} className="flex items-center gap-1">
                              <span
                                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-serif font-bold"
                                style={{
                                  backgroundColor: meta?.color || "#666",
                                }}
                                title={meta?.name || pid}
                              >
                                {meta?.initials || pid.slice(0, 2).toUpperCase()}
                              </span>
                              {stanceStyle && (
                                <span
                                  className="text-[10px] font-mono px-1.5 py-0.5 rounded-full"
                                  style={{
                                    backgroundColor: stanceStyle.bg,
                                    color: stanceStyle.color,
                                    border: `1px solid ${stanceStyle.border}`,
                                  }}
                                >
                                  {stanceStyle.label}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Philosophical entry point */}
                    {candidate.philosophical_entry_point && (
                      <p className="text-xs text-ink-light font-body italic mb-2 line-clamp-2">
                        {candidate.philosophical_entry_point}
                      </p>
                    )}

                    {/* Tensions */}
                    {tensions.length > 0 && (
                      <div className="flex items-center gap-1 mb-2 flex-wrap">
                        {tensions.map((t) => (
                          <span
                            key={t}
                            className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-parchment-dark/30 text-ink-lighter"
                          >
                            {t.replace(/_/g, " ")}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Score reasoning (collapsed) */}
                    {candidate.score_reasoning && (
                      <details className="mb-2">
                        <summary className="text-[10px] font-mono text-ink-lighter cursor-pointer hover:text-ink-light">
                          Scoring reasoning
                        </summary>
                        <p className="text-xs text-ink-light font-body mt-1 pl-2 border-l-2 border-border">
                          {candidate.score_reasoning}
                        </p>
                      </details>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="shrink-0 flex flex-col gap-2">
                    {candidate.status === "scored" && (
                      <>
                        <button
                          onClick={() =>
                            updateCandidateStatus(candidate.id, "approved")
                          }
                          className="bg-green-700 hover:bg-green-800 text-white text-xs font-body px-3 py-1.5 rounded-full transition-colors"
                        >
                          Approve ✓
                        </button>
                        <button
                          onClick={() =>
                            updateCandidateStatus(candidate.id, "dismissed")
                          }
                          className="bg-parchment-dark hover:bg-parchment-dark/80 text-ink-light text-xs font-body px-3 py-1.5 rounded-full transition-colors"
                        >
                          Dismiss ✗
                        </button>
                      </>
                    )}

                    {isApproved && (
                      <>
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2.5 py-1 rounded-full">
                          ✓ Approved
                        </span>
                        <a
                          href={
                            `/admin/content?` +
                            new URLSearchParams({
                              article_title: candidate.title,
                              article_source: candidate.source_name || "",
                              article_url: candidate.url,
                              article_description: candidate.description || "",
                              article_image_url: candidate.image_url || "",
                              suggested_philosophers: candidate.suggested_philosophers || "[]",
                            }).toString()
                          }
                          className="text-xs font-mono text-terracotta hover:text-terracotta-light transition-colors text-center"
                        >
                          Generate →
                        </a>
                        <button
                          onClick={() =>
                            updateCandidateStatus(candidate.id, "scored")
                          }
                          className="text-[10px] font-mono text-ink-lighter hover:text-ink-light transition-colors"
                        >
                          Undo
                        </button>
                      </>
                    )}

                    {isDismissed && (
                      <>
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-lighter bg-parchment-dark/30 px-2.5 py-1 rounded-full">
                          ✗ Dismissed
                        </span>
                        <button
                          onClick={() =>
                            updateCandidateStatus(candidate.id, "scored")
                          }
                          className="text-[10px] font-mono text-ink-lighter hover:text-ink-light transition-colors"
                        >
                          Undo
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Sources Management (Collapsible) ──────────────────────── */}
      <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
        <button
          onClick={() => setSourcesExpanded(!sourcesExpanded)}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-parchment-dark/20 transition-colors"
        >
          <h2 className="font-serif text-lg font-bold text-ink">
            RSS Sources
          </h2>
          <span className="text-ink-lighter text-lg">
            {sourcesExpanded ? "▲" : "▼"}
          </span>
        </button>

        {sourcesExpanded && (
          <div className="border-t border-border">
            {/* Sources table */}
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
                          onClick={() =>
                            toggleSource(source.id, source.is_active)
                          }
                          className={`text-xs font-mono px-2 py-1 rounded-full transition-colors ${
                            source.is_active
                              ? "bg-green-100 text-green-800 hover:bg-green-200"
                              : "bg-red-100 text-red-800 hover:bg-red-200"
                          }`}
                        >
                          {source.is_active ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => deleteSource(source.id)}
                          className="text-xs font-mono text-red-600 hover:text-red-800 transition-colors"
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
                    {CATEGORIES.filter((c) => c !== "all").map((cat) => (
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
                    {addingSource ? <Spinner className="h-4 w-4" /> : "Add"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
