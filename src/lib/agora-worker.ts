import { getDb } from "@/lib/db";
import { runAgoraGeneration } from "@/lib/agora-generation";

// One job at a time per process. SQLite leases coordinate multiple server processes.
export async function drainAgoraJobs() {
  const db = getDb();
  const now = Date.now();
  const jobs = db.prepare(`SELECT thread_id FROM agora_jobs
    WHERE (state IN ('queued', 'retry_wait') AND next_attempt_at <= ?)
       OR (state = 'running' AND lease_until <= ?)
    ORDER BY next_attempt_at, created_at LIMIT 20`).all(now, now) as { thread_id: string }[];
  for (const job of jobs) await runAgoraGeneration(job.thread_id);
}
const workerGlobal = globalThis as typeof globalThis & { agoraWorkerStarted?: boolean };
export function startAgoraWorker() {
  if (workerGlobal.agoraWorkerStarted) return;
  workerGlobal.agoraWorkerStarted = true;
  const tick = async () => {
    try { await drainAgoraJobs(); }
    catch { console.error("[Agora worker] Could not check durable jobs; will retry."); }
    const timer = setTimeout(() => void tick(), 5000);
    timer.unref();
  };
  void tick();
}
