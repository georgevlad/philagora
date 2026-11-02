import crypto from "node:crypto";
import { getDb } from "@/lib/db";
import { generateContent, generateSynthesis } from "@/lib/generation-service";
import { withAgoraModelCall } from "@/lib/agora-model-call";
import { getAgoraResponseTemplate, getSynthesisTemplateForType } from "@/lib/content-templates";
import {
  buildAgoraResponseSourceMaterial, buildAgoraSynthesisSourceMaterial,
  buildAgoraFollowUpResponseSourceMaterial, buildAgoraFollowUpSynthesisSourceMaterial,
  parseAgoraRecommendation, parseAgoraSynthesis,
} from "@/lib/agora";
import {
  AGORA_LEASE_MS, AGORA_MAX_ATTEMPTS, AGORA_RETRY_DELAYS,
  agoraWork, getAgoraJob, type AgoraJobContext,
} from "@/lib/agora-jobs";

// Every claim and write uses SQLite's IMMEDIATE transaction and a random fencing token.
// An expired worker may finish a model call, but can never commit its stale result.
export function claimAgoraJob(threadId: string, now = Date.now()) {
  const db = getDb();
  return db.transaction(() => {
    const job = getAgoraJob(db, threadId);
    if (!job || !["queued", "retry_wait", "running"].includes(job.state)) return null;
    if (job.state === "running" ? (job.lease_until ?? 0) > now : job.next_attempt_at > now) return null;
    const token = crypto.randomUUID();
    db.prepare(`UPDATE agora_jobs SET state = 'running', lease_token = ?, lease_until = ?, updated_at = ? WHERE thread_id = ?`)
      .run(token, now + AGORA_LEASE_MS, now, threadId);
    db.prepare("UPDATE agora_threads SET status = 'in_progress' WHERE id = ?").run(threadId);
    return { token, contextJson: job.context_json };
  }).immediate();
}

export async function runAgoraGeneration(threadId: string): Promise<void> {
  const claim = (() => {
    try { return claimAgoraJob(threadId); }
    catch { console.error("[Agora worker] Could not claim job; it remains available for recovery."); return null; }
  })();
  if (!claim) return;
  const db = getDb();
  const ownsLease = () => {
    const job = getAgoraJob(db, threadId);
    return job?.state === "running" && job.lease_token === claim.token && (job.lease_until ?? 0) > Date.now();
  };
  const fenced = <T>(operation: () => T): T | undefined => db.transaction(() => {
    if (!ownsLease()) return undefined;
    return operation();
  }).immediate();
  const finish = (state: "complete" | "exhausted" | "blocked" | "retry_wait", delay = 0) => fenced(() => {
    db.prepare(`UPDATE agora_jobs SET state = ?, failure_code = ?, next_attempt_at = ?, lease_token = NULL, lease_until = NULL, updated_at = ? WHERE thread_id = ?`)
      .run(state, state === "complete" ? null : state === "blocked" ? "context_unavailable" : "generation_interrupted", Date.now() + delay, Date.now(), threadId);
    db.prepare("UPDATE agora_threads SET status = ? WHERE id = ?")
      .run(state === "complete" ? "complete" : state === "retry_wait" ? "in_progress" : "failed", threadId);
  });
  const heartbeat = setInterval(() => {
    try {
      fenced(() => db.prepare("UPDATE agora_jobs SET lease_until = ?, updated_at = ? WHERE thread_id = ?")
        .run(Date.now() + AGORA_LEASE_MS, Date.now(), threadId));
    } catch { /* Lease expiry fences a worker that cannot renew. */ }
  }, AGORA_LEASE_MS / 3);
  heartbeat.unref();
  try {
    const context: AgoraJobContext = JSON.parse(claim.contextJson);
    const work = agoraWork(db, threadId);
    const ids = context.participants.map((p) => p.id);
    const current = db.prepare("SELECT question, visibility, user_id, question_type, recommendations_enabled, follow_up_to FROM agora_threads WHERE id = ?")
      .get(threadId) as { question: string; visibility: string; user_id: string | null; question_type: string; recommendations_enabled: number; follow_up_to: string | null };
    if (context.version !== 1 || !work.valid || ids.length !== work.participants.length
      || work.participants.some((p) => !ids.includes(p.philosopher_id))
      || work.responses.some((r) => ids[r.sort_order] !== r.philosopher_id)
      || current.question !== context.question || current.visibility !== context.visibility || current.user_id !== context.userId
      || current.question_type !== context.questionType || !!current.recommendations_enabled !== context.recommendationsEnabled
      || current.follow_up_to !== (context.parent?.id ?? null)) {
      finish("blocked"); return;
    }
    const common = {
      question: context.question, askedBy: context.askedBy, questionType: context.questionType,
      recommendationsAppropriate: context.recommendationsEnabled,
      recommendationHint: context.recommendationHint, article: context.article,
    };
    const parent = context.parent ? {
      parentQuestion: context.parent.question, parentResponses: context.parent.responses,
      parentSynthesis: context.parent.synthesis, followUpQuestion: context.question,
    } : null;
    const steps = [...ids.map((id) => `response:${id}`), "synthesis"];
    for (const key of steps) {
      if (!ownsLease()) return;
      const synthesisStep = key === "synthesis";
      const pid = synthesisStep ? null : key.slice("response:".length);
      const currentWork = agoraWork(db, threadId);
      if (synthesisStep ? currentWork.synthesis : currentWork.responses.some((r) => r.philosopher_id === pid)) continue;
      const rows = db.prepare("SELECT philosopher_id, posts, recommendation FROM agora_responses WHERE thread_id = ? ORDER BY sort_order")
        .all(threadId) as { philosopher_id: string; posts: string; recommendation: string | null }[];
      const alreadyRecommended = rows.flatMap((r) => {
        const rec = parseAgoraRecommendation(r.recommendation);
        return rec ? [`"${rec.title}"${rec.author ? ` by ${rec.author}` : ""} (${rec.medium})`] : [];
      });
      const responses = rows.map((r) => {
        const p = context.participants.find((p) => p.id === r.philosopher_id)!;
        return { posts: r.posts, philosopher_name: p.name, philosopher_tradition: p.tradition };
      });
      const recommendations = context.recommendationsEnabled ? rows.flatMap((r) => r.recommendation
        ? [{ recommendation: r.recommendation, philosopher_name: context.participants.find((p) => p.id === r.philosopher_id)!.name }] : []) : [];
      const source = synthesisStep
        ? parent ? buildAgoraFollowUpSynthesisSourceMaterial({ ...common, ...parent, responses, recommendations })
          : buildAgoraSynthesisSourceMaterial({ ...common, responses, recommendations })
        : parent ? buildAgoraFollowUpResponseSourceMaterial({ ...common, ...parent, alreadyRecommended, earlierResponses: responses })
          : buildAgoraResponseSourceMaterial({ ...common, alreadyRecommended, earlierResponses: responses });
      const template = synthesisStep ? getSynthesisTemplateForType(context.questionType)
        : getAgoraResponseTemplate(context.questionType, context.recommendationsEnabled, context.recommendationHint, alreadyRecommended);
      // Consume the budget BEFORE calling the external provider. A crash cannot reset it.
      const step = fenced(() => {
        const saved = db.prepare("SELECT attempts, source_material, template FROM agora_job_steps WHERE thread_id = ? AND step_key = ?")
          .get(threadId, key) as { attempts: number; source_material: string | null; template: string | null } | undefined;
        if (!saved) throw new Error("Missing job step");
        if (saved.attempts >= AGORA_MAX_ATTEMPTS) return null;
        db.prepare(`UPDATE agora_job_steps SET attempts = attempts + 1, source_material = COALESCE(source_material, ?), template = COALESCE(template, ?) WHERE thread_id = ? AND step_key = ?`)
          .run(source, template, threadId, key);
        return { attempts: saved.attempts + 1, source: saved.source_material ?? source, template: saved.template ?? template };
      });
      if (step === undefined) return;
      if (!step) { finish("exhausted"); return; }
      let succeeded = false;
      try {
        const outcome = await withAgoraModelCall(() => synthesisStep
          ? generateSynthesis("agora_synthesis", step.source, step.template)
          : generateContent(pid!, "agora_response", step.source, undefined, step.template));
        if (!ownsLease()) return;
        const result = outcome.success ? outcome.data as { posts?: unknown; recommendation?: unknown } : null;
        const posts = result && Array.isArray(result.posts) ? result.posts.filter((p): p is string => typeof p === "string") : [];
        const synthesisSections = synthesisStep && outcome.success ? parseAgoraSynthesis({ synthesisType: context.questionType, sections: JSON.stringify(outcome.data) }).sections : {};
        const hasSynthesis = Object.values(synthesisSections).some((value) => Array.isArray(value)
          ? value.some((text) => typeof text === "string" && text.trim()) : typeof value === "string" && value.trim());
        succeeded = outcome.success && (synthesisStep ? hasSynthesis : (posts.length > 0 && posts.some((p) => p.trim())));
        fenced(() => {
          // Redact all job generation logs, including errors returned by a provider.
          db.prepare(`INSERT INTO generation_log (philosopher_id, content_type, system_prompt_id, user_input, raw_output, status) VALUES (?, ?, ?, ?, ?, ?)`)
            .run(pid, synthesisStep ? "synthesis" : "agora_response", outcome.systemPromptId,
              "[Agora job content omitted]", "[Agora job content omitted]", succeeded ? "generated" : "rejected");
          if (!succeeded) return;
          if (synthesisStep) {
            db.prepare("INSERT INTO agora_synthesis_v2 (thread_id, synthesis_type, sections) VALUES (?, ?, ?) ON CONFLICT(thread_id) DO NOTHING")
              .run(threadId, context.questionType, JSON.stringify(result));
          } else {
            db.prepare(`INSERT INTO agora_responses (id, thread_id, philosopher_id, posts, sort_order, recommendation)
              SELECT ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM agora_responses WHERE thread_id = ? AND philosopher_id = ?)`)
              .run(crypto.randomUUID(), threadId, pid, JSON.stringify(posts), ids.indexOf(pid!), result?.recommendation ? JSON.stringify(result.recommendation) : null, threadId, pid);
          }
        });
      } catch { /* Never log provider exceptions or private source material. */ }
      if (!succeeded) {
        finish(step.attempts >= AGORA_MAX_ATTEMPTS ? "exhausted" : "retry_wait", AGORA_RETRY_DELAYS[step.attempts - 1] ?? 0);
        return;
      }
    }
    finish(agoraWork(db, threadId).complete ? "complete" : "blocked");
  } catch {
    finish("blocked");
  } finally {
    clearInterval(heartbeat);
  }
}
