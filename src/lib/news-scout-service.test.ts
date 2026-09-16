import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type Database from "better-sqlite3";
import { createTestDb } from "@/lib/__tests__/test-db";

const { mockCreateMessage, mockParseURL } = vi.hoisted(() => ({
  mockCreateMessage: vi.fn(), mockParseURL: vi.fn(),
}));
let db: Database.Database;
vi.mock("@/lib/db", () => ({ getDb: () => db }));
vi.mock("rss-parser", () => ({ default: class { parseURL = mockParseURL; } }));
vi.mock("@/lib/anthropic-utils", () => ({
  getAnthropicClient: () => ({}),
  createMessage: mockCreateMessage,
  parseJsonResponse: JSON.parse,
}));
import { fetchAllFeeds, scoreUnscored } from "./news-scout-service";

beforeEach(() => {
  db = createTestDb();
  mockCreateMessage.mockReset();
  mockCreateMessage.mockResolvedValue({ content: [{ type: "text", text: '{"score":70}' }] });
  mockParseURL.mockReset();
});
afterEach(() => { db.close(); vi.restoreAllMocks(); });

function source(id: string, active = 1) {
  db.prepare("INSERT INTO news_sources (id, name, feed_url, category, is_active) VALUES (?, ?, ?, 'general', ?)")
    .run(id, id, `https://example.com/${id}`, active);
}
function articles(sourceId: string, count: number) {
  const insert = db.prepare(`INSERT INTO article_candidates
    (id, source_id, title, url, image_url, pub_date) VALUES (?, ?, ?, ?, ?, ?)`);
  for (let i = 0; i < count; i++) {
    const id = `${sourceId}-${i}`;
    insert.run(id, sourceId, id, `https://example.com/${id}`, "https://example.com/image.png", `2026-09-${String(i + 1).padStart(2, "0")}T12:00:00Z`);
  }
}

describe("News Scout batches", () => {
  it("scores only active sources, keeps source diversity, and honors the total batch size", async () => {
    for (const id of ["a", "b", "c"]) { source(id); articles(id, 5); }
    source("inactive", 0); articles("inactive", 5);
    const result = await scoreUnscored(5);
    expect(result).toEqual({ scored: 5, errors: [] });
    expect(mockCreateMessage).toHaveBeenCalledTimes(5);
    const counts = db.prepare("SELECT source_id, COUNT(*) AS count FROM article_candidates WHERE status = 'scored' GROUP BY source_id ORDER BY source_id").all();
    expect(counts).toEqual([
      { source_id: "a", count: 2 }, { source_id: "b", count: 2 }, { source_id: "c", count: 1 },
    ]);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid batch size %s before making model calls", async (batchSize) => {
    expect((await scoreUnscored(batchSize)).errors).toEqual(["Batch size must be a positive integer"]);
    expect(mockCreateMessage).not.toHaveBeenCalled();
  });

  it("stores different source articles fetched in the same millisecond and still deduplicates URLs", async () => {
    source("a"); source("b");
    vi.spyOn(Date, "now").mockReturnValue(1_800_000_000_000);
    mockParseURL.mockImplementation(async (url: string) => ({ items: [{ link: `${url}/story`, title: url }] }));
    expect((await fetchAllFeeds()).newArticles).toBe(2);
    expect((await fetchAllFeeds()).newArticles).toBe(0);
    expect((db.prepare("SELECT COUNT(*) AS count FROM article_candidates").get() as { count: number }).count).toBe(2);
  });
});
