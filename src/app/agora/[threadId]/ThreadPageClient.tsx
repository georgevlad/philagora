"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import { AgoraShell } from "@/components/agora/AgoraShell";
import { PhilosopherAvatar } from "@/components/PhilosopherAvatar";
import {
  clearAgoraDraft,
  readAgoraDraft,
  writeAgoraDraft,
} from "@/lib/agora-draft";
import type {
  AgoraResponse,
  AgoraSynthesis,
  AgoraThreadDetail,
  AgoraThreadFollowUp,
  Philosopher,
} from "@/lib/types";

const settled = (status: string) =>
  status === "complete" || status === "failed";
function mergeResponses(previous: AgoraResponse[], incoming: AgoraResponse[]) {
  return [
    ...previous,
    ...incoming.filter(
      (r) => !previous.some((p) => p.philosopherId === r.philosopherId),
    ),
  ];
}
function mergeThread(
  previous: AgoraThreadDetail | null,
  incoming: AgoraThreadDetail,
): AgoraThreadDetail {
  if (!previous || previous.id !== incoming.id) return incoming;
  return {
    ...incoming,
    responses: mergeResponses(previous.responses, incoming.responses),
    synthesis: incoming.synthesis ?? previous.synthesis,
    followUp: incoming.followUp
      ? {
          ...incoming.followUp,
          responses: mergeResponses(
            previous.followUp?.responses ?? [],
            incoming.followUp.responses,
          ),
          synthesis:
            incoming.followUp.synthesis ?? previous.followUp?.synthesis ?? null,
        }
      : previous.followUp,
  };
}
function Synthesis({ synthesis }: { synthesis: AgoraSynthesis }) {
  const labels: Record<string, string> = {
    tensions: "Where they differ",
    agreements: "Common ground",
    practicalTakeaways: "To take with you",
    keyInsight: "The central insight",
    frameworkComparison: "Different ways of seeing",
    deeperQuestions: "Questions to sit with",
    centralFaultLine: "The central disagreement",
    commonGround: "Common ground",
    whatIsAtStake: "What is at stake",
  };
  return (
    <section className="agora-synthesis">
      <p className="agora-eyebrow">The conversation, brought together</p>
      <h3>A few things to sit with</h3>
      {Object.entries(synthesis.sections).map(([key, value]) =>
        value?.length ? (
          <div key={key}>
            <h4>{labels[key] ?? key}</h4>
            {Array.isArray(value) ? (
              value.map((text, i) => <p key={i}>{text}</p>)
            ) : (
              <p>{value}</p>
            )}
          </div>
        ) : null,
      )}
    </section>
  );
}
function Round({
  round,
  group,
  onCheck,
  label,
}: {
  round: Pick<
    AgoraThreadFollowUp,
    "status" | "responses" | "synthesis" | "createdAt"
  >;
  group: Philosopher[];
  onCheck: () => void;
  label: string;
}) {
  const [longWait, setLongWait] = useState(false);
  useEffect(() => {
    const update = () =>
      setLongWait(
        Date.now() -
          new Date(
            round.createdAt.endsWith("Z")
              ? round.createdAt
              : round.createdAt.replace(" ", "T") + "Z",
          ).getTime() >
          90000,
      );
    update();
    const timer = setInterval(update, 15000);
    return () => clearInterval(timer);
  }, [round.createdAt]);
  const missing = group.filter(
    (p) => !round.responses.some((r) => r.philosopherId === p.id),
  );
  return (
    <>
      <div className="agora-round-heading">
        <h2>{label}</h2>
        <span>
          {round.responses.length} of {group.length} responses
        </span>
      </div>
      {round.responses.map((r) => (
        <article className="agora-answer" key={r.philosopherId}>
          <Link
            className="agora-person"
            href={`/philosophers/${r.philosopherId}`}
          >
            <PhilosopherAvatar
              philosopherId={r.philosopherId}
              name={r.philosopherName}
              initials={r.philosopherInitials}
              color={r.philosopherColor}
              size="sm"
            />
            <span>
              {r.philosopherName}
              <small>{r.philosopherTradition} · AI persona</small>
            </span>
          </Link>
          {r.posts.map((text, i) => (
            <p key={i}>{text}</p>
          ))}
          {r.recommendation && (
            <aside className="agora-recommendation">
              <p className="agora-eyebrow">
                Go deeper · {r.recommendation.medium}
              </p>
              <h4>
                {r.recommendation.title}
                {r.recommendation.author
                  ? ` by ${r.recommendation.author}`
                  : ""}
              </h4>
              <p>{r.recommendation.reason}</p>
            </aside>
          )}
        </article>
      ))}
      {round.synthesis && <Synthesis synthesis={round.synthesis} />}
      {!settled(round.status) ? (
        <section className="agora-wait">
          <h3>
            {longWait
              ? "This is taking a little longer."
              : "The conversation is taking shape."}
          </h3>
          <p>
            Your question is saved. Responses appear here as they arrive,
            followed by a synthesis.
          </p>
          <ul>
            {missing.map((p) => (
              <li key={p.id}>
                <span>{p.name}</span>
                <span>Awaiting response</span>
              </li>
            ))}
            {!round.synthesis && (
              <li>
                <span>Synthesis</span>
                <span>
                  {missing.length
                    ? "After the responses"
                    : "Awaiting synthesis"}
                </span>
              </li>
            )}
          </ul>
          <p className="agora-meta">
            You can browse and return using this conversation’s link.
          </p>
          <div className="agora-actions">
            <Link className="agora-text-link" href="/">
              Browse the Agora while you wait →
            </Link>
            <button className="agora-text-link" onClick={onCheck}>
              Check for updates
            </button>
          </div>
        </section>
      ) : (
        (round.status === "failed" ||
          missing.length > 0 ||
          !round.synthesis) && (
          <section className="agora-wait">
            <h3>
              {round.responses.length
                ? "Some of the conversation is available."
                : "The conversation was interrupted."}
            </h3>
            <p>
              {missing.length
                ? `${missing.map((p) => p.name).join(", ")} could not respond. `
                : ""}
              {!round.synthesis ? "A synthesis is not available. " : ""}Any
              answers already received are saved here.
            </p>
            <p className="agora-meta">
              Checking retrieves the latest saved state. It does not restart
              generation. You can keep these answers or begin a new question.
            </p>
            <div className="agora-actions">
              <button className="agora-outline" onClick={onCheck}>
                Check for updates
              </button>
              <Link className="agora-text-link" href="/#ask">
                Ask a new question →
              </Link>
            </div>
          </section>
        )
      )}
    </>
  );
}

export function ThreadPageClient({
  threadId,
  initialThread,
  philosophers,
  initialCanFollowUp,
  viewerKey,
}: {
  threadId: string;
  initialThread: AgoraThreadDetail | null;
  philosophers: Philosopher[];
  initialCanFollowUp: boolean;
  viewerKey: string;
}) {
  const { data: session, isPending } = useSession();
  const [thread, setThread] = useState(initialThread);
  const [canFollowUp, setCanFollowUp] = useState(initialCanFollowUp);
  const [unavailable, setUnavailable] = useState(!initialThread);
  const [networkError, setNetworkError] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [followError, setFollowError] = useState("");
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [articleWarning, setArticleWarning] = useState<string | null>(null);
  const [shareNote, setShareNote] = useState("");
  const fetching = useRef(false);
  const sending = useRef(false);
  const mounted = useRef(true);
  const draftKey = `agora:followup:${viewerKey}:${threadId}`;
  const poll = useCallback(async () => {
    if (fetching.current) return null;
    fetching.current = true;
    try {
      const response = await fetch(`/api/agora/${threadId}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
      if (!mounted.current) return null;
      if (response.status === 404 || response.status === 403) {
        setThread(null);
        setUnavailable(true);
        setCanFollowUp(false);
        return null;
      }
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (!mounted.current) return null;
      setThread((old) => mergeThread(old, data.detail));
      setUnavailable(false);
      setCanFollowUp(data.canFollowUp);
      setNetworkError("");
      if (data.detail.followUp) {
        clearAgoraDraft(draftKey);
        setUncertain(false);
        setFollowError("");
      }
      return data.detail as AgoraThreadDetail;
    } catch {
      if (mounted.current)
        setNetworkError(
          "We couldn’t check for updates. Your saved question and the answers shown here are safe. Reconnect and check again.",
        );
      return null;
    } finally {
      fetching.current = false;
    }
  }, [threadId, draftKey]);
  const generating =
    !!thread &&
    (!settled(thread.status) ||
      (thread.followUp && !settled(thread.followUp.status)));
  useEffect(() => {
    mounted.current = true;
    void poll();
    const interval = setInterval(() => void poll(), generating ? 2500 : 15000);
    const refresh = () => {
      if (document.visibilityState === "visible") void poll();
    };
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      mounted.current = false;
      clearInterval(interval);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [poll, generating, session?.user?.id]);
  useEffect(() => {
    const saved = readAgoraDraft<{ text: string; uncertain: boolean }>(
      draftKey,
    );
    if (saved) {
      setFollowUp(saved.text);
      setUncertain(saved.uncertain);
    }
    setArticleWarning(
      readAgoraDraft<string>(`agora:article-warning:${threadId}`),
    );
    writeAgoraDraft(`agora:recent:${viewerKey}`, threadId);
  }, [draftKey, threadId, viewerKey]);

  async function submitFollowUp(event: FormEvent) {
    event.preventDefault();
    if (sending.current || !canFollowUp || followUp.trim().length < 10) return;
    sending.current = true;
    setBusy(true);
    setFollowError("");
    writeAgoraDraft(draftKey, { text: followUp, uncertain: true });
    try {
      const response = await fetch(`/api/agora/${threadId}/follow-up`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: followUp.trim() }),
        signal: AbortSignal.timeout(30000),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status >= 500 || uncertain) setUncertain(true);
        else writeAgoraDraft(draftKey, { text: followUp, uncertain: false });
        setFollowError(result.error || "Could not confirm your follow-up.");
        if (response.status === 409) await poll();
        return;
      }
      setUncertain(true); // Keep the accepted draft locked until polling sees it.
      await poll();
    } catch {
      setUncertain(true);
      setFollowError(
        "The connection was interrupted. Check this same follow-up again; it cannot create a second follow-up.",
      );
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  async function share() {
    try {
      if (navigator.share)
        await navigator.share({
          title: "Philagora conversation",
          url: window.location.href,
        });
      else {
        await navigator.clipboard.writeText(window.location.href);
        setShareNote("Conversation link copied.");
      }
    } catch {
      setShareNote(
        "You can copy this conversation’s address from your browser.",
      );
    }
  }
  const accountChanged =
    thread?.visibility === "private" &&
    viewerKey !== "admin" &&
    !isPending &&
    session?.user?.id !== viewerKey;
  if (unavailable || !thread || accountChanged)
    return (
      <AgoraShell>
        <main id="main" className="agora-reading">
          <h1>Conversation unavailable</h1>
          <p>
            This conversation may be private or no longer available. Sign in
            with the account that asked it.
          </p>
          <div className="agora-actions">
            <Link
              className="agora-button"
              href={`/sign-in?returnTo=${encodeURIComponent(`/agora/${threadId}`)}`}
            >
              Sign in
            </Link>
            <Link className="agora-text-link" href="/">
              Return to the Agora →
            </Link>
          </div>
        </main>
      </AgoraShell>
    );
  const group = thread.philosophers
    .map((id) => philosophers.find((p) => p.id === id))
    .filter((p): p is Philosopher => !!p);
  const status = thread.followUp
    ? `Follow-up: ${thread.followUp.responses.length} of ${group.length} responses. ${settled(thread.followUp.status) ? "Generation has finished." : "Waiting for more."}`
    : `${thread.responses.length} of ${group.length} responses. ${settled(thread.status) ? "Generation has finished." : "Waiting for more."}`;
  return (
    <AgoraShell>
      <main id="main" className="agora-reading">
        <div className="agora-thread-top">
          <Link className="agora-text-link" href="/">
            ← Back to the Agora
          </Link>
          <span className="agora-badge">
            {thread.visibility === "private"
              ? "Private conversation"
              : "Public conversation"}
          </span>
        </div>
        <header className="agora-thread-heading">
          <p className="agora-eyebrow">Your question, different perspectives</p>
          <h1>{thread.question}</h1>
          <p className="agora-meta">
            Asked by {thread.askedBy}.{" "}
            {thread.visibility === "private"
              ? "Private to your account. Administrators can access conversations."
              : "This question, its answers and any follow-up are public."}
          </p>
          {thread.article && (
            <aside className="agora-article">
              <span className="agora-eyebrow">Shared article</span>
              <a href={thread.article.url} target="_blank" rel="noreferrer">
                {thread.article.title ||
                  thread.article.source ||
                  "Read the article"}{" "}
                ↗
              </a>
              {thread.article.excerpt && <p>{thread.article.excerpt}</p>}
            </aside>
          )}
          {articleWarning && <p className="agora-notice">{articleWarning}</p>}
          <div className="agora-group">
            <div>
              {group.map((p) => (
                <PhilosopherAvatar
                  key={p.id}
                  philosopherId={p.id}
                  name={p.name}
                  initials={p.initials}
                  color={p.color}
                  size="sm"
                />
              ))}
            </div>
            <p>
              {group.map((p) => p.name).join(", ")}
              <small>AI interpretations of historical thinkers</small>
            </p>
          </div>
        </header>
        <nav className="agora-round-nav" aria-label="Conversation sections">
          <a href="#first-responses">First responses</a>
          {thread.followUp && <a href="#follow-up">The follow-up</a>}
          {thread.visibility === "public" && (
            <button onClick={share}>Share conversation</button>
          )}
        </nav>
        <p className="sr-only" role="status" aria-live="polite">
          {status}{" "}
          {(thread.followUp?.synthesis ?? thread.synthesis)
            ? "Synthesis is available."
            : ""}
        </p>
        <p className="agora-meta" role="status">
          {shareNote}
        </p>
        {networkError && (
          <div className="agora-error" role="alert">
            <p>{networkError}</p>
            <button className="agora-text-link" onClick={() => void poll()}>
              Check connection and updates
            </button>
          </div>
        )}
        <section id="first-responses">
          <Round
            round={thread}
            group={group}
            onCheck={() => void poll()}
            label="First responses"
          />
        </section>
        {thread.followUp && (
          <section id="follow-up">
            <header className="agora-followup-question">
              <p className="agora-eyebrow">
                The follow-up · To the whole group
              </p>
              <h2>{thread.followUp.question}</h2>
              <p className="agora-meta">
                {thread.visibility === "public"
                  ? "Public, just like the original conversation."
                  : "Private, just like the original conversation."}
              </p>
            </header>
            <Round
              round={thread.followUp}
              group={group}
              onCheck={() => void poll()}
              label="The group responds"
            />
          </section>
        )}
        {canFollowUp && !thread.followUp && (
          <section className="agora-followup-composer">
            <p className="agora-eyebrow">Stay with the question</p>
            <h2>What would you ask them next?</h2>
            <p>
              One follow-up to the whole original group. They’ll have your first
              question, the responses and synthesis for context.
            </p>
            <form onSubmit={submitFollowUp}>
              <label className="agora-field-label" htmlFor="follow-up-question">
                Your follow-up to the group
              </label>
              <textarea
                id="follow-up-question"
                rows={4}
                maxLength={500}
                value={followUp}
                disabled={busy || uncertain}
                onChange={(e) => {
                  setFollowUp(e.target.value);
                  setFollowError("");
                  writeAgoraDraft(draftKey, {
                    text: e.target.value,
                    uncertain: false,
                  });
                }}
                aria-describedby="follow-up-privacy follow-up-error"
              />
              <p id="follow-up-privacy" className="agora-meta">
                {thread.visibility === "public"
                  ? "Your follow-up and the group’s answers will be public, under the same display name."
                  : "The follow-up stays private to your account, with administrator access."}
              </p>
              <div className="agora-composer-actions">
                <span className="agora-meta">{followUp.length}/500</span>
                <button
                  className="agora-button"
                  disabled={busy || followUp.trim().length < 10}
                >
                  {busy
                    ? "Confirming your follow-up…"
                    : uncertain
                      ? "Check the same follow-up →"
                      : "Ask the whole group →"}
                </button>
              </div>
              <p
                id="follow-up-error"
                className={followError ? "agora-error" : "sr-only"}
                role="alert"
              >
                {followError}
              </p>
            </form>
          </section>
        )}
        {settled(thread.status) && !canFollowUp && !thread.followUp && (
          <p className="agora-notice">
            {thread.status === "failed"
              ? "This conversation could not finish generating."
              : "One follow-up is available only to the registered account that asked the original question. Guest questions cannot be claimed after submission."}{" "}
            {!session?.user && (
              <Link
                href={`/sign-in?returnTo=${encodeURIComponent(`/agora/${threadId}`)}`}
              >
                Sign in
              </Link>
            )}
          </p>
        )}
        {thread.followUp && settled(thread.followUp.status) && (
          <section className="agora-conversation-end">
            <h2>A place to leave it, for now.</h2>
            <p>
              This conversation includes its one follow-up. You can return to it
              whenever you like.
            </p>
          </section>
        )}
        <Link className="agora-text-link" href="/#ask">
          Begin a new question →
        </Link>
        <p className="agora-meta">
          These are generated interpretations, not historical quotations or
          professional advice.
        </p>
      </main>
    </AgoraShell>
  );
}
