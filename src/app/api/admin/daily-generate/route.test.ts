import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type Database from "better-sqlite3";
import { NextRequest } from "next/server";
import { createTestDb, seedPhilosophers, seedPosts } from "@/lib/__tests__/test-db";

let db: Database.Database;
vi.mock("@/lib/db", () => ({ getDb: () => db }));
vi.mock("@/lib/feed-cache", () => ({ bustFeedCache: vi.fn() }));
vi.mock("@/lib/generation-service", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/generation-service")>(),
  generateContent: vi.fn(),
  generateDailyDraft: vi.fn(),
}));
import { generateContent, generateDailyDraft } from "@/lib/generation-service";
import { PATCH, POST } from "./route";

const result = {
  success: true as const,
  data: { content: "Regenerated draft", thesis: "New thesis", stance: "observes", tag: "Test" },
  rawOutput: "{}",
  systemPromptId: null,
};
const request = (body: unknown) => new NextRequest("http://localhost/api/admin/daily-generate", {
  method: "PATCH", body: JSON.stringify(body), headers: { "Content-Type": "application/json" },
});
const log = () => Number(db.prepare("INSERT INTO generation_log (philosopher_id, content_type, user_input, raw_output, status) VALUES ('camus', 'post', 'test', '{}', 'generated')").run().lastInsertRowid);
let originalLog: number;
const payload = () => ({ post_id: "original", generation_log_id: originalLog, type: "news_reaction", length: "short", article_candidate_id: "article" });

beforeEach(() => {
  db = createTestDb();
  seedPhilosophers(db);
  seedPosts(db, [{ id: "original", philosopher_id: "camus", content: "Original draft", status: "draft" }]);
  db.prepare("INSERT INTO news_sources (id, name, feed_url) VALUES ('source', 'Test source', 'https://example.test/rss')").run();
  db.prepare("INSERT INTO article_candidates (id, source_id, title, url, status) VALUES ('article', 'source', 'Article', 'https://example.test/article', 'approved')").run();
  originalLog = log();
  vi.clearAllMocks();
  vi.mocked(generateContent).mockResolvedValue(result);
});
afterEach(() => db.close());

describe("daily draft regeneration integrity", () => {
  it("preserves published replies even when the client lists them as dependent drafts", async () => {
    seedPosts(db, [
      { id: "published-reply", philosopher_id: "plato", content: "Published reply", reply_to: "original", status: "published" },
      { id: "draft-reply", philosopher_id: "nietzsche", content: "Draft reply", reply_to: "original", status: "draft" },
      { id: "discovered-draft", philosopher_id: "kant", content: "Another draft", reply_to: "original", status: "draft" },
    ]);
    const publishedLog = log();
    const draftLog = log();
    const response = await PATCH(request({ ...payload(), dependent_replies: [
      { post_id: "published-reply", generation_log_id: publishedLog },
      { post_id: "draft-reply", generation_log_id: draftLog },
    ] }));
    expect(response.status).toBe(200);
    expect(db.prepare("SELECT content FROM posts WHERE id = 'published-reply'").get()).toEqual({ content: "Published reply" });
    expect(db.prepare("SELECT id FROM posts WHERE id IN ('draft-reply', 'discovered-draft')").all()).toEqual([]);
    expect(db.prepare("SELECT status FROM generation_log WHERE id = ?").get(publishedLog)).toEqual({ status: "generated" });
    expect(db.prepare("SELECT status FROM generation_log WHERE id = ?").get(draftLog)).toEqual({ status: "rejected" });
    expect((await response.json()).deleted_reply_post_ids.sort()).toEqual(["discovered-draft", "draft-reply"]);
  });

  it.each(["published", "deleted"])("rejects a draft that becomes %s while generation is running without changing its logs", async (state) => {
    vi.mocked(generateContent).mockImplementationOnce(async () => {
      if (state === "published") db.prepare("UPDATE posts SET status = 'published' WHERE id = 'original'").run();
      else db.prepare("DELETE FROM posts WHERE id = 'original'").run();
      return result;
    });
    const response = await PATCH(request(payload()));
    expect(response.status).toBe(409);
    expect(db.prepare("SELECT status FROM generation_log WHERE id = ?").get(originalLog)).toEqual({ status: "generated" });
    expect(db.prepare("SELECT COUNT(*) AS count FROM generation_log").get()).toEqual({ count: 1 });
    if (state === "published") expect(db.prepare("SELECT content FROM posts WHERE id = 'original'").get()).toEqual({ content: "Original draft" });
  });

  it.each([null, [], "text", { dependent_replies: "invalid" }, { generation_log_id: -1 }].map((body) => ({ body })))("rejects malformed regeneration input before model calls", async ({ body }) => {
    const response = await PATCH(request(body && typeof body === "object" && !Array.isArray(body) ? { ...payload(), ...body } : body));
    expect(response.status).toBe(400);
    expect(generateContent).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid JSON when starting a batch", async () => {
    const response = await POST(new NextRequest("http://localhost/api/admin/daily-generate", { method: "POST", body: "{" }));
    expect(response.status).toBe(400);
    expect(generateContent).not.toHaveBeenCalled();
  });
});


describe("saved daily generation runs", () => {
  const batch = (runId: string) => new NextRequest("http://localhost/api/admin/daily-generate", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ run_id: runId, article_ids: ["article"], config: { reactions_per_article: 2, cross_replies: 0, timeless_reflections: 0, quips: 0, cultural_recommendations: 0, excluded_philosophers: [], length_strategy: "short" } }),
  });
  const item = () => ({ type: "news_reaction" as const, post_id: "original", generation_log_id: originalLog, philosopher_id: "camus", philosopher_name: "Camus", content: "Draft", thesis: "Thesis", stance: "observes" as const, tag: "Test", length: "short" as const, article_candidate_id: "article" });
  it("checkpoints completed items before the next model call and rejects a duplicate run", async () => {
    vi.mocked(generateDailyDraft).mockResolvedValueOnce({ success: true, data: item() }).mockImplementationOnce(async () => {
      const run = db.prepare("SELECT status, items_json FROM admin_generation_runs WHERE id = 'saved-run'").get() as { status: string; items_json: string };
      expect(run.status).toBe("running");
      expect(JSON.parse(run.items_json)[0].post_id).toBe("original");
      return { success: false, error: "Model unavailable" };
    });
    expect((await POST(batch("saved-run"))).status).toBe(200);
    const saved = db.prepare("SELECT status, items_json, summary_json FROM admin_generation_runs WHERE id = 'saved-run'").get() as { status: string; items_json: string; summary_json: string };
    expect(saved.status).toBe("partial");
    expect(JSON.parse(saved.items_json)).toHaveLength(1);
    expect(JSON.parse(saved.summary_json).errors).toHaveLength(1);
    expect((await POST(batch("saved-run"))).status).toBe(409);
    expect(generateDailyDraft).toHaveBeenCalledTimes(2);
  });
  it("retains completed drafts if a later generation throws", async () => {
    vi.mocked(generateDailyDraft).mockResolvedValueOnce({ success: true, data: item() }).mockRejectedValueOnce(new Error("Interrupted"));
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await POST(batch("interrupted-run"))).status).toBe(500);
    quiet.mockRestore();
    const saved = db.prepare("SELECT status, items_json FROM admin_generation_runs WHERE id = 'interrupted-run'").get() as { status: string; items_json: string };
    expect(saved.status).toBe("failed");
    expect(JSON.parse(saved.items_json)[0].post_id).toBe("original");
    expect(db.prepare("SELECT content FROM posts WHERE id = 'original'").get()).toEqual({ content: "Original draft" });
  });
  it("persists regenerated log metadata so reopening the run uses the current log", async () => {
    db.prepare("INSERT INTO admin_generation_runs (id, status, config_json, article_ids_json, items_json, created_at, updated_at) VALUES ('review', 'complete', '{}', '[]', ?, ?, ?)").run(JSON.stringify([item()]), new Date().toISOString(), new Date().toISOString());
    const response = await PATCH(request(payload()));
    expect(response.status).toBe(200);
    const regenerated = (await response.json()).item;
    const saved = db.prepare("SELECT items_json FROM admin_generation_runs WHERE id = 'review'").get() as { items_json: string };
    expect(JSON.parse(saved.items_json)[0].generation_log_id).toBe(regenerated.generation_log_id);
    expect(regenerated.generation_log_id).not.toBe(originalLog);
  });
});
