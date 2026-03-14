"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Philosopher, AgoraThreadDetail } from "@/lib/types";
import { LeftSidebar } from "@/components/LeftSidebar";
import { MobileNav } from "@/components/MobileNav";
import { Footer } from "@/components/Footer";
import { PhilosopherAvatar } from "@/components/PhilosopherAvatar";
import { formatDate } from "@/lib/date-utils";

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

const PHILOSOPHER_QUOTES: Record<string, string> = {
  "marcus-aurelius": "The obstacle is the way",
  nietzsche: "What does not kill me makes me stronger",
  camus: "One must imagine Sisyphus happy",
  seneca: "We suffer more in imagination than reality",
  plato: "The unexamined life is not worth living",
  confucius: "The journey of a thousand miles begins in order",
  jung: "Who looks outside, dreams",
  dostoevsky: "Beauty will save the world",
  kierkegaard: "Life can only be understood backwards",
  kant: "Dare to know",
  russell: "The good life is one inspired by love",
  cicero: "The safety of the people shall be the highest law",
};

function FeaturedThreadCard({ thread }: { thread: FeaturedThread }) {
  return (
    <Link href={`/agora/${thread.id}`}>
      <article className="group flex items-start gap-4 px-4 py-4 rounded-2xl border-b border-border-light/80 hover:bg-parchment-tint/75 transition-colors duration-200 cursor-pointer">
        <div className="flex -space-x-2 shrink-0 mt-0.5">
          {thread.philosophers.slice(0, 3).map((p) => (
            <div key={p.id} className="ring-2 ring-card rounded-full">
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
            <div className="w-8 h-8 rounded-full bg-parchment-dark flex items-center justify-center text-[10px] font-mono text-ink-lighter ring-2 ring-card">
              +{thread.philosophers.length - 3}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-serif text-[20px] sm:text-[22px] leading-[1.26] text-ink line-clamp-2 group-hover:text-athenian transition-colors text-balance">
            &ldquo;{thread.question}&rdquo;
          </p>
          <div className="mt-2 text-[11px] font-mono uppercase tracking-[0.16em] text-ink-faint">
            {thread.asked_by} <span className="mx-2 text-border">/</span>
            {formatDate(thread.created_at).replace(/, \d{4}$/, "")}
          </div>
        </div>
      </article>
    </Link>
  );
}

export function AgoraPageClient({
  philosophers,
}: {
  philosophersMap: Record<string, Philosopher>;
  philosophers: Philosopher[];
  threads: AgoraThreadDetail[];
}) {
  const router = useRouter();

  const [step, setStep] = useState<"question" | "philosophers">("question");
  const [question, setQuestion] = useState("");
  const [askedBy, setAskedBy] = useState("");
  const [editingName, setEditingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [hoveredPhilosopher, setHoveredPhilosopher] = useState<string | null>(null);

  const [selectablePhilosophers, setSelectablePhilosophers] = useState<SelectablePhilosopher[]>([]);
  const [featuredThreads, setFeaturedThreads] = useState<FeaturedThread[]>([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);

  useEffect(() => {
    async function loadPhilosophers() {
      try {
        const res = await fetch("/api/philosophers");
        if (res.ok) {
          const data = await res.json();
          setSelectablePhilosophers(data);
        }
      } catch {
        // Silent fallback
      }
    }
    loadPhilosophers();
  }, []);

  useEffect(() => {
    async function loadFeatured() {
      try {
        const res = await fetch("/api/agora/featured");
        if (res.ok) {
          const data = await res.json();
          setFeaturedThreads(data.threads ?? []);
        }
      } catch {
        // Silent fallback
      } finally {
        setFeaturedLoading(false);
      }
    }
    loadFeatured();
  }, []);

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

  const canContinue = charCount >= 10;
  const selectedPhilosophers = selectedIds
    .map((id) => selectablePhilosophers.find((sp) => sp.id === id))
    .filter(Boolean) as SelectablePhilosopher[];
  const questionPreview =
    trimmedQuestion.length > 110
      ? trimmedQuestion.slice(0, 107).replace(/\s+\S*$/, "") + "..."
      : trimmedQuestion;

  return (
    <div className="min-h-screen flex flex-col lg:flex-row pt-14 lg:pt-0">
      <LeftSidebar philosophers={philosophers} />
      <MobileNav />

      <main className="flex-1 min-w-0 lg:border-l border-border-light bg-[linear-gradient(180deg,rgba(248,243,234,0.5),rgba(244,239,230,0.12))]">
        <div className="max-w-[980px] mx-auto px-6 py-9 pb-20 lg:pb-10">
          <div className="max-w-[760px] mb-8">
            <div className="text-[10px] font-mono tracking-[0.22em] uppercase text-gold mb-4">
              Public forum
            </div>
            <h1 className="font-serif text-[34px] lg:text-[40px] leading-[1.06] font-medium text-ink mb-3">
              The Agora
            </h1>
            <p className="text-[16px] text-ink-light leading-[1.62] max-w-[680px]">
              A place to bring difficult questions to history&apos;s greatest minds and receive a chorus of disagreement, counsel, and synthesis.
            </p>
          </div>

          <section className="rounded-[30px] border border-border-light/90 bg-[linear-gradient(180deg,rgba(248,243,234,0.96),rgba(238,230,216,0.82))] shadow-[0_18px_40px_rgba(42,36,31,0.045)] overflow-hidden mb-10">
            <div className="px-6 pt-5 pb-4 border-b border-border-light/80 bg-[linear-gradient(90deg,rgba(176,138,73,0.06),rgba(248,243,234,0.25),rgba(176,138,73,0.03))]">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="text-[10px] font-mono tracking-[0.22em] uppercase text-ink-faint">
                  Bring a question before the philosophers
                </div>
                <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.16em] text-ink-faint">
                  <span className={`w-2 h-2 rounded-full ${step === "question" ? "bg-gold" : "bg-border"}`} />
                  Compose
                  <span className="mx-1 text-border">/</span>
                  <span className={`w-2 h-2 rounded-full ${step === "philosophers" ? "bg-athenian" : "bg-border"}`} />
                  Select voices
                </div>
              </div>
            </div>

            {step === "question" ? (
              <div className="px-6 py-7 lg:px-8 lg:py-8">
                <div className="grid lg:grid-cols-[minmax(0,1.55fr)_320px] gap-6 lg:gap-7 items-start">
                  <div>
                    <div className="rounded-[24px] border border-gold/18 bg-[linear-gradient(180deg,rgba(255,255,255,0.26),rgba(248,243,234,0.58))] px-6 py-5 min-h-[272px] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
                      <textarea
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        placeholder="What troubles your mind today? Pose your question to the philosophers..."
                        maxLength={500}
                        className="w-full bg-transparent border-transparent text-[22px] lg:text-[26px] font-serif text-ink placeholder:italic placeholder:text-ink-lighter/55 focus:outline-none resize-none leading-[1.32]"
                        style={{ minHeight: "152px" }}
                      />

                      <div className="mt-6 flex items-center justify-between gap-4 flex-wrap">
                        <div className="font-serif italic text-[24px] text-ink-light">
                          {!editingName ? (
                            <button
                              onClick={() => {
                                setEditingName(true);
                                setTimeout(() => nameInputRef.current?.focus(), 0);
                              }}
                              className="hover:text-ink transition-colors duration-200 cursor-text"
                            >
                              - {askedBy.trim() || "Anonymous"}
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-2">
                              <span>-</span>
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
                                className="bg-transparent border-b border-ink-lighter/40 font-serif italic text-[24px] text-ink focus:outline-none focus:border-gold w-52 pb-0.5 transition-colors duration-200"
                              />
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-ink-faint">
                          {charCount}/500
                        </div>
                      </div>
                    </div>
                  </div>

                  <aside className="justify-self-end w-full max-w-[320px] rounded-[22px] border border-border-light/80 bg-[linear-gradient(180deg,rgba(238,230,216,0.5),rgba(248,243,234,0.92))] px-5 py-5 shadow-[0_10px_24px_rgba(42,36,31,0.03)]">
                    <div className="text-[10px] font-mono tracking-[0.2em] uppercase text-gold mb-3">
                      Before you ask
                    </div>
                    <ul className="space-y-2.5 text-[13px] text-ink-light leading-[1.68]">
                      <li>Choose a question with tension, ambiguity, or a real decision inside it.</li>
                      <li>You can invite between two and four philosophers into the conversation.</li>
                      <li>The result is not consensus. It is a structured disagreement followed by editorial synthesis.</li>
                    </ul>

                    <div className="mt-5 pt-4 border-t border-border-light/70">
                      <button
                        onClick={() => canContinue && setStep("philosophers")}
                        disabled={!canContinue}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-[16px] bg-athenian text-white font-body text-sm tracking-wide hover:bg-athenian-light disabled:opacity-45 disabled:cursor-not-allowed transition-colors"
                      >
                        Choose the philosophers
                        <span aria-hidden="true">-&gt;</span>
                      </button>
                      <p className="mt-3 text-[10px] font-mono uppercase tracking-[0.16em] text-ink-faint text-center leading-[1.6]">
                        Continue once your question is at least 10 characters
                      </p>
                    </div>
                  </aside>
                </div>
              </div>
            ) : (
              <div className="px-6 py-7 lg:px-8 lg:py-8">
                <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
                  <button
                    onClick={() => setStep("question")}
                    className="text-sm text-ink-lighter hover:text-ink transition-colors duration-200 inline-flex items-center gap-1"
                  >
                    <span aria-hidden="true">&larr;</span> Back to your question
                  </button>
                  <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-ink-faint">
                    Select 2 to 4 voices
                  </div>
                </div>

                <div className="grid lg:grid-cols-[minmax(0,1.4fr)_320px] gap-6 lg:gap-7 items-start">
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
                          className={`relative flex flex-col items-center text-center px-3 py-4 rounded-2xl border transition-all duration-300 ${
                            isSelected
                              ? "bg-card border-transparent"
                              : isDimmed
                                ? "bg-parchment-dark/20 border-border-light opacity-40 cursor-not-allowed"
                                : "bg-white/35 border-border-light hover:bg-card/90"
                          }`}
                          style={{
                            ...(isSelected
                              ? {
                                  boxShadow: `0 0 0 2px ${p.color}60, 0 10px 20px ${p.color}14`,
                                }
                              : isHovered && !isDimmed
                                ? {
                                    boxShadow: `0 10px 20px ${p.color}18`,
                                    transform: "translateY(-2px)",
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

                          <div className="mt-2 font-serif text-[15px] font-semibold text-ink">{p.name}</div>
                          <div className="text-[10px] font-mono tracking-[0.14em] uppercase mt-1" style={{ color: p.color }}>
                            {p.tradition}
                          </div>

                          <div
                            className="mt-3 text-[12px] font-serif italic text-ink-lighter leading-snug min-h-[36px] transition-opacity duration-300"
                            style={{ opacity: isHovered && !isSelected ? 1 : 0.25 }}
                          >
                            {PHILOSOPHER_QUOTES[p.id] ? `"${PHILOSOPHER_QUOTES[p.id]}"` : ""}
                          </div>

                          {isSelected && (
                            <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: p.color }}>
                              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2.5">
                                <path d="M3 8L7 12L13 4" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <aside className="justify-self-end w-full max-w-[320px] rounded-[22px] border border-border-light/80 bg-[linear-gradient(180deg,rgba(238,230,216,0.52),rgba(248,243,234,0.92))] px-5 py-5 shadow-[0_10px_24px_rgba(42,36,31,0.03)]">
                    <div className="text-[10px] font-mono tracking-[0.2em] uppercase text-gold mb-3">
                      Your question
                    </div>
                    <p className="font-serif text-[17px] leading-[1.52] text-ink mb-5 text-balance">
                      &ldquo;{questionPreview || "Your question will appear here."}&rdquo;
                    </p>

                    <div className="pt-4 border-t border-border-light/70">
                      <div className="text-[10px] font-mono tracking-[0.18em] uppercase text-ink-faint mb-3">
                        Selected philosophers
                      </div>
                      {selectedPhilosophers.length > 0 ? (
                        <div className="space-y-3 mb-5">
                          {selectedPhilosophers.map((p) => (
                            <div key={p.id} className="flex items-center gap-3">
                              <PhilosopherAvatar philosopherId={p.id} name={p.name} color={p.color} initials={p.initials} size="sm" />
                              <div>
                                <div className="font-serif text-[16px] font-semibold text-ink leading-none">{p.name}</div>
                                <div className="text-[11px] font-mono tracking-[0.14em] uppercase text-ink-faint mt-1">{p.tradition}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-ink-lighter mb-5">Choose at least two philosophers to continue.</p>
                      )}

                      <button
                        onClick={handleSubmit}
                        disabled={!isValid || submitting}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-[16px] bg-athenian text-white font-body text-sm tracking-wide hover:bg-athenian-light disabled:opacity-45 disabled:cursor-not-allowed transition-colors"
                      >
                        {submitting ? "Summoning the dialogue..." : "Hear their thoughts"}
                      </button>

                      {formError && (
                        <div className="mt-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800 text-left">
                          {formError}
                        </div>
                      )}
                    </div>
                  </aside>
                </div>
              </div>
            )}
          </section>

          {!featuredLoading && featuredThreads.length > 0 && (
            <section className="border-t border-border-light/80 pt-8">
              <div className="max-w-[760px] mb-5">
                <div className="text-[10px] font-mono tracking-[0.22em] uppercase text-ink-faint mb-3">
                  Archive
                </div>
                <h2 className="font-serif text-[22px] sm:text-[24px] leading-[1.18] text-ink mb-2">Previous conversations</h2>
                <p className="text-[16px] text-ink-light leading-[1.65]">
                  A record of questions previously brought before the forum.
                </p>
              </div>

              <div className="rounded-[28px] border border-border-light/90 bg-[linear-gradient(180deg,rgba(248,243,234,0.95),rgba(244,239,230,0.9))] shadow-[0_14px_34px_rgba(42,36,31,0.04)] overflow-hidden">
                {featuredThreads.map((thread) => (
                  <FeaturedThreadCard key={thread.id} thread={thread} />
                ))}
              </div>
            </section>
          )}

          <Footer />
        </div>
      </main>
    </div>
  );
}

