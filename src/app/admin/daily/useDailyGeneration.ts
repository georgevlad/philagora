import { useState } from "react";
import type React from "react";
import {
  DEFAULT_CONFIG,
  parseJson,
  type CandidateArticle,
  type DailyGeneratedItem,
  type DailySummary,
  type DraftStatus,
  type PhilosopherUsage,
  type PipelineResult,
  type RawCandidateArticle,
  type ReviewItem,
} from "./types";

export function useDailyGeneration({
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
}: {
  selectedArticleIds: string[];
  config: typeof DEFAULT_CONFIG;
  setArticles: React.Dispatch<React.SetStateAction<CandidateArticle[]>>;
  setPhilosopherUsage: React.Dispatch<React.SetStateAction<Record<string, PhilosopherUsage>>>;
  setSummary: React.Dispatch<React.SetStateAction<DailySummary | null>>;
  setReviewItems: React.Dispatch<React.SetStateAction<ReviewItem[]>>;
  setSelectedDraftIds: React.Dispatch<React.SetStateAction<string[]>>;
  setSelectedArticleIds: React.Dispatch<React.SetStateAction<string[]>>;
  setPipelineResult: React.Dispatch<React.SetStateAction<PipelineResult | null>>;
  setError: (msg: string | null) => void;
  setNotice: (msg: string | null) => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [loadingArticles, setLoadingArticles] = useState(false);

  function normalizeCandidate(article: RawCandidateArticle): CandidateArticle {
    return {
      ...article,
      suggested_philosophers: parseJson<string[]>(article.suggested_philosophers, []),
      suggested_stances: parseJson<Record<string, string>>(article.suggested_stances, {}),
      published_posts: article.published_posts ?? [],
    };
  }

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

  return {
    generating,
    pipelineRunning,
    loadingArticles,
    handleFetchAndScore,
    handleGenerateDailyFeed,
    loadCandidates,
  };
}
