import Database from "better-sqlite3";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTestDb,
  seedPhilosophers,
  seedPosts,
} from "@/lib/__tests__/test-db";
import { MIGRATIONS } from "../../../../db/migrations";
let db: Database.Database;
vi.mock("@/lib/db", () => ({ getDb: () => db }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/feed-cache", () => ({ bustFeedCache: vi.fn() }));
import { GET as getPosts, PATCH as editPost } from "./posts/route";
import { PATCH as bulkPosts } from "./posts/bulk/route";
import { GET as getRun } from "./daily-runs/route";
import { GET as getCandidates } from "./news-scout/candidates/route";
function request(body: unknown) {
  return new NextRequest("http://localhost/api/admin/posts", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  db = createTestDb();
  seedPhilosophers(db);
});
afterEach(() => db.close());

describe("editorial post editing", () => {
  it("saves full text without changing publication status or ownership", async () => {
    seedPosts(db, [
      {
        id: "draft",
        philosopher_id: "plato",
        content: "Original",
        status: "draft",
      },
    ]);
    const response = await editPost(
      request({
        id: "draft",
        content: "Corrected full text",
        thesis: "A clear thesis",
        philosopher_id: "camus",
      }),
    );
    expect(response.status).toBe(200);
    expect(
      db
        .prepare(
          "SELECT content, thesis, status, philosopher_id FROM posts WHERE id = ?",
        )
        .get("draft"),
    ).toEqual({
      content: "Corrected full text",
      thesis: "A clear thesis",
      status: "draft",
      philosopher_id: "plato",
    });
  });
  it("refuses a stale edit and retains the newer content", async () => {
    seedPosts(db, [
      { id: "draft", philosopher_id: "plato", content: "Original" },
    ]);
    const first = await (
      await editPost(request({ id: "draft", content: "First edit" }))
    ).json();
    expect(
      (
        await editPost(
          request({
            id: "draft",
            content: "Stale overwrite",
            expected_updated_at: "old",
          }),
        )
      ).status,
    ).toBe(409);
    expect(
      db.prepare("SELECT content FROM posts WHERE id = ?").get("draft"),
    ).toEqual({ content: "First edit" });
    expect(
      (
        await editPost(
          request({
            id: "draft",
            content: "Next edit",
            expected_updated_at: first.updated_at,
          }),
        )
      ).status,
    ).toBe(200);
  });
  it.each([
    { content: " " },
    { stance: "constructor" },
    { citation_url: "javascript:alert(1)" },
    { content: 7 },
  ])("rejects invalid fields without changing a post: %j", async (fields) => {
    seedPosts(db, [
      { id: "draft", philosopher_id: "plato", content: "Original" },
    ]);
    expect((await editPost(request({ id: "draft", ...fields }))).status).toBe(
      400,
    );
    expect(
      db.prepare("SELECT content FROM posts WHERE id = ?").get("draft"),
    ).toEqual({ content: "Original" });
  });
  it("searches literal wildcard characters and returns complete selected content", async () => {
    seedPosts(db, [
      {
        id: "one",
        philosopher_id: "plato",
        content: "Confidence is 100% earned",
      },
      { id: "two", philosopher_id: "camus", content: "Other writing" },
    ]);
    const matches = await (
      await getPosts(new NextRequest("http://localhost/api/admin/posts?q=%25"))
    ).json();
    expect(matches.map((post: { id: string }) => post.id)).toEqual(["one"]);
    const selected = await (
      await getPosts(new NextRequest("http://localhost/api/admin/posts?id=two"))
    ).json();
    expect(selected).toHaveLength(1);
    expect(selected[0].content).toBe("Other writing");
  });
  it("bulk publishes only selected approved posts, even with mixed or stale selection", async () => {
    seedPosts(db, [
      {
        id: "chosen",
        philosopher_id: "plato",
        content: "Chosen",
        status: "approved",
      },
      {
        id: "outside",
        philosopher_id: "camus",
        content: "Not chosen",
        status: "approved",
      },
      {
        id: "draft",
        philosopher_id: "plato",
        content: "Still draft",
        status: "draft",
      },
    ]);
    const result = await bulkPosts(
      request({
        ids: ["chosen", "chosen", "draft", "missing"],
        from_status: "approved",
        to_status: "published",
      }),
    );
    expect(await result.json()).toEqual({ updated: 1 });
    expect(
      db.prepare("SELECT id, status FROM posts ORDER BY id").all(),
    ).toEqual([
      { id: "chosen", status: "published" },
      { id: "draft", status: "draft" },
      { id: "outside", status: "approved" },
    ]);
  });
  it("never treats an empty selection as a global action", async () => {
    seedPosts(db, [
      {
        id: "one",
        philosopher_id: "plato",
        content: "Draft",
        status: "approved",
      },
    ]);
    expect(
      (
        await bulkPosts(
          request({ ids: [], from_status: "approved", to_status: "published" }),
        )
      ).status,
    ).toBe(400);
    expect(db.prepare("SELECT status FROM posts").get()).toEqual({
      status: "approved",
    });
  });
});

describe("saved daily review runs", () => {
  it("restores current content/status and marks missing posts without recreating them", async () => {
    seedPosts(db, [
      {
        id: "saved",
        philosopher_id: "plato",
        content: "Edited after generation",
        status: "published",
      },
    ]);
    db.prepare(
      "INSERT INTO admin_generation_runs (id, config_json, article_ids_json, items_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(
      "run",
      "{}",
      "[]",
      JSON.stringify([
        { post_id: "saved", content: "Old snapshot" },
        { post_id: "removed", content: "Deleted snapshot" },
      ]),
      "2026-09-01",
      "2026-09-01",
    );
    const result = await (
      await getRun(
        new NextRequest("http://localhost/api/admin/daily-runs?id=run"),
      )
    ).json();
    expect(result.items[0]).toMatchObject({
      content: "Edited after generation",
      status: "published",
    });
    expect(result.items[1].status).toBe("deleted");
    expect(result.stalled).toBe(true);
    expect(db.prepare("SELECT COUNT(*) AS n FROM posts").get()).toEqual({
      n: 1,
    });
  });
  it("adds run storage idempotently without changing posts", () => {
    seedPosts(db, [
      { id: "existing", philosopher_id: "plato", content: "Keep" },
    ]);
    const migration = MIGRATIONS.find((item) => item.version === 19)!;
    migration.migrate(db, {});
    migration.migrate(db, {});
    expect(db.prepare("SELECT content FROM posts").get()).toEqual({
      content: "Keep",
    });
  });
});

describe("News Scout queue filters", () => {
  it("combines title search, approval status, and no-posts usage", async () => {
    db.prepare(
      "INSERT INTO news_sources (id, name, feed_url) VALUES (?, ?, ?)",
    ).run("source", "Source", "https://example.com/feed");
    const insert = db.prepare(
      "INSERT INTO article_candidates (id, source_id, title, url, status) VALUES (?, ?, ?, ?, ?)",
    );
    insert.run(
      "fresh",
      "source",
      "Future of art",
      "https://example.com/fresh",
      "approved",
    );
    insert.run(
      "used",
      "source",
      "Future of art again",
      "https://example.com/used",
      "approved",
    );
    seedPosts(db, [
      { id: "post", philosopher_id: "plato", content: "Already covered" },
    ]);
    db.prepare("UPDATE posts SET citation_url = ? WHERE id = ?").run(
      "https://example.com/used",
      "post",
    );
    const data = await (
      await getCandidates(
        new NextRequest(
          "http://localhost/api/admin/news-scout/candidates?status=approved&usage=unused&q=art&page_size=25",
        ),
      )
    ).json();
    expect(data.total).toBe(1);
    expect(data.items[0].id).toBe("fresh");
  });
});
