import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_MOOD_PALETTES } from "@/lib/mood-data";

const mockState = vi.hoisted(() => ({
  config: new Map<string, string>(),
  palettes: new Map<string, { registers: string; is_active: number }>(),
  articles: new Map<string, { primary_tensions: string; topic_cluster: string | null }>(),
}));

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    prepare: (sql: string) => ({
      get: (value: string) => {
        if (sql.includes("FROM scoring_config")) {
          const configValue = mockState.config.get(value);
          return configValue === undefined ? undefined : { value: configValue };
        }

        if (sql.includes("FROM mood_palettes")) {
          return mockState.palettes.get(value);
        }

        if (sql.includes("FROM article_candidates")) {
          return mockState.articles.get(value);
        }

        return undefined;
      },
    }),
  }),
}));

import {
  resolveMood,
  resolveMoodForContentType,
  resolveMoodForCrossReply,
} from "@/lib/mood-service";

function seedPalette(philosopherId: string, isActive = true) {
  const palette = DEFAULT_MOOD_PALETTES.find((entry) => entry.philosopher_id === philosopherId);
  if (!palette) {
    throw new Error(`Missing palette for ${philosopherId}`);
  }

  mockState.palettes.set(philosopherId, {
    registers: JSON.stringify(palette.registers),
    is_active: isActive ? 1 : 0,
  });
}

describe("mood-service", () => {
  beforeEach(() => {
    mockState.config.clear();
    mockState.palettes.clear();
    mockState.articles.clear();
    mockState.config.set("mood_enabled", "false");
    mockState.config.set(
      "mood_content_types",
      '["news_reaction","cross_philosopher_reply"]'
    );
  });

  it("returns null when mood is globally disabled", () => {
    seedPalette("nietzsche");

    const result = resolveMood("nietzsche", ["freedom_vs_order"], "challenges", null);

    expect(result).toBeNull();
  });

  it("resolves a news reaction register on the strongest pass when enabled", () => {
    mockState.config.set("mood_enabled", "true");
    seedPalette("nietzsche");

    const result = resolveMoodForContentType({
      philosopherId: "nietzsche",
      contentType: "news_reaction",
      tensions: ["freedom_vs_order"],
      stance: "challenges",
      topicCluster: null,
    });

    expect(result).toEqual({
      register: "contemptuous delight",
      directive: "You find this both predictable and entertaining",
      line: "EMOTIONAL REGISTER: contemptuous delight \u2014 You find this both predictable and entertaining",
      pass: 1,
    });
  });

  it("falls back to the first register when no earlier pass matches", () => {
    mockState.config.set("mood_enabled", "true");
    seedPalette("russell");

    const result = resolveMood("russell", ["justice_vs_mercy"], "defends", "health");

    expect(result?.register).toBe("dry amusement");
    expect(result?.pass).toBe(6);
  });

  it("tries the second inferred counter-stance before defaulting on cross replies", () => {
    mockState.config.set("mood_enabled", "true");
    seedPalette("nietzsche");
    mockState.articles.set("https://example.com/article", {
      primary_tensions: "[]",
      topic_cluster: null,
    });

    const result = resolveMoodForCrossReply("nietzsche", {
      citation_url: "https://example.com/article",
      stance: "warns",
    });

    expect(result?.register).toBe("dark amusement");
    expect(result?.pass).toBe(4);
  });
});
