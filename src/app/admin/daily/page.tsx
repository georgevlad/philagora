"use client";

import { useEffect, useMemo, useState } from "react";
import { Spinner } from "@/components/Spinner";
import {
  DEFAULT_CONFIG,
  LENGTH_OPTIONS,
  TOPIC_CLUSTER_LABELS,
  parseJson,
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
import { ReviewGroup, SummaryTile } from "./ReviewGroup";
import { getTopicClusterKey, pickDiverseArticles } from "./utils";
import { useDailyGeneration } from "./useDailyGeneration";
import { useReviewActions } from "./useReviewActions";

export default function DailyContentPage() {
  const [philosophers, setPhilosophers] = useState<Philosopher[]>([]);
  const [articles, setArticles] = useState<CandidateArticle[]>([]);
  const [philosopherUsage, setPhilosopherUsage] = useState<Record<string, PhilosopherUsage>>({});
  const [selectedArticleIds, setSelectedArticleIds] = useState<string[]>([]);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [loadingSetup, setLoadingSetup] = useState(true);
  const [pipelineResult, setPipelineResult] = useState<PipelineResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedDraftIds, setSelectedDraftIds] = useState<string[]>([]);

  const {
    busyItemId,
    bulkPublishing,
    handlePublishItem,
    handleDeleteItem,
    handleRegenerateItem,
    handleBulkPublish,
  } = useReviewActions({
    reviewItems,
    setReviewItems,
    selectedDraftIds,
    setSelectedDraftIds,
    setError,
    setNotice,
  });

  const {
    generating,
    pipelineRunning,
    loadingArticles,
    handleFetchAndScore,
    handleGenerateDailyFeed,
    loadCandidates,
  } = useDailyGeneration({
    selectedArticleIds,
    config,
    setArticles,
    setPhilosopherUsage,
    setSummary,
    setReviewItems,
    setSelectedDraftIds,
    setSelectedArticleIds,
    setPipelineResult,
    setError,
    setNotice,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      setLoadingSetup(true);
      try {
        const [philosopherRes, candidateRes, usageRes] = await Promise.all([
          fetch("/api/admin/philosophers"),
          fetch("/api/admin/news-scout/candidates?status=scored&mode=diverse"),
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
        setSelectedArticleIds(
          pickDiverseArticles(
            [...normalizedCandidates].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)),
            3
          )
        );
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


  function normalizeCandidate(article: RawCandidateArticle): CandidateArticle {
    return {
      ...article,
      suggested_philosophers: parseJson<string[]>(article.suggested_philosophers, []),
      suggested_stances: parseJson<Record<string, string>>(article.suggested_stances, {}),
      published_posts: article.published_posts ?? [],
    };
  }

  function updateNumberConfig(
    key: "reactions_per_article" | "cross_replies" | "timeless_reflections" | "quips" | "cultural_recommendations",
    value: string
  ) {
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




  const expectedNewsReactions = selectedArticleIds.length * config.reactions_per_article;
  const expectedCrossReplies = Math.min(config.cross_replies, expectedNewsReactions);
  const estimatedTotal =
    expectedNewsReactions +
    expectedCrossReplies +
    config.quips +
    config.timeless_reflections +
    config.cultural_recommendations;
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
  const groupedArticles = useMemo(() => {
    const groups: Array<{
      cluster: string;
      label: string;
      color: string;
      articles: CandidateArticle[];
    }> = [];
    const clusterMap = new Map<string, CandidateArticle[]>();

    for (const article of articles) {
      const cluster = getTopicClusterKey(article.topic_cluster);
      if (!clusterMap.has(cluster)) {
        clusterMap.set(cluster, []);
      }
      clusterMap.get(cluster)?.push(article);
    }

    for (const [cluster, clusterArticles] of clusterMap) {
      const config = TOPIC_CLUSTER_LABELS[cluster];
      groups.push({
        cluster,
        label: config?.label ?? "Other",
        color: config?.color ?? "bg-stone-100 text-stone-700 border-stone-200",
        articles: clusterArticles,
      });
    }

    return groups;
  }, [articles]);
  const activePhilosophers = useMemo(
    () => philosophers.filter((philosopher) => philosopher.is_active !== 0),
    [philosophers]
  );
  const draftItems = reviewItems.filter((item) => item.status === "draft");
  const newsReactionItems = reviewItems.filter((item) => item.type === "news_reaction");
  const crossReplyItems = reviewItems.filter((item) => item.type === "cross_reply");
  const quipItems = reviewItems.filter((item) => item.type === "quip");
  const timelessItems = reviewItems.filter((item) => item.type === "timeless_reflection");
  const recommendationItems = reviewItems.filter((item) => item.type === "cultural_recommendation");

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
              {groupedArticles.map((group, groupIndex) => (
                <div key={group.cluster} className="space-y-3">
                  <div className={`flex items-center gap-2 mb-2 ${groupIndex === 0 ? "" : "pt-2"}`}>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-mono font-medium border ${group.color}`}>
                      {group.label}
                    </span>
                    <span className="text-xs text-ink-lighter">
                      {group.articles.length} article{group.articles.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  {group.articles.map((article) => {
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
              ))}
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
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-5">
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
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-ink-lighter mb-2">
                Glints
              </label>
              <input
                type="number"
                min={0}
                max={4}
                value={config.quips}
                onChange={(event) => updateNumberConfig("quips", event.target.value)}
                className="w-full rounded-lg border border-border bg-parchment px-4 py-2.5 text-sm text-ink font-body focus:outline-none focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-ink-lighter mb-2">
                Cultural recommendations
              </label>
              <input
                type="number"
                min={0}
                max={4}
                value={config.cultural_recommendations}
                onChange={(event) => updateNumberConfig("cultural_recommendations", event.target.value)}
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
                {expectedNewsReactions} news reactions + {expectedCrossReplies} cross-replies + {config.quips} glints + {config.timeless_reflections} reflections + {config.cultural_recommendations} recommendations using about {estimatedTotal} generation calls.
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
            <div className="px-6 py-5 border-b border-border grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4 bg-parchment/50">
              <SummaryTile label="News reactions" value={summary.news_reactions} />
              <SummaryTile label="Cross replies" value={summary.cross_replies} />
              <SummaryTile label="Glints" value={summary.quips} />
              <SummaryTile label="Timeless reflections" value={summary.timeless_reflections} />
              <SummaryTile label="Recommendations" value={summary.cultural_recommendations} />
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
              title="Glints"
              description="Short, cutting headline reactions pulled from the same article set."
              items={quipItems}
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
            <ReviewGroup
              title="Cultural Recommendations"
              description="Prompt-led recommendations that route films, books, and albums through each philosopher&apos;s worldview."
              items={recommendationItems}
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
