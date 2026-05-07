import { describe, expect, it } from "vitest";
import {
  pickAgoraSuggestions,
  SHORT_PROMPTS,
  REFLECTIVE_PROMPTS,
  type AgoraSuggestion,
} from "./agora-suggestions";

function seededRng(seed: number): () => number {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

describe("pickAgoraSuggestions", () => {
  it("returns the requested number of suggestions", () => {
    const result = pickAgoraSuggestions(SHORT_PROMPTS, 4, seededRng(1));
    expect(result).toHaveLength(4);
  });

  it("returns empty array for count <= 0 or empty pool", () => {
    expect(pickAgoraSuggestions(SHORT_PROMPTS, 0)).toEqual([]);
    expect(pickAgoraSuggestions(SHORT_PROMPTS, -1)).toEqual([]);
    expect(pickAgoraSuggestions([], 4)).toEqual([]);
  });

  it("does not exceed the pool size", () => {
    const small: AgoraSuggestion[] = [
      { text: "a", category: "ethics" },
      { text: "b", category: "meaning" },
    ];
    const result = pickAgoraSuggestions(small, 5, seededRng(1));
    expect(result).toHaveLength(2);
  });

  it("enforces no duplicate categories until all categories are exhausted", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const result = pickAgoraSuggestions(SHORT_PROMPTS, 4, seededRng(seed));
      const cats = result.map((r) => r.category);
      expect(new Set(cats).size).toBe(cats.length);
    }
  });

  it("never returns the same suggestion twice in one draw", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const result = pickAgoraSuggestions(REFLECTIVE_PROMPTS, 6, seededRng(seed));
      const texts = result.map((r) => r.text);
      expect(new Set(texts).size).toBe(texts.length);
    }
  });

  it("produces different orderings across seeds (sanity check on randomization)", () => {
    const a = pickAgoraSuggestions(SHORT_PROMPTS, 4, seededRng(1));
    const b = pickAgoraSuggestions(SHORT_PROMPTS, 4, seededRng(2));
    expect(a.map((s) => s.text)).not.toEqual(b.map((s) => s.text));
  });

  it("once categories are exhausted, allows duplicates from the same category", () => {
    const same: AgoraSuggestion[] = [
      { text: "a", category: "ethics" },
      { text: "b", category: "ethics" },
      { text: "c", category: "ethics" },
    ];
    const result = pickAgoraSuggestions(same, 3, seededRng(1));
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.category)).toEqual(["ethics", "ethics", "ethics"]);
  });
});

describe("SHORT_PROMPTS", () => {
  it("has at least 20 entries", () => {
    expect(SHORT_PROMPTS.length).toBeGreaterThanOrEqual(20);
  });

  it("has no duplicate text", () => {
    const texts = SHORT_PROMPTS.map((p) => p.text);
    expect(new Set(texts).size).toBe(texts.length);
  });
});

describe("REFLECTIVE_PROMPTS", () => {
  it("has at least 20 entries", () => {
    expect(REFLECTIVE_PROMPTS.length).toBeGreaterThanOrEqual(20);
  });

  it("has no duplicate text", () => {
    const texts = REFLECTIVE_PROMPTS.map((p) => p.text);
    expect(new Set(texts).size).toBe(texts.length);
  });
});
