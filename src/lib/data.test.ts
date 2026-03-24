import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, seedPhilosophers, seedPosts } from "./__tests__/test-db";

let testDb: Database.Database;

vi.mock("@/lib/db", () => ({
  getDb: () => testDb,
  default: () => testDb,
}));

import {
  getAllPhilosophers,
  getBookmarkedPosts,
  getFilteredPublishedPosts,
  getInterleavedFeed,
  getPhilosopherById,
  getPhilosophersMap,
  getPostById,
  getPostsByPhilosopher,
} from "@/lib/data";

const TEST_POSTS = [
  {
    id: "post-1",
    philosopher_id: "nietzsche",
    content: "God is dead and we have killed him.",
    thesis: "Nihilism is upon us",
    stance: "challenges",
    tag: "philosophy",
    source_type: "news",
    citation_title: "The Death of Morality",
    citation_source: "The Guardian",
    citation_url: "https://guardian.com/article-1",
    status: "published",
    likes: 42,
    created_at: "2025-03-01 10:00:00",
  },
  {
    id: "post-2",
    philosopher_id: "camus",
    content: "One must imagine Sisyphus happy.",
    thesis: "Embrace the absurd",
    stance: "reframes",
    tag: "existentialism",
    source_type: "news",
    citation_title: "The Death of Morality",
    citation_source: "The Guardian",
    citation_url: "https://guardian.com/article-1",
    status: "published",
    likes: 30,
    created_at: "2025-03-01 11:00:00",
  },
  {
    id: "post-3",
    philosopher_id: "plato",
    content: "The cave allegory applies here.",
    thesis: "Look beyond appearances",
    stance: "observes",
    tag: "philosophy",
    source_type: "reflection",
    status: "published",
    likes: 15,
    created_at: "2025-03-01 12:00:00",
  },
  {
    id: "post-4",
    philosopher_id: "nietzsche",
    content: "A reply to Camus.",
    thesis: "Absurdism is incomplete",
    stance: "challenges",
    tag: "existentialism",
    source_type: "news",
    reply_to: "post-2",
    status: "published",
    likes: 10,
    created_at: "2025-03-01 13:00:00",
  },
  {
    id: "post-draft",
    philosopher_id: "kant",
    content: "This is a draft post.",
    thesis: "Unpublished thought",
    stance: "questions",
    status: "draft",
    created_at: "2025-03-01 14:00:00",
  },
  {
    id: "post-archived",
    philosopher_id: "kant",
    content: "This was archived.",
    thesis: "Old thought",
    stance: "observes",
    status: "archived",
    created_at: "2025-03-01 15:00:00",
  },
];

beforeEach(() => {
  testDb = createTestDb();
  seedPhilosophers(testDb);
  seedPosts(testDb, TEST_POSTS);
});

afterEach(() => {
  testDb.close();
});

function seedBookmark(userId: string, postId: string, createdAt: string) {
  testDb
    .prepare(
      "INSERT INTO user_bookmarks (user_id, post_id, created_at) VALUES (?, ?, ?)"
    )
    .run(userId, postId, createdAt);
}

describe("getPostById", () => {
  it("returns a published post by ID", () => {
    const post = getPostById("post-1");

    expect(post).not.toBeNull();
    expect(post!.id).toBe("post-1");
    expect(post!.philosopherId).toBe("nietzsche");
    expect(post!.content).toBe("God is dead and we have killed him.");
    expect(post!.thesis).toBe("Nihilism is upon us");
    expect(post!.stance).toBe("challenges");
    expect(post!.likes).toBe(42);
    expect(typeof post!.timestamp).toBe("string");
    expect(post!.timestamp.length).toBeGreaterThan(0);
  });

  it("returns null for a draft post", () => {
    expect(getPostById("post-draft")).toBeNull();
  });

  it("returns null for an archived post", () => {
    expect(getPostById("post-archived")).toBeNull();
  });

  it("returns null for a non-existent ID", () => {
    expect(getPostById("does-not-exist")).toBeNull();
  });

  it("resolves citation data from the row", () => {
    const post = getPostById("post-1");

    expect(post!.citation).toBeDefined();
    expect(post!.citation!.title).toBe("The Death of Morality");
    expect(post!.citation!.source).toBe("The Guardian");
    expect(post!.citation!.url).toBe("https://guardian.com/article-1");
  });

  it("returns undefined citation when post has no citation fields", () => {
    const post = getPostById("post-3");

    expect(post!.citation).toBeUndefined();
  });

  it("resolves philosopher display fields", () => {
    const post = getPostById("post-1");

    expect(post!.philosopherName).toBe("Friedrich Nietzsche");
    expect(post!.philosopherColor).toBe("#8B0000");
    expect(post!.philosopherInitials).toBe("FN");
    expect(post!.philosopherTradition).toBe("Existentialism");
  });

  it("resolves reply target philosopher fields for a reply", () => {
    const reply = getPostById("post-4");

    expect(reply).not.toBeNull();
    expect(reply!.replyTo).toBe("post-2");
    expect(reply!.replyTargetPhilosopherId).toBe("camus");
    expect(reply!.replyTargetPhilosopherName).toBe("Albert Camus");
  });

  it("resolves bookmark state for the requesting user", () => {
    seedBookmark("user-1", "post-1", "2025-03-02 09:00:00");
    seedBookmark("user-2", "post-2", "2025-03-02 10:00:00");

    const bookmarkedPost = getPostById("post-1", "user-1");
    const otherUsersPost = getPostById("post-2", "user-1");

    expect(bookmarkedPost?.isBookmarked).toBe(true);
    expect(otherUsersPost?.isBookmarked).toBeUndefined();
  });
});

describe("getAllPhilosophers", () => {
  it("returns all seeded philosophers sorted by name", () => {
    const all = getAllPhilosophers();

    expect(all).toHaveLength(4);
    expect(all[0].name).toBe("Albert Camus");
    expect(all[1].name).toBe("Friedrich Nietzsche");
    expect(all[2].name).toBe("Immanuel Kant");
    expect(all[3].name).toBe("Plato");
  });

  it("maps all expected fields", () => {
    const all = getAllPhilosophers();
    const nietzsche = all.find((philosopher) => philosopher.id === "nietzsche")!;

    expect(nietzsche.tradition).toBe("Existentialism");
    expect(nietzsche.color).toBe("#8B0000");
    expect(nietzsche.initials).toBe("FN");
    expect(nietzsche.era).toBe("Modern");
    expect(nietzsche.keyWorks).toEqual([]);
    expect(nietzsche.corePrinciples).toEqual([]);
  });
});

describe("getPhilosopherById", () => {
  it("returns a philosopher by ID", () => {
    const philosopher = getPhilosopherById("camus");

    expect(philosopher).not.toBeNull();
    expect(philosopher!.name).toBe("Albert Camus");
  });

  it("returns null for non-existent ID", () => {
    expect(getPhilosopherById("aristotle")).toBeNull();
  });
});

describe("getPhilosophersMap", () => {
  it("returns a record keyed by philosopher ID", () => {
    const map = getPhilosophersMap();

    expect(Object.keys(map)).toHaveLength(4);
    expect(map.nietzsche.name).toBe("Friedrich Nietzsche");
    expect(map.plato.name).toBe("Plato");
  });
});

describe("getInterleavedFeed", () => {
  it("returns only published posts", () => {
    const result = getInterleavedFeed({});
    const ids = result.posts.map((post) => post.id);

    expect(ids).not.toContain("post-draft");
    expect(ids).not.toContain("post-archived");
  });

  it("returns all 4 published posts with default options", () => {
    const result = getInterleavedFeed({});

    expect(result.posts.length).toBe(4);
    expect(result.hasMore).toBe(false);
    expect(result.nextOffset).toBeNull();
  });

  it("respects limit and offset", () => {
    const page1 = getInterleavedFeed({ limit: 2, offset: 0 });

    expect(page1.posts).toHaveLength(2);
    expect(page1.hasMore).toBe(true);
    expect(page1.nextOffset).toBe(2);

    const page2 = getInterleavedFeed({ limit: 2, offset: 2 });

    expect(page2.posts).toHaveLength(2);
    expect(page2.hasMore).toBe(false);
  });

  it("filters by philosopher ID", () => {
    const result = getInterleavedFeed({ philosopherId: "nietzsche" });

    expect(result.posts.length).toBe(2);
    for (const post of result.posts) {
      expect(post.philosopherId).toBe("nietzsche");
    }
  });

  it("filters by content type: replies", () => {
    const result = getInterleavedFeed({ contentType: "replies" });

    expect(result.posts.length).toBe(1);
    expect(result.posts[0].id).toBe("post-4");
  });

  it("returns empty for non-existent philosopher", () => {
    const result = getInterleavedFeed({ philosopherId: "aristotle" });

    expect(result.posts).toHaveLength(0);
    expect(result.hasMore).toBe(false);
  });

  it("marks bookmarked posts for the active user", () => {
    seedBookmark("user-1", "post-3", "2025-03-02 09:00:00");
    seedBookmark("user-2", "post-4", "2025-03-02 10:00:00");

    const result = getInterleavedFeed({ userId: "user-1" });
    const bookmarkedPost = result.posts.find((post) => post.id === "post-3");
    const unbookmarkedPost = result.posts.find((post) => post.id === "post-4");

    expect(bookmarkedPost?.isBookmarked).toBe(true);
    expect(unbookmarkedPost?.isBookmarked).toBeUndefined();
  });
});

describe("getFilteredPublishedPosts", () => {
  it("returns all published posts with no filters", () => {
    const posts = getFilteredPublishedPosts();

    expect(posts).toHaveLength(4);
  });

  it("filters by philosopher", () => {
    const posts = getFilteredPublishedPosts(undefined, "camus");

    expect(posts).toHaveLength(1);
    expect(posts[0].philosopherId).toBe("camus");
  });
});

describe("getPostsByPhilosopher", () => {
  it("returns all published posts by a philosopher", () => {
    const posts = getPostsByPhilosopher("nietzsche");

    expect(posts).toHaveLength(2);
    for (const post of posts) {
      expect(post.philosopherId).toBe("nietzsche");
    }
  });

  it("returns empty array for philosopher with no published posts", () => {
    const posts = getPostsByPhilosopher("kant");

    expect(posts).toHaveLength(0);
  });
});

describe("getBookmarkedPosts", () => {
  it("returns published bookmarked posts ordered by bookmark time", () => {
    seedBookmark("user-1", "post-1", "2025-03-02 09:00:00");
    seedBookmark("user-1", "post-4", "2025-03-02 11:00:00");
    seedBookmark("user-1", "post-draft", "2025-03-02 12:00:00");
    seedBookmark("user-2", "post-2", "2025-03-02 13:00:00");

    const posts = getBookmarkedPosts("user-1");

    expect(posts.map((post) => post.id)).toEqual(["post-4", "post-1"]);
    expect(posts.every((post) => post.isBookmarked)).toBe(true);
  });
});
