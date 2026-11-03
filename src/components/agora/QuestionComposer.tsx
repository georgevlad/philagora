"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { PhilosopherAvatar } from "@/components/PhilosopherAvatar";
import { ActivityDots, MatchingProgress } from "@/components/agora/AgoraProgress";
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
    visibility: "public",
    askedBy: "",
    articleUrl: "",
    selectedIds: [],
  });
  const [draft, setDraft] = useState(initialDraft.current);
  const audience = useRef(initialDraft.current.visibility);
  const audienceChoices = useRef<HTMLFieldSetElement>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [navigating, setNavigating] = useState(false);
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
  function focusGroup() {
    requestAnimationFrame(() => {
      const heading = groupHeading.current;
      if (!heading) return;
      heading.focus({ preventScroll: true });
      const bounds = heading.getBoundingClientRect();
      if (bounds.top < 24 || bounds.bottom > window.innerHeight - 80) {
        heading.scrollIntoView({
          block: "start",
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
        });
      }
    });
  }
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
      audience.current = saved.visibility;
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
    if (patch.visibility) audience.current = patch.visibility;
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
  const isGuest = viewerKey === "guest" && !session?.user;
  const questionValid =
    (draft.question.trim().length >= 10 || !!draft.articleUrl.trim()) &&
    draft.question.trim().length <= 500;
  const groupValid =
    draft.selectedIds.length >= 2 && draft.selectedIds.length <= 4;
  const locked = busy || navigating || uncertain;
  const reviewing = !!draft.review || !!draft.requestId || suggesting;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!reviewing) {
      void suggest();
      return;
    }
    if (
      sending.current || navigating ||
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
      setNavigating(true);
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
    if (suggesting || locked || !questionValid) return;
    const controller = new AbortController();
    const requestId = suggestionRequest.current.id + 1;
    suggestionRequest.current = { id: requestId, controller };
    const submitted = { ...draft, review: undefined, selectedIds: [] };
    setDraft(submitted);
    writeAgoraDraft(key, submitted);
    setSuggesting(true);
    setError("");
    focusGroup();
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
      // Matching can finish after the reader changes the audience.
      visibility: audience.current,
      review,
      selectedIds: review.suggestions.slice(0, 2).map((s) => s.id),
    };
    setDraft(next);
    writeAgoraDraft(key, next);
    setSuggesting(false);
    focusGroup();
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
      className="agora-composer agora-simple-composer"
      id="ask"
      aria-label="Ask the philosophers"
    >
      <form onSubmit={submit}>
        <ol className="agora-composer-steps" aria-label="Question steps">
          <li aria-current={!reviewing ? "step" : undefined}><span>1</span> Your question</li>
          <li aria-current={reviewing ? "step" : undefined}><span>2</span> Your philosophers</li>
        </ol>
        <fieldset
          ref={audienceChoices}
          id="question-audience"
          className="agora-audience"
          disabled={!ready || locked}
          aria-describedby="question-privacy"
        >
          <legend>Who can read your conversation?</legend>
          <div className="agora-audience-options">
            {(["public", "private"] as const).map((value) => (
              <label key={value}>
                <input
                  type="radio"
                  name="visibility"
                  value={value}
                  aria-label={value === "private" ? "Private" : "Public"}
                  aria-describedby={`visibility-${value}-hint`}
                  checked={draft.visibility === value}
                  onChange={() => update({ visibility: value })}
                />
                <span>
                  <strong>{value === "public" ? "Public" : "Private"}</strong>
                  <small id={`visibility-${value}-hint`}>
                    {value === "public" ? "Appears in the Agora" : isGuest ? "Sign-in required" : "Saved to your account"}
                  </small>
                </span>
              </label>
            ))}
          </div>
          <p id="question-privacy" className="agora-meta" aria-live="polite">
            {draft.visibility === "private"
              ? "Only you and Philagora administrators can read your question and responses."
              : "Anyone can read your question, responses, and any follow-up."}
          </p>
        </fieldset>
        <div className="agora-question-box">
          <div className="agora-question-writing">
            <div className="agora-question-label">
              <label htmlFor="question">
                Your question<span className="sr-only"> for the philosophers</span>
              </label>
              <span
                id="question-count"
                className={draft.question.length ? "agora-count" : "sr-only"}
                data-near-limit={draft.question.length >= 450 || undefined}
              >
                {draft.question.length}/500
              </span>
            </div>
            <textarea
              ref={field}
              id="question"
              placeholder="What’s on your mind?"
              rows={3}
              maxLength={500}
              value={draft.question}
              onChange={(e) => update({ question: e.target.value })}
              disabled={!ready || locked}
              aria-describedby="question-privacy question-count question-hint question-error"
            />
          </div>
          <div className="agora-composer-actions">
            <span id="question-hint" className="agora-meta" role="status">
              {uncertain
                ? "Check your submission below."
                : busy || navigating
                  ? "Your question is on its way."
                  : draft.question.trim().length > 0 && !questionValid
                    ? "A little more detail — at least 10 characters."
                    : reviewing
                      ? "You can still refine your question."
                      : needsSignIn
                        ? "You can choose your group before signing in."
                        : isGuest
                          ? "No account needed for a public question."
                          : "Choose your group before submitting."}
            </span>
            {!reviewing && (
              <button
                className="agora-button"
                type="submit"
                disabled={!ready || !questionValid || isPending}
              >
                Find my philosophers →
              </button>
            )}
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
        </div>
        <details className="agora-options agora-article-option">
          <summary>Add a link</summary>
          <label className="agora-field-label" htmlFor="article-url">
            Share an article
          </label>
          <input
            id="article-url"
            type="url"
            inputMode="url"
            autoComplete="url"
            aria-describedby="article-hint"
            placeholder="https://…"
            value={draft.articleUrl}
            disabled={locked}
            onChange={(e) => update({ articleUrl: e.target.value })}
          />
          <p id="article-hint" className="agora-meta">Add a question, or just share the article.</p>
        </details>
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
            {suggesting && (
              <p className="agora-eyebrow agora-activity-label">
                <ActivityDots /> Matching your question
              </p>
            )}
            <h2 id="group-heading" ref={groupHeading} tabIndex={-1}>
              {suggesting
                ? "Finding perspectives for your question…"
                : "Meet your philosophers"}
            </h2>
            <p className="agora-meta">
              {suggesting
                ? "We’re matching your question with different ways of thinking. Nothing has been submitted yet."
                : draft.review?.error ||
                "Two minds to start with. Change the group if you like."}
            </p>
            {suggesting && <MatchingProgress />}
            {!suggesting && (
              <>
                {draft.selectedIds.length > 0 && (
                  <div
                    className="agora-matched-philosophers agora-enter"
                    role="group"
                    aria-label="Your selected philosophers"
                  >
                    {draft.selectedIds.map((id) => {
                      const p = philosophers.find((p) => p.id === id);
                      if (!p) return null;
                      const suggestion = draft.review?.suggestions.find(
                        (s) => s.id === id,
                      );
                      return (
                        <article key={p.id}>
                          <PhilosopherAvatar
                            philosopherId={p.id}
                            name={p.name}
                            initials={p.initials}
                            color={p.color}
                            size="lg"
                          />
                          <span>
                            <strong>{p.name}</strong>
                            <small>{p.tradition}</small>
                          </span>
                          {suggestion && <p>{suggestion.reason}</p>}
                        </article>
                      );
                    })}
                  </div>
                )}
                <details
                  className="agora-options"
                  open={!draft.review?.suggestions.length || undefined}
                >
                  <summary>
                    {draft.review?.suggestions.length
                      ? "Change philosophers"
                      : "Choose your philosophers"}
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
                  Each thinker responds, with a shared reflection when available.
                </p>
                <div className="agora-review-privacy">
                  <div className="agora-audience-summary">
                    <div>
                      <strong>{draft.visibility === "private" ? "Private conversation" : "Public conversation"}</strong>
                      <p className="agora-meta">
                        {draft.visibility === "private"
                          ? "Visible to you and Philagora administrators."
                          : `Visible to everyone. You’ll appear as ${draft.askedBy.trim() || "Anonymous"}.`}
                      </p>
                    </div>
                    <button type="button" className="agora-text-link" disabled={locked}
                      onClick={() => audienceChoices.current?.querySelector<HTMLInputElement>("input:checked")?.focus()}>
                      Change audience ↑
                    </button>
                  </div>
                  {draft.visibility === "public" && (
                    <details className="agora-options">
                      <summary>Add a display name</summary>
                      <label className="agora-field-label" htmlFor="asked-by">
                        Public display name
                      </label>
                      <input
                        id="asked-by"
                        maxLength={40}
                        autoComplete="nickname"
                        aria-describedby="display-name-hint"
                        value={draft.askedBy}
                        disabled={locked}
                        placeholder="Anonymous"
                        onChange={(e) =>
                          update({
                            askedBy: e.target.value.replace(/[^a-zA-Z0-9\s\-_.]/g, ""),
                          })
                        }
                      />
                      <p id="display-name-hint" className="agora-meta">
                        Letters A–Z, numbers, spaces, hyphens, periods and underscores.
                      </p>
                    </details>
                  )}
                </div>
                {isGuest && draft.visibility === "public" && (
                  <p className="agora-meta agora-followup-note">
                    Want to keep it in your library and ask a follow-up?{" "}
                    <Link
                      onClick={signIn}
                      href={`/sign-in?returnTo=${encodeURIComponent(pathname + "#ask")}`}
                    >
                      Sign in before submitting.
                    </Link>
                  </p>
                )}
                <div className="agora-group-submit">
                  {needsSignIn && !isPending ? (
                    signInLink
                  ) : (
                    <button
                      className="agora-button"
                      type="submit"
                      disabled={
                        !questionValid || !groupValid || busy || navigating || isPending
                      }
                    >
                      {(busy || navigating) && <ActivityDots />}
                      {navigating
                        ? "Opening your conversation…"
                        : busy
                        ? "Confirming your question…"
                        : uncertain
                          ? "Check the same submission →"
                          : draft.visibility === "private"
                            ? "Ask privately →"
                            : "Ask publicly →"}
                    </button>
                  )}
                  {!locked && (
                    <button
                      className="agora-text-link"
                      type="button"
                      onClick={() => void suggest()}
                      disabled={!questionValid}
                    >
                      Try suggestions again
                    </button>
                  )}
                </div>
                {(busy || navigating) && (
                  <p className="agora-meta agora-enter" role="status">
                    {navigating
                      ? "Your question is saved. Let’s hear what your philosophers have to say."
                      : "Sending your question to the group. Your conversation will open automatically."}
                  </p>
                )}
              </>
            )}
          </section>
        )}
      </form>
      {!reviewing && (
        <div className="agora-suggestions">
          <span>Or try</span>
          {[
            "Is it okay to want a small life?",
            "Do I owe the world my attention?",
          ].map((q) => (
            <button
              key={q}
              type="button"
              disabled={!ready || locked || suggesting}
              onClick={() => {
                update({ question: q });
                field.current?.focus();
              }}
            >
              {q}
            </button>
          ))}
        </div>
      )}
      {quota && (reviewing || (quota.limit !== null && quota.used >= quota.limit)) && (
        <p className="agora-meta agora-quota">
          {quota.limit === null
            ? "Unlimited questions"
            : isGuest
              ? `${Math.max(0, quota.limit - quota.used)} of ${quota.limit} questions left today.`
              : `${Math.max(0, quota.limit - quota.used)} of ${quota.limit} questions left today. Follow-ups count toward this limit.`}
        </p>
      )}
    </section>
  );
}
