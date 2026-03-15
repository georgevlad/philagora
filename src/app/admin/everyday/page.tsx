"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Spinner } from "@/components/Spinner";
import { STANCE_CONFIG } from "@/lib/constants";
import type { Stance } from "@/lib/types";

type TargetLength = "short" | "medium" | "long";
type ResultState = "generating" | "draft" | "approved" | "published" | "rejected" | "failed";
type PendingAction = "approve" | "reject" | "publish" | null;

interface PhilosopherOption {
  id: string;
  name: string;
  color: string;
  initials: string;
  is_active?: number;
}

interface EverydayPostRow {
  id: string;
  philosopher_id: string;
  philosopher_name: string;
  philosopher_color: string;
  philosopher_initials: string;
  thesis: string;
  content: string;
  stance: Stance;
  tag: string;
  status: "draft" | "approved" | "published" | "archived";
  citation_title: string | null;
  citation_source: string | null;
  source_type: string | null;
  created_at: string;
}

interface EverydayGenerationResponse {
  success: true;
  scenario: string;
  generated: Array<{
    philosopher_id: string;
    philosopher_name: string;
    post_id?: string;
    generation_log_id?: number;
    content?: string;
    thesis?: string;
    stance?: Stance;
    tag?: string;
    error?: string;
  }>;
  errors: string[];
}

interface ResultCard {
  philosopherId: string;
  philosopherName: string;
  philosopherColor: string;
  philosopherInitials: string;
  generationLogId?: number;
  postId?: string;
  content?: string;
  thesis?: string;
  stance?: Stance;
  tag?: string;
  state: ResultState;
  pendingAction: PendingAction;
  error?: string;
}

const LENGTH_OPTIONS: Array<{ value: TargetLength; label: string }> = [
  { value: "short", label: "Short" },
  { value: "medium", label: "Medium" },
  { value: "long", label: "Long" },
];

function formatDateTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function getStateTone(state: ResultState) {
  switch (state) {
    case "approved":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "published":
      return "bg-green-100 text-green-800 border-green-200";
    case "rejected":
    case "failed":
      return "bg-red-100 text-red-800 border-red-200";
    case "generating":
      return "bg-amber-100 text-amber-800 border-amber-200";
    default:
      return "bg-parchment-dark text-ink-lighter border-border-light";
  }
}

function getStateLabel(state: ResultState) {
  switch (state) {
    case "approved":
      return "Approved";
    case "published":
      return "Published";
    case "rejected":
      return "Rejected";
    case "failed":
      return "Failed";
    case "generating":
      return "Generating";
    default:
      return "Draft";
  }
}

export default function EverydayPage() {
  const [philosophers, setPhilosophers] = useState<PhilosopherOption[]>([]);
  const [recentPosts, setRecentPosts] = useState<EverydayPostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [scenario, setScenario] = useState("");
  const [selectedPhilosopherIds, setSelectedPhilosopherIds] = useState<string[]>([]);
  const [targetLength, setTargetLength] = useState<TargetLength>("short");
  const [results, setResults] = useState<ResultCard[]>([]);
  const [resultsScenario, setResultsScenario] = useState("");
  const [generating, setGenerating] = useState(false);
  const [currentGeneratingIndex, setCurrentGeneratingIndex] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const philosopherMap = useMemo(
    () => new Map(philosophers.map((philosopher) => [philosopher.id, philosopher])),
    [philosophers]
  );

  const currentGeneratingName = generating
    ? philosopherMap.get(selectedPhilosopherIds[currentGeneratingIndex] ?? "")?.name ?? null
    : null;

  const recentGroups = useMemo(() => {
    const groups = new Map<string, EverydayPostRow[]>();

    for (const post of recentPosts) {
      const scenarioKey = post.citation_title?.trim() || "(Untitled scenario)";
      const existing = groups.get(scenarioKey) ?? [];
      existing.push(post);
      groups.set(scenarioKey, existing);
    }

    return [...groups.entries()]
      .map(([groupScenario, posts]) => ({
        scenario: groupScenario,
        posts,
        latestCreatedAt: posts[0]?.created_at ?? "",
      }))
      .sort((left, right) => right.latestCreatedAt.localeCompare(left.latestCreatedAt));
  }, [recentPosts]);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      setLoading(true);
      setPageError(null);

      try {
        const [philosopherResponse, recentResponse] = await Promise.all([
          fetch("/api/admin/philosophers"),
          fetch("/api/admin/posts?source_type=everyday&limit=10"),
        ]);

        if (!philosopherResponse.ok) {
          throw new Error("Failed to load philosophers.");
        }
        if (!recentResponse.ok) {
          throw new Error("Failed to load recent everyday posts.");
        }

        const philosopherData = (await philosopherResponse.json()) as PhilosopherOption[];
        const recentData = (await recentResponse.json()) as EverydayPostRow[];

        if (cancelled) return;

        setPhilosophers(
          philosopherData.filter((philosopher) => philosopher.is_active !== 0)
        );
        setRecentPosts(
          recentData.filter((post) => post.source_type === "everyday")
        );
      } catch (error) {
        if (!cancelled) {
          setPageError(
            error instanceof Error ? error.message : "Failed to load the everyday generator."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadInitialData();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!generating || selectedPhilosopherIds.length === 0) {
      setCurrentGeneratingIndex(0);
      return;
    }

    const timer = window.setInterval(() => {
      setCurrentGeneratingIndex((current) =>
        current >= selectedPhilosopherIds.length - 1 ? current : current + 1
      );
    }, 650);

    return () => {
      window.clearInterval(timer);
    };
  }, [generating, selectedPhilosopherIds]);

  async function refreshRecentPosts() {
    try {
      const response = await fetch("/api/admin/posts?source_type=everyday&limit=10");
      if (!response.ok) return;
      const data = (await response.json()) as EverydayPostRow[];
      setRecentPosts(data.filter((post) => post.source_type === "everyday"));
    } catch {
      // Keep the existing recent state if refresh fails.
    }
  }

  function togglePhilosopher(philosopherId: string) {
    setFormError(null);
    setSelectedPhilosopherIds((current) =>
      current.includes(philosopherId)
        ? current.filter((id) => id !== philosopherId)
        : [...current, philosopherId]
    );
  }

  function buildGeneratingCards(ids: string[]): ResultCard[] {
    return ids.map((id) => {
      const philosopher = philosopherMap.get(id);

      return {
        philosopherId: id,
        philosopherName: philosopher?.name ?? id,
        philosopherColor: philosopher?.color ?? "#8A735A",
        philosopherInitials: philosopher?.initials ?? "??",
        state: "generating",
        pendingAction: null,
      };
    });
  }

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedScenario = scenario.trim();
    if (!trimmedScenario) {
      setFormError("Enter a scenario first.");
      return;
    }
    if (selectedPhilosopherIds.length < 2) {
      setFormError("Select at least two philosophers.");
      return;
    }
    if (selectedPhilosopherIds.length > 4) {
      setFormError("Select no more than four philosophers.");
      return;
    }

    setGenerating(true);
    setCurrentGeneratingIndex(0);
    setFormError(null);
    setPageError(null);
    setNotice(null);
    setResultsScenario(trimmedScenario);
    setResults(buildGeneratingCards(selectedPhilosopherIds));

    try {
      const response = await fetch("/api/admin/everyday/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario: trimmedScenario,
          philosopher_ids: selectedPhilosopherIds,
          target_length: targetLength,
        }),
      });

      const data = (await response.json()) as { error?: string } | EverydayGenerationResponse;
      if (!response.ok || !("generated" in data)) {
        throw new Error("error" in data ? data.error : "Failed to generate everyday reactions.");
      }

      const nextResults = data.generated.map((item) => {
        const philosopher = philosopherMap.get(item.philosopher_id);
        return {
          philosopherId: item.philosopher_id,
          philosopherName: item.philosopher_name,
          philosopherColor: philosopher?.color ?? "#8A735A",
          philosopherInitials: philosopher?.initials ?? "??",
          generationLogId: item.generation_log_id,
          postId: item.post_id,
          content: item.content,
          thesis: item.thesis,
          stance: item.stance,
          tag: item.tag,
          state: item.error ? "failed" : "draft",
          pendingAction: null,
          error: item.error,
        } satisfies ResultCard;
      });

      setResultsScenario(data.scenario);
      setResults(nextResults);
      setNotice(
        data.errors.length > 0
          ? `Generated ${nextResults.filter((item) => item.state === "draft").length} drafts with ${data.errors.length} issue${data.errors.length === 1 ? "" : "s"}.`
          : `Generated ${nextResults.length} draft${nextResults.length === 1 ? "" : "s"}.`
      );
      void refreshRecentPosts();
    } catch (error) {
      setPageError(
        error instanceof Error ? error.message : "Failed to generate everyday reactions."
      );
      setResults([]);
    } finally {
      setGenerating(false);
    }
  }

  async function handleApprove(result: ResultCard) {
    if (!result.generationLogId || result.state !== "draft") return;

    setPageError(null);
    setNotice(null);
    setResults((current) =>
      current.map((item) =>
        item.postId === result.postId ? { ...item, pendingAction: "approve" } : item
      )
    );

    try {
      const response = await fetch("/api/admin/content", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: result.generationLogId,
          status: "approved",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to approve the draft.");
      }

      setResults((current) =>
        current.map((item) =>
          item.postId === result.postId
            ? { ...item, state: "approved", pendingAction: null }
            : item
        )
      );
      setNotice(`${result.philosopherName} approved for publishing.`);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Failed to approve the draft.");
      setResults((current) =>
        current.map((item) =>
          item.postId === result.postId ? { ...item, pendingAction: null } : item
        )
      );
    }
  }

  async function handleReject(result: ResultCard) {
    if (!result.postId || !result.generationLogId) return;

    setPageError(null);
    setNotice(null);
    setResults((current) =>
      current.map((item) =>
        item.postId === result.postId ? { ...item, pendingAction: "reject" } : item
      )
    );

    try {
      const [deletePostResponse, rejectLogResponse] = await Promise.all([
        fetch("/api/admin/posts", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: result.postId }),
        }),
        fetch("/api/admin/content", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: result.generationLogId,
            status: "rejected",
          }),
        }),
      ]);

      if (!deletePostResponse.ok || !rejectLogResponse.ok) {
        throw new Error("Failed to reject the draft.");
      }

      setResults((current) =>
        current.map((item) =>
          item.postId === result.postId
            ? { ...item, state: "rejected", pendingAction: null }
            : item
        )
      );
      setNotice(`${result.philosopherName} rejected and removed.`);
      void refreshRecentPosts();
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Failed to reject the draft.");
      setResults((current) =>
        current.map((item) =>
          item.postId === result.postId ? { ...item, pendingAction: null } : item
        )
      );
    }
  }

  async function handlePublishApproved() {
    const approvedItems = results.filter(
      (item) => item.state === "approved" && item.postId && item.generationLogId
    );

    if (approvedItems.length === 0) {
      setPageError("Approve at least one draft before publishing.");
      return;
    }

    setPageError(null);
    setNotice(null);
    setResults((current) =>
      current.map((item) =>
        item.state === "approved" ? { ...item, pendingAction: "publish" } : item
      )
    );

    try {
      for (const item of approvedItems) {
        const [publishPostResponse, publishLogResponse] = await Promise.all([
          fetch("/api/admin/posts", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: item.postId, status: "published" }),
          }),
          fetch("/api/admin/content", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: item.generationLogId, status: "published" }),
          }),
        ]);

        if (!publishPostResponse.ok || !publishLogResponse.ok) {
          throw new Error(`Failed to publish ${item.philosopherName}.`);
        }
      }

      setResults((current) =>
        current.map((item) =>
          item.state === "approved"
            ? { ...item, state: "published", pendingAction: null }
            : item
        )
      );
      setNotice(
        `Published ${approvedItems.length} approved draft${approvedItems.length === 1 ? "" : "s"}.`
      );
      void refreshRecentPosts();
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Failed to publish approved drafts.");
      setResults((current) =>
        current.map((item) =>
          item.pendingAction === "publish" ? { ...item, pendingAction: null } : item
        )
      );
    }
  }

  const approvedCount = results.filter((item) => item.state === "approved").length;
  const canGenerate = scenario.trim().length > 0 && selectedPhilosopherIds.length >= 2 && !generating;

  if (loading) {
    return (
      <div className="py-20 text-center">
        <Spinner className="mx-auto h-6 w-6 text-terracotta" />
        <p className="mt-3 text-sm text-ink-lighter">Loading The Examined Life...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-mono uppercase tracking-[0.35em] text-terracotta/70 mb-2">
          Editorial Workflow
        </p>
        <h1 className="font-serif text-3xl font-bold text-ink">The Examined Life</h1>
        <p className="text-sm text-ink-lighter mt-2 max-w-3xl">
          Philosophers react to everyday situations. Always generate for multiple
          philosophers — the contrast is the point.
        </p>
      </div>

      {pageError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {pageError}
        </div>
      )}

      {notice && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {notice}
        </div>
      )}

      <section className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-border bg-parchment-dark/20">
          <h2 className="font-serif text-lg font-bold text-ink">Scenario Generator</h2>
          <p className="text-sm text-ink-lighter mt-1">
            Keep it short, pick the philosophers, and let the disagreement do the work.
          </p>
        </div>

        <form onSubmit={handleGenerate} className="px-6 py-6 space-y-6">
          <div>
            <div className="flex items-center justify-between gap-3 mb-2">
              <label
                htmlFor="everyday-scenario"
                className="text-xs font-mono uppercase tracking-[0.24em] text-ink-lighter"
              >
                Scenario
              </label>
              <span className="text-[11px] font-mono text-ink-lighter">
                {scenario.trim().length}/500
              </span>
            </div>
            <input
              id="everyday-scenario"
              type="text"
              value={scenario}
              onChange={(event) => {
                setScenario(event.target.value);
                setFormError(null);
              }}
              placeholder="e.g. Your meeting could have been an email"
              maxLength={500}
              className="w-full rounded-xl border border-border bg-parchment px-4 py-3 text-base text-ink font-body focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta"
            />
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div>
                <p className="text-xs font-mono uppercase tracking-[0.24em] text-ink-lighter">
                  Philosophers
                </p>
                <p className="text-sm text-ink-lighter mt-1">
                  <span className="font-medium text-ink">{selectedPhilosopherIds.length} selected</span>{" "}
                  <span>(min. 2)</span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {philosophers.map((philosopher) => {
                const selected = selectedPhilosopherIds.includes(philosopher.id);

                return (
                  <button
                    key={philosopher.id}
                    type="button"
                    onClick={() => togglePhilosopher(philosopher.id)}
                    className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                      selected
                        ? "border-terracotta bg-terracotta/10 shadow-sm"
                        : "border-border bg-parchment hover:border-border-light hover:bg-parchment-dark/40"
                    }`}
                  >
                    <span
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full text-xs font-serif font-bold text-white"
                      style={{ backgroundColor: philosopher.color }}
                    >
                      {philosopher.initials}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-serif text-base font-semibold text-ink">
                        {philosopher.name}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-xs font-mono uppercase tracking-[0.24em] text-ink-lighter mb-3">
              Length
            </p>
            <div className="flex flex-wrap gap-2">
              {LENGTH_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTargetLength(option.value)}
                  className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                    targetLength === option.value
                      ? "border-terracotta bg-terracotta text-white"
                      : "border-border bg-white text-ink-lighter hover:bg-parchment-dark/40"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {formError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {formError}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={!canGenerate}
              className="inline-flex items-center gap-2 rounded-full bg-terracotta px-5 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-terracotta-light disabled:cursor-not-allowed disabled:opacity-50"
            >
              {generating ? <Spinner className="h-4 w-4" /> : null}
              {generating
                ? currentGeneratingName
                  ? `Generating ${currentGeneratingName}...`
                  : "Generating..."
                : `Generate for ${selectedPhilosopherIds.length} philosopher${selectedPhilosopherIds.length === 1 ? "" : "s"}`}
            </button>
            <span className="text-xs font-mono uppercase tracking-[0.18em] text-ink-lighter">
              Rare, contrast-led seasoning for the feed
            </span>
          </div>
        </form>
      </section>

      {resultsScenario && (
        <section className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-mono uppercase tracking-[0.35em] text-terracotta/70 mb-2">
                Current Scenario
              </p>
              <h2 className="font-serif text-2xl font-bold text-ink">{resultsScenario}</h2>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => void handlePublishApproved()}
                disabled={approvedCount === 0}
                className="inline-flex items-center gap-2 rounded-full bg-green-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Publish {approvedCount} Approved
              </button>
              <Link
                href="/admin/posts?status=draft"
                className="text-sm text-terracotta hover:text-terracotta-light"
              >
                Open drafts in Posts
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {results.map((result) => {
              const stance = result.stance ? STANCE_CONFIG[result.stance] : null;
              const canReview =
                Boolean(result.postId) &&
                Boolean(result.generationLogId) &&
                (result.state === "draft" || result.state === "approved");

              return (
                <article
                  key={result.philosopherId}
                  className="rounded-xl border border-border bg-white shadow-sm overflow-hidden"
                >
                  <div className="px-5 py-5 space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span
                          className="inline-flex h-11 w-11 items-center justify-center rounded-full text-xs font-serif font-bold text-white"
                          style={{ backgroundColor: result.philosopherColor }}
                        >
                          {result.philosopherInitials}
                        </span>
                        <div>
                          <p className="font-serif text-lg font-bold text-ink">
                            {result.philosopherName}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-mono uppercase tracking-[0.18em] ${getStateTone(result.state)}`}
                            >
                              {result.state === "generating" && result.pendingAction === null ? (
                                <span className="inline-flex items-center gap-1.5">
                                  <Spinner className="h-3 w-3" />
                                  {getStateLabel(result.state)}
                                </span>
                              ) : (
                                getStateLabel(result.state)
                              )}
                            </span>
                            {stance && (
                              <span
                                className="inline-flex rounded-full px-3 py-1 text-[11px] font-mono uppercase tracking-[0.18em]"
                                style={{
                                  backgroundColor: stance.bg,
                                  color: stance.color,
                                  border: `1px solid ${stance.border}`,
                                }}
                              >
                                {stance.label}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {result.state === "generating" ? (
                      <div className="rounded-xl border border-border-light bg-parchment-dark/30 px-4 py-4 text-sm text-ink-lighter">
                        Preparing this philosopher&apos;s take on the scenario...
                      </div>
                    ) : result.error ? (
                      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800">
                        {result.error}
                      </div>
                    ) : (
                      <>
                        {result.thesis && (
                          <blockquote className="rounded-r-xl border-l-[3px] px-4 py-3 font-serif text-lg leading-[1.45] text-ink bg-parchment-dark/25">
                            {result.thesis}
                          </blockquote>
                        )}
                        {result.content && (
                          <div className="whitespace-pre-line border-l border-border-light pl-4 text-[15px] leading-7 text-ink">
                            {result.content}
                          </div>
                        )}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border-light/80">
                          <div className="flex flex-wrap items-center gap-2">
                            {result.tag && (
                              <span className="inline-flex rounded-full border border-border-light bg-parchment px-3 py-1 text-[11px] font-mono uppercase tracking-[0.18em] text-ink-lighter">
                                {result.tag}
                              </span>
                            )}
                            {(result.state === "draft" || result.state === "approved") && (
                              <span className="inline-flex rounded-full border border-border-light bg-parchment-dark/40 px-3 py-1 text-[11px] font-mono uppercase tracking-[0.18em] text-ink-lighter">
                                Draft
                              </span>
                            )}
                          </div>

                          {canReview ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => void handleApprove(result)}
                                disabled={result.state !== "draft" || result.pendingAction !== null}
                                className="rounded-full border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800 transition-colors hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {result.pendingAction === "approve" ? "Approving..." : "Approve"}
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleReject(result)}
                                disabled={result.pendingAction !== null}
                                className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {result.pendingAction === "reject" ? "Rejecting..." : "Reject"}
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <section className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-border bg-parchment-dark/20">
          <h2 className="font-serif text-lg font-bold text-ink">Recent Everyday Generations</h2>
          <p className="text-sm text-ink-lighter mt-1">
            The last 10 everyday posts, grouped by scenario so it&apos;s easy to avoid repeats.
          </p>
        </div>

        <div className="px-6 py-5 space-y-3">
          {recentGroups.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border-light bg-parchment-dark/20 px-4 py-6 text-sm text-ink-lighter">
              No everyday scenarios yet.
            </div>
          ) : (
            recentGroups.map((group, index) => (
              <details
                key={`${group.scenario}-${index}`}
                className="rounded-xl border border-border-light bg-parchment/60"
              >
                <summary className="cursor-pointer list-none px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-serif text-lg font-semibold text-ink">{group.scenario}</p>
                      <p className="mt-1 text-xs font-mono uppercase tracking-[0.18em] text-ink-lighter">
                        {group.posts.length} post{group.posts.length === 1 ? "" : "s"} · last{" "}
                        {formatDateTime(group.latestCreatedAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {group.posts.map((post) => {
                        const stance = STANCE_CONFIG[post.stance];
                        return (
                          <span
                            key={post.id}
                            className="inline-flex rounded-full px-3 py-1 text-[11px] font-mono uppercase tracking-[0.18em]"
                            style={{
                              backgroundColor: stance.bg,
                              color: stance.color,
                              border: `1px solid ${stance.border}`,
                            }}
                          >
                            {post.philosopher_name}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </summary>

                <div className="border-t border-border-light px-4 py-4 space-y-3">
                  {group.posts.map((post) => {
                    const stance = STANCE_CONFIG[post.stance];
                    return (
                      <div
                        key={post.id}
                        className="rounded-xl border border-border bg-white px-4 py-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span
                              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-xs font-serif font-bold text-white"
                              style={{ backgroundColor: post.philosopher_color }}
                            >
                              {post.philosopher_initials}
                            </span>
                            <div>
                              <p className="font-serif text-base font-bold text-ink">
                                {post.philosopher_name}
                              </p>
                              <p className="text-xs font-mono uppercase tracking-[0.18em] text-ink-lighter">
                                {formatDateTime(post.created_at)}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className="inline-flex rounded-full px-3 py-1 text-[11px] font-mono uppercase tracking-[0.18em]"
                              style={{
                                backgroundColor: stance.bg,
                                color: stance.color,
                                border: `1px solid ${stance.border}`,
                              }}
                            >
                              {stance.label}
                            </span>
                            <span
                              className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-mono uppercase tracking-[0.18em] ${
                                post.status === "published"
                                  ? "border-green-200 bg-green-100 text-green-800"
                                  : "border-border-light bg-parchment-dark/40 text-ink-lighter"
                              }`}
                            >
                              {post.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </details>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
