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
}));
import { generateContent } from "@/lib/generation-service";
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
