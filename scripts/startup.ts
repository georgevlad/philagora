import { exec, execSync } from "child_process";
import { getDb } from "../db/index";

async function startup() {
  const db = getDb();

  if (process.env.RUN_SEED === "true") {
    const postCount = (
      db.prepare("SELECT COUNT(*) as c FROM posts").get() as { c: number }
    ).c;

    if (postCount === 0) {
      console.log("[Startup] No posts found and RUN_SEED=true - running seed-demo...");
      execSync("npx tsx scripts/seed-demo.ts", {
        stdio: "inherit",
        env: { ...process.env },
      });
      console.log("[Startup] seed-demo complete.");
    } else {
      console.log(`[Startup] ${postCount} posts already exist, skipping seed.`);
    }
  }

  console.log("[Startup] Starting Next.js...");
  const server = exec("npm start", { env: process.env });
  server.stdout?.pipe(process.stdout);
  server.stderr?.pipe(process.stderr);
  server.on("exit", (code) => process.exit(code ?? 0));
}

startup().catch((err) => {
  console.error("[Startup] Fatal:", err);
  process.exit(1);
});
