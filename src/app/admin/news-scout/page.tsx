"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Spinner } from "@/components/Spinner";
import { formatDate } from "@/lib/date-utils";
import { safeJsonParse } from "@/lib/json-utils";
import { STANCE_CONFIG } from "@/lib/constants";
import type { Stance } from "@/lib/types";
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

interface PhilosopherMeta {
  name: string;
  initials: string;
  color: string;
}

interface ScoreDistributionBucket {
  label: string;
  count: number;
  segmentClass: string;
  badgeClass: string;
}

function scoreBadgeClasses(score: number | null): string {
  if (score === null) return "bg-gray-100 text-gray-600";
  if (score >= 80) {
    return "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300";
  }
  if (score >= 60) return "bg-green-100 text-green-800";
  if (score >= 40) return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-800";
}

function formatTensionLabel(tension: string): string {
  return tension.replace(/_/g, " ");
}

function getScoreDistribution(
  items: CandidateWithUsage[]
): ScoreDistributionBucket[] {
  const buckets: ScoreDistributionBucket[] = [
    {
      label: "0s",
      count: 0,
      segmentClass: "bg-red-200",
      badgeClass: "text-red-700",
    },
    {
      label: "1-39",
      count: 0,
      segmentClass: "bg-red-300",
      badgeClass: "text-red-700",
    },
    {
      label: "40-59",
      count: 0,
      segmentClass: "bg-yellow-300",
      badgeClass: "text-yellow-800",
    },
    {
      label: "60-79",
      count: 0,
      segmentClass: "bg-green-300",
      badgeClass: "text-green-800",
    },
    {
      label: "80+",
      count: 0,
      segmentClass: "bg-emerald-400",
      badgeClass: "text-emerald-800",
    },
  ];

  for (const item of items) {
    if (typeof item.score !== "number") continue;

    if (item.score === 0) buckets[0].count += 1;
    else if (item.score <= 39) buckets[1].count += 1;
    else if (item.score <= 59) buckets[2].count += 1;
    else if (item.score <= 79) buckets[3].count += 1;
    else buckets[4].count += 1;
  }

  return buckets;
}

const CATEGORIES = [
  "all",
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

const MIN_SCORES = [
  { label: "All scores", value: "" },
  { label: "40+", value: "40" },
  { label: "60+", value: "60" },
  { label: "80+", value: "80" },
];

const STATUS_TABS = ["scored", "approved", "dismissed", "all"] as const;

const STANCE_SHORT_LABELS: Record<Stance, string> = {
  challenges: "chall",
  defends: "def",
  reframes: "refrm",
  questions: "quest",
  warns: "warn",
  observes: "obs",
  diagnoses: "diag",
  provokes: "prov",
  laments: "lam",
};

export default function NewsScoutPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [candidates, setCandidates] = useState<CandidateWithUsage[]>([]);
  const [overviewCandidates, setOverviewCandidates] = useState<
    CandidateWithUsage[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineStatus, setPipelineStatus] = useState("");
  const [pipelineResult, setPipelineResult] = useState<{
    fetchResult?: FetchResult;
    scoreResult?: ScoreResult;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState("scored");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [minScoreFilter, setMinScoreFilter] = useState("60");

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [cleanupConfirm, setCleanupConfirm] = useState(false);
  const [cleanupRunning, setCleanupRunning] = useState(false);
  const [clearAllConfirm, setClearAllConfirm] = useState(false);
  const [clearAllRunning, setClearAllRunning] = useState(false);
  const [dangerMenuOpen, setDangerMenuOpen] = useState(false);

  const [philosopherMeta, setPhilosopherMeta] = useState<
    Record<string, PhilosopherMeta>
  >({});

  const [expandedDetailIds, setExpandedDetailIds] = useState<string[]>([]);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>(
    []
  );
  const [bulkStatusRunning, setBulkStatusRunning] = useState(false);

  const [generatePanelCandidate, setGeneratePanelCandidate] =
    useState<CandidateWithUsage | null>(null);
  const [selectedGenPhilosophers, setSelectedGenPhilosophers] = useState<
    string[]
  >([]);
  const [genResults, setGenResults] = useState<
    Array<{ philosopherId: string; success: boolean; error?: string }>
  >([]);
  const [genInProgress, setGenInProgress] = useState(false);

  const hasInitialized = useRef(false);

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
  }, [categoryFilter, minScoreFilter, statusFilter]);

  const fetchOverviewCandidates = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        status: "all",
        limit: "500",
      });
      const res = await fetch(`/api/admin/news-scout/candidates?${params}`);
      const data = await res.json();
      setOverviewCandidates(data);
    } catch {
      // overview is non-critical
    }
  }, []);

  const fetchPhilosophers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/philosophers");
      const data = (await res.json()) as Array<{
        id: string;
        name: string;
        initials: string;
        color: string;
      }>;

      const lookup: Record<string, PhilosopherMeta> = {};
      for (const philosopher of data) {
        lookup[philosopher.id] = {
          name: philosopher.name,
          initials: philosopher.initials,
          color: philosopher.color,
        };
      }
      setPhilosopherMeta(lookup);
    } catch (fetchError) {
      console.error("Failed to fetch philosophers:", fetchError);
    }
  }, []);

  const refreshLists = useCallback(async () => {
    await Promise.all([fetchStats(), fetchCandidates(), fetchOverviewCandidates()]);
  }, [fetchCandidates, fetchOverviewCandidates, fetchStats]);

  useEffect(() => {
    if (hasInitialized.current) return;

    Promise.all([
      fetchPhilosophers(),
      fetchStats(),
      fetchCandidates(),
      fetchOverviewCandidates(),
    ]).finally(() => {
      hasInitialized.current = true;
      setLoading(false);
    });
  }, [fetchCandidates, fetchOverviewCandidates, fetchPhilosophers, fetchStats]);

  useEffect(() => {
    if (!hasInitialized.current) return;

    setListLoading(true);
    fetchCandidates().finally(() => setListLoading(false));
  }, [fetchCandidates]);

  useEffect(() => {
    setSelectedCandidateIds((prev) =>
      prev.filter((id) => candidates.some((candidate) => candidate.id === id))
    );
  }, [candidates]);

  useEffect(() => {
    if (statusFilter !== "scored") {
      setSelectedCandidateIds([]);
    }
  }, [statusFilter]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setGeneratePanelCandidate(null);
        setDangerMenuOpen(false);
        setCleanupConfirm(false);
        setClearAllConfirm(false);
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

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
      await refreshLists();
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Pipeline failed");
    } finally {
      setPipelineRunning(false);
      setPipelineStatus("");
    }
  };

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

      await refreshLists();
      if (generatePanelCandidate?.id === id && newStatus !== "approved") {
        setGeneratePanelCandidate(null);
      }
    } catch {
      setError("Failed to update candidate status");
    }
  };

  const updateCandidateStatuses = async (
    ids: string[],
    newStatus: "approved" | "dismissed"
  ) => {
    if (ids.length === 0) return;

    setBulkStatusRunning(true);
    try {
      const res = await fetch("/api/admin/news-scout/candidates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, status: newStatus }),
      });

      if (!res.ok) throw new Error("Failed to update selection");

      setSelectedCandidateIds([]);
      await refreshLists();
      setPipelineStatus(
        `${newStatus === "approved" ? "Approved" : "Dismissed"} ${ids.length} articles`
      );
      setTimeout(() => setPipelineStatus(""), 4000);
    } catch {
      setError("Failed to update selected articles");
    } finally {
      setBulkStatusRunning(false);
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

      setConfirmDeleteId(null);
      await refreshLists();
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
      setDangerMenuOpen(false);
      setPipelineStatus(`Cleaned up ${data.deleted} old articles`);
      setTimeout(() => setPipelineStatus(""), 4000);
      await refreshLists();
    } catch {
      setError("Failed to clean up old articles. Please try again.");
    } finally {
      setCleanupRunning(false);
    }
  }

  async function handleClearAll() {
    setClearAllRunning(true);
    try {
      const res = await fetch("/api/admin/news-scout/candidates", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear_all" }),
      });

      if (!res.ok) throw new Error("Failed to clear all candidates");

      const data = await res.json();
      setClearAllConfirm(false);
      setDangerMenuOpen(false);
      setSelectedCandidateIds([]);
      setGeneratePanelCandidate(null);
      setPipelineStatus(`Cleared ${data.deleted} articles`);
      setTimeout(() => setPipelineStatus(""), 4000);
      await refreshLists();
    } catch {
      setError("Failed to clear all articles. Please try again.");
    } finally {
      setClearAllRunning(false);
    }
  }

  function openGeneratePanel(candidate: CandidateWithUsage) {
    const suggested = safeJsonParse<string[]>(candidate.suggested_philosophers, []);
    setGeneratePanelCandidate(candidate);
    setSelectedGenPhilosophers(
      suggested.filter((philosopherId) => philosopherId in philosopherMeta)
    );
    setGenResults([]);
  }

  function closeGeneratePanel() {
    if (genInProgress) return;
    setGeneratePanelCandidate(null);
    setGenResults([]);
  }

  async function handleBulkGenerate(candidate: CandidateWithUsage) {
    setGenInProgress(true);
    setGenResults([]);

    const sourceMaterial = `${candidate.title} - ${candidate.source_name}

${candidate.description}`;
    const validPhilosophers = selectedGenPhilosophers.filter(
      (philosopherId) => philosopherId in philosopherMeta
    );

    for (const philosopherId of validPhilosophers) {
      try {
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

        if (genData.log_entry?.id) {
          await fetch("/api/admin/content", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: genData.log_entry.id, status: "approved" }),
          });
        }

        setGenResults((prev) => [...prev, { philosopherId, success: true }]);
      } catch (generationError) {
        setGenResults((prev) => [
          ...prev,
          {
            philosopherId,
            success: false,
            error:
              generationError instanceof Error
                ? generationError.message
                : "Failed",
          },
        ]);
      }
    }

    setGenInProgress(false);
    await refreshLists();
  }

  function toggleDetailRow(candidateId: string) {
    setExpandedDetailIds((prev) =>
      prev.includes(candidateId)
        ? prev.filter((id) => id !== candidateId)
        : [...prev, candidateId]
    );
  }

  function toggleCandidateSelection(candidateId: string) {
    setSelectedCandidateIds((prev) =>
      prev.includes(candidateId)
        ? prev.filter((id) => id !== candidateId)
        : [...prev, candidateId]
    );
  }

  function toggleSelectAllOnPage() {
    const visibleIds = candidates.map((candidate) => candidate.id);
    const allSelected =
      visibleIds.length > 0 &&
      visibleIds.every((candidateId) => selectedCandidateIds.includes(candidateId));

    setSelectedCandidateIds(allSelected ? [] : visibleIds);
  }

  const scoreDistribution = getScoreDistribution(overviewCandidates);
  const totalScoredArticles = scoreDistribution.reduce(
    (sum, bucket) => sum + bucket.count,
    0
  );
  const tabCounts = {
    scored: stats?.scored ?? 0,
    approved: stats?.approved ?? 0,
    dismissed: stats?.dismissed ?? 0,
    all: stats?.total ?? 0,
  };
  const allSelectedOnPage =
    candidates.length > 0 &&
    candidates.every((candidate) => selectedCandidateIds.includes(candidate.id));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="h-6 w-6 text-terracotta" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-8 pb-24">
        <div>
          <h1 className="font-serif text-2xl font-bold text-ink">News Scout</h1>
          <p className="mt-1 text-sm font-body text-ink-light">
            Discover and score articles for philosophical potential
          </p>
        </div>

        {error && (
          <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-3 text-red-600 hover:text-red-800"
            >
              x
            </button>
          </div>
        )}

        {pipelineResult && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {pipelineResult.fetchResult && (
              <p>
                Fetched {pipelineResult.fetchResult.sourcesChecked} sources -&gt;{" "}
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

        <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
          {[
            {
              label: "Total",
              value: stats?.total ?? 0,
              shell: "border-l-4 border-l-border bg-white",
            },
            {
              label: "Unscored",
              value: stats?.new ?? 0,
              shell: "border-l-4 border-l-amber-300 bg-amber-50/60",
            },
            {
              label: "Scored",
              value: stats?.scored ?? 0,
              shell: "border-l-4 border-l-blue-300 bg-blue-50/60",
            },
            {
              label: "Approved",
              value: stats?.approved ?? 0,
              shell: "border-l-4 border-l-green-300 bg-green-50/60",
            },
          ].map((card) => (
            <div
              key={card.label}
              className={`rounded-xl border border-border px-6 py-5 shadow-sm ${card.shell}`}
            >
              <span className="text-xs font-mono uppercase tracking-wider text-ink-lighter">
                {card.label}
              </span>
              <p className="mt-2 font-serif text-3xl font-bold text-ink">
                {card.value}
              </p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-border bg-white shadow-sm">
          <div className="border-b border-border px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-ink-lighter">
                  Score Distribution
                </p>
                <p className="mt-1 text-sm font-body text-ink-light">
                  Instant read on how many candidates are actually worth reviewing.
                </p>
              </div>
              <span className="text-xs font-mono text-ink-lighter">
                {totalScoredArticles} scored articles
              </span>
            </div>
          </div>
          <div className="px-6 py-5">
            <div className="h-3 overflow-hidden rounded-full bg-parchment-dark/40">
              <div className="flex h-full w-full">
                {scoreDistribution.map((bucket) => (
                  <div
                    key={bucket.label}
                    className={bucket.segmentClass}
                    style={{
                      width:
                        totalScoredArticles === 0
                          ? "0%"
                          : `${(bucket.count / totalScoredArticles) * 100}%`,
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              {scoreDistribution.map((bucket) => (
                <div
                  key={bucket.label}
                  className="inline-flex items-center gap-2 rounded-full bg-parchment px-3 py-1 text-xs font-mono"
                >
                  <span className={`font-semibold ${bucket.badgeClass}`}>
                    {bucket.label}
                  </span>
                  <span className="text-ink-lighter">{bucket.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative overflow-visible rounded-xl border border-border bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-3 px-6 py-5">
            <div className="inline-flex overflow-hidden rounded-xl border border-border">
              <button
                onClick={() => runPipeline("fetch_and_score")}
                disabled={pipelineRunning}
                className="inline-flex items-center gap-2 bg-terracotta px-5 py-2.5 text-sm font-body text-white transition-colors hover:bg-terracotta-light disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pipelineRunning ? (
                  <>
                    <Spinner className="h-4 w-4" />
                    <span>{pipelineStatus}</span>
                  </>
                ) : (
                  "Fetch & Score"
                )}
              </button>
              <button
                onClick={() => runPipeline("fetch")}
                disabled={pipelineRunning}
                className="border-l border-border bg-parchment px-4 py-2.5 text-sm font-body text-ink-light transition-colors hover:bg-parchment-dark hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
              >
                Fetch Only
              </button>
              <button
                onClick={() => runPipeline("score")}
                disabled={pipelineRunning}
                className="border-l border-border bg-parchment px-4 py-2.5 text-sm font-body text-ink-light transition-colors hover:bg-parchment-dark hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
              >
                Score Only
              </button>
            </div>

            <div className="relative">
              <button
                onClick={() => {
                  setDangerMenuOpen((prev) => !prev);
                  if (dangerMenuOpen) {
                    setCleanupConfirm(false);
                    setClearAllConfirm(false);
                  }
                }}
                className="rounded-lg border border-border px-3 py-2 text-sm font-mono text-ink-lighter transition-colors hover:bg-parchment-dark/50 hover:text-ink"
              >
                ...
              </button>

              {dangerMenuOpen && (
                <div className="absolute left-0 top-[calc(100%+0.5rem)] z-30 min-w-[280px] rounded-xl border border-border bg-white p-3 shadow-lg">
                  {cleanupConfirm ? (
                    <div className="space-y-3">
                      <p className="text-xs font-mono text-ink-lighter">
                        Delete old dismissed/new articles?
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleCleanup}
                          disabled={cleanupRunning}
                          className="inline-flex items-center gap-1 rounded-full bg-red-600 px-3.5 py-1.5 text-xs font-mono tracking-wide text-white transition-all duration-200 hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {cleanupRunning ? (
                            <span className="flex items-center gap-1">
                              <span className="h-3 w-3 animate-spin rounded-full border border-white/40 border-t-white" />
                              Cleaning
                            </span>
                          ) : (
                            "Confirm"
                          )}
                        </button>
                        <button
                          onClick={() => setCleanupConfirm(false)}
                          className="inline-flex items-center rounded-full border border-border-light px-3.5 py-1.5 text-xs font-mono tracking-wide text-ink-lighter transition-all duration-200 hover:bg-parchment-dark/50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : clearAllConfirm ? (
                    <div className="space-y-3">
                      <p className="text-xs font-mono text-red-600">
                        Delete ALL {stats?.total ?? ""} articles?
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleClearAll}
                          disabled={clearAllRunning}
                          className="inline-flex items-center gap-1 rounded-full bg-red-600 px-3.5 py-1.5 text-xs font-mono tracking-wide text-white transition-all duration-200 hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {clearAllRunning ? (
                            <span className="flex items-center gap-1">
                              <span className="h-3 w-3 animate-spin rounded-full border border-white/40 border-t-white" />
                              Clearing
                            </span>
                          ) : (
                            "Yes, clear all"
                          )}
                        </button>
                        <button
                          onClick={() => setClearAllConfirm(false)}
                          className="inline-flex items-center rounded-full border border-border-light px-3.5 py-1.5 text-xs font-mono tracking-wide text-ink-lighter transition-all duration-200 hover:bg-parchment-dark/50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <button
                        onClick={() => {
                          setCleanupConfirm(true);
                          setClearAllConfirm(false);
                        }}
                        className="w-full rounded-lg px-3 py-2 text-left text-sm font-body text-ink-light transition-colors hover:bg-parchment-dark hover:text-ink"
                      >
                        Clean up old
                      </button>
                      <button
                        onClick={() => {
                          setClearAllConfirm(true);
                          setCleanupConfirm(false);
                        }}
                        className="w-full rounded-lg px-3 py-2 text-left text-sm font-body text-red-600 transition-colors hover:bg-red-50"
                      >
                        Clear all
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <Link
              href="/admin/scoring"
              className="ml-auto text-xs font-mono text-terracotta transition-colors hover:text-terracotta-light"
            >
              Scoring Settings -&gt;
            </Link>

            <Link
              href="/admin/news-scout/sources"
              className="text-xs font-mono text-terracotta transition-colors hover:text-terracotta-light"
            >
              Manage RSS Sources -&gt;
            </Link>
          </div>
        </div>

        <div className="sticky top-0 z-10 rounded-xl border border-border bg-white shadow-sm">
          <div className="space-y-4 px-6 py-5">
            <div className="flex flex-wrap gap-1">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`rounded-lg px-5 py-2.5 text-sm font-body capitalize transition-colors ${
                    statusFilter === tab
                      ? "bg-terracotta/10 font-medium text-terracotta ring-1 ring-terracotta/30"
                      : "text-ink-light hover:bg-parchment-dark hover:text-ink"
                  }`}
                >
                  {tab} ({tabCounts[tab]})
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="rounded-lg border border-border bg-parchment px-4 py-2.5 text-sm font-body text-ink transition-colors focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/40"
              >
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category === "all"
                      ? "All categories"
                      : category.charAt(0).toUpperCase() + category.slice(1)}
                  </option>
                ))}
              </select>

              <select
                value={minScoreFilter}
                onChange={(event) => setMinScoreFilter(event.target.value)}
                className="rounded-lg border border-border bg-parchment px-4 py-2.5 text-sm font-body text-ink transition-colors focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/40"
              >
                {MIN_SCORES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              {listLoading && (
                <span className="inline-flex items-center gap-2 text-xs font-mono text-ink-lighter">
                  <Spinner className="h-3.5 w-3.5 text-terracotta" />
                  Refreshing
                </span>
              )}
            </div>
          </div>
        </div>

        {statusFilter === "approved" && candidates.length > 0 && (
          <div className="mb-2 px-1 text-xs font-mono text-ink-lighter">
            {
              candidates.filter(
                (candidate) => (candidate.published_posts?.length || 0) > 0
              ).length
            }{" "}
            of {candidates.length} approved articles have posts
          </div>
        )}

        <div className="space-y-4">
          {candidates.length === 0 && (
            <div className="rounded-xl border border-border bg-white px-6 py-12 text-center">
              <p className="text-sm font-body text-ink-lighter">
                No candidates found. Try adjusting your filters or running the
                pipeline.
              </p>
            </div>
          )}

          {statusFilter === "scored"
            ? candidates.map((candidate) => {
                const philosophers = safeJsonParse<string[]>(
                  candidate.suggested_philosophers,
                  []
                );
                const stances = safeJsonParse<Record<string, string>>(
                  candidate.suggested_stances,
                  {}
                );
                const tensions = safeJsonParse<string[]>(
                  candidate.primary_tensions,
                  []
                );
                const expanded = expandedDetailIds.includes(candidate.id);
                const selected = selectedCandidateIds.includes(candidate.id);

                return (
                  <div
                    key={candidate.id}
                    className="overflow-hidden rounded-xl border border-border bg-white shadow-sm"
                  >
                    <div className="px-4 py-3 sm:px-5">
                      <div className="flex flex-col gap-3 xl:grid xl:grid-cols-[auto_auto_minmax(0,2.7fr)_minmax(180px,1.2fr)_minmax(120px,0.9fr)_auto_auto] xl:items-center">
                        <label className="flex items-center justify-center pt-1 xl:pt-0">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleCandidateSelection(candidate.id)}
                            className="h-4 w-4 rounded border-border text-terracotta focus:ring-terracotta/40"
                          />
                        </label>

                        <span
                          className={`inline-flex h-10 w-10 items-center justify-center rounded-lg text-sm font-mono font-bold ${scoreBadgeClasses(
                            candidate.score
                          )}`}
                        >
                          {candidate.score ?? "--"}
                        </span>

                        <div className="min-w-0">
                          <a
                            href={candidate.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block truncate font-serif text-base font-bold text-ink transition-colors hover:text-terracotta"
                            title={candidate.title}
                          >
                            {candidate.title}
                          </a>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-mono text-ink-lighter">
                            <span>{candidate.source_name}</span>
                            <span className="rounded-full bg-parchment-dark/40 px-2.5 py-0.5 uppercase tracking-wider">
                              {candidate.source_category}
                            </span>
                            {candidate.pub_date && (
                              <span>{formatDate(candidate.pub_date)}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {philosophers.map((philosopherId) => {
                            const meta = philosopherMeta[philosopherId];
                            const stance = stances[philosopherId] as
                              | Stance
                              | undefined;
                            const stanceStyle = stance
                              ? STANCE_CONFIG[stance]
                              : undefined;

                            return (
                              <div
                                key={philosopherId}
                                className="flex min-w-[40px] flex-col items-center"
                                title={meta?.name || philosopherId}
                              >
                                <span
                                  className="flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-serif font-bold text-white"
                                  style={{
                                    backgroundColor: meta?.color || "#666",
                                  }}
                                >
                                  {meta?.initials ||
                                    philosopherId.slice(0, 2).toUpperCase()}
                                </span>
                                {stance && stanceStyle && (
                                  <span
                                    className="mt-1 text-[9px] font-mono uppercase tracking-wide"
                                    style={{ color: stanceStyle.color }}
                                  >
                                    {STANCE_SHORT_LABELS[stance]}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          {tensions.slice(0, 2).map((tension) => (
                            <span
                              key={tension}
                              className="rounded-full bg-parchment-dark/30 px-2.5 py-0.5 text-[11px] font-mono text-ink-lighter"
                            >
                              {formatTensionLabel(tension)}
                            </span>
                          ))}
                          {tensions.length > 2 && (
                            <span className="rounded-full bg-parchment-dark/20 px-2.5 py-0.5 text-[11px] font-mono text-ink-lighter">
                              +{tensions.length - 2}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 xl:justify-end">
                          <button
                            onClick={() =>
                              updateCandidateStatus(candidate.id, "approved")
                            }
                            className="rounded-full bg-green-700 px-3.5 py-1.5 text-xs font-body text-white transition-colors hover:bg-green-800"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() =>
                              updateCandidateStatus(candidate.id, "dismissed")
                            }
                            className="rounded-full bg-parchment-dark px-3.5 py-1.5 text-xs font-body text-ink-light transition-colors hover:bg-parchment-dark/80"
                          >
                            Dismiss
                          </button>
                        </div>

                        <button
                          onClick={() => toggleDetailRow(candidate.id)}
                          className="flex h-9 w-9 items-center justify-center rounded-full text-ink-lighter transition-colors hover:bg-parchment-dark/60 hover:text-ink"
                          aria-label={expanded ? "Collapse details" : "Expand details"}
                        >
                          {expanded ? "^" : "v"}
                        </button>
                      </div>
                    </div>

                    {expanded && (
                      <div className="border-t border-border bg-parchment-dark/10 px-5 py-4">
                        {candidate.philosophical_entry_point && (
                          <p className="text-sm font-body italic text-ink-light">
                            {candidate.philosophical_entry_point}
                          </p>
                        )}
                        {candidate.score_reasoning && (
                          <p className="mt-3 border-l-2 border-border pl-3 text-sm font-body text-ink-light">
                            {candidate.score_reasoning}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            : candidates.map((candidate) => {
                const philosophers = safeJsonParse<string[]>(
                  candidate.suggested_philosophers,
                  []
                );
                const stances = safeJsonParse<Record<string, string>>(
                  candidate.suggested_stances,
                  {}
                );
                const tensions = safeJsonParse<string[]>(
                  candidate.primary_tensions,
                  []
                );
                const isApproved = candidate.status === "approved";
                const isDismissed = candidate.status === "dismissed";

                return (
                  <div
                    key={candidate.id}
                    className={`overflow-hidden rounded-xl border shadow-sm transition-colors ${
                      isApproved
                        ? "border-green-300 bg-green-50/30"
                        : isDismissed
                        ? "border-border bg-white opacity-60"
                        : "border-border bg-white"
                    }`}
                  >
                    <div className="px-6 py-5">
                      <div className="flex flex-col gap-5 lg:flex-row">
                        {(() => {
                          const displayImage =
                            candidate.image_url || candidate.source_logo_url;
                          const isLogo =
                            !candidate.image_url && !!candidate.source_logo_url;

                          if (!displayImage) return null;

                          return (
                            <div
                              className={`shrink-0 overflow-hidden rounded-lg ${
                                isLogo
                                  ? "flex h-12 w-12 items-center justify-center bg-parchment-dark/20"
                                  : "h-16 w-20"
                              }`}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={displayImage}
                                alt=""
                                className={
                                  isLogo
                                    ? "h-8 w-8 object-contain"
                                    : "h-full w-full object-cover"
                                }
                                onError={(event) => {
                                  (
                                    event.target as HTMLImageElement
                                  ).style.display = "none";
                                }}
                              />
                            </div>
                          );
                        })()}

                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex items-start gap-3">
                            <span
                              className={`inline-flex h-7 w-10 shrink-0 items-center justify-center rounded-md text-xs font-mono font-bold ${scoreBadgeClasses(
                                candidate.score
                              )}`}
                            >
                              {candidate.score ?? "--"}
                            </span>

                            <a
                              href={candidate.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="line-clamp-2 font-serif text-sm font-bold leading-snug text-ink transition-colors hover:text-terracotta"
                            >
                              {candidate.title}
                            </a>
                          </div>

                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <span className="text-xs font-mono text-ink-lighter">
                              {candidate.source_name}
                            </span>
                            <span className="inline-block rounded-full bg-parchment-dark/40 px-2.5 py-0.5 text-[11px] font-mono uppercase tracking-wider text-ink-lighter">
                              {candidate.source_category}
                            </span>
                            {candidate.pub_date && (
                              <span className="text-xs font-mono text-ink-lighter">
                                {formatDate(candidate.pub_date)}
                              </span>
                            )}
                          </div>

                          {philosophers.length > 0 && (
                            <div className="mb-3 flex flex-wrap items-center gap-2">
                              {philosophers.map((philosopherId) => {
                                const meta = philosopherMeta[philosopherId];
                                const stance = stances[philosopherId] as
                                  | Stance
                                  | undefined;
                                const stanceStyle = stance
                                  ? STANCE_CONFIG[stance]
                                  : null;

                                return (
                                  <div
                                    key={philosopherId}
                                    className="flex items-center gap-1"
                                  >
                                    <span
                                      className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-serif font-bold text-white"
                                      style={{
                                        backgroundColor: meta?.color || "#666",
                                      }}
                                      title={meta?.name || philosopherId}
                                    >
                                      {meta?.initials ||
                                        philosopherId.slice(0, 2).toUpperCase()}
                                    </span>
                                    {stanceStyle && stance && (
                                      <span
                                        className="rounded-full px-2 py-0.5 text-[11px] font-mono"
                                        style={{
                                          backgroundColor: stanceStyle.bg,
                                          color: stanceStyle.color,
                                          border: `1px solid ${stanceStyle.border}`,
                                        }}
                                      >
                                        {STANCE_CONFIG[stance].label}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {candidate.philosophical_entry_point && (
                            <p className="mb-2 text-sm font-body italic text-ink-light">
                              {candidate.philosophical_entry_point}
                            </p>
                          )}

                          {tensions.length > 0 && (
                            <div className="mb-2 flex flex-wrap items-center gap-1.5">
                              {tensions.map((tension) => (
                                <span
                                  key={tension}
                                  className="rounded-full bg-parchment-dark/30 px-2.5 py-0.5 text-[11px] font-mono text-ink-lighter"
                                >
                                  {formatTensionLabel(tension)}
                                </span>
                              ))}
                            </div>
                          )}

                          {isApproved &&
                            (() => {
                              const posts = candidate.published_posts || [];
                              const postedPhilosopherIds = new Set(
                                posts.map((post) => post.philosopher_id)
                              );
                              const unusedPhilosophers = philosophers.filter(
                                (philosopherId) =>
                                  !postedPhilosopherIds.has(philosopherId)
                              );

                              if (
                                posts.length > 0 &&
                                unusedPhilosophers.length === 0
                              ) {
                                return (
                                  <div className="mt-2 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-2.5 py-1.5">
                                    <span className="text-[11px] font-mono text-green-700">
                                      Approved: {posts.length} post
                                      {posts.length !== 1 ? "s" : ""} generated
                                    </span>
                                    <div className="flex items-center gap-1">
                                      {posts.map((post) => {
                                        const meta =
                                          philosopherMeta[post.philosopher_id];

                                        return meta ? (
                                          <span
                                            key={post.post_id}
                                            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold text-white"
                                            style={{
                                              backgroundColor: meta.color,
                                            }}
                                            title={`${meta.name} - ${post.status}`}
                                          >
                                            {meta.initials}
                                          </span>
                                        ) : null;
                                      })}
                                    </div>
                                  </div>
                                );
                              }

                              if (posts.length > 0) {
                                return (
                                  <div className="mt-2 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5">
                                    <span className="text-[11px] font-mono text-amber-700">
                                      {posts.length}/{philosophers.length} posts
                                    </span>
                                    <div className="flex items-center gap-1">
                                      {posts.map((post) => {
                                        const meta =
                                          philosopherMeta[post.philosopher_id];

                                        return meta ? (
                                          <span
                                            key={post.post_id}
                                            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold text-white"
                                            style={{
                                              backgroundColor: meta.color,
                                            }}
                                            title={`${meta.name} - ${post.status}`}
                                          >
                                            {meta.initials}
                                          </span>
                                        ) : null;
                                      })}
                                      {unusedPhilosophers.map((philosopherId) => {
                                        const meta =
                                          philosopherMeta[philosopherId];

                                        return meta ? (
                                          <span
                                            key={philosopherId}
                                            className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-dashed text-[9px] font-bold opacity-40"
                                            style={{
                                              borderColor: meta.color,
                                              color: meta.color,
                                            }}
                                            title={`${meta.name} - not yet generated`}
                                          >
                                            {meta.initials}
                                          </span>
                                        ) : null;
                                      })}
                                    </div>
                                  </div>
                                );
                              }

                              return (
                                <div className="mt-2 flex items-center gap-2 rounded-lg border border-border-light bg-parchment-dark/20 px-2.5 py-1.5">
                                  <span className="text-[11px] font-mono text-ink-lighter">
                                    No posts generated
                                  </span>
                                </div>
                              );
                            })()}

                          {candidate.score_reasoning && (
                            <details className="mb-2">
                              <summary className="cursor-pointer text-xs font-mono text-ink-lighter hover:text-ink-light">
                                Scoring reasoning
                              </summary>
                              <p className="mt-1 border-l-2 border-border pl-2 text-sm font-body text-ink-light">
                                {candidate.score_reasoning}
                              </p>
                            </details>
                          )}
                        </div>

                        <div className="flex shrink-0 flex-col gap-3">
                          {candidate.status === "scored" && (
                            <>
                              <button
                                onClick={() =>
                                  updateCandidateStatus(candidate.id, "approved")
                                }
                                className="rounded-full bg-green-700 px-4 py-2 text-xs font-body text-white transition-colors hover:bg-green-800"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() =>
                                  updateCandidateStatus(candidate.id, "dismissed")
                                }
                                className="rounded-full bg-parchment-dark px-4 py-2 text-xs font-body text-ink-light transition-colors hover:bg-parchment-dark/80"
                              >
                                Dismiss
                              </button>
                            </>
                          )}

                          {isApproved && (
                            <>
                              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                                Approved
                              </span>
                              <button
                                onClick={() => openGeneratePanel(candidate)}
                                className="rounded-full border border-terracotta/20 bg-terracotta/5 px-3 py-1.5 text-xs font-mono text-terracotta transition-colors hover:bg-terracotta/10 hover:text-terracotta-light"
                              >
                                Generate -&gt;
                              </button>
                              <button
                                onClick={() =>
                                  updateCandidateStatus(candidate.id, "scored")
                                }
                                className="text-[11px] font-mono text-ink-lighter transition-colors hover:text-ink-light"
                              >
                                Undo
                              </button>
                            </>
                          )}

                          {isDismissed && (
                            <>
                              <span className="inline-flex items-center gap-1 rounded-full bg-parchment-dark/30 px-2.5 py-1 text-xs font-medium text-ink-lighter">
                                Dismissed
                              </span>
                              <button
                                onClick={() =>
                                  updateCandidateStatus(candidate.id, "scored")
                                }
                                className="text-[11px] font-mono text-ink-lighter transition-colors hover:text-ink-light"
                              >
                                Undo
                              </button>
                              {confirmDeleteId === candidate.id ? (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() =>
                                      handleDeleteCandidate(candidate.id)
                                    }
                                    disabled={deletingId === candidate.id}
                                    className="inline-flex items-center gap-1 rounded-full bg-red-600 px-3 py-1 text-[11px] font-mono tracking-wide text-white transition-all duration-200 hover:bg-red-700 disabled:opacity-50"
                                  >
                                    {deletingId === candidate.id
                                      ? "..."
                                      : "Delete"}
                                  </button>
                                  <button
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="text-[11px] font-mono text-ink-lighter transition-colors hover:text-ink-light"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setConfirmDeleteId(candidate.id)}
                                  className="text-[11px] font-mono text-red-400 transition-colors hover:text-red-600"
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
                  </div>
                );
              })}
        </div>
      </div>

      {selectedCandidateIds.length > 0 && statusFilter === "scored" && (
        <div className="fixed inset-x-0 bottom-4 z-30 flex justify-center px-4">
          <div className="flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-white px-5 py-4 shadow-xl">
            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={() =>
                  updateCandidateStatuses(selectedCandidateIds, "approved")
                }
                disabled={bulkStatusRunning}
                className="rounded-full bg-green-700 px-4 py-2 text-sm font-body text-white transition-colors hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Approve {selectedCandidateIds.length} selected
              </button>
              <button
                onClick={() =>
                  updateCandidateStatuses(selectedCandidateIds, "dismissed")
                }
                disabled={bulkStatusRunning}
                className="rounded-full bg-red-600 px-4 py-2 text-sm font-body text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Dismiss {selectedCandidateIds.length} selected
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm">
              <label className="flex items-center gap-2 font-mono text-ink-lighter">
                <input
                  type="checkbox"
                  checked={allSelectedOnPage}
                  onChange={toggleSelectAllOnPage}
                  className="h-4 w-4 rounded border-border text-terracotta focus:ring-terracotta/40"
                />
                Select all on page
              </label>
              <button
                onClick={() => setSelectedCandidateIds([])}
                className="text-sm font-mono text-terracotta transition-colors hover:text-terracotta-light"
              >
                Clear selection
              </button>
            </div>
          </div>
        </div>
      )}

      {generatePanelCandidate && (
        <div className="fixed inset-0 z-40">
          <button
            onClick={closeGeneratePanel}
            className="absolute inset-0 bg-black/40"
            aria-label="Close generate panel"
          />

          <div className="absolute right-0 top-0 z-50 flex h-screen w-full max-w-xl flex-col border-l border-border bg-parchment shadow-2xl">
            <div className="border-b border-border bg-parchment-dark/40 px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-ink-lighter">
                    Generate Reactions
                  </p>
                  <h2 className="mt-2 font-serif text-xl font-bold text-ink">
                    {generatePanelCandidate.title}
                  </h2>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-mono text-ink-lighter">
                    <span>{generatePanelCandidate.source_name}</span>
                    <span className="rounded-full bg-white/70 px-2 py-0.5 uppercase tracking-wider">
                      {generatePanelCandidate.source_category}
                    </span>
                    {generatePanelCandidate.pub_date && (
                      <span>{formatDate(generatePanelCandidate.pub_date)}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={closeGeneratePanel}
                  className="rounded-full border border-border bg-white/70 px-3 py-1 text-sm font-mono text-ink-lighter transition-colors hover:bg-white hover:text-ink"
                >
                  X
                </button>
              </div>

              {generatePanelCandidate.philosophical_entry_point && (
                <p className="mt-4 text-sm font-body italic text-ink-light">
                  {generatePanelCandidate.philosophical_entry_point}
                </p>
              )}
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
              <div>
                <p className="mb-2 text-[11px] font-mono uppercase tracking-[0.2em] text-ink-lighter">
                  Suggested Philosophers
                </p>
                <div className="flex flex-wrap gap-2">
                  {safeJsonParse<string[]>(
                    generatePanelCandidate.suggested_philosophers,
                    []
                  ).map((philosopherId) => {
                    const meta = philosopherMeta[philosopherId];
                    const stance = safeJsonParse<Record<string, string>>(
                      generatePanelCandidate.suggested_stances,
                      {}
                    )[philosopherId] as Stance | undefined;
                    const stanceStyle = stance
                      ? STANCE_CONFIG[stance]
                      : undefined;

                    if (!meta) return null;

                    return (
                      <div
                        key={philosopherId}
                        className="flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1.5"
                      >
                        <span
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-serif font-bold text-white"
                          style={{ backgroundColor: meta.color }}
                        >
                          {meta.initials}
                        </span>
                        <span className="text-sm font-body text-ink">
                          {meta.name}
                        </span>
                        {stance && stanceStyle && (
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide"
                            style={{
                              backgroundColor: stanceStyle.bg,
                              color: stanceStyle.color,
                              border: `1px solid ${stanceStyle.border}`,
                            }}
                          >
                            {STANCE_CONFIG[stance].label}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-mono uppercase tracking-[0.2em] text-ink-lighter">
                  Philosopher Selection
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {Object.entries(philosopherMeta).map(([philosopherId, meta]) => {
                    const isSelected =
                      selectedGenPhilosophers.includes(philosopherId);
                    const result = genResults.find(
                      (entry) => entry.philosopherId === philosopherId
                    );
                    const suggestedStance = safeJsonParse<Record<string, string>>(
                      generatePanelCandidate.suggested_stances,
                      {}
                    )[philosopherId] as Stance | undefined;
                    const stanceStyle = suggestedStance
                      ? STANCE_CONFIG[suggestedStance]
                      : undefined;

                    return (
                      <button
                        key={philosopherId}
                        onClick={() => {
                          if (genInProgress) return;
                          setSelectedGenPhilosophers((prev) =>
                            isSelected
                              ? prev.filter((id) => id !== philosopherId)
                              : [...prev, philosopherId]
                          );
                        }}
                        disabled={genInProgress}
                        className={`rounded-xl border px-3 py-3 text-left transition-all ${
                          isSelected
                            ? "border-terracotta bg-white shadow-sm"
                            : "border-border bg-white/70 hover:bg-white"
                        } ${genInProgress ? "cursor-not-allowed opacity-70" : ""}`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-xs font-serif font-bold text-white"
                            style={{ backgroundColor: meta.color }}
                          >
                            {meta.initials}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-body font-semibold text-ink">
                              {meta.name}
                            </p>
                            {suggestedStance && stanceStyle && (
                              <span
                                className="mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide"
                                style={{
                                  backgroundColor: stanceStyle.bg,
                                  color: stanceStyle.color,
                                  border: `1px solid ${stanceStyle.border}`,
                                }}
                              >
                                {STANCE_CONFIG[suggestedStance].label}
                              </span>
                            )}
                          </div>
                          {result?.success === true && (
                            <span className="text-xs font-mono text-green-700">
                              OK
                            </span>
                          )}
                          {result?.success === false && (
                            <span className="text-xs font-mono text-red-600">
                              ERR
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {genResults.filter((entry) => !entry.success).length > 0 && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                  {genResults
                    .filter((entry) => !entry.success)
                    .map((entry) => (
                      <p
                        key={entry.philosopherId}
                        className="text-xs text-red-700"
                      >
                        {philosopherMeta[entry.philosopherId]?.name}: {entry.error}
                      </p>
                    ))}
                </div>
              )}
            </div>

            <div className="border-t border-border bg-white/80 px-6 py-4">
              <button
                onClick={() => handleBulkGenerate(generatePanelCandidate)}
                disabled={
                  genInProgress || selectedGenPhilosophers.length === 0
                }
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-terracotta px-4 py-3 text-sm font-body font-medium text-white shadow-sm transition-colors hover:bg-terracotta-light disabled:cursor-not-allowed disabled:opacity-50"
              >
                {genInProgress
                  ? `Generating... (${genResults.length}/${selectedGenPhilosophers.length})`
                  : `Generate for ${selectedGenPhilosophers.length} philosopher${
                      selectedGenPhilosophers.length !== 1 ? "s" : ""
                    }`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
