"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import type { AgoraRecovery } from "@/lib/types";

const messages: Record<AgoraRecovery["state"], string> = {
  available: "The saved context is sufficient to continue the missing work. Received answers and synthesis will be kept.",
  unavailable: "This older conversation does not have enough saved generation context for safe recovery. An editor needs to review the missing work.",
  queued: "Your question is saved. The conversation is queued. Generation continues even when you leave this page.",
  running: "Your question is saved. Generation is continuing with the missing work. Received answers and synthesis are kept.",
  retry_wait: "Generation was interrupted. Another attempt is scheduled automatically, even if you leave this page.",
  complete: "The conversation is complete. All saved answers and synthesis are available.",
  exhausted: "Automatic retries have been used up. An editor must finish the missing work. Your saved answers remain available.",
  blocked: "The saved generation context needs editorial review before the missing work can continue. Your received answers are preserved.",
};
export function AgoraRecoveryControls({ id, recovery, onCheck }: {
  id: string; recovery?: AgoraRecovery; onCheck: () => void;
}) {
  const [requested, setRequested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const sending = useRef(false);
  if (!recovery || (recovery.state === "complete" && !requested)) return null;
  async function recover() {
    if (sending.current || requested) return;
    sending.current = true;
    setBusy(true);
    try {
      const response = await fetch(`/api/agora/${id}/recover`, { method: "POST", signal: AbortSignal.timeout(15000) });
      const data = await response.json();
      if (!response.ok) setNote(data.error || "Recovery could not be confirmed. Check for updates.");
      else { setRequested(true); setNote("Recovery accepted. Your saved content is preserved."); }
      onCheck();
    } catch { setNote("Recovery could not be confirmed. Check for updates; requesting recovery again cannot duplicate saved answers."); }
    finally { sending.current = false; setBusy(false); }
  }
  return <section className="agora-wait" aria-label="Conversation recovery">
    <h3>{recovery.state === "complete" ? "Conversation complete" : "Continuing this conversation"}</h3>
    <p role="status">{messages[recovery.state]}</p>
    {recovery.state === "retry_wait" && <p className="agora-meta">Retries are limited to three attempts for each missing answer or synthesis. Requesting recovery keeps the scheduled wait.</p>}
    <p className="agora-meta">Checking for updates reads saved state. Recovery continues this same conversation and uses no additional question allowance.</p>
    <div className="agora-actions">
      {["queued", "running", "retry_wait"].includes(recovery.state) && <Link className="agora-text-link" href="/">Browse the Agora while you wait →</Link>}
      {(recovery.canRecover || requested) && <button className="agora-outline" aria-disabled={busy || requested} onClick={() => void recover()}>
        {busy ? "Requesting recovery…" : requested ? "Recovery requested" : "Recover missing work"}
      </button>}
      <button className="agora-text-link" onClick={onCheck}>Check for updates</button>
    </div>
    <p role="status">{note}</p>
  </section>;
}
