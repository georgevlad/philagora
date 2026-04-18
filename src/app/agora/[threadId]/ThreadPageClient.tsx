"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { getQuestionTypeLabel } from "@/lib/agora";
import { useSession } from "@/lib/auth-client";
import type {
  AgoraRecommendation,
  AgoraSynthesisSections,
  AgoraThreadArticle,
  AgoraThreadDetail,
  AgoraThreadStatus,
  AgoraQuestionType,
  AgoraThreadVisibility,
  Philosopher,
} from "@/lib/types";
import { LeftSidebar } from "@/components/LeftSidebar";
import { MobileNav } from "@/components/MobileNav";
import { Footer } from "@/components/Footer";
import { PhilosopherAvatar } from "@/components/PhilosopherAvatar";
import { AIBadge } from "@/components/AIBadge";
import { SynthesisCard } from "@/components/SynthesisCard";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { timeAgo } from "@/lib/date-utils";

// Types for API response

interface ApiThread {
  id: string;
  question: string;
  asked_by: string;
  status: AgoraThreadStatus;
  question_type: AgoraQuestionType;
  recommendations_enabled: number;
  visibility: AgoraThreadVisibility;
  user_id?: string | null;
  follow_up_to?: string | null;
  article: AgoraThreadArticle | null;
  created_at: string;
}

interface ApiPhilosopher {
  id: string;
  name: string;
  initials: string;
  color: string;
  tradition: string;
}

interface ApiResponse {
  id: string;
  philosopher_id: string;
  posts: string[];
  recommendation?: AgoraRecommendation | null;
  sort_order: number;
  philosopher_name: string;
  philosopher_initials: string;
  philosopher_color: string;
  philosopher_tradition: string;
}

interface ApiSynthesis {
  type: AgoraQuestionType;
  sections: AgoraSynthesisSections;
}

interface ApiFollowUp {
  id: string;
  question: string;
  status: AgoraThreadStatus;
  created_at: string;
  responses: ApiResponse[];
  synthesis: ApiSynthesis | null;
}

interface ApiThreadData {
  thread: ApiThread;
  philosophers: ApiPhilosopher[];
  responses: ApiResponse[];
  synthesis: ApiSynthesis | null;
  followUp?: ApiFollowUp | null;
}

// Thinking messages per philosopher

function isThreadSettled(status: AgoraThreadStatus): boolean {
  return status === "complete" || status === "failed";
}

const thinkingMessages: Record<string, string> = {
  "marcus-aurelius": "Consulting his journal...",
  nietzsche: "Sharpening his aphorisms...",
  camus: "Contemplating the absurd...",
  seneca: "Composing a letter...",
  plato: "Ascending from the cave...",
  confucius: "Reflecting on the rites...",
  jung: "Exploring the unconscious...",
  dostoevsky: "Descending into the depths...",
  kierkegaard: "Taking a leap...",
  kant: "Examining his duties...",
  russell: "Checking the logic...",
  cicero: "Preparing his argument...",
};

function getThinkingMessage(philosopherId: string): string {
  return thinkingMessages[philosopherId] ?? "Considering your question...";
}

function recommendationMediumLabel(medium: AgoraRecommendation["medium"]): string {
  switch (medium) {
    case "film":
      return "Film";
    case "essay":
      return "Essay";
    case "album":
      return "Album";
    case "poem":
      return "Poem";
    case "play":
      return "Play";
    case "podcast":
      return "Podcast";
    case "speech":
      return "Speech";
    case "book":
    default:
      return "Book";
  }
}

// Response card (matches AgoraPageClient pattern)

function ResponseCard({
  response,
  delay,
}: {
  response: ApiResponse;
  delay: number;
}) {
  const ref = useScrollReveal(delay);

  return (
    <div
      ref={ref}
      className="animate-fade-in-up px-5 py-4 border-b border-border-light"
    >
      <div className="flex gap-3">
        <Link href={`/philosophers/${response.philosopher_id}`}>
          <PhilosopherAvatar
            philosopherId={response.philosopher_id}
            name={response.philosopher_name}
            color={response.philosopher_color}
            initials={response.philosopher_initials}
            size="lg"
          />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Link
              href={`/philosophers/${response.philosopher_id}`}
              className="font-serif font-semibold text-ink hover:text-athenian transition-colors duration-200"
            >
              {response.philosopher_name}
            </Link>
            <span
              className="text-xs font-mono px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: `${response.philosopher_color}15`,
                color: response.philosopher_color,
              }}
            >
              {response.philosopher_tradition}
            </span>
            <AIBadge className="ml-auto" />
          </div>

          <div
            className="space-y-3"
            style={{
              borderLeft: `2px solid ${response.philosopher_color}18`,
              paddingLeft: "14px",
            }}
          >
            {response.posts.map((post, i) => (
              <div
                key={i}
                className="prose-reading"
                style={{ whiteSpace: "pre-line" }}
              >
                {i > 0 && (
                  <div className="flex items-center gap-2 mb-1 text-[11px] font-mono text-ink-lighter">
                    {i + 1}/{response.posts.length}
                  </div>
                )}
                {post}
              </div>
            ))}
          </div>

          {response.recommendation && (
            <div
              className="mt-4 rounded-2xl border bg-parchment-dark/35 px-4 py-3"
              style={{
                borderColor: `${response.philosopher_color}25`,
                borderLeftColor: response.philosopher_color,
                borderLeftWidth: "3px",
              }}
            >
              <div className="mb-1.5 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-serif text-[16px] text-ink leading-tight">
                    {response.recommendation.title}
                    {response.recommendation.author ? ` by ${response.recommendation.author}` : ""}
                  </p>
                  <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-ink-faint mt-1">
                    {recommendationMediumLabel(response.recommendation.medium)}
                  </p>
                </div>
                <span
                  className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full px-2.5 py-1 text-center text-[10px] font-mono leading-none"
                  style={{
                    backgroundColor: `${response.philosopher_color}12`,
                    color: response.philosopher_color,
                  }}
                >
                  Go deeper
                </span>
              </div>
              <p className="text-sm text-ink-light leading-relaxed">
                {response.recommendation.reason}
              </p>
              <p className="mt-2 text-[11px] font-mono text-right uppercase tracking-[0.14em] text-ink-faint">
                {response.philosopher_name}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Thinking card (philosopher hasn't responded yet)

function ThinkingCard({ philosopher }: { philosopher: ApiPhilosopher }) {
  return (
    <div className="px-5 py-4 border-b border-border-light">
      <div className="flex gap-3">
        <div className="animate-pulse">
          <PhilosopherAvatar
            philosopherId={philosopher.id}
            name={philosopher.name}
            color={philosopher.color}
            initials={philosopher.initials}
            size="lg"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-serif font-semibold text-ink">
              {philosopher.name}
            </span>
            <span
              className="text-xs font-mono px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: `${philosopher.color}15`,
                color: philosopher.color,
              }}
            >
              {philosopher.tradition}
            </span>
          </div>
          <div
            className="animate-pulse"
            style={{
              borderLeft: `2px solid ${philosopher.color}25`,
              paddingLeft: "12px",
            }}
          >
            <p className="text-[15px] text-ink-lighter italic font-serif">
              {getThinkingMessage(philosopher.id)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main client component

export function ThreadPageClient({
  threadId,
  initialThread,
  philosophersMap,
  philosophers,
}: {
  threadId: string;
  initialThread: AgoraThreadDetail | null;
  philosophersMap: Record<string, Philosopher>;
  philosophers: Philosopher[];
}) {
  const [data, setData] = useState<ApiThreadData | null>(null);
  const [articleWarning, setArticleWarning] = useState<string | null>(null);
  const [followUpText, setFollowUpText] = useState("");
  const [followUpSubmitting, setFollowUpSubmitting] = useState(false);
  const [followUpError, setFollowUpError] = useState<string | null>(null);
  const [shareConfirm, setShareConfirm] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const { data: session } = useSession();
  const isLoggedIn = Boolean(session?.user);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const shareTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchThread = useCallback(async () => {
    try {
      const res = await fetch(`/api/agora/${threadId}`);
      if (res.status === 404) {
        setNotFound(true);
        setLoading(false);
        return null;
      }
      if (!res.ok) throw new Error("Failed to fetch");
      const json = (await res.json()) as ApiThreadData;
      setData(json);
      if (json.followUp) {
        setFollowUpError(null);
      }
      setLoading(false);
      return json;
    } catch {
      setLoading(false);
      return null;
    }
  }, [threadId]);

  function shouldPoll(result: ApiThreadData) {
    return (
      !isThreadSettled(result.thread.status)
      || Boolean(result.followUp && !isThreadSettled(result.followUp.status))
    );
  }

  // Initial fetch + start polling if needed
  useEffect(() => {
    const cleanup = () => {
      stopPolling();
      if (shareTimeoutRef.current) {
        clearTimeout(shareTimeoutRef.current);
        shareTimeoutRef.current = null;
      }
    };

    if (typeof window !== "undefined") {
      const key = `agora-article-warning:${threadId}`;
      const warning = sessionStorage.getItem(key);
      if (warning) {
        setArticleWarning(warning);
        sessionStorage.removeItem(key);
      }
    }

    // If we have a settled initial thread from the server, convert it to API shape
    // so we don't need an initial API call.
    if (initialThread && isThreadSettled(initialThread.status)) {
      const apiData = convertInitialThread(initialThread, philosophersMap);
      setData(apiData);
      setLoading(false);
      if (shouldPoll(apiData)) {
        startPolling();
      }
      return cleanup;
    }

    // Otherwise, fetch from API and potentially start polling
    fetchThread().then((result) => {
      if (result && shouldPoll(result)) {
        startPolling();
      }
    });

    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  function startPolling() {
    if (pollingRef.current) return;
    pollingRef.current = setInterval(async () => {
      const result = await fetchThread();
      if (result && !shouldPoll(result)) {
        stopPolling();
      }
    }, 4000);
  }

  function stopPolling() {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }

  async function handleFollowUpSubmit() {
    const trimmed = followUpText.trim();
    if (trimmed.length < 10 || followUpSubmitting || !data) return;

    setFollowUpSubmitting(true);
    setFollowUpError(null);

    try {
      const res = await fetch(`/api/agora/${data.thread.id}/follow-up`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to submit follow-up");
      }

      setFollowUpText("");
      startPolling();
      const result = await fetchThread();
      if (result && !shouldPoll(result)) {
        stopPolling();
      }
    } catch (error) {
      setFollowUpError(
        error instanceof Error ? error.message : "Failed to submit follow-up"
      );
    } finally {
      setFollowUpSubmitting(false);
    }
  }

  async function handleShareThread() {
    if (!data) return;

    const url = `${window.location.origin}/agora/${data.thread.id}`;
    const text = `"${data.thread.question}" — Philagora Agora`;

    if (navigator.share) {
      try {
        await navigator.share({ title: "Philagora", text, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setShareConfirm(true);
      if (shareTimeoutRef.current) {
        clearTimeout(shareTimeoutRef.current);
      }
      shareTimeoutRef.current = setTimeout(() => {
        setShareConfirm(false);
      }, 2000);
    } catch {
      // Ignore clipboard failures when sharing isn't available.
    }
  }

  // Not found state

  if (notFound) {
    return (
      <PageWrapper philosophers={philosophers}>
        <div className="text-center py-24">
          <div className="text-5xl mb-4 opacity-30">?</div>
          <h2 className="font-serif text-xl font-semibold text-ink mb-2">
            Thread Not Found
          </h2>
          <p className="text-sm text-ink-lighter font-body mb-6">
            This discussion may have been removed or never existed.
          </p>
        </div>
      </PageWrapper>
    );
  }

  // Loading state

  if (loading || !data) {
    return (
      <PageWrapper philosophers={philosophers}>
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-terracotta/30 border-t-terracotta rounded-full animate-spin" />
            <span className="text-sm text-ink-lighter font-body">
              Loading thread...
            </span>
          </div>
        </div>
      </PageWrapper>
    );
  }

  const isFailed = data.thread.status === "failed";
  const isGenerating = !isThreadSettled(data.thread.status);
  const isFollowUpThread = Boolean(data.thread.follow_up_to);
  const isThreadOwner = Boolean(
    session?.user?.id
    && data.thread.user_id
    && session.user.id === data.thread.user_id
  );
  const followUpIsGenerating = Boolean(
    data.followUp && !isThreadSettled(data.followUp.status)
  );
  const recommendations = data.responses
    .filter((response) => response.recommendation)
    .map((response) => ({
      philosopherName: response.philosopher_name,
      recommendation: response.recommendation as AgoraRecommendation,
    }));

  return (
    <PageWrapper philosophers={philosophers}>
      {data.thread.follow_up_to && (
        <div className="px-5 py-3 border-b border-border-light bg-parchment-dark/10">
          <Link
            href={`/agora/${data.thread.follow_up_to}`}
            className="text-[11px] font-mono text-athenian hover:text-athenian/80 transition-colors"
          >
            ← View original question
          </Link>
        </div>
      )}

      {/* Question header */}
      <div className="px-5 py-6 bg-parchment-dark/40 border-b border-border-light">
        <blockquote className="font-serif text-[22px] sm:text-[24px] leading-[1.5] text-ink text-center max-w-lg mx-auto px-4"
                    style={{ fontWeight: 500 }}>
          &ldquo;{data.thread.question}&rdquo;
        </blockquote>
        <p className="text-center mt-3">
          {data.thread.visibility !== "private" && (
            <>
              <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-ink-faint">
                Asked by
              </span>
              <span className="text-[13px] font-serif italic text-ink-lighter ml-2">
                {data.thread.asked_by}
              </span>
              <span className="text-ink-faint mx-2">&middot;</span>
            </>
          )}
          <span className="text-[11px] font-mono text-ink-lighter">
            {timeAgo(data.thread.created_at)}
          </span>
        </p>
        <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-athenian/8 text-athenian text-[10px] font-mono uppercase tracking-[0.16em]">
            {getQuestionTypeLabel(data.thread.question_type)}
          </span>
          {data.thread.visibility === "private" && (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.16em] text-ink-faint bg-parchment-dark/30 px-2 py-0.5 rounded-full">
              <svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="8" width="10" height="6" rx="1" />
                <path d="M5 8V5a3 3 0 016 0v3" />
              </svg>
              Private
            </span>
          )}
          <div className="inline-flex items-center gap-2">
            <button
              onClick={handleShareThread}
              className="inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-parchment-dark/30 transition-colors text-ink-lighter hover:text-athenian"
              title={shareConfirm ? "Link copied!" : "Share this thread"}
              aria-label={shareConfirm ? "Link copied!" : "Share this thread"}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 8V13C2 13.5523 2.44772 14 3 14H13C13.5523 14 14 13.5523 14 13V8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M8 2V10" strokeLinecap="round" />
                <path d="M5 5L8 2L11 5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {shareConfirm && (
              <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-athenian">
                Link copied!
              </span>
            )}
          </div>
        </div>

        {/* Philosopher avatars row */}
        <div className="flex items-center gap-2 mt-3">
          <span className="text-[11px] font-mono text-ink-lighter">
            {isGenerating ? "Responding:" : "Responded by:"}
          </span>
          <div className="flex -space-x-1.5">
            {data.philosophers.map((p) => (
              <div key={p.id} className="ring-2 ring-parchment-dark rounded-full">
                <PhilosopherAvatar
                  philosopherId={p.id}
                  name={p.name}
                  color={p.color}
                  initials={p.initials}
                  size="sm"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Generating indicator */}
        {isGenerating && (
          <div className="flex items-start gap-2 mt-3">
            <span className="relative flex h-2.5 w-2.5 mt-0.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-terracotta/60" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-terracotta" />
            </span>
            <div>
              <span className="text-xs font-mono text-terracotta">
                The philosophers are deliberating...
              </span>
              <p className="text-[11px] font-body text-ink-faint mt-0.5">
                Each thinker responds in turn — this usually takes a minute or two.
              </p>
            </div>
          </div>
        )}

        {isFailed && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center">
            <p className="text-sm font-body text-red-900">
              The philosophers were unable to respond to this question. Please
              try submitting again.
            </p>
          </div>
        )}
      </div>

      {articleWarning && (
        <div className="mx-5 mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-900 leading-relaxed">
            {articleWarning}
          </p>
        </div>
      )}

      {data.thread.article && (
        <div className="mx-5 mt-4 mb-2">
          <a
            href={data.thread.article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-xl border border-border-light/80 bg-[linear-gradient(135deg,rgba(248,243,234,0.6),rgba(255,255,255,0.5))] px-4 py-3.5 hover:border-athenian/30 hover:shadow-sm transition-all duration-200 group"
          >
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-8 h-8 rounded-lg bg-athenian/8 flex items-center justify-center mt-0.5">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-athenian">
                  <path d="M2 4h12M2 8h8M2 12h10" strokeLinecap="round" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-serif text-[15px] font-medium text-ink leading-snug line-clamp-2 group-hover:text-athenian transition-colors">
                  {data.thread.article.title || data.thread.article.source || "Open article"}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  {data.thread.article.source && (
                    <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-ink-faint">
                      {data.thread.article.source}
                    </span>
                  )}
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-lighter opacity-0 group-hover:opacity-100 transition-opacity">
                    <path d="M4 12L12 4M12 4H6M12 4V10" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                {data.thread.article.excerpt && (
                  <p className="mt-2 text-[13px] text-ink-light leading-relaxed line-clamp-2">
                    {data.thread.article.excerpt}
                  </p>
                )}
              </div>
            </div>
          </a>
        </div>
      )}

      {!isFailed && (
        <div>
          {data.philosophers.map((philosopher, idx) => {
            const response = data.responses.find(
              (r) => r.philosopher_id === philosopher.id
            );

            if (response) {
              return (
                <ResponseCard
                  key={philosopher.id}
                  response={response}
                  delay={idx * 3}
                />
              );
            }

            if (isGenerating) {
              return (
                <ThinkingCard key={philosopher.id} philosopher={philosopher} />
              );
            }

            return (
              <div
                key={philosopher.id}
                className="px-5 py-5 border-b border-border-light/60"
              >
                <div className="flex items-center gap-3 mb-2">
                  <PhilosopherAvatar
                    philosopherId={philosopher.id}
                    name={philosopher.name}
                    color={philosopher.color}
                    initials={philosopher.initials}
                    size="sm"
                  />
                  <span className="font-serif font-semibold text-ink">
                    {philosopher.name}
                  </span>
                </div>
                <p className="text-sm text-ink-lighter italic">
                  {philosopher.name} was unable to respond to this question. This
                  can happen occasionally. Try asking again.
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Synthesis section */}
      {!isFailed && data.synthesis && (
        <div className="px-5 py-5">
          <SynthesisCard type={data.synthesis.type} sections={data.synthesis.sections} />
          {recommendations.length > 0 && (
            <div className="mx-3 sm:mx-5 mt-6 rounded-lg border border-border-light bg-parchment-dark/30 px-5 py-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="text-[10px] font-mono tracking-[0.18em] uppercase text-ink-faint">
                  Go deeper
                </div>
                <div className="h-px flex-1 bg-border-light" />
              </div>
              <div className="space-y-2.5">
                {recommendations.map((item) => (
                  <div key={`${item.philosopherName}-${item.recommendation.title}`} className="text-sm text-ink-light leading-relaxed">
                    <span className="font-medium text-ink">{item.philosopherName}</span>
                    {" "}recommends:{" "}
                    <span className="font-serif text-ink">{item.recommendation.title}</span>
                    {item.recommendation.author ? ` by ${item.recommendation.author}` : ""}
                    {" "}({recommendationMediumLabel(item.recommendation.medium).toLowerCase()})
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Synthesis placeholder during generation */}
      {isGenerating && !data.synthesis && (
        <div className="px-5 py-6 border-t border-border-light">
          <div className="flex items-center gap-3 text-ink-lighter">
            <div className="w-5 h-5 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
            <p className="text-sm font-body italic">
              Weaving the editorial synthesis...
            </p>
          </div>
        </div>
      )}

      {/* Post-synthesis actions */}
      {!isFailed
        && data.thread.status === "complete"
        && !isFollowUpThread
        && isThreadOwner
        && (!data.followUp || followUpIsGenerating) && (
        <div className="px-5 py-6 border-t border-border-light">
          {!isFollowUpThread && !data.followUp && (
            <div className="mb-5">
              <div className="text-[10px] font-mono tracking-[0.2em] uppercase text-ink-faint mb-3">
                Continue the dialogue
              </div>
              <p className="text-[12px] font-body text-ink-lighter mb-3">
                If something surprised you or left you unconvinced, you can ask one follow-up.
              </p>
              <div className="rounded-2xl border border-border-light/80 bg-[linear-gradient(180deg,rgba(248,243,234,0.6),rgba(255,255,255,0.4))] p-4">
                <textarea
                  value={followUpText}
                  onChange={(event) => {
                    setFollowUpText(event.target.value);
                    if (followUpError) {
                      setFollowUpError(null);
                    }
                  }}
                  placeholder="What else would you like to ask these philosophers?"
                  maxLength={500}
                  rows={3}
                  className="w-full bg-transparent border-none text-[15px] font-body text-ink placeholder:text-ink-lighter/50 focus:outline-none resize-none leading-relaxed"
                />
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border-light/60">
                  <span className="text-[11px] font-mono text-ink-faint">
                    {followUpText.length}/500
                  </span>
                  <button
                    onClick={handleFollowUpSubmit}
                    disabled={followUpText.trim().length < 10 || followUpSubmitting}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-athenian text-white text-sm font-body hover:bg-athenian/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {followUpSubmitting ? "Submitting..." : "Ask follow-up"}
                  </button>
                </div>
                {followUpError && (
                  <p className="mt-2 text-sm text-red-700">{followUpError}</p>
                )}
              </div>
            </div>
          )}

          {!isFollowUpThread && followUpIsGenerating && data.followUp && (
            <div className="mb-5">
              <div className="text-[10px] font-mono tracking-[0.2em] uppercase text-ink-faint mb-3">
                Continue the dialogue
              </div>
              <div className="rounded-2xl border border-border-light/80 bg-[linear-gradient(180deg,rgba(248,243,234,0.6),rgba(255,255,255,0.4))] px-4 py-5">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-gold/30 border-t-gold rounded-full animate-spin shrink-0" />
                  <div>
                    <p className="text-sm font-body italic text-ink-light">
                      The philosophers are considering your follow-up...
                    </p>
                    <p className="text-[11px] font-body text-ink-faint mt-1">
                      This usually takes a minute or two. You can leave this page and come back.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Follow-up continuation */}
      {data.followUp && (
        <>
          <div className="px-5 py-4 border-t border-border-light">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
              <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-gold">
                Follow-up
              </span>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
            </div>
          </div>

          <div className="px-5 py-4">
            <blockquote className="font-serif text-[20px] sm:text-[24px] leading-[1.22] text-ink">
              &ldquo;{data.followUp.question}&rdquo;
            </blockquote>
            <div className="mt-2 text-[11px] font-mono uppercase tracking-[0.16em] text-ink-faint">
              {timeAgo(data.followUp.created_at)}
            </div>
          </div>

          {(data.followUp.status === "complete" || data.followUp.responses.length > 0) && (
            <div>
              {data.followUp.responses.map((response, index) => (
                <ResponseCard key={response.id} response={response} delay={index * 3} />
              ))}
            </div>
          )}

          {followUpIsGenerating && (
            <div className="px-5 py-6 text-center">
              <div className="w-6 h-6 border-2 border-gold/30 border-t-gold rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm font-body italic text-ink-lighter">
                The philosophers are considering your follow-up...
              </p>
              <p className="text-[11px] font-body text-ink-faint mt-1">
                This usually takes a minute or two.
              </p>
            </div>
          )}

          {data.followUp.status === "failed" && (
            <div className="px-5 py-4">
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-sm font-body text-red-900">
                  The philosophers were unable to complete this follow-up. You can start a new conversation instead.
                </p>
              </div>
            </div>
          )}

          {data.followUp.synthesis && (
            <div className="px-5 py-5">
              <SynthesisCard
                type={data.followUp.synthesis.type}
                sections={data.followUp.synthesis.sections}
              />
            </div>
          )}
        </>
      )}

      {!isFailed && data.thread.status === "complete" && !isLoggedIn && (
        <div className="mx-5 mt-1 mb-2 rounded-2xl border border-gold/20 bg-[linear-gradient(135deg,rgba(248,243,234,0.95),rgba(238,230,216,0.85))] px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-gold/12 flex items-center justify-center shrink-0 mt-0.5">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" className="text-gold">
                <path d="M10 2L3 6V7H17V6L10 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M5 7V14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M10 7V14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M15 7V14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M3 14H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M2 17H18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-body text-ink leading-[1.55]">
                Some questions are personal.{" "}
                <Link
                  href="/sign-in"
                  className="font-medium text-athenian hover:text-athenian-light transition-colors underline underline-offset-2 decoration-athenian/30"
                >
                  Sign in
                </Link>
                {" "}to ask private questions, save threads, and bookmark posts from the feed.
              </p>
            </div>
          </div>
        </div>
      )}

      {!isFailed && data.thread.status === "complete" && !followUpIsGenerating && (
        <div className="px-5 py-6 border-t border-border-light">
          <div className="flex items-center justify-center gap-x-6 gap-y-3 flex-wrap">
            <button
              onClick={handleShareThread}
              className="inline-flex items-center gap-2 text-[12px] font-mono text-ink-lighter hover:text-athenian transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 8V13C2 13.5523 2.44772 14 3 14H13C13.5523 14 14 13.5523 14 13V8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M8 2V10" strokeLinecap="round" />
                <path d="M5 5L8 2L11 5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {shareConfirm ? "Link copied!" : "Share this thread"}
            </button>

            <Link
              href="/agora"
              className="inline-flex items-center gap-1.5 text-[12px] font-mono text-ink-lighter hover:text-athenian transition-colors"
            >
              New conversation
            </Link>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}

// Page layout wrapper

function PageWrapper({
  children,
  philosophers,
}: {
  children: React.ReactNode;
  philosophers: Philosopher[];
}) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row pt-14 lg:pt-0 overflow-x-hidden">
      <LeftSidebar philosophers={philosophers} />
      <MobileNav />
      <main className="flex-1 min-w-0 lg:border-l border-border-light">
        <div className="max-w-[700px] mx-auto">
          {children}
        </div>
        <Footer />
        <div className="pb-20 lg:pb-0" />
      </main>
    </div>
  );
}

// Convert server-side AgoraThreadDetail to API shape

function convertInitialThread(
  thread: AgoraThreadDetail,
  philosophersMap: Record<string, Philosopher>
): ApiThreadData {
  return {
      thread: {
        id: thread.id,
        question: thread.question,
        asked_by: thread.askedBy,
        status: thread.status,
        question_type: thread.questionType,
        recommendations_enabled: thread.recommendationsEnabled ? 1 : 0,
        visibility: thread.visibility,
        user_id: thread.userId ?? null,
        follow_up_to: thread.followUpTo ?? null,
        article: thread.article,
        created_at: thread.createdAt,
      },
    philosophers: thread.philosophers.map((pid) => {
      const p = philosophersMap[pid];
      return {
        id: pid,
        name: p?.name ?? pid,
        initials: p?.initials ?? "??",
        color: p?.color ?? "#7D7468",
        tradition: p?.tradition ?? "",
      };
    }),
    responses: thread.responses.map((r) => ({
      id: `${r.philosopherId}-${r.sortOrder}`,
      philosopher_id: r.philosopherId,
      posts: r.posts,
      recommendation: r.recommendation ?? null,
      sort_order: r.sortOrder,
      philosopher_name: r.philosopherName,
      philosopher_initials: r.philosopherInitials,
      philosopher_color: r.philosopherColor,
      philosopher_tradition: r.philosopherTradition,
    })),
    synthesis: thread.synthesis
      ? {
          type: thread.synthesis.type,
          sections: thread.synthesis.sections,
        }
      : null,
    followUp: thread.followUp
      ? {
          id: thread.followUp.id,
          question: thread.followUp.question,
          status: thread.followUp.status,
          created_at: thread.followUp.createdAt,
          responses: thread.followUp.responses.map((response) => ({
            id: `${response.philosopherId}-${response.sortOrder}`,
            philosopher_id: response.philosopherId,
            posts: response.posts,
            recommendation: response.recommendation ?? null,
            sort_order: response.sortOrder,
            philosopher_name: response.philosopherName,
            philosopher_initials: response.philosopherInitials,
            philosopher_color: response.philosopherColor,
            philosopher_tradition: response.philosopherTradition,
          })),
          synthesis: thread.followUp.synthesis
            ? {
                type: thread.followUp.synthesis.type,
                sections: thread.followUp.synthesis.sections,
              }
            : null,
        }
      : null,
  };
}
