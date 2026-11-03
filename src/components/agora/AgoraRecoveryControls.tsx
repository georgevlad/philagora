"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import type { AgoraRecovery } from "@/lib/types";
import { ActivityDots, ConversationProgress, type ConversationProgressProps } from "./AgoraProgress";

const messages: Record<AgoraRecovery["state"], string> = {
  available: "The saved context is sufficient to continue the missing work. Received answers and synthesis will be kept.",
  unavailable: "This older conversation does not have enough saved generation context for safe recovery. An editor needs to review the missing work.",
  queued: "Your question is saved. Your group will begin shortly. Answers will appear here as they’re ready.",
  running: "Your question is saved. Each perspective appears as it’s ready, followed by a shared reflection.",
  retry_wait: "Generation was interrupted. We’ll try again automatically. The answers already here are saved.",
  complete: "The conversation is complete. All saved answers and synthesis are available.",
  exhausted: "Automatic retries have been used up. An editor must finish the missing work. Your saved answers remain available.",
  blocked: "The saved generation context needs editorial review before the missing work can continue. Your received answers are preserved.",
};
export function AgoraRecoveryControls({ id, recovery, onCheck, progress, longWait }: {
  id: string;
  recovery?: AgoraRecovery;
  onCheck: () => Promise<unknown>;
  progress: Omit<ConversationProgressProps, "state">;
  longWait: boolean;
}) {
  const [requested, setRequested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [checking, setChecking] = useState(false);
  const sending = useRef(false);
  if (!recovery || (recovery.state === "complete" && !requested && !busy)) return null;
  const active = ["queued", "running", "retry_wait"].includes(recovery.state);
  const hasAllAnswers = progress.group.every((p) => progress.responses.some((r) => r.philosopherId === p.id));
  const title = recovery.state === "complete" ? "Conversation complete"
    : active && progress.connectionIssue ? "Reconnecting to the conversation"
    : recovery.state === "queued" ? "Gathering your philosophers"
    : recovery.state === "running" ? hasAllAnswers ? "Bringing the perspectives together" : "The conversation is taking shape."
    : recovery.state === "retry_wait" ? "A little longer than expected"
    : "Continuing this conversation";
  async function check() {
    if (checking) return;
    setChecking(true);
    try { await onCheck(); }
    finally { setChecking(false); }
  }
  async function recover() {
    if (sending.current || requested) return;
    sending.current = true;
    setBusy(true);
    try {
      const response = await fetch(`/api/agora/${id}/recover`, { method: "POST", signal: AbortSignal.timeout(15000) });
      const data = await response.json();
      if (!response.ok) setNote(data.error || "Recovery could not be confirmed. Check for updates.");
      else { setRequested(true); setNote("Recovery accepted. Your saved content is preserved."); }
      await onCheck();
    } catch { setNote("Recovery could not be confirmed. Check for updates; requesting recovery again cannot duplicate saved answers."); }
    finally { sending.current = false; setBusy(false); }
  }
  return <section className={`agora-wait${active ? " agora-wait-active" : ""}`} aria-label="Conversation recovery">
    {active && <p className="agora-eyebrow agora-activity-label">
      <ActivityDots />{progress.connectionIssue ? "Connection interrupted" : recovery.state === "retry_wait" ? "Resuming shortly" : "Conversation in progress"}
    </p>}
    <h3>{title}</h3>
    <p role="status">{progress.connectionIssue && active
      ? "Your question and received answers are saved. We’ll check again when your connection returns."
      : messages[recovery.state]}</p>
    {active && <ConversationProgress {...progress} state={recovery.state} />}
    {longWait && recovery.state === "running" && !progress.connectionIssue && <p className="agora-meta">This is taking a little longer. There’s no need to submit your question again.</p>}
    <p className="agora-meta">{active
      ? "Updates appear automatically. You can browse and return to this conversation at any time."
      : "Checking for updates keeps this conversation. Recovering missing answers uses no additional question allowance."}</p>
    <div className="agora-actions">
      {active && <Link className="agora-text-link" href="/">Browse the Agora while you wait →</Link>}
      {((recovery.canRecover && ["available", "retry_wait"].includes(recovery.state)) || busy || requested) && <button className="agora-outline" aria-disabled={busy || requested} onClick={() => void recover()}>
        {busy && <ActivityDots />}{busy ? "Requesting recovery…" : requested ? "Recovery requested" : "Recover missing work"}
      </button>}
      <button className="agora-text-link" disabled={checking} onClick={() => void check()}>
        {checking && <ActivityDots />}{checking ? "Checking for updates…" : "Check for updates"}
      </button>
    </div>
    <p role="status">{note}</p>
  </section>;
}
