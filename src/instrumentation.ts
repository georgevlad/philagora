// Next invokes register at server startup (dev, next start, and Railway).
// Building/static generation must never run background model work.
export async function register() {
  if (process.env.AGORA_WORKER_DISABLED !== "true" && process.env.NEXT_RUNTIME === "nodejs" && process.env.NEXT_PHASE !== "phase-production-build") {
    const { startAgoraWorker } = await import("./lib/agora-worker");
    startAgoraWorker();
  }
}
