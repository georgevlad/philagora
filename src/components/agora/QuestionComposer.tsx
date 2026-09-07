"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { PhilosopherAvatar } from "@/components/PhilosopherAvatar";
import {
  clearAgoraDraft,
  readAgoraDraft,
  writeAgoraDraft,
} from "@/lib/agora-draft";
import type { QuestionClassification } from "@/lib/generation-service";
import type { AgoraThreadVisibility, Philosopher } from "@/lib/types";

type Suggestion = { id: string; reason: string };
type GroupReview = {
  suggestions: Suggestion[];
  classification?: QuestionClassification;
  error?: string;
};

type Draft = {
  question: string;
  visibility: AgoraThreadVisibility;
  askedBy: string;
  articleUrl: string;
  selectedIds: string[];
  requestId?: string;
  review?: GroupReview;
};

export function QuestionComposer({
  philosophers,
  viewerKey,
}: {
  philosophers: Philosopher[];
  viewerKey: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, isPending } = useSession();
  const initialDraft = useRef<Draft>({
    question: "",
    visibility: "private",
    askedBy: "",
    articleUrl: "",
    selectedIds: [],
  });
  const [draft, setDraft] = useState(initialDraft.current);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [quota, setQuota] = useState<{
    used: number;
    limit: number | null;
  } | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const errorMessage = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (error) errorMessage.current?.focus();
  }, [error]);
  const sending = useRef(false);
  const suggestionRequest = useRef<{
    id: number;
    controller?: AbortController;
  }>({ id: 0 });
  const groupHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => () => suggestionRequest.current.controller?.abort(), []);
  const key = `agora:draft:${viewerKey}`;
  useEffect(() => {
    let saved = readAgoraDraft<Draft>(key);
    if (!saved && viewerKey !== "guest" && viewerKey !== "admin") {
      saved = readAgoraDraft<Draft>("agora:sign-in-draft");
      clearAgoraDraft("agora:sign-in-draft");
      if (saved) {
        writeAgoraDraft(key, saved);
        clearAgoraDraft("agora:draft:guest");
      }
    }
    // Restore external tab storage after hydration, before accepting edits.
    if (saved) {
      setDraft(saved);
      setUncertain(!!saved.requestId);
    }
    const prefill = readAgoraDraft<string>("agora:composer-prefill");
    if (!saved && prefill) {
      const restored = { ...initialDraft.current, question: prefill };
      setDraft(restored);
      writeAgoraDraft(key, restored);
    }
    clearAgoraDraft("agora:composer-prefill");
    setReady(true);
    fetch("/api/agora/quota", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setQuota)
      .catch(() => {});
  }, [key, viewerKey]);

  function update(patch: Partial<Draft>) {
    const changesQuestion =
      (patch.question !== undefined && patch.question !== draft.question) ||
      (patch.articleUrl !== undefined && patch.articleUrl !== draft.articleUrl);
    if (changesQuestion) {
      suggestionRequest.current.controller?.abort();
      suggestionRequest.current.id++;
      setSuggesting(false);
    }
    const next = {
      ...draft,
      ...patch,
      ...(changesQuestion ? { review: undefined, selectedIds: [] } : {}),
    };
    setDraft(next);
    writeAgoraDraft(key, next);
    setError("");
  }
  function signIn() {
    writeAgoraDraft("agora:sign-in-draft", draft);
  }
  const needsSignIn = draft.visibility === "private" && !session?.user;
  const questionValid =
    (draft.question.trim().length >= 10 || !!draft.articleUrl.trim()) &&
    draft.question.trim().length <= 500;
  const groupValid =
    draft.selectedIds.length >= 2 && draft.selectedIds.length <= 4;
  const locked = busy || uncertain;
  const reviewing = !!draft.review || !!draft.requestId || suggesting;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!reviewing) {
      void suggest();
      return;
    }
    if (
      sending.current ||
      !questionValid ||
      !groupValid ||
      needsSignIn ||
      suggesting
    )
      return;
    sending.current = true;
    setBusy(true);
    setError("");
    const submitted = {
      ...draft,
      requestId: draft.requestId ?? crypto.randomUUID(),
    };
    setDraft(submitted);
    writeAgoraDraft(key, submitted);
    try {
      const response = await fetch("/api/agora/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: submitted.requestId,
          question: submitted.question.trim(),
          asked_by:
            submitted.visibility === "public" ? submitted.askedBy : undefined,
          visibility: submitted.visibility,
          philosopher_ids: submitted.selectedIds,
          article_url: submitted.articleUrl.trim() || undefined,
          classification: submitted.review?.classification,
        }),
        signal: AbortSignal.timeout(90000),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status < 500 && !uncertain) {
          const editable = { ...submitted, requestId: undefined };
          setDraft(editable);
          writeAgoraDraft(key, editable);
        } else setUncertain(true);
        setError(
          result.error ||
            "Could not confirm your question. Check the same submission again.",
        );
        return;
      }
      if (typeof result.threadId !== "string")
        throw new Error("Missing thread ID");
      clearAgoraDraft(key);
      clearAgoraDraft("agora:sign-in-draft");
      writeAgoraDraft(`agora:recent:${viewerKey}`, result.threadId);
      if (result.articleWarning)
        writeAgoraDraft(
          `agora:article-warning:${result.threadId}`,
          result.articleWarning,
        );
      router.push(`/agora/${result.threadId}`);
    } catch {
      setUncertain(true);
      setError(
        "Your connection was interrupted. Your question may already be saved. Check the same submission below; it will not create another conversation.",
      );
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  async function suggest() {
    if (suggesting || locked || !questionValid || needsSignIn) return;
    const controller = new AbortController();
    const requestId = suggestionRequest.current.id + 1;
    suggestionRequest.current = { id: requestId, controller };
    const submitted = { ...draft, review: undefined, selectedIds: [] };
    setDraft(submitted);
    writeAgoraDraft(key, submitted);
    setSuggesting(true);
    setError("");
    let review: GroupReview = { suggestions: [] };
    try {
      const response = await fetch("/api/agora/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question:
            submitted.question.trim().length >= 10
              ? submitted.question.trim()
              : `What should we make of this? ${submitted.question.trim()}`.trim(),
          article_url: submitted.articleUrl.trim() || undefined,
        }),
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(30000),
        ]),
      });
      const result = await response.json();
      if (
        suggestionRequest.current.id !== requestId ||
        controller.signal.aborted
      )
        return;
      if (!response.ok)
        throw new Error(
          response.status === 429
            ? "Suggestion limit reached. Choose your own group below."
            : "Suggestions are unavailable. Try again or choose your own group below.",
        );
      const classification = result.classification;
      if (
        classification &&
        ["advice", "conceptual", "debate"].includes(
          classification.questionType,
        ) &&
        typeof classification.recommendationsAppropriate === "boolean"
      ) {
        review.classification = {
          questionType: classification.questionType,
          recommendationsAppropriate: classification.recommendationsAppropriate,
          recommendationHint:
            typeof classification.recommendationHint === "string"
              ? classification.recommendationHint
              : null,
        };
      }
      const seen = new Set<string>();
      review.suggestions = (
        Array.isArray(result.suggestions) ? result.suggestions : []
      )
        .filter((item: unknown): item is Suggestion => {
          if (!item || typeof item !== "object") return false;
          const candidate = item as Suggestion;
          if (
            typeof candidate.id !== "string" ||
            typeof candidate.reason !== "string" ||
            !candidate.reason.trim() ||
            seen.has(candidate.id) ||
            !philosophers.some((p) => p.id === candidate.id)
          )
            return false;
          seen.add(candidate.id);
          return true;
        })
        .slice(0, 4);
      if (review.suggestions.length < 2) {
        review.suggestions = [];
        review.error =
          "No suggested group is available. Try again or choose your own group below.";
      }
    } catch (error) {
      if (
        suggestionRequest.current.id !== requestId ||
        controller.signal.aborted
      )
        return;
      review = {
        suggestions: [],
        error:
          error instanceof Error && error.message.startsWith("Suggestion")
            ? error.message
            : "Suggestions are unavailable. Try again or choose your own group below.",
      };
    }
    if (suggestionRequest.current.id !== requestId || controller.signal.aborted)
      return;
    const next = {
      ...submitted,
      review,
      selectedIds: review.suggestions.map((s) => s.id),
    };
    setDraft(next);
    writeAgoraDraft(key, next);
    setSuggesting(false);
    requestAnimationFrame(() => groupHeading.current?.focus());
  }

  function toggleThinker(id: string) {
    update({
      selectedIds: draft.selectedIds.includes(id)
        ? draft.selectedIds.filter((value) => value !== id)
        : [...draft.selectedIds, id],
    });
  }

  const signInLink = (
    <Link
      className="agora-button"
      onClick={signIn}
      href={`/sign-in?returnTo=${encodeURIComponent(pathname + "#ask")}`}
    >
      Sign in to ask privately →
    </Link>
  );

  if (
    ready &&
    viewerKey !== "guest" &&
    viewerKey !== "admin" &&
    !isPending &&
    session?.user?.id !== viewerKey
  ) {
    return (
      <section className="agora-notice">
        <p>
          Your account has changed. Refresh to continue with the current
          account.
        </p>
        <button
          className="agora-text-link"
          onClick={() => window.location.reload()}
        >
          Refresh account
        </button>
      </section>
    );
  }

  return (
    <section
      className="agora-composer"
      id="ask"
      aria-label="Ask the philosophers"
    >
      <form onSubmit={submit}>
        <div className="agora-question-box">
          <label className="sr-only" htmlFor="question">
            Your question for the philosophers
          </label>
          <textarea
            ref={field}
            id="question"
            placeholder="What are you trying to make sense of?"
            rows={3}
            maxLength={500}
            value={draft.question}
            onChange={(e) => update({ question: e.target.value })}
            disabled={!ready || locked}
            aria-describedby="question-privacy question-count question-error"
          />
          <div className="agora-composer-actions">
            <fieldset
              className="agora-visibility"
              disabled={locked || suggesting}
            >
              <legend className="sr-only">Question visibility</legend>
              {(["private", "public"] as const).map((value) => (
                <label key={value}>
                  <input
                    type="radio"
                    name="visibility"
                    value={value}
                    checked={draft.visibility === value}
                    onChange={() => update({ visibility: value })}
                  />
                  {value === "private" ? "Private" : "Public"}
                </label>
              ))}
            </fieldset>
            {!reviewing &&
              (needsSignIn && !isPending ? (
                signInLink
              ) : (
                <button
                  className="agora-button"
                  type="submit"
                  disabled={!ready || !questionValid || isPending}
                >
                  Find my philosophers →
                </button>
              ))}
            {reviewing && !locked && (
              <button
                type="button"
                className="agora-text-link"
                onClick={() => field.current?.focus()}
              >
                Edit your question ↑
              </button>
            )}
          </div>
          <p id="question-count" className="agora-count">
            {draft.question.length}/500
          </p>
        </div>
        <p id="question-privacy" className="agora-meta agora-privacy">
          {draft.visibility === "private"
            ? "Private to your account; not shown in the public Agora. Sign-in is required. Philagora administrators can access conversations."
            : `Your question, answers and any follow-up are public, shown as ${draft.askedBy.trim() || "Anonymous"}. Your account name is not displayed automatically.`}
          {!session?.user && draft.visibility === "public" && (
            <>
              {" "}
              Guests can ask publicly.{" "}
              <Link
                onClick={signIn}
                href={`/sign-in?returnTo=${encodeURIComponent(pathname + "#ask")}`}
              >
                Sign in before asking
              </Link>{" "}
              to keep it in your account and add a follow-up.
            </>
          )}
        </p>
        <p
          id="question-error"
          ref={errorMessage}
          tabIndex={-1}
          className={error ? "agora-error" : "sr-only"}
          role="alert"
        >
          {error}
        </p>
        {reviewing && (
          <section
            className="agora-group-review"
            aria-labelledby="group-heading"
            aria-busy={suggesting}
          >
            <p className="agora-eyebrow">
              Your question → Your group → The conversation
            </p>
            <h2 id="group-heading" ref={groupHeading} tabIndex={-1}>
              {suggesting
                ? "Finding perspectives for your question…"
                : "Who should join the conversation?"}
            </h2>
            <p className="agora-meta" role="status">
              {suggesting
                ? "We’re matching your question with different ways of thinking. Nothing has been submitted yet."
                : draft.review?.error ||
                  "A suggested group for your question. Keep it or adjust it below."}
            </p>
            {!suggesting && (
              <>
                {draft.review?.suggestions.length ? (
                  <fieldset className="agora-suggested-group" disabled={locked}>
                    <legend className="sr-only">Suggested philosophers</legend>
                    {draft.review.suggestions.map((suggestion) => {
                      const p = philosophers.find(
                        (p) => p.id === suggestion.id,
                      )!;
                      return (
                        <label key={p.id}>
                          <input
                            type="checkbox"
                            aria-label={p.name}
                            aria-describedby={`suggestion-${p.id}`}
                            checked={draft.selectedIds.includes(p.id)}
                            disabled={
                              !draft.selectedIds.includes(p.id) &&
                              draft.selectedIds.length >= 4
                            }
                            onChange={() => toggleThinker(p.id)}
                          />
                          <PhilosopherAvatar
                            philosopherId={p.id}
                            name={p.name}
                            initials={p.initials}
                            color={p.color}
                            size="sm"
                          />
                          <span>
                            <strong>{p.name}</strong>
                            <small>{p.tradition}</small>
                          </span>
                          <span
                            className="agora-suggestion-reason"
                            id={`suggestion-${p.id}`}
                          >
                            {suggestion.reason}
                          </span>
                        </label>
                      );
                    })}
                  </fieldset>
                ) : null}
                <details
                  className="agora-options"
                  open={!draft.review?.suggestions.length || undefined}
                >
                  <summary>
                    {draft.review?.suggestions.length
                      ? "Change the group"
                      : "Choose your group"}{" "}
                    · All thinkers
                  </summary>
                  <fieldset className="agora-thinker-picker" disabled={locked}>
                    <legend className="sr-only">All philosophers</legend>
                    {philosophers.map((p) => (
                      <label key={p.id}>
                        <input
                          type="checkbox"
                          aria-label={p.name}
                          checked={draft.selectedIds.includes(p.id)}
                          disabled={
                            !draft.selectedIds.includes(p.id) &&
                            draft.selectedIds.length >= 4
                          }
                          onChange={() => toggleThinker(p.id)}
                        />
                        <PhilosopherAvatar
                          philosopherId={p.id}
                          name={p.name}
                          initials={p.initials}
                          color={p.color}
                          size="sm"
                        />
                        <span>
                          {p.name}
                          <small>{p.tradition}</small>
                        </span>
                      </label>
                    ))}
                  </fieldset>
                </details>
                <p className="agora-meta agora-selected-group" role="status">
                  {draft.selectedIds.length} of 2–4 thinkers selected
                  {draft.selectedIds.length
                    ? `: ${draft.selectedIds.map((id) => philosophers.find((p) => p.id === id)?.name).join(", ")}`
                    : "."}
                </p>
                <p className="agora-meta">
                  Your follow-up will go to this entire group. Answers are
                  followed by a synthesis when available.
                </p>
                <div className="agora-group-submit">
                  {needsSignIn && !isPending ? (
                    signInLink
                  ) : (
                    <button
                      className="agora-button"
                      type="submit"
                      disabled={
                        !questionValid || !groupValid || busy || isPending
                      }
                    >
                      {busy
                        ? "Confirming your question…"
                        : uncertain
                          ? "Check the same submission →"
                          : "Ask the philosophers →"}
                    </button>
                  )}
                  {!locked && (
                    <button
                      className="agora-text-link"
                      type="button"
                      onClick={() => void suggest()}
                      disabled={!questionValid || needsSignIn}
                    >
                      Try suggestions again
                    </button>
                  )}
                </div>
              </>
            )}
          </section>
        )}
        <details className="agora-options">
          <summary>
            Article link{draft.visibility === "public" ? " & display name" : ""}{" "}
            · optional
          </summary>
          <label className="agora-field-label" htmlFor="article-url">
            Share an article
          </label>
          <input
            id="article-url"
            type="url"
            placeholder="https://…"
            value={draft.articleUrl}
            disabled={locked}
            onChange={(e) => update({ articleUrl: e.target.value })}
          />
          <p className="agora-meta">
            Add a question, or leave the question blank to discuss the article.
          </p>
          {draft.visibility === "public" && (
            <>
              <label className="agora-field-label" htmlFor="asked-by">
                Public display name
              </label>
              <input
                id="asked-by"
                maxLength={40}
                value={draft.askedBy}
                disabled={locked || suggesting}
                placeholder="Anonymous"
                onChange={(e) =>
                  update({
                    askedBy: e.target.value.replace(/[^a-zA-Z0-9\s\-_.]/g, ""),
                  })
                }
              />
              <p className="agora-meta">
                Letters A–Z, numbers, spaces, hyphens, periods and underscores.
              </p>
            </>
          )}
        </details>
      </form>
      <div className="agora-suggestions">
        <span>Try a question</span>
        {[
          "Is it okay to want a small life?",
          "Do I owe the world my attention?",
        ].map((q) => (
          <button
            key={q}
            type="button"
            disabled={locked || suggesting}
            onClick={() => {
              update({ question: q });
              field.current?.focus();
            }}
          >
            {q}
          </button>
        ))}
      </div>
      {quota && (
        <p className="agora-meta">
          {quota.limit === null
            ? "Unlimited questions"
            : `${Math.max(0, quota.limit - quota.used)} of ${quota.limit} questions left today. Follow-ups count toward this limit.`}
        </p>
      )}
    </section>
  );
}
