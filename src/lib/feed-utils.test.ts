import { describe, expect, it } from "vitest";

import {
  buildFeedContentTypeConditions,
  classifyPostFormat,
} from "@/lib/feed-utils";

describe("classifyPostFormat", () => {
  it("treats art commentary posts as reflections for feed pacing", () => {
    expect(
      classifyPostFormat({
        sourceType: "art_commentary",
        stance: "observes",
      })
    ).toBe("Reflection");
  });
});

describe("buildFeedContentTypeConditions", () => {
  it("reflections tab includes reflection, historical_event, art_commentary, and everyday source types", () => {
    const conditions = buildFeedContentTypeConditions("reflections");

    expect(conditions).toHaveLength(2);
    expect(conditions[0]).toContain(
      "IN ('reflection', 'historical_event', 'art_commentary', 'everyday')"
    );
    expect(conditions[1]).toContain("reply_to");
  });
});
