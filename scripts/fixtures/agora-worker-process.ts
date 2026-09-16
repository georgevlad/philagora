// Test-only worker process used to exercise actual process death and durable restart.
import path from "node:path";
import { startAgoraWorker } from "../../src/lib/agora-worker";
const root = path.resolve(".local-review") + path.sep;
if (process.env.AGORA_REVIEW_MODE !== "fixtures" || !path.resolve(process.env.DATABASE_PATH || "").startsWith(root)
  || !/^http:\/\/127\.0\.0\.1:\d+$/.test(process.env.ANTHROPIC_BASE_URL || "")) {
  throw new Error("Worker fixture requires an isolated review database and loopback provider");
}
startAgoraWorker();
setInterval(() => {}, 60_000); // Keep the dedicated worker alive without an HTTP reader.
