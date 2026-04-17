"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getQuestionTypeLabel } from "@/lib/agora";
import { useSession } from "@/lib/auth-client";
import type {
  AgoraQuestionType,
  Philosopher,
  AgoraThreadStatus,
  AgoraThreadVisibility,
} from "@/lib/types";
import { LeftSidebar } from "@/components/LeftSidebar";
import { MobileNav } from "@/components/MobileNav";
import { Footer } from "@/components/Footer";
import { PhilosopherAvatar } from "@/components/PhilosopherAvatar";
import { timeAgo } from "@/lib/date-utils";

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
  question_type: "advice" | "conceptual" | "debate";
  article_source: string | null;
  created_at: string;
  has_follow_up: boolean;
  philosophers: {
    id: string;
    name: string;
    initials: string;
    color: string;
    tradition: string;
  }[];
}

interface MyThread {
  id: string;
  question: string;
  status: AgoraThreadStatus;
  visibility: AgoraThreadVisibility;
  created_at: string;
  philosophers: {
    id: string;
    name: string;
    initials: string;
    color: string;
  }[];
}

interface PhilosopherSuggestion {
  id: string;
  reason: string;
}

interface SuggestedClassification {
  questionType: AgoraQuestionType;
  recommendationsAppropriate: boolean;
  recommendationHint: string | null;
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

const EXAMPLE_QUESTIONS = [
  "Why do we feel nostalgic for times that weren't even that good?",
  "Should we forgive people who haven't asked for forgiveness?",
  "Is it okay to enjoy bad art?",
] as const;

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
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-athenian/8 text-athenian text-[9px] font-mono uppercase tracking-[0.14em]">
              {getQuestionTypeLabel(thread.question_type)}
            </span>
            {thread.has_follow_up && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gold/10 text-gold text-[9px] font-mono uppercase tracking-[0.14em]">
                <span className="h-1.5 w-1.5 rounded-full bg-current/70" />
                Follow-up
              </span>
            )}
          </div>
          {thread.article_source && (
            <div className="mt-1.5 flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.14em] text-ink-faint">
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 4h12M2 8h8M2 12h10" strokeLinecap="round" />
              </svg>
              {thread.article_source}
            </div>
          )}
          <div className="mt-2 text-[11px] font-mono uppercase tracking-[0.16em] text-ink-faint">
            {thread.asked_by} <span className="mx-2 text-border">/</span>
            {timeAgo(thread.created_at)}
          </div>
        </div>
      </article>
    </Link>
  );
}

function ThreadStatusIcon({ status }: { status: AgoraThreadStatus }) {
  if (status === "failed") {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-red-700">
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
        </svg>
      </span>
    );
  }

  if (status === "complete") {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-stoic/10 text-stoic">
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3.5 8.2l2.4 2.4L12.5 4.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }

  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gold/12 text-gold">
      <span className="h-3.5 w-3.5 rounded-full border border-current/35 border-t-current animate-spin" />
    </span>
  );
}

function PrivateBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-parchment-dark/35 px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.14em] text-ink-faint">
      <svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="8" width="10" height="6" rx="1" />
        <path d="M5 8V5a3 3 0 016 0v3" />
      </svg>
      Private
    </span>
  );
}

function MyThreadCard({ thread }: { thread: MyThread }) {
  return (
    <Link
      href={`/agora/${thread.id}`}
      className="group block rounded-2xl border border-border-light/80 bg-[linear-gradient(180deg,rgba(248,243,234,0.94),rgba(242,236,226,0.84))] px-4 py-3 transition-all duration-200 hover:border-border hover:bg-parchment-tint/90 hover:shadow-[0_10px_24px_rgba(42,36,31,0.05)]"
    >
      <div className="flex items-start gap-3">
        <ThreadStatusIcon status={thread.status} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="font-serif text-[16px] leading-[1.35] text-ink line-clamp-2 group-hover:text-athenian transition-colors">
              &ldquo;{thread.question}&rdquo;
            </p>
            {thread.visibility === "private" && <PrivateBadge />}
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex -space-x-1.5">
              {thread.philosophers.slice(0, 4).map((philosopher) => (
                <div key={philosopher.id} className="rounded-full ring-2 ring-card">
                  <PhilosopherAvatar
                    philosopherId={philosopher.id}
                    name={philosopher.name}
                    color={philosopher.color}
                    initials={philosopher.initials}
                    size="xs"
                  />
                </div>
              ))}
            </div>
            <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-ink-faint">
              {timeAgo(thread.created_at)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function AgoraPageClient({
  philosophers,
}: {
  philosophers: Philosopher[];
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const sessionUserId = session?.user?.id ?? null;
  const isLoggedIn = Boolean(session?.user);

  const [step, setStep] = useState<"question" | "philosophers">("question");
  const [question, setQuestion] = useState("");
  const [askedBy, setAskedBy] = useState("");
  const [articleUrl, setArticleUrl] = useState("");
  const [visibility, setVisibility] = useState<AgoraThreadVisibility>("public");
  const [editingName, setEditingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<PhilosopherSuggestion[]>([]);
  const [classification, setClassification] = useState<SuggestedClassification | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [quota, setQuota] = useState<{
    used: number;
    limit: number | null;
    isLoggedIn: boolean;
  } | null>(null);
  const [hoveredPhilosopher, setHoveredPhilosopher] = useState<string | null>(null);
  const suggestAbortRef = useRef<AbortController | null>(null);
  const suggestRequestIdRef = useRef(0);

  const [selectablePhilosophers, setSelectablePhilosophers] = useState<SelectablePhilosopher[]>([]);
  const [featuredThreads, setFeaturedThreads] = useState<FeaturedThread[]>([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [myThreads, setMyThreads] = useState<MyThread[]>([]);

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

  useEffect(() => {
    fetch("/api/agora/quota")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setQuota(data);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isLoggedIn) {
      setVisibility("public");
      setMyThreads([]);
      return;
    }

    let cancelled = false;

    async function loadMyThreads() {
      try {
        const res = await fetch("/api/agora/my-threads");
        if (!res.ok) return;

        const data = await res.json();
        if (!cancelled) {
          setMyThreads(Array.isArray(data.threads) ? data.threads : []);
        }
      } catch {
        if (!cancelled) {
          setMyThreads([]);
        }
      }
    }

    loadMyThreads();

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, sessionUserId]);

  useEffect(() => {
    return () => {
      suggestAbortRef.current?.abort();
    };
  }, []);

  const trimmedQuestion = question.trim();
  const charCount = trimmedQuestion.length;
  const hasArticleUrl = articleUrl.trim().length > 0;
  const canContinue = charCount >= 10 || hasArticleUrl;
  const isValid =
    canContinue &&
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

  function cancelSuggestionRequest() {
    suggestRequestIdRef.current += 1;
    suggestAbortRef.current?.abort();
    suggestAbortRef.current = null;
    setSuggesting(false);
  }

  function handleBack() {
    cancelSuggestionRequest();
    setStep("question");
    setSuggestions([]);
    setClassification(null);
    setSelectedIds([]);
    setSuggestError(false);
  }

  async function handleContinue() {
    if (!canContinue || suggesting) return;

    cancelSuggestionRequest();
    setFormError(null);
    setSuggestError(false);
    setSuggestions([]);
    setClassification(null);
    setSelectedIds([]);
    setSuggesting(true);
    setStep("philosophers");

    const requestId = suggestRequestIdRef.current + 1;
    suggestRequestIdRef.current = requestId;

    const controller = new AbortController();
    suggestAbortRef.current = controller;

    try {
      const trimmedArticleUrl = articleUrl.trim();
      const res = await fetch("/api/agora/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmedQuestion,
          article_url: trimmedArticleUrl || undefined,
        }),
        signal: controller.signal,
      });

      if (requestId !== suggestRequestIdRef.current) {
        return;
      }

      if (!res.ok) {
        setSuggestError(true);
        return;
      }

      const data = await res.json();

      if (requestId !== suggestRequestIdRef.current) {
        return;
      }

      if (data.classification) {
        setClassification(data.classification as SuggestedClassification);
      }

      const nextSuggestions: PhilosopherSuggestion[] = Array.isArray(data.suggestions)
        ? data.suggestions.filter(
            (suggestion: unknown): suggestion is PhilosopherSuggestion =>
              Boolean(suggestion)
              && typeof suggestion === "object"
              && typeof (suggestion as PhilosopherSuggestion).id === "string"
              && typeof (suggestion as PhilosopherSuggestion).reason === "string"
          )
        : [];

      setSuggestions(nextSuggestions);

      if (nextSuggestions.length >= 2) {
        setSelectedIds(nextSuggestions.map((suggestion) => suggestion.id));
      }
    } catch {
      if (controller.signal.aborted || requestId !== suggestRequestIdRef.current) {
        return;
      }

      setSuggestError(true);
    } finally {
      if (requestId === suggestRequestIdRef.current) {
        setSuggesting(false);
        if (suggestAbortRef.current === controller) {
          suggestAbortRef.current = null;
        }
      }
    }
  }

  async function handleSubmit() {
    if (!isValid || submitting) return;

    setSubmitting(true);
    setFormError(null);

    try {
      const trimmedArticleUrl = articleUrl.trim();
      if (trimmedArticleUrl && !/^https?:\/\/\S+/i.test(trimmedArticleUrl)) {
        setFormError("Article links must start with http:// or https://");
        return;
      }

      const res = await fetch("/api/agora/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmedQuestion,
          asked_by:
            visibility === "private"
              ? undefined
              : askedBy.trim() || undefined,
          philosopher_ids: selectedIds,
          article_url: trimmedArticleUrl || undefined,
          visibility: session?.user ? visibility : undefined,
          classification: classification ?? undefined,
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
      if (typeof window !== "undefined" && data.articleWarning) {
        sessionStorage.setItem(
          `agora-article-warning:${data.threadId}`,
          data.articleWarning
        );
      }
      router.push(`/agora/${data.threadId}`);
    } catch {
      setFormError("Failed to submit. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const selectedPhilosophers = selectedIds
    .map((id) => selectablePhilosophers.find((sp) => sp.id === id))
    .filter(Boolean) as SelectablePhilosopher[];
  const questionPreview =
    trimmedQuestion.length > 110
      ? trimmedQuestion.slice(0, 107).replace(/\s+\S*$/, "") + "..."
      : trimmedQuestion;
  const showSuggestedPhilosophers = !suggesting && !suggestError && suggestions.length > 0;

  return (
    <div className="min-h-screen flex flex-col lg:flex-row pt-14 lg:pt-0 overflow-x-hidden">
      <LeftSidebar philosophers={philosophers} />
      <MobileNav />

      <main className="flex-1 min-w-0 lg:border-l border-border-light bg-[linear-gradient(180deg,rgba(248,243,234,0.5),rgba(244,239,230,0.12))]">
        <div className="max-w-[980px] mx-auto px-6 pt-5 pb-20 sm:pt-7 lg:py-9 lg:pb-10">
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
                      {/* ── Visibility mode selector: Two Doors ── */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                        {/* Public door — always available */}
                        <button
                          type="button"
                          onClick={() => setVisibility("public")}
                          className={`text-left rounded-2xl border px-4 py-3.5 transition-all duration-200 ${
                            visibility === "public"
                              ? "border-ink/60 bg-white/50 shadow-[0_0_0_1px_rgba(42,36,31,0.15)]"
                              : "border-border-light/80 bg-white/30 hover:bg-white/45"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1.5">
                            <svg
                              width="15"
                              height="15"
                              viewBox="0 0 16 16"
                              fill="none"
                              stroke={visibility === "public" ? "#2A241F" : "#8A8073"}
                              strokeWidth="1.3"
                              className="shrink-0"
                            >
                              <circle cx="8" cy="8" r="6" />
                              <circle cx="8" cy="6" r="2" />
                              <path d="M4.5 14c0-2 1.5-3.5 3.5-3.5s3.5 1.5 3.5 3.5" strokeLinecap="round" />
                            </svg>
                            <span className="text-[13px] font-body font-medium text-ink">
                              Ask in the forum
                            </span>
                          </div>
                          <p className="text-[12px] font-body text-ink-lighter leading-snug">
                            Your question and the responses join the public archive.
                          </p>
                        </button>

                        {/* Private door — active for logged-in users, upsell for visitors */}
                        {isLoggedIn ? (
                          <button
                            type="button"
                            onClick={() => setVisibility("private")}
                            className={`text-left rounded-2xl border px-4 py-3.5 transition-all duration-200 ${
                              visibility === "private"
                                ? "border-ink/60 bg-white/50 shadow-[0_0_0_1px_rgba(42,36,31,0.15)]"
                                : "border-border-light/80 bg-white/30 hover:bg-white/45"
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1.5">
                              <svg
                                width="15"
                                height="15"
                                viewBox="0 0 16 16"
                                fill="none"
                                stroke={visibility === "private" ? "#2A241F" : "#8A8073"}
                                strokeWidth="1.3"
                                className="shrink-0"
                              >
                                <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" />
                                <path d="M5.5 7V5.5a2.5 2.5 0 015 0V7" strokeLinecap="round" />
                              </svg>
                              <span className="text-[13px] font-body font-medium text-ink">
                                Private counsel
                              </span>
                            </div>
                            <p className="text-[12px] font-body text-ink-lighter leading-snug">
                              Just you and the philosophers. No one else sees it.
                            </p>
                          </button>
                        ) : (
                          <div className="text-left rounded-2xl border border-border-light/80 bg-white/20 px-4 py-3.5 opacity-65">
                            <div className="flex items-center gap-2 mb-1.5">
                              <svg
                                width="15"
                                height="15"
                                viewBox="0 0 16 16"
                                fill="none"
                                stroke="#8A8073"
                                strokeWidth="1.3"
                                className="shrink-0"
                              >
                                <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" />
                                <path d="M5.5 7V5.5a2.5 2.5 0 015 0V7" strokeLinecap="round" />
                              </svg>
                              <span className="text-[13px] font-body font-medium text-ink-lighter">
                                Private counsel
                              </span>
                            </div>
                            <p className="text-[12px] font-body text-ink-lighter leading-snug">
                              Just you and the philosophers. No one else sees it.
                            </p>
                            <div className="mt-2.5 pt-2.5 border-t border-border-light/60">
                              <a
                                href="/sign-in"
                                className="text-[11px] font-body italic text-gold hover:text-gold/80 transition-colors"
                              >
                                Sign in to ask private questions -&gt;
                              </a>
                            </div>
                          </div>
                        )}
                      </div>

                      <textarea
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        placeholder={
                          hasArticleUrl
                            ? "Add your own angle, or leave blank to let the article speak for itself..."
                            : "What troubles your mind today? Pose your question to the philosophers..."
                        }
                        maxLength={500}
                        className="w-full bg-transparent border-transparent text-[22px] lg:text-[26px] font-serif text-ink placeholder:italic placeholder:text-ink-lighter/55 focus:outline-none resize-none leading-[1.32]"
                        style={{ minHeight: "152px" }}
                      />

                      {question.trim() === "" && !hasArticleUrl && (
                        <div className="mt-4">
                          <div className="text-[10px] font-mono tracking-[0.16em] uppercase text-ink-faint">
                            Or try one of these
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            {EXAMPLE_QUESTIONS.map((exampleQuestion) => (
                              <button
                                key={exampleQuestion}
                                type="button"
                                onClick={() => setQuestion(exampleQuestion)}
                                className="max-w-fit px-3.5 py-2 rounded-xl border border-border-light/80 bg-white/50 text-[13px] font-body text-ink-light italic leading-snug text-left hover:border-gold/40 hover:bg-white/80 transition-colors duration-200 cursor-pointer"
                              >
                                {exampleQuestion}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div
                        className={`mt-6 flex items-center gap-4 flex-wrap ${
                          visibility === "public" ? "justify-between" : "justify-end"
                        }`}
                      >
                        {visibility === "public" && (
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span className="text-[10px] font-mono tracking-[0.16em] uppercase text-ink-faint">
                              Posting as
                            </span>
                            {!editingName ? (
                              <button
                                onClick={() => {
                                  setEditingName(true);
                                  setTimeout(() => nameInputRef.current?.focus(), 0);
                                }}
                                className="group inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-lg border border-transparent px-2.5 py-1 transition-all duration-200 hover:border-border-light hover:bg-white/40 cursor-text"
                              >
                                <span className="max-w-[11rem] overflow-hidden text-ellipsis whitespace-nowrap text-[15px] font-body font-medium text-ink sm:max-w-[16rem]">
                                  {askedBy.trim() || "Anonymous"}
                                </span>
                                <svg
                                  width="12"
                                  height="12"
                                  viewBox="0 0 16 16"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                  className="shrink-0 text-ink-faint transition-colors group-hover:text-gold"
                                >
                                  <path d="M11.5 1.5L14.5 4.5L5 14H2V11L11.5 1.5Z" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </button>
                            ) : (
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
                                className="bg-white/50 border border-border-light rounded-lg px-2.5 py-1 text-[15px] font-body font-medium text-ink focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold/40 w-44 transition-colors"
                              />
                            )}
                          </div>
                        )}
                        <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-ink-faint">
                          {charCount}/500
                        </div>
                      </div>

                      <div className="mt-5 pt-5 border-t border-border-light/60">
                        <div className="flex items-center gap-2 mb-2.5">
                          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gold">
                            <path d="M6.5 11.5L4 14c-1.1 1.1-3 1.1-4 0s-1.1-3 0-4l2.5-2.5M9.5 4.5L12 2c1.1-1.1 3-1.1 4 0s1.1 3 0 4l-2.5 2.5M5.5 10.5l5-5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          <span className="text-[11px] font-mono uppercase tracking-[0.16em] text-ink-light">
                            Or share an article for them to react to
                          </span>
                        </div>
                        <input
                          type="url"
                          value={articleUrl}
                          onChange={(event) => setArticleUrl(event.target.value)}
                          placeholder="Paste a link to a news story, essay, or opinion piece..."
                          className="w-full bg-white/60 border border-border-light/80 rounded-lg px-3.5 py-2.5 text-[14px] font-body text-ink placeholder:text-ink-lighter/50 focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold/40 transition-colors"
                        />
                      </div>
                    </div>
                  </div>

                  <aside className="justify-self-end w-full max-w-[320px] rounded-[22px] border border-border-light/80 bg-[linear-gradient(180deg,rgba(238,230,216,0.5),rgba(248,243,234,0.92))] px-5 py-5 shadow-[0_10px_24px_rgba(42,36,31,0.03)]">
                    <div className="text-[10px] font-mono tracking-[0.2em] uppercase text-gold mb-4">
                      How it works
                    </div>
                    <div className="space-y-4">
                      <div className="flex gap-3 items-start">
                        <div className="w-6 h-6 rounded-full bg-gold/12 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-[11px] font-mono font-medium text-gold">1</span>
                        </div>
                        <div>
                          <div className="text-[13px] font-body font-medium text-ink leading-snug">Write your question</div>
                          <p className="text-[12px] text-ink-lighter leading-[1.55] mt-0.5">Something with tension, a dilemma, or a real decision inside it.</p>
                        </div>
                      </div>
                      <div className="flex gap-3 items-start">
                        <div className="w-6 h-6 rounded-full bg-gold/12 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-[11px] font-mono font-medium text-gold">2</span>
                        </div>
                        <div>
                          <div className="text-[13px] font-body font-medium text-ink leading-snug">Pick 2-4 thinkers</div>
                          <p className="text-[12px] text-ink-lighter leading-[1.55] mt-0.5">We&apos;ll suggest voices likely to disagree on your question.</p>
                        </div>
                      </div>
                      <div className="flex gap-3 items-start">
                        <div className="w-6 h-6 rounded-full bg-gold/12 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-[11px] font-mono font-medium text-gold">3</span>
                        </div>
                        <div>
                          <div className="text-[13px] font-body font-medium text-ink leading-snug">Watch them debate</div>
                          <p className="text-[12px] text-ink-lighter leading-[1.55] mt-0.5">Each responds independently, then an editorial synthesis finds the tensions.</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 pt-4 border-t border-border-light/70">
                      <button
                        onClick={handleContinue}
                        disabled={!canContinue}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-[16px] bg-athenian text-white font-body text-[15px] font-medium tracking-wide shadow-[0_4px_12px_rgba(35,57,46,0.25)] hover:bg-athenian-light hover:shadow-[0_6px_16px_rgba(35,57,46,0.3)] disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed transition-all duration-200"
                      >
                        Choose the philosophers
                      </button>
                      <p className="mt-3 text-[10px] font-mono uppercase tracking-[0.16em] text-ink-faint text-center leading-[1.6]">
                        {hasArticleUrl
                          ? "You can continue with just the article"
                          : "Continue once your question is at least 10 characters"}
                      </p>
                    </div>
                  </aside>
                </div>
              </div>
            ) : (
              <div className="px-6 py-7 lg:px-8 lg:py-8">
                <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
                  <button
                    onClick={handleBack}
                    className="text-sm text-ink-lighter hover:text-ink transition-colors duration-200 inline-flex items-center gap-1"
                  >
                    <span aria-hidden="true">&larr;</span> Back to your question
                  </button>
                  <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-ink-faint">
                    Select 2 to 4 voices
                  </div>
                </div>

                <div className="grid lg:grid-cols-[minmax(0,1.4fr)_320px] gap-6 lg:gap-7 items-start">
                  <div>
                    {suggesting ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin mb-4" />
                        <p className="font-serif text-[18px] text-ink-light italic">
                          Finding the best voices for your question...
                        </p>
                      </div>
                    ) : (
                      <>
                        {showSuggestedPhilosophers && (
                          <div className="mb-6">
                            <div className="text-[10px] font-mono tracking-[0.2em] uppercase text-gold mb-3">
                              Suggested for your question
                            </div>
                            <div className="space-y-2">
                              {suggestions.map((suggestion) => {
                                const philosopher = selectablePhilosophers.find(
                                  (candidate) => candidate.id === suggestion.id
                                );

                                if (!philosopher) {
                                  return null;
                                }

                                const isSelected = selectedIds.includes(suggestion.id);

                                return (
                                  <button
                                    key={suggestion.id}
                                    type="button"
                                    onClick={() => togglePhilosopher(suggestion.id)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all duration-200 ${
                                      isSelected
                                        ? "border-athenian/40 bg-athenian/5 shadow-sm"
                                        : "border-border-light/80 bg-white/40 hover:border-border"
                                    }`}
                                  >
                                    <PhilosopherAvatar
                                      philosopherId={philosopher.id}
                                      name={philosopher.name}
                                      color={philosopher.color}
                                      initials={philosopher.initials}
                                      size="sm"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="font-serif text-[15px] font-semibold text-ink leading-none">
                                        {philosopher.name}
                                      </div>
                                      <p className="text-[12px] text-ink-light mt-1 leading-snug">
                                        {suggestion.reason}
                                      </p>
                                    </div>
                                    {isSelected && (
                                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 text-athenian">
                                        <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.1" />
                                        <path d="M5 8L7 10L11 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                      </svg>
                                    )}
                                  </button>
                                );
                              })}
                            </div>

                            <div className="mt-4 pt-4 border-t border-border-light/60">
                              <div className="text-[10px] font-mono tracking-[0.2em] uppercase text-ink-faint mb-3">
                                Or pick your own
                              </div>
                            </div>
                          </div>
                        )}

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
                      </>
                    )}
                  </div>

                  <aside className="justify-self-end w-full max-w-[320px] rounded-[22px] border border-border-light/80 bg-[linear-gradient(180deg,rgba(238,230,216,0.52),rgba(248,243,234,0.92))] px-5 py-5 shadow-[0_10px_24px_rgba(42,36,31,0.03)]">
                    <div className="text-[10px] font-mono tracking-[0.2em] uppercase text-gold mb-3">
                      Your question
                    </div>
                    <p className="font-serif text-[17px] leading-[1.52] text-ink mb-5 text-balance">
                      &ldquo;{questionPreview || "Your question will appear here."}&rdquo;
                    </p>
                    {articleUrl.trim() && (
                      <p className="text-[11px] font-mono text-ink-faint mt-[-10px] mb-5 flex items-center gap-1.5">
                        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M6.5 11.5L4 14c-1.1 1.1-3 1.1-4 0s-1.1-3 0-4l2.5-2.5M9.5 4.5L12 2c1.1-1.1 3-1.1 4 0s1.1 3 0 4l-2.5 2.5M5.5 10.5l5-5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Article attached
                      </p>
                    )}

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
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-[16px] bg-athenian text-white font-body text-[15px] font-medium tracking-wide shadow-[0_4px_12px_rgba(35,57,46,0.25)] hover:bg-athenian-light hover:shadow-[0_6px_16px_rgba(35,57,46,0.3)] disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed transition-all duration-200"
                      >
                        {submitting ? "Summoning the dialogue..." : "Hear their thoughts"}
                      </button>
                      {quota && quota.limit !== null && (
                        <p className="mt-3 text-center text-[11px] font-mono tracking-[0.08em] text-ink-faint">
                          {quota.limit - quota.used <= 0 ? (
                            "Daily limit reached"
                          ) : (
                            <>
                              {quota.limit - quota.used} of {quota.limit} question
                              {quota.limit === 1 ? "" : "s"} remaining today
                              {!quota.isLoggedIn && (
                                <span className="text-ink-faint/60">
                                  {" "}
                                  ·{" "}
                                  <a
                                    href="/sign-in"
                                    className="text-athenian/70 hover:text-athenian transition-colors"
                                  >
                                    sign in
                                  </a>{" "}
                                  for more
                                </span>
                              )}
                            </>
                          )}
                        </p>
                      )}

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

          {myThreads.length > 0 && (
            <section className="mb-8">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-[10px] font-mono tracking-[0.22em] uppercase text-ink-faint">
                  Your questions
                </div>
                {myThreads.length > 3 && (
                  <Link
                    href="/profile"
                    className="text-[11px] font-mono text-athenian transition-colors hover:text-athenian/80"
                  >
                    View all
                  </Link>
                )}
              </div>

              <div className="space-y-2">
                {myThreads.slice(0, 3).map((thread) => (
                  <MyThreadCard key={thread.id} thread={thread} />
                ))}
              </div>
            </section>
          )}

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

