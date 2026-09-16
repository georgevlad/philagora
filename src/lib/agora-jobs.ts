import type Database from "better-sqlite3";
import { getAgoraSynthesisForThread, type AgoraGenerationArticle, type AgoraFollowUpContextResponseRow } from "@/lib/agora";
import type { AgoraQuestionType, AgoraRecovery, AgoraSynthesis } from "@/lib/types";

export const AGORA_MAX_ATTEMPTS = 3;
export const AGORA_LEASE_MS = 120_000;
export const AGORA_RETRY_DELAYS = [30_000, 120_000];
export const AGORA_RECOVERY_WINDOW_MS = 600_000;
export const AGORA_RECOVERY_REQUESTS = 5;

export interface AgoraJobContext {
  version: 1;
  question: string;
  askedBy: string;
  questionType: AgoraQuestionType;
  recommendationsEnabled: boolean;
  recommendationHint: string | null;
  visibility: "public" | "private";
  userId: string | null;
  // Stored in selection order, with identity labels frozen for synthesis.
  participants: { id: string; name: string; tradition: string }[];
  article: AgoraGenerationArticle | null;
  parent: {
    id: string;
    question: string;
    responses: AgoraFollowUpContextResponseRow[];
    synthesis: AgoraSynthesis | null;
  } | null;
}
export interface AgoraJob {
  thread_id: string;
  context_json: string;
  state: AgoraRecovery["state"];
  lease_token: string | null;
  lease_until: number | null;
  next_attempt_at: number;
  failure_code: string | null;
}
export function getAgoraJob(db: Database.Database, id: string) {
  return db.prepare("SELECT * FROM agora_jobs WHERE thread_id = ?").get(id) as AgoraJob | undefined;
}
export function snapshotParticipants(db: Database.Database, ids: string[]) {
  const select = db.prepare("SELECT id, name, tradition FROM philosophers WHERE id = ?");
  return ids.map((id) => {
    const p = select.get(id) as AgoraJobContext["participants"][number] | undefined;
    if (!p) throw new Error("Invalid Agora participant");
    return p;
  });
}
// Call inside the same transaction that accepts the thread and its participants.
export function enqueueAgoraJob(db: Database.Database, id: string, context: AgoraJobContext, now = Date.now()) {
  db.prepare(`INSERT INTO agora_jobs (thread_id, context_json, created_at, updated_at) VALUES (?, ?, ?, ?)`)
    .run(id, JSON.stringify(context), now, now);
  const insert = db.prepare("INSERT INTO agora_job_steps (thread_id, step_key) VALUES (?, ?)");
  for (const p of context.participants) insert.run(id, `response:${p.id}`);
  insert.run(id, "synthesis");
}
export function agoraWork(db: Database.Database, id: string) {
  const participants = db.prepare("SELECT philosopher_id FROM agora_thread_philosophers WHERE thread_id = ? ORDER BY rowid")
    .all(id) as { philosopher_id: string }[];
  const responses = db.prepare("SELECT philosopher_id, posts, sort_order FROM agora_responses WHERE thread_id = ? ORDER BY sort_order")
    .all(id) as { philosopher_id: string; posts: string; sort_order: number }[];
  const synthesis = getAgoraSynthesisForThread(db, id);
  const missing = participants.filter((p) => !responses.some((r) => r.philosopher_id === p.philosopher_id));
  const valid = participants.length >= 2 && responses.every((r, i) => {
    try {
      const posts: unknown = JSON.parse(r.posts);
      return participants.some((p) => p.philosopher_id === r.philosopher_id)
        && responses.findIndex((other) => other.philosopher_id === r.philosopher_id) === i
        && Array.isArray(posts) && posts.length > 0 && posts.every((p) => typeof p === "string")
        && posts.some((p) => p.trim());
    } catch { return false; }
  });
  return { participants, responses, synthesis, missing, valid, complete: valid && missing.length === 0 && !!synthesis };
}

// Legacy adoption is explicit only. Never infer lost article text, recommendation hints,
// follow-up snapshots or context that predates a child without its own snapshot.
export function legacyAgoraContext(db: Database.Database, id: string): AgoraJobContext | null {
  const t = db.prepare("SELECT * FROM agora_threads WHERE id = ?").get(id) as {
    question: string; asked_by: string; question_type: AgoraQuestionType;
    recommendations_enabled: number; visibility: "public" | "private"; user_id: string | null;
    follow_up_to: string | null; ip_address: string | null;
    article_url: string | null; article_title: string | null; article_source: string | null; article_excerpt: string | null;
  } | undefined;
  if (!t || t.follow_up_to || !t.ip_address) return null;
  const work = agoraWork(db, id);
  if (!work.valid || work.complete || work.participants.length > 4) return null;
  const children = db.prepare("SELECT id FROM agora_threads WHERE follow_up_to = ?").all(id) as { id: string }[];
  if (children.some((c) => !getAgoraJob(db, c.id))) return null;
  if (work.missing.length && (t.article_url || t.recommendations_enabled)) return null;
  const ordered = work.participants.map((p) => p.philosopher_id);
  if (work.responses.some((r) => ordered[r.sort_order] !== r.philosopher_id)) return null;
  return {
    version: 1, question: t.question, askedBy: t.asked_by, questionType: t.question_type,
    recommendationsEnabled: t.recommendations_enabled === 1, recommendationHint: null,
    visibility: t.visibility, userId: t.user_id, participants: snapshotParticipants(db, ordered),
    article: t.article_url ? { url: t.article_url, title: t.article_title, source: t.article_source, excerpt: t.article_excerpt } : null,
    parent: null,
  };
}

// Read-only and intentionally content-free. Authorization is added at the route boundary.
export function getAgoraRecovery(db: Database.Database, id: string): AgoraRecovery {
  const work = agoraWork(db, id);
  const job = getAgoraJob(db, id);
  if (work.complete) return { state: "complete", canRecover: false };
  if (!job) return { state: legacyAgoraContext(db, id) ? "available" : "unavailable", canRecover: false };
  return {
    state: job.state === "complete" ? "blocked" : job.state,
    canRecover: false,
    nextAttemptAt: job.state === "retry_wait" ? new Date(job.next_attempt_at).toISOString() : undefined,
  };
}

export class AgoraRecoveryError extends Error {
  constructor(public status: number, message: string, public retryAfter?: number) { super(message); }
}
export function requestAgoraRecovery(db: Database.Database, id: string, actorKey: string, now = Date.now()) {
  return db.transaction(() => {
    // Count even idempotent requests. No quota reset and no new question allowance.
    db.prepare("DELETE FROM agora_recovery_limits WHERE window_start <= ?").run(now - AGORA_RECOVERY_WINDOW_MS);
    const limit = db.prepare("SELECT requests, window_start FROM agora_recovery_limits WHERE actor_key = ?")
      .get(actorKey) as { requests: number; window_start: number } | undefined;
    if (limit && limit.requests >= AGORA_RECOVERY_REQUESTS)
      return new AgoraRecoveryError(429, "Too many recovery requests. Please try again later.", Math.ceil((limit.window_start + AGORA_RECOVERY_WINDOW_MS - now) / 1000));
    db.prepare(`INSERT INTO agora_recovery_limits (actor_key, window_start, requests) VALUES (?, ?, 1)
      ON CONFLICT(actor_key) DO UPDATE SET requests = requests + 1`).run(actorKey, now);
    const recovery = getAgoraRecovery(db, id);
    if (recovery.state === "complete") return recovery;
    if (recovery.state === "unavailable" || recovery.state === "blocked")
      return new AgoraRecoveryError(409, "This conversation needs editorial help because its original generation context cannot be safely recovered.");
    if (recovery.state === "exhausted")
      return new AgoraRecoveryError(409, "Automatic retries have been used up. An editor must finish the missing work.");
    if (!getAgoraJob(db, id)) enqueueAgoraJob(db, id, legacyAgoraContext(db, id)!, now);
    // Respect backoff and an existing lease. Repeated POSTs never replenish attempts.
    db.prepare("UPDATE agora_threads SET status = 'in_progress' WHERE id = ?").run(id);
    return getAgoraRecovery(db, id);
  }).immediate();
}

// Existing admin draft/approval flow stays available for unmanaged conversations and
// missing work on terminal jobs. Active public jobs have one writer.
export function agoraEditorialConflict(db: Database.Database, id: string, step?: string): string | null {
  const job = getAgoraJob(db, id);
  if (!job) return null;
  if (["queued", "running", "retry_wait"].includes(job.state))
    return "This conversation has an active recovery job. Wait for it to finish before editorial changes.";
  if (!step) return "Generation controls the status of this conversation.";
  const exists = step === "synthesis" ? getAgoraSynthesisForThread(db, id) : db.prepare("SELECT 1 FROM agora_responses WHERE thread_id = ? AND philosopher_id = ?").get(id, step);
  return exists ? "This completed content is preserved by recovery." : null;
}

export function reconcileAgoraEditorialCompletion(db: Database.Database, id: string) {
  const complete = agoraWork(db, id).complete;
  if (!complete && !getAgoraJob(db, id)) return;
  db.prepare("UPDATE agora_threads SET status = ? WHERE id = ?").run(complete ? "complete" : "failed", id);
  if (complete) db.prepare("UPDATE agora_jobs SET state = 'complete', failure_code = NULL WHERE thread_id = ?").run(id);
}
