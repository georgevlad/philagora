import { beforeEach, describe, expect, it } from "vitest";

import { interleaveFeed } from "@/lib/feed-interleave";
import {
  makePost,
  makeQuip,
  makeReaction,
  makeReflection,
  makeReply,
  resetPostCounter,
} from "@/lib/__tests__/helpers";
import type { FeedPost, Stance } from "@/lib/types";

beforeEach(() => {
  resetPostCounter();
});

describe("interleaveFeed", () => {
  describe("small inputs", () => {
    it("returns empty array for empty input", () => {
      expect(interleaveFeed([])).toEqual([]);
    });

    it("returns single post unchanged", () => {
      const posts = [makePost()];

      expect(interleaveFeed(posts)).toEqual(posts);
    });

    it("returns 3 or fewer posts unchanged (bypass threshold)", () => {
      const posts = [makePost(), makePost(), makePost()];
      const result = interleaveFeed(posts);

      expect(result).toEqual(posts);
    });

    it("activates interleaving at 4+ posts", () => {
      const posts = [
        makeReaction("nietzsche", "https://a.com", "challenges"),
        makeReaction("camus", "https://a.com", "reframes"),
        makeReaction("plato", "https://b.com", "defends"),
        makeReaction("kant", "https://c.com", "questions"),
      ];

      const result = interleaveFeed(posts);

      expect(result).toHaveLength(4);
    });
  });

  describe("post preservation", () => {
    it("never drops or duplicates posts", () => {
      const philosophers = ["nietzsche", "camus", "plato", "kant", "seneca"] as const;
      const stances: Stance[] = ["challenges", "defends", "reframes", "questions", "observes"];
      const posts = Array.from({ length: 20 }, (_, i) =>
        makeReaction(philosophers[i % philosophers.length], `https://article-${i % 4}.com`, stances[i % 5])
      );

      const result = interleaveFeed(posts);

      expect(result).toHaveLength(posts.length);

      const inputIds = new Set(posts.map((post) => post.id));
      const outputIds = new Set(result.map((post) => post.id));
      expect(outputIds).toEqual(inputIds);
    });
  });

  describe("same-article pairing", () => {
    it("pairs two reactions to the same article by different philosophers with different stances", () => {
      const posts = [
        makeReaction("nietzsche", "https://shared.com", "challenges"),
        makeReaction("plato", "https://other.com", "defends"),
        makeReaction("camus", "https://shared.com", "reframes"),
        makeReaction("kant", "https://another.com", "questions"),
      ];

      const result = interleaveFeed(posts);
      const ids = result.map((post) => post.id);
      const sharedPosts = result.filter((post) => post.citation?.url === "https://shared.com");

      expect(sharedPosts).toHaveLength(2);

      const pos0 = ids.indexOf(sharedPosts[0].id);
      const pos1 = ids.indexOf(sharedPosts[1].id);
      expect(Math.abs(pos0 - pos1)).toBe(1);
    });

    it("does not pair posts with the same stance (even if same article)", () => {
      const posts = [
        makeReaction("nietzsche", "https://shared.com", "challenges"),
        makeReaction("camus", "https://shared.com", "challenges"),
        makeReaction("plato", "https://b.com", "defends"),
        makeReaction("kant", "https://c.com", "questions"),
      ];

      const result = interleaveFeed(posts);
      const shared = result.filter((post) => post.citation?.url === "https://shared.com");

      expect(shared).toHaveLength(2);

      const ids = result.map((post) => post.id);
      const pos0 = ids.indexOf(shared[0].id);
      const pos1 = ids.indexOf(shared[1].id);
      expect(Math.abs(pos0 - pos1)).toBeGreaterThan(1);
    });

    it("does not pair posts by the same philosopher", () => {
      const posts = [
        makeReaction("nietzsche", "https://shared.com", "challenges"),
        makeReaction("nietzsche", "https://shared.com", "reframes"),
        makeReaction("plato", "https://b.com", "defends"),
        makeReaction("kant", "https://c.com", "questions"),
      ];

      const result = interleaveFeed(posts);

      expect(result).toHaveLength(4);
    });

    it("does not pair reply posts", () => {
      const parent = makeReaction("nietzsche", "https://shared.com", "challenges");
      const posts = [
        parent,
        makeReply("camus", parent.id, {
          citation: { title: "Article at https://shared.com", source: "Test", url: "https://shared.com" },
          stance: "reframes",
        }),
        makeReaction("plato", "https://b.com", "defends"),
        makeReaction("kant", "https://c.com", "questions"),
      ];

      const result = interleaveFeed(posts);

      expect(result).toHaveLength(4);
    });
  });

  describe("article clustering prevention", () => {
    it("separates posts about the same article when there are 3+", () => {
      const posts = [
        makeReaction("nietzsche", "https://hot-topic.com", "challenges"),
        makeReaction("camus", "https://hot-topic.com", "reframes"),
        makeReaction("plato", "https://hot-topic.com", "defends"),
        makeReaction("kant", "https://filler1.com", "questions"),
        makeReaction("seneca", "https://filler2.com", "observes"),
        makeReaction("marcus-aurelius", "https://filler3.com", "warns"),
      ];

      const result = interleaveFeed(posts);
      const hotTopicPositions = result
        .map((post, index) => (post.citation?.url === "https://hot-topic.com" ? index : -1))
        .filter((index) => index >= 0);

      expect(hotTopicPositions).toHaveLength(3);

      for (let i = 0; i < result.length; i += 1) {
        const windowEnd = Math.min(i + 5, result.length);
        const windowSlice = result.slice(i, windowEnd);
        const sameArticleCount = windowSlice.filter(
          (post) => post.citation?.url === "https://hot-topic.com"
        ).length;

        expect(sameArticleCount).toBeLessThanOrEqual(3);
      }
    });

    it("keeps fresh same-article reactions closer together than stale ones", () => {
      const now = new Date("2026-04-10T12:00:00Z");
      const oneHourLater = new Date("2026-04-10T13:00:00Z");
      const freshPosts = [
        makeReaction("nietzsche", "https://fresh.com", "challenges", {
          createdAt: now.toISOString(),
          timestamp: now.toISOString(),
        }),
        makeReaction("camus", "https://fresh.com", "reframes", {
          createdAt: oneHourLater.toISOString(),
          timestamp: oneHourLater.toISOString(),
        }),
        makeReaction("plato", "https://a.com", "defends", {
          createdAt: now.toISOString(),
          timestamp: now.toISOString(),
        }),
        makeReaction("kant", "https://b.com", "questions", {
          createdAt: now.toISOString(),
          timestamp: now.toISOString(),
        }),
        makeReaction("seneca", "https://c.com", "observes", {
          createdAt: now.toISOString(),
          timestamp: now.toISOString(),
        }),
        makeReaction("marcus-aurelius", "https://d.com", "warns", {
          createdAt: now.toISOString(),
          timestamp: now.toISOString(),
        }),
      ];

      const result = interleaveFeed(freshPosts);
      const freshPositions = result
        .map((post, index) => (post.citation?.url === "https://fresh.com" ? index : -1))
        .filter((index) => index >= 0);

      expect(freshPositions).toHaveLength(2);
      expect(freshPositions[1] - freshPositions[0]).toBeLessThanOrEqual(3);
    });
  });

  describe("philosopher diversity", () => {
    it("avoids placing the same philosopher in consecutive positions", () => {
      const posts = [
        makeReaction("nietzsche", "https://a.com", "challenges"),
        makeReaction("nietzsche", "https://b.com", "reframes"),
        makeReaction("nietzsche", "https://c.com", "defends"),
        makeReaction("camus", "https://d.com", "questions"),
        makeReaction("plato", "https://e.com", "observes"),
        makeReaction("kant", "https://f.com", "warns"),
      ];

      const result = interleaveFeed(posts);

      for (let i = 0; i < result.length - 2; i += 1) {
        const threeInARow =
          result[i].philosopherId === result[i + 1].philosopherId &&
          result[i + 1].philosopherId === result[i + 2].philosopherId;

        expect(threeInARow).toBe(false);
      }
    });
  });

  describe("stance diversity", () => {
    it("avoids placing consecutive posts with the same stance", () => {
      const posts = [
        makeReaction("nietzsche", "https://a.com", "challenges"),
        makeReaction("camus", "https://b.com", "challenges"),
        makeReaction("plato", "https://c.com", "challenges"),
        makeReaction("kant", "https://d.com", "challenges"),
        makeReaction("seneca", "https://e.com", "defends"),
        makeReaction("marcus-aurelius", "https://f.com", "reframes"),
      ];

      const result = interleaveFeed(posts);

      let sameStanceAdjacent = 0;
      for (let i = 0; i < result.length - 1; i += 1) {
        if (result[i].stance === result[i + 1].stance) {
          sameStanceAdjacent += 1;
        }
      }

      expect(sameStanceAdjacent).toBeLessThan(3);
    });
  });

  describe("content type pacing", () => {
    it("gives quips a bonus after consecutive non-quip posts", () => {
      const posts = [
        makeReaction("nietzsche", "https://a.com", "challenges"),
        makeReaction("camus", "https://b.com", "reframes"),
        makeReaction("plato", "https://c.com", "defends"),
        makeReaction("kant", "https://d.com", "questions"),
        makeQuip("seneca"),
        makeReaction("marcus-aurelius", "https://e.com", "warns"),
        makeReaction("confucius", "https://f.com", "observes"),
      ];

      const result = interleaveFeed(posts);
      const quipIndex = result.findIndex((post) => post.stance === "quips");

      expect(quipIndex).toBeGreaterThanOrEqual(0);
      expect(result).toHaveLength(7);
    });

    it("gives reflections a bonus after consecutive news reactions", () => {
      const posts = [
        makeReaction("nietzsche", "https://a.com", "challenges"),
        makeReaction("camus", "https://b.com", "reframes"),
        makeReaction("plato", "https://c.com", "defends"),
        makeReaction("kant", "https://d.com", "questions"),
        makeReflection("seneca"),
        makeReaction("marcus-aurelius", "https://e.com", "warns"),
      ];

      const result = interleaveFeed(posts);
      const reflections = result.filter((post) => post.sourceType === "reflection");

      expect(result).toHaveLength(6);
      expect(reflections).toHaveLength(1);
    });
  });

  describe("reply proximity", () => {
    it("places replies near their parent post", () => {
      const parent = makeReaction("nietzsche", "https://a.com", "challenges");
      const reply = makeReply("camus", parent.id, { stance: "reframes" });
      const posts = [
        parent,
        makeReaction("plato", "https://b.com", "defends"),
        makeReaction("kant", "https://c.com", "questions"),
        reply,
        makeReaction("seneca", "https://d.com", "observes"),
        makeReaction("marcus-aurelius", "https://e.com", "warns"),
      ];

      const result = interleaveFeed(posts);
      const ids = result.map((post) => post.id);
      const parentPos = ids.indexOf(parent.id);
      const replyPos = ids.indexOf(reply.id);

      expect(parentPos).toBeGreaterThanOrEqual(0);
      expect(replyPos).toBeGreaterThanOrEqual(0);
      expect(Math.abs(replyPos - parentPos)).toBeLessThanOrEqual(3);
    });

    it("places replies adjacent to their parent even when they share the same article", () => {
      const parent = makeReaction("nietzsche", "https://hot.com", "challenges");
      const reply = makeReply("camus", parent.id, {
        citation: { title: "Article at https://hot.com", source: "Test", url: "https://hot.com" },
        stance: "reframes",
      });
      const posts = [
        parent,
        makeReaction("plato", "https://b.com", "defends"),
        makeReaction("kant", "https://c.com", "questions"),
        reply,
        makeReaction("seneca", "https://d.com", "observes"),
        makeReaction("marcus-aurelius", "https://e.com", "warns"),
      ];

      const result = interleaveFeed(posts);
      const ids = result.map((post) => post.id);
      const parentPos = ids.indexOf(parent.id);
      const replyPos = ids.indexOf(reply.id);

      expect(Math.abs(replyPos - parentPos)).toBeLessThanOrEqual(2);
    });
  });

  describe("source type diversity", () => {
    it("spreads historical event posts among news posts", () => {
      const posts = [
        makeReaction("nietzsche", "https://a.com", "challenges"),
        makeReaction("camus", "https://b.com", "reframes"),
        makePost({ philosopherId: "plato", sourceType: "historical_event", stance: "observes" }),
        makePost({ philosopherId: "kant", sourceType: "historical_event", stance: "reframes" }),
        makeReaction("seneca", "https://c.com", "defends"),
        makeReaction("marcus-aurelius", "https://d.com", "questions"),
      ];

      const result = interleaveFeed(posts);
      const historicalPositions = result
        .map((post, index) => (post.sourceType === "historical_event" ? index : -1))
        .filter((index) => index >= 0);

      expect(result).toHaveLength(6);

      if (historicalPositions.length === 2) {
        expect(Math.abs(historicalPositions[0] - historicalPositions[1])).toBeGreaterThan(1);
      }
    });
  });

  describe("stress test", () => {
    it("handles a realistic 40-post feed without errors", () => {
      const philosophers = [
        "nietzsche",
        "camus",
        "plato",
        "kant",
        "seneca",
        "marcus-aurelius",
        "confucius",
        "kierkegaard",
        "russell",
        "jung",
      ];
      const stances: FeedPost["stance"][] = [
        "challenges",
        "defends",
        "reframes",
        "questions",
        "warns",
        "observes",
        "diagnoses",
        "provokes",
      ];
      const posts: FeedPost[] = [];

      for (let i = 0; i < 30; i += 1) {
        posts.push(
          makeReaction(
            philosophers[i % philosophers.length],
            `https://article-${i % 10}.com`,
            stances[i % stances.length]
          )
        );
      }

      for (let i = 0; i < 4; i += 1) {
        posts.push(makeQuip(philosophers[i]));
      }

      for (let i = 0; i < 3; i += 1) {
        posts.push(makeReflection(philosophers[i + 4]));
      }

      posts.push(makeReply("camus", posts[0].id));
      posts.push(makeReply("kant", posts[5].id));
      posts.push(makeReply("jung", posts[10].id));

      const result = interleaveFeed(posts);
      const inputIds = new Set(posts.map((post) => post.id));
      const outputIds = new Set(result.map((post) => post.id));

      expect(result).toHaveLength(40);
      expect(outputIds).toEqual(inputIds);
    });

    it("completes in reasonable time for 100 posts", () => {
      const philosophers = ["nietzsche", "camus", "plato", "kant", "seneca"] as const;
      const stances: Stance[] = ["challenges", "defends", "reframes", "questions", "observes"];
      const posts = Array.from({ length: 100 }, (_, i) =>
        makeReaction(philosophers[i % philosophers.length], `https://article-${i % 20}.com`, stances[i % 5])
      );

      const start = performance.now();
      const result = interleaveFeed(posts);
      const elapsed = performance.now() - start;

      expect(result).toHaveLength(100);
      expect(elapsed).toBeLessThan(1000);
    });
  });
});
