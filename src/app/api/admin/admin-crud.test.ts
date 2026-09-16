import Database from "better-sqlite3";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, seedPhilosophers, seedPosts } from "@/lib/__tests__/test-db";

let db: Database.Database;
vi.mock("@/lib/db", () => ({ getDb: () => db }));
vi.mock("@/lib/auth", () => ({ requireAdmin: () => null }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/generation-service", () => ({ generateContent: vi.fn() }));
vi.mock("@/lib/feed-cache", () => ({ bustFeedCache: vi.fn() }));

import { bustFeedCache } from "@/lib/feed-cache";
import { DELETE as deletePost, POST as createPost, GET as getPosts } from "./posts/route";
import { DELETE as deleteSource, PATCH as updateSource } from "./news-scout/sources/route";
import { DELETE as deletePrompt } from "./prompts/route";
import { PATCH as updateContent, DELETE as cleanupContent } from "./content/route";
import { PATCH as updateCandidates, DELETE as cleanupCandidates } from "./news-scout/candidates/route";
import { GET as getLogs, DELETE as cleanupLogs } from "./api-logs/route";
import { GET as getUsage } from "./philosopher-usage/route";
import { PUT as updatePhilosopher } from "./philosophers/route";

function request(method: string, body: unknown, path = "/api/admin/test") {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function seedCandidate() {
  db.prepare("INSERT INTO news_sources (id, name, feed_url) VALUES (?, ?, ?)")
    .run("source", "Source", "https://example.com/feed");
  db.prepare("INSERT INTO article_candidates (id, source_id, title, url) VALUES (?, ?, ?, ?)")
    .run("candidate", "source", "Article", "https://example.com/article");
}

beforeEach(() => {
  db = createTestDb();
  seedPhilosophers(db);
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  db.close();
  vi.restoreAllMocks();
});

describe("admin post deletion", () => {
  function seedReply() {
    seedPosts(db, [
      { id: "parent", philosopher_id: "plato", content: "Parent" },
      { id: "reply", philosopher_id: "camus", content: "Reply", reply_to: "parent" },
    ]);
  }

  it("rolls back reply detachment when deleting the parent fails", async () => {
    seedReply();
    db.exec("CREATE TRIGGER prevent_post_delete BEFORE DELETE ON posts BEGIN SELECT RAISE(ABORT, 'blocked'); END");
    const response = await deletePost(request("DELETE", { id: "parent" }));
    expect(response.status).toBe(500);
    expect(db.prepare("SELECT reply_to FROM posts WHERE id = ?").get("reply")).toEqual({ reply_to: "parent" });
    expect(bustFeedCache).not.toHaveBeenCalled();
  });

  it("detaches replies and invalidates the cache after a successful delete", async () => {
    seedReply();
    const response = await deletePost(request("DELETE", { id: "parent" }));
    expect(response.status).toBe(200);
    expect(db.prepare("SELECT id FROM posts WHERE id = ?").get("parent")).toBeUndefined();
    expect(db.prepare("SELECT reply_to FROM posts WHERE id = ?").get("reply")).toEqual({ reply_to: null });
    expect(bustFeedCache).toHaveBeenCalledOnce();
  });

  it("rejects inherited object names as stances", async () => {
    const response = await createPost(request("POST", {
      philosopher_id: "plato", content: "Text", stance: "constructor",
    }));
    expect(response.status).toBe(400);
  });
});

describe("admin source deletion", () => {
  it("preserves candidates if removing their source fails", async () => {
    seedCandidate();
    db.exec("CREATE TRIGGER prevent_source_delete BEFORE DELETE ON news_sources BEGIN SELECT RAISE(ABORT, 'blocked'); END");
    const response = await deleteSource(request("DELETE", { id: "source" }));
    expect(response.status).toBe(500);
    expect(db.prepare("SELECT id FROM article_candidates WHERE id = ?").get("candidate")).toEqual({ id: "candidate" });
  });

  it("rejects ambiguous string booleans when changing source activity", async () => {
    seedCandidate();
    const response = await updateSource(request("PATCH", { id: "source", is_active: "false" }));
    expect(response.status).toBe(400);
    expect(db.prepare("SELECT is_active FROM news_sources WHERE id = ?").get("source")).toEqual({ is_active: 1 });
  });

  it("returns 404 for a missing source", async () => {
    expect((await deleteSource(request("DELETE", { id: "missing" }))).status).toBe(404);
  });
});

describe("generation history", () => {
  it("reports a conflict when a historical prompt is still referenced", async () => {
    const prompt = db.prepare("INSERT INTO system_prompts (philosopher_id, system_prompt_text) VALUES (?, ?)")
      .run("plato", "Prompt");
    db.prepare("INSERT INTO generation_log (philosopher_id, content_type, system_prompt_id) VALUES (?, ?, ?)")
      .run("plato", "post", prompt.lastInsertRowid);
    const response = await deletePrompt(request("DELETE", { id: Number(prompt.lastInsertRowid) }));
    expect(response.status).toBe(409);
    expect(db.prepare("SELECT id FROM system_prompts WHERE id = ?").get(prompt.lastInsertRowid)).toBeDefined();
  });

  it("matches generation moods using both ISO and SQLite timestamps", async () => {
    seedPosts(db, [{ id: "post", philosopher_id: "plato", content: "Text", created_at: "2026-09-01 12:00:00" }]);
    db.prepare("INSERT INTO generation_log (philosopher_id, content_type, mood_register, created_at) VALUES (?, ?, ?, ?)")
      .run("plato", "post", "Playful", "2026-09-01T12:00:30.000Z");
    const response = await getPosts(new NextRequest("http://localhost/api/admin/posts"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject([{ id: "post", mood_register: "Playful" }]);
  });

  it("returns 404 when updating a missing log entry", async () => {
    expect((await updateContent(request("PATCH", { id: 999, status: "approved" }))).status).toBe(404);
  });

  it.each([null, [], "invalid"])("returns 400 for a non-object body: %j", async (body) => {
    expect((await updateContent(request("PATCH", body))).status).toBe(400);
  });

  it("returns 400 for malformed JSON", async () => {
    const response = await updateContent(new NextRequest("http://localhost/api/admin/content", {
      method: "PATCH", body: "{",
    }));
    expect(response.status).toBe(400);
  });
});

describe("candidate updates and cleanup", () => {
  it("counts actual matching candidates and deduplicates requested IDs", async () => {
    seedCandidate();
    const response = await updateCandidates(request("PATCH", {
      ids: ["candidate", "candidate", "missing"], status: "approved",
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ updated: 1, ids: ["candidate", "missing"], status: "approved" });
  });

  it.each([0, -1, 1.5, "30"])("rejects invalid cleanup age %j without deleting records", async (days) => {
    seedCandidate();
    db.prepare("UPDATE article_candidates SET fetched_at = '2000-01-01 00:00:00'").run();
    expect((await cleanupCandidates(request("DELETE", { action: "cleanup", older_than_days: days }))).status).toBe(400);
    expect((await cleanupContent(request("DELETE", { action: "cleanup", older_than_days: days }))).status).toBe(400);
    expect(db.prepare("SELECT COUNT(*) AS count FROM article_candidates").get()).toEqual({ count: 1 });
  });
});

describe("API log pagination", () => {
  it("normalizes fractional pagination values before binding SQLite LIMIT/OFFSET", async () => {
    const response = await getLogs(new NextRequest("http://localhost/api/admin/api-logs?limit=2.5&offset=1.5"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ limit: 2, offset: 1, logs: [] });
  });

  it("uses safe defaults for non-finite pagination", async () => {
    const response = await getLogs(new NextRequest("http://localhost/api/admin/api-logs?limit=Infinity&offset=Infinity"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ limit: 50, offset: 0 });
  });

  it("rejects invalid cleanup retention", async () => {
    const response = await cleanupLogs(new NextRequest("http://localhost/api/admin/api-logs?older_than_days=Infinity", { method: "DELETE" }));
    expect(response.status).toBe(400);
  });
});

describe("philosopher maintenance", () => {
  it("handles ISO dates with timezones and invalid stored dates without failing the usage page", async () => {
    seedPosts(db, [
      { id: "iso", philosopher_id: "plato", content: "Text", created_at: "2026-09-01T10:00:00.000Z" },
      { id: "offset", philosopher_id: "camus", content: "Text", created_at: "2026-09-01T13:00:00+03:00" },
      { id: "invalid", philosopher_id: "kant", content: "Text", created_at: "invalid" },
    ]);
    const response = await getUsage();
    expect(response.status).toBe(200);
    const { usage } = await response.json();
    expect(usage.plato.last_post_at).toBe("2026-09-01T10:00:00.000Z");
    expect(usage.camus.last_post_at).toBe("2026-09-01T10:00:00.000Z");
    expect(usage.kant.last_post_at).toBeNull();
  });

  it("invalidates cached public philosopher metadata after an edit", async () => {
    const response = await updatePhilosopher(request("PUT", {
      id: "plato", name: "Plato Updated", tradition: "Platonism", color: "#4A5899",
      initials: "PL", bio: "Updated", era: "Ancient", key_works: [], core_principles: [],
    }));
    expect(response.status).toBe(200);
    expect(bustFeedCache).toHaveBeenCalledOnce();
  });
});
