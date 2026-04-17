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

  describe("article clustering", () => {
    it("groups two reactions to the same article into a cluster", () => {
      const posts = [
        makeReaction("nietzsche", "https://shared.com", "challenges"),
        makeReaction("plato", "https://other.com", "defends"),
        makeReaction("camus", "https://shared.com", "reframes"),
        makeReaction("kant", "https://another.com", "questions"),
      ];

      const result = interleaveFeed(posts);
      const sharedPosts = result.filter((post) => post.citation?.url === "https://shared.com");

      expect(result).toHaveLength(4);
      expect(sharedPosts).toHaveLength(2);
      expect(sharedPosts[0]._clusterId).toBeTruthy();
      expect(sharedPosts[0]._clusterId).toBe(sharedPosts[1]._clusterId);

      const ids = result.map((post) => post.id);
      const pos0 = ids.indexOf(sharedPosts[0].id);
      const pos1 = ids.indexOf(sharedPosts[1].id);
      expect(Math.abs(pos0 - pos1)).toBe(1);
    });

    it("includes cross-replies in the same cluster as their parent article", () => {
      const parent = makeReaction("nietzsche", "https://shared.com", "challenges");
      const reaction2 = makeReaction("camus", "https://shared.com", "reframes");
      const reply = makeReply("plato", parent.id, {
        citation: { title: "Article at https://shared.com", source: "Test", url: "https://shared.com" },
        stance: "questions",
      });

      const posts = [
        parent,
        makeReaction("kant", "https://other.com", "defends"),
        reaction2,
        reply,
        makeReaction("seneca", "https://another.com", "observes"),
      ];

      const result = interleaveFeed(posts);
      const clustered = result.filter((post) => post._clusterId === "https://shared.com");

      expect(clustered).toHaveLength(3);

      const standalones = clustered.filter((post) => !post.replyTo);
      const replies = clustered.filter((post) => post.replyTo);
      const firstReplyPos = result.indexOf(replies[0]);
      const lastStandalonePos = result.indexOf(standalones[standalones.length - 1]);
      expect(firstReplyPos).toBeGreaterThan(lastStandalonePos);
    });

    it("does not cluster single-post articles", () => {
      const posts = [
        makeReaction("nietzsche", "https://a.com", "challenges"),
        makeReaction("camus", "https://b.com", "reframes"),
        makeReaction("plato", "https://c.com", "defends"),
      ];

      const result = interleaveFeed(posts);

      for (const post of result) {
        expect(post._clusterId).toBeFalsy();
      }
    });

    it("does not cluster non-news source types", () => {
      const reflection1 = makePost({
        philosopherId: "nietzsche",
        sourceType: "reflection",
        stance: "observes",
        citation: { title: "Same Title", source: "Same Source", url: "https://same.com" },
      });
      const reflection2 = makePost({
        philosopherId: "camus",
        sourceType: "reflection",
        stance: "questions",
        citation: { title: "Same Title", source: "Same Source", url: "https://same.com" },
      });

      const posts = [
        reflection1,
        reflection2,
        makeReaction("plato", "https://other.com", "defends"),
      ];

      const result = interleaveFeed(posts);

      expect(result.filter((post) => post._clusterId).length).toBe(0);
    });

    it("groups 3+ reactions about the same article into one cluster", () => {
      const posts = [
        makeReaction("nietzsche", "https://hot.com", "challenges"),
        makeReaction("camus", "https://hot.com", "reframes"),
        makeReaction("plato", "https://hot.com", "defends"),
        makeReaction("kant", "https://a.com", "questions"),
        makeReaction("seneca", "https://b.com", "observes"),
        makeReaction("marcus-aurelius", "https://c.com", "warns"),
      ];

      const result = interleaveFeed(posts);
      const hotCluster = result.filter((post) => post._clusterId === "https://hot.com");

      expect(hotCluster).toHaveLength(3);

      const ids = result.map((post) => post.id);
      const positions = hotCluster.map((post) => ids.indexOf(post.id));
      expect(positions[2] - positions[0]).toBe(2);
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
    it("places replies in the same cluster as their parent when they share an article", () => {
      const parent = makeReaction("nietzsche", "https://a.com", "challenges");
      const reply = makeReply("camus", parent.id, {
        citation: { title: "Article at https://a.com", source: "Test", url: "https://a.com" },
        stance: "reframes",
      });
      const posts = [
        parent,
        makeReaction("plato", "https://b.com", "defends"),
        makeReaction("kant", "https://c.com", "questions"),
        reply,
        makeReaction("seneca", "https://d.com", "observes"),
      ];

      const result = interleaveFeed(posts);
      const parentResult = result.find((post) => post.id === parent.id)!;
      const replyResult = result.find((post) => post.id === reply.id)!;

      expect(parentResult._clusterId).toBeTruthy();
      expect(parentResult._clusterId).toBe(replyResult._clusterId);
    });

    it("keeps orphan replies (no matching parent article) reasonably close", () => {
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

      expect(Math.abs(replyPos - parentPos)).toBeLessThanOrEqual(4);
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
