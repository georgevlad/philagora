import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import net from "node:net";
import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import Database from "better-sqlite3";

async function assertPortAvailable(port: number) {
  await new Promise<void>((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(port, "127.0.0.1", () => probe.close(() => resolve()));
  });
}

function fingerprint(file: string) {
  return fs.existsSync(file)
    ? createHash("sha256").update(fs.readFileSync(file)).digest("hex")
    : null;
}

async function main() {
  const sourcePath = path.resolve(process.argv[2] || "data/philagora-2026-09-07.db");
  const appPort = Number(process.env.AGORA_REVIEW_PORT || 3400);
  if (!Number.isInteger(appPort) || appPort < 1024 || appPort > 65534) {
    throw new Error("AGORA_REVIEW_PORT must be an integer between 1024 and 65534.");
  }
  const helperPort = appPort + 1;
  await assertPortAvailable(appPort);
  await assertPortAvailable(helperPort);
  const root = path.resolve(".local-review");
  fs.mkdirSync(root, { recursive: true });
  const runDir = fs.mkdtempSync(path.join(root, "snapshot-"));
  const databasePath = path.join(runDir, "philagora.db");
  const originalHashes = {
    source: fingerprint(sourcePath),
    normal: fingerprint(path.resolve("db/philagora.db")),
  };
  const source = new Database(sourcePath, { readonly: true, fileMustExist: true });
  try {
    source.pragma("query_only = ON");
    if (source.pragma("quick_check", { simple: true }) !== "ok") {
      throw new Error("Snapshot integrity check failed; no preview was started.");
    }
    // SQLite's backup API includes committed WAL data without modifying the source.
    await source.backup(databasePath);
  } finally {
    source.close();
  }

  const baseURL = `http://127.0.0.1:${appPort}`;
  const secret = randomBytes(32).toString("hex");
  Object.assign(process.env, {
    DATABASE_PATH: databasePath,
    AGORA_REVIEW_MODE: "snapshot",
    AGORA_REVIEW_PORT: String(appPort),
    AGORA_WORKER_DISABLED: "true",
    BETTER_AUTH_URL: baseURL,
    BETTER_AUTH_SECRET: secret,
    ADMIN_PASSWORD: randomBytes(32).toString("hex"),
    ANTHROPIC_API_KEY: "placeholder_key_here",
    ANTHROPIC_BASE_URL: `http://127.0.0.1:${helperPort}`,
    GOOGLE_CLIENT_ID: "local-snapshot-review",
    GOOGLE_CLIENT_SECRET: "local-snapshot-review",
    RUN_SEED: "false",
    NEXT_PUBLIC_GA_MEASUREMENT_ID: "",
  });
  // Import only after DATABASE_PATH points at the existing working copy.
  const { getDb } = await import("../db/index");
  const db = getDb();
  const { ensureBetterAuthTables } = await import("../src/lib/better-auth");
  await ensureBetterAuthTables();
  const userId = `snapshot-test-${randomUUID()}`;
  db.transaction(() => {
    // Production sessions never authenticate this isolated preview.
    db.prepare('DELETE FROM "session"').run();
    db.prepare('DELETE FROM "verification"').run();
    const now = Date.now();
    db.prepare(
      'INSERT INTO "user" (id,name,email,emailVerified,createdAt,updatedAt) VALUES (?,?,?,1,?,?)',
    ).run(userId, "Local test account", `${userId}@review.invalid`, now, now);
  })();

  const server = http.createServer((request, response) => {
    const route = new URL(request.url || "/", baseURL).pathname;
    response.setHeader("Cache-Control", "no-store");
    if (request.method === "GET" && (route === "/login/owner" || route === "/login/guest")) {
      let cookie = "better-auth.session_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
      if (route === "/login/owner") {
        const token = randomUUID();
        const now = Date.now();
        db.prepare('DELETE FROM "session" WHERE userId = ?').run(userId);
        db.prepare(
          'INSERT INTO "session" (id,token,userId,expiresAt,createdAt,updatedAt) VALUES (?,?,?,?,?,?)',
        ).run(randomUUID(), token, userId, now + 86400000, now, now);
        const signed = encodeURIComponent(`${token}.${createHmac("sha256", secret).update(token).digest("base64")}`);
        cookie = `better-auth.session_token=${signed}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`;
      }
      response.writeHead(303, { "Set-Cookie": cookie, Location: baseURL });
      response.end();
      return;
    }
    // Also rejects any accidental SDK request: there is no upstream provider.
    response.writeHead(503, { "Content-Type": "application/json" });
    response.end(JSON.stringify({
      error: "Generation is disabled in this local snapshot preview. You can browse saved content; use the fixture preview to test new questions, follow-ups, and recovery.",
    }));
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(helperPort, "127.0.0.1", resolve);
  });
  fs.writeFileSync(path.join(root, "snapshot-active.json"), JSON.stringify({
    sourcePath, databasePath, baseURL, helperPort, originalHashes,
  }, null, 2));
  console.log(`Snapshot review: ${baseURL}\nWorking copy: ${databasePath}\nGeneration and background recovery disabled. Source snapshot preserved.`);
  const child = spawn(process.execPath, [
    "node_modules/next/dist/bin/next", "dev", "--webpack", "--hostname", "127.0.0.1", "--port", String(appPort),
  ], { stdio: "inherit", env: process.env, windowsHide: true });
  const close = () => {
    child.kill();
    server.close();
    if (db.open) db.close();
  };
  process.on("SIGINT", close);
  process.on("SIGTERM", close);
  child.once("exit", (code) => {
    close();
    process.exit(code || 0);
  });
  child.once("error", (error) => {
    console.error(error.message);
    close();
    process.exit(1);
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Snapshot review failed.");
  process.exit(1);
});
