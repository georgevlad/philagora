import { describe, expect, it } from "vitest";
import { getReadingPreview } from "./reading-preview";
import { countWords } from "./content-lengths";

describe("reading previews", () => {
  it("shows short answers in full and does not change paragraph text", () => {
    const original = ["Choose a useful task.\nKeep its limits clear.", "Then rest."];
    expect(getReadingPreview(original, 90)).toEqual({ paragraphs: original, truncated: false });
  });
  it("ends at a sentence boundary and counts multiple posts together", () => {
    const original = ["Keep the first thought.", "Here is another useful thought. This remaining thought needs more room to develop fully."];
    expect(getReadingPreview(original, 12)).toEqual({ paragraphs: [original[0], "Here is another useful thought."], truncated: true });
    expect(original[1]).toContain("This remaining thought");
  });
  it("keeps quoted sentences, punctuation and names intact", () => {
    const original = ['She said, “Start here.” Then she left. This next sentence runs beyond the preview limit.'];
    const preview = getReadingPreview(original, 9);
    expect(preview.paragraphs).toEqual(['She said, “Start here.” Then she left.']);
  });
  it("bounds an unpunctuated or very long first sentence without splitting a word", () => {
    const original = [Array(150).fill("thoughtfulness").join(" ")];
    const preview = getReadingPreview(original, 80);
    expect(preview.truncated).toBe(true);
    expect(countWords(preview.paragraphs[0])).toBe(80);
    expect(preview.paragraphs[0]).toMatch(/thoughtfulness…$/);
    expect(countWords(original[0])).toBe(150);
  });
});
