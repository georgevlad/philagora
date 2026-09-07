import type Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createTestDb } from "../src/lib/__tests__/test-db";
import {
  getSeedContentSummary,
  seedContent,
  type SeedContentSummary,
} from "./seed-content";

const FIXED_NOW = new Date("2026-08-15T12:00:00.000Z");

function expectZeroSummary(summary: SeedContentSummary): void {
  for (const value of Object.values(summary)) expect(value).toBe(0);
}

describe("seedContent", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
  });

  it("creates a complete, sanitized local dataset", () => {
    const expected = getSeedContentSummary();
    const result = seedContent(db, { now: FIXED_NOW });

    expect(result.mode).toBe("insert");
    expect(result.inserted).toEqual(expected);
    expect(result.available).toEqual(expected);
    expect(db.pragma("foreign_key_check")).toEqual([]);

    const unsafeThreads = db
      .prepare(`
        SELECT id FROM agora_threads
        WHERE id GLOB 'seed-agora-*'
          AND (
            asked_by <> 'Anonymous'
            OR ip_address IS NOT NULL
            OR user_id IS NOT NULL
            OR visibility <> 'public'
            OR status <> 'complete'
          )
      `)
      .all();
    expect(unsafeThreads).toEqual([]);

    const missingThumbnails = db
      .prepare(`
        SELECT COUNT(*) count FROM historical_events
        WHERE id GLOB 'seed-event-*' AND thumbnail_filename IS NOT NULL
      `)
      .get() as { count: number };
    expect(missingThumbnails.count).toBe(0);

    const newestPost = db
      .prepare(`
        SELECT MAX(created_at) created_at FROM posts
        WHERE id GLOB 'seed-post-*'
      `)
      .get() as { created_at: string };
    expect(newestPost.created_at).toBe("2026-08-15 10:00:00");

    const badCounters = db
      .prepare(`
        SELECT p.id
        FROM philosophers p
        WHERE p.posts_count <> (
          SELECT COUNT(*) FROM posts
          WHERE philosopher_id = p.id AND status = 'published'
        )
      `)
      .all();
    expect(badCounters).toEqual([]);
  });

  it("is idempotent in insert mode", () => {
    const first = seedContent(db, { now: FIXED_NOW });
    const second = seedContent(db, { now: FIXED_NOW });

    expect(first.inserted).toEqual(getSeedContentSummary());
    expectZeroSummary(second.inserted);
    expect(second.available).toEqual(first.available);
    expect(db.pragma("foreign_key_check")).toEqual([]);
  });

  it("resets only seed-owned content", () => {
    seedContent(db, { now: FIXED_NOW });
    db.prepare(`
      INSERT INTO posts (
        id, philosopher_id, content, thesis, stance, tag, source_type, status,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "local-post",
      "camus",
      "A local post that must survive a seed reset.",
      "Local work remains local.",
      "observes",
      "Local",
      "reflection",
      "published",
      "2026-08-15 11:00:00",
      "2026-08-15 11:00:00"
    );

    const result = seedContent(db, { mode: "reset", now: FIXED_NOW });

    expect(result.mode).toBe("reset");
    expect(result.inserted.publishedPosts).toBe(getSeedContentSummary().publishedPosts);
    expect(result.inserted.draftPosts).toBe(getSeedContentSummary().draftPosts);
    expect(result.inserted.debates).toBe(getSeedContentSummary().debates);
    expect(result.inserted.agoraThreads).toBe(getSeedContentSummary().agoraThreads);
    expect(
      db.prepare("SELECT COUNT(*) count FROM posts WHERE id = 'local-post'").get()
    ).toEqual({ count: 1 });
    expect(db.pragma("foreign_key_check")).toEqual([]);
  });
});
