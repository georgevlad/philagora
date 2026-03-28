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
  getAgoraThreadById,
  getBookmarkedPosts,
  getFilteredPublishedPosts,
  getInterleavedFeed,
  getLikedPosts,
  getPhilosopherById,
  getPhilosophersMap,
  getPostById,
  getPostsByPhilosopher,
  getRecentAgoraThreads,
  getUserAgoraThreads,
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
    recommendation_title: "The Book of Disquiet",
    recommendation_author: "Fernando Pessoa",
    recommendation_medium: "book",
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

function seedLike(userId: string, postId: string, createdAt: string) {
  testDb
    .prepare(
      "INSERT INTO user_likes (user_id, post_id, created_at) VALUES (?, ?, ?)"
    )
    .run(userId, postId, createdAt);
}

function seedAgoraThread(args: {
  id: string;
  question: string;
  askedBy?: string;
  status?: string;
  questionType?: "advice" | "conceptual" | "debate";
  recommendationsEnabled?: number;
  followUpTo?: string | null;
  articleUrl?: string | null;
  articleTitle?: string | null;
  articleSource?: string | null;
  articleExcerpt?: string | null;
  createdAt?: string;
  philosopherIds: string[];
}) {
  testDb
    .prepare(
      `INSERT INTO agora_threads (
        id, question, asked_by, status, question_type, recommendations_enabled,
        follow_up_to, article_url, article_title, article_source, article_excerpt, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      args.id,
      args.question,
      args.askedBy ?? "Anonymous User",
      args.status ?? "complete",
      args.questionType ?? "advice",
      args.recommendationsEnabled ?? 0,
      args.followUpTo ?? null,
      args.articleUrl ?? null,
      args.articleTitle ?? null,
      args.articleSource ?? null,
      args.articleExcerpt ?? null,
      args.createdAt ?? "2025-03-01 16:00:00"
    );

  const insertPhilosopher = testDb.prepare(
    "INSERT INTO agora_thread_philosophers (thread_id, philosopher_id) VALUES (?, ?)"
  );

  for (const philosopherId of args.philosopherIds) {
    insertPhilosopher.run(args.id, philosopherId);
  }
}

function seedAgoraResponse(args: {
  id: string;
  threadId: string;
  philosopherId: string;
  posts: string[];
  sortOrder?: number;
  recommendation?: string | null;
}) {
  testDb
    .prepare(
      `INSERT INTO agora_responses (
        id, thread_id, philosopher_id, posts, sort_order, recommendation
      ) VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      args.id,
      args.threadId,
      args.philosopherId,
      JSON.stringify(args.posts),
      args.sortOrder ?? 0,
      args.recommendation ?? null
    );
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

  it("maps recommendation author when present", () => {
    const post = getPostById("post-3");

    expect(post!.recommendationTitle).toBe("The Book of Disquiet");
    expect(post!.recommendationAuthor).toBe("Fernando Pessoa");
    expect(post!.recommendationMedium).toBe("book");
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

  it("resolves like state for the requesting user", () => {
    seedLike("user-1", "post-2", "2025-03-02 09:00:00");
    seedLike("user-2", "post-1", "2025-03-02 10:00:00");

    const likedPost = getPostById("post-2", "user-1");
    const otherUsersPost = getPostById("post-1", "user-1");

    expect(likedPost?.isLiked).toBe(true);
    expect(otherUsersPost?.isLiked).toBeUndefined();
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

describe("getLikedPosts", () => {
  it("returns published liked posts ordered by like time", () => {
    seedLike("user-1", "post-2", "2025-03-02 09:00:00");
    seedLike("user-1", "post-3", "2025-03-02 11:00:00");
    seedLike("user-1", "post-draft", "2025-03-02 12:00:00");
    seedLike("user-2", "post-1", "2025-03-02 13:00:00");

    const posts = getLikedPosts("user-1");

    expect(posts.map((post) => post.id)).toEqual(["post-3", "post-2"]);
    expect(posts.every((post) => post.isLiked)).toBe(true);
  });
});

describe("getAgoraThreadById", () => {
  it("returns v2 synthesis plus parsed response recommendations", () => {
    seedAgoraThread({
      id: "agora-v2",
      question: "What is freedom?",
      questionType: "conceptual",
      recommendationsEnabled: 1,
      articleUrl: "https://example.com/freedom",
      articleTitle: "Freedom in a Fractured Age",
      articleSource: "example.com",
      articleExcerpt: "A long-form essay about freedom under pressure.",
      philosopherIds: ["nietzsche", "camus"],
    });
    seedAgoraResponse({
      id: "agora-response-1",
      threadId: "agora-v2",
      philosopherId: "nietzsche",
      posts: ["Freedom begins where inherited morality loses its authority."],
      recommendation: JSON.stringify({
        title: "Thus Spoke Zarathustra",
        medium: "book",
        reason: "It dramatizes freedom as self-overcoming instead of mere permission.",
      }),
    });
    testDb
      .prepare(
        "INSERT INTO agora_synthesis_v2 (thread_id, synthesis_type, sections) VALUES (?, ?, ?)"
      )
      .run(
        "agora-v2",
        "conceptual",
        JSON.stringify({
          keyInsight: "Freedom appears less as choice than as self-creation under pressure.",
          frameworkComparison: ["Nietzsche treats freedom as self-authorship."],
          deeperQuestions: ["What kind of self can actually author values?"],
        })
      );

    const thread = getAgoraThreadById("agora-v2");

    expect(thread).not.toBeNull();
    expect(thread?.questionType).toBe("conceptual");
    expect(thread?.recommendationsEnabled).toBe(true);
    expect(thread?.visibility).toBe("public");
    expect(thread?.userId).toBeNull();
    expect(thread?.article).toEqual({
      url: "https://example.com/freedom",
      title: "Freedom in a Fractured Age",
      source: "example.com",
      excerpt: "A long-form essay about freedom under pressure.",
    });
    expect(thread?.responses[0].recommendation?.title).toBe("Thus Spoke Zarathustra");
    expect(thread?.synthesis).toEqual({
      type: "conceptual",
      sections: {
        keyInsight: "Freedom appears less as choice than as self-creation under pressure.",
        frameworkComparison: ["Nietzsche treats freedom as self-authorship."],
        deeperQuestions: ["What kind of self can actually author values?"],
      },
    });
  });

  it("falls back to legacy agora_synthesis rows when v2 is missing", () => {
    seedAgoraThread({
      id: "agora-legacy",
      question: "Should I forgive a friend who betrayed me?",
      philosopherIds: ["camus", "plato"],
    });
    testDb.exec(`
      CREATE TABLE IF NOT EXISTS agora_synthesis (
        thread_id TEXT PRIMARY KEY,
        tensions TEXT NOT NULL DEFAULT '[]',
        agreements TEXT NOT NULL DEFAULT '[]',
        practical_takeaways TEXT NOT NULL DEFAULT '[]'
      );
    `);
    testDb
      .prepare(
        `INSERT INTO agora_synthesis (thread_id, tensions, agreements, practical_takeaways)
         VALUES (?, ?, ?, ?)`
      )
      .run(
        "agora-legacy",
        JSON.stringify(["Camus resists easy reconciliation while Plato prioritizes moral repair."]),
        JSON.stringify(["Neither thinks resentment should rule the next step."]),
        JSON.stringify(["Look for honesty before you offer restored trust."])
      );

    const thread = getAgoraThreadById("agora-legacy");

    expect(thread).not.toBeNull();
    expect(thread?.article).toBeNull();
    expect(thread?.visibility).toBe("public");
    expect(thread?.userId).toBeNull();
    expect(thread?.synthesis).toEqual({
      type: "advice",
      sections: {
        tensions: ["Camus resists easy reconciliation while Plato prioritizes moral repair."],
        agreements: ["Neither thinks resentment should rule the next step."],
        practicalTakeaways: ["Look for honesty before you offer restored trust."],
      },
    });
  });

  it("includes follow-up data on the parent thread and parent reference on the child thread", () => {
    seedAgoraThread({
      id: "agora-parent",
      question: "What should I do with my ambition?",
      philosopherIds: ["nietzsche", "camus"],
    });
    seedAgoraThread({
      id: "agora-child",
      question: "What if that ambition isolates me from everyone else?",
      followUpTo: "agora-parent",
      createdAt: "2025-03-01 17:00:00",
      philosopherIds: ["nietzsche", "camus"],
    });
    seedAgoraResponse({
      id: "agora-child-response-1",
      threadId: "agora-child",
      philosopherId: "nietzsche",
      posts: ["Isolation can be the price of becoming who you are."],
    });
    testDb
      .prepare(
        "INSERT INTO agora_synthesis_v2 (thread_id, synthesis_type, sections) VALUES (?, ?, ?)"
      )
      .run(
        "agora-child",
        "advice",
        JSON.stringify({
          tensions: ["Nietzsche treats isolation as a possible cost of self-creation."],
          agreements: ["The cost should be faced consciously rather than passively."],
          practicalTakeaways: ["Decide what kind of solitude is chosen versus imposed."],
        })
      );

    const parent = getAgoraThreadById("agora-parent");
    const child = getAgoraThreadById("agora-child");

    expect(parent?.followUpTo).toBeNull();
    expect(parent?.followUp).toMatchObject({
      id: "agora-child",
      question: "What if that ambition isolates me from everyone else?",
      status: "complete",
      createdAt: "2025-03-01 17:00:00",
    });
    expect(parent?.followUp?.responses[0]?.philosopherId).toBe("nietzsche");
    expect(parent?.followUp?.synthesis?.type).toBe("advice");
    expect(child?.followUpTo).toBe("agora-parent");
    expect(child?.followUp).toBeNull();
  });
});

describe("getRecentAgoraThreads", () => {
  it("returns only public completed agora threads", () => {
    seedAgoraThread({
      id: "agora-private-complete",
      question: "What is courage in public life?",
      status: "complete",
      philosopherIds: ["plato", "kant"],
    });
    testDb
      .prepare("UPDATE agora_threads SET visibility = 'private' WHERE id = ?")
      .run("agora-private-complete");

    seedAgoraThread({
      id: "agora-public-complete",
      question: "How should I endure uncertainty?",
      status: "complete",
      philosopherIds: ["camus", "nietzsche"],
    });

    seedAgoraThread({
      id: "agora-public-pending",
      question: "What do we owe future generations?",
      status: "pending",
      philosopherIds: ["kant", "plato"],
    });

    const threads = getRecentAgoraThreads(10);

    expect(threads.map((thread) => thread.id)).toEqual(["agora-public-complete"]);
  });

  it("excludes follow-up threads from recent public thread lists", () => {
    seedAgoraThread({
      id: "agora-root-thread",
      question: "How should I think about loyalty?",
      status: "complete",
      createdAt: "2025-03-01 16:00:00",
      philosopherIds: ["plato", "kant"],
    });
    seedAgoraThread({
      id: "agora-follow-up-thread",
      question: "What if loyalty conflicts with honesty?",
      status: "complete",
      followUpTo: "agora-root-thread",
      createdAt: "2025-03-01 17:00:00",
      philosopherIds: ["plato", "kant"],
    });

    const threads = getRecentAgoraThreads(10);

    expect(threads.map((thread) => thread.id)).toEqual(["agora-root-thread"]);
  });
});

describe("getUserAgoraThreads", () => {
  it("returns a user's public and private threads with philosopher previews", () => {
    seedAgoraThread({
      id: "agora-user-public",
      question: "How should I live with grief?",
      philosopherIds: ["camus", "plato"],
    });
    testDb
      .prepare("UPDATE agora_threads SET user_id = ?, visibility = 'public' WHERE id = ?")
      .run("user-1", "agora-user-public");

    seedAgoraThread({
      id: "agora-user-private",
      question: "Should I leave my current work behind?",
      philosopherIds: ["nietzsche", "kant"],
    });
    testDb
      .prepare("UPDATE agora_threads SET user_id = ?, visibility = 'private' WHERE id = ?")
      .run("user-1", "agora-user-private");

    seedAgoraThread({
      id: "agora-other-user",
      question: "How should I face public shame?",
      philosopherIds: ["plato", "camus"],
    });
    testDb
      .prepare("UPDATE agora_threads SET user_id = ?, visibility = 'private' WHERE id = ?")
      .run("user-2", "agora-other-user");

    const threads = getUserAgoraThreads("user-1");

    expect(threads.map((thread) => thread.id).sort()).toEqual([
      "agora-user-private",
      "agora-user-public",
    ]);

    const byId = Object.fromEntries(threads.map((thread) => [thread.id, thread]));

    expect(byId["agora-user-public"]?.visibility).toBe("public");
    expect(byId["agora-user-private"]?.visibility).toBe("private");
    expect(byId["agora-user-public"]?.philosophers).toHaveLength(2);
    expect(byId["agora-user-private"]?.philosophers).toHaveLength(2);
  });
});
