import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { createTestDb, seedPhilosophers } from "@/lib/__tests__/test-db";
import type { RequestIdentity } from "@/lib/auth";
let db: Database.Database;
let identity: RequestIdentity;
vi.mock("@/lib/db", () => ({ getDb: () => db }));
vi.mock("@/lib/auth", () => ({
  getIdentityFromHeaders: async () => identity,
  hasUnlimitedAgoraAccess: () => false,
}));
vi.mock("@/lib/agora-generation", () => ({
  runAgoraGeneration: vi.fn(async () => {}),
}));
vi.mock("@/lib/generation-service", () => ({
  classifyAgoraQuestion: vi.fn(async () => ({
    questionType: "advice",
    recommendationsAppropriate: false,
    recommendationHint: null,
  })),
}));
vi.mock("@/lib/article-extractor", () => ({
  normalizeArticleUrl: (url: string) => url || null,
  getArticleSourceFromUrl: () => null,
  extractArticle: vi.fn(async () => ({
    success: false,
    error: "Article unavailable",
  })),
}));
import { POST as submit } from "@/app/api/agora/submit/route";
import { POST as followUp } from "@/app/api/agora/[threadId]/follow-up/route";
import { GET as read } from "@/app/api/agora/[threadId]/route";
import { runAgoraGeneration } from "@/lib/agora-generation";
import { getRecentAgoraThreads, getAllPublicAgoraThreadIds } from "@/lib/data";
const request = (body: unknown) =>
  new NextRequest("http://localhost/api/agora/submit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "127.0.0.1",
    },
    body: JSON.stringify(body),
  });
const context = (threadId: string) => ({
  params: Promise.resolve({ threadId }),
});
const payload = () => ({
  question: "What should we do with uncertainty?",
  philosopher_ids: ["camus", "nietzsche", "plato", "kant"],
  visibility: "private",
  request_id: randomUUID(),
});
const owner = {
  type: "user",
  id: "owner",
  email: "owner@test.invalid",
} as const;
function complete(id: string) {
  db.prepare("UPDATE agora_threads SET status = 'complete' WHERE id = ?").run(
    id,
  );
}
beforeEach(() => {
  db = createTestDb();
  seedPhilosophers(db);
  identity = owner;
  vi.clearAllMocks();
});
afterEach(() => db.close());

describe("Agora privacy and durable submissions", () => {
  it("rejects a private guest question without publishing it", async () => {
    identity = { type: "anonymous" };
    expect((await submit(request(payload()))).status).toBe(401);
    expect(db.prepare("SELECT COUNT(*) c FROM agora_threads").get()).toEqual({
      c: 0,
    });
  });
  it("rejects malformed and duplicate participant selections", async () => {
    expect((await submit(request({ ...payload(), question: 12 }))).status).toBe(
      400,
    );
    expect(
      (
        await submit(
          request({ ...payload(), philosopher_ids: ["camus", "camus"] }),
        )
      ).status,
    ).toBe(400);
    expect(
      (await submit(request({ ...payload(), question: "tiny" }))).status,
    ).toBe(400);
    expect(
      (await submit(request({ ...payload(), philosopher_ids: ["camus"] })))
        .status,
    ).toBe(400);
  });
  it("concurrent and later retries create and generate exactly one durable thread", async () => {
    const body = payload();
    const results = await Promise.all([
      submit(request(body)),
      submit(request(body)),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 201]);
    expect(await (await submit(request(body))).json()).toMatchObject({
      threadId: body.request_id,
    });
    expect(db.prepare("SELECT COUNT(*) c FROM agora_threads").get()).toEqual({
      c: 1,
    });
    expect(runAgoraGeneration).toHaveBeenCalledTimes(1);
    expect(
      db.prepare("SELECT COUNT(*) c FROM agora_thread_philosophers").get(),
    ).toEqual({ c: 4 });
  });
  it("reconciles a public guest retry after sign-in without assigning ownership", async () => {
    const body = { ...payload(), visibility: "public" };
    identity = { type: "anonymous" };
    expect((await submit(request(body))).status).toBe(201);
    identity = owner;
    expect((await submit(request(body))).status).toBe(200);
    expect(
      db
        .prepare("SELECT user_id FROM agora_threads WHERE id = ?")
        .get(body.request_id),
    ).toEqual({ user_id: null });
    expect(runAgoraGeneration).toHaveBeenCalledTimes(1);
  });
  it("private access is limited to its owner and administrators, including null ownership", async () => {
    const body = payload();
    await submit(request(body));
    const req = new NextRequest("http://localhost/api/agora/thread");
    for (const outsider of [
      { type: "anonymous" },
      { type: "user", id: "other", email: "other@test.invalid" },
    ] as RequestIdentity[]) {
      identity = outsider;
      const response = await read(req, context(body.request_id));
      expect(response.status).toBe(404);
      expect(await response.text()).not.toContain(body.question);
    }
    identity = owner;
    expect((await read(req, context(body.request_id))).status).toBe(200);
    identity = { type: "admin" };
    expect((await read(req, context(body.request_id))).status).toBe(200);
    db.prepare("UPDATE agora_threads SET user_id = NULL WHERE id = ?").run(
      body.request_id,
    );
    identity = { type: "anonymous" };
    expect((await read(req, context(body.request_id))).status).toBe(404);
  });
  it("private and hidden threads never enter homepage queries or sitemaps", async () => {
    const body = payload();
    await submit(request(body));
    complete(body.request_id);
    const publicBody = { ...payload(), visibility: "public" };
    await submit(request(publicBody));
    complete(publicBody.request_id);
    const hiddenBody = { ...payload(), visibility: "public" };
    await submit(request(hiddenBody));
    complete(hiddenBody.request_id);
    db.prepare(
      "UPDATE agora_threads SET hidden_from_feed = 1 WHERE id = ?",
    ).run(hiddenBody.request_id);
    expect(getRecentAgoraThreads().map((t) => t.id)).toEqual([
      publicBody.request_id,
    ]);
    expect(getAllPublicAgoraThreadIds().map((t) => t.id)).toEqual([
      publicBody.request_id,
    ]);
  });
  it("retains article-only submissions and returns extraction warnings", async () => {
    const response = await submit(
      request({
        ...payload(),
        question: "",
        article_url: "https://example.com/article",
      }),
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      articleWarning: "Article unavailable",
    });
  });
  it("preserves per-user and guest limits", async () => {
    for (let i = 0; i < 5; i++)
      expect((await submit(request(payload()))).status).toBe(201);
    expect((await submit(request(payload()))).status).toBe(429);
    identity = { type: "anonymous" };
    // A separate guest IP avoids counting the preceding registered questions.
    const guest = new NextRequest("http://localhost/api/agora/submit", {
      method: "POST",
      headers: { "x-forwarded-for": "guest-ip" },
      body: JSON.stringify({ ...payload(), visibility: "public" }),
    });
    expect((await submit(guest)).status).toBe(201);
  });
});

describe("one follow-up to the whole original group", () => {
  it.each(["private", "public"])(
    "inherits %s audience, author and every original participant",
    async (visibility) => {
      const body = { ...payload(), visibility };
      await submit(request(body));
      complete(body.request_id);
      const response = await followUp(
        request({
          question: "How would that change my next decision?",
          philosopher_ids: ["camus"],
          visibility: "public",
        }),
        context(body.request_id),
      );
      expect(response.status).toBe(201);
      const { threadId } = await response.json();
      expect(
        db
          .prepare("SELECT user_id, visibility FROM agora_threads WHERE id = ?")
          .get(threadId),
      ).toEqual({ user_id: "owner", visibility });
      expect(
        db
          .prepare(
            "SELECT philosopher_id FROM agora_thread_philosophers WHERE thread_id = ? ORDER BY philosopher_id",
          )
          .all(threadId),
      ).toEqual(
        ["camus", "kant", "nietzsche", "plato"].map((philosopher_id) => ({
          philosopher_id,
        })),
      );
      expect(runAgoraGeneration).toHaveBeenCalledTimes(2);
      const repeat = await followUp(
        request({ question: "How would that change my next decision?" }),
        context(body.request_id),
      );
      expect(repeat.status).toBe(200);
      expect(await repeat.json()).toEqual({ threadId });
      expect(
        (
          await followUp(
            request({ question: "A different second follow-up question?" }),
            context(body.request_id),
          )
        ).status,
      ).toBe(409);
      expect(runAgoraGeneration).toHaveBeenCalledTimes(2);
    },
  );
  it("denies guests, non-owners and follow-ups of follow-ups", async () => {
    const body = { ...payload(), visibility: "public" };
    await submit(request(body));
    complete(body.request_id);
    identity = { type: "user", id: "other", email: "other@test.invalid" };
    expect(
      (
        await followUp(
          request({ question: "Why would this be a good choice?" }),
          context(body.request_id),
        )
      ).status,
    ).toBe(403);
    identity = { type: "anonymous" };
    expect(
      (
        await followUp(
          request({ question: "Why would this be a good choice?" }),
          context(body.request_id),
        )
      ).status,
    ).toBe(403);
    identity = owner;
    const { threadId } = await (
      await followUp(
        request({ question: "Why would this be a good choice?" }),
        context(body.request_id),
      )
    ).json();
    complete(threadId);
    expect(
      (
        await followUp(
          request({ question: "Why would this be a good choice?" }),
          context(threadId),
        )
      ).status,
    ).toBe(400);
  });
  it("does not expose a mismatched private child through a public parent", async () => {
    const body = { ...payload(), visibility: "public" };
    await submit(request(body));
    complete(body.request_id);
    const { threadId } = await (
      await followUp(
        request({ question: "SECRET mismatched child question?" }),
        context(body.request_id),
      )
    ).json();
    db.prepare(
      "UPDATE agora_threads SET visibility = 'private' WHERE id = ?",
    ).run(threadId);
    identity = { type: "anonymous" };
    const response = await read(
      new NextRequest("http://localhost"),
      context(body.request_id),
    );
    expect(await response.text()).not.toContain("SECRET");
  });
});
