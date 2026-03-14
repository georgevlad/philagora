"use client";

import { useEffect, useMemo, useState } from "react";
import { Spinner } from "@/components/Spinner";
import { STANCE_CONFIG } from "@/lib/constants";
import {
  DEFAULT_CONFIG,
  ITEM_STATUS_CLASSES,
  LENGTH_OPTIONS,
  TOPIC_CLUSTER_LABELS,
  parseJson,
  publishPriority,
  truncate,
  type CandidateArticle,
  type DailyGeneratedItem,
  type DailySummary,
  type DraftStatus,
  type Philosopher,
  type PhilosopherUsage,
  type PipelineResult,
  type RawCandidateArticle,
  type ReviewItem,
} from "./types";

export default function DailyContentPage() {
  const [philosophers, setPhilosophers] = useState<Philosopher[]>([]);
  const [articles, setArticles] = useState<CandidateArticle[]>([]);
  const [philosopherUsage, setPhilosopherUsage] = useState<Record<string, PhilosopherUsage>>({});
  const [selectedArticleIds, setSelectedArticleIds] = useState<string[]>([]);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [loadingSetup, setLoadingSetup] = useState(true);
  const [loadingArticles, setLoadingArticles] = useState(false);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineResult, setPipelineResult] = useState<PipelineResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [bulkPublishing, setBulkPublishing] = useState(false);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedDraftIds, setSelectedDraftIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      setLoadingSetup(true);
      try {
        const [philosopherRes, candidateRes, usageRes] = await Promise.all([
          fetch("/api/admin/philosophers"),
          fetch("/api/admin/news-scout/candidates?status=scored&min_score=60&limit=10"),
          fetch("/api/admin/philosopher-usage"),
        ]);

        if (!philosopherRes.ok) throw new Error("Failed to load philosophers.");
        if (!candidateRes.ok) throw new Error("Failed to load scored articles.");

        const philosopherData = (await philosopherRes.json()) as Philosopher[];
        const candidateData = (await candidateRes.json()) as RawCandidateArticle[];
        const usageData = usageRes.ok
          ? ((await usageRes.json()) as { usage: Record<string, PhilosopherUsage> })
          : null;
        if (cancelled) return;

        const normalizedCandidates = candidateData.map(normalizeCandidate);
        setPhilosophers(philosopherData);
        setArticles(normalizedCandidates);
        setPhilosopherUsage(usageData?.usage ?? {});
        setSelectedArticleIds(normalizedCandidates.slice(0, 3).map((article) => article.id));
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load setup data.");
        }
      } finally {
        if (!cancelled) setLoadingSetup(false);
      }
    }

    void loadInitialData();
    return () => {
      cancelled = true;
    };
  }, []);

  async function loadCandidates(autoSelectTop = false) {
    setLoadingArticles(true);
    try {
      const response = await fetch("/api/admin/news-scout/candidates?status=scored&min_score=60&limit=10");
      if (!response.ok) throw new Error("Failed to load scored articles.");

      const data = (await response.json()) as RawCandidateArticle[];
      const normalized = data.map(normalizeCandidate);
      setArticles(normalized);
      setSelectedArticleIds((current) => {
        if (autoSelectTop || current.length === 0) {
          return normalized.slice(0, 3).map((article) => article.id);
        }

        const validSelection = current.filter((id) => normalized.some((article) => article.id === id));
        return validSelection.length > 0
          ? validSelection
          : normalized.slice(0, 3).map((article) => article.id);
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load articles.");
    } finally {
      setLoadingArticles(false);
    }
  }

  function normalizeCandidate(article: RawCandidateArticle): CandidateArticle {
    return {
      ...article,
      suggested_philosophers: parseJson<string[]>(article.suggested_philosophers, []),
      suggested_stances: parseJson<Record<string, string>>(article.suggested_stances, {}),
      published_posts: article.published_posts ?? [],
    };
  }

  function updateNumberConfig(key: "reactions_per_article" | "cross_replies" | "timeless_reflections", value: string) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) return;
    setConfig((current) => ({ ...current, [key]: parsed }));
  }

  function toggleArticle(articleId: string) {
    setSelectedArticleIds((current) =>
      current.includes(articleId)
        ? current.filter((id) => id !== articleId)
        : [...current, articleId]
    );
  }

  function toggleExcludedPhilosopher(philosopherId: string) {
    setConfig((current) => ({
      ...current,
      excluded_philosophers: current.excluded_philosophers.includes(philosopherId)
        ? current.excluded_philosophers.filter((id) => id !== philosopherId)
        : [...current.excluded_philosophers, philosopherId],
    }));
  }

  function toggleDraftSelection(postId: string) {
    setSelectedDraftIds((current) =>
      current.includes(postId)
        ? current.filter((id) => id !== postId)
        : [...current, postId]
    );
  }

  function getDependentReplies(postId: string) {
    return reviewItems.filter(
      (item) =>
        item.type === "cross_reply" &&
        item.reply_to_post_id === postId &&
        item.status === "draft"
    );
  }


  async function handleFetchAndScore() {
    setPipelineRunning(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/admin/news-scout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "fetch_and_score" }),
      });
      const data = (await response.json()) as PipelineResult | { error: string };
      if (!response.ok) {
        throw new Error("error" in data ? data.error : "Failed to run the news pipeline.");
      }

      setPipelineResult(data as PipelineResult);
      await loadCandidates(true);
      setNotice("News pipeline complete. Top scored articles are ready for selection.");
    } catch (pipelineError) {
      setError(pipelineError instanceof Error ? pipelineError.message : "Failed to run the news pipeline.");
    } finally {
      setPipelineRunning(false);
    }
  }

  async function handleGenerateDailyFeed() {
    if (selectedArticleIds.length === 0) {
      setError("Select at least one article before generating.");
      return;
    }

    setGenerating(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/admin/daily-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          article_ids: selectedArticleIds,
          config,
        }),
      });
      const data = (await response.json()) as
        | { error: string }
        | { success: boolean; summary: DailySummary; generated: DailyGeneratedItem[] };

      if (!response.ok) {
        throw new Error("error" in data ? data.error : "Daily generation failed.");
      }

      const payload = data as { success: boolean; summary: DailySummary; generated: DailyGeneratedItem[] };
      setSummary(payload.summary);
      setReviewItems(payload.generated.map((item) => ({ ...item, status: "draft" as DraftStatus })));
      setSelectedDraftIds(payload.generated.map((item) => item.post_id));
      setNotice(
        payload.generated.length > 0
          ? `Generated ${payload.generated.length} draft${payload.generated.length === 1 ? "" : "s"}.`
          : "No drafts were generated. Review the errors below and adjust the mix."
      );
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Daily generation failed.");
    } finally {
      setGenerating(false);
    }
  }

  async function publishSingleItem(item: ReviewItem) {
    const postResponse = await fetch("/api/admin/posts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.post_id, status: "published" }),
    });
    if (!postResponse.ok) throw new Error(`Failed to publish ${item.philosopher_name}.`);

    const logResponse = await fetch("/api/admin/content", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.generation_log_id, status: "published" }),
    });
    if (!logResponse.ok) throw new Error(`Failed to update the generation log for ${item.philosopher_name}.`);

    setReviewItems((current) =>
      current.map((entry) =>
        entry.post_id === item.post_id ? { ...entry, status: "published" } : entry
      )
    );
    setSelectedDraftIds((current) => current.filter((id) => id !== item.post_id));
  }

  async function handlePublishItem(item: ReviewItem) {
    if (item.status !== "draft") return;
    setBusyItemId(item.post_id);
    setError(null);

    try {
      await publishSingleItem(item);
      setNotice(`${item.philosopher_name} published.`);
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "Failed to publish item.");
    } finally {
      setBusyItemId(null);
    }
  }

  async function deleteSingleItem(item: ReviewItem) {
    const postResponse = await fetch("/api/admin/posts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.post_id }),
    });
    if (!postResponse.ok) throw new Error(`Failed to delete ${item.philosopher_name}.`);

    const logResponse = await fetch("/api/admin/content", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.generation_log_id, status: "rejected" }),
    });
    if (!logResponse.ok) throw new Error(`Failed to update the generation log for ${item.philosopher_name}.`);

    setReviewItems((current) =>
      current.map((entry) =>
        entry.post_id === item.post_id ? { ...entry, status: "deleted" } : entry
      )
    );
    setSelectedDraftIds((current) => current.filter((id) => id !== item.post_id));
  }

  async function handleDeleteItem(item: ReviewItem) {
    if (item.status !== "draft") return;
    const dependentReplies = item.type === "news_reaction" ? getDependentReplies(item.post_id) : [];
    const publishedReplies = reviewItems.filter(
      (entry) =>
        entry.type === "cross_reply" &&
        entry.reply_to_post_id === item.post_id &&
        entry.status === "published"
    );
    if (publishedReplies.length > 0) {
      setError("Publish-state replies already exist for this reaction. Leave the parent in place and manage the replies individually.");
      return;
    }
    const itemsToDelete = [...dependentReplies, item];
    const confirmed = window.confirm(
      dependentReplies.length > 0
        ? `Delete this reaction and its ${dependentReplies.length} dependent repl${dependentReplies.length === 1 ? "y" : "ies"}?`
        : "Delete this draft?"
    );
    if (!confirmed) return;

    setBusyItemId(item.post_id);
    setError(null);

    try {
      for (const entry of itemsToDelete) {
        await deleteSingleItem(entry);
      }
      setNotice(
        dependentReplies.length > 0
          ? `Deleted ${item.philosopher_name}'s reaction and its dependent replies.`
          : `${item.philosopher_name}'s draft was deleted.`
      );
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete draft.");
    } finally {
      setBusyItemId(null);
    }
  }

  async function handleRegenerateItem(item: ReviewItem) {
    if (item.status !== "draft") return;

    const publishedReplies = reviewItems.filter(
      (entry) =>
        entry.type === "cross_reply" &&
        entry.reply_to_post_id === item.post_id &&
        entry.status === "published"
    );
    if (item.type === "news_reaction" && publishedReplies.length > 0) {
      setError("Publish-state replies already exist for this reaction. Regenerate those replies separately after creating a new parent manually if needed.");
      return;
    }

    setBusyItemId(item.post_id);
    setError(null);
    setNotice(null);

    try {
      const dependentReplies = item.type === "news_reaction" ? getDependentReplies(item.post_id) : [];
      const response = await fetch("/api/admin/daily-generate", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          post_id: item.post_id,
          generation_log_id: item.generation_log_id,
          type: item.type,
          length: item.length,
          article_candidate_id: item.article_candidate_id,
          reply_to_post_id: item.reply_to_post_id,
          prompt_seed: item.prompt_seed,
          dependent_replies: dependentReplies.map((reply) => ({
            post_id: reply.post_id,
            generation_log_id: reply.generation_log_id,
          })),
        }),
      });
      const data = (await response.json()) as
        | { error: string }
        | {
            success: boolean;
            item: DailyGeneratedItem;
            deleted_reply_post_ids: string[];
          };

      if (!response.ok) {
        throw new Error("error" in data ? data.error : "Failed to regenerate item.");
      }

      const payload = data as {
        success: boolean;
        item: DailyGeneratedItem;
        deleted_reply_post_ids: string[];
      };

      setReviewItems((current) =>
        current.map((entry) => {
          if (entry.post_id === payload.item.post_id) {
            return { ...payload.item, status: "draft" as DraftStatus };
          }
          if (payload.deleted_reply_post_ids.includes(entry.post_id)) {
            return { ...entry, status: "deleted" as DraftStatus };
          }
          return entry;
        })
      );
      setSelectedDraftIds((current) => {
        const next = current.filter((id) => !payload.deleted_reply_post_ids.includes(id));
        return next.includes(payload.item.post_id) ? next : [...next, payload.item.post_id];
      });
      setNotice(
        payload.deleted_reply_post_ids.length > 0
          ? "Draft regenerated. Dependent replies were removed so they can be regenerated from the new parent." 
          : "Draft regenerated."
      );
    } catch (regenerateError) {
      setError(regenerateError instanceof Error ? regenerateError.message : "Failed to regenerate item.");
    } finally {
      setBusyItemId(null);
    }
  }

  async function handleBulkPublish(mode: "all" | "selected") {
    const draftItems = reviewItems.filter((item) => item.status === "draft");
    const itemsToPublish = (
      mode === "all"
        ? draftItems
        : draftItems.filter((item) => selectedDraftIds.includes(item.post_id))
    ).sort((left, right) => publishPriority(left.type) - publishPriority(right.type));

    if (itemsToPublish.length === 0) {
      setError(mode === "all" ? "There are no draft items to publish." : "Select at least one draft to publish.");
      return;
    }

    setBulkPublishing(true);
    setError(null);

    try {
      for (const item of itemsToPublish) {
        await publishSingleItem(item);
      }
      setNotice(
        mode === "all"
          ? `Published ${itemsToPublish.length} draft${itemsToPublish.length === 1 ? "" : "s"}.`
          : `Published ${itemsToPublish.length} selected draft${itemsToPublish.length === 1 ? "" : "s"}.`
      );
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "Failed to publish drafts.");
    } finally {
      setBulkPublishing(false);
    }
  }

  const expectedNewsReactions = selectedArticleIds.length * config.reactions_per_article;
  const expectedCrossReplies = Math.min(config.cross_replies, expectedNewsReactions);
  const estimatedTotal = expectedNewsReactions + expectedCrossReplies + config.timeless_reflections;
  const selectedClusters = useMemo(() => {
    const selected = articles.filter((article) => selectedArticleIds.includes(article.id));
    const clusterCounts: Record<string, number> = {};

    for (const article of selected) {
      const cluster = article.topic_cluster;
      if (cluster) {
        clusterCounts[cluster] = (clusterCounts[cluster] || 0) + 1;
      }
    }

    return clusterCounts;
  }, [articles, selectedArticleIds]);
  const clusterWarnings = useMemo(() => {
    return Object.entries(selectedClusters)
      .filter(([, count]) => count >= 2)
      .map(([cluster, count]) => ({
        cluster,
        count,
        label: TOPIC_CLUSTER_LABELS[cluster]?.label ?? cluster,
      }));
  }, [selectedClusters]);
  const activePhilosophers = useMemo(
    () => philosophers.filter((philosopher) => philosopher.is_active !== 0),
    [philosophers]
  );
  const draftItems = reviewItems.filter((item) => item.status === "draft");
  const newsReactionItems = reviewItems.filter((item) => item.type === "news_reaction");
  const crossReplyItems = reviewItems.filter((item) => item.type === "cross_reply");
  const timelessItems = reviewItems.filter((item) => item.type === "timeless_reflection");

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
      <div>
        <p className="text-xs font-mono uppercase tracking-[0.35em] text-terracotta/70 mb-2">
          Editorial Workflow
        </p>
        <h1 className="font-serif text-3xl font-bold text-ink">Daily Content Generator</h1>
        <p className="text-sm text-ink-lighter mt-2 max-w-3xl">
          Generate a balanced day&apos;s feed in one workflow: fetch news, select angles,
          draft reactions, create replies, and publish when the mix feels right.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {notice && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {notice}
        </div>
      )}

      <section className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-border bg-parchment-dark/20 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-mono uppercase tracking-[0.3em] text-ink-lighter mb-1">Step 1</p>
            <h2 className="font-serif text-lg font-bold text-ink">News Pipeline</h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => void loadCandidates(true)}
              disabled={loadingArticles || loadingSetup}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-mono tracking-wide rounded-full border border-border-light text-ink-lighter hover:bg-parchment-dark/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingArticles ? <><Spinner /> Loading</> : "Reload scored"}
            </button>
            <button
              onClick={handleFetchAndScore}
              disabled={pipelineRunning}
              className="inline-flex items-center gap-2 bg-terracotta hover:bg-terracotta-light disabled:opacity-50 disabled:cursor-not-allowed text-white font-body font-medium text-sm px-5 py-2.5 rounded-full shadow-sm hover:shadow transition-all"
            >
              {pipelineRunning ? <><Spinner /> Running pipeline...</> : "Fetch & Score News"}
            </button>
          </div>
        </div>

        <div className="px-6 py-6 space-y-5">
          {activePhilosophers.length > 0 && (
            <div className="rounded-lg border border-border-light bg-parchment-dark/20 px-4 py-3">
              <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-ink-lighter mb-2">
                Roster - last 7 days
              </p>
              <div className="flex flex-wrap gap-2">
                {activePhilosophers.map((philosopher) => {
                  const usage = philosopherUsage[philosopher.id];
                  const count = usage?.posts_7d ?? 0;
                  const daysSince = usage?.days_since_last;
                  const isOverused = count >= 5;
                  const isUnderused = daysSince === null || daysSince >= 7;
                  const isIdle = daysSince === null || daysSince >= 14;

                  return (
                    <div
                      key={philosopher.id}
                      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 border text-[11px] font-mono ${
                        isIdle
                          ? "border-amber-300 bg-amber-50 text-amber-800"
                          : isOverused
                          ? "border-red-200 bg-red-50 text-red-700"
                          : isUnderused
                          ? "border-blue-200 bg-blue-50 text-blue-700"
                          : "border-border-light bg-white text-ink-lighter"
                      }`}
                      title={
                        daysSince === null
                          ? `${philosopher.name}: never used`
                          : `${philosopher.name}: ${count} posts this week, last used ${daysSince}d ago`
                      }
                    >
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-serif font-bold text-white"
                        style={{ backgroundColor: philosopher.color }}
                      >
                        {philosopher.initials}
                      </span>
                      <span>{count}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-[10px] text-ink-lighter">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400" /> idle (14d+)
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-400" /> underused (7d+)
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-400" /> heavy (5+/week)
                </span>
              </div>
            </div>
          )}

          {pipelineResult && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border border-border bg-parchment px-4 py-3">
                <p className="text-xs font-mono uppercase tracking-[0.25em] text-ink-lighter mb-1">Fetch</p>
                <p className="text-sm text-ink">
                  {pipelineResult.fetchResult?.newArticles ?? 0} new articles from {pipelineResult.fetchResult?.sourcesChecked ?? 0} sources
                </p>
              </div>
              <div className="rounded-lg border border-border bg-parchment px-4 py-3">
                <p className="text-xs font-mono uppercase tracking-[0.25em] text-ink-lighter mb-1">Score</p>
                <p className="text-sm text-ink">
                  {pipelineResult.scoreResult?.scored ?? 0} articles scored for philosophical potential
                </p>
              </div>
            </div>
          )}

          {loadingSetup ? (
            <div className="rounded-lg border border-border bg-parchment px-6 py-10 text-center text-sm text-ink-lighter">
              <Spinner className="h-5 w-5 mx-auto mb-2 text-terracotta" />
              Loading philosophers and scored articles...
            </div>
          ) : articles.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-parchment px-6 py-10 text-center text-sm text-ink-lighter">
              No scored articles yet. Run the pipeline to pull in today&apos;s candidates.
            </div>
          ) : (
            <div className="space-y-3">
              {articles.map((article) => {
                const selected = selectedArticleIds.includes(article.id);
                return (
                  <label
                    key={article.id}
                    className={`block rounded-xl border px-5 py-4 cursor-pointer transition-colors ${
                      selected
                        ? "border-terracotta bg-terracotta/5 ring-1 ring-terracotta/20"
                        : "border-border bg-white hover:bg-parchment-dark/20"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleArticle(article.id)}
                        className="mt-1 h-4 w-4 rounded border-border text-terracotta focus:ring-terracotta"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <span className="inline-flex items-center px-2.5 py-1 text-[11px] font-mono tracking-wider uppercase rounded-full bg-parchment-dark text-ink-lighter">
                            Score {article.score ?? "-"}
                          </span>
                          <span className="text-xs text-ink-lighter">{article.source_name}</span>
                          {article.topic_cluster && TOPIC_CLUSTER_LABELS[article.topic_cluster] && (
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border ${TOPIC_CLUSTER_LABELS[article.topic_cluster].color}`}
                            >
                              {TOPIC_CLUSTER_LABELS[article.topic_cluster].label}
                            </span>
                          )}
                          {article.published_posts.length > 0 && (
                            <span className="text-xs text-ink-lighter">
                              {article.published_posts.length} related post{article.published_posts.length === 1 ? "" : "s"}
                            </span>
                          )}
                        </div>
                        <h3 className="font-serif text-lg font-bold text-ink leading-snug">{article.title}</h3>
                        {article.philosophical_entry_point && (
                          <p className="mt-2 text-sm text-ink leading-relaxed">
                            {article.philosophical_entry_point}
                          </p>
                        )}
                        {article.suggested_philosophers.length > 0 && (
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            {article.suggested_philosophers.map((philosopherId) => {
                              const philosopher = philosophers.find((entry) => entry.id === philosopherId);
                              if (!philosopher) return null;
                              const usage = philosopherUsage[philosopher.id];
                              const count = usage?.posts_7d ?? 0;
                              const daysSince = usage?.days_since_last;
                              const isOverused = count >= 5;
                              const isIdle = daysSince === null || daysSince >= 14;

                              return (
                                <span
                                  key={philosopher.id}
                                  className="inline-flex items-center gap-2 rounded-full px-2.5 py-1 border border-border-light bg-parchment text-xs text-ink"
                                  title={
                                    daysSince === null
                                      ? `${philosopher.name}: never posted`
                                      : `${philosopher.name}: ${count} posts this week, last used ${daysSince}d ago`
                                  }
                                >
                                  <span
                                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-serif font-bold text-white"
                                    style={{ backgroundColor: philosopher.color }}
                                  >
                                    {philosopher.initials}
                                  </span>
                                  {philosopher.name}
                                  {(isOverused || isIdle) && (
                                    <span
                                      className={`ml-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-mono font-bold ${
                                        isOverused
                                          ? "bg-red-100 text-red-700"
                                          : "bg-amber-100 text-amber-700"
                                      }`}
                                      title={isOverused ? "Heavy usage this week" : "Idle - has not posted recently"}
                                    >
                                      {isOverused ? count : "!"}
                                    </span>
                                  )}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}

          {clusterWarnings.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 space-y-1">
              <p className="text-sm font-semibold text-amber-900">
                Topic clustering detected
              </p>
              {clusterWarnings.map(({ cluster, count, label }) => (
                <p key={cluster} className="text-sm text-amber-800">
                  {count} of {selectedArticleIds.length} selected articles are <strong>{label}</strong> - consider swapping one for a different topic.
                </p>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-border bg-parchment-dark/20">
          <p className="text-xs font-mono uppercase tracking-[0.3em] text-ink-lighter mb-1">Step 2</p>
          <h2 className="font-serif text-lg font-bold text-ink">Configuration</h2>
        </div>

        <div className="px-6 py-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-ink-lighter mb-2">
                Reactions per article
              </label>
              <input
                type="number"
                min={1}
                max={3}
                value={config.reactions_per_article}
                onChange={(event) => updateNumberConfig("reactions_per_article", event.target.value)}
                className="w-full rounded-lg border border-border bg-parchment px-4 py-2.5 text-sm text-ink font-body focus:outline-none focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-ink-lighter mb-2">
                Cross-philosopher replies
              </label>
              <input
                type="number"
                min={0}
                max={3}
                value={config.cross_replies}
                onChange={(event) => updateNumberConfig("cross_replies", event.target.value)}
                className="w-full rounded-lg border border-border bg-parchment px-4 py-2.5 text-sm text-ink font-body focus:outline-none focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-ink-lighter mb-2">
                Timeless reflections
              </label>
              <input
                type="number"
                min={0}
                max={4}
                value={config.timeless_reflections}
                onChange={(event) => updateNumberConfig("timeless_reflections", event.target.value)}
                className="w-full rounded-lg border border-border bg-parchment px-4 py-2.5 text-sm text-ink font-body focus:outline-none focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-ink-lighter mb-2">
              Length strategy
            </label>
            <div className="flex flex-wrap gap-3">
              {LENGTH_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm cursor-pointer transition-colors ${
                    config.length_strategy === option.value
                      ? "border-terracotta bg-terracotta/5 text-terracotta"
                      : "border-border text-ink-lighter hover:bg-parchment-dark/20"
                  }`}
                >
                  <input
                    type="radio"
                    name="length-strategy"
                    value={option.value}
                    checked={config.length_strategy === option.value}
                    onChange={() => setConfig((current) => ({ ...current, length_strategy: option.value }))}
                    className="sr-only"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-ink-lighter mb-2">
              Exclude philosophers
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {philosophers.map((philosopher) => {
                const excluded = config.excluded_philosophers.includes(philosopher.id);
                const usage = philosopherUsage[philosopher.id];
                return (
                  <button
                    key={philosopher.id}
                    type="button"
                    onClick={() => toggleExcludedPhilosopher(philosopher.id)}
                    className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                      excluded
                        ? "border-terracotta bg-terracotta/5 ring-1 ring-terracotta/20"
                        : "border-border hover:bg-parchment-dark/20"
                    }`}
                  >
                    <span
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-serif font-bold text-white shrink-0"
                      style={{ backgroundColor: philosopher.color }}
                    >
                      {philosopher.initials}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-serif font-bold text-sm text-ink truncate">
                        {philosopher.name}
                        <span className="text-[10px] font-mono text-ink-lighter ml-1">
                          ({usage?.posts_7d ?? 0}/7d)
                        </span>
                      </span>
                      <span className="block text-xs text-ink-lighter truncate">{philosopher.tradition}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-parchment px-5 py-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-mono uppercase tracking-[0.3em] text-ink-lighter mb-1">Preview</p>
              <p className="font-serif text-lg font-bold text-ink">
                About {estimatedTotal} post{estimatedTotal === 1 ? "" : "s"}
              </p>
              <p className="text-sm text-ink-lighter mt-1">
                {expectedNewsReactions} news reactions + {expectedCrossReplies} cross-replies + {config.timeless_reflections} reflections using about {estimatedTotal} generation calls.
              </p>
              {Object.keys(selectedClusters).length > 0 && (
                <p className="text-sm text-ink-lighter mt-1">
                  Topics: {Object.entries(selectedClusters)
                    .map(([cluster, count]) => `${TOPIC_CLUSTER_LABELS[cluster]?.label ?? cluster}${count > 1 ? ` (x${count})` : ""}`)
                    .join(", ")}
                </p>
              )}
            </div>
            <button
              onClick={handleGenerateDailyFeed}
              disabled={generating || selectedArticleIds.length === 0}
              className="inline-flex items-center justify-center gap-2 bg-terracotta hover:bg-terracotta-light disabled:opacity-50 disabled:cursor-not-allowed text-white font-body font-medium text-sm px-6 py-3 rounded-full shadow-sm hover:shadow transition-all"
            >
              {generating ? <><Spinner /> Generating daily content...</> : "Generate Daily Feed"}
            </button>
          </div>
        </div>
      </section>

      {generating && (
        <section className="rounded-xl border border-border bg-white shadow-sm px-6 py-10 text-center">
          <Spinner className="h-6 w-6 mx-auto mb-3 text-terracotta" />
          <h2 className="font-serif text-lg font-bold text-ink mb-2">Generating daily content...</h2>
          <p className="text-sm text-ink-lighter">
            This run is sequential to avoid API limits, so it may take a minute or two.
          </p>
        </section>
      )}

      {(summary || reviewItems.length > 0) && (
        <section className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-border bg-parchment-dark/20 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-mono uppercase tracking-[0.3em] text-ink-lighter mb-1">Step 4</p>
              <h2 className="font-serif text-lg font-bold text-ink">Review & Publish</h2>
              {summary && (
                <p className="text-sm text-ink-lighter mt-1">
                  {draftItems.length} of {summary.total_drafts} drafts still ready to publish.
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => void handleBulkPublish("selected")}
                disabled={bulkPublishing || draftItems.filter((item) => selectedDraftIds.includes(item.post_id)).length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-mono tracking-wide rounded-full border border-border-light text-ink-lighter hover:bg-parchment-dark/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {bulkPublishing ? <><Spinner /> Publishing...</> : `Publish Selected (${draftItems.filter((item) => selectedDraftIds.includes(item.post_id)).length})`}
              </button>
              <button
                onClick={() => void handleBulkPublish("all")}
                disabled={bulkPublishing || draftItems.length === 0}
                className="inline-flex items-center gap-2 bg-terracotta hover:bg-terracotta-light disabled:opacity-50 disabled:cursor-not-allowed text-white font-body font-medium text-sm px-5 py-2.5 rounded-full shadow-sm hover:shadow transition-all"
              >
                {bulkPublishing ? <><Spinner /> Publishing...</> : "Publish All"}
              </button>
            </div>
          </div>

          {summary && (
            <div className="px-6 py-5 border-b border-border grid grid-cols-1 md:grid-cols-4 gap-4 bg-parchment/50">
              <SummaryTile label="News reactions" value={summary.news_reactions} />
              <SummaryTile label="Cross replies" value={summary.cross_replies} />
              <SummaryTile label="Timeless reflections" value={summary.timeless_reflections} />
              <SummaryTile label="Philosophers used" value={summary.philosophers_used.length} />
            </div>
          )}

          <div className="px-6 py-6 space-y-8">
            <ReviewGroup
              title="News Reactions"
              description="Article-led reactions drafted from the selected news set."
              items={newsReactionItems}
              busyItemId={busyItemId}
              selectedDraftIds={selectedDraftIds}
              onToggleSelection={toggleDraftSelection}
              onPublish={handlePublishItem}
              onRegenerate={handleRegenerateItem}
              onDelete={handleDeleteItem}
            />
            <ReviewGroup
              title="Cross-Philosopher Replies"
              description="Second-order friction pulled from the sharpest reactions."
              items={crossReplyItems}
              busyItemId={busyItemId}
              selectedDraftIds={selectedDraftIds}
              onToggleSelection={toggleDraftSelection}
              onPublish={handlePublishItem}
              onRegenerate={handleRegenerateItem}
              onDelete={handleDeleteItem}
            />
            <ReviewGroup
              title="Timeless Reflections"
              description="Standalone reflections to keep the day&apos;s feed from becoming news-only."
              items={timelessItems}
              busyItemId={busyItemId}
              selectedDraftIds={selectedDraftIds}
              onToggleSelection={toggleDraftSelection}
              onPublish={handlePublishItem}
              onRegenerate={handleRegenerateItem}
              onDelete={handleDeleteItem}
            />
          </div>

          {summary && summary.errors.length > 0 && (
            <div className="px-6 py-5 border-t border-border bg-red-50/60">
              <p className="text-xs font-mono uppercase tracking-[0.3em] text-red-700 mb-3">Run notes</p>
              <ul className="space-y-2 text-sm text-red-800 list-disc pl-5">
                {summary.errors.map((entry) => (
                  <li key={entry}>{entry}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-white px-4 py-3">
      <p className="text-xs font-mono uppercase tracking-[0.25em] text-ink-lighter mb-1">{label}</p>
      <p className="font-serif text-2xl font-bold text-ink">{value}</p>
    </div>
  );
}

function ReviewGroup({
  title,
  description,
  items,
  busyItemId,
  selectedDraftIds,
  onToggleSelection,
  onPublish,
  onRegenerate,
  onDelete,
}: {
  title: string;
  description: string;
  items: ReviewItem[];
  busyItemId: string | null;
  selectedDraftIds: string[];
  onToggleSelection: (postId: string) => void;
  onPublish: (item: ReviewItem) => Promise<void> | void;
  onRegenerate: (item: ReviewItem) => Promise<void> | void;
  onDelete: (item: ReviewItem) => Promise<void> | void;
}) {
  if (items.length === 0) return null;

  return (
    <div>
      <div className="mb-4">
        <h3 className="font-serif text-xl font-bold text-ink">{title}</h3>
        <p className="text-sm text-ink-lighter mt-1">{description}</p>
      </div>
      <div className="space-y-4">
        {items.map((item) => {
          const stance = STANCE_CONFIG[item.stance];
          const isBusy = busyItemId === item.post_id;
          const isDraft = item.status === "draft";
          return (
            <article
              key={item.post_id}
              className="rounded-xl border border-border bg-parchment px-5 py-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-4 min-w-0 flex-1">
                  <input
                    type="checkbox"
                    checked={selectedDraftIds.includes(item.post_id)}
                    disabled={!isDraft}
                    onChange={() => onToggleSelection(item.post_id)}
                    className="mt-1 h-4 w-4 rounded border-border text-terracotta focus:ring-terracotta disabled:opacity-50"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className="font-serif font-bold text-lg text-ink">{item.philosopher_name}</span>
                      <span className={`inline-flex items-center px-2.5 py-1 text-[11px] font-mono tracking-wider uppercase rounded-full ${ITEM_STATUS_CLASSES[item.status]}`}>
                        {item.status}
                      </span>
                      <span className="inline-flex items-center px-2.5 py-1 text-[11px] font-mono tracking-wider uppercase rounded-full border border-border-light bg-white text-ink-lighter">
                        {item.length}
                      </span>
                      <span
                        className="inline-flex items-center px-2.5 py-1 text-[11px] font-mono tracking-wider uppercase rounded-full"
                        style={{
                          backgroundColor: stance.bg,
                          color: stance.color,
                          border: `1px solid ${stance.border}`,
                        }}
                      >
                        {stance.label}
                      </span>
                    </div>

                    {item.type === "news_reaction" && item.article_title && (
                      <p className="text-xs font-mono uppercase tracking-[0.25em] text-ink-lighter mb-2">
                        Reacting to {item.article_title}
                      </p>
                    )}
                    {item.type === "cross_reply" && item.reply_to_philosopher && (
                      <p className="text-xs font-mono uppercase tracking-[0.25em] text-ink-lighter mb-2">
                        {item.reply_to_philosopher} to {item.philosopher_name}
                      </p>
                    )}
                    {item.type === "timeless_reflection" && item.prompt_seed && (
                      <p className="text-xs font-mono uppercase tracking-[0.25em] text-ink-lighter mb-2">
                        {truncate(item.prompt_seed, 80)}
                      </p>
                    )}

                    <p className="font-serif text-xl font-bold text-ink leading-snug mb-3">
                      {item.thesis}
                    </p>
                    <div className="rounded-lg border border-border-light bg-white px-4 py-4">
                      <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">
                        {truncate(item.content, 320)}
                      </p>
                    </div>
                    <div className="mt-3 inline-flex items-center px-2.5 py-1 text-[11px] font-mono tracking-wider uppercase rounded-full border border-border-light bg-white text-ink-lighter">
                      {item.tag}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 lg:pl-4">
                  <button
                    onClick={() => void onPublish(item)}
                    disabled={!isDraft || isBusy}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-mono tracking-wide rounded-full text-white bg-[#276749] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isBusy ? <><Spinner /> Working</> : "Publish"}
                  </button>
                  <button
                    onClick={() => void onRegenerate(item)}
                    disabled={!isDraft || isBusy}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-mono tracking-wide rounded-full border border-border-light text-ink-lighter hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Regenerate
                  </button>
                  <button
                    onClick={() => void onDelete(item)}
                    disabled={!isDraft || isBusy}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-mono tracking-wide rounded-full border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

