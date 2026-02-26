"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Philosopher, AgoraThreadDetail } from "@/lib/types";
import { LeftSidebar } from "@/components/LeftSidebar";
import { MobileNav } from "@/components/MobileNav";
import { Footer } from "@/components/Footer";
import { PhilosopherAvatar } from "@/components/PhilosopherAvatar";
import { AIBadge } from "@/components/AIBadge";
import { SynthesisCard } from "@/components/SynthesisCard";
import { useScrollReveal } from "@/hooks/useScrollReveal";

// ── Types ────────────────────────────────────────────────────────────

interface SelectablePhilosopher {
  id: string;
  name: string;
  tradition: string;
  color: string;
  initials: string;
}

interface FeaturedThread {
  id: string;
  question: string;
  asked_by: string;
  created_at: string;
  philosophers: {
    id: string;
    name: string;
    initials: string;
    color: string;
    tradition: string;
  }[];
}

// ── Sub-components (existing patterns preserved) ─────────────────────

function AgoraResponseCard({
  philosopherId,
  posts,
  delay,
  philosophersMap,
}: {
  philosopherId: string;
  posts: string[];
  delay: number;
  philosophersMap: Record<string, Philosopher>;
}) {
  const ref = useScrollReveal(delay);
  const philosopher = philosophersMap[philosopherId];
  if (!philosopher) return null;

  return (
    <div ref={ref} className="animate-fade-in-up px-5 py-4 border-b border-border-light">
      <div className="flex gap-3">
        <Link href={`/philosophers/${philosopherId}`}>
          <PhilosopherAvatar
            philosopherId={philosopherId}
            name={philosopher.name}
            color={philosopher.color}
            initials={philosopher.initials}
          />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Link
              href={`/philosophers/${philosopherId}`}
              className="font-serif font-bold text-ink hover:text-athenian transition-colors duration-200"
            >
              {philosopher.name}
            </Link>
            <span
              className="text-xs font-mono px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: `${philosopher.color}15`,
                color: philosopher.color,
              }}
            >
              {philosopher.tradition}
            </span>
            <AIBadge className="ml-auto" />
          </div>

          <div
            className="space-y-3"
            style={{
              borderLeft: `2px solid ${philosopher.color}25`,
              paddingLeft: "12px",
            }}
          >
            {posts.map((post, i) => (
              <div key={i} className="text-[15px] text-ink" style={{ lineHeight: "1.7" }}>
                {i > 0 && (
                  <div className="flex items-center gap-2 mb-1 text-[11px] font-mono text-ink-lighter">
                    {i + 1}/{posts.length}
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

function AgoraThreadCardExpanded({
  thread,
  index,
  philosophersMap,
}: {
  thread: AgoraThreadDetail;
  index: number;
  philosophersMap: Record<string, Philosopher>;
}) {
  return (
    <div className="border border-border rounded-lg overflow-hidden bg-white/40 mb-8" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
      {/* Question header */}
      <div className="px-5 py-4 bg-parchment-dark/40 border-b border-border-light">
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
            <path d="M6 6.5C6 5.5 6.8 5 8 5C9.2 5 10 5.7 10 6.5C10 7.5 8 7.5 8 9" strokeLinecap="round" />
            <circle cx="8" cy="11" r="0.5" fill="currentColor" />
          </svg>
          {thread.askedBy} &middot; {thread.createdAt}
        </div>
        <Link href={`/agora/${thread.id}`}>
          <h3 className="font-serif text-lg font-bold text-ink leading-snug hover:text-athenian transition-colors duration-200">
            &ldquo;{thread.question}&rdquo;
          </h3>
        </Link>
        <div className="flex items-center gap-2 mt-3">
          <span className="text-[11px] font-mono text-ink-lighter">Responded by:</span>
          <div className="flex -space-x-1.5">
            {thread.philosophers.map((pId) => {
              const p = philosophersMap[pId];
              return p ? (
                <div key={pId} className="ring-2 ring-parchment-dark rounded-full">
                  <PhilosopherAvatar
                    philosopherId={pId}
                    name={p.name}
                    color={p.color}
                    initials={p.initials}
                    size="sm"
                  />
                </div>
              ) : null;
            })}
          </div>
        </div>
      </div>

      {/* Responses */}
      {thread.responses.map((response, i) => (
        <AgoraResponseCard
          key={response.philosopherId}
          philosopherId={response.philosopherId}
          posts={response.posts}
          delay={index * 4 + i}
          philosophersMap={philosophersMap}
        />
      ))}

      {/* Synthesis */}
      {thread.synthesis && (
        <SynthesisCard
          tensions={thread.synthesis.tensions}
          agreements={thread.synthesis.agreements}
          questionsOrTakeaways={thread.synthesis.practicalTakeaways}
          questionsLabel="Practical Takeaways"
        />
      )}
    </div>
  );
}

// ── Featured thread card (from API) ──────────────────────────────────

function FeaturedThreadCard({ thread }: { thread: FeaturedThread }) {
  const ref = useScrollReveal();
  const questionPreview =
    thread.question.length > 120
      ? thread.question.slice(0, 117).replace(/\s+\S*$/, "") + "…"
      : thread.question;

  return (
    <Link href={`/agora/${thread.id}`}>
      <div
        ref={ref}
        className="animate-fade-in-up border border-border rounded-lg overflow-hidden bg-white/40 mb-4 hover:border-athenian/30 hover:bg-parchment-dark/20 transition-all duration-200 cursor-pointer"
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
      >
        <div className="px-5 py-4">
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
              <path d="M6 6.5C6 5.5 6.8 5 8 5C9.2 5 10 5.7 10 6.5C10 7.5 8 7.5 8 9" strokeLinecap="round" />
              <circle cx="8" cy="11" r="0.5" fill="currentColor" />
            </svg>
            {thread.asked_by} &middot;{" "}
            {new Date(thread.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </div>
          <h3 className="font-serif text-base font-bold text-ink leading-snug mb-3">
            &ldquo;{questionPreview}&rdquo;
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-ink-lighter">Responded by:</span>
            <div className="flex -space-x-1.5">
              {thread.philosophers.map((p) => (
                <div key={p.id} className="ring-2 ring-parchment rounded-full">
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
        </div>
      </div>
    </Link>
  );
}

// ── Main page component ──────────────────────────────────────────────

export function AgoraPageClient({
  philosophersMap,
  philosophers,
  threads,
}: {
  philosophersMap: Record<string, Philosopher>;
  philosophers: Philosopher[];
  threads: AgoraThreadDetail[];
}) {
  const router = useRouter();
  const firstThread = threads[0];

  // ── Form state ──────────────────────────────────────────────────
  const [question, setQuestion] = useState("");
  const [askedBy, setAskedBy] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // ── Philosopher list from API ───────────────────────────────────
  const [selectablePhilosophers, setSelectablePhilosophers] = useState<SelectablePhilosopher[]>([]);

  useEffect(() => {
    async function loadPhilosophers() {
      try {
        const res = await fetch("/api/philosophers");
        if (res.ok) {
          const data = await res.json();
          setSelectablePhilosophers(data);
        }
      } catch {
        // Fall back silently
      }
    }
    loadPhilosophers();
  }, []);

  // ── Featured threads from API ───────────────────────────────────
  const [featuredThreads, setFeaturedThreads] = useState<FeaturedThread[]>([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);

  useEffect(() => {
    async function loadFeatured() {
      try {
        const res = await fetch("/api/agora/featured");
        if (res.ok) {
          const data = await res.json();
          setFeaturedThreads(data.threads ?? []);
        }
      } catch {
        // Fall back silently
      } finally {
        setFeaturedLoading(false);
      }
    }
    loadFeatured();
  }, []);

  // ── Form logic ──────────────────────────────────────────────────
  const trimmedQuestion = question.trim();
  const charCount = trimmedQuestion.length;
  const isValid = charCount >= 10 && charCount <= 500 && selectedIds.length >= 2 && selectedIds.length <= 4;
  const atMaxSelection = selectedIds.length >= 4;

  function togglePhilosopher(id: string) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  }

  async function handleSubmit() {
    if (!isValid || submitting) return;

    setSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch("/api/agora/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmedQuestion,
          asked_by: askedBy.trim() || undefined,
          philosopher_ids: selectedIds,
        }),
      });

      if (res.status === 429) {
        const data = await res.json();
        setFormError(data.error || "Rate limit reached. Try again later.");
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        setFormError(data.error || "Something went wrong. Please try again.");
        return;
      }

      const data = await res.json();
      router.push(`/agora/${data.threadId}`);
    } catch {
      setFormError("Failed to submit. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row pt-14 lg:pt-0">
      <LeftSidebar philosophers={philosophers} />
      <MobileNav />

      <main className="flex-1 min-w-0 lg:border-l border-border-light">
        <div className="max-w-[700px] mx-auto">
          {/* ── Hero + form section ──────────────────────────────── */}
          <div className="px-5 pt-8 pb-8 border-b border-border-light">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-ink-lighter hover:text-athenian transition-colors duration-200 mb-4"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M10 4L6 8L10 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Back to Feed
            </Link>

            <h1 className="font-serif text-2xl lg:text-3xl font-bold text-ink leading-tight mb-2">
              Ask the Philosophers
            </h1>
            <p className="text-[15px] text-ink-light leading-relaxed mb-6 max-w-lg">
              Pose your question to history&apos;s greatest thinkers. They&apos;ll each
              respond through their own philosophical framework.
            </p>

            {/* ── Question textarea ─────────────────────────────── */}
            <div
              className="rounded-xl p-1 mb-4"
              style={{
                background:
                  "linear-gradient(135deg, rgba(196, 112, 63, 0.08), rgba(240, 235, 227, 0.5))",
              }}
            >
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Should I quit my stable job to pursue my passion?"
                rows={3}
                maxLength={500}
                className="w-full px-4 py-3.5 bg-white/70 border border-border rounded-lg text-[15px] text-ink placeholder:text-ink-lighter/60 focus:outline-none focus:border-athenian/40 focus:ring-2 focus:ring-athenian/10 resize-none transition-all duration-200"
              />
            </div>

            <div className="flex items-center justify-between mb-5">
              <span
                className={`text-xs font-mono ${
                  charCount > 0 && charCount < 10
                    ? "text-terracotta"
                    : charCount >= 450
                      ? "text-terracotta"
                      : "text-ink-lighter"
                }`}
              >
                {charCount}/500
              </span>
              {charCount > 0 && charCount < 10 && (
                <span className="text-xs font-mono text-terracotta">
                  At least 10 characters
                </span>
              )}
            </div>

            {/* ── Optional name ─────────────────────────────────── */}
            <div className="mb-5">
              <label className="text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-1.5 block">
                Your name (optional)
              </label>
              <input
                type="text"
                value={askedBy}
                onChange={(e) => setAskedBy(e.target.value)}
                placeholder="Anonymous"
                className="w-full max-w-xs px-3 py-2 bg-white/70 border border-border rounded-lg text-sm text-ink placeholder:text-ink-lighter/60 focus:outline-none focus:border-athenian/40 focus:ring-2 focus:ring-athenian/10 transition-all duration-200"
              />
            </div>

            {/* ── Philosopher selector ──────────────────────────── */}
            <div className="mb-5">
              <label className="text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-3 block">
                Choose 2–4 philosophers for your panel
                {selectedIds.length > 0 && (
                  <span
                    className={`ml-2 ${
                      selectedIds.length >= 2 ? "text-stoic" : "text-terracotta"
                    }`}
                  >
                    ({selectedIds.length} selected)
                  </span>
                )}
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {selectablePhilosophers.map((p) => {
                  const isSelected = selectedIds.includes(p.id);
                  const isDimmed = atMaxSelection && !isSelected;

                  return (
                    <button
                      key={p.id}
                      onClick={() => togglePhilosopher(p.id)}
                      disabled={isDimmed}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left transition-all duration-200
                        ${
                          isSelected
                            ? "bg-white border-transparent"
                            : isDimmed
                              ? "bg-parchment-dark/20 border-border-light opacity-50 cursor-not-allowed"
                              : "bg-white/40 border-border-light hover:border-border hover:bg-white/60"
                        }`}
                      style={
                        isSelected
                          ? {
                              boxShadow: `0 0 0 2px ${p.color}50, 0 1px 3px rgba(0,0,0,0.08)`,
                            }
                          : undefined
                      }
                    >
                      <PhilosopherAvatar
                        philosopherId={p.id}
                        name={p.name}
                        color={p.color}
                        initials={p.initials}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <div className="font-serif text-sm font-bold text-ink truncate">
                          {p.name}
                        </div>
                        <div
                          className="text-[10px] font-mono truncate"
                          style={{ color: p.color }}
                        >
                          {p.tradition}
                        </div>
                      </div>
                      {isSelected && (
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          fill="none"
                          stroke={p.color}
                          strokeWidth="2"
                          className="ml-auto shrink-0"
                        >
                          <path
                            d="M3 8L7 12L13 4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Error message ─────────────────────────────────── */}
            {formError && (
              <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800 font-body">
                {formError}
              </div>
            )}

            {/* ── Submit button ─────────────────────────────────── */}
            <button
              onClick={handleSubmit}
              disabled={!isValid || submitting}
              className="px-6 py-2.5 bg-terracotta text-white text-sm font-semibold rounded-lg hover:bg-terracotta-light transition-colors duration-200 shadow-sm font-serif tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Summoning…
                </span>
              ) : (
                "Ask the Philosophers"
              )}
            </button>
          </div>

          {/* ── Featured threads from API ────────────────────────── */}
          <div className="px-5 py-6">
            <h2 className="text-[11px] font-mono tracking-wider uppercase text-ink-lighter mb-5">
              Recent Conversations
            </h2>

            {featuredLoading && (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-terracotta/30 border-t-terracotta rounded-full animate-spin" />
              </div>
            )}

            {!featuredLoading && featuredThreads.length === 0 && !firstThread && (
              <div className="text-center py-8">
                <p className="text-sm text-ink-lighter font-body italic">
                  No conversations yet. Be the first to ask!
                </p>
              </div>
            )}

            {/* Show featured threads from API */}
            {featuredThreads.map((thread) => (
              <FeaturedThreadCard key={thread.id} thread={thread} />
            ))}

            {/* Fallback: if no featured threads from API but we have server-rendered threads, show the first one expanded */}
            {featuredThreads.length === 0 && firstThread && (
              <AgoraThreadCardExpanded
                thread={firstThread}
                index={0}
                philosophersMap={philosophersMap}
              />
            )}
          </div>

          <Footer />
          <div className="pb-20 lg:pb-0" />
        </div>
      </main>
    </div>
  );
}
