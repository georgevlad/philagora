"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import type { Philosopher, AgoraThreadDetail } from "@/lib/types";
import { LeftSidebar } from "@/components/LeftSidebar";
import { MobileNav } from "@/components/MobileNav";
import { Footer } from "@/components/Footer";
import { PhilosopherAvatar } from "@/components/PhilosopherAvatar";
import { AIBadge } from "@/components/AIBadge";
import { SynthesisCard } from "@/components/SynthesisCard";
import { useScrollReveal } from "@/hooks/useScrollReveal";

// ── Types for API response ───────────────────────────────────────────

interface ApiThread {
  id: string;
  question: string;
  asked_by: string;
  status: string;
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
  sort_order: number;
  philosopher_name: string;
  philosopher_initials: string;
  philosopher_color: string;
  philosopher_tradition: string;
}

interface ApiSynthesis {
  tensions: string[];
  agreements: string[];
  practical_takeaways: string[];
}

interface ApiThreadData {
  thread: ApiThread;
  philosophers: ApiPhilosopher[];
  responses: ApiResponse[];
  synthesis: ApiSynthesis | null;
}

// ── Thinking messages per philosopher ────────────────────────────────

const thinkingMessages: Record<string, string> = {
  "marcus-aurelius": "Consulting his journal…",
  nietzsche: "Sharpening his aphorisms…",
  camus: "Contemplating the absurd…",
  seneca: "Composing a letter…",
  plato: "Ascending from the cave…",
  confucius: "Reflecting on the rites…",
  jung: "Exploring the unconscious…",
  dostoevsky: "Descending into the depths…",
  kierkegaard: "Taking a leap…",
  kant: "Examining his duties…",
  russell: "Checking the logic…",
  cicero: "Preparing his argument…",
};

function getThinkingMessage(philosopherId: string): string {
  return thinkingMessages[philosopherId] ?? "Considering your question…";
}

// ── Response card (matches AgoraPageClient pattern) ──────────────────

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
              className="font-serif font-bold text-ink hover:text-athenian transition-colors duration-200"
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
              borderLeft: `2px solid ${response.philosopher_color}25`,
              paddingLeft: "12px",
            }}
          >
            {response.posts.map((post, i) => (
              <div
                key={i}
                className="text-[15px] text-ink"
                style={{ lineHeight: "1.7", whiteSpace: "pre-line" }}
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
        </div>
      </div>
    </div>
  );
}

// ── Thinking card (philosopher hasn't responded yet) ─────────────────

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
            <span className="font-serif font-bold text-ink">
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

// ── Main client component ────────────────────────────────────────────

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
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      setLoading(false);
      return json;
    } catch {
      setLoading(false);
      return null;
    }
  }, [threadId]);

  // Initial fetch + start polling if needed
  useEffect(() => {
    // If we have a complete initial thread from the server, convert it to API shape
    // so we don't need an initial API call
    if (initialThread && initialThread.status === "complete") {
      const apiData = convertInitialThread(initialThread, philosophersMap);
      setData(apiData);
      setLoading(false);
      return;
    }

    // Otherwise, fetch from API and potentially start polling
    fetchThread().then((result) => {
      if (result && result.thread.status !== "complete") {
        startPolling();
      }
    });

    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  function startPolling() {
    if (pollingRef.current) return;
    pollingRef.current = setInterval(async () => {
      const result = await fetchThread();
      if (result && result.thread.status === "complete") {
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

  // ── Not found state ─────────────────────────────────────────────

  if (notFound) {
    return (
      <PageWrapper philosophers={philosophers}>
        <div className="text-center py-24">
          <div className="text-5xl mb-4 opacity-30">🏛️</div>
          <h2 className="font-serif text-xl font-bold text-ink mb-2">
            Thread Not Found
          </h2>
          <p className="text-sm text-ink-lighter font-body mb-6">
            This discussion may have been removed or never existed.
          </p>
        </div>
      </PageWrapper>
    );
  }

  // ── Loading state ───────────────────────────────────────────────

  if (loading || !data) {
    return (
      <PageWrapper philosophers={philosophers}>
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-terracotta/30 border-t-terracotta rounded-full animate-spin" />
            <span className="text-sm text-ink-lighter font-body">
              Loading thread…
            </span>
          </div>
        </div>
      </PageWrapper>
    );
  }

  const isGenerating = data.thread.status !== "complete";
  const respondedIds = new Set(data.responses.map((r) => r.philosopher_id));

  return (
    <PageWrapper philosophers={philosophers}>
      {/* ── Question header ──────────────────────────────────────── */}
      <div className="px-5 py-5 bg-parchment-dark/40 border-b border-border-light">
        <div className="flex items-center gap-2 mb-2 text-[11px] font-mono text-ink-lighter">
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="8" cy="8" r="6" />
            <path
              d="M6 6.5C6 5.5 6.8 5 8 5C9.2 5 10 5.7 10 6.5C10 7.5 8 7.5 8 9"
              strokeLinecap="round"
            />
            <circle cx="8" cy="11" r="0.5" fill="currentColor" />
          </svg>
          {data.thread.asked_by} &middot;{" "}
          {new Date(data.thread.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </div>

        <h1 className="font-serif text-xl lg:text-2xl font-bold text-ink leading-snug">
          &ldquo;{data.thread.question}&rdquo;
        </h1>

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
          <div className="flex items-center gap-2 mt-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-terracotta/60" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-terracotta" />
            </span>
            <span className="text-xs font-mono text-terracotta">
              Philosophers are considering your question…
            </span>
          </div>
        )}
      </div>

      {/* ── Responses / thinking cards ───────────────────────────── */}
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

          // Philosopher hasn't responded yet — show thinking card
          if (isGenerating) {
            return (
              <ThinkingCard key={philosopher.id} philosopher={philosopher} />
            );
          }

          // Thread is complete but philosopher has no response (generation failed)
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
                <span className="font-serif font-bold text-ink">
                  {philosopher.name}
                </span>
              </div>
              <p className="text-sm text-ink-lighter italic">
                {philosopher.name} was unable to respond to this question. This
                can happen occasionally — try asking again.
              </p>
            </div>
          );
        })}
      </div>

      {/* ── Synthesis section ────────────────────────────────────── */}
      {data.synthesis && (
        <div className="px-5 py-5">
          <SynthesisCard
            tensions={data.synthesis.tensions}
            agreements={data.synthesis.agreements}
            questionsOrTakeaways={data.synthesis.practical_takeaways}
            questionsLabel="Practical Takeaways"
          />
        </div>
      )}

      {/* Synthesis placeholder during generation */}
      {isGenerating && !data.synthesis && (
        <div className="px-5 py-6 border-t border-border-light">
          <div className="flex items-center gap-3 text-ink-lighter">
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="opacity-40"
            >
              <path d="M8 1L10 5.5L15 6.5L11.5 10L12.5 15L8 12.5L3.5 15L4.5 10L1 6.5L6 5.5L8 1Z" />
            </svg>
            <p className="text-sm font-body italic">
              The editorial synthesis will appear once all philosophers have
              responded.
            </p>
          </div>
        </div>
      )}

      {/* ── CTA to ask a new question ────────────────────────────── */}
      {!isGenerating && (
        <div className="px-5 py-6 border-t border-border-light text-center">
          <Link
            href="/agora"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-mono text-sm text-white bg-athenian hover:bg-athenian/90 transition-colors duration-200"
          >
            Ask your own question
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                d="M3 8H13M10 5L13 8L10 11"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </div>
      )}
    </PageWrapper>
  );
}

// ── Page layout wrapper ──────────────────────────────────────────────

function PageWrapper({
  children,
  philosophers,
}: {
  children: React.ReactNode;
  philosophers: Philosopher[];
}) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row pt-14 lg:pt-0">
      <LeftSidebar philosophers={philosophers} />
      <MobileNav />
      <main className="flex-1 min-w-0 lg:border-l border-border-light">
        <div className="max-w-[700px] mx-auto">
          {children}
        </div>
        <Footer />
      </main>
    </div>
  );
}

// ── Convert server-side AgoraThreadDetail to API shape ───────────────

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
      sort_order: r.sortOrder,
      philosopher_name: r.philosopherName,
      philosopher_initials: r.philosopherInitials,
      philosopher_color: r.philosopherColor,
      philosopher_tradition: r.philosopherTradition,
    })),
    synthesis: thread.synthesis
      ? {
          tensions: thread.synthesis.tensions,
          agreements: thread.synthesis.agreements,
          practical_takeaways: thread.synthesis.practicalTakeaways,
        }
      : null,
  };
}
