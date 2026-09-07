import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { createHmac, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import Database from "better-sqlite3";
import { philosophers } from "../db/philosophers";
import {
  responsePosts,
  followUpPosts,
  otherResponse,
  otherFollowUp,
  synthesis,
  followUpSynthesis,
  recommendations,
} from "./fixtures/agora-review-content";

async function main() {
  const root = path.resolve(".local-review");
  fs.mkdirSync(root, { recursive: true });
  const runDir = fs.mkdtempSync(path.join(root, "run-"));
  const databasePath = path.join(runDir, "philagora.db");
  const appPort = Number(process.env.AGORA_REVIEW_PORT || 3100);
  const stubPort = appPort + 1;
  const baseURL = `http://127.0.0.1:${appPort}`;
  const secret = "local-review-only-session-secret-0123456789";
  Object.assign(process.env, {
    DATABASE_PATH: databasePath,
    AGORA_REVIEW_MODE: "fixtures",
    AGORA_REVIEW_PORT: String(appPort),
    BETTER_AUTH_URL: baseURL,
    BETTER_AUTH_SECRET: secret,
    ADMIN_PASSWORD: "local-review-admin",
    ANTHROPIC_API_KEY: "local-fixture-only",
    ANTHROPIC_BASE_URL: `http://127.0.0.1:${stubPort}`,
    GOOGLE_CLIENT_ID: "local-review",
    GOOGLE_CLIENT_SECRET: "local-review",
    RUN_SEED: "false",
    NEXT_PUBLIC_GA_MEASUREMENT_ID: "",
  });
  const db = new Database(databasePath);
  db.exec(fs.readFileSync("db/schema.sql", "utf8"));
  for (const p of Object.values(philosophers)) {
    db.prepare(
      "INSERT INTO philosophers (id,name,tradition,color,initials,bio,era,key_works,core_principles) VALUES (?,?,?,?,?,?,?,?,?)",
    ).run(
      p.id,
      p.name,
      p.tradition,
      p.color,
      p.initials,
      p.bio,
      p.era,
      JSON.stringify(p.keyWorks),
      JSON.stringify(p.corePrinciples),
    );
    db.prepare(
      "INSERT INTO system_prompts (philosopher_id,system_prompt_text,is_active) VALUES (?,?,1)",
    ).run(p.id, `Local fixture persona: ${p.name}.`);
  }
  const { ensureBetterAuthTables } = await import("../src/lib/better-auth");
  await ensureBetterAuthTables();
  const cookies: Record<string, string> = {};
  for (const id of ["owner", "other"]) {
    const token = `review-${id}-${randomUUID()}`;
    const now = Date.now();
    db.prepare(
      'INSERT INTO "user" (id,name,email,emailVerified,createdAt,updatedAt) VALUES (?,?,?,1,?,?)',
    ).run(id, `Review ${id}`, `${id}@review.invalid`, now, now);
    db.prepare(
      'INSERT INTO "session" (id,token,userId,expiresAt,createdAt,updatedAt) VALUES (?,?,?,?,?,?)',
    ).run(randomUUID(), token, id, now + 86400000, now, now);
    cookies[id] = encodeURIComponent(
      `${token}.${createHmac("sha256", secret).update(token).digest("base64")}`,
    );
  }
  const group = ["marcus-aurelius", "camus", "nietzsche"];
  const responseTexts = Object.fromEntries(
    Object.entries(responsePosts).map(([id, posts]) => [id, posts[0]]),
  );
  function addThread(
    id: string,
    question: string,
    visibility: string,
    status: string,
    hidden = 0,
    count = 3,
  ) {
    db.prepare(
      "INSERT INTO agora_threads (id,question,asked_by,status,visibility,user_id,hidden_from_feed,created_at) VALUES (?,?,?,?,?,?,?,?)",
    ).run(
      id,
      question,
      "Anonymous",
      status,
      visibility,
      visibility === "private" ? "owner" : null,
      hidden,
      "2026-01-01T10:00:00Z",
    );
    for (const [i, pid] of group.entries()) {
      db.prepare(
        "INSERT INTO agora_thread_philosophers (thread_id,philosopher_id) VALUES (?,?)",
      ).run(id, pid);
      if (i < count)
        db.prepare(
          "INSERT INTO agora_responses (id,thread_id,philosopher_id,posts,sort_order,recommendation) VALUES (?,?,?,?,?,?)",
        ).run(
          randomUUID(),
          id,
          pid,
          JSON.stringify(responsePosts[pid]),
          i,
          JSON.stringify(recommendations[pid]),
        );
    }
    if (status === "complete" && count === 3)
      db.prepare(
        "INSERT INTO agora_synthesis_v2 (thread_id,synthesis_type,sections) VALUES (?,'advice',?)",
      ).run(id, JSON.stringify(synthesis));
  }
  addThread("review-public", "Why am I never satisfied?", "public", "complete");
  addThread(
    "review-question-2",
    "How much of my attention does the world deserve?",
    "public",
    "complete",
  );
  addThread(
    "review-question-3",
    "Can a small life still be a good life?",
    "public",
    "complete",
  );
  addThread(
    "review-question-4",
    "When does loyalty become a burden?",
    "public",
    "complete",
  );
  addThread(
    "review-private",
    "PRIVATE_REVIEW_QUESTION: How do I face an uncertain future?",
    "private",
    "complete",
  );
  addThread("review-hidden", "HIDDEN_REVIEW_QUESTION", "public", "complete", 1);
  addThread(
    "review-slow",
    "How can I live with uncertainty?",
    "public",
    "in_progress",
    1,
    0,
  );
  addThread(
    "review-failed",
    "What do I do when things fall apart?",
    "private",
    "failed",
    0,
    1,
  );
  for (let i = 0; i < 26; i++)
    db.prepare(
      "INSERT INTO posts (id,philosopher_id,content,thesis,stance,source_type,tag,status,created_at) VALUES (?,?,?,?,?,?,?,'published',?)",
    ).run(
      `review-post-${i}`,
      group[i % 3],
      Object.values(responseTexts)[i % 3],
      i % 2
        ? "The quiet work of choosing a life"
        : "What we owe to one another",
      "questions",
      i % 2 ? "reflection" : "news",
      "Living well",
      new Date(Date.UTC(2026, 0, 2, 12, 0, i)).toISOString(),
    );
  db.prepare(
    "INSERT INTO debates (id,title,status,debate_date) VALUES (?,?,'complete',?)",
  ).run(
    "review-debate",
    "Does a good life need a public purpose?",
    "2026-01-01",
  );
  for (const [i, pid] of group.slice(0, 2).entries()) {
    db.prepare(
      "INSERT INTO debate_philosophers (debate_id,philosopher_id) VALUES (?,?)",
    ).run("review-debate", pid);
    db.prepare(
      "INSERT INTO debate_posts (id,debate_id,philosopher_id,content,phase,sort_order) VALUES (?,?,?,?,'opening',?)",
    ).run(randomUUID(), "review-debate", pid, responseTexts[pid], i);
  }
  let mode = "normal";
  let calls = 0;
  const counters = {
    classification: 0,
    suggestion: 0,
    response: 0,
    synthesis: 0,
  };
  const server = http.createServer(async (request, response) => {
    let raw = "";
    for await (const chunk of request) raw += chunk;
    const reviewLogin = request.url?.match(/^\/login\/(owner|other|guest)$/);
    if (reviewLogin) {
      response.writeHead(303, {
        "Set-Cookie":
          "better-auth.session_token=" +
          (cookies[reviewLogin[1]] || "") +
          "; HttpOnly; Path=/; SameSite=Lax" +
          (reviewLogin[1] === "guest" ? "; Max-Age=0" : ""),
        Location: baseURL,
      });
      response.end();
      return;
    }
    if (request.url === "/mode" && request.method === "POST") {
      mode = JSON.parse(raw).mode;
      response.end("ok");
      return;
    }
    if (request.url === "/health") {
      response.end(JSON.stringify({ calls, ...counters }));
      return;
    }
    if (request.url !== "/v1/messages") {
      response.writeHead(404);
      response.end();
      return;
    }
    calls++;
    const body = JSON.parse(raw);
    const system =
      typeof body.system === "string"
        ? body.system
        : JSON.stringify(body.system);
    const isClassification = system.includes("You classify questions");
    const isSuggestion =
      system.includes("philosopher IDs") || system.includes("suggestions");
    const name = system.match(/Name: (.+)/)?.[1];
    const pid = Object.values(philosophers).find((p) => p.name === name)?.id;
    const input = JSON.stringify(body.messages);
    const isFollowUp = input.includes("=== FOLLOW-UP");
    const aboutPublicLife =
      /world|public|politic|government|societ|justice|attention|city/i.test(
        input,
      );
    const selectedGroup = aboutPublicLife
      ? ["kant", "confucius", "russell"]
      : group;
    counters[
      isClassification
        ? "classification"
        : isSuggestion
          ? "suggestion"
          : pid
            ? "response"
            : "synthesis"
    ]++;
    const reasons: Record<string, string> = {
      "marcus-aurelius":
        "Helps you separate what you can influence from the approval you cannot control.",
      camus:
        "Questions whether your life needs a final justification before you can participate in it.",
      nietzsche:
        "Challenges whether your ambitions are your own or borrowed from other people's expectations.",
      kant: "Tests your public responsibilities against principles you could ask everyone to follow.",
      confucius:
        "Connects your public choices to the relationships and responsibilities of everyday life.",
      russell:
        "Examines the evidence behind your public commitments and the consequences of acting on them.",
    };
    const delay =
      isClassification || isSuggestion ? 100 : mode === "slow" ? 15000 : 1200;
    await new Promise((resolve) => setTimeout(resolve, delay));
    const rejected =
      !isClassification &&
      !isSuggestion &&
      (mode === "failed" || (mode === "partial" && pid !== "marcus-aurelius"));
    const data = isClassification
      ? {
          questionType: "advice",
          recommendationsAppropriate: true,
          recommendationHint: "Reflective essays",
        }
      : isSuggestion
        ? {
            suggestions: selectedGroup.map((id) => ({
              id,
              reason: reasons[id],
            })),
          }
        : pid
          ? {
              posts: isFollowUp
                ? followUpPosts[pid] || otherFollowUp
                : responsePosts[pid] || otherResponse,
              ...(!isFollowUp && recommendations[pid]
                ? { recommendation: recommendations[pid] }
                : {}),
            }
          : isFollowUp
            ? followUpSynthesis
            : synthesis;
    response.setHeader("Content-Type", "application/json");
    response.end(
      JSON.stringify({
        id: randomUUID(),
        type: "message",
        role: "assistant",
        model: body.model,
        content: [
          {
            type: "text",
            text: rejected ? "invalid fixture response" : JSON.stringify(data),
          },
        ],
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: { input_tokens: 100, output_tokens: 100 },
      }),
    );
  });
  await new Promise<void>((resolve) =>
    server.listen(stubPort, "127.0.0.1", resolve),
  );
  fs.writeFileSync(
    path.join(root, "active.json"),
    JSON.stringify({ databasePath, baseURL, stubPort, cookies }, null, 2),
  );
  console.log(
    `Local review: ${baseURL}\nIsolated database: ${databasePath}\nGeneration: loopback fixture only. No paid calls.`,
  );
  const child = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "dev",
      "--webpack",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(appPort),
    ],
    { stdio: "inherit", env: process.env, windowsHide: true },
  );
  const close = () => {
    child.kill();
    server.close();
    db.close();
  };
  process.on("SIGINT", close);
  process.on("SIGTERM", close);
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
