"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Spinner } from "@/components/Spinner";
import { formatDate } from "@/lib/date-utils";
import { STANCE_CONFIG } from "@/lib/constants";
import type { Stance } from "@/lib/types";

// ── Types ────────────────────────────────────────────────────────────

import type {
  ArticleCandidate,
  FetchResult,
  ScoreResult,
} from "@/lib/news-scout-service";

interface Stats {
  total: number;
  new: number;
  scored: number;
  approved: number;
  dismissed: number;
  used: number;
}

interface CandidateWithUsage extends ArticleCandidate {
  published_posts?: Array<{
    philosopher_id: string;
    status: string;
    post_id: string;
  }>;
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
  const [candidates, setCandidates] = useState<CandidateWithUsage[]>([]);
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

  // Delete / cleanup
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [cleanupConfirm, setCleanupConfirm] = useState(false);
  const [cleanupRunning, setCleanupRunning] = useState(false);

  // Philosopher lookup (fetched dynamically so it stays current)
  const [philosopherMeta, setPhilosopherMeta] = useState<
    Record<string, { name: string; initials: string; color: string }>
  >({});

  // Inline generation
  const [expandedGenId, setExpandedGenId] = useState<string | null>(null);
  const [selectedGenPhilosophers, setSelectedGenPhilosophers] = useState<string[]>([]);
  const [genResults, setGenResults] = useState<Array<{ philosopherId: string; success: boolean; error?: string }>>([]);
  const [genInProgress, setGenInProgress] = useState(false);

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

    Promise.all([fetchStats(), fetchCandidates()]).finally(() =>
      setLoading(false)
    );
  }, [fetchStats, fetchCandidates]);

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
      await Promise.all([fetchStats(), fetchCandidates()]);
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

  async function handleDeleteCandidate(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch("/api/admin/news-scout/candidates", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) throw new Error("Failed to delete candidate");

      setCandidates((prev) => prev.filter((c) => c.id !== id));
      setConfirmDeleteId(null);
      fetchStats();
    } catch {
      setError("Failed to delete candidate. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleCleanup() {
    setCleanupRunning(true);
    try {
      const res = await fetch("/api/admin/news-scout/candidates", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cleanup", older_than_days: 30 }),
      });

      if (!res.ok) throw new Error("Failed to clean up candidates");

      const data = await res.json();
      setCleanupConfirm(false);
      setPipelineResult({ ...pipelineResult });
      setPipelineStatus(`Cleaned up ${data.deleted} old articles`);
      setTimeout(() => setPipelineStatus(""), 4000);

      fetchStats();
      fetchCandidates();
    } catch {
      setError("Failed to clean up old articles. Please try again.");
    } finally {
      setCleanupRunning(false);
    }
  }

  // ── Inline bulk generation ────────────────────────────────────────

  async function handleBulkGenerate(candidate: CandidateWithUsage) {
    setGenInProgress(true);
    setGenResults([]);

    const sourceMaterial = `${candidate.title} — ${candidate.source_name}\n\n${candidate.description}`;
    const validPhilosophers = selectedGenPhilosophers.filter(pid => pid in philosopherMeta);

    for (const philosopherId of validPhilosophers) {
      try {
        // 1. Generate content
        const genRes = await fetch("/api/admin/content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            philosopher_id: philosopherId,
            content_type: "post",
            content_label: "News Reaction",
            user_input: sourceMaterial,
          }),
        });

        const genData = await genRes.json();
        if (!genRes.ok) throw new Error(genData.error || "Generation failed");

        // 2. Save as draft post with citation data
        const postRes = await fetch("/api/admin/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            philosopher_id: philosopherId,
            content: genData.generated?.content ?? "",
            thesis: genData.generated?.thesis ?? "",
            stance: genData.generated?.stance ?? "observes",
            tag: genData.generated?.tag ?? "",
            citation_title: candidate.title,
            citation_source: candidate.source_name || "",
            citation_url: candidate.url,
            citation_image_url: candidate.image_url || "",
          }),
        });

        if (!postRes.ok) throw new Error("Failed to save post");

        // 3. Update generation log to approved
        if (genData.log_entry?.id) {
          await fetch("/api/admin/content", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: genData.log_entry.id, status: "approved" }),
          });
        }

        setGenResults(prev => [...prev, { philosopherId, success: true }]);
      } catch (err) {
        setGenResults(prev => [...prev, {
          philosopherId,
          success: false,
          error: err instanceof Error ? err.message : "Failed",
        }]);
      }
    }

    setGenInProgress(false);
    fetchCandidates();
  }

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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
        {[
          { label: "Total", value: stats?.total ?? 0, icon: "📊" },
          { label: "Unscored", value: stats?.new ?? 0, icon: "🆕" },
          { label: "Scored", value: stats?.scored ?? 0, icon: "📋" },
          { label: "Approved", value: stats?.approved ?? 0, icon: "✅" },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-white border border-border rounded-xl px-6 py-5 shadow-sm"
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
        <div className="px-6 py-5 flex items-center gap-3 flex-wrap">
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
            className="text-sm font-body text-ink-light hover:text-ink px-4 py-2.5 rounded-lg hover:bg-parchment-dark transition-colors disabled:opacity-50"
          >
            Fetch Only
          </button>

          <button
            onClick={() => runPipeline("score")}
            disabled={pipelineRunning}
            className="text-sm font-body text-ink-light hover:text-ink px-4 py-2.5 rounded-lg hover:bg-parchment-dark transition-colors disabled:opacity-50"
          >
            Score Only
          </button>

          {cleanupConfirm ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-ink-lighter font-mono mr-1">
                Delete old dismissed/new articles?
              </span>
              <button
                onClick={handleCleanup}
                disabled={cleanupRunning}
                className="inline-flex items-center gap-1 px-3.5 py-1.5 text-xs font-mono tracking-wide rounded-full text-white bg-red-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-700"
              >
                {cleanupRunning ? (
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
                    Cleaning
                  </span>
                ) : (
                  "Confirm"
                )}
              </button>
              <button
                onClick={() => setCleanupConfirm(false)}
                className="inline-flex items-center px-3.5 py-1.5 text-xs font-mono tracking-wide rounded-full text-ink-lighter border border-border-light transition-all duration-200 hover:bg-parchment-dark/50"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setCleanupConfirm(true)}
              disabled={pipelineRunning}
              className="text-sm font-body text-ink-light hover:text-red-600 px-4 py-2.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              Clean up old
            </button>
          )}

          <Link
            href="/admin/news-scout/sources"
            className="text-xs font-mono text-terracotta hover:text-terracotta-light transition-colors ml-auto"
          >
            Manage RSS Sources &rarr;
          </Link>
        </div>
      </div>

      {/* ── Filter Bar ────────────────────────────────────────────── */}
      <div className="bg-white border border-border rounded-xl shadow-sm sticky top-0 z-10">
        <div className="px-6 py-5 space-y-4">
          {/* Status tabs */}
          <div className="flex gap-1">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-5 py-2.5 text-sm font-body rounded-lg transition-colors capitalize ${
                  statusFilter === tab
                    ? "bg-terracotta/10 text-terracotta ring-1 ring-terracotta/30 font-medium"
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
              className="rounded-lg border border-border bg-parchment px-4 py-2.5 text-sm text-ink font-body focus:outline-none focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta transition-colors"
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
              className="rounded-lg border border-border bg-parchment px-4 py-2.5 text-sm text-ink font-body focus:outline-none focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta transition-colors"
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
      {statusFilter === "approved" && candidates.length > 0 && (
        <div className="text-xs font-mono text-ink-lighter px-1 mb-2">
          {candidates.filter(c => (c.published_posts?.length || 0) > 0).length} of {candidates.length} approved articles have posts
        </div>
      )}
      <div className="space-y-4">
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
              <div className="px-6 py-5">
                <div className="flex gap-5">
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
                      <span className="inline-block px-2.5 py-0.5 text-[11px] font-mono uppercase tracking-wider rounded-full bg-parchment-dark/40 text-ink-lighter">
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
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        {philosophers.map((pid) => {
                          const meta = philosopherMeta[pid];
                          const stance = stances[pid] as Stance | undefined;
                          const stanceStyle = stance
                            ? STANCE_CONFIG[stance]
                            : null;

                          return (
                            <div key={pid} className="flex items-center gap-1">
                              <span
                                className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-serif font-bold"
                                style={{
                                  backgroundColor: meta?.color || "#666",
                                }}
                                title={meta?.name || pid}
                              >
                                {meta?.initials || pid.slice(0, 2).toUpperCase()}
                              </span>
                              {stanceStyle && (
                                <span
                                  className="text-[11px] font-mono px-2 py-0.5 rounded-full"
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
                      <p className="text-sm text-ink-light font-body italic mb-2 line-clamp-2">
                        {candidate.philosophical_entry_point}
                      </p>
                    )}

                    {/* Tensions */}
                    {tensions.length > 0 && (
                      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                        {tensions.map((t) => (
                          <span
                            key={t}
                            className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-parchment-dark/30 text-ink-lighter"
                          >
                            {t.replace(/_/g, " ")}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Post usage indicator (approved cards only) */}
                    {isApproved && (() => {
                      const posts = candidate.published_posts || [];
                      const postedPhilosopherIds = new Set(posts.map(p => p.philosopher_id));
                      const unusedPhilosophers = philosophers.filter(pid => !postedPhilosopherIds.has(pid));

                      if (posts.length > 0 && unusedPhilosophers.length === 0) {
                        // Fully used
                        return (
                          <div className="flex items-center gap-2 mt-2 py-1.5 px-2.5 rounded-lg bg-green-50 border border-green-200">
                            <span className="text-[11px] font-mono text-green-700">
                              ✓ {posts.length} post{posts.length !== 1 ? 's' : ''} generated
                            </span>
                            <div className="flex items-center gap-1">
                              {posts.map(p => {
                                const meta = philosopherMeta[p.philosopher_id];
                                return meta ? (
                                  <span
                                    key={p.post_id}
                                    className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[9px] font-bold text-white"
                                    style={{ backgroundColor: meta.color }}
                                    title={`${meta.name} — ${p.status}`}
                                  >
                                    {meta.initials}
                                  </span>
                                ) : null;
                              })}
                            </div>
                          </div>
                        );
                      } else if (posts.length > 0) {
                        // Partially used
                        return (
                          <div className="flex items-center gap-2 mt-2 py-1.5 px-2.5 rounded-lg bg-amber-50 border border-amber-200">
                            <span className="text-[11px] font-mono text-amber-700">
                              {posts.length}/{philosophers.length} posts
                            </span>
                            <div className="flex items-center gap-1">
                              {posts.map(p => {
                                const meta = philosopherMeta[p.philosopher_id];
                                return meta ? (
                                  <span
                                    key={p.post_id}
                                    className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[9px] font-bold text-white"
                                    style={{ backgroundColor: meta.color }}
                                    title={`${meta.name} — ${p.status}`}
                                  >
                                    {meta.initials}
                                  </span>
                                ) : null;
                              })}
                              {unusedPhilosophers.map(pid => {
                                const meta = philosopherMeta[pid];
                                return meta ? (
                                  <span
                                    key={pid}
                                    className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[9px] font-bold border border-dashed opacity-40"
                                    style={{ borderColor: meta.color, color: meta.color }}
                                    title={`${meta.name} — not yet generated`}
                                  >
                                    {meta.initials}
                                  </span>
                                ) : null;
                              })}
                            </div>
                          </div>
                        );
                      } else {
                        // No posts
                        return (
                          <div className="flex items-center gap-2 mt-2 py-1.5 px-2.5 rounded-lg bg-parchment-dark/20 border border-border-light">
                            <span className="text-[11px] font-mono text-ink-lighter">
                              No posts generated
                            </span>
                          </div>
                        );
                      }
                    })()}

                    {/* Score reasoning (collapsed) */}
                    {candidate.score_reasoning && (
                      <details className="mb-2">
                        <summary className="text-xs font-mono text-ink-lighter cursor-pointer hover:text-ink-light">
                          Scoring reasoning
                        </summary>
                        <p className="text-sm text-ink-light font-body mt-1 pl-2 border-l-2 border-border">
                          {candidate.score_reasoning}
                        </p>
                      </details>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="shrink-0 flex flex-col gap-3">
                    {candidate.status === "scored" && (
                      <>
                        <button
                          onClick={() =>
                            updateCandidateStatus(candidate.id, "approved")
                          }
                          className="bg-green-700 hover:bg-green-800 text-white text-xs font-body px-4 py-2 rounded-full transition-colors"
                        >
                          Approve ✓
                        </button>
                        <button
                          onClick={() =>
                            updateCandidateStatus(candidate.id, "dismissed")
                          }
                          className="bg-parchment-dark hover:bg-parchment-dark/80 text-ink-light text-xs font-body px-4 py-2 rounded-full transition-colors"
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
                          className="text-xs font-mono text-terracotta hover:text-terracotta-light transition-colors text-center px-3 py-1.5 rounded-full border border-terracotta/20 bg-terracotta/5 hover:bg-terracotta/10"
                        >
                          Generate →
                        </a>
                        <button
                          onClick={() =>
                            updateCandidateStatus(candidate.id, "scored")
                          }
                          className="text-[11px] font-mono text-ink-lighter hover:text-ink-light transition-colors"
                        >
                          Undo
                        </button>
                        <button
                          onClick={() => {
                            if (expandedGenId === candidate.id) {
                              setExpandedGenId(null);
                            } else {
                              setExpandedGenId(candidate.id);
                              const suggested = parseJSON<string[]>(candidate.suggested_philosophers, []);
                              setSelectedGenPhilosophers(suggested.filter(pid => pid in philosopherMeta));
                              setGenResults([]);
                            }
                          }}
                          className="text-xs font-mono text-terracotta hover:text-terracotta-light transition-colors px-3 py-1.5 rounded-full border border-terracotta/20 bg-terracotta/5 hover:bg-terracotta/10"
                        >
                          {expandedGenId === candidate.id ? "Close" : "Quick Generate ⚡"}
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
                          className="text-[11px] font-mono text-ink-lighter hover:text-ink-light transition-colors"
                        >
                          Undo
                        </button>
                        {confirmDeleteId === candidate.id ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleDeleteCandidate(candidate.id)}
                              disabled={deletingId === candidate.id}
                              className="inline-flex items-center gap-1 px-3 py-1 text-[11px] font-mono tracking-wide rounded-full text-white bg-red-600 transition-all duration-200 disabled:opacity-50 hover:bg-red-700"
                            >
                              {deletingId === candidate.id ? "..." : "Delete"}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-[11px] font-mono text-ink-lighter hover:text-ink-light transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(candidate.id)}
                            className="text-[11px] font-mono text-red-400 hover:text-red-600 transition-colors"
                            title="Permanently delete"
                          >
                            Delete
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Quick Generate panel ─────────────────────────── */}
              {isApproved && expandedGenId === candidate.id && (
                <div className="border-t border-border px-6 py-5 bg-parchment-dark/10">
                  <div className="flex flex-wrap gap-3 mb-3">
                    {Object.entries(philosopherMeta).map(([pid, meta]) => {
                      const isSelected = selectedGenPhilosophers.includes(pid);
                      const result = genResults.find(r => r.philosopherId === pid);
                      return (
                        <button
                          key={pid}
                          onClick={() => {
                            if (genInProgress) return;
                            setSelectedGenPhilosophers(prev =>
                              isSelected ? prev.filter(p => p !== pid) : [...prev, pid]
                            );
                          }}
                          disabled={genInProgress}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono transition-all ${
                            isSelected
                              ? "ring-2 ring-offset-1 opacity-100"
                              : "opacity-40 hover:opacity-70"
                          } ${result?.success === true ? "ring-green-400" : result?.success === false ? "ring-red-400" : ""}`}
                          style={{
                            backgroundColor: `${meta.color}15`,
                            color: meta.color,
                            ...(isSelected && !result ? { ["--tw-ring-color" as string]: meta.color } : {}),
                          }}
                        >
                          <span
                            className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                            style={{ backgroundColor: meta.color }}
                          >
                            {meta.initials}
                          </span>
                          {meta.name.split(" ").pop()}
                          {result?.success === true && " ✓"}
                          {result?.success === false && " ✗"}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => handleBulkGenerate(candidate)}
                    disabled={genInProgress || selectedGenPhilosophers.length === 0}
                    className="inline-flex items-center gap-2 bg-terracotta hover:bg-terracotta-light disabled:opacity-50 text-white font-body font-medium text-sm px-4 py-2 rounded-lg shadow-sm transition-colors"
                  >
                    {genInProgress
                      ? `Generating... (${genResults.length}/${selectedGenPhilosophers.length})`
                      : `Generate for ${selectedGenPhilosophers.length} philosopher${selectedGenPhilosophers.length !== 1 ? "s" : ""}`
                    }
                  </button>

                  {genResults.filter(r => !r.success).map(r => (
                    <p key={r.philosopherId} className="text-xs text-red-600 mt-1">
                      {philosopherMeta[r.philosopherId]?.name}: {r.error}
                    </p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}
