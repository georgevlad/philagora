import { describe, expect, it } from "vitest";

import { makePost, makeReaction } from "@/lib/__tests__/helpers";
import { sharesSameArticle } from "@/lib/feed-utils";

describe("sharesSameArticle", () => {
  it("returns true when both posts share the same citation URL", () => {
    const a = makeReaction("nietzsche", "https://same.com");
    const b = makeReaction("camus", "https://same.com");

    expect(sharesSameArticle(a, b)).toBe(true);
  });

  it("returns false when citation URLs differ", () => {
    const a = makeReaction("nietzsche", "https://a.com");
    const b = makeReaction("camus", "https://b.com");

    expect(sharesSameArticle(a, b)).toBe(false);
  });

  it("returns false when either post has no citation", () => {
    const a = makePost({ philosopherId: "nietzsche" });
    const b = makeReaction("camus", "https://a.com");

    expect(sharesSameArticle(a, b)).toBe(false);
    expect(sharesSameArticle(b, a)).toBe(false);
  });

  it("returns false when both posts have no citation", () => {
    const a = makePost();
    const b = makePost();

    expect(sharesSameArticle(a, b)).toBe(false);
  });

  it("matches by title+source when URLs are missing", () => {
    const a = makePost({
      citation: { title: "Big News", source: "BBC" },
    });
    const b = makePost({
      citation: { title: "Big News", source: "BBC" },
    });

    expect(sharesSameArticle(a, b)).toBe(true);
  });

  it("does not match when titles match but sources differ", () => {
    const a = makePost({
      citation: { title: "Big News", source: "BBC" },
    });
    const b = makePost({
      citation: { title: "Big News", source: "CNN" },
    });

    expect(sharesSameArticle(a, b)).toBe(false);
  });
});
