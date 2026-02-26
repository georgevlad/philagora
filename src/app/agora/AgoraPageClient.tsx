"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Philosopher, AgoraThreadDetail } from "@/lib/types";
import { LeftSidebar } from "@/components/LeftSidebar";
import { MobileNav } from "@/components/MobileNav";
import { Footer } from "@/components/Footer";
import { PhilosopherAvatar } from "@/components/PhilosopherAvatar";

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

// ── Philosopher quotes (hover reveal) ────────────────────────────────

const PHILOSOPHER_QUOTES: Record<string, string> = {
  "marcus-aurelius": "The obstacle is the way",
  nietzsche: "What does not kill me makes me stronger",
  camus: "One must imagine Sisyphus happy",
  seneca: "We suffer more in imagination than reality",
  plato: "The unexamined life is not worth living",
  confucius: "The journey of a thousand miles…",
  jung: "Who looks outside, dreams",
  dostoevsky: "Beauty will save the world",
  kierkegaard: "Life can only be understood backwards",
  kant: "Dare to know",
  russell: "The good life is one inspired by love",
};

// ── Featured thread card (compact row) ───────────────────────────────

function FeaturedThreadCard({ thread }: { thread: FeaturedThread }) {
  return (
    <Link href={`/agora/${thread.id}`}>
      <div className="flex items-start gap-3 py-3.5 border-b border-border-light/60 hover:bg-parchment-dark/20 transition-colors duration-200 cursor-pointer -mx-2 px-2 rounded">
        {/* Philosopher avatar cluster */}
        <div className="flex -space-x-1.5 shrink-0 mt-0.5">
          {thread.philosophers.slice(0, 3).map((p) => (
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
          {thread.philosophers.length > 3 && (
            <div className="w-8 h-8 rounded-full bg-parchment-dark flex items-center justify-center text-[10px] font-mono text-ink-lighter ring-2 ring-parchment">
              +{thread.philosophers.length - 3}
            </div>
          )}
        </div>

        {/* Question + date */}
        <div className="flex-1 min-w-0">
          <p className="font-serif text-sm text-ink leading-snug line-clamp-2">
            &ldquo;{thread.question}&rdquo;
          </p>
          <span className="text-[11px] font-mono text-ink-lighter mt-1 block">
            {thread.asked_by} &middot;{" "}
            {new Date(thread.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>
      </div>
    </Link>
  );
}

// ── Main page component ──────────────────────────────────────────────

export function AgoraPageClient({
  philosophers,
}: {
  philosophersMap: Record<string, Philosopher>;
  philosophers: Philosopher[];
  threads: AgoraThreadDetail[];
}) {
  const router = useRouter();

  // ── Step navigation ─────────────────────────────────────────────
  const [step, setStep] = useState<"question" | "philosophers">("question");

  // ── Form state ──────────────────────────────────────────────────
  const [question, setQuestion] = useState("");
  const [askedBy, setAskedBy] = useState("");
  const [editingName, setEditingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [hoveredPhilosopher, setHoveredPhilosopher] = useState<string | null>(
    null
  );

  // ── Philosopher list from API ───────────────────────────────────
  const [selectablePhilosophers, setSelectablePhilosophers] = useState<
    SelectablePhilosopher[]
  >([]);

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
  const isValid =
    charCount >= 10 &&
    charCount <= 500 &&
    selectedIds.length >= 2 &&
    selectedIds.length <= 4;
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
        setFormError(
          data.error || "Something went wrong. Please try again."
        );
        return;
      }

      const data = await res.json();
      router.push(`/agora/${data.threadId}`);
    } catch {
      setFormError(
        "Failed to submit. Please check your connection and try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ── Step transition helpers ─────────────────────────────────────

  const isStep1 = step === "question";
  const isStep2 = step === "philosophers";
  const canContinue = charCount >= 10;

  const questionPreview =
    trimmedQuestion.length > 80
      ? trimmedQuestion.slice(0, 77).replace(/\s+\S*$/, "") + "…"
      : trimmedQuestion;

  return (
    <div className="min-h-screen flex flex-col lg:flex-row pt-14 lg:pt-0">
      <LeftSidebar philosophers={philosophers} />
      <MobileNav />

      <main className="flex-1 min-w-0 lg:border-l border-border-light">
        <div className="max-w-[700px] mx-auto">
          {/* ── Two-step form area ──────────────────────────────── */}
          <div
            className="border-b border-border-light relative overflow-hidden"
            style={{ minHeight: "360px" }}
          >
            {/* ═══════════ Step 1: The Question ═══════════ */}
            <div
              style={{
                opacity: isStep1 ? 1 : 0,
                transform: isStep1 ? "translateX(0)" : "translateX(-30px)",
                position: isStep1 ? "relative" : "absolute",
                top: 0,
                left: 0,
                right: 0,
                pointerEvents: isStep1 ? "auto" : "none",
                visibility: isStep1 ? "visible" : "hidden",
                transitionProperty: "opacity, transform, visibility",
                transitionDuration: "0.4s, 0.4s, 0s",
                transitionDelay: isStep1 ? "0s, 0s, 0s" : "0s, 0s, 0.4s",
                transitionTimingFunction: "ease-out",
              }}
            >
              <div className="px-5 pt-10 pb-10">
                {/* Heading */}
                <h1 className="font-serif text-2xl font-bold text-ink mb-1.5">
                  The Agora
                </h1>
                <p className="text-[15px] text-ink-light leading-relaxed mb-10">
                  A place to bring your questions to history&apos;s greatest
                  minds.
                </p>

                {/* Writing surface */}
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="What's weighing on your mind?"
                  maxLength={500}
                  className="w-full bg-transparent border-transparent text-[18px] lg:text-[20px] font-serif text-ink placeholder:italic placeholder:text-ink-lighter/50 focus:outline-none resize-none leading-relaxed"
                  style={{ minHeight: "160px" }}
                />

                {/* Character count — only past 400 */}
                <div className="h-5 flex justify-end">
                  {charCount > 400 && (
                    <span
                      className={`text-xs font-mono transition-opacity duration-300 ${
                        charCount >= 480 ? "text-terracotta" : "text-ink-faint"
                      }`}
                    >
                      {charCount}
                    </span>
                  )}
                </div>

                {/* Signature line */}
                <div className="mt-2 font-serif italic text-base text-ink-light">
                  {!editingName ? (
                    <button
                      onClick={() => {
                        setEditingName(true);
                        setTimeout(() => nameInputRef.current?.focus(), 0);
                      }}
                      className="hover:text-ink transition-colors duration-200 cursor-text"
                    >
                      — {askedBy.trim() || "Anonymous"}
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <span>—</span>
                      <input
                        ref={nameInputRef}
                        type="text"
                        value={askedBy}
                        onChange={(e) => setAskedBy(e.target.value)}
                        onBlur={() => setEditingName(false)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") setEditingName(false);
                        }}
                        placeholder="Anonymous"
                        className="bg-transparent border-b border-ink-lighter/40 font-serif italic text-base text-ink focus:outline-none focus:border-terracotta/60 w-40 pb-0.5 transition-colors duration-200"
                      />
                    </span>
                  )}
                </div>

                {/* Continue link — fades in when question is long enough */}
                <button
                  onClick={() => canContinue && setStep("philosophers")}
                  style={{
                    opacity: canContinue ? 1 : 0,
                    transform: canContinue
                      ? "translateY(0)"
                      : "translateY(8px)",
                    transition:
                      "opacity 0.5s ease, transform 0.5s ease, color 0.2s ease",
                    pointerEvents: canContinue ? "auto" : "none",
                  }}
                  className="mt-8 font-serif text-[15px] text-terracotta/80 hover:text-terracotta inline-flex items-center gap-1.5"
                >
                  Now, choose who you&apos;d like to hear from
                  <span className="text-sm">→</span>
                </button>
              </div>
            </div>

            {/* ═══════════ Step 2: Choose Philosophers ═══════════ */}
            <div
              style={{
                opacity: isStep2 ? 1 : 0,
                transform: isStep2 ? "translateX(0)" : "translateX(30px)",
                position: isStep2 ? "relative" : "absolute",
                top: 0,
                left: 0,
                right: 0,
                pointerEvents: isStep2 ? "auto" : "none",
                visibility: isStep2 ? "visible" : "hidden",
                transitionProperty: "opacity, transform, visibility",
                transitionDuration: "0.4s, 0.4s, 0s",
                transitionDelay: isStep2 ? "0s, 0s, 0s" : "0s, 0s, 0.4s",
                transitionTimingFunction: "ease-out",
              }}
            >
              <div className="px-5 pt-8 pb-10">
                {/* Back link */}
                <button
                  onClick={() => setStep("question")}
                  className="text-sm text-ink-lighter hover:text-ink transition-colors duration-200 font-body inline-flex items-center gap-1 mb-6"
                >
                  <span>←</span> Back to your question
                </button>

                <h2 className="font-serif text-xl font-bold text-ink mb-6">
                  Who would you like to hear from?
                </h2>

                {/* Philosopher grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {selectablePhilosophers.map((p) => {
                    const isSelected = selectedIds.includes(p.id);
                    const isDimmed = atMaxSelection && !isSelected;
                    const isHovered = hoveredPhilosopher === p.id;

                    return (
                      <button
                        key={p.id}
                        onClick={() => togglePhilosopher(p.id)}
                        onMouseEnter={() => setHoveredPhilosopher(p.id)}
                        onMouseLeave={() => setHoveredPhilosopher(null)}
                        disabled={isDimmed}
                        className={`relative flex flex-col items-center text-center px-3 py-4 rounded-lg border transition-all duration-300
                          ${
                            isSelected
                              ? "bg-white border-transparent"
                              : isDimmed
                                ? "bg-parchment-dark/20 border-border-light opacity-40 cursor-not-allowed"
                                : "bg-white/40 border-border-light hover:bg-white/60"
                          }`}
                        style={{
                          ...(isSelected
                            ? {
                                boxShadow: `0 0 0 2px ${p.color}60, 0 4px 12px ${p.color}15`,
                              }
                            : isHovered && !isDimmed
                              ? {
                                  boxShadow: `0 4px 16px ${p.color}20`,
                                  transform: "scale(1.03)",
                                }
                              : {}),
                        }}
                      >
                        <PhilosopherAvatar
                          philosopherId={p.id}
                          name={p.name}
                          color={p.color}
                          initials={p.initials}
                          size="md"
                        />

                        <div className="mt-2 font-serif text-sm font-bold text-ink">
                          {p.name}
                        </div>
                        <div
                          className="text-[10px] font-mono mt-0.5"
                          style={{ color: p.color }}
                        >
                          {p.tradition}
                        </div>

                        {/* Hover quote — always rendered to reserve height */}
                        {PHILOSOPHER_QUOTES[p.id] && (
                          <div
                            className="mt-2 text-[11px] font-serif italic text-ink-lighter leading-snug transition-opacity duration-300"
                            style={{
                              opacity:
                                isHovered && !isSelected ? 1 : 0,
                            }}
                          >
                            &ldquo;{PHILOSOPHER_QUOTES[p.id]}&rdquo;
                          </div>
                        )}

                        {/* Selected checkmark */}
                        {isSelected && (
                          <div
                            className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: p.color }}
                          >
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 16 16"
                              fill="none"
                              stroke="white"
                              strokeWidth="2.5"
                            >
                              <path
                                d="M3 8L7 12L13 4"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Panel preview + count */}
                <div className="mt-5 flex items-center gap-3">
                  {selectedIds.length > 0 && (
                    <div className="flex -space-x-2">
                      {selectedIds.map((id) => {
                        const p = selectablePhilosophers.find(
                          (sp) => sp.id === id
                        );
                        return p ? (
                          <div
                            key={id}
                            className="ring-2 ring-parchment rounded-full"
                          >
                            <PhilosopherAvatar
                              philosopherId={p.id}
                              name={p.name}
                              color={p.color}
                              initials={p.initials}
                              size="sm"
                            />
                          </div>
                        ) : null;
                      })}
                    </div>
                  )}
                  {selectedIds.length > 0 && (
                    <span className="text-sm font-body text-ink-lighter">
                      {selectedIds.length} of 4 chosen
                    </span>
                  )}
                </div>

                {/* Question reminder + submit */}
                <div
                  className="mt-8 text-center"
                  style={{
                    opacity: selectedIds.length >= 2 ? 1 : 0,
                    transform:
                      selectedIds.length >= 2
                        ? "translateY(0)"
                        : "translateY(8px)",
                    transition: "opacity 0.4s ease, transform 0.4s ease",
                    pointerEvents:
                      selectedIds.length >= 2 ? "auto" : "none",
                  }}
                >
                  {/* Question preview */}
                  <p className="text-sm font-serif italic text-ink-lighter mb-4">
                    &ldquo;{questionPreview}&rdquo;
                  </p>

                  <button
                    onClick={handleSubmit}
                    disabled={!isValid || submitting}
                    className="px-8 py-3 bg-terracotta text-white text-[15px] font-serif font-semibold rounded-lg hover:bg-terracotta-light transition-colors duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        Summoning…
                      </span>
                    ) : (
                      "Hear their thoughts"
                    )}
                  </button>

                  {/* Error message */}
                  {formError && (
                    <div className="mt-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800 font-body text-left">
                      {formError}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Featured threads ─────────────────────────────────── */}
          {!featuredLoading && featuredThreads.length > 0 && (
            <div className="px-5 py-6">
              <h2 className="text-sm font-serif italic text-ink-lighter mb-4">
                Previous conversations
              </h2>
              {featuredThreads.map((thread) => (
                <FeaturedThreadCard key={thread.id} thread={thread} />
              ))}
            </div>
          )}

          <Footer />
          <div className="pb-20 lg:pb-0" />
        </div>
      </main>
    </div>
  );
}
